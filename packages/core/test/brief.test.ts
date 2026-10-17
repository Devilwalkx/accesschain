import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ageText, assessRoute, buildBriefs, describeNeeds, journeyToRoute, normalisePostcode, osmUrl, parseJourneyResponse, parseNominatim,
  plausiblePhone, plausibleWebsite, syntheticRoutes, T0, type RequirementsProfile
} from "../src/index.js";

const fx = (n: string) => JSON.parse(readFileSync(new URL(`./fixtures/${n}`, import.meta.url), "utf8"));
const walkOnly = fx("tfl-journey.walk-only.real.json");
const transit = fx("tfl-journey.transit.assembled.json");
const nom = fx("nominatim.real.json");
const NOW = "2026-10-17T14:40:00.000Z";
const steps: RequirementsProfile = { avoidSteps: true, needsAccessibleToilet: false, liftAcceptable: true, assistanceAcceptable: false };
const tate = () => parseNominatim(200, nom.tate, "Tate Modern")!;
const j = (body: unknown) => (parseJourneyResponse(200, body) as { journeys: any[] }).journeys[0];
const ctx = (over = {}) => ({ nowIso: NOW, live: true, venue: tate(), venueEditedAt: null, venueName: "Tate Modern", ...over });
const routeOf = (body: unknown, venue = tate(), lifts: Record<string, string[]> | null = {}) =>
  journeyToRoute(j(body), { routeId: "r", fetchedAt: NOW, stepFreeRequested: true, lifts, venue, venueEditedAt: null });

describe("journey brief: four separate parts", () => {
  it("a walk-only live route: no transport, no transfers, an unconfirmed pavement and a dated entrance, each with its own age", () => {
    const r = routeOf(walkOnly);
    const [b] = buildBriefs([r], [assessRoute(r, steps, NOW)], ctx());
    expect(b!.parts.map((p) => p.id)).toEqual(["transport", "transfers", "approach", "entrance"]);
    const [transport, transfers, approach, entrance] = b!.parts;
    expect(transport!.status).toBe("not_needed");
    expect(transfers!.status).toBe("not_needed");
    expect(approach!.status).toBe("unconfirmed");
    expect(approach!.known.join(" ")).toMatch(/Walk of about 928 m/);
    expect(approach!.missing.join(" ")).toMatch(/Pavements, kerbs and crossings: TfL does not describe them/);
    expect(approach!.age).toMatch(/Asked TfL just now/);
    expect(entrance!.status).toBe("confirmed");
    expect(entrance!.age).toMatch(/Checked Sep 2026 \(28 days ago\), by OpenStreetMap contributors/);
    expect(entrance!.known.join(" ")).toMatch(/Step-free entrances, ramp down/);
    expect(b!.headline).toMatch(/1 of 2 parts confirmed\. Not confirmed: Final approach/);
  });

  it("never claims the walk establishes step-free access: the approach can never be 'confirmed' from distance alone", () => {
    const r = routeOf(walkOnly);
    for (const p of [steps, { ...steps, maxWalkM: 2000 }]) {
      const [b] = buildBriefs([r], [assessRoute(r, p, NOW)], ctx());
      expect(b!.parts[2]!.status).not.toBe("confirmed");
    }
  });

  it("a transit route splits into transport and transfers (lifts) and a lift outage is a problem in Transfers only", () => {
    const ok = routeOf(transit);
    const out = routeOf(transit, tate(), { HUBLBG: ["London Bridge: the lift is out of service."] });
    const [a, b] = buildBriefs([out, ok], [assessRoute(out, steps, NOW), assessRoute(ok, steps, NOW)], ctx());
    expect(a!.parts[0]!.status).toBe("confirmed");
    expect(a!.parts[1]!.status).toBe("problem");
    expect(a!.parts[1]!.known.join(" ")).toMatch(/lift is out of service/);
    expect(a!.headline).toMatch(/A problem was found: Transfers/);
    // the other route in the same result is offered as an evidence-backed comparison, nothing is invented
    expect(a!.parts[1]!.nextSteps.some((s) => s.kind === "compare")).toBe(true);
    expect(b!.parts[1]!.nextSteps.some((s) => s.kind === "compare")).toBe(false);
  });

  it("lift list unavailable: lifts are 'missing', not fine, and the next step is to try again", () => {
    const r = routeOf(transit, tate(), null);
    const [b] = buildBriefs([r], [assessRoute(r, steps, NOW)], ctx({ liftsUnavailable: true }));
    expect(b!.parts[1]!.status).toBe("unconfirmed");
    expect(b!.parts[1]!.missing.join(" ")).toMatch(/lift list could not be loaded/);
    expect(b!.parts[1]!.nextSteps.some((s) => s.kind === "recheck")).toBe(true);
  });

  it("contact next steps use only details present in the data: a listed phone is offered, nothing is invented when absent", () => {
    const noContact = tate();
    expect(noContact.phone).toBeNull();
    const r = routeOf(walkOnly, { ...noContact, wheelchair: "unknown", description: null });
    const [b] = buildBriefs([r], [assessRoute(r, steps, NOW)], ctx({ venue: { ...noContact, wheelchair: "unknown", description: null } }));
    const e = b!.parts[3]!;
    expect(e.status).toBe("unconfirmed");
    expect(e.nextSteps.find((s) => s.kind === "inspect")!.url).toBe(osmUrl(noContact));
    expect(e.nextSteps.some((s) => s.phone)).toBe(false);
    expect(e.nextSteps.map((s) => s.text).join(" ")).toMatch(/lists no phone number or website/);
    const withPhone = { ...noContact, wheelchair: "unknown" as const, description: null, phone: "+44 20 7887 8888", website: "https://example.org/visit" };
    const [b2] = buildBriefs([r], [assessRoute(r, steps, NOW)], ctx({ venue: withPhone }));
    const steps2 = b2!.parts[3]!.nextSteps;
    expect(steps2.find((s) => s.phone)!.phone).toBe("+44 20 7887 8888");
    expect(steps2.find((s) => s.url === "https://example.org/visit")).toBeTruthy();
    expect(steps2.map((s) => s.text).join(" ")).toMatch(/we have not checked it/);
  });

  it("demonstration data: same four parts, no contact details invented, ages are 'demonstration' ages", () => {
    const routes = syntheticRoutes();
    const profile: RequirementsProfile = { ...steps, maxWalkM: 400, minClearWidthMm: 800, needsAccessibleToilet: false };
    const briefs = buildBriefs(routes, routes.map((r) => assessRoute(r, profile, T0)), { nowIso: T0, live: false, venue: null, venueEditedAt: null, venueName: "Fictional Hall" });
    expect(briefs[0]!.parts[0]!.status).toBe("confirmed");
    expect(briefs[0]!.parts[3]!.status).toBe("problem"); // main entrance has steps
    expect(briefs[1]!.parts[3]!.status).toBe("confirmed");
    expect(briefs[0]!.parts[3]!.nextSteps.some((s) => s.kind === "compare")).toBe(true);
    expect(briefs[0]!.parts.every((p) => !p.nextSteps.some((s) => s.phone || s.url))).toBe(true);
    expect(briefs[0]!.parts[3]!.age).toMatch(/Demonstration information/);
  });

  it("no needs set: nothing is checked and the brief says so", () => {
    const r = routeOf(walkOnly);
    const [b] = buildBriefs([r], [null], ctx());
    expect(b!.verdict).toBe("not_checked");
    expect(b!.headline).toMatch(/not set/);
    expect(b!.parts.filter((p) => p.status !== "not_needed").every((p) => p.status === "not_checked")).toBe(true);
  });
});

describe("helpers", () => {
  it("ages in words", () => {
    expect(ageText(NOW, NOW)).toBe("just now");
    expect(ageText("2026-10-17T14:35:00Z", NOW)).toBe("5 minutes ago");
    expect(ageText("2026-10-17T11:40:00Z", NOW)).toBe("3 hours ago");
    expect(ageText("2026-10-10T14:40:00Z", NOW)).toBe("7 days ago");
    expect(ageText("2026-03-17T14:40:00Z", NOW)).toBe("7 months ago");
    expect(ageText("2023-10-17T14:40:00Z", NOW)).toBe("3 years ago");
    expect(ageText("garbage", NOW)).toBe("unknown age");
  });
  it("needs chips", () => {
    expect(describeNeeds({ ...steps, maxWalkM: 400, minClearWidthMm: 800 })).toEqual(["No steps", "Lifts are fine", "Walk up to 400 m", "Doorway at least 800 mm"]);
    expect(describeNeeds({ avoidSteps: false, liftAcceptable: false, needsAccessibleToilet: true, assistanceAcceptable: true })).toEqual(["Steps are fine", "No lifts", "Help at the door is fine", "Accessible toilet"]);
  });
  it("postcodes are normalised, nothing else is guessed", () => {
    expect(normalisePostcode("se19px")).toBe("SE1 9PX");
    expect(normalisePostcode(" sw1a 1aa ")).toBe("SW1A 1AA");
    expect(normalisePostcode("Waterloo")).toBeNull();
    expect(normalisePostcode("12345")).toBeNull();
    expect(normalisePostcode("SE1")).toBeNull();
  });
  it("contact details from OpenStreetMap are kept only when they look right", () => {
    expect(plausiblePhone("+44 20 7887 8888")).toBe("+44 20 7887 8888");
    expect(plausiblePhone("020 7887 8888; 020 1111 2222")).toBe("020 7887 8888");
    expect(plausiblePhone("call us")).toBeNull();
    expect(plausiblePhone("123")).toBeNull();
    expect(plausibleWebsite("https://www.tate.org.uk/visit")).toBe("https://www.tate.org.uk/visit");
    expect(plausibleWebsite("javascript:alert(1)")).toBeNull();
    expect(plausibleWebsite("not a url")).toBeNull();
    const t = parseNominatim(200, [{ ...nom.tate[0], extratags: { "contact:phone": "+44 20 7887 8888", website: "https://www.tate.org.uk/visit" } }], "Tate Modern")!;
    expect(t.phone).toBe("+44 20 7887 8888");
    expect(t.website).toBe("https://www.tate.org.uk/visit");
  });
});

describe("text itinerary", () => {
  it("is one readable text with every part, what is missing, the age and next steps; it makes no promise", async () => {
    const { briefToText } = await import("../src/index.js");
    const r = routeOf(walkOnly);
    const [b] = buildBriefs([r], [assessRoute(r, steps, NOW)], ctx());
    const t = briefToText(b!);
    for (const part of ["Transport:", "Transfers:", "Final approach:", "Correct entrance:"]) expect(t).toContain(part);
    expect(t).toMatch(/Missing: .*Pavements, kerbs and crossings/);
    expect(t).toMatch(/Age of the information: Asked TfL just now/);
    expect(t).toMatch(/not a guarantee/);
    expect(t).not.toMatch(/\bsafe\b|verified|guaranteed accessible/i);
  });
});
