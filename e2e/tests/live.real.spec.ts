import { expect, test } from "@playwright/test";
import { btn, goto, heading, saveNeeds } from "./helpers";

/**
 * Real network, no mocks. Only runs when LIVE_SMOKE=1 (CI job "live-smoke"), because real services can be slow or change.
 * It checks, against the real services, that the web build's requests are allowed by the browser (CORS), that the responses
 * still parse, and that the app shows either real results or a clear notice (never a blank screen or a false "suits you").
 * It asserts the SHAPE of the screen, not the content, and prints what came back for the record.
 */
test.skip(!process.env.LIVE_SMOKE, "set LIVE_SMOKE=1 to run against the real TfL and OpenStreetMap services");

test("real TfL + OpenStreetMap: Tate Modern from London Bridge shows real information or a clear notice", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await goto(page);
  await saveNeeds(page);
  await btn(page, "Yes, use live information").click();
  await btn(page, "Tate Modern").click();
  await btn(page, "London Bridge").click();
  await expect(heading(page, "Tate Modern")).toBeVisible();
  await expect(page.getByText("Checking the latest information", { exact: false })).toHaveCount(0, { timeout: 90_000 });

  const text = await page.locator("body").innerText();
  console.log("LIVE RESULT TEXT:", text.replace(/\n+/g, " | ").slice(0, 2500));
  const gotPlace = /About the place/.test(text);
  const gotRoute = /\(\d+ min\)|No step-free route found/.test(text);
  const clearNotice = /couldn't|could not|not usable|too slow/.test(text);
  expect(gotPlace || clearNotice, "place information or a clear notice").toBe(true);
  expect(gotRoute || clearNotice, "a route, a no-step-free answer, or a clear notice").toBe(true);
  await expect(page.getByText("What answered")).toBeVisible();
  expect(text).not.toMatch(/Suits your needs/); // pavement is never evidenced, so a real result must not claim a fit
  expect(errors).toEqual([]);
});
