// ---------------------------------------------------------------------------
// Observable sync status.
//
// The store adapter in cloudStorage.ts reports what it is doing here; the
// `CloudStatusBar` component subscribes. Kept as a module-level singleton
// rather than React state so the storage layer never has to import React.
// ---------------------------------------------------------------------------

export type SyncState = 'local' | 'loading' | 'syncing' | 'synced' | 'offline' | 'error';

export interface CloudStatus {
  state: SyncState;
  /** Set when `state` is 'offline' or 'error'. */
  message?: string;
  /** True when local changes are queued because the last write failed. */
  pending: boolean;
  /** Rows written in the last successful sync, for the "Saved to cloud" hint. */
  lastSyncedAt?: number;
}

const initial: CloudStatus = { state: 'local', pending: false };

let current: CloudStatus = initial;
const listeners = new Set<() => void>();

function emit(next: CloudStatus) {
  current = next;
  listeners.forEach((fn) => fn());
}

export function setCloudStatus(patch: Partial<CloudStatus>): void {
  emit({ ...current, ...patch });
}

export function getCloudStatus(): CloudStatus {
  return current;
}

export function subscribeCloudStatus(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function resetCloudStatus(): void {
  emit(initial);
}
