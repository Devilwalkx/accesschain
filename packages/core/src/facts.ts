import type { Observation, Source, VerifierType } from "./types.js";

/**
 * Public venue fact store with provenance. Rules enforced here (not in the UI):
 *  - append-only: nothing is overwritten or deleted, only superseded/withdrawn with a history entry
 *  - a source may only withdraw its own observations; a venue partner cannot suppress a contradicting report
 *  - disputes are recorded by moderation and keep both sides visible
 *  - verification badges carry scope, method, verifier type and date, and expire
 */

export type Actor =
  | { role: "partner"; partnerId: string }
  | { role: "moderator"; moderatorId: string }
  | { role: "system"; feedId: string }
  /** Publishes a user report that a moderator has already approved. */
  | { role: "intake"; approvedBy: string };

export interface HistoryEntry {
  seq: number;
  at: string;
  actor: Actor;
  action: "add" | "withdraw" | "dispute" | "reject";
  observationId: string;
  note?: string;
}

export class FactStore {
  private obs = new Map<string, Observation>();
  private history: HistoryEntry[] = [];

  add(actor: Actor, o: Observation, at: string): void {
    if (this.obs.has(o.id)) throw new Error(`Observation ${o.id} already exists; observations are immutable`);
    if (actor.role === "partner" && !(o.source.kind === "venue_report" && o.source.id === actor.partnerId)) {
      throw new Error("A partner may only add venue_report observations under its own source id");
    }
    if (actor.role === "system" && !(o.source.kind === "operator_feed" && o.source.id === actor.feedId)) {
      throw new Error("A feed may only add operator_feed observations under its own source id");
    }
    if (actor.role === "intake" && o.source.kind !== "user_report") {
      throw new Error("Moderated intake may only publish user_report observations");
    }
    if (actor.role === "moderator") throw new Error("Moderators dispute or reject; they do not author facts");
    this.obs.set(o.id, structuredClone(o));
    this.log(actor, "add", o.id, at);
  }

  /** Withdraw an observation. Partners may only withdraw their own; the entry stays in history. */
  withdraw(actor: Actor, observationId: string, at: string, note?: string): void {
    const o = this.mustGet(observationId);
    const own = actor.role === "partner" && o.source.kind === "venue_report" && o.source.id === actor.partnerId;
    if (!own && actor.role !== "moderator") {
      throw new Error("Only the originating partner or a moderator may withdraw an observation");
    }
    o.status = "withdrawn";
    this.log(actor, "withdraw", observationId, at, note);
  }

  /** Moderation links a contradicting observation to the one it disputes. Both stay visible. */
  dispute(actor: Actor, observationId: string, disputesId: string, at: string, note?: string): void {
    if (actor.role !== "moderator") throw new Error("Only moderators may record disputes");
    this.mustGet(disputesId);
    const o = this.mustGet(observationId);
    o.disputes = [...new Set([...(o.disputes ?? []), disputesId])];
    this.log(actor, "dispute", observationId, at, note);
  }

  reject(actor: Actor, observationId: string, at: string, note: string): void {
    if (actor.role !== "moderator") throw new Error("Only moderators may reject observations");
    this.mustGet(observationId).status = "rejected";
    this.log(actor, "reject", observationId, at, note);
  }

  all(): Observation[] {
    return [...this.obs.values()].map((o) => structuredClone(o));
  }

  getHistory(): HistoryEntry[] {
    return structuredClone(this.history);
  }

  private mustGet(id: string): Observation {
    const o = this.obs.get(id);
    if (!o) throw new Error(`Unknown observation ${id}`);
    return o;
  }

  private log(actor: Actor, action: HistoryEntry["action"], observationId: string, at: string, note?: string): void {
    this.history.push({ seq: this.history.length + 1, at, actor, action, observationId, ...(note ? { note } : {}) });
  }
}

// ---- Verification badges -----------------------------------------------------------------

export interface VerificationBadge {
  venueId: string;
  /** What exactly was checked, e.g. "step-free route from Tube exit to main entrance". */
  scope: string;
  method: string;
  verifierType: VerifierType;
  verifiedAt: string;
  /** Badges lapse; they never imply permanent certainty. */
  validUntil: string;
}

export function badgeStatus(b: VerificationBadge, now: string): "current" | "lapsed" | "invalid" {
  if (!b.scope.trim() || !b.method.trim() || b.verifierType === "none") return "invalid";
  const v = Date.parse(b.verifiedAt);
  const u = Date.parse(b.validUntil);
  const n = Date.parse(now);
  if ([v, u, n].some(Number.isNaN) || u <= v) return "invalid";
  return u > n ? "current" : "lapsed";
}

/** A self-report by the venue is not an independent verification, and must be labelled as such. */
export function badgeLabel(b: VerificationBadge, now: string): string {
  const s = badgeStatus(b, now);
  if (s === "invalid") return "Not verified";
  const who = b.verifierType === "venue_self_report" ? "Reported by venue" : `Checked by ${b.verifierType.replace(/_/g, " ")}`;
  const date = b.verifiedAt.slice(0, 10);
  return s === "current" ? `${who} on ${date}: ${b.scope}` : `${who} on ${date} (lapsed): ${b.scope}`;
}

// ---- Ranking separation ------------------------------------------------------------------

export interface VenueResult {
  venueId: string;
  distanceM: number;
  verdict: "known_fit" | "known_barrier" | "insufficient_evidence";
  /** Commercial attributes. Present on the record but must never influence ordering. */
  subscriptionTier?: string;
  sponsored?: boolean;
}

const VERDICT_ORDER = { known_fit: 0, insufficient_evidence: 1, known_barrier: 2 } as const;

/** Order depends only on evidence-backed fit, then distance, then id for stability. */
export function rankVenues(results: VenueResult[]): VenueResult[] {
  return [...results].sort(
    (a, b) =>
      VERDICT_ORDER[a.verdict] - VERDICT_ORDER[b.verdict] || a.distanceM - b.distanceM || a.venueId.localeCompare(b.venueId)
  );
}

export type { Source };
