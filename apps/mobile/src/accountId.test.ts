import { describe, expect, it } from "vitest";
import { ACCOUNT_KEY, LEGACY_ACCOUNT_ID, loadAccountId, type KV } from "./accountId";

function mem(init: Record<string, string> = {}): KV & { data: Record<string, string> } {
  const data = { ...init };
  return { data, get: async (n) => data[n] ?? null, set: async (n, v) => { data[n] = v; } };
}

describe("account id", () => {
  it("a new install gets a random id of its own, and keeps it", async () => {
    const a = mem();
    const id = await loadAccountId(a, () => "aaaaaaaaaaaaaaaa");
    expect(id).toBe("acct-aaaaaaaaaaaaaaaa");
    expect(id).not.toBe(LEGACY_ACCOUNT_ID);
    expect(await loadAccountId(a, () => "bbbbbbbbbbbbbbbb")).toBe(id);
  });
  it("two installs do not share an id", async () => {
    expect(await loadAccountId(mem(), () => "1111111111111111")).not.toBe(await loadAccountId(mem(), () => "2222222222222222"));
  });
  it("answers saved by an older build (no id stored) still open: they keep the old id", async () => {
    const a = mem({ "ac.profile": "{}" });
    expect(await loadAccountId(a, () => "cccccccccccccccc")).toBe(LEGACY_ACCOUNT_ID);
    expect(a.data[ACCOUNT_KEY]).toBe(LEGACY_ACCOUNT_ID);
  });
  it("a damaged stored id is replaced, not trusted", async () => {
    const a = mem({ [ACCOUNT_KEY]: "../../x y" });
    expect(await loadAccountId(a, () => "dddddddddddddddd")).toBe("acct-dddddddddddddddd");
  });
});
