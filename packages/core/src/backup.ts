import type { SealedItem } from "./vault.js";

/**
 * Encrypted backup restore with deletion tombstones. A deleted item must not reappear when an
 * older backup is restored. Backups hold ciphertext only; the server cannot read them.
 */
export interface BackupEntry {
  accountId: string;
  itemId: string;
  version: number;
  sealed: SealedItem;
}

export interface Tombstone {
  accountId: string;
  itemId: string;
  deletedAt: string;
}

export function applyRestore(accountId: string, backup: BackupEntry[], tombstones: Tombstone[]): BackupEntry[] {
  const deleted = new Set(tombstones.filter((t) => t.accountId === accountId).map((t) => t.itemId));
  // Entries for another account are never restored into this one (cross-account backup protection).
  const mine = backup.filter((e) => e.accountId === accountId && !deleted.has(e.itemId));
  const latest = new Map<string, BackupEntry>();
  for (const e of mine) {
    const cur = latest.get(e.itemId);
    if (!cur || e.version > cur.version) latest.set(e.itemId, e);
  }
  return [...latest.values()];
}
