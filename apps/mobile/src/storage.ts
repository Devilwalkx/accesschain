import * as SecureStore from "expo-secure-store";

/**
 * Small key-value store for ciphertext and non-secret state (native: Keychain/Keystore-backed secure store).
 * A `storage.web.ts` sibling is picked by Metro on web. Only ciphertext/non-secrets may be written here.
 */
export interface KeyValueStore {
  get(name: string): Promise<string | null>;
  set(name: string, value: string): Promise<void>;
  delete(name: string): Promise<void>;
}

export const storage: KeyValueStore = {
  get: (name) => SecureStore.getItemAsync(name),
  set: (name, value) => SecureStore.setItemAsync(name, value),
  delete: (name) => SecureStore.deleteItemAsync(name)
};
