import { describe, expect, it } from "vitest";
import { runDemo } from "../src/index.js";

describe("synthetic demo", () => {
  it("shows barrier → insufficient → fit → insufficient (stale lift)", () => {
    const { steps, markdown } = runDemo();
    expect(steps.map((s) => s.verdict)).toEqual(["known_barrier", "insufficient_evidence", "known_fit", "insufficient_evidence"]);
    expect(markdown).toMatch(/Synthetic demonstration data/);
    expect(markdown).toMatch(/expired/);
  });
});
