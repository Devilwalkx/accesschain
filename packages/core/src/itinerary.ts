import { resolveAttribute } from "./evidence.js";
import type { JourneyAssessment, Observation, Reason, RouteCandidate, Verdict } from "./types.js";

/**
 * A saved itinerary snapshots provenance (which observations were relied on, and when) so the
 * user can see what the answer was based on, while live changes remain visible.
 * The private profile is NOT stored in the snapshot.
 */
export interface SavedItinerary {
  id: string;
  savedAt: string;
  routeId: string;
  verdictAtSave: Verdict;
  reasonsAtSave: Reason[];
  relied: Array<Pick<Observation, "id" | "attribute" | "value" | "observedAt" | "retrievedAt" | "expiresAt"> & { sourceKind: string; sourceId: string }>;
}

export function saveItinerary(id: string, route: RouteCandidate, a: JourneyAssessment): SavedItinerary {
  const ids = new Set(a.reasons.flatMap((r) => r.evidence));
  const relied = route.segments
    .flatMap((s) => s.observations)
    .filter((o) => ids.has(o.id))
    .map((o) => ({
      id: o.id,
      attribute: o.attribute,
      value: o.value,
      observedAt: o.observedAt,
      retrievedAt: o.retrievedAt,
      expiresAt: o.expiresAt,
      sourceKind: o.source.kind,
      sourceId: o.source.id
    }));
  return { id, savedAt: a.assessedAt, routeId: route.id, verdictAtSave: a.verdict, reasonsAtSave: a.reasons, relied };
}

export interface LiveChange {
  kind: "verdict_changed" | "reason_changed" | "evidence_expired";
  detail: string;
}

const RANK: Record<Verdict, number> = { known_fit: 0, insufficient_evidence: 1, known_barrier: 2 };

/** Compare a saved itinerary to a fresh assessment. Anything getting worse is surfaced. */
export function liveChanges(saved: SavedItinerary, current: JourneyAssessment): LiveChange[] {
  const changes: LiveChange[] = [];
  if (saved.verdictAtSave !== current.verdict) {
    const worse = RANK[current.verdict] > RANK[saved.verdictAtSave];
    changes.push({
      kind: "verdict_changed",
      detail: `${worse ? "Worse" : "Better"} than when saved: ${label(saved.verdictAtSave)} → ${label(current.verdict)}.`
    });
  }
  const before = new Map(saved.reasonsAtSave.map((r) => [`${r.segmentId}|${r.requirement}`, r.verdict]));
  for (const r of current.reasons) {
    const prev = before.get(`${r.segmentId}|${r.requirement}`);
    if (prev && prev !== r.verdict) {
      changes.push({ kind: "reason_changed", detail: `${r.requirement} (${r.segmentId}): ${label(prev)} → ${label(r.verdict)}. ${r.detail}` });
    }
  }
  for (const o of saved.relied) {
    if (Date.parse(o.expiresAt) <= Date.parse(current.assessedAt)) {
      changes.push({ kind: "evidence_expired", detail: `Evidence "${o.attribute}" from ${o.sourceId} has expired since you saved this.` });
    }
  }
  return changes;
}

export function label(v: Verdict): string {
  return v === "known_fit" ? "Known fit" : v === "known_barrier" ? "Known barrier" : "Insufficient evidence";
}

function age(iso: string, now: string): string {
  const mins = Math.max(0, Math.round((Date.parse(now) - Date.parse(iso)) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}

/** Screen-reader-first itinerary. The map is an addition to this, never a substitute. */
export function renderTextItinerary(route: RouteCandidate, a: JourneyAssessment): string {
  const lines: string[] = [];
  lines.push(`Route ${route.id} (via ${route.provider}): ${label(a.verdict)}.`);
  lines.push("This is a summary of reported information, not a guarantee. Where it says insufficient evidence, the information is missing, expired or in conflict.");
  route.segments.forEach((seg, i) => {
    lines.push(`Step ${i + 1} of ${route.segments.length}: ${seg.label} (${seg.kind}).`);
    for (const r of a.reasons.filter((x) => x.segmentId === seg.id)) {
      lines.push(`  ${label(r.verdict)} for ${r.requirement}: ${r.detail}`);
    }
    for (const o of seg.observations.filter((x) => x.status === "active")) {
      const res = resolveAttribute(seg, o.attribute, a.assessedAt);
      const note = res.state === "stale" ? " (expired)" : "";
      lines.push(`  Source: ${o.attribute} reported by ${o.source.kind.replace(/_/g, " ")}, observed ${age(o.observedAt, a.assessedAt)}, retrieved ${age(o.retrievedAt, a.assessedAt)}${note}.`);
    }
  });
  for (const r of a.reasons.filter((x) => x.segmentId === "*")) {
    lines.push(`Whole journey – ${label(r.verdict)} for ${r.requirement}: ${r.detail}`);
  }
  return lines.join("\n");
}
