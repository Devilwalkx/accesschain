import type { KeyValueStore } from "./storage";

/** Web: ciphertext and non-secrets only, in localStorage. Never write keys or plaintext here. */
export const storage: KeyValueStore = {
  async get(name) {
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  async set(name, value) {
    window.localStorage.setItem(name, value);
  },
  async delete(name) {
    window.localStorage.removeItem(name);
  }
};
