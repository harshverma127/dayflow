import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Download, Flame, Plus, Target, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import { useStore } from '@/store';
import { Badge, Button, Card, CardHeader, ConfirmDialog, EmptyState, Field, Input, Modal, ProgressRing, Select, StatCard, Tabs, useToast } from '@/components/ui';
import { MetricBar, PageHeader, ReadinessRow } from '@/components/common';
import { ChartCard, DonutChart, MultiLineChart, ProgressAreaChart, SimpleBarChart } from '@/components/charts';
import { CATEGORY_META, GOAL_METRIC_META, PRIORITIES, PRIORITY_META, REVISION_INTERVALS } from '@/lib/constants';
import { cn, formatDate, formatMinutes, download, startOfWeekISO, toCSV, todayISO, addDaysISO } from '@/lib/utils';
import { bucketProgress, computeStreak, dsaStreak, dsaStats, goalCurrent, heatmapWeeks, interviewReadiness, overallProgressDelta, overallProgress, projectReadiness, roadmapStats, studyStats, subjectProgress } from '@/lib/progress';
import type { Goal, GoalMetric, Priority } from '@/types';

const GOAL_METRICS = Object.keys(GOAL_METRIC_META) as GoalMetric[];

function Heatmap({ weeks }: { weeks: { date: string; minutes: number; level: number }[] }) {
  const cols: { date: string; minutes: number; level: number }[][] = [];
  for (let i = 0; i < weeks.length; i += 7) cols.push(weeks.slice(i, i + 7));
  const tone = ['bg-slate-200 dark:bg-slate-800', 'bg-emerald-200 dark:bg-emerald-900', 'bg-emerald-400 dark:bg-emerald-700', 'bg-emerald-500 dark:bg-emerald-500', 'bg-emerald-700 dark:bg-emerald-300'];
  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex gap-[3px]">
        {cols.map((col, ci) => (
          <div key={ci} className="flex flex-col gap-[3px]">
            {col.map((day) => (
              <div
                key={day.date}
                title={`${formatDate(day.date)} — ${formatMinutes(day.minutes)}`}
                className={cn('h-3 w-3 rounded-sm', tone[day.level])}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-content-faint">
        <span>Less</span>
        {tone.map((t, i) => (
          <span key={i} className={cn('h-3 w-3 rounded-sm', t)} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

export default function Analytics() {
  const store = useStore();
  const toast = useToast();
  const [tab, setTab] = useState<'overview' | 'study' | 'goals' | 'monthly'>('overview');
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalForm, setGoalForm] = useState({ title: '', metric: 'manual' as GoalMetric, refId: '', target: 100, manualCurrent: 0, unit: '', deadline: '', priority: 'medium' as Priority });
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [toDeleteGoal, setToDeleteGoal] = useState<Goal | null>(null);

  const overall = overallProgress(store);
  const buckets = bucketProgress(store);
  const delta = overallProgressDelta(store, 7);
  const stats = studyStats(store.sessions);
  const streak = computeStreak(store.sessions);
  const dStreak = dsaStreak(store.dsaProblems);
  const dsa = dsaStats(store);
  const heat = useMemo(() => heatmapWeeks(store.sessions, 18), [store.sessions]);
  const roadmap = roadmapStats(store);

  const bucketKeys = Object.keys(buckets) as (keyof typeof buckets)[];
  const weakest = bucketKeys.reduce((a, b) => (buckets[a] <= buckets[b] ? a : b));
  const strongest = bucketKeys.reduce((a, b) => (buckets[a] >= buckets[b] ? a : b));

  const LABELS: Record<string, string> = { dsa: 'DSA', coreCs: 'Core CS', development: 'Development', design: 'Design', interview: 'Interview', projects: 'Projects' };

  // weighted effort last 7 days to identify the most improved track
  const improved = useMemo(() => {
    const cutoff = addDaysISO(todayISO(), -7);
    const totals: Record<string, number> = {};
    for (const s of store.sessions.filter((x) => x.date >= cutoff)) {
      const subject = store.subjects.find((x) => x.id === s.subjectId);
      const key = subject ? (subject.category === 'dsa' ? 'dsa' : subject.category === 'core-cs' ? 'coreCs' : /design/i.test(subject.name) ? 'design' : subject.category === 'interview' ? 'interview' : 'development') : 'development';
      totals[key] = (totals[key] ?? 0) + s.minutes;
    }
    const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    return entries[0];
  }, [store.sessions, store.subjects]);

  const studyTrend = useMemo(() => {
    const out: { label: string; value: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const weekStart = addDaysISO(startOfWeekISO(), -i * 7);
      const weekEnd = addDaysISO(weekStart, 6);
      const mins = store.sessions.filter((s) => s.date >= weekStart && s.date <= weekEnd).reduce((a, s) => a + s.minutes, 0);
      out.push({ label: weekStart.slice(5), value: Math.round((mins / 60) * 10) / 10 });
    }
    return out;
  }, [store.sessions]);

  const dsaTrend = useMemo(() => {
    const out: { label: string; value: number }[] = [];
    let cumulative = store.settings.historicalSolved;
    const start = addDaysISO(startOfWeekISO(), -11 * 7);
    for (let i = 0; i < 12; i++) {
      const weekStart = addDaysISO(start, i * 7);
      const weekEnd = addDaysISO(weekStart, 6);
      cumulative += store.dsaProblems.filter((p) => p.dateSolved && p.dateSolved >= weekStart && p.dateSolved <= weekEnd).length;
      out.push({ label: weekStart.slice(5), value: cumulative });
    }
    return out;
  }, [store.dsaProblems, store.settings.historicalSolved]);

  const subjectBars = store.subjects.filter((s) => !s.archived).map((s) => ({ label: s.name.length > 14 ? `${s.name.slice(0, 13)}…` : s.name, value: subjectProgress(s, store.topics) }));

  const revisionCompletion = store.revisions.length ? Math.round((store.revisions.filter((r) => r.done).length / store.revisions.length) * 100) : 0;
  const upcomingRevisions = store.revisions.filter((r) => !r.done && r.dueDate <= todayISO()).length;

  const weeklyProgressSeries = useMemo(() => {
    const weeks = 8;
    return Array.from({ length: weeks }, (_, i) => {
      const weekStart = addDaysISO(startOfWeekISO(), -(weeks - 1 - i) * 7);
      const weekEnd = addDaysISO(weekStart, 6);
      const mins = store.sessions.filter((s) => s.date >= weekStart && s.date <= weekEnd).reduce((a, s) => a + s.minutes, 0);
      const problems = store.dsaProblems.filter((p) => p.dateSolved && p.dateSolved >= weekStart && p.dateSolved <= weekEnd).length;
      return { label: weekStart.slice(5), hours: Math.round((mins / 60) * 10) / 10, problems };
    });
  }, [store.sessions, store.dsaProblems]);

  const monthly = useMemo(() => {
    const thisMonth = todayISO().slice(0, 7);
    const prev = new Date();
    prev.setMonth(prev.getMonth() - 1);
    const prevMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    const sum = (prefix: string) => store.sessions.filter((s) => s.date.startsWith(prefix)).reduce((a, s) => a + s.minutes, 0);
    const problems = (prefix: string) => store.dsaProblems.filter((p) => p.dateSolved?.startsWith(prefix)).length;
    return {
      thisMonth,
      prevMonth,
      minutesNow: sum(thisMonth),
      minutesPrev: sum(prevMonth),
      problemsNow: problems(thisMonth),
      problemsPrev: problems(prevMonth),
    };
  }, [store.sessions, store.dsaProblems]);

  const exportSessions = () => download(`study-sessions-${todayISO()}.csv`, toCSV(store.sessions.map((s) => ({ date: s.date, subject: store.subjects.find((x) => x.id === s.subjectId)?.name ?? '', minutes: s.minutes, type: s.type, productivity: s.productivity, notes: s.notes ?? '' }))), 'text/csv');

  const saveGoal = () => {
    if (!goalForm.title.trim()) {
      toast.push('Goal title required', { tone: 'error' });
      return;
    }
    const payload = {
      title: goalForm.title.trim(),
      metric: goalForm.metric,
      refId: goalForm.refId || undefined,
      target: goalForm.target,
      manualCurrent: goalForm.manualCurrent,
      unit: goalForm.unit || GOAL_METRIC_META[goalForm.metric].unit,
      deadline: goalForm.deadline || undefined,
      priority: goalForm.priority,
    };
    if (editingGoal) {
      store.updateGoal(editingGoal.id, payload);
      toast.push('Goal updated', { tone: 'success' });
    } else {
      store.addGoal(payload);
      toast.push('Goal added', { tone: 'success' });
    }
    setGoalOpen(false);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Analytics"
        description="Everything is computed live from your logged data"
        meta={
          <>
            <Badge tone="blue">{overall}% overall</Badge>
            <Badge tone="green">+{delta}% in 7 days</Badge>
            <Badge tone="slate">{roadmap.progress}% roadmap</Badge>
          </>
        }
        actions={
          <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={exportSessions}>
            Export sessions
          </Button>
        }
      />

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'overview', label: 'Overview' },
          { value: 'study', label: 'Study' },
          { value: 'goals', label: 'Goals' },
          { value: 'monthly', label: 'Monthly' },
        ]}
      />

      {tab === 'overview' && (
        <div className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-3">
            <Card className="flex items-center gap-4 p-4">
              <ProgressRing value={overall} size={96} sublabel="overall" />
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wide text-content-muted">Weighted preparation</div>
                <div className="mt-1 flex items-center gap-1.5 text-sm">
                  <TrendingUp size={14} className="text-green-500" /> +{delta}% in the last 7 days
                </div>
                <Link to="/settings" className="mt-1 inline-block text-xs text-brand hover:underline">
                  Configure weights →
                </Link>
              </div>
            </Card>
            <Card className="p-4">
              <div className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wide text-content-muted">
                <TrendingDown size={13} /> Biggest weakness
              </div>
              <div className="text-lg font-semibold">{LABELS[weakest]}</div>
              <div className="mt-1 text-xs text-content-muted">Lowest weighted track at {buckets[weakest]}%. Schedule time here this week.</div>
              <div className="mt-3">
                <MetricBar label="Progress" value={buckets[weakest]} />
              </div>
            </Card>
            <Card className="p-4">
              <div className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wide text-content-muted">
                <TrendingUp size={13} /> Biggest improvement
              </div>
              <div className="text-lg font-semibold">{strongest === weakest ? LABELS[strongest] : LABELS[strongest]}</div>
              <div className="mt-1 text-xs text-content-muted">
                {improved ? `Most time logged in the last 7 days: ${LABELS[improved[0]]} (${formatMinutes(improved[1])}).` : 'Log study sessions to see which track is improving fastest.'}
              </div>
              <div className="mt-3">
                <MetricBar label="Strongest track" value={buckets[strongest]} />
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader title="Track readiness" subtitle="Weighted bars generated from stored values" icon={<Target size={16} />} />
            <div className="grid gap-x-6 p-4 lg:grid-cols-2">
              <ReadinessRow label="DSA" value={buckets.dsa} />
              <ReadinessRow label="Core CS" value={buckets.coreCs} />
              <ReadinessRow label="Development" value={buckets.development} />
              <ReadinessRow label="Design" value={buckets.design} />
              <ReadinessRow label="Interview" value={buckets.interview} />
              <ReadinessRow label="Projects" value={buckets.projects} />
            </div>
            <div className="border-t px-4 py-3 text-[11px] text-content-faint">
              Interview readiness blends interview-subject progress, question confidence and mock scores. Project readiness averages each project's interview checklist.
            </div>
          </Card>

          <div className="grid gap-3 lg:grid-cols-2">
            <ChartCard title="Roadmap adherence" subtitle="Expected vs completed tasks per week">
              <MultiLineChart
                data={store.roadmap.map((w, i) => ({
                  label: `W${w.weekNumber}`,
                  expected: Math.round(((i + 1) / store.roadmap.length) * 100),
                  completed: Math.round((store.roadmap.slice(0, i + 1).reduce((a, x) => a + x.tasks.filter((t) => t.done).length, 0) / Math.max(1, store.roadmap.reduce((a, x) => a + x.tasks.length, 0))) * 100),
                }))}
                series={[
                  { key: 'expected', color: '#94a3b8', label: 'Expected' },
                  { key: 'completed', color: '#6366f1', label: 'Completed' },
                ]}
              />
            </ChartCard>
            <ChartCard title="Subject completion" subtitle="Live progress per subject">
              <SimpleBarChart horizontal data={subjectBars} unit="%" />
            </ChartCard>
            <ChartCard title="Interview performance" subtitle={`${store.mocks.length} mock(s) · avg ${store.mocks.length ? Math.round(store.mocks.reduce((a, m) => a + m.score, 0) / store.mocks.length) : 0}%`}>
              <SimpleBarChart data={[...store.mocks].sort((a, b) => a.date.localeCompare(b.date)).map((m) => ({ label: formatDate(m.date).slice(0, 6), value: m.score }))} unit="%" />
            </ChartCard>
            <ChartCard title="Project readiness" subtitle="Checklist completion per project">
              <SimpleBarChart horizontal data={store.projects.map((p) => ({ label: p.name.length > 16 ? `${p.name.slice(0, 15)}…` : p.name, value: Math.round(projectReadiness(p)) }))} unit="%" />
            </ChartCard>
          </div>

          <Card>
            <CardHeader title="Study activity heatmap" subtitle={`${stats.activeDays} active days · ${formatMinutes(stats.totalMinutes)} total`} icon={<Flame size={16} />} />
            <div className="p-4">
              <Heatmap weeks={heat} />
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Study streak" value={`${streak.current}d`} hint={`Best ${streak.best}d`} icon={<Flame size={16} />} />
            <StatCard label="DSA streak" value={`${dStreak}d`} hint="Solves in a row" />
            <StatCard label="Revision completion" value={`${revisionCompletion}%`} hint={`${upcomingRevisions} due now`} progress={revisionCompletion} />
            <StatCard label="Problems solved" value={dsa.solvedTotal} hint={`${dsa.solvedThisMonth} this month`} />
          </div>
        </div>
      )}

      {tab === 'study' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="All time" value={formatMinutes(stats.totalMinutes)} />
            <StatCard label="This month" value={formatMinutes(stats.monthMinutes)} />
            <StatCard label="This week" value={formatMinutes(stats.weekMinutes)} hint={`Target ${store.settings.dailyTargetHours * 7}h`} />
            <StatCard label="Avg / active day" value={formatMinutes(stats.avgPerActiveDay)} />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <ChartCard title="Study hours per week" subtitle="Last 12 weeks">
              <ProgressAreaChart data={studyTrend} dataKey="hours" unit="h" />
            </ChartCard>
            <ChartCard title="Cumulative problems solved" subtitle="Includes historical import">
              <ProgressAreaChart data={dsaTrend} dataKey="solved" color="#22c55e" />
            </ChartCard>
            <ChartCard title="Weekly progress" subtitle="Hours and problems solved together">
              <MultiLineChart
                data={weeklyProgressSeries}
                series={[
                  { key: 'hours', color: '#6366f1', label: 'Hours' },
                  { key: 'problems', color: '#22c55e', label: 'Problems' },
                ]}
              />
            </ChartCard>
            <ChartCard title="Study time by subject" subtitle="All logged sessions">
              <DonutChart
                data={store.subjects
                  .filter((s) => !s.archived)
                  .map((s) => ({ label: s.name, value: Math.round(store.sessions.filter((x) => x.subjectId === s.id).reduce((a, x) => a + x.minutes, 0) / 60) }))
                  .filter((d) => d.value > 0)}
                unit="h"
              />
            </ChartCard>
          </div>

          <Card>
            <CardHeader title="Study log" subtitle="Most recent sessions" action={<Button size="sm" variant="ghost" icon={<Download size={14} />} onClick={exportSessions}>CSV</Button>} />
            <div className="divide-y">
              {[...store.sessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15).map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-2 text-xs">
                  <span className="w-20 shrink-0 text-content-muted">{formatDate(s.date)}</span>
                  <span className="min-w-0 flex-1 truncate">{store.subjects.find((x) => x.id === s.subjectId)?.name ?? 'General'}</span>
                  <Badge tone={CATEGORY_META[store.subjects.find((x) => x.id === s.subjectId)?.category ?? 'other'].tone}>{s.type.replace('-', ' ')}</Badge>
                  <span className="w-16 shrink-0 text-right tabular-nums">{formatMinutes(s.minutes)}</span>
                  <button onClick={() => store.deleteSession(s.id)} className="text-content-faint hover:text-red-500" aria-label="Delete session">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              {store.sessions.length === 0 && <p className="px-4 py-4 text-xs text-content-faint">No sessions logged yet.</p>}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-content-muted">
              <span className="font-medium text-content">Revision intervals in use:</span>
              {REVISION_INTERVALS.map((i) => (
                <Badge key={i} tone="slate">
                  {i}d
                </Badge>
              ))}
              <span className="ml-auto text-content-faint">Interview readiness: {interviewReadiness(store)}%</span>
            </div>
          </Card>
        </div>
      )}

      {tab === 'goals' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => {
                setEditingGoal(null);
                setGoalForm({ title: '', metric: 'dsa-solved', refId: '', target: 100, manualCurrent: 0, unit: 'problems', deadline: '', priority: 'medium' });
                setGoalOpen(true);
              }}
            >
              Add goal
            </Button>
          </div>
          {store.goals.length === 0 ? (
            <EmptyState title="No goals yet" message="Set a few measurable goals to keep the plan honest." icon={<Target size={20} />} />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {store.goals.map((g) => {
                const cur = goalCurrent(g, store);
                const value = g.target ? (cur / g.target) * 100 : 0;
                const meta = GOAL_METRIC_META[g.metric];
                return (
                  <Card key={g.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{g.title}</span>
                          <Badge tone={PRIORITY_META[g.priority].tone}>{PRIORITY_META[g.priority].label}</Badge>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-content-faint">
                          <Badge tone={meta.auto ? 'sage' : 'slate'}>{meta.label}</Badge>
                          <span>{g.deadline ? `Due ${formatDate(g.deadline)}` : 'No deadline'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="icon-sm" variant="ghost" onClick={() => { setEditingGoal(g); setGoalForm({ title: g.title, metric: g.metric, refId: g.refId ?? '', target: g.target, manualCurrent: g.manualCurrent, unit: g.unit, deadline: g.deadline ?? '', priority: g.priority }); setGoalOpen(true); }} aria-label="Edit goal">
                          <BarChart3 size={14} />
                        </Button>
                        <button onClick={() => setToDeleteGoal(g)} className="text-content-faint hover:text-red-500" aria-label="Delete goal">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3">
                      <MetricBar label={`${cur} / ${g.target} ${g.unit}`} value={value} />
                    </div>
                    {g.metric === 'manual' ? (
                      <div className="mt-2 flex items-center gap-2">
                        <Input type="number" value={g.manualCurrent} onChange={(e) => store.updateGoal(g.id, { manualCurrent: Number(e.target.value) })} className="py-1 text-xs" aria-label={`Progress for ${g.title}`} />
                        <Button size="sm" variant="secondary" onClick={() => store.updateGoal(g.id, { manualCurrent: Math.min(g.target, g.manualCurrent + 1) })}>
                          +1
                        </Button>
                      </div>
                    ) : (
                      <div className="mt-2 text-[11px] text-content-faint">Auto-tracked from your logged work.</div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'monthly' && (
        <div className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <ChartCard title="Monthly study hours" subtitle={`${monthly.prevMonth} vs ${monthly.thisMonth}`}>
              <SimpleBarChart
                data={[
                  { label: monthly.prevMonth, value: Math.round((monthly.minutesPrev / 60) * 10) / 10 },
                  { label: monthly.thisMonth, value: Math.round((monthly.minutesNow / 60) * 10) / 10 },
                ]}
                unit="h"
              />
            </ChartCard>
            <ChartCard title="Monthly problems solved" subtitle={`${monthly.prevMonth} vs ${monthly.thisMonth}`}>
              <SimpleBarChart
                data={[
                  { label: monthly.prevMonth, value: monthly.problemsPrev },
                  { label: monthly.thisMonth, value: monthly.problemsNow },
                ]}
                color="#22c55e"
              />
            </ChartCard>
          </div>

          <Card>
            <CardHeader title="Month over month" subtitle="Comparing the previous month with the current one" />
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'Study hours', now: monthly.minutesNow, prev: monthly.minutesPrev, fmt: (m: number) => formatMinutes(m) },
                { label: 'Problems solved', now: monthly.problemsNow, prev: monthly.problemsPrev, fmt: (m: number) => String(m) },
                { label: 'Mocks taken', now: store.mocks.filter((m) => m.date.startsWith(monthly.thisMonth)).length, prev: store.mocks.filter((m) => m.date.startsWith(monthly.prevMonth)).length, fmt: (m: number) => String(m) },
                { label: 'Sessions', now: store.sessions.filter((s) => s.date.startsWith(monthly.thisMonth)).length, prev: store.sessions.filter((s) => s.date.startsWith(monthly.prevMonth)).length, fmt: (m: number) => String(m) },
              ].map((row) => {
                const change = row.prev === 0 ? (row.now > 0 ? 100 : 0) : Math.round(((row.now - row.prev) / row.prev) * 100);
                return (
                  <div key={row.label} className="rounded-lg border p-3">
                    <div className="text-xs text-content-muted">{row.label}</div>
                    <div className="mt-1 text-xl font-semibold tabular-nums">{row.fmt(row.now)}</div>
                    <div className={cn('mt-1 flex items-center gap-1 text-[11px]', change >= 0 ? 'text-green-500' : 'text-amber-500')}>
                      {change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {change >= 0 ? '+' : ''}{change}% vs {row.fmt(row.prev)}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Goal progress snapshot</div>
                <div className="text-xs text-content-muted">Updated live from your goals</div>
              </div>
            </div>
            <div className="mt-3 space-y-3">
              {store.goals.map((g) => (
                <MetricBar key={g.id} label={g.title} value={g.target ? (goalCurrent(g, store) / g.target) * 100 : 0} right={`${goalCurrent(g, store)}/${g.target}`} />
              ))}
              {store.goals.length === 0 && <p className="text-xs text-content-faint">No goals set.</p>}
            </div>
          </Card>
        </div>
      )}

      <Modal
        open={goalOpen}
        onClose={() => setGoalOpen(false)}
        title={editingGoal ? 'Edit goal' : 'Add goal'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setGoalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveGoal}>
              Save goal
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Goal">
            <Input value={goalForm.title} onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })} placeholder="Solve 200 DSA problems" />
          </Field>
          <Field label="Tracked metric" hint="Auto metrics update from your real activity — no manual bookkeeping.">
            <Select value={goalForm.metric} onChange={(e) => { const m = e.target.value as GoalMetric; setGoalForm({ ...goalForm, metric: m, unit: GOAL_METRIC_META[m].unit, refId: '' }); }}>
              {GOAL_METRICS.map((m) => (
                <option key={m} value={m}>
                  {GOAL_METRIC_META[m].label}
                </option>
              ))}
            </Select>
          </Field>
          {goalForm.metric === 'subject-progress' && (
            <Field label="Subject">
              <Select value={goalForm.refId} onChange={(e) => setGoalForm({ ...goalForm, refId: e.target.value })}>
                <option value="">— pick a subject —</option>
                {store.subjects.filter((s) => !s.archived).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Target">
              <Input type="number" value={goalForm.target} onChange={(e) => setGoalForm({ ...goalForm, target: Number(e.target.value) })} />
            </Field>
            {goalForm.metric === 'manual' ? (
              <Field label="Current">
                <Input type="number" value={goalForm.manualCurrent} onChange={(e) => setGoalForm({ ...goalForm, manualCurrent: Number(e.target.value) })} />
              </Field>
            ) : (
              <Field label="Current" hint="Tracked automatically">
                <Input value="auto" disabled readOnly />
              </Field>
            )}
            <Field label="Unit">
              <Input value={goalForm.unit} onChange={(e) => setGoalForm({ ...goalForm, unit: e.target.value })} placeholder="problems" />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Deadline">
              <Input type="date" value={goalForm.deadline} onChange={(e) => setGoalForm({ ...goalForm, deadline: e.target.value })} />
            </Field>
            <Field label="Priority">
              <Select value={goalForm.priority} onChange={(e) => setGoalForm({ ...goalForm, priority: e.target.value as Priority })}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_META[p].label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDeleteGoal}
        title="Delete goal"
        message={`Delete "${toDeleteGoal?.title}"?`}
        onCancel={() => setToDeleteGoal(null)}
        onConfirm={() => {
          if (toDeleteGoal) {
            store.deleteGoal(toDeleteGoal.id);
            toast.push('Goal deleted', { tone: 'success', action: { label: 'Undo', onClick: () => store.undo() } });
          }
          setToDeleteGoal(null);
        }}
      />
    </div>
  );
}
