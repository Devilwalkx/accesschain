import { describe, expect, it } from "vitest";
import { assessRoute, saveItinerary, syntheticProfile, syntheticRoutes, liveChanges, T0 } from "../src/index.js";

describe("saved itineraries", () => {
  it("snapshot provenance, never store the private profile", () => {
    const r = syntheticRoutes()[1]!;
    const saved = saveItinerary("it1", r, assessRoute(r, syntheticProfile(), T0));
    const json = JSON.stringify(saved);
    expect(json).not.toMatch(/avoidSteps|maxWalkM|minClearWidthMm|needsAccessibleToilet/);
    expect(saved.relied.length).toBeGreaterThan(0);
    expect(saved.relied.every((o) => o.sourceKind && o.retrievedAt)).toBe(true);
  });
  it("evidence expiring after saving is reported on recheck", () => {
    const r = syntheticRoutes()[1]!;
    const saved = saveItinerary("it1", r, assessRoute(r, syntheticProfile(), T0));
    const later = "2026-10-17T10:00:00.000Z"; // live lift feed expired at 09:30
    const changes = liveChanges(saved, assessRoute(r, syntheticProfile(), later));
    expect(changes.some((c) => c.kind === "evidence_expired")).toBe(true);
  });
});
