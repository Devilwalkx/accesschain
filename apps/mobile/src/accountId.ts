/**
 * The id that ciphertext is bound to. It used to be the fixed text "local-demo-account"; now each install gets its own random id.
 * Data written by an older build (profile present, no id stored) keeps opening under the old id, so nobody loses their answers.
 */
export interface KV {
  get(name: string): Promise<string | null>;
  set(name: string, value: string): Promise<void>;
}
export const LEGACY_ACCOUNT_ID = "local-demo-account";
export const ACCOUNT_KEY = "ac.account";
const VALID = /^[A-Za-z0-9-]{8,64}$/;

export async function loadAccountId(store: KV, randomHex: () => string): Promise<string> {
  const have = await store.get(ACCOUNT_KEY);
  if (have && VALID.test(have)) return have;
  const existing = await store.get("ac.profile");
  const id = existing ? LEGACY_ACCOUNT_ID : `acct-${randomHex()}`;
  await store.set(ACCOUNT_KEY, id);
  return id;
}
