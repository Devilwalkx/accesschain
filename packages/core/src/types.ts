// Domain types. Public venue/route facts only; private profiles live in profile.ts.

export type SourceKind = "operator_feed" | "venue_report" | "user_report" | "field_verification";
export type VerifierType = "none" | "venue_self_report" | "paid_tester" | "independent_auditor" | "operator";

export type SegmentKind = "arrival" | "transfer" | "approach" | "entrance";

/** Attributes we can hold evidence about. Anything not listed is not modelled. */
export type AttributeKey =
  | "stepFree" // boolean
  | "clearWidthMm" // number, narrowest point
  | "walkLengthM" // number
  | "restingPointSpacingM" // number, max distance between rest points
  | "accessibleToilet" // boolean
  | "liftInService" // boolean, only meaningful for segments with a lift
  | "assistanceAvailable"; // boolean

export type AttributeValue = boolean | number;

export interface Source {
  kind: SourceKind;
  /** Stable id of the feed/reporter/verifier (never a personal identifier for user reports). */
  id: string;
  verifierType: VerifierType;
  /** Licence/attribution string for feed data; required for operator_feed. */
  licence?: string;
}

export interface Observation {
  id: string;
  attribute: AttributeKey;
  value: AttributeValue;
  source: Source;
  /** When the fact was observed in the world. */
  observedAt: string;
  /** When we retrieved/received it. */
  retrievedAt: string;
  /** After this instant the observation no longer counts as evidence. */
  expiresAt: string;
  /** Observation ids this one disputes (set by moderation, not by the venue). */
  disputes?: string[];
  status: "active" | "withdrawn" | "rejected";
}

export interface Segment {
  id: string;
  kind: SegmentKind;
  label: string;
  /** Optional lift this segment depends on; lift status is read from `liftInService` observations on this segment. */
  usesLift?: boolean;
  /** Whether this segment counts towards walking distance. */
  walking: boolean;
  observations: Observation[];
}

export interface RouteCandidate {
  id: string;
  /** Short plain-English name, e.g. "Walk about 930 m". Display only. */
  title?: string;
  /** Extra messages from the data source (e.g. a lift outage notice). Display only. */
  notes?: string[];
  /** Turn-by-turn text from the data source. Display only. */
  directions?: string[];
  /** Where the candidate came from, e.g. a licensed routing service. Never invented locally. */
  provider: string;
  segments: Segment[];
}

export type Tri = "yes" | "no" | "unknown";

/** Evidence state for one attribute on one segment. */
export type Resolution =
  | { state: "known"; value: AttributeValue; basis: Observation[] }
  | { state: "conflict"; values: AttributeValue[]; basis: Observation[] }
  | { state: "stale"; lastKnown: Observation[] }
  | { state: "missing" };

export type Verdict = "known_fit" | "known_barrier" | "insufficient_evidence";

export interface Reason {
  segmentId: string;
  requirement: string;
  verdict: Verdict;
  detail: string;
  /** Observation ids behind this reason; empty means no usable evidence. */
  evidence: string[];
}

export interface JourneyAssessment {
  routeId: string;
  verdict: Verdict;
  reasons: Reason[];
  assessedAt: string;
}
