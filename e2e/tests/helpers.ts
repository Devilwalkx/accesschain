import { expect, type Page } from "@playwright/test";

export const btn = (page: Page, name: string | RegExp) => page.getByRole("button", { name, exact: typeof name === "string" });
export const radio = (page: Page, name: string) => page.getByRole("radio", { name, exact: true });

export async function goto(page: Page, query = "") {
  await page.goto(`/${query}`);
  await expect(page.getByRole("heading", { name: "AccessChain" })).toBeVisible();
}

/** Layout audit: text must stay inside its button, nothing interactive may overlap, no stray text under a button. */
export async function layoutProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const problems: string[] = [];
    const vis = (e: Element) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const inter = [...document.querySelectorAll('[role="button"],[role="switch"],[role="radio"],input,textarea')].filter(vis);
    const rects = inter.map((e) => e.getBoundingClientRect());
    const name = (e: Element) => (e.getAttribute("aria-label") || (e as HTMLElement).innerText || e.tagName).slice(0, 40);
    for (let i = 0; i < inter.length; i++) {
      for (let j = i + 1; j < inter.length; j++) {
        if (inter[i]!.contains(inter[j]!) || inter[j]!.contains(inter[i]!)) continue;
        const a = rects[i]!, b = rects[j]!;
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (w > 1 && h > 1) problems.push(`overlap: "${name(inter[i]!)}" and "${name(inter[j]!)}"`);
      }
    }
    const textRects = (root: Node) => {
      const out: DOMRect[] = [];
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (!n.textContent?.trim()) continue;
        const r = document.createRange();
        r.selectNodeContents(n);
        out.push(...[...r.getClientRects()].filter((q) => q.width > 0 && q.height > 0));
      }
      return out;
    };
    inter.forEach((e, i) => {
      if (e.tagName === "INPUT" || e.tagName === "TEXTAREA") return;
      const b = rects[i]!;
      for (const t of textRects(e)) {
        if (t.left < b.left - 1 || t.right > b.right + 1 || t.top < b.top - 1 || t.bottom > b.bottom + 1) problems.push(`text outside button: "${name(e)}"`);
      }
    });
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (!n.textContent?.trim()) continue;
      const parent = n.parentElement;
      if (!parent || parent.closest('[role="button"],[role="switch"],[role="radio"]')) continue;
      const r = document.createRange();
      r.selectNodeContents(n);
      for (const q of r.getClientRects()) {
        if (q.width < 1 || q.height < 1) continue;
        rects.forEach((b, i) => {
          if (inter[i]!.tagName === "INPUT" || inter[i]!.tagName === "TEXTAREA") return;
          const ww = Math.min(q.right, b.right) - Math.max(q.left, b.left);
          const hh = Math.min(q.bottom, b.bottom) - Math.max(q.top, b.top);
          if (ww > 2 && hh > 2) problems.push(`text under button "${name(inter[i]!)}": "${n.textContent!.trim().slice(0, 30)}"`);
        });
      }
    }
    if (document.documentElement.scrollWidth - document.documentElement.clientWidth > 1) problems.push("horizontal scroll");
    return [...new Set(problems)];
  });
}

