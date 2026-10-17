import type { AttributeKey, Observation, Resolution, Segment } from "./types.js";

/** Tolerance for clocks that are slightly ahead; beyond this an observation "from the future" is untrusted. */
const FUTURE_SKEW_MS = 5 * 60 * 1000;

function ms(iso: string): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) throw new Error(`Invalid timestamp: ${iso}`);
  return t;
}

/** Structural sanity: an observation we cannot trust is not evidence. */
export function observationProblems(o: Observation, now: string): string[] {
  const problems: string[] = [];
  let observed: number, retrieved: number, expires: number;
  try {
    observed = ms(o.observedAt);
    retrieved = ms(o.retrievedAt);
    expires = ms(o.expiresAt);
  } catch {
    return ["unparseable timestamp"];
  }
  const n = ms(now);
  if (observed > retrieved) problems.push("observed after it was retrieved");
  if (observed > n + FUTURE_SKEW_MS) problems.push("observed in the future");
  if (expires <= observed) problems.push("expires before it was observed");
  if (o.source.kind === "operator_feed" && !o.source.licence) problems.push("operator feed without licence/attribution");
  if (typeof o.value === "number" && !Number.isFinite(o.value)) problems.push("non-finite number");
  return problems;
}

export function isFresh(o: Observation, now: string): boolean {
  return ms(o.expiresAt) > ms(now);
}

/**
 * Resolve what we actually know about one attribute on one segment.
 * - Withdrawn/rejected/malformed observations are ignored.
 * - Expired observations are never evidence ("stale", last-known kept for display only).
 * - Fresh observations that disagree, or that moderation has disputed, are a conflict:
 *   no source wins automatically.
 */
export function resolveAttribute(segment: Segment, attribute: AttributeKey, now: string): Resolution {
  const usable = segment.observations.filter(
    (o) => o.attribute === attribute && o.status === "active" && observationProblems(o, now).length === 0
  );
  if (usable.length === 0) return { state: "missing" };

  const fresh = usable.filter((o) => isFresh(o, now));
  if (fresh.length === 0) return { state: "stale", lastKnown: usable };

  const freshIds = new Set(fresh.map((o) => o.id));
  const disputed = fresh.some((o) => (o.disputes ?? []).some((id) => freshIds.has(id)));
  const distinct = new Set(fresh.map((o) => o.value));
  if (distinct.size > 1 || disputed) {
    return { state: "conflict", values: [...distinct], basis: fresh };
  }
  return { state: "known", value: fresh[0]!.value, basis: fresh };
}

export function evidenceIds(r: Resolution): string[] {
  switch (r.state) {
    case "known":
    case "conflict":
      return r.basis.map((o) => o.id);
    case "stale":
    case "missing":
      return [];
  }
}
