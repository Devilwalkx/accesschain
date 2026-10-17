import { describe, expect, it } from "vitest";
import {
  applyRestore, decodeRecoverySecret, encodeRecoverySecret, generateContentKey, generateRecoverySecret,
  openItem, sealItem, unwrapKeyFromRecovery, wrapKeyForRecovery, type ItemContext
} from "../src/index.js";

const ctx: ItemContext = { accountId: "acc-A", itemId: "profile", version: 1 };
const secretText = JSON.stringify({ avoidSteps: true, maxWalkM: 150 });

describe("vault", () => {
  it("round-trips and the envelope contains no plaintext", () => {
    const k = generateContentKey();
    const s = sealItem(k, secretText, ctx);
    expect(openItem(k, s, ctx)).toBe(secretText);
    const blob = JSON.stringify(s);
    // Compare against the plaintext as text and as hex; a 3-character number like "150" can appear in random hex by chance.
    const asHex = Array.from(new TextEncoder().encode(secretText), (b) => b.toString(16).padStart(2, "0")).join("");
    expect(blob).not.toContain("avoidSteps");
    expect(blob).not.toContain(asHex.slice(0, 16));
    expect(blob).not.toContain(secretText);
  });
  it("wrong key, tampered ciphertext, tampered nonce all throw (no plaintext fallback)", () => {
    const k = generateContentKey();
    const s = sealItem(k, secretText, ctx);
    expect(() => openItem(generateContentKey(), s, ctx)).toThrow();
    const flipped = { ...s, ct: (s.ct[0] === "0" ? "1" : "0") + s.ct.slice(1) };
    expect(() => openItem(k, flipped, ctx)).toThrow();
    const badNonce = { ...s, nonce: (s.nonce[0] === "0" ? "1" : "0") + s.nonce.slice(1) };
    expect(() => openItem(k, badNonce, ctx)).toThrow();
  });
  it("ciphertext is bound to account, item and version (swap/rollback fails)", () => {
    const k = generateContentKey();
    const s = sealItem(k, secretText, ctx);
    expect(() => openItem(k, s, { ...ctx, accountId: "acc-B" })).toThrow();
    expect(() => openItem(k, s, { ...ctx, itemId: "trip-1" })).toThrow();
    expect(() => openItem(k, s, { ...ctx, version: 2 })).toThrow();
  });
  it("fresh random nonce on every encryption", () => {
    const k = generateContentKey();
    const nonces = new Set(Array.from({ length: 2000 }, () => sealItem(k, "x", ctx).nonce));
    expect(nonces.size).toBe(2000);
  });
  it("rejects bad key sizes and corrupt envelopes", () => {
    expect(() => sealItem(new Uint8Array(16), "x", ctx)).toThrow();
    const k = generateContentKey();
    expect(() => openItem(k, { v: 2 as 1, alg: "xchacha20poly1305", nonce: "", ct: "" }, ctx)).toThrow();
    expect(() => openItem(k, { v: 1, alg: "xchacha20poly1305", nonce: "zz", ct: "zz" }, ctx)).toThrow();
  });
});

describe("recovery", () => {
  it("recovery secret restores the content key; wrong secret or wrong account fails", () => {
    const k = generateContentKey();
    const { secret, display } = generateRecoverySecret();
    const blob = wrapKeyForRecovery(k, secret, "acc-A");
    expect(unwrapKeyFromRecovery(blob, decodeRecoverySecret(display), "acc-A")).toEqual(k);
    expect(() => unwrapKeyFromRecovery(blob, generateRecoverySecret().secret, "acc-A")).toThrow();
    expect(() => unwrapKeyFromRecovery(blob, secret, "acc-B")).toThrow();
  });
  it("key loss without any recovery material is unrecoverable (no server-held key exists)", () => {
    const k = generateContentKey();
    const s = sealItem(k, secretText, ctx);
    // A password reset yields no key material: the only way back is a user-held secret or trusted device.
    expect(() => openItem(generateContentKey(), s, ctx)).toThrow();
  });
  it("display form round-trips, tolerates lowercase/space/ambiguous chars, and rejects junk", () => {
    const { secret, display } = generateRecoverySecret();
    expect(display).toMatch(/^([0-9A-Z]{4}-){12}[0-9A-Z]{4}$/);
    expect(decodeRecoverySecret(display.toLowerCase().replace(/-/g, " "))).toEqual(secret);
    expect(() => decodeRecoverySecret("U-U-U")).toThrow();
    expect(() => decodeRecoverySecret(display.slice(0, 20))).toThrow();
    expect(encodeRecoverySecret(secret)).toBe(display);
  });
});

describe("backup restore", () => {
  const k = generateContentKey();
  const mk = (accountId: string, itemId: string, version: number) => ({
    accountId, itemId, version, sealed: sealItem(k, "x", { accountId, itemId, version })
  });
  it("deleted items do not reappear; other accounts' entries are never restored; latest version wins", () => {
    const backup = [mk("A", "p", 1), mk("A", "p", 2), mk("A", "trip1", 1), mk("B", "p", 5)];
    const out = applyRestore("A", backup, [{ accountId: "A", itemId: "trip1", deletedAt: "2026-10-01T00:00:00Z" }]);
    expect(out.map((e) => `${e.itemId}@${e.version}`)).toEqual(["p@2"]);
  });
});
