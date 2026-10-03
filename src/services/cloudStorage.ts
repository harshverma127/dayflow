// ---------------------------------------------------------------------------
// Cloud-aware persistence adapter.
//
// This replaces `idbStorage` as the store's `storage` option (src/store.ts).
// It is the seam between the existing local-first architecture and Supabase:
//
//   READ   authenticated  -> fetch the workspace from Supabase (source of truth)
//          signed out / not configured -> read the IndexedDB cache
//          network failure -> fall back to the IndexedDB cache and say so
//
//   WRITE  always mirror to IndexedDB first (so an offline reload still works
//          and a failed upload is never silently lost), then push the diff to
//          Supabase. Failed writes leave the local copy authoritative and are
//          flagged as pending, then retried on reconnect.
//
// Nothing here imports React or `@/store`, which keeps the module graph
// acyclic: store -> cloudStorage -> cloud -> schema -> types.
// ---------------------------------------------------------------------------

import type { StateStorage } from 'zustand/middleware';
import type { AppData } from '@/types';
import { idbStorage } from '@/lib/idbStorage';
import { DATA_VERSION } from '@/lib/constants';
import { isSupabaseConfigured, friendlyError } from './supabase';
import { getCurrentUserId, waitForAuthReady } from './auth';
import { loadWorkspace, syncWorkspace } from './cloud';
import { setCloudStatus } from './cloudStatus';

/** How long to wait after the last change before pushing to Supabase. */
const DEBOUNCE_MS = 700;
/** How often to retry a failed push while the browser is online. */
const RETRY_MS = 15_000;

interface PersistEnvelope {
  state: AppData;
  version: number;
}

function envelope(state: AppData): string {
  return JSON.stringify({ state, version: DATA_VERSION } satisfies PersistEnvelope);
}

function parseEnvelope(raw: string | null): AppData | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersistEnvelope | AppData;
    // createJSONStorage stores `{ state, version }`; be tolerant of a bare
    // payload so a hand-written or partially written blob still loads.
    const state = (parsed as PersistEnvelope)?.state ?? (parsed as AppData);
    return state && typeof state === 'object' ? (state as AppData) : null;
  } catch {
    return null;
  }
}

/** Last snapshot known to exist in the cloud; the baseline for the next diff. */
let lastSynced: AppData | null = null;
/** Newest snapshot awaiting upload. */
let queued: AppData | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let retryTimer: ReturnType<typeof setInterval> | undefined;
let inFlight = false;

/**
 * The IndexedDB contents as they were BEFORE the first cloud load overwrote the
 * cache. `undefined` means "not captured yet", which is different from
 * `null` ("there was nothing there"). The migration prompt needs this to offer
 * an upload, and it has to be read before the cache is replaced.
 */
let preCloudLocal: AppData | null | undefined = undefined;

export function getPreCloudLocalSnapshot(): AppData | null | undefined {
  return preCloudLocal;
}

export function clearPreCloudLocalSnapshot(): void {
  preCloudLocal = undefined;
}

export function forgetCloudBaseline(): void {
  lastSynced = null;
  queued = null;
  if (debounceTimer) clearTimeout(debounceTimer);
}

async function push(): Promise<void> {
  if (inFlight || !queued) return;
  inFlight = true;
  const target = queued;
  try {
    setCloudStatus({ state: 'syncing' });
    if (!lastSynced) {
      // First write after sign-in without a baseline: take one from the cloud
      // so the diff is computed against real rows rather than empty arrays
      // (which would look like "delete everything").
      lastSynced = await loadWorkspace();
    }
    await syncWorkspace(lastSynced, target);
    lastSynced = target;
    queued = null;
    setCloudStatus({ state: 'synced', pending: false, message: undefined });
  } catch (error) {
    const friendly = friendlyError(error);
    // Keep `queued` so nothing is lost, and surface why.
    setCloudStatus({
      state: friendly.retryable ? 'offline' : 'error',
      message: friendly.message,
      pending: true,
    });
  } finally {
    inFlight = false;
  }
}

function schedulePush(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => void push(), DEBOUNCE_MS);
}

function ensureRetryLoop(): void {
  if (retryTimer !== undefined) return;
  retryTimer = setInterval(() => {
    if (!queued) return;
    // Only upload while somebody is signed in; `syncWorkspace` resolves the
    // owner itself from the session.
    if (!getCurrentUserId()) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    void push();
  }, RETRY_MS);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    if (getCurrentUserId() && queued) void push();
  });
}

export const cloudStorage: StateStorage = {
  getItem: async (name) => {
    if (!isSupabaseConfigured) {
      setCloudStatus({ state: 'local', pending: false });
      return idbStorage.getItem(name);
    }

    // Do not guess: wait until Supabase has reported the session state.
    await waitForAuthReady();
    const userId = getCurrentUserId();

    if (!userId) {
      setCloudStatus({ state: 'local', pending: false });
      return idbStorage.getItem(name);
    }

    setCloudStatus({ state: 'loading' });
    try {
      const workspace = await loadWorkspace();
      lastSynced = workspace;
      queued = null;
      // Capture whatever the device already had BEFORE the cache is replaced,
      // otherwise the migration prompt would find nothing to offer.
      if (preCloudLocal === undefined) {
        preCloudLocal = parseEnvelope(await idbStorage.getItem(name));
      }
      // Refresh the local cache so an offline reload is not empty.
      await idbStorage.setItem(name, envelope(workspace));
      setCloudStatus({ state: 'synced', pending: false, lastSyncedAt: Date.now() });
      return envelope(workspace);
    } catch (error) {
      const friendly = friendlyError(error);
      setCloudStatus({
        state: friendly.retryable ? 'offline' : 'error',
        message: friendly.message,
        pending: false,
      });
      return idbStorage.getItem(name);
    }
  },

  setItem: async (name, value) => {
    // Local copy first: if the upload fails or the tab closes, IndexedDB still
    // holds the user's latest state.
    await idbStorage.setItem(name, value);
    if (!isSupabaseConfigured) return;

    const state = parseEnvelope(value);
    if (!state) return;

    const userId = getCurrentUserId();
    if (!userId) {
      // Signed out (or auth not yet resolved): local-only, nothing to upload.
      setCloudStatus({ state: 'local', pending: false });
      return;
    }

    queued = state;
    setCloudStatus({ pending: true });
    ensureRetryLoop();
    schedulePush();
  },

  removeItem: async (name) => {
    await idbStorage.removeItem(name);
    forgetCloudBaseline();
  },
};

/** Forces an immediate push of any queued changes. Used by the retry button. */
export async function flushPendingWrites(): Promise<void> {
  if (getCurrentUserId() && queued) await push();
}
