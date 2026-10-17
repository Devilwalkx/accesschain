import { describe, expect, it } from "vitest";
import {
  FactStore, assessRoute, badgeLabel, badgeStatus, obs, rankVenues, resolveAttribute,
  type Source, type VenueResult, type VerificationBadge
} from "../src/index.js";
import { NOW, FUTURE, seg, route } from "./helpers.js";

const partner = { role: "partner", partnerId: "hall" } as const;
const mod = { role: "moderator", moderatorId: "m1" } as const;
const intake = { role: "intake", approvedBy: "m1" } as const;
const venueSrc: Source = { kind: "venue_report", id: "hall", verifierType: "venue_self_report" };
const userSrc: Source = { kind: "user_report", id: "community", verifierType: "none" };

describe("fact store (malicious partner edits)", () => {
  it("partner can add its own report but cannot impersonate a feed or another source", () => {
    const s = new FactStore();
    s.add(partner, obs("stepFree", true, venueSrc, NOW, FUTURE), NOW);
    expect(() => s.add(partner, obs("stepFree", true, { kind: "operator_feed", id: "x", verifierType: "operator", licence: "L" }, NOW, FUTURE), NOW)).toThrow();
    expect(() => s.add(partner, obs("stepFree", true, { ...venueSrc, id: "other" }, NOW, FUTURE), NOW)).toThrow();
  });
  it("partner cannot withdraw or dispute community reports; observations are immutable once added", () => {
    const s = new FactStore();
    const venueObs = obs("stepFree", true, venueSrc, NOW, FUTURE);
    const userObs = obs("stepFree", false, userSrc, NOW, FUTURE);
    s.add(partner, venueObs, NOW);
    s.add(intake, userObs, NOW);
    expect(() => s.withdraw(partner, userObs.id, NOW)).toThrow();
    expect(() => s.reject(partner as never, userObs.id, NOW, "x")).toThrow();
    expect(() => s.dispute(partner as never, userObs.id, venueObs.id, NOW)).toThrow();
    expect(() => s.add(partner, venueObs, NOW)).toThrow(/immutable/);
  });
  it("conflicting evidence stays visible and the route becomes unknown, not 'accessible'", () => {
    const s = new FactStore();
    const venueObs = obs("stepFree", true, venueSrc, NOW, FUTURE);
    const userObs = obs("stepFree", false, userSrc, NOW, FUTURE);
    s.add(partner, venueObs, NOW);
    s.add(intake, userObs, NOW);
    const sg = seg("e", "entrance", { observations: s.all() });
    expect(resolveAttribute(sg, "stepFree", NOW).state).toBe("conflict");
    const a = assessRoute(route("r", [seg("a", "approach", { observations: [obs("stepFree", true, venueSrc, NOW, FUTURE)] }), sg]),
      { avoidSteps: true, needsAccessibleToilet: false, liftAcceptable: true, assistanceAcceptable: false }, NOW);
    expect(a.verdict).toBe("insufficient_evidence");
  });
  it("partner may withdraw its own statement, but history keeps the entry and an adverse report remains", () => {
    const s = new FactStore();
    const venueObs = obs("stepFree", true, venueSrc, NOW, FUTURE);
    const userObs = obs("stepFree", false, userSrc, NOW, FUTURE);
    s.add(partner, venueObs, NOW);
    s.add(intake, userObs, NOW);
    s.withdraw(partner, venueObs.id, NOW);
    const all = s.all();
    expect(all.find((o) => o.id === venueObs.id)?.status).toBe("withdrawn");
    expect(all.find((o) => o.id === userObs.id)?.status).toBe("active");
    expect(s.getHistory().map((h) => h.action)).toEqual(["add", "add", "withdraw"]);
  });
  it("a dispute recorded by moderation makes even equal-valued evidence a conflict", () => {
    const s = new FactStore();
    const a = obs("stepFree", true, venueSrc, NOW, FUTURE);
    const b = obs("stepFree", true, userSrc, NOW, FUTURE);
    s.add(partner, a, NOW);
    s.add(intake, b, NOW);
    s.dispute(mod, b.id, a.id, NOW, "photo shows a kerb at the door");
    expect(resolveAttribute(seg("e", "entrance", { observations: s.all() }), "stepFree", NOW).state).toBe("conflict");
  });
  it("returned data is a copy: callers cannot mutate store state", () => {
    const s = new FactStore();
    s.add(partner, obs("stepFree", true, venueSrc, NOW, FUTURE), NOW);
    s.all()[0]!.value = false;
    expect(s.all()[0]!.value).toBe(true);
  });
});

describe("verification badges", () => {
  const b: VerificationBadge = {
    venueId: "hall", scope: "step-free route from station lift to side entrance", method: "walked with wheelchair user, measured widths",
    verifierType: "paid_tester", verifiedAt: "2026-09-01T00:00:00Z", validUntil: "2027-03-01T00:00:00Z"
  };
  it("current, lapsed and invalid states; venue self-report is labelled as such", () => {
    expect(badgeStatus(b, NOW)).toBe("current");
    expect(badgeStatus(b, "2027-04-01T00:00:00Z")).toBe("lapsed");
    expect(badgeStatus({ ...b, scope: " " }, NOW)).toBe("invalid");
    expect(badgeStatus({ ...b, verifierType: "none" }, NOW)).toBe("invalid");
    expect(badgeStatus({ ...b, validUntil: "2026-08-01T00:00:00Z" }, NOW)).toBe("invalid");
    expect(badgeLabel({ ...b, verifierType: "venue_self_report" }, NOW)).toMatch(/^Reported by venue/);
    expect(badgeLabel(b, "2027-04-01T00:00:00Z")).toMatch(/lapsed/);
    expect(badgeLabel({ ...b, scope: "" }, NOW)).toBe("Not verified");
  });
});

describe("subscription/ranking separation", () => {
  const base: VenueResult[] = [
    { venueId: "c", distanceM: 900, verdict: "known_fit" },
    { venueId: "a", distanceM: 100, verdict: "known_barrier" },
    { venueId: "b", distanceM: 500, verdict: "insufficient_evidence" },
    { venueId: "d", distanceM: 300, verdict: "known_fit" }
  ];
  it("ordering is identical whatever tier or sponsorship flags are present", () => {
    const paid = base.map((v) => ({ ...v, subscriptionTier: "premium", sponsored: v.venueId === "a" }));
    expect(rankVenues(paid).map((v) => v.venueId)).toEqual(rankVenues(base).map((v) => v.venueId));
    expect(rankVenues(base).map((v) => v.venueId)).toEqual(["d", "c", "b", "a"]);
  });
});
