import { evidenceIds, resolveAttribute } from "./evidence.js";
import type { RequirementsProfile } from "./profile.js";
import type {
  AttributeKey,
  JourneyAssessment,
  Reason,
  Resolution,
  RouteCandidate,
  Segment,
  Verdict
} from "./types.js";

/**
 * Deterministic matching. There is intentionally no score or probability:
 * outcomes are known_fit, known_barrier or insufficient_evidence. A required
 * attribute that is missing, stale or in conflict can never produce known_fit.
 */

type Check = { requirement: string; verdict: Verdict; detail: string; evidence: string[] };

function unknownDetail(r: Resolution, what: string): string {
  switch (r.state) {
    case "missing":
      return `No evidence for ${what}.`;
    case "stale":
      return `Evidence for ${what} has expired; treated as unknown.`;
    case "conflict":
      return `Sources disagree about ${what}.`;
    case "known":
      return "";
  }
}

function numericValues(r: Resolution): number[] | null {
  if (r.state === "known") return typeof r.value === "number" ? [r.value] : null;
  if (r.state === "conflict") {
    const nums = r.values.filter((v): v is number => typeof v === "number");
    return nums.length === r.values.length ? nums : null;
  }
  return null;
}

function boolValue(r: Resolution): boolean | null {
  return r.state === "known" && typeof r.value === "boolean" ? r.value : null;
}

/** Evaluate a numeric limit across all fresh values; mixed outcomes mean a decisive conflict. */
function limitCheck(
  requirement: string,
  what: string,
  r: Resolution,
  ok: (v: number) => boolean,
  unit: string
): Check {
  const vals = numericValues(r);
  if (!vals) {
    return { requirement, verdict: "insufficient_evidence", detail: unknownDetail(r, what), evidence: evidenceIds(r) };
  }
  const passes = vals.map(ok);
  const evidence = evidenceIds(r);
  if (passes.every(Boolean)) {
    return { requirement, verdict: "known_fit", detail: `${what}: ${vals.join(" / ")}${unit} meets your requirement.`, evidence };
  }
  if (passes.every((p) => !p)) {
    return { requirement, verdict: "known_barrier", detail: `${what}: ${vals.join(" / ")}${unit} does not meet your requirement.`, evidence };
  }
  return {
    requirement,
    verdict: "insufficient_evidence",
    detail: `Sources disagree about ${what} (${vals.join(" vs ")}${unit}) and the disagreement decides the outcome.`,
    evidence
  };
}

function stepChecks(seg: Segment, p: RequirementsProfile, now: string): Check[] {
  if (!p.avoidSteps) return [];
  const step = resolveAttribute(seg, "stepFree", now);
  const sf = boolValue(step);
  if (sf === true) {
    return [{ requirement: "avoid steps", verdict: "known_fit", detail: "Reported step-free.", evidence: evidenceIds(step) }];
  }
  const assist = resolveAttribute(seg, "assistanceAvailable", now);
  const av = boolValue(assist);
  if (sf === false) {
    if (p.assistanceAcceptable && av === true) {
      return [{
        requirement: "avoid steps",
        verdict: "known_fit",
        detail: "Has steps; assistance is reported as available and must be arranged.",
        evidence: [...evidenceIds(step), ...evidenceIds(assist)]
      }];
    }
    if (p.assistanceAcceptable && av === null) {
      return [{
        requirement: "avoid steps",
        verdict: "insufficient_evidence",
        detail: `Has steps; ${unknownDetail(assist, "assistance availability")}`,
        evidence: evidenceIds(step)
      }];
    }
    return [{ requirement: "avoid steps", verdict: "known_barrier", detail: "Reported to have steps.", evidence: evidenceIds(step) }];
  }
  return [{ requirement: "avoid steps", verdict: "insufficient_evidence", detail: unknownDetail(step, "steps"), evidence: evidenceIds(step) }];
}

function liftChecks(seg: Segment, p: RequirementsProfile, now: string): Check[] {
  if (!seg.usesLift) return [];
  if (!p.liftAcceptable) {
    return [{ requirement: "lift", verdict: "known_barrier", detail: "This segment depends on a lift and you chose not to use lifts.", evidence: [] }];
  }
  const lift = resolveAttribute(seg, "liftInService", now);
  const v = boolValue(lift);
  if (v === true) return [{ requirement: "lift", verdict: "known_fit", detail: "Lift reported in service.", evidence: evidenceIds(lift) }];
  if (v === false) return [{ requirement: "lift", verdict: "known_barrier", detail: "Lift reported out of service.", evidence: evidenceIds(lift) }];
  return [{ requirement: "lift", verdict: "insufficient_evidence", detail: unknownDetail(lift, "lift status"), evidence: evidenceIds(lift) }];
}

function segmentChecks(seg: Segment, p: RequirementsProfile, now: string): Check[] {
  const checks: Check[] = [...stepChecks(seg, p, now), ...liftChecks(seg, p, now)];
  if (p.minClearWidthMm !== undefined) {
    const min = p.minClearWidthMm;
    checks.push(limitCheck("clear width", "Clear width", resolveAttribute(seg, "clearWidthMm", now), (v) => v >= min, " mm"));
  }
  if (p.maxRestGapM !== undefined && seg.walking) {
    const max = p.maxRestGapM;
    checks.push(limitCheck("resting points", "Gap between resting points", resolveAttribute(seg, "restingPointSpacingM", now), (v) => v <= max, " m"));
  }
  if (p.needsAccessibleToilet && seg.kind === "entrance") {
    const t = resolveAttribute(seg, "accessibleToilet", now);
    const v = boolValue(t);
    checks.push({
      requirement: "accessible toilet",
      verdict: v === true ? "known_fit" : v === false ? "known_barrier" : "insufficient_evidence",
      detail: v === null ? unknownDetail(t, "accessible toilet") : v ? "Accessible toilet reported." : "No accessible toilet reported.",
      evidence: evidenceIds(t)
    });
  }
  return checks;
}

function walkingCheck(route: RouteCandidate, p: RequirementsProfile, now: string): Reason[] {
  if (p.maxWalkM === undefined) return [];
  const limit = p.maxWalkM;
  let worst = 0;
  let best = 0;
  const evidence: string[] = [];
  const unknownSegs: string[] = [];
  for (const seg of route.segments.filter((s) => s.walking)) {
    const r = resolveAttribute(seg, "walkLengthM", now);
    const vals = numericValues(r);
    if (!vals) {
      unknownSegs.push(seg.label);
      continue;
    }
    worst += Math.max(...vals);
    best += Math.min(...vals);
    evidence.push(...evidenceIds(r));
  }
  const base = { segmentId: "*", requirement: "walking distance", evidence };
  if (best > limit) {
    return [{ ...base, verdict: "known_barrier", detail: `Known walking distance is at least ${best} m; your limit is ${limit} m.` }];
  }
  if (unknownSegs.length > 0) {
    return [{ ...base, verdict: "insufficient_evidence", detail: `Walking length unknown for: ${unknownSegs.join(", ")}.` }];
  }
  if (worst > limit) {
    return [{ ...base, verdict: "insufficient_evidence", detail: `Sources disagree and the total could be ${worst} m; your limit is ${limit} m.` }];
  }
  return [{ ...base, verdict: "known_fit", detail: `Total walking ${worst} m is within your ${limit} m limit.` }];
}

/** A journey must be modelled end to end; a missing approach or entrance is unknown, not fine. */
function completenessReasons(route: RouteCandidate): Reason[] {
  const kinds = new Set(route.segments.map((s) => s.kind));
  const reasons: Reason[] = [];
  for (const needed of ["approach", "entrance"] as const) {
    if (!kinds.has(needed)) {
      reasons.push({
        segmentId: "*",
        requirement: "journey completeness",
        verdict: "insufficient_evidence",
        detail: `No ${needed} segment is modelled for this route; that part of the journey is unknown.`,
        evidence: []
      });
    }
  }
  return reasons;
}

export function aggregate(reasons: Reason[]): Verdict {
  if (reasons.some((r) => r.verdict === "known_barrier")) return "known_barrier";
  if (reasons.length === 0 || reasons.some((r) => r.verdict === "insufficient_evidence")) return "insufficient_evidence";
  return "known_fit";
}

export function assessRoute(route: RouteCandidate, profile: RequirementsProfile, now: string): JourneyAssessment {
  const reasons: Reason[] = [...completenessReasons(route)];
  for (const seg of route.segments) {
    for (const c of segmentChecks(seg, profile, now)) reasons.push({ segmentId: seg.id, ...c });
  }
  reasons.push(...walkingCheck(route, profile, now));
  if (reasons.every((r) => r.requirement === "journey completeness")) {
    reasons.push({
      segmentId: "*",
      requirement: "none set",
      verdict: "known_fit",
      detail: "Your profile sets no requirements, so nothing about the route was checked.",
      evidence: []
    });
  }
  return { routeId: route.id, verdict: aggregate(reasons), reasons, assessedAt: now };
}

/** Only evidence-backed alternatives are offered. */
export function evidenceBackedAlternatives(assessments: JourneyAssessment[]): JourneyAssessment[] {
  return assessments.filter((a) => a.verdict === "known_fit");
}

export type AttributeUsed = AttributeKey;
