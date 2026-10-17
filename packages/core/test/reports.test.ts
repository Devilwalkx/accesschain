import { describe, expect, it } from "vitest";
import { ReportIntake, approveReport, piiFlags, resolveAttribute } from "../src/index.js";
import { seg } from "./helpers.js";

const now = Date.parse("2026-10-17T09:00:00Z");
const good = {
  reporterRef: "pseud-12345678", venueId: "hall", segmentId: "entrance-side", attribute: "stepFree", value: true,
  observedAt: "2026-10-17T08:00:00Z", note: "Ramp at the door"
};

describe("report intake (malformed / spam / hostile)", () => {
  it("queues a valid report; nothing is published without moderation", () => {
    const r = new ReportIntake().submit(good, now);
    expect(r.status).toBe("queued");
  });
  it("rejects unknown fields (no smuggled identity/needs), bad types, NaN, huge notes, future times", () => {
    const i = new ReportIntake();
    expect(i.submit({ ...good, email: "a@b.co" }, now).status).toBe("rejected");
    expect(i.submit({ ...good, attribute: "diagnosis" }, now).status).toBe("rejected");
    expect(i.submit({ ...good, value: Number.NaN }, now).status).toBe("rejected");
    expect(i.submit({ ...good, value: 1e9 }, now).status).toBe("rejected");
    expect(i.submit({ ...good, note: "x".repeat(501) }, now).status).toBe("rejected");
    expect(i.submit({ ...good, observedAt: "2026-10-18T09:00:00Z" }, now).status).toBe("rejected");
    expect(i.submit("<script>", now).status).toBe("rejected");
    expect(i.submit(null, now).status).toBe("rejected");
  });
  it("rate-limits per reporter and suppresses duplicates", () => {
    const i = new ReportIntake({ perReporter: 3, windowMs: 3_600_000 });
    expect(i.submit(good, now).status).toBe("queued");
    expect(i.submit(good, now + 1).status).toBe("rejected"); // duplicate
    for (let k = 0; k < 2; k++) expect(i.submit({ ...good, value: 100 + k, attribute: "walkLengthM", segmentId: `s${k}` }, now + 2).status).toBe("queued");
    expect(i.submit({ ...good, attribute: "clearWidthMm", value: 900 }, now + 3).status).toBe("rejected"); // rate limit
    expect(i.submit({ ...good, attribute: "clearWidthMm", value: 900 }, now + 3_700_000).status).toBe("queued"); // window passed
  });
  it("flags personal details for moderation, and approval refuses un-redacted notes", () => {
    for (const note of ["call me on 07700 900123 about it", "ask at jo@example.com", "I live near SW1A 2AA", "it's near my home", "I have a disability and use a wheelchair"]) {
      expect(piiFlags(note).length, note).toBeGreaterThan(0);
    }
    expect(piiFlags("Ramp at the door, 1m wide")).toEqual([]);
    const q = new ReportIntake().submit({ ...good, note: "near my home" }, now);
    if (q.status !== "queued") throw new Error("expected queued");
    expect(q.flags.length).toBeGreaterThan(0);
    expect(() => approveReport(q.report, { observationId: "o1", retrievedAt: "2026-10-17T09:00:00Z", ttlDays: 90 })).toThrow();
  });
  it("approved reports drop the reporter pseudonym, are never 'verified', and expire", () => {
    const q = new ReportIntake().submit(good, now);
    if (q.status !== "queued") throw new Error("expected queued");
    const o = approveReport(q.report, { observationId: "o1", retrievedAt: "2026-10-17T09:00:00Z", ttlDays: 90 });
    expect(JSON.stringify(o)).not.toContain("pseud-12345678");
    expect(o.source).toEqual({ kind: "user_report", id: "community", verifierType: "none" });
    const sg = seg("e", "entrance", { observations: [o] });
    expect(resolveAttribute(sg, "stepFree", "2026-10-18T00:00:00Z").state).toBe("known");
    expect(resolveAttribute(sg, "stepFree", "2027-02-01T00:00:00Z").state).toBe("stale");
  });
});
