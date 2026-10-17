-- AccessChain PostgreSQL schema (draft, synthetic-data build).
-- Principles:
--  * Private user content (requirements profile, saved trips) is CIPHERTEXT ONLY. There is no plaintext column.
--  * Public venue facts are append-only: value columns are immutable; only status/disputes may change, and every change is logged.
--  * Row-level security is defence in depth. The API must still authorise every request (see PERMISSIONS.md).

CREATE TABLE accounts (
  id                    uuid PRIMARY KEY,
  created_at            timestamptz NOT NULL DEFAULT now(),
  deletion_requested_at timestamptz
);

-- Opaque ciphertext envelopes. The server cannot decrypt these.
CREATE TABLE private_items (
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  item_id    text NOT NULL CHECK (item_id ~ '^[a-z0-9-]{1,64}$'),
  version    integer NOT NULL CHECK (version >= 1),
  envelope   jsonb NOT NULL CHECK (envelope ? 'nonce' AND envelope ? 'ct' AND envelope->>'alg' = 'xchacha20poly1305'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, item_id, version)
);

CREATE TABLE recovery_blobs (
  account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  blob       jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Deleted items must not return when an older backup is restored.
CREATE TABLE tombstones (
  account_id uuid NOT NULL,
  item_id    text NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, item_id)
);

ALTER TABLE private_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_items FORCE ROW LEVEL SECURITY;
ALTER TABLE recovery_blobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_blobs FORCE ROW LEVEL SECURITY;
ALTER TABLE tombstones ENABLE ROW LEVEL SECURITY;
ALTER TABLE tombstones FORCE ROW LEVEL SECURITY;

CREATE POLICY owner_only ON private_items
  USING (account_id = NULLIF(current_setting('app.account_id', true), '')::uuid)
  WITH CHECK (account_id = NULLIF(current_setting('app.account_id', true), '')::uuid);
CREATE POLICY owner_only ON recovery_blobs
  USING (account_id = NULLIF(current_setting('app.account_id', true), '')::uuid)
  WITH CHECK (account_id = NULLIF(current_setting('app.account_id', true), '')::uuid);
CREATE POLICY owner_only ON tombstones
  USING (account_id = NULLIF(current_setting('app.account_id', true), '')::uuid)
  WITH CHECK (account_id = NULLIF(current_setting('app.account_id', true), '')::uuid);

-- ---- Public venue facts --------------------------------------------------------------------

CREATE TABLE venues (
  id   text PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE segments (
  id       text PRIMARY KEY,
  venue_id text NOT NULL REFERENCES venues(id),
  kind     text NOT NULL CHECK (kind IN ('arrival','transfer','approach','entrance')),
  label    text NOT NULL
);

CREATE TABLE feed_snapshots (
  id            text PRIMARY KEY,
  source_id     text NOT NULL,
  licence       text NOT NULL CHECK (length(licence) > 0),
  retrieved_at  timestamptz NOT NULL,
  payload_sha256 text NOT NULL
);

CREATE TABLE observations (
  id            text PRIMARY KEY,
  segment_id    text NOT NULL REFERENCES segments(id),
  attribute     text NOT NULL CHECK (attribute IN ('stepFree','clearWidthMm','walkLengthM','restingPointSpacingM','accessibleToilet','liftInService','assistanceAvailable')),
  value_bool    boolean,
  value_num     double precision,
  source_kind   text NOT NULL CHECK (source_kind IN ('operator_feed','venue_report','user_report','field_verification')),
  source_id     text NOT NULL,
  verifier_type text NOT NULL CHECK (verifier_type IN ('none','venue_self_report','paid_tester','independent_auditor','operator')),
  licence       text,
  observed_at   timestamptz NOT NULL,
  retrieved_at  timestamptz NOT NULL,
  expires_at    timestamptz NOT NULL,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','withdrawn','rejected')),
  disputes      text[] NOT NULL DEFAULT '{}',
  -- exactly one value column is set
  CONSTRAINT one_value CHECK ((value_bool IS NULL) <> (value_num IS NULL)),
  CONSTRAINT time_order CHECK (observed_at <= retrieved_at AND expires_at > observed_at),
  CONSTRAINT feed_needs_licence CHECK (source_kind <> 'operator_feed' OR (licence IS NOT NULL AND length(licence) > 0)),
  -- user reports can never carry a verifier type
  CONSTRAINT user_report_unverified CHECK (source_kind <> 'user_report' OR verifier_type = 'none')
);

CREATE TABLE observation_history (
  seq            bigserial PRIMARY KEY,
  at             timestamptz NOT NULL DEFAULT now(),
  actor_role     text NOT NULL CHECK (actor_role IN ('partner','moderator','system','intake')),
  actor_id       text NOT NULL,
  action         text NOT NULL CHECK (action IN ('add','withdraw','dispute','reject')),
  observation_id text NOT NULL REFERENCES observations(id),
  note           text
);

-- Immutability: only status and disputes may change on an observation, and nothing may be deleted.
CREATE FUNCTION observations_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'observations are append-only: delete not allowed';
  END IF;
  IF (NEW.id, NEW.segment_id, NEW.attribute, NEW.value_bool, NEW.value_num, NEW.source_kind, NEW.source_id,
      NEW.verifier_type, NEW.licence, NEW.observed_at, NEW.retrieved_at, NEW.expires_at)
     IS DISTINCT FROM
     (OLD.id, OLD.segment_id, OLD.attribute, OLD.value_bool, OLD.value_num, OLD.source_kind, OLD.source_id,
      OLD.verifier_type, OLD.licence, OLD.observed_at, OLD.retrieved_at, OLD.expires_at) THEN
    RAISE EXCEPTION 'observations are immutable: only status and disputes may change';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER observations_guard BEFORE UPDATE OR DELETE ON observations
  FOR EACH ROW EXECUTE FUNCTION observations_guard();

CREATE FUNCTION history_guard() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'observation_history is append-only';
END $$ LANGUAGE plpgsql;
CREATE TRIGGER history_guard BEFORE UPDATE OR DELETE ON observation_history
  FOR EACH ROW EXECUTE FUNCTION history_guard();

CREATE TABLE verification_badges (
  id            bigserial PRIMARY KEY,
  venue_id      text NOT NULL REFERENCES venues(id),
  scope         text NOT NULL CHECK (length(trim(scope)) > 0),
  method        text NOT NULL CHECK (length(trim(method)) > 0),
  verifier_type text NOT NULL CHECK (verifier_type <> 'none'),
  verified_at   timestamptz NOT NULL,
  valid_until   timestamptz NOT NULL,
  CONSTRAINT badge_lapses CHECK (valid_until > verified_at)
);

-- Moderation queue for public reports. Short retention; personal-detail flags recorded.
CREATE TABLE report_queue (
  id           bigserial PRIMARY KEY,
  reporter_ref text NOT NULL,
  venue_id     text NOT NULL,
  segment_id   text NOT NULL,
  attribute    text NOT NULL,
  value_bool   boolean,
  value_num    double precision,
  observed_at  timestamptz NOT NULL,
  note         text CHECK (length(note) <= 500),
  pii_flags    text[] NOT NULL DEFAULT '{}',
  state        text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','approved','rejected')),
  received_at  timestamptz NOT NULL DEFAULT now(),
  purge_after  timestamptz NOT NULL DEFAULT (now() + interval '30 days') -- placeholder; retention period needs review (RETENTION.md)
);
