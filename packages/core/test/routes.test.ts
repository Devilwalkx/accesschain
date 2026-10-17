import { describe, expect, it } from "vitest";
import { QuotaError, lookupRoutes, type RouteProvider } from "../src/index.js";

const req = { origin: { lat: 51.500729, lng: -0.124625 }, destinationVenueId: "hall" };
const okCandidate = [{ id: "r1", provider: "p", segments: [{ id: "s", kind: "arrival", label: "x", walking: false, observations: [] }] }];
const provider = (fn: RouteProvider["getCandidates"]): RouteProvider => ({ name: "t", getCandidates: fn });

describe("route lookup failures are visible, never a cached all-clear", () => {
  it("sends only minimised coordinates to the third party", async () => {
    let seen: unknown;
    const r = await lookupRoutes(provider(async (q) => { seen = q.origin; return okCandidate; }), req, { timeoutMs: 100 });
    expect(seen).toEqual({ lat: 51.501, lng: -0.125 });
    expect(r.status).toBe("ok");
  });
  it("timeout, quota, error, malformed response, invalid origin", async () => {
    const t = await lookupRoutes(provider((_q, signal) => new Promise((_, rej) => signal.addEventListener("abort", () => rej(new Error("aborted"))))), req, { timeoutMs: 20 });
    expect(t).toMatchObject({ status: "unavailable", reason: "timeout" });
    expect(await lookupRoutes(provider(async () => { throw new QuotaError(); }), req, { timeoutMs: 50 })).toMatchObject({ reason: "quota" });
    expect(await lookupRoutes(provider(async () => { throw new Error("boom"); }), req, { timeoutMs: 50 })).toMatchObject({ reason: "error" });
    expect(await lookupRoutes(provider(async () => [{ id: 1 }]), req, { timeoutMs: 50 })).toMatchObject({ reason: "invalid_response" });
    expect(await lookupRoutes(provider(async () => "ok"), req, { timeoutMs: 50 })).toMatchObject({ reason: "invalid_response" });
    expect(await lookupRoutes(provider(async () => okCandidate), { ...req, origin: { lat: 999, lng: 0 } }, { timeoutMs: 50 })).toMatchObject({ reason: "invalid_response" });
  });
  it("rejects a route with no segments (the provider cannot invent an empty 'clear' path)", async () => {
    expect(await lookupRoutes(provider(async () => [{ id: "r", provider: "p", segments: [] }]), req, { timeoutMs: 50 })).toMatchObject({ reason: "invalid_response" });
  });
});
