import * as SecureStore from "expo-secure-store";
import {
  generateContentKey, openItem, parseProfile, sealItem,
  wrapKeyForRecovery,
  type RecoveryBlob, type RequirementsProfile, type SealedItem, type SecureKeyStore
} from "@accesschain/core";

/**
 * The requirements profile is stored only as ciphertext, bound to account/item/version.
 * LIMITATION: ciphertext is kept in the secure store, which is size-limited; saved trips will need
 * an encrypted file store (not built; needs device testing). There is no plaintext copy anywhere.
 */
const KEY_NAME = "content";
const ITEM = "profile";

export class ProfileRepo {
  constructor(private readonly keys: SecureKeyStore, private readonly accountId: string) {}

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
    const sealed = sealItem(await this.key(), JSON.stringify(valid), { accountId: this.accountId, itemId: ITEM, version });
    await SecureStore.setItemAsync("ac.profile", JSON.stringify({ version, sealed }));
  }

  async load(): Promise<RequirementsProfile | null> {
    const env = await this.readEnvelope();
    if (!env) return null;
    const k = await this.keys.get(KEY_NAME);
    if (!k) throw new Error("Vault key missing on this device; recovery secret required.");
    return parseProfile(JSON.parse(openItem(k, env.sealed, { accountId: this.accountId, itemId: ITEM, version: env.version })));
  }

  /** Wrap the content key for a user-held recovery secret. The blob is safe to store remotely; the secret is not. */
  async recoveryBlob(secret: Uint8Array): Promise<RecoveryBlob> {
    return wrapKeyForRecovery(await this.key(), secret, this.accountId);
  }

  async erase(): Promise<void> {
    await SecureStore.deleteItemAsync("ac.profile");
    await this.keys.delete(KEY_NAME);
  }

  private async readEnvelope(): Promise<{ version: number; sealed: SealedItem } | null> {
    const raw = await SecureStore.getItemAsync("ac.profile");
    return raw ? (JSON.parse(raw) as { version: number; sealed: SealedItem }) : null;
  }
}
