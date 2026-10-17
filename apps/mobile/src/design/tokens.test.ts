import { describe, expect, it } from "vitest";
import { contrast, dark, light, requiredPairs, type, TOUCH } from "./tokens";

describe("design tokens (AccessChain: older readers)", () => {
  for (const [name, pal] of [["light", light], ["dark", dark]] as const) {
    it(`${name} theme meets the contrast targets for every text/background pair it uses (7:1 for text)`, () => {
      const failures = requiredPairs(pal).filter((p) => contrast(p.fg, p.bg) < p.min).map((p) => `${p.name}: ${contrast(p.fg, p.bg).toFixed(2)} < ${p.min}`);
      expect(failures).toEqual([]);
    });
  }
  it("contrast function matches known values", () => {
    expect(contrast("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
    expect(contrast("#777777", "#FFFFFF")).toBeCloseTo(4.48, 1);
  });
  it("body text is 18 sp with generous line height and nothing is under 16 sp", () => {
    expect(type.body.size).toBeGreaterThanOrEqual(18);
    expect(type.body.line / type.body.size).toBeGreaterThanOrEqual(1.5);
    for (const t of Object.values(type)) expect(t.size).toBeGreaterThanOrEqual(16);
  });
  it("touch target is 56 dp (larger than the 48 dp minimum)", () => { expect(TOUCH).toBeGreaterThanOrEqual(56); });
});
