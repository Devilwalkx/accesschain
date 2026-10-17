import { describe, expect, it } from "vitest";
import {
  assessRoute, liveChanges, saveItinerary, renderTextItinerary, syntheticProfile, syntheticRoutes, pavementFieldCheck,
  obs, T0, type RequirementsProfile, type Source
} from "../src/index.js";
import { route, seg, NOW, FUTURE } from "./helpers.js";

const venue: Source = { kind: "venue_report", id: "v1", verifierType: "venue_self_report" };
const user: Source = { kind: "user_report", id: "community", verifierType: "none" };
const feed: Source = { kind: "operator_feed", id: "f", verifierType: "operator", licence: "L" };
const base: RequirementsProfile = {
  avoidSteps: true, needsAccessibleToilet: false, liftAcceptable: true, assistanceAcceptable: false
};
const full = (entrance = seg("e", "entrance")) => [seg("a", "approach"), entrance];

describe("unknown never passes", () => {
  it("missing stepFree on a required segment is insufficient evidence, not fit", () => {
    const a = assessRoute(route("r", full()), base, NOW);
    expect(a.verdict).toBe("insufficient_evidence");
  });
  it("missing kerb/width info is insufficient", () => {
    const p = { ...base, minClearWidthMm: 800 };
    const e = seg("e", "entrance", { observations: [obs("stepFree", true, venue, NOW, FUTURE)] });
    const a = assessRoute(route("r", [seg("a", "approach", { observations: [obs("stepFree", true, venue, NOW, FUTURE)] }), e]), p, NOW);
    expect(a.verdict).toBe("insufficient_evidence");
    expect(a.reasons.some((r) => r.requirement === "clear width" && r.verdict === "insufficient_evidence")).toBe(true);
  });
  it("expired evidence is unknown", () => {
    const old = obs("stepFree", true, venue, "2025-01-01T00:00:00Z", "2025-06-01T00:00:00Z");
    const a = assessRoute(route("r", full(seg("e", "entrance", { observations: [old] }))), base, NOW);
    expect(a.reasons.find((r) => r.segmentId === "e")?.verdict).toBe("insufficient_evidence");
  });
  it("assessments carry no score or probability", () => {
    const a = assessRoute(route("r", full()), base, NOW);
    expect(Object.keys(a).sort()).toEqual(["assessedAt", "reasons", "routeId", "verdict"]);
  });
});

describe("journey structure", () => {
  it("a route with no entrance segment is unknown (impossible/unmodelled topology)", () => {
    const a = assessRoute(route("r", [seg("a", "approach", { observations: [obs("stepFree", true, venue, NOW, FUTURE)] })]), base, NOW);
    expect(a.verdict).toBe("insufficient_evidence");
    expect(a.reasons.some((r) => r.requirement === "journey completeness")).toBe(true);
  });
  it("accessible destination with unusable final approach is a barrier", () => {
    const approach = seg("a", "approach", { observations: [obs("stepFree", false, venue, NOW, FUTURE)] });
    const ent = seg("e", "entrance", { observations: [obs("stepFree", true, venue, NOW, FUTURE)] });
    expect(assessRoute(route("r", [approach, ent]), base, NOW).verdict).toBe("known_barrier");
  });
  it("accessible entrance on the wrong street: the main-entrance route is a barrier, side-entrance is not", () => {
    const [main, side] = syntheticRoutes();
    const p = syntheticProfile();
    expect(assessRoute(main!, p, T0).verdict).toBe("known_barrier");
    expect(assessRoute(side!, p, T0).verdict).toBe("insufficient_evidence"); // unverified pavement
  });
  it("field-verifying the pavement turns the side route into a known fit", () => {
    const side = syntheticRoutes()[1]!;
    side.segments[1]!.observations.push(...pavementFieldCheck());
    expect(assessRoute(side, syntheticProfile(), T0).verdict).toBe("known_fit");
  });
  it("a profile with no requirements on an incomplete route is still not a pass", () => {
    const none: RequirementsProfile = { avoidSteps: false, needsAccessibleToilet: false, liftAcceptable: true, assistanceAcceptable: true };
    expect(assessRoute(route("r", [seg("a", "arrival")]), none, NOW).verdict).toBe("insufficient_evidence");
  });
});

describe("lifts and stale feeds", () => {
  const lifted = (inService: ReturnType<typeof obs> | null) =>
    seg("s", "arrival", { usesLift: true, observations: [obs("stepFree", true, feed, NOW, FUTURE), ...(inService ? [inService] : [])] });
  const rest = [seg("a", "approach", { observations: [obs("stepFree", true, venue, NOW, FUTURE)] }), seg("e", "entrance", { observations: [obs("stepFree", true, venue, NOW, FUTURE)] })];
  it("live lift feed is fit while fresh", () => {
    const l = obs("liftInService", true, feed, NOW, "2026-10-17T09:30:00Z");
    expect(assessRoute(route("r", [lifted(l), ...rest]), base, NOW).verdict).toBe("known_fit");
  });
  it("same feed after expiry becomes insufficient evidence, never a cached all-clear", () => {
    const l = obs("liftInService", true, feed, NOW, "2026-10-17T09:30:00Z");
    const r = route("r", [lifted(l), ...rest]);
    expect(assessRoute(r, base, "2026-10-17T10:00:00Z").verdict).toBe("insufficient_evidence");
  });
  it("lift failure after planning is surfaced against the saved itinerary", () => {
    const l = obs("liftInService", true, feed, NOW, "2026-10-17T09:30:00Z");
    const r = route("r", [lifted(l), ...rest]);
    const saved = saveItinerary("it1", r, assessRoute(r, base, NOW));
    const failed = obs("liftInService", false, feed, "2026-10-17T09:20:00Z", "2026-10-17T09:50:00Z");
    r.segments[0]!.observations.push(failed);
    // old "true" and new "false" both fresh -> conflict -> unknown, not pass
    const now2 = "2026-10-17T09:25:00Z";
    const cur = assessRoute(r, base, now2);
    expect(cur.verdict).toBe("insufficient_evidence");
    expect(liveChanges(saved, cur).some((c) => c.kind === "verdict_changed")).toBe(true);
  });
  it("out-of-service lift is a barrier, and not-using-lifts makes a lift segment a barrier", () => {
    const down = obs("liftInService", false, feed, NOW, FUTURE);
    expect(assessRoute(route("r", [lifted(down), ...rest]), base, NOW).verdict).toBe("known_barrier");
    const noLift = { ...base, liftAcceptable: false };
    const up = obs("liftInService", true, feed, NOW, FUTURE);
    expect(assessRoute(route("r", [lifted(up), ...rest]), noLift, NOW).verdict).toBe("known_barrier");
  });
  it("missing lift status is insufficient", () => {
    expect(assessRoute(route("r", [lifted(null), ...rest]), base, NOW).verdict).toBe("insufficient_evidence");
  });
});

describe("conflicting evidence", () => {
  const mk = (vA: boolean, vB: boolean) =>
    route("r", [seg("a", "approach", { observations: [obs("stepFree", true, venue, NOW, FUTURE)] }),
      seg("e", "entrance", { observations: [obs("stepFree", vA, venue, NOW, FUTURE), obs("stepFree", vB, user, NOW, FUTURE)] })]);
  it("venue says step-free, user report says steps: unknown, labelled as a disagreement", () => {
    const a = assessRoute(mk(true, false), base, NOW);
    expect(a.verdict).toBe("insufficient_evidence");
    expect(a.reasons.find((r) => r.segmentId === "e")?.detail).toMatch(/disagree/i);
  });
  it("numeric disagreement that does not decide the outcome is still a fit", () => {
    const p = { ...base, avoidSteps: false, minClearWidthMm: 800 };
    const r = route("r", [seg("a", "approach"), seg("e", "entrance", { observations: [obs("clearWidthMm", 900, venue, NOW, FUTURE), obs("clearWidthMm", 950, user, NOW, FUTURE)] })]);
    expect(assessRoute(r, p, NOW).reasons.find((x) => x.requirement === "clear width" && x.segmentId === "e")?.verdict).toBe("known_fit");
  });
  it("numeric disagreement that straddles the limit is unknown", () => {
    const p = { ...base, avoidSteps: false, minClearWidthMm: 800 };
    const r = route("r", [seg("a", "approach"), seg("e", "entrance", { observations: [obs("clearWidthMm", 700, venue, NOW, FUTURE), obs("clearWidthMm", 950, user, NOW, FUTURE)] })]);
    expect(assessRoute(r, p, NOW).reasons.find((x) => x.requirement === "clear width" && x.segmentId === "e")?.verdict).toBe("insufficient_evidence");
  });
});

describe("walking distance and toilets", () => {
  const p = { ...base, avoidSteps: false, maxWalkM: 300 };
  const ent = seg("e", "entrance");
  it("fit, barrier, unknown", () => {
    const w = (v: number | null) => seg("a", "approach", { walking: true, observations: v === null ? [] : [obs("walkLengthM", v, feed, NOW, FUTURE)] });
    expect(assessRoute(route("r", [w(200), ent]), p, NOW).reasons.find((x) => x.requirement === "walking distance")?.verdict).toBe("known_fit");
    expect(assessRoute(route("r", [w(500), ent]), p, NOW).reasons.find((x) => x.requirement === "walking distance")?.verdict).toBe("known_barrier");
    expect(assessRoute(route("r", [w(null), ent]), p, NOW).reasons.find((x) => x.requirement === "walking distance")?.verdict).toBe("insufficient_evidence");
  });
  it("accessible toilet is only checked on the entrance, and unknown is not a pass", () => {
    const t = { ...base, avoidSteps: false, needsAccessibleToilet: true };
    expect(assessRoute(route("r", [seg("a", "approach"), ent]), t, NOW).verdict).toBe("insufficient_evidence");
  });
});

describe("malformed evidence and time zones", () => {
  it("evidence observed in the future or with broken timestamps is ignored, not trusted", () => {
    const future = obs("stepFree", true, venue, "2030-01-01T00:00:00Z", "2031-01-01T00:00:00Z");
    const broken = { ...obs("stepFree", true, venue, NOW, FUTURE), observedAt: "not-a-date" };
    const e = seg("e", "entrance", { observations: [future, broken] });
    expect(assessRoute(route("r", [seg("a", "approach"), e]), base, NOW).verdict).toBe("insufficient_evidence");
  });
  it("operator feed data without a licence is not used", () => {
    const unlicensed = obs("stepFree", true, { kind: "operator_feed", id: "x", verifierType: "operator" }, NOW, FUTURE);
    const e = seg("e", "entrance", { observations: [unlicensed] });
    expect(assessRoute(route("r", [seg("a", "approach"), e]), base, NOW).reasons.find((x) => x.segmentId === "e")?.verdict).toBe("insufficient_evidence");
  });
  it("expiry is compared as an instant across the clocks-forward change (UTC vs BST offsets)", () => {
    const o = obs("stepFree", true, venue, "2026-03-29T00:00:00Z", "2026-03-29T01:30:00+01:00"); // = 00:30Z
    const e = seg("e", "entrance", { observations: [o] });
    const r = route("r", [seg("a", "approach"), e]);
    expect(assessRoute(r, base, "2026-03-29T00:15:00Z").reasons.find((x) => x.segmentId === "e")?.verdict).toBe("known_fit");
    expect(assessRoute(r, base, "2026-03-29T00:45:00Z").reasons.find((x) => x.segmentId === "e")?.verdict).toBe("insufficient_evidence");
  });
});

describe("assistance", () => {
  it("steps + assistance acceptable + assistance reported = fit with a note; unknown assistance = insufficient", () => {
    const p = { ...base, assistanceAcceptable: true };
    const withAssist = seg("e", "entrance", { observations: [obs("stepFree", false, venue, NOW, FUTURE), obs("assistanceAvailable", true, venue, NOW, FUTURE)] });
    const noInfo = seg("e", "entrance", { observations: [obs("stepFree", false, venue, NOW, FUTURE)] });
    const ap = seg("a", "approach", { observations: [obs("stepFree", true, venue, NOW, FUTURE)] });
    expect(assessRoute(route("r", [ap, withAssist]), p, NOW).verdict).toBe("known_fit");
    expect(assessRoute(route("r", [ap, noInfo]), p, NOW).verdict).toBe("insufficient_evidence");
  });
});

describe("text itinerary", () => {
  it("states limitations and source timings without a map", () => {
    const side = syntheticRoutes()[1]!;
    const txt = renderTextItinerary(side, assessRoute(side, syntheticProfile(), T0));
    expect(txt).toMatch(/not a guarantee/i);
    expect(txt).toMatch(/Step 1 of 3/);
    expect(txt).toMatch(/observed/);
    expect(txt).toMatch(/Insufficient evidence/);
  });
});
