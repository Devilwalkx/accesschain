import { bytesToHex, randomBytes } from "@noble/ciphers/utils.js";
import { storage } from "./storage";
import { loadAccountId } from "./accountId";
import { generateContentKey, openItem, parseProfile, sealItem, type RequirementsProfile, type SealedItem, type SecureKeyStore } from "@accesschain/core";

/**
 * The requirements profile is stored only as ciphertext, bound to account/item/version.
 * There is NO recovery path: the key lives only in this phone's secure store, and nothing is backed up anywhere
 * (android:allowBackup is off). If the key is lost the profile cannot be opened and the person re-enters their needs.
 * LIMITATION: ciphertext is kept via `storage` (native: secure store, size-limited; web: localStorage). There is no plaintext copy anywhere.
 */
const KEY_NAME = "content";
const ITEM = "profile";

export class ProfileRepo {
  private account: Promise<string> | null = null;
  constructor(private readonly keys: SecureKeyStore) {}

  private accountId(): Promise<string> {
    this.account ??= loadAccountId(storage, () => bytesToHex(randomBytes(16)));
    return this.account;
  }

  private async key(): Promise<Uint8Array> {
    const existing = await this.keys.get(KEY_NAME);
    if (existing) return existing;
    const k = generateContentKey();
    await this.keys.set(KEY_NAME, k);
    return k;
  }

  async save(profile: RequirementsProfile): Promise<void> {
    const valid = parseProfile(profile);
    const current = await this.readEnvelope();
    const version = (current?.version ?? 0) + 1;
    const sealed = sealItem(await this.key(), JSON.stringify(valid), { accountId: await this.accountId(), itemId: ITEM, version });
    await storage.set("ac.profile", JSON.stringify({ version, sealed }));
  }

  async load(): Promise<RequirementsProfile | null> {
    const env = await this.readEnvelope();
    if (!env) return null;
    const k = await this.keys.get(KEY_NAME);
    if (!k) throw new Error("Vault key missing on this device.");
    return parseProfile(JSON.parse(openItem(k, env.sealed, { accountId: await this.accountId(), itemId: ITEM, version: env.version })));
  }

  /** Deletes the answers, the key and the install id. A later save starts again with a new key and a new id. */
  async erase(): Promise<void> {
    await storage.delete("ac.profile");
    await this.keys.delete(KEY_NAME);
    await storage.delete("ac.account");
    this.account = null;
  }

  private async readEnvelope(): Promise<{ version: number; sealed: SealedItem } | null> {
    const raw = await storage.get("ac.profile");
    return raw ? (JSON.parse(raw) as { version: number; sealed: SealedItem }) : null;
  }
}
