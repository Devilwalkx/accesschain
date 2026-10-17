import { describe, expect, it } from "vitest";
import { APP_ID, buildUserAgent } from "../src/index.js";
describe("user agent", () => {
  it("names the app, its version, its id and the project, and is not a library default", () => {
    const ua = buildUserAgent("0.2.0");
    expect(ua).toBe("AccessChain/0.2.0 (app.devilwalkx.accesschain; +https://github.com/Devilwalkx/accesschain)");
    expect(ua).not.toMatch(/okhttp|axios|node|curl|python/i);
    expect(APP_ID).toBe("app.devilwalkx.accesschain");
  });
});
