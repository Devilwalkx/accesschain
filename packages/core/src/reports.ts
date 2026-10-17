import { z } from "zod";
import type { AttributeKey, Observation } from "./types.js";

/**
 * Public reports of venue access facts. They are untrusted input:
 *  - strict schema, no free-form identity fields, bounded text
 *  - personal details in free text (email, phone, postcode, "my home") hold the report for moderation
 *  - rate limits and duplicate suppression against spam
 *  - nothing becomes an Observation until a moderator approves it, and approved user reports never
 *    count as independent verification
 *  - contributor access needs and journey history are never part of a report
 */

const ATTRIBUTES = [
  "stepFree",
  "clearWidthMm",
  "walkLengthM",
  "restingPointSpacingM",
  "accessibleToilet",
  "liftInService",
  "assistanceAvailable"
] as const satisfies readonly AttributeKey[];

export const ReportSchema = z
  .object({
    /** Opaque, rotating pseudonym. Not shown publicly. Never an account email or name. */
    reporterRef: z.string().min(8).max(64),
    venueId: z.string().min(1).max(64),
    segmentId: z.string().min(1).max(64),
    attribute: z.enum(ATTRIBUTES),
    value: z.union([z.boolean(), z.number().finite().min(0).max(100_000)]),
    observedAt: z.iso.datetime(),
    /** Opaque id of a photo that has already been re-encoded/stripped on-device and validated. */
    photoRef: z.string().min(1).max(64).optional(),
    note: z.string().max(500).optional()
  })
  .strict();

export type Report = z.infer<typeof ReportSchema>;

const PII_PATTERNS: Array<[string, RegExp]> = [
  ["email address", /[^\s@]+@[^\s@]+\.[^\s@]+/],
  ["phone number", /(?:\+?\d[\s-]?){10,}/],
  ["postcode", /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i],
  ["home reference", /\b(my|our)\s+(home|house|flat|address)\b/i],
  ["health reference", /\b(my|i have|i am|diagnos\w+)\b.*\b(disab\w+|wheelchair|condition|illness)\b/i]
];

export function piiFlags(text: string | undefined): string[] {
  if (!text) return [];
  return PII_PATTERNS.filter(([, re]) => re.test(text)).map(([name]) => name);
}

export type IntakeResult =
  | { status: "queued"; report: Report; flags: string[] }
  | { status: "rejected"; reason: string };

export class ReportIntake {
  private recent = new Map<string, number[]>();
  private seen = new Set<string>();

  constructor(
    private readonly limits = { perReporter: 5, windowMs: 60 * 60 * 1000 }
  ) {}

  submit(raw: unknown, nowMs: number): IntakeResult {
    const parsed = ReportSchema.safeParse(raw);
    if (!parsed.success) return { status: "rejected", reason: "Report did not match the schema" };
    const r = parsed.data;

    const observed = Date.parse(r.observedAt);
    if (observed > nowMs + 5 * 60 * 1000) return { status: "rejected", reason: "Observation time is in the future" };

    const hits = (this.recent.get(r.reporterRef) ?? []).filter((t) => nowMs - t < this.limits.windowMs);
    if (hits.length >= this.limits.perReporter) return { status: "rejected", reason: "Rate limit exceeded" };

    const fingerprint = JSON.stringify([r.reporterRef, r.venueId, r.segmentId, r.attribute, r.value]);
    if (this.seen.has(fingerprint)) return { status: "rejected", reason: "Duplicate report" };

    hits.push(nowMs);
    this.recent.set(r.reporterRef, hits);
    this.seen.add(fingerprint);
    return { status: "queued", report: r, flags: piiFlags(r.note) };
  }
}

/** Moderator approval turns a queued report into an observation with honest provenance. */
export function approveReport(
  report: Report,
  opts: { observationId: string; retrievedAt: string; ttlDays: number; noteRedacted?: boolean }
): Observation {
  if (piiFlags(report.note).length > 0 && !opts.noteRedacted) {
    throw new Error("Report note contains personal details; redact before approval");
  }
  const expires = new Date(Date.parse(opts.retrievedAt) + opts.ttlDays * 86_400_000).toISOString();
  return {
    id: opts.observationId,
    attribute: report.attribute,
    value: report.value,
    // reporterRef is deliberately dropped: the public observation carries a generic source id.
    source: { kind: "user_report", id: "community", verifierType: "none" },
    observedAt: report.observedAt,
    retrievedAt: opts.retrievedAt,
    expiresAt: expires,
    status: "active"
  };
}
