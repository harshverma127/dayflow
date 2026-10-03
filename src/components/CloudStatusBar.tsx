import { useEffect, useState } from 'react';
import { CloudOff, RefreshCw, WifiOff } from 'lucide-react';
import {
  getCloudStatus,
  subscribeCloudStatus,
  type CloudStatus,
} from '@/services/cloudStatus';
import { flushPendingWrites } from '@/services/cloudStorage';
import { useAuth } from '@/services/AuthProvider';

// ---------------------------------------------------------------------------
// Honest sync feedback.
//
// Per spec §28 the app must never pretend a cloud write succeeded. If the
// network drops, the pending changes stay on the device and this bar says so
// with a retry — the data is not lost and not silently discarded.
// ---------------------------------------------------------------------------

export function CloudStatusBar() {
  const { status } = useAuth();
  const [state, setState] = useState<CloudStatus>(getCloudStatus);

  useEffect(() => subscribeCloudStatus(() => setState(getCloudStatus())), []);

  if (status !== 'authenticated') return null;
  if (!state.pending && state.state !== 'offline' && state.state !== 'error') return null;

  const offline = state.state === 'offline';
  const Icon = offline ? WifiOff : CloudOff;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4">
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex items-center gap-3 rounded-full border border-border bg-surface-raised px-4 py-2 shadow-lift"
      >
        <Icon size={15} className="shrink-0 text-content-muted" aria-hidden />
        <span className="text-xs text-content-muted">
          {state.message ?? 'Could not reach the cloud.'} Your changes are saved on this device.
        </span>
        <button
          type="button"
          onClick={() => void flushPendingWrites()}
          className="flex shrink-0 items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-content transition hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <RefreshCw size={12} aria-hidden />
          Retry
        </button>
      </div>
    </div>
  );
}
