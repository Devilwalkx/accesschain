import type { RequirementsProfile } from "./profile.js";
import type { Observation, RouteCandidate, Segment, Source } from "./types.js";

/**
 * SYNTHETIC DATA ONLY. "Example Road station" and "Fictional Hall" do not exist.
 * Nothing here is real access information and must never be shown as such.
 */
export const SYNTHETIC_NOTICE = "Synthetic demonstration data. Not real access information.";

export const T0 = "2026-10-17T09:00:00.000Z"; // synthetic "now" for demos and tests

const feed: Source = { kind: "operator_feed", id: "synthetic-station-feed", verifierType: "operator", licence: "SYNTHETIC-DEMO" };
const field: Source = { kind: "field_verification", id: "synthetic-field-check-1", verifierType: "paid_tester" };
const venue: Source = { kind: "venue_report", id: "fictional-hall", verifierType: "venue_self_report" };

let n = 0;
export function obs(
  attribute: Observation["attribute"],
  value: Observation["value"],
  source: Source,
  observedAt: string,
  expiresAt: string,
  retrievedAt = observedAt
): Observation {
  n += 1;
  return { id: `syn-${n}`, attribute, value, source, observedAt, retrievedAt, expiresAt, status: "active" };
}

const plusMin = (iso: string, m: number) => new Date(Date.parse(iso) + m * 60_000).toISOString();
const plusDays = (iso: string, d: number) => new Date(Date.parse(iso) + d * 86_400_000).toISOString();

export function syntheticProfile(): RequirementsProfile {
  return {
    avoidSteps: true,
    maxWalkM: 400,
    minClearWidthMm: 800,
    needsAccessibleToilet: false,
    liftAcceptable: true,
    assistanceAcceptable: false
  };
}

function station(): Segment {
  return {
    id: "arrive-station",
    kind: "arrival",
    label: "Example Road station: lift from platform to street",
    usesLift: true,
    walking: false,
    observations: [
      obs("stepFree", true, feed, T0, plusDays(T0, 30)),
      obs("clearWidthMm", 1100, field, T0, plusDays(T0, 180)),
      // Live lift feed: only trusted for 30 minutes after retrieval.
      obs("liftInService", true, feed, T0, plusMin(T0, 30))
    ]
  };
}

export function syntheticRoutes(): RouteCandidate[] {
  const unverifiedPavement: Segment = {
    id: "approach-pavement",
    kind: "approach",
    label: "Example Road pavement to Fictional Hall (kerb heights not checked)",
    walking: true,
    observations: [obs("walkLengthM", 180, feed, T0, plusDays(T0, 90))]
  };
  const sideEntrance: Segment = {
    id: "entrance-side",
    kind: "entrance",
    label: "Fictional Hall side entrance on Mill Lane",
    walking: false,
    observations: [
      obs("stepFree", true, venue, T0, plusDays(T0, 90)),
      obs("clearWidthMm", 920, field, T0, plusDays(T0, 180)),
      obs("accessibleToilet", true, venue, T0, plusDays(T0, 90))
    ]
  };
  const mainEntrance: Segment = {
    id: "entrance-main",
    kind: "entrance",
    label: "Fictional Hall main entrance on Example Road",
    walking: false,
    observations: [obs("stepFree", false, field, T0, plusDays(T0, 180)), obs("clearWidthMm", 1100, field, T0, plusDays(T0, 180))]
  };
  return [
    { id: "route-main", provider: "synthetic-router", segments: [station(), structuredClone(unverifiedPavement), mainEntrance] },
    { id: "route-side", provider: "synthetic-router", segments: [station(), structuredClone(unverifiedPavement), sideEntrance] }
  ];
}

/** Field verification of the pavement, used to show an "unverified" segment becoming known. */
export function pavementFieldCheck(): Observation[] {
  return [
    obs("stepFree", true, field, T0, plusDays(T0, 180)),
    obs("clearWidthMm", 1400, field, T0, plusDays(T0, 180)),
    obs("restingPointSpacingM", 90, field, T0, plusDays(T0, 180))
  ];
}
