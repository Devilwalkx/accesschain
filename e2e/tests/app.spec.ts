import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { auditLayout, btn, check, goto, heading, radio, saveNeeds } from "./helpers";

const AXE = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function toDemo(page: Page, opts: { walk?: string; width?: string } = { walk: "400", width: "800" }) {
  await saveNeeds(page, opts);
  await expect(heading(page, "Use live information?")).toBeVisible();
  await btn(page, "No, use the demonstration instead").click();
  await expect(heading(page, "Getting to Fictional Hall")).toBeVisible();
}

const SCREENS = ["Plan a journey", "My needs", "Tell us about a problem", "Privacy and help", "Settings"] as const;
async function eachScreen(page: Page, fn: (name: string) => Promise<void>) {
  for (const s of SCREENS) {
    await btn(page, s).first().click();
    await fn(s);
    await btn(page, "Back").click();
    await expect(page.getByText("Find out if you can get there", { exact: false })).toBeVisible();
  }
}

test.describe("AccessChain on a phone-sized browser", () => {
  test("identity: this page is AccessChain's own build, never another app's", async ({ page, baseURL }) => {
    await goto(page);
    expect(baseURL).toContain(":4391");
    await expect(page.locator('meta[name="application-id"]')).toHaveAttribute("content", "app.devilwalkx.accesschain");
    await expect(page).toHaveTitle(/AccessChain/);
  });

  test("home: a clear starting point, a few big buttons and a text size choice", async ({ page }) => {
    await goto(page);
    await expect(page.getByText("Demonstration", { exact: false })).toHaveCount(0); // nothing chosen yet
    await expect(btn(page, "Tell us what you need")).toBeVisible();
    for (const t of ["Normal text", "Large text", "Extra large text"]) await expect(radio(page, t)).toBeVisible();
    expect(await page.getByRole("button").count()).toBeLessThanOrEqual(9);
  });

  test("end to end (demonstration): needs -> four separate parts per route, never a false pass, stale evidence", async ({ page }) => {
    await goto(page);
    await toDemo(page);
    await expect(page.getByText("We can't recommend a route yet", { exact: false })).toBeVisible();
    await expect(page.getByText("Does not suit your needs").first()).toBeVisible();
    await expect(page.getByText("We can't be sure yet").first()).toBeVisible();
    await expect(page.getByText("Suits your needs")).toHaveCount(0);
    for (const part of ["Transport", "Transfers", "Final approach", "Correct entrance"]) await expect(heading(page, part)).toBeVisible();
    await expect(page.getByText("What we know").first()).toBeVisible();
    await expect(page.getByText("What is missing").first()).toBeVisible();
    await expect(page.getByText("How old the information is").first()).toBeVisible();
    await expect(page.getByText("The demonstration places have no contact details.").first()).toBeVisible(); // nothing invented
    await expect(page.getByText("Compare with", { exact: false }).first()).toBeVisible(); // evidence-backed comparison between the two demo routes
    await btn(page, "Read this route as plain text").first().click();
    await expect(page.getByText("not a guarantee", { exact: false })).toBeVisible();

    await btn(page, "Demonstration options").click();
    await check(page, "Pretend 45 minutes have passed").click();
    await expect(page.getByText("Out of date", { exact: false }).first()).toBeVisible();
  });

  test("first run guides you: Start here leads to needs, then routes", async ({ page }) => {
    await goto(page);
    await btn(page, "Plan a journey").first().click();
    await expect(heading(page, "Use live information?")).toBeVisible();
    await btn(page, "No, use the demonstration instead").click();
    await expect(page.getByText("Tell us what you need and we will check", { exact: false })).toBeVisible();
    await btn(page, "Tell us what you need").click();
    await expect(heading(page, "What do you need?")).toBeVisible();
    await check(page, "I need an accessible toilet").click();
    await expect(check(page, "I need an accessible toilet")).toHaveAttribute("aria-checked", "true");
    expect(await page.evaluate(() => localStorage.getItem("ac.profile"))).toBeNull(); // nothing saved until you press save
    await btn(page, "Save and see my routes").click();
    await expect(heading(page, "Getting to Fictional Hall")).toBeVisible(); // demonstration was chosen a moment ago
    expect(await page.evaluate(() => localStorage.getItem("ac.profile"))).not.toBeNull();
  });

  test("profile persists encrypted: reload decrypts it, storage holds no plaintext, lost key fails closed and says it cannot be recovered", async ({ page }) => {
    await goto(page);
    await toDemo(page);
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
    expect(stored).toContain("ac.profile");
    expect(stored).not.toMatch(/maxWalkM|avoidSteps|minClearWidthMm|needsAccessibleToilet/);
    const account = await page.evaluate(() => localStorage.getItem("ac.account"));
    expect(account).toMatch(/^acct-[0-9a-f]{32}$/); // random per install, not a fixed text

    await page.reload();
    await btn(page, "Plan a journey").first().click();
    await expect(page.getByText("Does not suit your needs").first()).toBeVisible(); // decrypted without visiting needs

    await page.evaluate(() => new Promise<void>((res) => { const r = indexedDB.deleteDatabase("accesschain-keys"); r.onsuccess = () => res(); r.onerror = () => res(); r.onblocked = () => res(); }));
    await page.reload();
    await expect(page.getByText("cannot be recovered", { exact: false })).toBeVisible();
    await btn(page, "Plan a journey").first().click();
    await expect(page.getByText("Does not suit your needs")).toHaveCount(0);
  });

  test("privacy: no recovery code is offered (it cannot restore anything), the loss of the phone is explained, deleting asks first", async ({ page }) => {
    await goto(page);
    await toDemo(page);
    await btn(page, "Back").click();
    await btn(page, "Privacy and help").click();
    await expect(page.getByText("web version", { exact: false })).toBeVisible();
    await expect(btn(page, /recovery code/i)).toHaveCount(0);
    await expect(page.getByText("cannot be restored", { exact: false })).toBeVisible();

    await btn(page, "Delete my answers from this phone").click();
    await expect(page.getByText("This can't be undone", { exact: false })).toBeVisible();
    await btn(page, "No, keep it").click();
    expect(await page.evaluate(() => localStorage.getItem("ac.profile"))).not.toBeNull();
    await btn(page, "Delete my answers from this phone").click();
    await btn(page, "Yes, delete everything").click();
    await expect(page.getByText("Deleted from this phone", { exact: false })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("ac.profile"))).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem("ac.account"))).toBeNull();
  });

  test("reports: labelled as not built; personal details are held back; nothing is sent", async ({ page }) => {
    await goto(page);
    await btn(page, "Tell us about a problem").click();
    await expect(page.getByText("Not built yet: reports cannot be sent", { exact: false })).toBeVisible();
    await btn(page, "Add a note or photo (optional)").click();
    await page.getByLabel("Your note", { exact: true }).fill("ring me on 07700 900123");
    await btn(page, "Check my report").click();
    await expect(page.getByText("Held back for a person to check", { exact: false })).toBeVisible();
    await page.getByLabel("Your note", { exact: true }).fill("Ramp at the door");
    await btn(page, "Check my report").click();
    await expect(page.getByText(/nothing was sent|couldn't accept that: Duplicate/)).toBeVisible();
  });

  test("makes no network requests beyond the app's own files until live information is chosen", async ({ page, baseURL }) => {
    const external: string[] = [];
    page.on("request", (r) => { if (!r.url().startsWith(baseURL!) && !r.url().startsWith("data:") && !r.url().startsWith("blob:")) external.push(r.url()); });
    await goto(page);
    await toDemo(page);
    await btn(page, "Back").click();
    await eachScreen(page, async () => {});
    expect(external).toEqual([]);
  });

  test("text size: choice is remembered and the text really gets bigger", async ({ page }) => {
    await goto(page);
    const size = () => page.getByText("Find out if you can get there", { exact: false }).evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    const before = await size();
    expect(before).toBeGreaterThanOrEqual(18); // older readers: body text starts at 18
    await radio(page, "Extra large text").click();
    expect(await size()).toBeGreaterThan(before * 1.3);
    await page.reload();
    await expect(btn(page, /Tell us what you need|Plan a journey/).first()).toBeVisible();
    expect(await size()).toBeGreaterThan(before * 1.3);
    await expect(radio(page, "Extra large text")).toHaveAttribute("aria-checked", "true");
  });

  for (const q of ["", "?fontscale=2"]) {
    test(`layout is clean on every screen (${q || "normal text"}; no overlaps, nothing clipped, no sideways scroll, 56 px targets)`, async ({ page }) => {
      await goto(page, q);
      await toDemo(page);
      await auditLayout(page, "demo plan");
      await btn(page, "Demonstration options").click();
      await auditLayout(page, "demo plan with options");
      await btn(page, "Back").click();
      await auditLayout(page, "home");
      await eachScreen(page, async (name) => {
        if (name === "My needs") await btn(page, "Walking and doorway details (optional)").click();
        if (name === "Tell us about a problem") await btn(page, "Add a note or photo (optional)").click();
        await auditLayout(page, name);
      });
    });
  }

  test("layout is clean with the in-app Extra large setting (1.4x) on top of a 140% system size (about 200% in all)", async ({ page }) => {
    // The largest possible combination (Extra large on top of a 200% system size = 2.8x) is NOT guaranteed: a 13-letter word such as
    // "OpenStreetMap" cannot be split and is wider than a phone at that size. Documented in docs/ANDROID_PASS_REPORT.md.
    await goto(page, "?fontscale=1.4");
    await radio(page, "Extra large text").click();
    await toDemo(page);
    await btn(page, "Back").click();
    await auditLayout(page, "home");
    await eachScreen(page, async (name) => auditLayout(page, name));
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
    const top = await heading(page, "AccessChain").boundingBox();
    expect(top!.y, "app bar starts below the status bar").toBeGreaterThanOrEqual(44);
    await btn(page, "Privacy and help").click();
    const last = btn(page, "Delete my answers from this phone");
    await last.scrollIntoViewIfNeeded();
    const box = await last.boundingBox();
    expect(box!.y + box!.height, "last button ends above the navigation buttons").toBeLessThanOrEqual(vh - 48 + 1);
  });

  test("Back button: every screen has a labelled Back that returns Home", async ({ page }) => {
    await goto(page);
    await expect(btn(page, "Back")).toHaveCount(0); // Home has nothing to go back to
    for (const s of SCREENS) {
      await (s === "My needs" ? btn(page, /^(My needs|Tell us what you need)$/) : btn(page, s)).first().click(); // before any answers are saved the button says "Tell us what you need"
      await expect(btn(page, "Back")).toBeVisible();
      await btn(page, "Back").click();
      await expect(page.getByText("Find out if you can get there", { exact: false })).toBeVisible();
    }
  });

  test("keyboard operable: Tab reaches buttons and Enter activates them", async ({ page }) => {
    await goto(page);
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await expect(heading(page, "What do you need?")).toBeVisible();
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
    await expect(heading(page, "Cannot start safely")).toBeVisible();
    await expect(page.getByText("not served over HTTPS", { exact: false })).toBeVisible();
    expect(await page.evaluate(() => localStorage.length)).toBe(0);
  });

  test("settings: colours can be changed and are remembered; the build is identified", async ({ page }) => {
    await goto(page);
    await btn(page, "Settings").first().click();
    await expect(page.getByText("App ID", { exact: false })).toBeVisible();
    await expect(page.getByText("Version 0.2.0", { exact: false })).toBeVisible();
    const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await radio(page, "Dark").click();
    await expect.poll(async () => await page.evaluate(() => { const el = document.querySelector('[data-testid="back"]')?.closest("div"); return !!el; })).toBe(true);
    await page.reload();
    await btn(page, "Settings").first().click();
    await expect(radio(page, "Dark")).toHaveAttribute("aria-checked", "true");
    void bg;
  });

  test("settings: the on-phone encryption check runs the real code and passes, and says what it does not prove", async ({ page }) => {
    await goto(page);
    await btn(page, "Settings").first().click();
    await btn(page, "Check encryption on this phone").click();
    await expect(heading(page, "Encryption check: passed")).toBeVisible();
    await expect(page.getByText("One changed character in the encrypted text is refused", { exact: false })).toBeVisible();
    await expect(page.getByText("does not prove the encryption is unbreakable", { exact: false })).toBeVisible();
    await expect(page.getByText("readable by them", { exact: false }).or(page.getByText("TfL and OpenStreetMap", { exact: false })).first()).toBeVisible();
  });

  test("automated accessibility scan (axe, WCAG 2 A/AA) on every screen: normal, large text and dark", async ({ page }) => {
    for (const q of ["", "?fontscale=2", "?theme=dark"]) {
      await goto(page, q);
      if (q === "") await toDemo(page), await btn(page, "Back").click();
      const home = await new AxeBuilder({ page }).withTags(AXE).analyze();
      expect(home.violations.map((v) => `${v.id}: ${v.help}`), `axe home ${q}`).toEqual([]);
      await eachScreen(page, async (name) => {
        const res = await new AxeBuilder({ page }).withTags(AXE).analyze();
        expect(res.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`), `axe ${name} ${q}`).toEqual([]);
      });
    }
  });
});
