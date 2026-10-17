import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page, type Route } from "@playwright/test";
import { btn, goto, layoutProblems } from "./helpers";

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
}

/** Replaces TfL and OpenStreetMap with the recorded responses; records every outside request; blocks everything else. */
async function mock(page: Page, m: Mock = {}) {
  const seen: Array<{ url: string; body: string | null }> = [];
  const base = "http://127.0.0.1:4391";
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.startsWith(base) || url.startsWith("data:") || url.startsWith("blob:")) return route.continue();
    seen.push({ url, body: route.request().postData() });
    const u = new URL(url);
    if (u.host === "nominatim.openstreetmap.org") {
      const q = (u.searchParams.get("q") ?? "").toLowerCase();
      const key = q.includes("tate") ? "tate" : q.includes("globe") ? "globe" : q.includes("hayward") ? "hayward" : q.includes("old vic") ? "oldvic" : q.includes("borough") ? "borough" : "";
      // The real Old Vic note has no date; for this test it gets a check date so the "known problem" path is exercised.
      const body = key === "oldvic" ? [{ ...nom.oldvic[0], extratags: { ...nom.oldvic[0].extratags, check_date: "2026-01-10" } }] : nom[key];
      return key ? json(route, 200, body) : json(route, 200, []);
    }
    if (u.host === "api.openstreetmap.org") return route.abort(); // browsers are blocked by CORS in real life
    if (u.host === "api.tfl.gov.uk" && u.pathname.startsWith("/Disruptions/Lifts")) {
      if (m.lifts === "down") return route.abort();
      return json(route, 200, m.lifts === "outage-lbg" ? [{ stationUniqueId: "HUBLBG", disruptedLiftUniqueIds: ["x"], message: "London Bridge: the lift to the street is out of service." }] : lifts);
    }
    if (u.host === "api.tfl.gov.uk" && u.pathname.startsWith("/Journey/")) {
      switch (m.journey ?? "walk") {
        case "404": return json(route, 404, err404);
        case "300": return json(route, 300, { disambiguation: true });
        case "down": return route.abort();
        case "garbage": return json(route, 200, { journeys: "nope" });
        case "transit": return json(route, 200, transit);
        default: return json(route, 200, walkOnly);
      }
    }
    return route.abort();
  });
  return seen;
}

async function needs(page: Page, opts: { walk?: string } = {}) {
  await btn(page, "Tell us what you need").click();
  if (opts.walk) {
    await btn(page, "Walking and doorway details (optional)").click();
    await page.getByLabel("Longest walk in metres", { exact: true }).fill(opts.walk);
  }
  await btn(page, "Save and see my routes").click();
}

async function goLive(page: Page, venue = "Tate Modern", station = "London Bridge") {
  await expect(page.getByRole("heading", { name: "Use live information?" })).toBeVisible();
  await btn(page, "Yes, use live information").click();
  await btn(page, venue).click();
  await btn(page, station).click();
}

test.describe("live information (TfL and OpenStreetMap, mocked with recorded real responses)", () => {
  test("consent first: nothing is fetched until you say yes, and 'No' gives the demonstration", async ({ page }) => {
    const seen = await mock(page);
    await goto(page);
    await btn(page, "Plan a journey").first().click();
    await expect(page.getByText("They can see your internet address", { exact: false })).toBeVisible();
    await expect(page.getByText("never leaves your phone", { exact: false })).toBeVisible();
    expect(seen).toEqual([]);
    await btn(page, "No, use the demonstration instead").click();
    await expect(page.getByRole("heading", { name: "Getting to Fictional Hall" })).toBeVisible();
    expect(seen).toEqual([]);
  });

  test("a real-looking trip: place note with its date, honest 'can't be sure', what was and was not checked", async ({ page }) => {
    await mock(page);
    await goto(page);
    await needs(page);
    await goLive(page);
    await expect(page.getByRole("heading", { name: "Tate Modern" })).toBeVisible();
    await expect(page.getByText("Contributors say it is wheelchair accessible.")).toBeVisible();
    await expect(page.getByText("Step-free entrances, ramp down to Turbine Hall", { exact: false })).toBeVisible();
    await expect(page.getByText("Checked Sep 2026", { exact: false })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Walk about 930 m/ })).toBeVisible();
    await expect(page.getByText("We can't be sure yet")).toBeVisible();
    await expect(page.getByText("We could not check steps on the pavement", { exact: false })).toBeVisible();
    await btn(page, "What was checked?").click();
    await expect(page.getByText("✔ Checked: steps at the entrance")).toBeVisible();
    await expect(page.getByText("? Could not check: steps on the pavement")).toBeVisible();
    await btn(page, "Show the directions").click();
    await expect(page.getByText("London Bridge Street for 23 metres", { exact: false })).toBeVisible();
    await expect(page.getByText("Powered by TfL Open Data")).toBeVisible();
    await expect(page.getByText("© OpenStreetMap contributors", { exact: false })).toBeVisible();
    await expect(page.getByText("Suits your needs")).toHaveCount(0);
  });

  test("a walking limit the real 928 m breaks is a known problem, said plainly", async ({ page }) => {
    await mock(page);
    await goto(page);
    await needs(page, { walk: "400" });
    await goLive(page);
    await expect(page.getByText("Does not suit your needs")).toBeVisible();
    await expect(page.getByText("at least 928 m", { exact: false })).toBeVisible();
  });

  test("places with no information, partial information, or a negative note are described as exactly that", async ({ page }) => {
    await mock(page);
    await goto(page);
    await needs(page);
    await goLive(page, "Hayward Gallery");
    await expect(page.getByText("Nobody has entered accessibility information for this place yet.")).toBeVisible();
    await btn(page, "‹ Choose a different place").click();
    await btn(page, "Shakespeare's Globe").click();
    await btn(page, "London Bridge").click();
    await expect(page.getByText("only partly accessible", { exact: false })).toBeVisible();
    await expect(page.getByText("Small lift from east entrance", { exact: false })).toBeVisible();
    await btn(page, "‹ Choose a different place").click();
    await btn(page, "The Old Vic").click();
    await btn(page, "Waterloo").click();
    await expect(page.getByText("not wheelchair accessible", { exact: false })).toBeVisible();
    await expect(page.getByText("Does not suit your needs")).toBeVisible();
  });

  test("the web build cannot read OSM edit dates: an undated note is shown but not counted", async ({ page }) => {
    await mock(page);
    await goto(page);
    await needs(page);
    await goLive(page, "Borough Market");
    await expect(page.getByText("No date available", { exact: false })).toBeVisible();
    await expect(page.getByText("so we don't count it as checked", { exact: false })).toBeVisible();
  });

  test("TfL has no step-free route: said clearly, not as an error", async ({ page }) => {
    await mock(page, { journey: "404" });
    await goto(page);
    await needs(page);
    await goLive(page);
    await expect(page.getByText("No step-free route found")).toBeVisible();
    await expect(page.getByText("Walk about")).toHaveCount(0);
  });

  test("a train journey with a lift outage at the station shows TfL's own notice and a clear problem", async ({ page }) => {
    await mock(page, { journey: "transit", lifts: "outage-lbg" });
    await goto(page);
    await needs(page);
    await goLive(page);
    await expect(page.getByText("TfL lift notice: London Bridge: the lift to the street is out of service.")).toBeVisible();
    await expect(page.getByText("Does not suit your needs").first()).toBeVisible();
  });

  test("when services fail, the app says so and never invents an answer", async ({ page }) => {
    for (const m of [{ journey: "down" as const }, { journey: "garbage" as const }, { journey: "300" as const }, { lifts: "down" as const }]) {
      await page.unrouteAll();
      await mock(page, m);
      await page.goto("/");
      await btn(page, "Tell us what you need").or(btn(page, "My needs")).first().click();
      await btn(page, "Save and see my routes").click();
      await expect(page.getByRole("heading", { name: /Use live information\?|Where do you want to go\?/ })).toBeVisible();
      if (await btn(page, "Yes, use live information").count()) await btn(page, "Yes, use live information").click();
      await btn(page, "Tate Modern").click();
      await btn(page, "London Bridge").click();
      await expect(page.getByRole("heading", { name: "Tate Modern" })).toBeVisible();
      await expect(page.getByText("Suits your needs")).toHaveCount(0);
      if (m.journey === "down") await expect(page.getByText("We couldn't reach TfL", { exact: false })).toBeVisible();
      if (m.journey === "garbage") await expect(page.getByText("was not usable just now", { exact: false })).toBeVisible();
      if (m.journey === "300") await expect(page.getByText("We couldn't use that start")).toBeVisible();
      if (m.lifts === "down") await expect(page.getByText("couldn't load TfL's lift information", { exact: false })).toBeVisible();
      await btn(page, "‹ Back to home").click();
    }
  });

  test("privacy: no request ever contains the person's needs, and 'where I am now' is rounded to about 100 m", async ({ page, context }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 51.500729, longitude: -0.124625 });
    const seen = await mock(page);
    await goto(page);
    await needs(page, { walk: "123" });
    await goLive(page);
    await btn(page, "‹ Change where I start").click();
    await btn(page, "Where I am now").click();
    await expect(page.getByRole("heading", { name: "Tate Modern" })).toBeVisible();
    await expect.poll(() => seen.some((r) => r.url.includes("/JourneyResults/51.501,-0.125/"))).toBe(true);
    const all = seen.map((r) => `${r.url} ${r.body ?? ""}`).join("\n");
    expect(all).not.toContain("51.500729");
    expect(all).not.toContain("-0.124625");
    expect(all).not.toMatch(/avoidSteps|maxWalk|needsAccessibleToilet|liftAcceptable|assistanceAcceptable|minClearWidth|profile/);
    expect([...new Set(seen.map((r) => new URL(r.url).host))].sort()).toEqual(["api.tfl.gov.uk", "nominatim.openstreetmap.org"]);
  });

  test("the choice is remembered, and Privacy can switch it back and forth", async ({ page }) => {
    await mock(page);
    await goto(page);
    await needs(page);
    await goLive(page);
    await page.reload();
    await btn(page, "Plan a journey").first().click();
    await expect(page.getByRole("heading", { name: "Where do you want to go?" })).toBeVisible();
    await btn(page, "‹ Back to home").click();
    await btn(page, "Privacy and help").click();
    await expect(page.getByText("Live information is on.", { exact: false })).toBeVisible();
    await btn(page, "Switch to the demonstration places").click();
    await expect(page.getByText("Live information is off.", { exact: false })).toBeVisible();
    await btn(page, "‹ Back to home").click();
    await btn(page, "Plan a journey").first().click();
    await expect(page.getByRole("heading", { name: "Getting to Fictional Hall" })).toBeVisible();
  });

  for (const q of ["", "?fontscale=2"]) {
    test(`live screens are clean and accessible (${q || "normal text"}): no overlaps, no clipped text, axe passes`, async ({ page }) => {
      await mock(page);
      await goto(page, q);
      await needs(page, { walk: "400" });
      await btn(page, "Yes, use live information").click();
      expect(await layoutProblems(page), "places").toEqual([]);
      expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations.map((v) => v.id), "axe places").toEqual([]);
      await btn(page, "Tate Modern").click();
      expect(await layoutProblems(page), "stations").toEqual([]);
      expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations.map((v) => v.id), "axe stations").toEqual([]);
      await btn(page, "London Bridge").click();
      await expect(page.getByText("Powered by TfL Open Data")).toBeVisible();
      await btn(page, "What was checked?").click();
      await btn(page, "Show the directions").click();
      expect(await layoutProblems(page), "results").toEqual([]);
      expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations.map((v) => `${v.id}: ${v.help}`), "axe results").toEqual([]);
    });
  }

  test("results stay clear of the status bar and navigation buttons", async ({ page }) => {
    await mock(page);
    await goto(page, "?insets=44,48");
    await needs(page);
    await goLive(page);
    const vh = await page.evaluate(() => window.innerHeight);
    const last = btn(page, "‹ Choose a different place");
    await last.scrollIntoViewIfNeeded();
    const box = await last.boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(vh - 48 + 1);
  });
});
