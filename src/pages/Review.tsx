import { useMemo, useState } from 'react';
import { CalendarCheck, ClipboardCheck, Save } from 'lucide-react';
import { useStore } from '@/store';
import { Badge, Button, Card, CardHeader, EmptyState, Field, StatCard, Textarea, useToast } from '@/components/ui';
import { PageHeader } from '@/components/common';
import { ChartCard, SimpleBarChart } from '@/components/charts';
import { addDaysISO, formatDate, formatMinutes, startOfWeekISO, todayISO } from '@/lib/utils';
import { subjectProgress, studyStats, weekMetrics } from '@/lib/progress';
import { cn } from '@/lib/utils';

const REFLECTIONS = [
  { key: 'accomplished', label: 'What did I accomplish this week?' },
  { key: 'struggled', label: 'What did I struggle with?' },
  { key: 'improve', label: 'What should I improve next week?' },
  { key: 'stopWasting', label: 'What should I stop wasting time on?' },
] as const;

export default function Review() {
  const store = useStore();
  const toast = useToast();
  const [weekStart, setWeekStart] = useState(startOfWeekISO());
  const weekEnd = addDaysISO(weekStart, 6);
  const metrics = useMemo(() => weekMetrics(store, weekStart), [store, weekStart]);
  const existing = store.reviews.find((r) => r.weekStart === weekStart);
  const [draft, setDraft] = useState<Record<string, string>>({
    accomplished: existing?.accomplished ?? '',
    struggled: existing?.struggled ?? '',
    improve: existing?.improve ?? '',
    stopWasting: existing?.stopWasting ?? '',
  });

  // keep the draft in sync when switching weeks
  const existingKey = existing?.id ?? 'none';
  const [loadedKey, setLoadedKey] = useState(existingKey);
  if (loadedKey !== existingKey) {
    setLoadedKey(existingKey);
    setDraft({
      accomplished: existing?.accomplished ?? '',
      struggled: existing?.struggled ?? '',
      improve: existing?.improve ?? '',
      stopWasting: existing?.stopWasting ?? '',
    });
  }

  const weeks = Array.from({ length: 8 }, (_, i) => addDaysISO(startOfWeekISO(), -i * 7));

  const sessionsByType = useMemo(() => {
    const inRange = store.sessions.filter((s) => s.date >= weekStart && s.date <= weekEnd);
    return ['learning', 'practice', 'revision', 'problem-solving', 'project', 'interview'].map((t) => ({
      label: t.replace('-', ' '),
      value: Math.round((inRange.filter((s) => s.type === t).reduce((a, s) => a + s.minutes, 0) / 60) * 10) / 10,
    }));
  }, [store.sessions, weekStart, weekEnd]);

  const allTime = studyStats(store.sessions);
  const thisMonth = todayISO().slice(0, 7);
  const prevMonthDate = new Date();
  prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
  const prevMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
  const monthMinutes = store.sessions.filter((s) => s.date.startsWith(thisMonth)).reduce((a, s) => a + s.minutes, 0);
  const prevMonthMinutes = store.sessions.filter((s) => s.date.startsWith(prevMonth)).reduce((a, s) => a + s.minutes, 0);

  const targetHours = store.settings.dailyTargetHours * 7;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reviews"
        description="A short weekly reflection keeps the plan honest"
        meta={
          <>
            <Badge tone="blue">
              {formatDate(weekStart)} → {formatDate(weekEnd)}
            </Badge>
            <Badge tone="slate">{store.reviews.length} saved reviews</Badge>
          </>
        }
        actions={
          <div className="flex flex-wrap gap-1.5">
            {weeks.slice(0, 5).map((w) => (
              <Button key={w} size="sm" variant={w === weekStart ? 'primary' : 'secondary'} onClick={() => setWeekStart(w)}>
                {w === startOfWeekISO() ? 'This week' : formatDate(w).slice(0, 6)}
              </Button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Study hours" value={formatMinutes(metrics.minutes)} hint={`Target ${targetHours}h`} progress={Math.min(100, (metrics.minutes / (targetHours * 60)) * 100)} />
        <StatCard label="DSA problems" value={metrics.problems} icon={<CalendarCheck size={16} />} />
        <StatCard label="Topics completed" value={metrics.topicsCompleted} />
        <StatCard label="Revisions done" value={metrics.revisions} />
        <StatCard label="Tasks done" value={`${metrics.tasksDone}/${metrics.tasksTotal}`} />
        <StatCard label="Tasks missed" value={metrics.tasksMissed} />
        <StatCard label="Mock avg" value={metrics.mocks ? `${metrics.mockAvg}%` : '—'} hint={`${metrics.mocks} mock(s)`} />
        <StatCard label="Overall now" value={`${Math.round(store.subjects.filter((s) => !s.archived).reduce((a, s) => a + subjectProgress(s, store.topics), 0) / Math.max(1, store.subjects.filter((s) => !s.archived).length))}%`} hint="avg subject progress" />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard title="Time by session type" subtitle={formatDate(weekStart)}>
          <SimpleBarChart data={sessionsByType} unit="h" />
        </ChartCard>

        <Card>
          <CardHeader title="Reflection" subtitle={existing ? 'Editing your saved reflection' : 'Not saved yet'} icon={<ClipboardCheck size={16} />} />
          <div className="space-y-3 p-4">
            {REFLECTIONS.map((r) => (
              <Field key={r.key} label={r.label}>
                <Textarea
                  value={draft[r.key]}
                  onChange={(e) => setDraft({ ...draft, [r.key]: e.target.value })}
                  placeholder="Write a couple of honest lines…"
                  className="min-h-[64px]"
                />
              </Field>
            ))}
            <Button
              variant="primary"
              icon={<Save size={15} />}
              onClick={() => {
                store.saveReview({ weekStart, weekEnd, ...draft });
                toast.push('Weekly review saved', { tone: 'success' });
              }}
            >
              Save reflection
            </Button>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Saved reviews" subtitle="Look back at previous reflections" />
        <div className="divide-y">
          {store.reviews.length === 0 && <p className="px-4 py-4 text-xs text-content-faint">No reviews saved yet.</p>}
          {[...store.reviews].sort((a, b) => b.weekStart.localeCompare(a.weekStart)).map((r) => (
            <div key={r.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-medium">
                  {formatDate(r.weekStart)} → {formatDate(r.weekEnd)}
                </div>
                <Button size="sm" variant="ghost" onClick={() => setWeekStart(r.weekStart)}>
                  Open week
                </Button>
              </div>
              <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                {REFLECTIONS.map((f) =>
                  r[f.key] ? (
                    <div key={f.key} className="rounded-lg border p-2">
                      <div className="text-[10px] uppercase tracking-wide text-content-faint">{f.label}</div>
                      <div className="mt-0.5 text-content-muted">{r[f.key]}</div>
                    </div>
                  ) : null,
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Monthly review" subtitle={`${prevMonth} vs ${thisMonth}`} />
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Study hours', now: formatMinutes(monthMinutes), prev: formatMinutes(prevMonthMinutes) },
            { label: 'Problems solved', now: store.dsaProblems.filter((p) => p.dateSolved?.startsWith(thisMonth)).length, prev: store.dsaProblems.filter((p) => p.dateSolved?.startsWith(prevMonth)).length },
            { label: 'Sessions', now: store.sessions.filter((s) => s.date.startsWith(thisMonth)).length, prev: store.sessions.filter((s) => s.date.startsWith(prevMonth)).length },
            { label: 'Mocks', now: store.mocks.filter((m) => m.date.startsWith(thisMonth)).length, prev: store.mocks.filter((m) => m.date.startsWith(prevMonth)).length },
          ].map((row) => (
            <div key={row.label} className="rounded-lg border p-3">
              <div className="text-xs text-content-muted">{row.label}</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-semibold tabular-nums">{row.now}</span>
                <span className={cn('text-[11px]', Number(row.now) >= Number(row.prev) ? 'text-green-500' : 'text-amber-500')}>vs {row.prev} last month</span>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t px-4 py-3">
          <div className="text-xs text-content-muted">
            Lifetime: {formatMinutes(allTime.totalMinutes)} studied across {allTime.activeDays} active days.
          </div>
        </div>
      </Card>

      {metrics.tasksTotal === 0 && (
        <EmptyState title="Nothing logged this week" message="Plan tasks and log sessions to make this review meaningful." />
      )}
    </div>
  );
}
