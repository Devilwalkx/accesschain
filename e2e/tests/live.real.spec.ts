import { expect, test } from "@playwright/test";
import { btn, goto } from "./helpers";

/**
 * Real network, no mocks. Only runs when LIVE_SMOKE=1 (CI job "live-smoke"), because real services can be slow or change.
 * It proves, against the real services, that the web build's requests are allowed by the browser (CORS), that the responses
 * still parse, and that the app shows either real results or a clear notice (never a blank screen or a false "suits you").
 */
test.skip(!process.env.LIVE_SMOKE, "set LIVE_SMOKE=1 to run against the real TfL and OpenStreetMap services");

test("real TfL + OpenStreetMap: Tate Modern from London Bridge shows real information or a clear notice", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await goto(page);
  await btn(page, "Tell us what you need").click();
  await btn(page, "Save and see my routes").click();
  await btn(page, "Yes, use live information").click();
  await btn(page, "Tate Modern").click();
  await btn(page, "London Bridge").click();
  await expect(page.getByRole("heading", { name: "Tate Modern" })).toBeVisible();
  await expect(page.getByText("Checking the latest information", { exact: false })).toHaveCount(0, { timeout: 90_000 });

  const text = await page.locator("body").innerText();
  console.log("LIVE RESULT TEXT:", text.replace(/\n+/g, " | ").slice(0, 1500));
  const gotPlace = /About the place/.test(text);
  const gotRoute = /\(\d+ min\)|No step-free route found/.test(text);
  const clearNotice = /couldn't|could not|not usable/.test(text);
  expect(gotPlace || clearNotice, "place information or a clear notice").toBe(true);
  expect(gotRoute || clearNotice, "a route, a no-step-free answer, or a clear notice").toBe(true);
  expect(text).not.toMatch(/Suits your needs/); // pavement is never evidenced, so a real result must not claim a fit
  expect(errors).toEqual([]);
});
