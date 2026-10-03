import { useRef, useState } from 'react';
import { AlertTriangle, Download, Moon, RotateCcw, Sun, Upload } from 'lucide-react';
import { useStore } from '@/store';
import type { AppData } from '@/types';
import { Badge, Button, Card, CardHeader, ConfirmDialog, Field, Input, Select, useToast } from '@/components/ui';
import { MetricBar, PageHeader, ToggleRow } from '@/components/common';
import { bucketProgress, overallProgress } from '@/lib/progress';
import { download, formatDate, toCSV, todayISO } from '@/lib/utils';
import { countEntities, ensureUuidIds, validateLocalData } from '@/services/localData';
import { createInitialData } from '@/data/seed';

const WEIGHT_KEYS = [
  { key: 'dsa', label: 'DSA' },
  { key: 'coreCs', label: 'Core CS' },
  { key: 'development', label: 'Development' },
  { key: 'design', label: 'Design (LLD/HLD)' },
  { key: 'interview', label: 'Interview' },
  { key: 'projects', label: 'Projects' },
] as const;

export default function Settings() {
  const store = useStore();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [pendingImport, setPendingImport] = useState<AppData | null>(null);
  const s = store.settings;
  const buckets = bucketProgress(store);

  const exportJSON = () => {
    const data: AppData = {
      version: store.version,
      subjects: store.subjects,
      topics: store.topics,
      tasks: store.tasks,
      sessions: store.sessions,
      dsaSessions: store.dsaSessions,
      dsaModules: store.dsaModules,
      dsaTopics: store.dsaTopics,
      dsaPatterns: store.dsaPatterns,
      dsaProblems: store.dsaProblems,
      dsaSource: store.dsaSource,
      revisions: store.revisions,
      notes: store.notes,
      projects: store.projects,
      interviewQuestions: store.interviewQuestions,
      stories: store.stories,
      mocks: store.mocks,
      applications: store.applications,
      companies: store.companies,
      goals: store.goals,
      roadmap: store.roadmap,
      journal: store.journal,
      reviews: store.reviews,
      activities: store.activities,
      settings: store.settings,
    };
    store.markBackup();
    download(`preptrack-backup-${todayISO()}.json`, JSON.stringify(data, null, 2));
    toast.push('Backup downloaded', { tone: 'success' });
  };

  const exportCSV = () => {
    download(
      `preptrack-problems-${todayISO()}.csv`,
      toCSV(
        store.dsaProblems.map((p) => ({
          name: p.name,
          platform: p.platform,
          module: store.dsaModules.find((m) => m.id === p.moduleId)?.name ?? '',
          pattern: store.dsaPatterns.find((x) => x.id === p.patternId)?.name ?? '',
          difficulty: p.difficulty,
          solved: p.solved ? 'yes' : 'no',
          independent: p.independent ? 'yes' : 'no',
          mastered: p.mastered ? 'yes' : 'no',
          confidence: p.confidence,
          dateSolved: p.dateSolved ?? '',
        })),
      ),
      'text/csv',
    );
    toast.push('CSV exported', { tone: 'success' });
  };

  const importFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      let parsed: Partial<AppData> | null = null;
      try {
        parsed = JSON.parse(String(reader.result)) as Partial<AppData>;
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.subjects) || !parsed.settings) {
          throw new Error('Invalid backup');
        }
      } catch {
        toast.push('Could not read that file — is it a Dayflow JSON backup?', { tone: 'error' });
        return;
      }

      // Restoring replaces the current workspace, so validate first and show a
      // preview before anything is written (spec §16).
      const validation = validateLocalData(parsed);
      if (!validation.ok) {
        toast.push(validation.errors.join(' ') || 'That file is not a Dayflow backup.', { tone: 'error' });
        return;
      }

      const merged: AppData = {
        ...createInitialData(),
        ...parsed,
        version: parsed.version ?? store.version,
        dsaSource: parsed.dsaSource ?? store.dsaSource,
        settings: { ...store.settings, ...(parsed.settings ?? {}) },
      } as AppData;
      setPendingImport(merged);
    };
    reader.onerror = () => toast.push('Failed to read the file', { tone: 'error' });
    reader.readAsText(file);
  };

  const confirmImport = () => {
    if (!pendingImport) return;
    // Legacy ids from an older build are not UUIDs, so they are remapped here
    // before the records reach Supabase.
    const { data: remapped, remapped: changed } = ensureUuidIds(pendingImport);
    store.importData(remapped);
    const counts = countEntities(remapped);
    const total = Object.entries(counts).reduce(
      (n, [k, v]) => (k === 'checklistItems' ? n : n + v),
      0,
    );
    toast.push(
      `Restored ${total} record${total === 1 ? '' : 's'}` + (changed > 0 ? ` · ${changed} ids upgraded` : ''),
      { tone: 'success' },
    );
    setPendingImport(null);
  };

  const totalWeight = WEIGHT_KEYS.reduce((a, w) => a + s.weights[w.key], 0);

  const pendingCounts = pendingImport ? countEntities(pendingImport) : null;
  const pendingTotal = pendingCounts
    ? Object.entries(pendingCounts).reduce((n, [k, v]) => (k === 'checklistItems' ? n : n + v), 0)
    : 0;

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" description="Personalise the tracker — your data is synced to your Dayflow account" meta={<Badge tone="slate">data version {store.version}</Badge>} />

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader title="Profile" subtitle="Used across the dashboard" />
          <div className="space-y-3 p-4">
            <Field label="Name">
              <Input value={s.name} onChange={(e) => store.updateSettings({ name: e.target.value })} />
            </Field>
            <Field label="Target role">
              <Input value={s.targetRole} onChange={(e) => store.updateSettings({ targetRole: e.target.value })} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Graduation year">
                <Input type="number" value={s.graduationYear} onChange={(e) => store.updateSettings({ graduationYear: Number(e.target.value) })} />
              </Field>
              <Field label="Preferred language">
                <Select value={s.preferredLanguage} onChange={(e) => store.updateSettings({ preferredLanguage: e.target.value })}>
                  {['Java', 'C++', 'Python', 'JavaScript', 'Go', 'C#'].map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Placement goal" subtitle="What you are preparing for" />
          <div className="space-y-3 p-4">
            <Field label="Goal type">
              <Select value={s.prepType} onChange={(e) => store.updateSettings({ prepType: e.target.value as typeof s.prepType })}>
                <option value="internship">Internship</option>
                <option value="placement">Final placement</option>
                <option value="both">Both</option>
              </Select>
            </Field>
            <Field label="Historical problems solved" hint="Adds to the problems-solved total until you import exact data.">
              <Input type="number" min={0} value={s.historicalSolved} onChange={(e) => store.updateSettings({ historicalSolved: Number(e.target.value) })} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Pomodoro focus (min)">
                <Input type="number" min={5} value={s.pomodoro.focus} onChange={(e) => store.updateSettings({ pomodoro: { ...s.pomodoro, focus: Number(e.target.value) } })} />
              </Field>
              <Field label="Pomodoro break (min)">
                <Input type="number" min={1} value={s.pomodoro.break} onChange={(e) => store.updateSettings({ pomodoro: { ...s.pomodoro, break: Number(e.target.value) } })} />
              </Field>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Roadmap" subtitle="Anchors the 8-week plan" />
          <div className="space-y-3 p-4">
            <Field label="Start date">
              <Input type="date" value={s.roadmapStartDate} onChange={(e) => store.updateSettings({ roadmapStartDate: e.target.value })} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Number of weeks">
                <Input type="number" min={1} max={52} value={s.roadmapWeeks} onChange={(e) => store.updateSettings({ roadmapWeeks: Number(e.target.value) })} />
              </Field>
              <Field label="Daily target (hours)">
                <Input type="number" min={1} max={16} value={s.dailyTargetHours} onChange={(e) => store.updateSettings({ dailyTargetHours: Number(e.target.value) })} />
              </Field>
            </div>
            <p className="text-[11px] text-content-faint">
              Current roadmap starts {formatDate(s.roadmapStartDate)} with {store.roadmap.length} week(s) seeded. Editing the start date changes scheduling calculations only.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader title="Appearance & notifications" subtitle="Theme and reminders" />
          <div className="p-4">
            <Field label="Theme">
              <div className="flex gap-2">
                {(
                  [
                    { v: 'light', label: 'Light', icon: <Sun size={14} /> },
                    { v: 'dark', label: 'Dark', icon: <Moon size={14} /> },
                    { v: 'system', label: 'System', icon: null },
                  ] as const
                ).map((t) => (
                  <Button key={t.v} size="sm" variant={s.theme === t.v ? 'primary' : 'secondary'} icon={t.icon} onClick={() => store.updateSettings({ theme: t.v })}>
                    {t.label}
                  </Button>
                ))}
              </div>
            </Field>
            <div className="mt-2 divide-y">
              <ToggleRow label="Revision reminders" description="Show spaced-repetition items that are due" checked={s.notifications.revision} onChange={(v) => store.updateSettings({ notifications: { ...s.notifications, revision: v } })} />
              <ToggleRow label="Daily goals" description="Surface today's focus on the dashboard" checked={s.notifications.dailyGoals} onChange={(v) => store.updateSettings({ notifications: { ...s.notifications, dailyGoals: v } })} />
              <ToggleRow label="Missed tasks" description="Remind me about tasks rolled over from previous days" checked={s.notifications.missedTasks} onChange={(v) => store.updateSettings({ notifications: { ...s.notifications, missedTasks: v } })} />
              <ToggleRow label="Upcoming deadlines" description="Warn me about application deadlines and interviews" checked={s.notifications.deadlines} onChange={(v) => store.updateSettings({ notifications: { ...s.notifications, deadlines: v } })} />
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Analytics weighting" subtitle={`Overall preparation is ${overallProgress(store)}% with these weights (total ${totalWeight})`} />
        <div className="grid gap-4 p-4 lg:grid-cols-2">
          <div className="space-y-4">
            {WEIGHT_KEYS.map((w) => (
              <div key={w.key}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium">{w.label}</span>
                  <span className="tabular-nums text-content-muted">{s.weights[w.key]} · track {buckets[w.key]}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={50}
                  value={s.weights[w.key]}
                  onChange={(e) => store.updateSettings({ weights: { ...s.weights, [w.key]: Number(e.target.value) } })}
                  className="w-full accent-[rgb(var(--brand))]"
                  aria-label={`${w.label} weight`}
                />
              </div>
            ))}
            <Button size="sm" variant="secondary" onClick={() => store.updateSettings({ weights: { dsa: 30, coreCs: 30, development: 10, design: 10, interview: 10, projects: 10 } })}>
              Reset to defaults
            </Button>
          </div>
          <div className="space-y-3">
            <div className="text-xs font-medium text-content-muted">Live preview</div>
            {WEIGHT_KEYS.map((w) => (
              <MetricBar key={w.key} label={w.label} value={buckets[w.key]} right={`weight ${s.weights[w.key]}`} />
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Data & backup" subtitle="Everything lives in your browser's local storage" />
        <div className="flex flex-wrap items-center gap-2 p-4">
          <Button variant="secondary" icon={<Download size={15} />} onClick={exportJSON}>
            Download backup (JSON)
          </Button>
          <Button variant="secondary" icon={<Download size={15} />} onClick={exportCSV}>
            Export problems (CSV)
          </Button>
          <Button variant="secondary" icon={<Upload size={15} />} onClick={() => fileRef.current?.click()}>
            Restore backup
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importFile(file);
              e.target.value = '';
            }}
          />
        </div>
        <div className="border-t px-4 py-3 text-[11px] text-content-faint">
          {store.subjects.length} subjects · {store.topics.length} topics · {store.sessions.length} study sessions · {store.dsaProblems.length} DSA problems · {store.dsaSessions.length} DSA sessions · {store.notes.length} notes
        </div>
      </Card>

      <Card>
        <CardHeader title="Danger zone" subtitle="Destructive actions always ask first" icon={<AlertTriangle size={16} />} />
        <div className="flex flex-wrap gap-2 p-4">
          <Button variant="secondary" icon={<RotateCcw size={15} />} onClick={() => setConfirmReset(true)}>
            Reset to seeded roadmap
          </Button>
          <Button variant="danger" onClick={() => setConfirmClear(true)}>
            Clear all data
          </Button>
          <Button variant="ghost" onClick={() => { store.undo(); toast.push('Restored previous snapshot'); }}>
            Undo last destructive action
          </Button>
        </div>
        <div className="border-t px-4 py-3 text-[11px] text-content-faint">
          Data is stored under the key <code className="font-mono">preptrack:v1</code> in localStorage. Export a backup before clearing.
        </div>
      </Card>

      <ConfirmDialog
        open={confirmReset}
        title="Reset everything?"
        message="This empties your workspace back to a clean account — no subjects, problems, projects or activity. Export a backup first if you want to keep anything."
        confirmLabel="Reset"
        destructive
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          store.resetData();
          setConfirmReset(false);
          toast.push('Workspace reset', { tone: 'success' });
        }}
      />

      <ConfirmDialog
        open={pendingImport !== null}
        title="Restore this backup?"
        message={
          pendingCounts ? (
            <span>
              This replaces your current workspace with{' '}
              <strong className="text-content">{pendingTotal} records</strong> from the file
              {pendingCounts.subjects > 0 && <> · {pendingCounts.subjects} subjects</>}
              {pendingCounts.dsaProblems > 0 && <> · {pendingCounts.dsaProblems} DSA problems</>}
              {pendingCounts.sessions > 0 && <> · {pendingCounts.sessions} study sessions</>}. Everything is attached to your
              account and synced to the cloud.
            </span>
          ) : (
            ''
          )
        }
        confirmLabel="Restore backup"
        destructive={false}
        onCancel={() => setPendingImport(null)}
        onConfirm={confirmImport}
      />

      <ConfirmDialog
        open={confirmClear}
        title="Clear all data?"
        message="This removes every subject, topic, task, session, problem, note and project. Export a backup first if you want to keep anything."
        confirmLabel="Clear everything"
        destructive
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          store.clearAll();
          setConfirmClear(false);
          toast.push('All data cleared', { tone: 'success', action: { label: 'Undo', onClick: () => store.undo() } });
        }}
      />
    </div>
  );
}
