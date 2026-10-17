import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page, type Route } from "@playwright/test";
import { auditLayout, btn, goto, goLive, heading, saveNeeds } from "./helpers";

const fx = (n: string) => JSON.parse(readFileSync(join(__dirname, "../../packages/core/test/fixtures", n), "utf8"));
const nom = fx("nominatim.real.json");
const walkOnly = fx("tfl-journey.walk-only.real.json");
const transit = fx("tfl-journey.transit.assembled.json");
const lifts = fx("tfl-lifts.real.json");
const err404 = fx("tfl-error-404.real.json");

const CORS = { "access-control-allow-origin": "*" };
const json = (route: Route, status: number, body: unknown) => route.fulfill({ status, headers: CORS, contentType: "application/json", body: JSON.stringify(body) });

interface Mock {
  journey?: "walk" | "transit" | "404" | "300" | "down" | "garbage";
  lifts?: "ok" | "outage-lbg" | "down";
  osm?: "ok" | "down";
  /** What TfL calls the start of the journey (a typed postcode is checked against it). */
  startName?: string;
  /** Delay the journey answer, to test double taps while a request is running. */
  delayMs?: number;
}

/** Replaces TfL and OpenStreetMap with the recorded responses; records every outside request; blocks everything else. */
async function mock(page: Page, m: Mock = {}) {
  const seen: Array<{ url: string; body: string | null; headers: Record<string, string> }> = [];
  const base = "http://127.0.0.1:4391";
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.startsWith(base) || url.startsWith("data:") || url.startsWith("blob:")) return route.continue();
    seen.push({ url, body: route.request().postData(), headers: route.request().headers() });
    const u = new URL(url);
    if (u.host === "nominatim.openstreetmap.org") {
      if (m.osm === "down") return route.abort();
      const q = (u.searchParams.get("q") ?? "").toLowerCase();
      const key = q.includes("tate") ? "tate" : q.includes("globe") ? "globe" : q.includes("hayward") ? "hayward" : q.includes("old vic") ? "oldvic" : q.includes("borough") ? "borough" : "";
      // The real Old Vic note has no date; for this test it gets a check date so the "known problem" path is exercised.
      const body = key === "oldvic" ? [{ ...nom.oldvic[0], extratags: { ...nom.oldvic[0].extratags, check_date: "2026-01-10" } }] : nom[key];
      return key ? json(route, 200, body) : json(route, 200, []);
    }
    if (u.host === "api.openstreetmap.org") return route.abort(); // the app must not use OSM's editing API at all
    if (u.host === "api.tfl.gov.uk" && u.pathname.startsWith("/Disruptions/Lifts")) {
      if (m.lifts === "down") return route.abort();
      return json(route, 200, m.lifts === "outage-lbg" ? [{ stationUniqueId: "HUBLBG", disruptedLiftUniqueIds: ["x"], message: "London Bridge: the lift to the street is out of service." }] : lifts);
    }
    if (u.host === "api.tfl.gov.uk" && u.pathname.startsWith("/Journey/")) {
      if (m.delayMs) await new Promise((r) => setTimeout(r, m.delayMs));
      switch (m.journey ?? "walk") {
        case "404": return json(route, 404, err404);
        case "300": return json(route, 300, { disambiguation: true });
        case "down": return route.abort();
        case "garbage": return json(route, 200, { journeys: "nope" });
        case "transit": return json(route, 200, transit);
        default: {
          if (!m.startName) return json(route, 200, walkOnly);
          const j = structuredClone(walkOnly);
          j.journeys[0].legs[0].departurePoint.commonName = m.startName;
          return json(route, 200, j);
        }
      }
    }
    return route.abort();
  });
  return seen;
}

const AXE = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const journeyCalls = (seen: Array<{ url: string }>) => seen.filter((r) => r.url.includes("/Journey/JourneyResults/"));
const nominatimCalls = (seen: Array<{ url: string }>) => seen.filter((r) => r.url.includes("nominatim"));

test.describe("live information (TfL and OpenStreetMap, mocked with recorded real responses)", () => {
  test("consent first: nothing is fetched until you say yes, and 'No' gives the demonstration", async ({ page }) => {
    const seen = await mock(page);
    await goto(page);
    await btn(page, "Plan a journey").first().click();
    await expect(page.getByText("They can see your internet address", { exact: false })).toBeVisible();
    await expect(page.getByText("never leaves your phone", { exact: false })).toBeVisible();
    expect(seen).toEqual([]);
    await btn(page, "No, use the demonstration instead").click();
    await expect(heading(page, "Getting to Fictional Hall")).toBeVisible();
    await expect(page.getByText("Demonstration. The places and information are made up.")).toBeVisible();
    expect(seen).toEqual([]);
  });

  test("a real-looking trip leads with the journey and your needs, then four separate parts, each with what is known, what is missing and its age", async ({ page }) => {
    await mock(page);
    await goto(page);
    await saveNeeds(page);
    await goLive(page);
    await expect(heading(page, "Tate Modern")).toBeVisible();
    await expect(page.getByText("Live information from TfL and OpenStreetMap", { exact: false })).toBeVisible();
    await expect(page.getByText("Checked against your needs:")).toBeVisible();
    await expect(page.getByText("No steps", { exact: true })).toBeVisible();
    await expect(heading(page, /Walk about 930 m/)).toBeVisible();
    // the journey comes before the uncertainty: the route heading precedes the verdict
    const order = await page.evaluate(() => { const t = document.body.innerText; return [t.indexOf("Walk about 930 m"), t.indexOf("We can't be sure yet")]; });
    expect(order[0]).toBeGreaterThan(-1);
    expect(order[0]).toBeLessThan(order[1]!);

    const parts = ["Transport", "Transfers", "Final approach", "Correct entrance"];
    const positions = await Promise.all(parts.map((p) => heading(page, p).evaluate((e) => e.getBoundingClientRect().top + window.scrollY)));
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    await expect(page.getByText("No train, tube or bus is needed on this route.")).toBeVisible();
    await expect(page.getByText("Walk of about 928 m (TfL).")).toBeVisible();
    await expect(page.getByText("Pavements, kerbs and crossings: TfL does not describe them and nobody has recorded them here.")).toBeVisible();
    await expect(page.getByText("Asked TfL just now", { exact: false })).toBeVisible();
    await expect(page.getByText("Contributors say it is wheelchair accessible.").first()).toBeVisible();
    await expect(page.getByText("Step-free entrances, ramp down to Turbine Hall", { exact: false }).first()).toBeVisible();
    await expect(page.getByText(/Checked Sep 2026 \(\d+ (days|months) ago\), by OpenStreetMap contributors/)).toBeVisible();
    // never invent: no phone, and no claim that walking distance means step-free
    await expect(page.getByText("No contact details are listed for this place", { exact: false }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^Call / })).toHaveCount(0);
    await expect(page.getByText("Suits your needs")).toHaveCount(0);
    await expect(page.getByText("A problem was found")).toHaveCount(0);

    await btn(page, "Turn-by-turn directions from TfL").click();
    await expect(page.getByText("London Bridge Street for 23 metres", { exact: false })).toBeVisible();
    await expect(page.getByText("Powered by TfL Open Data")).toBeVisible();
    await expect(page.getByText("Contains OS data", { exact: false })).toBeVisible();
    await expect(page.getByText("© OpenStreetMap contributors", { exact: false })).toBeVisible();
  });

  test("a next step to read the place's page on OpenStreetMap is offered only with a real link", async ({ page }) => {
    await mock(page);
    await goto(page);
    await saveNeeds(page);
    await goLive(page, "Hayward Gallery");
    await expect(page.getByText("Nobody has entered accessibility information for this place yet.").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Open OpenStreetMap page" }).first()).toBeVisible();
  });

  test("a walking limit the real 928 m breaks is a known problem, said plainly", async ({ page }) => {
    await mock(page);
    await goto(page);
    await saveNeeds(page, { walk: "400" });
    await goLive(page);
    await expect(page.getByText("Does not suit your needs").first()).toBeVisible();
    await expect(page.getByText("A problem was found: Final approach.")).toBeVisible();
    await expect(page.getByText("at least 928 m", { exact: false }).first()).toBeVisible();
  });

  test("places with no information, partial information, or a negative note are described as exactly that", async ({ page }) => {
    await mock(page);
    await goto(page);
    await saveNeeds(page);
    await goLive(page, "Hayward Gallery");
    await expect(page.getByText("Nobody has entered accessibility information for this place yet.").first()).toBeVisible();
    await btn(page, "Choose a different place").click();
    await btn(page, "Shakespeare's Globe").click();
    await btn(page, "London Bridge").click();
    await expect(page.getByText("only partly accessible", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("Small lift from east entrance", { exact: false }).first()).toBeVisible();
    await btn(page, "Choose a different place").click();
    await btn(page, "The Old Vic").click();
    await btn(page, "Waterloo").click();
    await expect(page.getByText("not wheelchair accessible", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("Does not suit your needs").first()).toBeVisible();
  });

  test("an undated community note is shown but not counted (the app never reads OSM edit dates: OSM's editing API is not for read-only use)", async ({ page }) => {
    const seen = await mock(page);
    await goto(page);
    await saveNeeds(page);
    await goLive(page, "Borough Market");
    await expect(page.getByText("No date available", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("so we don't count it as checked", { exact: false })).toBeVisible();
    await expect(page.getByText("The community note has no date", { exact: false })).toBeVisible();
    expect(seen.some((r) => r.url.includes("api.openstreetmap.org"))).toBe(false);
  });

  test("TfL has no step-free route: said clearly, not as an error", async ({ page }) => {
    await mock(page, { journey: "404" });
    await goto(page);
    await saveNeeds(page);
    await goLive(page);
    await expect(heading(page, "No step-free route found")).toBeVisible();
    await expect(page.getByText("Walk about")).toHaveCount(0);
  });

  test("a train journey with a lift outage shows TfL's own notice, a problem in Transfers only, and what to do", async ({ page }) => {
    await mock(page, { journey: "transit", lifts: "outage-lbg" });
    await goto(page);
    await saveNeeds(page);
    await goLive(page);
    await expect(page.getByText("TfL lift notice: London Bridge: the lift to the street is out of service.")).toBeVisible();
    await expect(page.getByText("Does not suit your needs").first()).toBeVisible();
    await expect(page.getByText("A problem was found: Transfers.")).toBeVisible();
    await expect(page.getByText("TfL: the lift is reported out of service.").first()).toBeVisible();
    await expect(page.getByText("Check again just before you leave.", { exact: false }).first()).toBeVisible();
  });

  test("when services fail, the app says which one and never invents an answer", async ({ page }) => {
    for (const m of [{ journey: "down" as const }, { journey: "garbage" as const }, { journey: "300" as const }, { journey: "transit" as const, lifts: "down" as const }, { osm: "down" as const }]) {
      await page.unrouteAll();
      await mock(page, m);
      await page.goto("/");
      await btn(page, "Tell us what you need").or(btn(page, "My needs")).first().click();
      await btn(page, "Save and see my routes").click();
      await expect(heading(page, /Use live information\?|Where do you want to go\?/)).toBeVisible();
      if (await btn(page, "Yes, use live information").count()) await btn(page, "Yes, use live information").click();
      await btn(page, "Tate Modern").click();
      await btn(page, "London Bridge").click();
      await expect(heading(page, "Tate Modern")).toBeVisible();
      await expect(page.getByText("Suits your needs")).toHaveCount(0);
      if (m.journey === "down") {
        await expect(page.getByText("We couldn't reach TfL", { exact: false })).toBeVisible();
        await expect(page.getByText("TfL journey planner: no answer", { exact: false })).toBeVisible();
        await expect(page.getByText("OpenStreetMap (the place): answered", { exact: false })).toBeVisible(); // partial failure: the place still shows
        await expect(heading(page, "About the place")).toBeVisible();
      }
      if (m.journey === "garbage") await expect(page.getByText("was not usable just now", { exact: false })).toBeVisible();
      if (m.journey === "300") await expect(page.getByText("TfL did not recognise that start", { exact: false })).toBeVisible();
      if (m.lifts === "down") {
        await expect(page.getByText("couldn't load TfL's lift information", { exact: false })).toBeVisible();
        await expect(page.getByText("TfL lift list: no answer", { exact: false })).toBeVisible();
        await expect(page.getByText("Lift status (TfL's lift list could not be loaded).").first()).toBeVisible(); // TfL ok, lifts failed: journey still shown
      }
      if (m.osm === "down") {
        await expect(page.getByText("We couldn't reach OpenStreetMap", { exact: false })).toBeVisible();
        await expect(page.getByText("OpenStreetMap (the place): no answer", { exact: false })).toBeVisible();
      }
      await btn(page, "Back").click();
    }
  });

  test("retry: 'Check again' works after a failure, and tapping it twice sends only one set of requests", async ({ page }) => {
    const seen = await mock(page, { journey: "down" });
    await goto(page);
    await saveNeeds(page);
    await goLive(page);
    await expect(page.getByText("We couldn't reach TfL", { exact: false })).toBeVisible();
    const placeAsked = nominatimCalls(seen).length;
    expect(placeAsked).toBe(1);
    await page.unrouteAll();
    const seen2 = await mock(page, { journey: "walk", delayMs: 600 });
    const retry = page.getByTestId("retry");
    await retry.click();
    await retry.click({ force: true, timeout: 1000 }).catch(() => undefined); // disabled while checking; a second tap must change nothing
    await expect(heading(page, /Walk about 930 m/)).toBeVisible();
    expect(journeyCalls(seen2).length).toBe(1);
    expect(nominatimCalls(seen2).length).toBe(0); // the place was remembered, so OpenStreetMap is not asked again
    await expect(page.getByText("TfL journey planner: answered just now", { exact: false })).toBeVisible();
  });

  test("a typed postcode goes to TfL only; a start TfL changed is flagged; a bad postcode is refused before anything is sent", async ({ page }) => {
    const seen = await mock(page, { startName: "SE1 9PX" });
    await goto(page);
    await saveNeeds(page);
    await expect(heading(page, "Use live information?")).toBeVisible();
    await btn(page, "Yes, use live information").click();
    await btn(page, "Tate Modern").click();
    await page.getByLabel("Postcode", { exact: true }).fill("elephant");
    await btn(page, "Use this postcode").click();
    await expect(page.getByText("does not look like a UK postcode", { exact: false })).toBeVisible();
    expect(seen).toEqual([]);
    await page.getByLabel("Postcode", { exact: true }).fill("se19px");
    await btn(page, "Use this postcode").click();
    await expect(heading(page, "Tate Modern")).toBeVisible();
    await expect.poll(() => journeyCalls(seen).length).toBe(1);
    expect(journeyCalls(seen)[0]!.url).toContain("/JourneyResults/SE1%209PX/to/");
    expect(nominatimCalls(seen).some((r) => r.url.includes("SE1"))).toBe(false);
    await expect(page.getByText("not exactly what you typed")).toHaveCount(0);

    await page.unrouteAll();
    await mock(page, { startName: "West Ham (London), Fryzzy" });
    await btn(page, "Check again").click();
    await expect(page.getByText("West Ham (London), Fryzzy", { exact: false })).toBeVisible();
    await expect(page.getByText("not exactly what you typed", { exact: false })).toBeVisible();
  });

  test("privacy: no request ever contains the person's needs, and 'where I am now' is rounded to about 100 m", async ({ page, context }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 51.500729, longitude: -0.124625 });
    const seen = await mock(page);
    await goto(page);
    await saveNeeds(page, { walk: "123" });
    await goLive(page);
    await btn(page, "Back").click(); // result -> start
    await expect(page.getByText("Your phone will ask permission once.", { exact: false })).toBeVisible(); // explained before the system asks
    await btn(page, "Where I am now").click();
    await expect(heading(page, "Tate Modern")).toBeVisible();
    await expect.poll(() => seen.some((r) => r.url.includes("/JourneyResults/51.501,-0.125/"))).toBe(true);
    const all = seen.map((r) => `${r.url} ${r.body ?? ""}`).join("\n");
    expect(all).not.toContain("51.500729");
    expect(all).not.toContain("-0.124625");
    expect(all).not.toMatch(/avoidSteps|maxWalk|needsAccessibleToilet|liftAcceptable|assistanceAcceptable|minClearWidth|profile|123/);
    expect([...new Set(seen.map((r) => new URL(r.url).host))].sort()).toEqual(["api.tfl.gov.uk", "nominatim.openstreetmap.org"]);
  });

  test("location refused: a clear message and a way forward (a station or a postcode), no crash", async ({ page, context }) => {
    await context.clearPermissions();
    // A headless browser has nobody to answer the permission question, so simulate the answer "no".
    await page.addInitScript(() => {
      const deny = (_ok: unknown, err: (e: { code: number; message: string }) => void) => err({ code: 1, message: "User denied Geolocation" });
      Object.defineProperty(navigator.geolocation, "getCurrentPosition", { value: deny, configurable: true });
      if (navigator.permissions) Object.defineProperty(navigator.permissions, "query", { value: async () => ({ state: "denied", onchange: null }), configurable: true });
    });
    await mock(page);
    await goto(page);
    await saveNeeds(page);
    await expect(heading(page, "Use live information?")).toBeVisible();
    await btn(page, "Yes, use live information").click();
    await btn(page, "Tate Modern").click();
    await btn(page, "Where I am now").click();
    await expect(page.getByText(/Location was not allowed|Location is switched off|couldn't find where you are/)).toBeVisible();
    await expect(btn(page, "London Bridge")).toBeVisible();
    await expect(page.getByLabel("Postcode", { exact: true })).toBeVisible();
    await btn(page, "London Bridge").click();
    await expect(heading(page, /Walk about 930 m/)).toBeVisible();
  });

  test("the choice is remembered, and Privacy can switch it back and forth", async ({ page }) => {
    await mock(page);
    await goto(page);
    await saveNeeds(page);
    await goLive(page);
    await page.reload();
    await btn(page, "Plan a journey").first().click();
    await expect(heading(page, "Where do you want to go?")).toBeVisible();
    await btn(page, "Back").click();
    await btn(page, "Privacy and help").click();
    await expect(page.getByText("Live information is on.", { exact: false })).toBeVisible();
    await btn(page, "Switch to the demonstration places").click();
    await expect(page.getByText("Live information is off.", { exact: false })).toBeVisible();
    await btn(page, "Back").click();
    await btn(page, "Plan a journey").first().click();
    await expect(heading(page, "Getting to Fictional Hall")).toBeVisible();
  });

  test("system Back steps backwards through the flow (result, start, place) before leaving it", async ({ page }) => {
    await mock(page);
    await goto(page);
    await saveNeeds(page);
    await goLive(page);
    await expect(heading(page, "Tate Modern")).toBeVisible();
    await btn(page, "Back").click();
    await expect(heading(page, "Where are you starting from?")).toBeVisible();
    await btn(page, "Back").click();
    await expect(heading(page, "Where do you want to go?")).toBeVisible();
    await btn(page, "Back").click();
    await expect(page.getByText("Find out if you can get there", { exact: false })).toBeVisible();
  });

  for (const q of ["", "?fontscale=2", "?theme=dark"]) {
    test(`live screens are clean and accessible (${q || "normal text"}): no overlaps, no clipped text, axe passes`, async ({ page }) => {
      await mock(page, { journey: "transit", lifts: "outage-lbg" });
      await goto(page, q);
      await saveNeeds(page, { walk: "400" });
      await btn(page, "Yes, use live information").click();
      await auditLayout(page, "places");
      expect((await new AxeBuilder({ page }).withTags(AXE).analyze()).violations.map((v) => v.id), "axe places").toEqual([]);
      await btn(page, "Tate Modern").click();
      await auditLayout(page, "start");
      expect((await new AxeBuilder({ page }).withTags(AXE).analyze()).violations.map((v) => v.id), "axe start").toEqual([]);
      await btn(page, "London Bridge").click();
      await expect(page.getByText("Powered by TfL Open Data")).toBeVisible();
      await btn(page, "Turn-by-turn directions from TfL").first().click();
      await btn(page, "Read this route as plain text").first().click();
      await auditLayout(page, "results");
      expect((await new AxeBuilder({ page }).withTags(AXE).analyze()).violations.map((v) => `${v.id}: ${v.help}`), "axe results").toEqual([]);
    });
  }

  test("results stay clear of the status bar and navigation buttons", async ({ page }) => {
    await mock(page);
    await goto(page, "?insets=44,48");
    await saveNeeds(page);
    await goLive(page);
    const vh = await page.evaluate(() => window.innerHeight);
    const last = btn(page, "Choose a different place");
    await last.scrollIntoViewIfNeeded();
    const box = await last.boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(vh - 48 + 1);
  });
});
