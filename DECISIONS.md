# AccessChain – Decisions (ADR log, DRAFT)

## D-001 Competitor and reference sources could not be checked
Sociability, AccessNow, TfL (specification PDF and Unified API page) and Expo docs all returned a proxy 403 from the build environment; only the npm registry was reachable. **Consequence:** no competitor claim, TfL data format, licence, Expo behaviour or ICO guidance was verified in this session. Everything that depends on them is marked open. *Action:* re-check from an unrestricted machine before Phase 0 conclusions.

## D-002 Monorepo: TypeScript core + Expo client + SQL schema
`packages/core` holds all decision logic (evidence, matching, vault, privacy, facts, reports) as pure TypeScript so it is unit-testable and shared by the phone client and any later server. `apps/mobile` is Expo/React Native (SDK 58, React 19.3, RN 0.88, versions taken from the installed `expo` package's bundled-module list). `packages/db` tests `db/schema.sql` against an in-process PostgreSQL (PGlite). Expo Go compatibility of `expo-secure-store`, `expo-image-manipulator`, `expo-crypto` etc. is **not verified**; a development build is likely needed.

## D-003 Cryptography
XChaCha20-Poly1305 (192-bit random nonces, safe for per-item random nonces) and HKDF-SHA256 from `@noble/ciphers` / `@noble/hashes` (audited, pure JS, no native module needed). The plan mentions AES-256-GCM "such as"; XChaCha was chosen to avoid nonce-reuse limits and native dependencies. No custom primitives. The **composition** (AAD binding, recovery wrapping) is ours and needs independent review (RISK S1). Biometrics only gate local key use in future; they never derive keys. Recovery uses a 256-bit user-held secret, so HKDF (not a password KDF) is appropriate; a user-chosen passphrase would require a memory-hard KDF and a new decision.

## D-004 Proposed backend (not built)
Proposal: managed PostgreSQL with row-level security, managed authentication with passkeys/MFA, private object storage, and a durable job queue, all in a UK (London) region where available. **Candidate suppliers, regions, subprocessors and operating costs have not been verified or quoted** (no network access to pricing or terms). Cost table: *to be completed*. Region is a preference, not proof of no overseas transfer: support access and subprocessors must be assessed (PRIVACY_REGISTER §5). `db/schema.sql` is supplier-neutral PostgreSQL.

## D-005 No sharing or multi-device key exchange in MVP
Encrypted sharing and new-device enrolment require authenticated recipient/device keys so the server cannot substitute keys. No defensible, reviewed design exists in this build, so it is **not built** and the UI does not offer it. Backup/restore relies on the recovery secret instead.

## D-006 No route provider implemented
`core/routes.ts` defines the adapter contract, minimised coordinates, timeout, schema validation and failure states. A real adapter (TfL Unified API or other) must be written from the provider's actual documentation and licence, which could not be read (D-001). Fixtures are labelled synthetic and the UI shows a synthetic banner.

## D-007 Output is three states, no score
`known_fit | known_barrier | insufficient_evidence`. Missing, expired, conflicting or unmodelled evidence can never yield fit. A "probability" or percentage would imply precision we do not have.

## D-008 Conflicts are not auto-resolved
Fresh evidence that disagrees yields a conflict; if the disagreement decides the requirement, the result is insufficient evidence. A moderator dispute link forces conflict even when values match. No source is "always right".

## D-009 Append-only public facts
Observations are immutable; status and dispute links change with history. Enforced in code and in PostgreSQL triggers. Partners may withdraw only their own statements.

## D-010 Metro resolver for `.js` specifiers
Core uses NodeNext-style `./x.js` imports for TypeScript sources. `apps/mobile/metro.config.js` maps them to the extensionless module so Metro resolves the `.ts` files. Verified by Android and iOS bundling, not on a device.

## D-011 Photos
Primary control is on-device re-encode (drops metadata); a second control strips and re-verifies the bytes with `core/privacy.ts`; failure rejects the photo. Faces/bystanders are handled by user warning and moderation only. No face recognition or detection is used.

## D-012 Location
Manual origin supported; optional one-shot coarse foreground location; Android build config blocks background and fine location; coordinates rounded to ~100 m before any third-party call. Verified by running `expo prebuild`: Android requests only `ACCESS_COARSE_LOCATION` and `INTERNET` (plus a dev-tooling `SYSTEM_ALERT_WINDOW`/`VIBRATE` default to review for release); iOS declares only when-in-use location and the photo-library description. Disclosed as not private from the route provider.

## D-013 Accessibility approach
Text-first itinerary is the primary view; the map is a future addition. Meaning always carried by text (never colour alone), 48-pt targets, roles/labels/hints, live regions. **Unverified until tested with screen-reader users on real devices.**

## D-014 What this repo does not decide
Lawful bases, controller/processor roles, retention periods, supplier terms, DPIA outcome, product claims wording and pricing are **open** and listed in PRIVACY_REGISTER §7. Pricing for institutional payers is untested and nothing in this build assumes a price.
