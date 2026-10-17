import { expect, type Page } from "@playwright/test";

export const btn = (page: Page, name: string | RegExp) => page.getByRole("button", { name, exact: typeof name === "string" });
export const radio = (page: Page, name: string) => page.getByRole("radio", { name, exact: true });
export const check = (page: Page, name: string) => page.getByRole("checkbox", { name, exact: true });
export const heading = (page: Page, name: string | RegExp) => page.getByRole("heading", { name, exact: typeof name === "string" }).first();

export async function goto(page: Page, query = "") {
  // Screen fades are switched off in tests (the app honours the same setting from the phone): axe would otherwise read half-faded colours.
  const q = /reducemotion=/.test(query) ? query : `${query}${query ? "&" : "?"}reducemotion=1`;
  await page.goto(`/${q}`);
  await expect(btn(page, /Tell us what you need|Plan a journey/).first()).toBeVisible();
}

/** Layout audit: text inside its button, no overlapping interactive elements, no horizontal scroll, 56 px targets (this app is for older readers). */
export async function auditLayout(page: Page, where: string, minTarget = 56) {
  const problems = await page.evaluate((minT) => {
    const out: string[] = [];
    const doc = document.documentElement;
    if (doc.scrollWidth - doc.clientWidth > 1) out.push(`horizontal scroll ${doc.scrollWidth - doc.clientWidth}px`);
    const sel = '[role="button"],[role="radio"],[role="checkbox"],[role="tab"],input,textarea,a[href]';
    const modal = document.querySelector('[aria-modal="true"]');
    const scope: ParentNode = modal ?? document;
    // Rectangle of an element after clipping by scrolling/overflow ancestors (content scrolled out of view is not "overlapping" anything).
    const clipped = (e: HTMLElement) => {
      let r = e.getBoundingClientRect();
      let a: HTMLElement | null = e.parentElement;
      while (a && a !== document.body) {
        const cs = getComputedStyle(a);
        if (/(auto|scroll|hidden|clip)/.test(cs.overflow + cs.overflowY + cs.overflowX)) {
          const b = a.getBoundingClientRect();
          r = new DOMRect(Math.max(r.left, b.left), Math.max(r.top, b.top), Math.max(0, Math.min(r.right, b.right) - Math.max(r.left, b.left)), Math.max(0, Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top)));
        }
        a = a.parentElement;
      }
      return r;
    };
    const els = [...scope.querySelectorAll<HTMLElement>(sel)].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
    const label = (e: HTMLElement) => (e.getAttribute("aria-label") || e.innerText || e.tagName).slice(0, 40);
    for (const e of els) {
      const r = e.getBoundingClientRect();
      if (r.height < minT - 0.5) out.push(`"${label(e)}" is only ${Math.round(r.height)}px tall`);
      if (r.width < minT - 0.5) out.push(`"${label(e)}" is only ${Math.round(r.width)}px wide`);
      if (r.right > window.innerWidth + 1 || r.left < -1) out.push(`"${label(e)}" sticks out of the screen`);
      const role = e.getAttribute("role");
      if (role === "button" || role === "radio" || role === "checkbox" || role === "tab") {
        const walker = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
        let n: Node | null;
        while ((n = walker.nextNode())) {
          if (!n.textContent?.trim()) continue;
          const range = document.createRange();
          range.selectNodeContents(n);
          for (const q of range.getClientRects()) {
            if (q.left < r.left - 1 || q.right > r.right + 1 || q.top < r.top - 1 || q.bottom > r.bottom + 1) out.push(`text of "${label(e)}" spills outside its button`);
          }
        }
      }
    }
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
      const a = els[i]!, b = els[j]!;
      if (a.contains(b) || b.contains(a)) continue;
      const x = clipped(a), y = clipped(b);
      const w = Math.min(x.right, y.right) - Math.max(x.left, y.left);
      const h = Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top);
      if (w > 1 && h > 1) out.push(`"${label(a)}" overlaps "${label(b)}"`);
    }
    // text must not run underneath a button
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let tn: Node | null;
    while ((tn = walk.nextNode())) {
      if (!tn.textContent?.trim()) continue;
      const parent = tn.parentElement;
      if (!parent || parent.closest('[role="button"],[role="radio"],[role="checkbox"],[role="tab"]')) continue;
      const rg = document.createRange();
      rg.selectNodeContents(tn);
      const visibleBox = clipped(parent);
      for (const q0 of rg.getClientRects()) {
        // only the part of the text that is actually on screen (not scrolled out of view under the app bar) can sit under a button
        const qx = Math.max(q0.left, visibleBox.left), qy = Math.max(q0.top, visibleBox.top);
        const q = new DOMRect(qx, qy, Math.max(0, Math.min(q0.right, visibleBox.right) - qx), Math.max(0, Math.min(q0.bottom, visibleBox.bottom) - qy));
        if (q.width < 1 || q.height < 1) continue;
        for (const e of els) {
          if (e.tagName === "INPUT" || e.tagName === "TEXTAREA") continue;
          const b = clipped(e);
          const ww = Math.min(q.right, b.right) - Math.max(q.left, b.left);
          const hh = Math.min(q.bottom, b.bottom) - Math.max(q.top, b.top);
          if (ww > 2 && hh > 2) out.push(`text under button "${label(e)}": "${tn.textContent!.trim().slice(0, 30)}"`);
        }
      }
    }
    return [...new Set(out)];
  }, minTarget);
  expect(problems, `layout problems on ${where}`).toEqual([]);
}

export async function saveNeeds(page: Page, opts: { walk?: string; width?: string } = {}) {
  await btn(page, /Tell us what you need|My needs/).first().click();
  if (opts.walk || opts.width) {
    await btn(page, "Walking and doorway details (optional)").click();
    if (opts.walk) await page.getByLabel("Longest walk in metres", { exact: true }).fill(opts.walk);
    if (opts.width) await page.getByLabel("Narrowest doorway in millimetres", { exact: true }).fill(opts.width);
  }
  await btn(page, "Save and see my routes").click();
}

export async function goLive(page: Page, venue = "Tate Modern", station = "London Bridge") {
  await expect(heading(page, "Use live information?")).toBeVisible();
  await btn(page, "Yes, use live information").click();
  await btn(page, venue).click();
  await btn(page, station).click();
}
