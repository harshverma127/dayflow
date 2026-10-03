import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { StudySession } from '@/types';
import {
  ArrowRight,
  BookOpen,
  Check,
  Clock,
  Code2,
  Flame,
  Plus,
  RotateCcw,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import { useStore } from '@/store';
import { useUi } from '@/uiStore';
import { Badge, Button, Card, ConfirmDialog, Input, ProgressRing, useToast } from '@/components/ui';
import { MetricBar, ReadinessRow } from '@/components/common';
import {
  activityGrouped,
  bucketProgress,
  computeStreak,
  currentWeek,
  dsaStats,
  dsaWeakness,
  insights,
  nextAction,
  onTrackAssessment,
  overallProgress,
  projectReadiness,
  roadmapStats,
  studyStats,
  subjectStats,
} from '@/lib/progress';
import { CATEGORY_META, MASTERY_STATUS_META } from '@/lib/constants';
import { cn, formatDate, formatMinutes, greeting, todayISO } from '@/lib/utils';

function relative(iso?: string): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export default function Dashboard() {
  const store = useStore();
  const navigate = useNavigate();
  const toast = useToast();
  const [newTask, setNewTask] = useState('');
  const [undoDelete, setUndoDelete] = useState<string | null>(null);
  const today = todayISO();

  // keep the local reference in sync if the store is hydrated with sessions
  // (the dashboard holds no sessions itself; all numbers come from useStore).
  const sessionsRef = useMemo(() => store.sessions as unknown as StudySession[], [store.sessions]);

  const overall = overallProgress(store);
  const buckets = bucketProgress(store);
  const dsa = dsaStats(store);
  const stats = studyStats(sessionsRef);
  const streak = computeStreak(sessionsRef);
  const roadmap = roadmapStats(store);
  const assessment = onTrackAssessment(store);
  const action = useMemo(() => nextAction(store), [store]);
  const facts = useMemo(() => insights(store, 5), [store]);
  const activity = useMemo(() => activityGrouped(store, 14), [store]);
  const weakness = useMemo(() => dsaWeakness(store, 3), [store]);

  const todayTasks = store.tasks.filter((t) => t.date === today);
  const doneToday = todayTasks.filter((t) => t.done).length;
  const missed = store.tasks.filter((t) => !t.done && t.date < today);
  const revisionsDue = store.revisions.filter((r) => !r.done && r.dueDate <= today);
  const dsaDue = store.dsaProblems.filter((p) => p.needsRevision && (p.nextRevisionAt ?? today) <= today);
  const dsaSessionMinutes = store.dsaSessions.filter((s) => s.date >= roadmap.week?.startDate!).reduce((a, s) => a + s.minutes, 0);

  const weekNumber = roadmap.week?.weekNumber ?? currentWeek(store.roadmap)?.weekNumber ?? 1;

  const continueLearning = store.subjects
    .filter((s) => !s.archived)
    .map((s) => ({ subject: s, stats: subjectStats(s, store.topics, store.sessions) }))
    .filter((x) => x.stats.started > 0 && x.stats.progress < 100)
    .sort((a, b) => (b.stats.lastStudied ?? '').localeCompare(a.stats.lastStudied ?? ''))
    .slice(0, 3);

  const lastDsaProblem = [...store.dsaProblems]
    .filter((p) => p.dateSolved || p.dateAttempted)
    .sort((a, b) => (b.dateSolved ?? b.dateAttempted ?? '').localeCompare(a.dateSolved ?? a.dateAttempted ?? ''))[0];
  const undoneProblems = store.dsaProblems.filter((p) => !p.attempted).length;
  const currentPattern = store.dsaPatterns.find((p) => p.id === lastDsaProblem?.patternId);

  const addTask = () => {
    if (!newTask.trim()) return;
    store.addTask({ title: newTask.trim(), date: today, tier: 'normal', priority: 'medium' });
    setNewTask('');
    toast.push('Added to today', { tone: 'success' });
  };

  const statusTone: Record<string, string> = { ahead: 'sage', 'on-track': 'sage', 'slightly-behind': 'sand', behind: 'clay' };

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {store.settings.name.trim() ? `${greeting()}, ${store.settings.name}` : greeting()}
          </h1>
          <p className="mt-1 text-sm text-content-muted">
            {formatDate(today)} · Week {weekNumber} of {roadmap.totalWeeks} · {roadmap.daysRemaining} days remaining
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone[assessment.level]}>{assessment.level.replace('-', ' ')}</Badge>
          <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => useUi.getState().setQuickAddOpen(true)}>
            Quick add
          </Button>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1.55fr_1fr]">
        {/* ---------------- left column ---------------- */}
        <div className="space-y-5">
          {/* Today's focus */}
          <section>
            <div className="mb-3 flex items-end justify-between">
              <div>
                <h2 className="text-sm font-semibold">Your focus today</h2>
                <p className="text-xs text-content-muted">
                  {doneToday}/{todayTasks.length} done · {formatMinutes(todayTasks.filter((t) => t.done).reduce((a, t) => a + t.estimatedMinutes, 0))} of{' '}
                  {formatMinutes(todayTasks.reduce((a, t) => a + t.estimatedMinutes, 0))}
                </p>
              </div>
              <Link to="/planner" className="text-xs text-content-muted hover:text-content">
                Open Today →
              </Link>
            </div>

            <div className="panel divide-y">
              {todayTasks.length === 0 && (
                <div className="flex flex-col items-start gap-2 p-4">
                  <p className="text-sm text-content-muted">Nothing planned for today yet.</p>
                  <Button size="sm" variant="secondary" icon={<Sparkles size={14} />} onClick={() => { const n = store.planDay(today); toast.push(n ? `Generated ${n} suggested task(s)` : 'Nothing new to suggest', { tone: 'success' }); }}>
                    Generate a suggested plan
                  </Button>
                </div>
              )}
              {todayTasks.map((t) => (
                <div key={t.id} className="flex items-start gap-3 px-3.5 py-2.5">
                  <button
                    onClick={() => store.toggleTask(t.id)}
                    aria-label={t.done ? `Mark ${t.title} as not done` : `Complete ${t.title}`}
                    className={cn(
                      'mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition-colors',
                      t.done ? 'animate-pop border-accent-sage bg-accent-sage text-white' : 'border-border hover:border-accent-sage/60',
                    )}
                  >
                    {t.done && <Check size={12} strokeWidth={3} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className={cn('text-sm', t.done && 'text-content-faint line-through')}>{t.title}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-content-faint">
                      <span>{t.estimatedMinutes}m</span>
                      {t.subjectId && <span>· {store.subjects.find((s) => s.id === t.subjectId)?.name}</span>}
                      {t.topicId && <span>· {store.topics.find((x) => x.id === t.topicId)?.name}</span>}
                      {t.auto && <Badge tone="slate">suggested</Badge>}
                    </div>
                  </div>
                  <button onClick={() => setUndoDelete(t.id)} className="text-[11px] text-content-faint hover:text-content">
                    remove
                  </button>
                </div>
              ))}
              <div className="flex gap-1.5 p-2.5">
                <Input value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTask()} placeholder="Add something to today…" className="py-1.5 text-xs" aria-label="New task" />
                <Button size="icon-sm" variant="secondary" onClick={addTask} aria-label="Add task">
                  <Plus size={14} />
                </Button>
              </div>
            </div>
          </section>

          {/* Continue learning */}
          <section>
            <div className="mb-3 flex items-end justify-between">
              <div>
                <h2 className="text-sm font-semibold">Continue learning</h2>
                <p className="text-xs text-content-muted">Pick up exactly where you stopped</p>
              </div>
              <Link to="/subjects" className="text-xs text-content-muted hover:text-content">
                All subjects →
              </Link>
            </div>
            <div className="space-y-2">
              {continueLearning.length === 0 && (
                <div className="quiet p-4 text-sm text-content-muted">
                  Nothing in progress. Open <Link to="/subjects" className="underline">Study</Link> to start a topic.
                </div>
              )}
              {continueLearning.map(({ subject, stats: st }) => {
                const ratio = st.completed;
                return (
                  <div key={subject.id} className="panel flex items-center gap-3 p-3.5">
                    <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: subject.color }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{subject.name}</span>
                        <Badge tone={CATEGORY_META[subject.category].tone}>{CATEGORY_META[subject.category].label}</Badge>
                      </div>
                      <div className="mt-0.5 text-xs text-content-muted">
                        {st.nextTopic ? (
                          <>
                            Next: <span className="text-content">{st.nextTopic.name}</span> · {ratio}/{st.total} topics done
                          </>
                        ) : (
                          `${ratio}/${st.total} topics done`
                        )}
                      </div>
                      <div className="mt-2">
                        <MetricBar label={`Last studied ${relative(st.lastStudied)}`} value={st.progress} color={subject.color} right={`${st.progress}%`} />
                      </div>
                    </div>
                    <Button size="sm" variant="secondary" icon={<ArrowRight size={14} />} onClick={() => navigate(`/subjects/${subject.id}`)}>
                      Continue
                    </Button>
                  </div>
                );
              })}

              {lastDsaProblem && (
                <div className="panel flex items-center gap-3 p-3.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-sky/10 text-accent-sky">
                    <Code2 size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">DSA Lab</span>
                      <Badge tone={MASTERY_STATUS_META[`${lastDsaProblem.mastered ? 'mastered' : lastDsaProblem.solved ? 'solved' : 'attempted'}`].tone}>
                        {lastDsaProblem.name}
                      </Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-content-muted">
                      {currentPattern ? currentPattern.name : 'Unassigned pattern'} · {undoneProblems} problems still in the backlog
                    </div>
                    <div className="mt-2">
                      <MetricBar label={`${dsa.solvedInApp}/${dsa.tracked} seeded problems solved`} value={dsa.tracked ? (dsa.solvedInApp / dsa.tracked) * 100 : 0} color="#54789c" right={`${dsa.independentRate}% independent`} />
                    </div>
                  </div>
                  <Button size="sm" variant="secondary" icon={<ArrowRight size={14} />} onClick={() => navigate('/dsa')}>
                    Continue
                  </Button>
                </div>
              )}
            </div>
          </section>

          {/* This week */}
          <section>
            <h2 className="mb-3 text-sm font-semibold">This week</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Study time', value: formatMinutes(stats.weekMinutes + dsaSessionMinutes), sub: `${formatMinutes(stats.todayMinutes)} today` },
                { label: 'Problems solved', value: dsa.solvedThisWeek, sub: `${dsa.solvedThisMonth} this month` },
                { label: 'Independent solves', value: dsa.independent, sub: `${dsa.independentRate}% rate` },
                { label: 'Streak', value: `${streak.current}d`, sub: `best ${streak.best}d` },
              ].map((m) => (
                <div key={m.label} className="panel p-3.5">
                  <div className="text-[11px] uppercase tracking-wide text-content-faint">{m.label}</div>
                  <div className="mt-1 text-lg font-semibold tabular-nums">{m.value}</div>
                  <div className="text-[11px] text-content-faint">{m.sub}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Activity */}
          <section>
            <h2 className="mb-3 text-sm font-semibold">Recent activity</h2>
            <div className="panel divide-y">
              {activity.length === 0 && <p className="p-4 text-sm text-content-muted">Nothing logged yet. Complete a subtopic or solve a problem and it will show up here.</p>}
              {activity.map(([day, items]) => (
                <div key={day}>
                  <div className="bg-surface-muted/60 px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-wide text-content-faint">{day}</div>
                  {items.map((a) => (
                    <div key={a.id} className="flex items-start gap-2.5 px-3.5 py-2">
                      <Check size={13} className="mt-0.5 shrink-0 text-accent-sage" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">{a.label}</div>
                        {a.detail && <div className="text-[11px] text-content-faint">{a.detail}</div>}
                      </div>
                      <span className="shrink-0 text-[11px] text-content-faint">{new Date(a.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ---------------- right column ---------------- */}
        <div className="space-y-5">
          {/* Overall */}
          <Card className="flex items-center gap-4 p-4">
            <ProgressRing value={overall} size={92} sublabel="overall" />
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide text-content-faint">Placement preparation</div>
              <p className="mt-1 text-xs leading-relaxed text-content-muted">{assessment.reason}</p>
              <Link to="/analytics" className="mt-1.5 inline-block text-xs text-content-muted underline hover:text-content">
                See what to fix
              </Link>
            </div>
          </Card>

          {/* Next action */}
          <Card className="p-4">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-content-faint">
              <Target size={12} /> Do this next
            </div>
            <div className="text-sm font-medium">{action.label}</div>
            <p className="mt-1 text-xs text-content-muted">{action.reason}</p>
            <Button variant="primary" size="sm" className="mt-3" icon={<ArrowRight size={14} />} onClick={() => navigate(action.to)}>
              Start
            </Button>
          </Card>

          {/* Revision */}
          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-content-faint">
                <RotateCcw size={12} /> Revision due
              </div>
              <Link to="/revision" className="text-xs text-content-muted hover:text-content">
                Open
              </Link>
            </div>
            <div className="flex items-baseline gap-4">
              <div>
                <div className="text-2xl font-semibold tabular-nums">{dsaDue.length}</div>
                <div className="text-[11px] text-content-faint">DSA problems</div>
              </div>
              <div>
                <div className="text-2xl font-semibold tabular-nums">{revisionsDue.length}</div>
                <div className="text-[11px] text-content-faint">topics</div>
              </div>
            </div>
            {revisionsDue.slice(0, 2).map((r) => (
              <button key={r.id} onClick={() => navigate('/revision')} className="mt-2 block w-full truncate rounded-lg px-2 py-1.5 text-left text-xs hover:bg-surface-muted">
                {r.label}
              </button>
            ))}
          </Card>

          {/* Readiness */}
          <Card className="p-4">
            <div className="mb-2 text-[11px] uppercase tracking-wide text-content-faint">Preparation by track</div>
            <div className="space-y-0.5">
              <ReadinessRow label="DSA" value={buckets.dsa} icon={<Code2 size={12} />} />
              <ReadinessRow label="Core CS" value={buckets.coreCs} icon={<BookOpen size={12} />} />
              <ReadinessRow label="Development" value={buckets.development} />
              <ReadinessRow label="LLD / System Design" value={buckets.design} />
              <ReadinessRow label="Projects" value={buckets.projects} />
              <ReadinessRow label="Interview" value={buckets.interview} />
            </div>
          </Card>

          {/* Insights */}
          <Card className="p-4">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-content-faint">
              <TrendingUp size={12} /> What the data says
            </div>
            <ul className="space-y-2">
              {facts.map((f, i) => (
                <li key={i} className="flex gap-2 text-xs leading-relaxed text-content-muted">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-content-faint" />
                  {f}
                </li>
              ))}
              {facts.length === 0 && <li className="text-xs text-content-muted">Log a few sessions to unlock insights.</li>}
            </ul>
          </Card>

          {/* DSA weakness */}
          {weakness.length > 0 && (
            <Card className="p-4">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-content-faint">
                <Flame size={12} /> DSA focus next
              </div>
              <div className="space-y-2.5">
                {weakness.map((w) => (
                  <button key={w.title} onClick={() => navigate(w.to)} className="block w-full rounded-lg border p-2.5 text-left transition-colors hover:bg-surface-muted">
                    <div className="flex items-center gap-2">
                      <Badge tone={w.severity === 'high' ? 'clay' : w.severity === 'medium' ? 'sand' : 'slate'}>{w.severity}</Badge>
                      <span className="truncate text-xs font-medium">{w.title}</span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-content-muted">{w.detail}</p>
                  </button>
                ))}
              </div>
            </Card>
          )}

          {/* Projects snapshot */}
          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-wide text-content-faint">Project readiness</div>
              <Link to="/projects" className="text-xs text-content-muted hover:text-content">
                Open
              </Link>
            </div>
            <div className="space-y-2.5">
              {store.projects.filter((p) => !p.archived).map((p) => (
                <MetricBar key={p.id} label={p.name} value={projectReadiness(p)} color={p.color} right={`${projectReadiness(p)}%`} />
              ))}
              {store.projects.length === 0 && <p className="text-xs text-content-muted">No projects yet.</p>}
            </div>
          </Card>

          {missed.length > 0 && (
            <Card className="p-4">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-content-faint">
                <Clock size={12} /> Rolled over
              </div>
              <div className="space-y-1.5">
                {missed.slice(0, 3).map((t) => (
                  <div key={t.id} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-xs">{t.title}</span>
                    <Button size="sm" variant="ghost" onClick={() => store.updateTask(t.id, { date: today })}>
                      Move to today
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!undoDelete}
        title="Remove this task?"
        message="It will be removed from today's plan. You can undo straight after."
        confirmLabel="Remove"
        onCancel={() => setUndoDelete(null)}
        onConfirm={() => {
          if (undoDelete) {
            store.deleteTask(undoDelete);
            toast.push('Task removed', { tone: 'success', action: { label: 'Undo', onClick: () => store.undo() } });
          }
          setUndoDelete(null);
        }}
      />
    </div>
  );
}
