import { useEffect, useMemo, useState } from 'react';
import { CloudUpload, HardDriveDownload } from 'lucide-react';
import { Button, Modal, Spinner, useToast } from '@/components/ui';
import { useAuth } from '@/services/AuthProvider';
import { clearPreCloudLocalSnapshot, getPreCloudLocalSnapshot } from '@/services/cloudStorage';
import { countEntities, hasLocalData, importLocalToCloud, validateLocalData } from '@/services/localData';
import { forgetCloudBaseline } from '@/services/cloudStorage';
import { useStore } from '@/store';
import { errorMessage } from '@/services/supabase';

// ---------------------------------------------------------------------------
// "Existing Dayflow data found"
//
// Offers to upload whatever this device already had before the cloud took
// over as the source of truth. Nothing is deleted either way: if the import
// fails the IndexedDB copy stays exactly where it was, and "Start Fresh"
// simply keeps using the cloud workspace.
// ---------------------------------------------------------------------------

const HANDLED_PREFIX = 'preptrack:cloud-handled:';

function handledKey(userId: string): string {
  return `${HANDLED_PREFIX}${userId}`;
}

const LABELS: Record<string, string> = {
  subjects: 'Subjects',
  topics: 'Topics + subtopics',
  checklistItems: 'Checklist items',
  tasks: 'Planned tasks',
  sessions: 'Study sessions',
  dsaModules: 'DSA modules',
  dsaTopics: 'DSA topics',
  dsaPatterns: 'DSA patterns',
  dsaProblems: 'DSA problems',
  dsaSessions: 'DSA sessions',
  revisions: 'Revision items',
  notes: 'Notes',
  projects: 'Projects',
  interviewQuestions: 'Interview questions',
  stories: 'Behavioural stories',
  mocks: 'Mock interviews',
  applications: 'Applications',
  companies: 'Companies',
  goals: 'Goals',
  roadmap: 'Roadmap weeks',
  journal: 'Journal entries',
  reviews: 'Weekly reviews',
  activities: 'Activity entries',
};

export function MigratePrompt() {
  const { user } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');

  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) return;
    if (localStorage.getItem(handledKey(userId))) return;
    const snapshot = getPreCloudLocalSnapshot();
    if (!snapshot || !hasLocalData(snapshot)) return;
    const validation = validateLocalData(snapshot);
    if (!validation.ok) {
      toast.push('Local data could not be read; it has been left untouched.', { tone: 'error' });
      return;
    }
    setCounts(countEntities(snapshot));
    setOpen(true);
    // `toast` is a stable object from context; excluding it avoids a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const rows = useMemo(
    () =>
      Object.entries(counts)
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1]),
    [counts],
  );

  const total = rows.reduce((n, [, count]) => n + count, 0);

  async function importToCloud() {
    if (!userId) return;
    const snapshot = getPreCloudLocalSnapshot();
    if (!snapshot) return;
    setBusy(true);
    try {
      setProgress('Uploading…');
      const report = await importLocalToCloud(snapshot);

      // Verify: every collection we expected to upload must be present.
      const mismatches = Object.entries(report.expected).filter(
        ([key, expected]) => expected > 0 && Number(report.actual[key] ?? 0) < expected,
      );

      if (mismatches.length) {
        // Do not claim success, and do not clear the local backup.
        toast.push('Some records did not upload. Your local backup has been kept.', { tone: 'error' });
        setBusy(false);
        setProgress('');
        return;
      }

      forgetCloudBaseline();
      await useStore.persist.rehydrate();
      localStorage.setItem(handledKey(userId), new Date().toISOString());
      clearPreCloudLocalSnapshot();
      toast.push(
        report.remapped > 0
          ? `Imported to cloud · ${report.remapped} legacy ids upgraded`
          : 'Imported to cloud',
        { tone: 'success' },
      );
      setOpen(false);
    } catch (error) {
      toast.push(`${errorMessage(error)} Your local data has been kept.`, { tone: 'error' });
    } finally {
      setBusy(false);
      setProgress('');
    }
  }

  function startFresh() {
    if (userId) localStorage.setItem(handledKey(userId), new Date().toISOString());
    clearPreCloudLocalSnapshot();
    setOpen(false);
  }

  if (!open || !userId) return null;

  return (
    <Modal open={open} onClose={busy ? () => undefined : startFresh} title="Existing Dayflow data found" size="md">
      <p className="text-sm leading-relaxed text-content-muted">
        This device already has a Dayflow workspace. Upload it to your account so it follows you everywhere, or keep
        the cloud workspace as it is.
      </p>

      <div className="mt-4 max-h-56 overflow-y-auto rounded-xl border border-border bg-surface-muted">
        <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
          <span className="flex items-center gap-2 text-xs font-medium text-content">
            <HardDriveDownload size={14} aria-hidden />
            On this device
          </span>
          <span className="text-xs text-content-muted">{total} records</span>
        </div>
        {rows.length ? (
          <dl className="divide-y divide-border">
            {rows.map(([key, count]) => (
              <div key={key} className="flex items-center justify-between px-3.5 py-2 text-xs">
                <dt className="text-content-muted">{LABELS[key] ?? key}</dt>
                <dd className="font-medium tabular-nums text-content">{count}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="px-3.5 py-3 text-xs text-content-muted">Nothing to upload.</p>
        )}
      </div>

      {progress && (
        <p className="mt-3 flex items-center gap-2 text-xs text-content-muted">
          <Spinner /> {progress}
        </p>
      )}

      <p className="mt-3 text-xs leading-relaxed text-content-faint">
        Nothing is deleted. If an upload fails, your local copy stays exactly where it is.
      </p>

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={startFresh} disabled={busy}>
          Start fresh
        </Button>
        <Button variant="primary" icon={<CloudUpload size={15} />} onClick={importToCloud} disabled={busy}>
          {busy ? 'Importing…' : 'Import to Cloud'}
        </Button>
      </div>
    </Modal>
  );
}
