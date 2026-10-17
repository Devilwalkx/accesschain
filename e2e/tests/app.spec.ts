import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { btn, goto, layoutProblems, radio } from "./helpers";

const SCREENS = ["Plan a journey", "My needs", "Tell us about a problem", "Privacy and help"] as const;

async function saveNeeds(page: Page) {
  await btn(page, /Tell us what you need|My needs/).first().click();
  await btn(page, "Walking and doorway details (optional)").click();
  await page.getByLabel("Longest walk in metres", { exact: true }).fill("400");
  await page.getByLabel("Narrowest doorway in millimetres", { exact: true }).fill("800");
  await btn(page, "Save and see my routes").click();
  await expect(page.getByRole("heading", { name: "Use live information?" })).toBeVisible();
  await btn(page, "No, use the demonstration instead").click();
  await expect(page.getByRole("heading", { name: "Getting to Fictional Hall" })).toBeVisible();
}

async function eachScreen(page: Page, fn: (name: string) => Promise<void>) {
  for (const s of SCREENS) {
    await btn(page, s).first().click();
    await fn(s);
    await btn(page, "‹ Back to home").click();
    await expect(page.getByRole("heading", { name: "AccessChain" })).toBeVisible();
  }
}

test.describe("AccessChain on a phone-sized browser", () => {
  test("home: a few big buttons, a clear starting point and a text size choice", async ({ page }) => {
    await goto(page);
    await expect(page.getByText("Demonstration only", { exact: false })).toHaveCount(0); // nothing chosen yet
    await expect(btn(page, "Tell us what you need")).toBeVisible();
    for (const t of ["Normal text", "Large text", "Extra large text"]) await expect(radio(page, t)).toBeVisible();
    expect(await page.getByRole("button").count()).toBeLessThanOrEqual(9);
  });

  test("end to end: needs -> routes with plain-English answers, never a false pass, stale lift", async ({ page }) => {
    await goto(page);
    await saveNeeds(page);
    await expect(page.getByText("Does not suit your needs")).toBeVisible();
    await expect(page.getByText("We can't be sure yet")).toBeVisible();
    await expect(page.getByText("We can't recommend a route yet", { exact: false })).toBeVisible();
    await expect(page.getByText("Suits your needs")).toHaveCount(0);

    await btn(page, "Why?").nth(1).click();
    await expect(page.getByText("No evidence for steps", { exact: false }).first()).toBeVisible();
    await btn(page, "Read it all as text").click();
    await expect(page.getByText("not a guarantee", { exact: false })).toBeVisible();

    await btn(page, "Demonstration options").click();
    await page.getByRole("switch", { name: "Pretend 45 minutes have passed" }).click();
    await expect(page.getByText("expired", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("We can't be sure yet")).toBeVisible();
  });

  test("first run guides you: Start here leads to needs, then routes", async ({ page }) => {
    await goto(page);
    await btn(page, "Plan a journey").first().click();
    await expect(page.getByRole("heading", { name: "Use live information?" })).toBeVisible();
    await btn(page, "No, use the demonstration instead").click();
    await expect(page.getByText("First, tell us what you need", { exact: false })).toBeVisible();
    await btn(page, "Tell us what you need").click();
    await expect(page.getByRole("heading", { name: "What do you need?" })).toBeVisible();
    await page.getByRole("switch", { name: "I need an accessible toilet" }).click();
    await expect(page.getByRole("switch", { name: "I need an accessible toilet" })).toHaveAttribute("aria-checked", "true");
    expect(await page.evaluate(() => localStorage.getItem("ac.profile"))).toBeNull(); // nothing saved until you press save
    await btn(page, "Save and see my routes").click();
    await expect(page.getByRole("heading", { name: "Getting to Fictional Hall" })).toBeVisible(); // demonstration was chosen a moment ago
    expect(await page.evaluate(() => localStorage.getItem("ac.profile"))).not.toBeNull();
  });

  test("profile persists encrypted: reload decrypts it, storage holds no plaintext, lost key fails closed", async ({ page }) => {
    await goto(page);
    await saveNeeds(page);
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
    expect(stored).toContain("ac.profile");
    expect(stored).not.toMatch(/maxWalkM|avoidSteps|minClearWidthMm|needsAccessibleToilet/);

    await page.reload();
    await btn(page, "Plan a journey").first().click();
    await expect(page.getByText("Does not suit your needs")).toBeVisible(); // decrypted without visiting needs

    await page.evaluate(() => new Promise<void>((res) => { const r = indexedDB.deleteDatabase("accesschain-keys"); r.onsuccess = () => res(); r.onerror = () => res(); r.onblocked = () => res(); }));
    await page.reload();
    await expect(page.getByText("could not be opened on this phone", { exact: false })).toBeVisible();
    await btn(page, "Plan a journey").first().click();
    await expect(page.getByText("Does not suit your needs")).toHaveCount(0);
  });

  test("privacy: recovery code format, web notice, deleting asks first and can be cancelled", async ({ page }) => {
    await goto(page);
    await saveNeeds(page);
    await btn(page, "‹ Back to home").click();
    await btn(page, "Privacy and help").click();
    await expect(page.getByText("web version", { exact: false })).toBeVisible();
    await btn(page, "Make my recovery code").click();
    const code = page.getByLabel("Recovery code, shown once");
    await expect(code).toBeVisible();
    expect((await code.innerText()).trim()).toMatch(/^([0-9A-Z]{4}-){12}[0-9A-Z]{4}$/);

    await btn(page, "Delete my answers from this phone").click();
    await expect(page.getByText("This can't be undone", { exact: false })).toBeVisible();
    await btn(page, "No, keep it").click();
    expect(await page.evaluate(() => localStorage.getItem("ac.profile"))).not.toBeNull();
    await btn(page, "Delete my answers from this phone").click();
    await btn(page, "Yes, delete everything").click();
    await expect(page.getByText("Deleted from this phone", { exact: false })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("ac.profile"))).toBeNull();
  });

  test("reports: personal details are held back; clean reports are only checked, nothing is sent", async ({ page }) => {
    await goto(page);
    await btn(page, "Tell us about a problem").click();
    await btn(page, "Add a note or photo (optional)").click();
    await page.getByLabel("Your note", { exact: true }).fill("ring me on 07700 900123");
    await btn(page, "Check my report").click();
    await expect(page.getByText("Held back for a person to check", { exact: false })).toBeVisible();
    await page.getByLabel("Your note", { exact: true }).fill("Ramp at the door");
    await btn(page, "Check my report").click();
    await expect(page.getByText(/nothing was sent|couldn't accept that: Duplicate/)).toBeVisible();
  });

  test("makes no network requests beyond the app's own files", async ({ page, baseURL }) => {
    const external: string[] = [];
    page.on("request", (r) => { if (!r.url().startsWith(baseURL!) && !r.url().startsWith("data:") && !r.url().startsWith("blob:")) external.push(r.url()); });
    await goto(page);
    await saveNeeds(page);
    await btn(page, "‹ Back to home").click();
    await eachScreen(page, async () => {});
    expect(external).toEqual([]);
  });

  test("text size: choice is remembered and the text really gets bigger", async ({ page }) => {
    await goto(page);
    const size = () => page.getByRole("heading", { name: "AccessChain" }).evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    const before = await size();
    await radio(page, "Extra large text").click();
    expect(await size()).toBeGreaterThan(before * 1.4);
    await page.reload();
    await expect(page.getByRole("heading", { name: "AccessChain" })).toBeVisible();
    expect(await size()).toBeGreaterThan(before * 1.4);
    await expect(radio(page, "Extra large text")).toHaveAttribute("aria-checked", "true");
  });

  for (const q of ["", "?fontscale=2"]) {
    test(`layout is clean on every screen (${q || "normal text"}; no overlaps, nothing clipped, no sideways scroll)`, async ({ page }) => {
      await goto(page, q);
      await saveNeeds(page);
      await btn(page, "‹ Back to home").click();
      expect(await layoutProblems(page), "home").toEqual([]);
      await eachScreen(page, async (name) => {
        if (name === "Plan a journey") { await btn(page, "Why?").first().click(); await btn(page, "Demonstration options").click(); }
        if (name === "My needs") await btn(page, "Walking and doorway details (optional)").click();
        if (name === "Tell us about a problem") await btn(page, "Add a note or photo (optional)").click();
        expect(await layoutProblems(page), name).toEqual([]);
      });
    });
  }

  test("layout is clean with the in-app Extra large setting on a small phone too", async ({ page }) => {
    await goto(page, "?fontscale=2");
    await radio(page, "Extra large text").click();
    await saveNeeds(page);
    await btn(page, "‹ Back to home").click();
    expect(await layoutProblems(page), "home").toEqual([]);
    await eachScreen(page, async (name) => expect(await layoutProblems(page), name).toEqual([]));
  });

  test("buttons are big enough for tired fingers (at least 56 px tall)", async ({ page }) => {
    await goto(page);
    for (const b of [...(await page.getByRole("button").all()), ...(await page.getByRole("radio").all())]) {
      const box = await b.boundingBox();
      if (box) expect(box.height, `button too short: ${await b.innerText()}`).toBeGreaterThanOrEqual(55);
    }
  });

  test("system bars: nothing sits under the status bar or the navigation buttons (simulated Android insets)", async ({ page }) => {
    await goto(page, "?insets=44,48");
    const vh = await page.evaluate(() => window.innerHeight);
    const top = await page.getByRole("heading", { name: "AccessChain" }).boundingBox();
    expect(top!.y, "first content starts below the status bar").toBeGreaterThanOrEqual(44);
    await btn(page, "Privacy and help").click();
    const last = btn(page, "Delete my answers from this phone");
    await last.scrollIntoViewIfNeeded();
    const box = await last.boundingBox();
    expect(box!.y + box!.height, "last button ends above the navigation buttons").toBeLessThanOrEqual(vh - 48 + 1);
  });

  test("keyboard operable: Tab reaches buttons and Enter activates them", async ({ page }) => {
    await goto(page);
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "What do you need?" })).toBeVisible();
  });

  test("installable: manifest and icons are served, no service worker caches access data", async ({ page, request }) => {
    await goto(page);
    const href = await page.locator('link[rel="manifest"]').getAttribute("href");
    const res = await request.get(`/${href}`);
    expect(res.ok()).toBe(true);
    const m = await res.json();
    expect(m.display).toBe("standalone");
    for (const icon of m.icons) {
      const r = await request.get(`/${icon.src}`);
      expect(r.ok(), icon.src).toBe(true);
      expect(r.headers()["content-type"]).toMatch(/image\/png/);
    }
    expect(await page.evaluate(async () => (await navigator.serviceWorker?.getRegistrations?.())?.length ?? 0)).toBe(0);
  });

  test("refuses to run without WebCrypto (e.g. plain http on a LAN address) instead of storing unprotected", async ({ page }) => {
    await page.addInitScript(() => { Object.defineProperty(window.crypto, "subtle", { value: undefined, configurable: true }); });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Cannot start safely" })).toBeVisible();
    await expect(page.getByText("not served over HTTPS", { exact: false })).toBeVisible();
    expect(await page.evaluate(() => localStorage.length)).toBe(0);
  });

  test("automated accessibility scan (axe, WCAG 2 A/AA) on every screen, normal and large text", async ({ page }) => {
    for (const q of ["", "?fontscale=2"]) {
      await goto(page, q);
      if (q === "") await saveNeeds(page), await btn(page, "‹ Back to home").click();
      const home = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(home.violations.map((v) => `${v.id}: ${v.help}`), `axe home ${q}`).toEqual([]);
      await eachScreen(page, async (name) => {
        const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        expect(res.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`), `axe ${name} ${q}`).toEqual([]);
      });
    }
  });
});
