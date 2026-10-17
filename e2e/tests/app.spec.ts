import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const tab = (page: Page, name: string) => page.getByRole("tab", { name, exact: true });

async function goto(page: Page) {
  await page.goto("/");
  await expect(page.getByText("Synthetic demonstration data", { exact: false }).first()).toBeVisible();
}

async function saveNeeds(page: Page) {
  await tab(page, "Needs").click();
  await page.getByLabel("Longest walk in metres", { exact: true }).fill("400");
  await page.getByLabel("Minimum clear width in millimetres", { exact: true }).fill("800");
  await page.getByRole("button", { name: "Save encrypted on this device" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
}

test.describe("AccessChain on a phone-sized browser", () => {
  test("loads with the synthetic banner and asks for requirements first", async ({ page }) => {
    await goto(page);
    await expect(page.getByRole("heading", { name: /Journey to Fictional Hall/ })).toBeVisible();
    await expect(page.getByText("Set your requirements first", { exact: false })).toBeVisible();
  });

  test("end to end: save needs, see known barrier / insufficient evidence, never a false pass, stale lift", async ({ page }) => {
    await goto(page);
    await saveNeeds(page);
    await tab(page, "Plan").click();
    await expect(page.getByRole("heading", { name: /route-main: Known barrier/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /route-side: Insufficient evidence/ })).toBeVisible();
    await expect(page.getByText("No route has enough evidence", { exact: false })).toBeVisible();

    await page.getByRole("button", { name: "Show text itinerary" }).nth(1).click();
    const txt = page.locator("text=Step 1 of 3").first();
    await expect(txt).toBeVisible();
    await expect(page.getByText("not a guarantee", { exact: false }).first()).toBeVisible();

    await page.getByRole("button", { name: /Demo time: \+45 min/ }).click();
    await expect(page.getByText("expired", { exact: false }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /route-side: Insufficient evidence/ })).toBeVisible();
  });

  test("profile persists encrypted: reload decrypts it, storage holds no plaintext, lost key fails closed", async ({ page }) => {
    await goto(page);
    await saveNeeds(page);

    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
    expect(stored).toContain("ac.profile");
    for (const secret of ["avoidSteps", "maxWalkM", "minClearWidthMm", "400", "needsAccessibleToilet"]) {
      expect(stored, `plaintext leaked: ${secret}`).not.toContain(`"${secret}"`);
    }
    expect(stored).not.toMatch(/maxWalkM|avoidSteps/);

    await page.reload();
    await expect(page.getByRole("heading", { name: /route-main: Known barrier/ })).toBeVisible(); // decrypted without visiting Needs

    // Destroy the key (as clearing site data would) but keep the ciphertext: must fail closed.
    await page.evaluate(() => new Promise<void>((res) => { const r = indexedDB.deleteDatabase("accesschain-keys"); r.onsuccess = () => res(); r.onerror = () => res(); r.onblocked = () => res(); }));
    await page.reload();
    await expect(page.getByText("could not be opened on this device", { exact: false })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Known barrier/ })).toHaveCount(0);
  });

  test("privacy: recovery secret format, web warning, erase removes ciphertext", async ({ page }) => {
    await goto(page);
    await saveNeeds(page);
    await tab(page, "Privacy").click();
    await expect(page.getByText("browser version", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Create a recovery secret" }).click();
    const secret = page.getByLabel("Recovery secret, shown once");
    await expect(secret).toBeVisible();
    expect((await secret.innerText()).trim()).toMatch(/^([0-9A-Z]{4}-){12}[0-9A-Z]{4}$/);
    await page.getByRole("button", { name: "Erase requirements and key" }).click();
    await expect(page.getByText("Erased from this device", { exact: false })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("ac.profile"))).toBeNull();
  });

  test("reports: personal details are held for moderation; clean reports are validated, not published", async ({ page }) => {
    await goto(page);
    await tab(page, "Report").click();
    await page.getByLabel("Note", { exact: true }).fill("ring me on 07700 900123");
    await page.getByRole("button", { name: "Check report" }).click();
    await expect(page.getByText("Held for moderation", { exact: false })).toBeVisible();
    await page.getByLabel("Note", { exact: true }).fill("Ramp at the door");
    await page.getByRole("button", { name: "Check report" }).click();
    await expect(page.getByText(/Valid|Not accepted: Duplicate/)).toBeVisible();
  });

  test("makes no network requests beyond the app's own files", async ({ page, baseURL }) => {
    const external: string[] = [];
    page.on("request", (r) => { if (!r.url().startsWith(baseURL!) && !r.url().startsWith("data:") && !r.url().startsWith("blob:")) external.push(r.url()); });
    await goto(page);
    await saveNeeds(page);
    for (const t of ["Plan", "Report", "Privacy"]) await tab(page, t).click();
    expect(external).toEqual([]);
  });

  test("no horizontal scrolling, text can be zoomed, touch targets are large enough", async ({ page }) => {
    await goto(page);
    for (const t of ["Plan", "Needs", "Report", "Privacy"]) {
      await tab(page, t).click();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `horizontal overflow on ${t}`).toBeLessThanOrEqual(1);
    }
    const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
    expect(viewport).not.toMatch(/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?\b/);
    for (const b of [...(await page.getByRole("button").all()), ...(await page.getByRole("tab").all())]) {
      const box = await b.boundingBox();
      if (box) expect(box.height, `button too short: ${await b.innerText()}`).toBeGreaterThanOrEqual(44);
    }
  });

  test("tab labels never wrap onto two lines (checked at every phone width)", async ({ page }) => {
    await goto(page);
    for (const t of ["Plan", "Needs", "Report", "Privacy"]) {
      const lines = await tab(page, t).evaluate((el) => {
        const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        const n = w.nextNode()!;
        const r = document.createRange();
        r.selectNodeContents(n);
        return new Set([...r.getClientRects()].map((q) => Math.round(q.top))).size;
      });
      expect(lines, `tab "${t}" wraps`).toBe(1);
    }
  });

  test("tab bar stays on one row at every width", async ({ page }) => {
    await goto(page);
    const tops = await page.getByRole("tab").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
  });

  test("installable: manifest and icons are served, no service worker caches access data", async ({ page, request }) => {
    await goto(page);
    const href = await page.locator('link[rel="manifest"]').getAttribute("href");
    const res = await request.get(`/${href}`);
    expect(res.ok()).toBe(true);
    const m = await res.json();
    expect(m.display).toBe("standalone");
    expect(m.name).toMatch(/synthetic/i);
    for (const icon of m.icons) {
      const r = await request.get(`/${icon.src}`);
      expect(r.ok(), icon.src).toBe(true);
      expect(r.headers()["content-type"]).toMatch(/image\/png/);
    }
    expect(await page.evaluate(async () => (await navigator.serviceWorker?.getRegistrations?.())?.length ?? 0)).toBe(0);
  });

  test("keyboard operable: Tab reaches buttons and Enter activates them", async ({ page }) => {
    await goto(page);
    await tab(page, "Plan").focus();
    await page.keyboard.press("Tab");
    await expect(tab(page, "Needs")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Your requirements" })).toBeVisible();
  });

  test("automated accessibility scan (axe, WCAG 2 A/AA) on every screen", async ({ page }) => {
    await goto(page);
    await saveNeeds(page);
    for (const t of ["Plan", "Needs", "Report", "Privacy"]) {
      await tab(page, t).click();
      const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(res.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`), `axe on ${t}`).toEqual([]);
    }
  });
});
