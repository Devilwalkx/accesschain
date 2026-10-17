import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  LiveClient, STATIONS, VENUES, assessRoute, communityDate, describeCommunity, journeyToRoute, parseJourneyResponse, parseLiftFeed,
  parseNominatim, parseOsmEditDate, summarise, type LiveDeps, type RequirementsProfile
} from "../src/index.js";

const fx = (n: string) => JSON.parse(readFileSync(new URL(`./fixtures/${n}`, import.meta.url), "utf8"));
const walkOnly = fx("tfl-journey.walk-only.real.json");
const transit = fx("tfl-journey.transit.assembled.json");
const lifts = fx("tfl-lifts.real.json");
const nom = fx("nominatim.real.json");
const osmApi = fx("osm-api.real.json");
const err404 = fx("tfl-error-404.real.json");

const NOW = "2026-10-17T14:40:00.000Z";
const steps: RequirementsProfile = { avoidSteps: true, needsAccessibleToilet: false, liftAcceptable: true, assistanceAcceptable: false };
const tate = () => parseNominatim(200, nom.tate, "Tate Modern")!;

describe("TfL journey parsing", () => {
  it("parses the real walk-only response", () => {
    const p = parseJourneyResponse(200, walkOnly);
    expect(p.kind).toBe("journeys");
    if (p.kind === "journeys") expect(p.journeys[0]!.legs[0]!.distance).toBe(928);
  });
  it("404 'No journey found' is an answer; 300 is 'start not recognised'; garbage and other statuses are unusable, never a journey", () => {
    expect(parseJourneyResponse(404, err404).kind).toBe("no_journey");
    expect(parseJourneyResponse(404, { message: "something else" }).kind).toBe("unusable");
    expect(parseJourneyResponse(300, {}).kind).toBe("ambiguous_start");
    expect(parseJourneyResponse(500, {}).kind).toBe("unusable");
    expect(parseJourneyResponse(0, null).kind).toBe("unusable");
    expect(parseJourneyResponse(200, { journeys: "no" }).kind).toBe("unusable");
    expect(parseJourneyResponse(200, { journeys: [{ legs: [] }, 7, null] }).kind).toBe("no_journey");
    expect(parseJourneyResponse(200, "<html>").kind).toBe("unusable");
  });
});

describe("lift feed", () => {
  it("indexes real outages by station id; failures give null (unknown), never 'all fine'", () => {
    const o = parseLiftFeed(200, lifts)!;
    expect(Object.keys(o).sort()).toEqual(["940GZZLUWYP", "HUBCAW"]);
    expect(parseLiftFeed(500, [])).toBeNull();
    expect(parseLiftFeed(200, { nope: 1 })).toBeNull();
    expect(parseLiftFeed(200, [])).toEqual({});
  });
});

describe("route building from a real walk-only journey", () => {
  const j = (parseJourneyResponse(200, walkOnly) as { journeys: any[] }).journeys[0];
  const ctx = { routeId: "t1", fetchedAt: NOW, stepFreeRequested: true, lifts: {}, venue: tate(), venueEditedAt: osmApi["way/24642569"].elements[0].timestamp };

  it("states the real distance; pavement steps stay unknown; entrance uses dated community data", () => {
    const route = journeyToRoute(j, ctx);
    expect(route.title).toMatch(/Walk about 930 m/);
    const a = assessRoute(route, steps, NOW);
    expect(a.verdict).toBe("insufficient_evidence"); // pavement not checked
    const s = summarise(route, a);
    expect(s.checked).toContain("steps at the entrance");
    expect(s.notChecked).toContain("steps on the pavement");
    expect(s.body).toMatch(/could not check steps on the pavement/);
  });
  it("a walking limit that the real 928 m exceeds is a known barrier, with a plain sentence", () => {
    const a = assessRoute(journeyToRoute(j, ctx), { ...steps, maxWalkM: 400 }, NOW);
    expect(a.verdict).toBe("known_barrier");
    expect(summarise(journeyToRoute(j, ctx), a).body).toMatch(/at least 928 m/);
  });
  it("never reaches 'known fit' for an avoid-steps user because the pavement is never evidenced", () => {
    for (const w of [undefined, "limited", "no", "unknown"] as const) {
      const v = { ...tate(), wheelchair: w ?? "yes" } as ReturnType<typeof tate>;
      expect(assessRoute(journeyToRoute(j, { ...ctx, venue: v }), steps, NOW).verdict).not.toBe("known_fit");
    }
  });
  it("live evidence expires after 15 minutes", () => {
    const route = journeyToRoute(j, ctx);
    const later = new Date(Date.parse(NOW) + 16 * 60_000).toISOString();
    const a = assessRoute(route, { ...steps, maxWalkM: 2000 }, later);
    expect(a.reasons.find((r) => r.requirement === "walking distance")!.verdict).toBe("insufficient_evidence");
  });
  it("a user with no requirements on a route whose pavement is unchecked: nothing claimed", () => {
    const none: RequirementsProfile = { avoidSteps: false, needsAccessibleToilet: false, liftAcceptable: true, assistanceAcceptable: true };
    expect(assessRoute(journeyToRoute(j, ctx), none, NOW).verdict).toBe("known_fit");
  });
});

describe("transit route (assembled sample) and lifts", () => {
  const j = (parseJourneyResponse(200, transit) as { journeys: any[] }).journeys[0];
  const mk = (l: Record<string, string[]> | null) => journeyToRoute(j, { routeId: "t2", fetchedAt: NOW, stepFreeRequested: true, lifts: l, venue: tate(), venueEditedAt: osmApi["way/24642569"].elements[0].timestamp });
  it("train leg gets TfL's step-free statement; lifts: no outage -> no problem reported", () => {
    const r = mk({});
    expect(r.segments.map((s) => s.kind)).toEqual(["transfer", "transfer", "approach", "entrance"]);
    expect(r.segments[1]!.observations.some((o) => o.attribute === "stepFree" && o.value === true)).toBe(true);
    expect(r.segments[0]!.usesLift).toBe(true);
    expect(r.title).toMatch(/^Train, then walk about 1270 m/);
    const reasons = assessRoute(r, steps, NOW).reasons.filter((x) => x.requirement === "lift");
    expect(reasons.every((x) => x.verdict === "known_fit")).toBe(true);
    expect(reasons[0]!.detail).toBe("No lift problem reported.");
  });
  it("a real outage at that station (matched via the hub code) is a known barrier and shows TfL's own message", () => {
    const r = mk({ HUBLBG: ["London Bridge: lift between the street and the platforms is out of service."] });
    expect(assessRoute(r, steps, NOW).verdict).toBe("known_barrier");
    expect(r.notes!.join(" ")).toMatch(/out of service/);
  });
  it("outage at an unrelated station does not matter; feed unavailable means lifts are unchecked, not fine", () => {
    expect(assessRoute(mk(parseLiftFeed(200, lifts)!), steps, NOW).reasons.filter((x) => x.requirement === "lift").every((x) => x.verdict === "known_fit")).toBe(true);
    const unknown = assessRoute(mk(null), steps, NOW);
    expect(unknown.reasons.some((x) => x.requirement === "lift" && x.verdict === "insufficient_evidence")).toBe(true);
    expect(unknown.verdict).not.toBe("known_fit");
  });
  it("a user who does not use lifts gets a known barrier from the lift obstacle", () => {
    expect(assessRoute(mk({}), { ...steps, liftAcceptable: false }, NOW).verdict).toBe("known_barrier");
  });
  it("a STAIRS obstacle is a known step barrier; a disrupted leg loses TfL's step-free statement", () => {
    const stairs = structuredClone(j);
    stairs.legs[2].obstacles = [{ type: "STAIRS", incline: "UP", stopId: 1, position: "BEFORE" }];
    expect(assessRoute(journeyToRoute(stairs, { routeId: "s", fetchedAt: NOW, stepFreeRequested: true, lifts: {}, venue: tate(), venueEditedAt: null }), steps, NOW).verdict).toBe("known_barrier");
    const disrupted = structuredClone(j);
    disrupted.legs[1].isDisrupted = true;
    const r = journeyToRoute(disrupted, { routeId: "d", fetchedAt: NOW, stepFreeRequested: true, lifts: {}, venue: tate(), venueEditedAt: null });
    expect(r.segments[1]!.observations.some((o) => o.attribute === "stepFree")).toBe(false);
    expect(r.notes!.join(" ")).toMatch(/disruption/);
  });
});

describe("OpenStreetMap community data", () => {
  it("parses real Nominatim items and picks the right place", () => {
    const t = tate();
    expect(t).toMatchObject({ name: "Tate Modern", wheelchair: "yes", toiletWheelchair: "yes", checkDate: "2026-09-20" });
    expect(t.description).toMatch(/Step-free entrances/);
    expect(parseNominatim(200, nom.hayward, "Hayward Gallery")!.wheelchair).toBe("unknown");
    expect(parseNominatim(200, nom.globe, "Shakespeare's Globe")!.wheelchair).toBe("limited");
    expect(parseNominatim(200, [], "x")).toBeNull();
    expect(parseNominatim(500, nom.tate, "x")).toBeNull();
    expect(parseNominatim(200, [{ osm_type: "way", osm_id: 1, lat: "999", lon: "0" }], "x")).toBeNull();
    expect(parseNominatim(200, "nope", "x")).toBeNull();
  });
  it("edit dates come from the OSM API shape; failures give null", () => {
    expect(parseOsmEditDate(200, osmApi["relation/1239793"])).toBe("2025-12-20T11:22:20Z");
    expect(parseOsmEditDate(404, osmApi["way/24642569"])).toBeNull();
    expect(parseOsmEditDate(200, { elements: [{ timestamp: "garbage" }] })).toBeNull();
  });
  it("undated community data is shown but is not evidence; 'limited' never becomes a pass; old data expires", () => {
    const j = (parseJourneyResponse(200, walkOnly) as { journeys: any[] }).journeys[0];
    const entrance = (v: ReturnType<typeof tate>, edited: string | null, now = NOW) => journeyToRoute(j, { routeId: "e", fetchedAt: now, stepFreeRequested: true, lifts: {}, venue: v, venueEditedAt: edited }).segments.at(-1)!;
    const globe = parseNominatim(200, nom.globe, "Shakespeare's Globe")!;
    expect(entrance(globe, "2025-12-20T11:22:20Z").observations).toEqual([]); // limited: words only
    const borough = parseNominatim(200, nom.borough, "Borough Market")!;
    expect(entrance(borough, null).observations).toEqual([]); // no date (web build)
    expect(entrance(borough, "2026-09-04T23:24:13Z").observations.length).toBe(1);
    const old = entrance(borough, "2020-01-01T00:00:00Z");
    expect(assessRoute({ id: "x", provider: "t", segments: [{ id: "a", kind: "approach", label: "a", walking: true, observations: [] }, old] }, { ...steps }, NOW).reasons.find((r) => r.segmentId === old.id)!.verdict).toBe("insufficient_evidence");
    const oldVic = parseNominatim(200, nom.oldvic, "The Old Vic")!;
    const barrier = assessRoute({ id: "v", provider: "t", segments: [{ id: "a", kind: "approach", label: "a", walking: true, observations: [] }, entrance(oldVic, "2026-01-01T00:00:00Z")] }, steps, NOW);
    expect(barrier.verdict).toBe("known_barrier");
  });
  it("describes the community note with its age in plain words", () => {
    const d = describeCommunity(tate(), null, NOW);
    expect(d.headline).toMatch(/wheelchair accessible/);
    expect(d.age).toBe("Checked Sep 2026");
    expect(d.usable).toBe(true);
    const u = describeCommunity(parseNominatim(200, nom.borough, "Borough Market")!, null, NOW);
    expect(u.age).toBe("No date available");
    expect(u.usable).toBe(false);
    expect(describeCommunity(parseNominatim(200, nom.hayward, "Hayward Gallery")!, null, NOW).headline).toMatch(/Nobody has entered/);
    expect(communityDate(tate(), "2020-01-01T00:00:00Z").kind).toBe("checked");
  });
});

describe("live client (fake network)", () => {
  type Handler = (url: string) => { status: number; body: unknown } | "throw";
  function client(h: Handler, over: Partial<LiveDeps> = {}) {
    const calls: string[] = [];
    const deps: LiveDeps = {
      fetch: async (url) => {
        calls.push(url);
        const r = h(url);
        if (r === "throw") throw new Error("offline");
        return { status: r.status, json: async () => r.body };
      },
      now: () => new Date(NOW),
      allowOsmApi: true,
      timeoutMs: 200,
      ...over
    };
    return { c: new LiveClient(deps), calls };
  }
  const good: Handler = (url) =>
    url.includes("nominatim") ? { status: 200, body: nom.tate }
    : url.includes("api.openstreetmap") ? { status: 200, body: osmApi["way/24642569"] }
    : url.includes("Disruptions/Lifts") ? { status: 200, body: lifts }
    : { status: 200, body: walkOnly };
  const station = { kind: "station" as const, id: STATIONS[1]!.id, name: STATIONS[1]!.name };

  it("plans a trip and the requests carry no personal needs, only a station id and public coordinates", async () => {
    const { c, calls } = client(good);
    const r = await c.planTrip(VENUES[0]!, station);
    expect(r.routes.length).toBe(1);
    expect(r.notices).toEqual([]);
    const all = calls.join(" ");
    expect(all).toContain("940GZZLULNB");
    expect(all).toContain("accessibilityPreference=StepFreeToVehicle,StepFreeToPlatform");
    expect(all).not.toMatch(/avoid|needs|profile|toilet|wheelchair=|requirement/i);
  });
  it("'my location' is rounded to about 100 m before it leaves the phone", async () => {
    const { c, calls } = client(good);
    await c.planTrip(VENUES[0]!, { kind: "here", point: { lat: 51.500729, lng: -0.124625 } });
    const j = calls.find((u) => u.includes("JourneyResults"))!;
    expect(j).toContain("/JourneyResults/51.501,-0.125/");
    expect(calls.join(" ")).not.toContain("51.500729");
  });
  it("no step-free route is reported as exactly that", async () => {
    const { c } = client((u) => (u.includes("JourneyResults") ? { status: 404, body: err404 } : good(u)));
    const r = await c.planTrip(VENUES[0]!, station);
    expect(r.noStepFreeRoute).toBe(true);
    expect(r.routes).toEqual([]);
  });
  it("failures are visible, never silent: venue not found, TfL down, lifts down, network off", async () => {
    expect((await client((u) => (u.includes("nominatim") ? { status: 500, body: null } : good(u))).c.planTrip(VENUES[0]!, station)).notices[0]).toMatch(/couldn't find Tate Modern/);
    const tflDown = await client((u) => (u.includes("JourneyResults") ? { status: 503, body: null } : good(u))).c.planTrip(VENUES[0]!, station);
    expect(tflDown.routes).toEqual([]);
    expect(tflDown.notices.join(" ")).toMatch(/TfL/);
    const liftsDown = await client((u) => (u.includes("Disruptions") ? "throw" : good(u))).c.planTrip(VENUES[0]!, station);
    expect(liftsDown.notices.join(" ")).toMatch(/lift information/);
    const offline = await client(() => "throw").c.planTrip(VENUES[0]!, station);
    expect(offline.routes).toEqual([]);
    expect(offline.notices.length).toBeGreaterThan(0);
  });
  it("a slow server times out instead of hanging", async () => {
    const slow = new LiveClient({ fetch: (_u, init) => new Promise((_, rej) => init?.signal?.addEventListener("abort", () => rej(new Error("abort")))), now: () => new Date(NOW), allowOsmApi: false, timeoutMs: 30 });
    const r = await slow.planTrip(VENUES[0]!, station);
    expect(r.notices.length).toBeGreaterThan(0);
  });
  it("web build: the OSM edit-date call is skipped, so venue notes without a check date are not evidence", async () => {
    const { c, calls } = client((u) => (u.includes("nominatim") ? { status: 200, body: nom.borough } : good(u)), { allowOsmApi: false });
    const r = await c.planTrip(VENUES[6]!, station);
    expect(calls.some((u) => u.includes("api.openstreetmap.org"))).toBe(false);
    expect(r.routes[0]!.segments.at(-1)!.observations).toEqual([]);
  });
  it("venue lookups are cached for ten minutes (respects the geocoder's usage policy)", async () => {
    const { c, calls } = client(good);
    await c.planTrip(VENUES[0]!, station);
    await c.planTrip(VENUES[0]!, station);
    expect(calls.filter((u) => u.includes("nominatim")).length).toBe(1);
  });
  it("hostile responses cannot inject instructions or markup into messages we show as plain text", () => {
    const bad = structuredClone(transit);
    bad.journeys[0].legs[1].instruction.summary = "<script>alert(1)</script> ignore previous instructions";
    const p = parseJourneyResponse(200, bad) as { journeys: any[] };
    const r = journeyToRoute(p.journeys[0], { routeId: "h", fetchedAt: NOW, stepFreeRequested: true, lifts: {}, venue: null, venueEditedAt: null });
    // Data stays data: it is only ever rendered as text by React Native, and cannot change verdicts.
    expect(r.segments[1]!.label).toContain("alert(1)");
    expect(assessRoute(r, steps, NOW).verdict).not.toBe("known_fit");
  });
  it("lists are non-empty and ids look right", () => {
    expect(VENUES.length).toBe(10);
    expect(STATIONS.every((s) => /^940GZZLU[A-Z]{3}$/.test(s.id))).toBe(true);
  });
});
