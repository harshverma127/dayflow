import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Code2,
  ExternalLink,
  Filter,
  Layers,
  Plus,
  Repeat,
  Search,
  Sparkles,
  Star,
  Target,
  Timer,
  TrendingUp,
} from 'lucide-react';
import type { DSAProblem, Difficulty, RevisionConfidence } from '@/types';
import { parseDsaFile } from '@/lib/dsaImport';
import { useStore } from '@/store';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Modal,
  ProgressBar,
  ProgressRing,
  Select,
  Stars,
  StatCard,
  Tabs,
  Textarea,
  useToast,
} from '@/components/ui';
import { MetricBar, PageHeader } from '@/components/common';
import { ChartCard, DonutChart, SimpleBarChart } from '@/components/charts';
import {
  CONFIDENCE_LABELS,
  DIFFICULTIES,
  DIFFICULTY_META,
  MASTERY_FLAGS,
  MASTERY_STATUS_META,
  MISTAKE_META,
  MISTAKE_TYPES,
} from '@/lib/constants';
import { cn, addDaysISO, formatDateShort, formatMinutes, startOfWeekISO, todayISO } from '@/lib/utils';
import {
  currentDsaFocus,
  dsaStats,
  dsaWeakness,
  improvingPatterns,
  moduleStats,
  patternStats,
  problemStatus,
  statusLabel,
} from '@/lib/progress';
type Tab = 'overview' | 'roadmap' | 'problems' | 'patterns' | 'sessions';
type SortKey = 'recent' | 'oldest' | 'hardest' | 'confidence' | 'revision' | 'attempts';

const FLAG_KEYS = ['attempted', 'solved', 'understood', 'independent', 'mastered', 'needsRevision', 'hintUsed', 'editorialUsed', 'solutionWatched'] as const;
type FlagKey = (typeof FLAG_KEYS)[number];

interface ProblemForm {
  name: string;
  platform: string;
  number: string;
  url: string;
  moduleId: string;
  patternId: string;
  difficulty: Difficulty;
  confidence: number;
  timeTakenMinutes: number;
  attempts: number;
  dateSolved: string;
  mistake: string;
  keyInsight: string;
  timeComplexity: string;
  spaceComplexity: string;
  notes: string;
  flags: Record<FlagKey, boolean>;
}

const emptyFlags: Record<FlagKey, boolean> = {
  attempted: true,
  solved: true,
  understood: false,
  independent: false,
  mastered: false,
  needsRevision: false,
  hintUsed: false,
  editorialUsed: false,
  solutionWatched: false,
};

const REVIEW_OPTIONS: { value: RevisionConfidence; label: string; hint: string }[] = [
  { value: 'independent', label: 'Completely independently', hint: 'Confidence +1 · moves to the next interval' },
  { value: 'hint', label: 'Needed a small hint', hint: 'Confidence holds · schedule again soon' },
  { value: 'major-help', label: 'Needed major help', hint: 'Confidence −1 · repeats the interval' },
  { value: 'failed', label: 'Could not solve', hint: 'Confidence −2 · back a stage' },
];

function emptyForm(): ProblemForm {
  return {
    name: '',
    platform: 'LeetCode',
    number: '',
    url: '',
    moduleId: '',
    patternId: '',
    difficulty: 'medium',
    confidence: 3,
    timeTakenMinutes: 30,
    attempts: 1,
    dateSolved: todayISO(),
    mistake: '',
    keyInsight: '',
    timeComplexity: '',
    spaceComplexity: '',
    notes: '',
    flags: { ...emptyFlags },
  };
}

export default function DSA() {
  const store = useStore();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('overview');
  const [query, setQuery] = useState('');
  const [diffFilter, setDiffFilter] = useState<'all' | Difficulty>('all');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [masteryFilter, setMasteryFilter] = useState<'all' | 'unattempted' | 'needs-revision' | 'not-independent' | 'mastered'>('all');
  const [sort, setSort] = useState<SortKey>('recent');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<DSAProblem | null>(null);
  const [form, setForm] = useState<ProblemForm>(emptyForm);
  const [reviewFor, setReviewFor] = useState<DSAProblem | null>(null);
  const [sessionOpen, setSessionOpen] = useState(false);

  const stats = dsaStats(store);
  const modules = useMemo(() => moduleStats(store), [store]);
  const patterns = useMemo(() => patternStats(store), [store]);
  const focus = useMemo(() => currentDsaFocus(store), [store]);
  const weaknesses = useMemo(() => dsaWeakness(store, 4), [store]);
  const improving = useMemo(() => improvingPatterns(store, 4), [store]);

  const patternsByModule = useMemo(() => {
    const map = new Map<string, typeof patterns>();
    for (const p of patterns) {
      const arr = map.get(p.pattern.moduleId) ?? [];
      arr.push(p);
      map.set(p.pattern.moduleId, arr);
    }
    return map;
  }, [patterns]);

  const problems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = store.dsaProblems.filter((p) => {
      const pattern = store.dsaPatterns.find((x) => x.id === p.patternId);
      const topic = store.dsaTopics.find((x) => x.id === p.topicId);
      if (q && !`${p.name} ${pattern?.name ?? ''} ${topic?.name ?? ''} ${p.platform}`.toLowerCase().includes(q)) return false;
      if (diffFilter !== 'all' && p.difficulty !== diffFilter) return false;
      if (moduleFilter !== 'all' && p.moduleId !== moduleFilter) return false;
      if (masteryFilter === 'unattempted' && p.attempted) return false;
      if (masteryFilter === 'needs-revision' && !(p.needsRevision || p.nextRevisionAt)) return false;
      if (masteryFilter === 'not-independent' && !(p.solved && !p.independent)) return false;
      if (masteryFilter === 'mastered' && !p.mastered) return false;
      return true;
    });
    const byRank: Record<Difficulty, number> = { hard: 0, medium: 1, easy: 2 };
    return list.sort((a, b) => {
      switch (sort) {
        case 'oldest':
          return (a.dateSolved ?? '9999').localeCompare(b.dateSolved ?? '9999');
        case 'hardest':
          return byRank[a.difficulty] - byRank[b.difficulty];
        case 'confidence':
          return a.confidence - b.confidence;
        case 'revision':
          return (a.nextRevisionAt ?? '9999').localeCompare(b.nextRevisionAt ?? '9999');
        case 'attempts':
          return b.attempts - a.attempts;
        default:
          return (b.dateSolved ?? '').localeCompare(a.dateSolved ?? '');
      }
    });
  }, [store, query, diffFilter, moduleFilter, masteryFilter, sort]);

  const weekly = useMemo(() => {
    const out: { label: string; value: number }[] = [];
    for (let i = 9; i >= 0; i--) {
      const ws = addDaysISO(startOfWeekISO(), -i * 7);
      const we = addDaysISO(ws, 6);
      out.push({ label: ws.slice(5), value: store.dsaProblems.filter((p) => p.dateSolved && p.dateSolved >= ws && p.dateSolved <= we).length });
    }
    return out;
  }, [store.dsaProblems]);

  const today = todayISO();
  const currentModule = modules.find((m) => m.name === focus.module);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setEditorOpen(true);
  };

  const openEdit = (p: DSAProblem) => {
    setEditing(p);
    setForm({
      name: p.name,
      platform: p.platform,
      number: p.number ?? '',
      url: p.url ?? '',
      moduleId: p.moduleId ?? '',
      patternId: p.patternId ?? '',
      difficulty: p.difficulty,
      confidence: p.confidence,
      timeTakenMinutes: p.timeTakenMinutes ?? 30,
      attempts: p.attempts,
      dateSolved: p.dateSolved ?? todayISO(),
      mistake: p.mistake ?? '',
      keyInsight: p.keyInsight ?? '',
      timeComplexity: p.timeComplexity ?? '',
      spaceComplexity: p.spaceComplexity ?? '',
      notes: p.notes ?? '',
      flags: {
        attempted: p.attempted,
        solved: p.solved,
        understood: p.understood,
        independent: p.independent,
        mastered: p.mastered,
        needsRevision: p.needsRevision,
        hintUsed: p.hintUsed,
        editorialUsed: p.editorialUsed,
        solutionWatched: p.solutionWatched,
      },
    });
    setEditorOpen(true);
  };

  const save = () => {
    if (!form.name.trim()) {
      toast.push('Problem name is required', { tone: 'error' });
      return;
    }
    const pattern = store.dsaPatterns.find((p) => p.id === form.patternId);
    const payload = {
      name: form.name.trim(),
      platform: form.platform.trim() || 'LeetCode',
      number: form.number.trim() || undefined,
      url: form.url.trim() || undefined,
      moduleId: pattern?.moduleId,
      topicId: pattern?.topicId,
      patternId: pattern?.id,
      difficulty: form.difficulty,
      confidence: form.confidence,
      timeTakenMinutes: form.timeTakenMinutes,
      attempts: form.attempts,
      dateSolved: form.flags.solved ? form.dateSolved : undefined,
      mistake: form.mistake.trim() || undefined,
      keyInsight: form.keyInsight.trim() || undefined,
      timeComplexity: form.timeComplexity.trim() || undefined,
      spaceComplexity: form.spaceComplexity.trim() || undefined,
      notes: form.notes.trim() || undefined,
      ...form.flags,
    };
    if (editing) {
      store.updateProblem(editing.id, payload);
      toast.push('Problem updated', { tone: 'success' });
    } else {
      store.addProblem(payload);
      toast.push('Problem added to the question bank', { tone: 'success' });
    }
    setEditorOpen(false);
  };

  const continueFocus = () => {
    setTab('problems');
    setMasteryFilter('all');
    setModuleFilter(currentModule?.id ?? 'all');
    setSort('recent');
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="DSA Lab"
        description="Build your own DSA roadmap — modules, topics, patterns and problems"
        meta={<></>}
        actions={
          <>
            <Button variant="secondary" icon={<Timer size={15} />} onClick={() => setSessionOpen(true)}>
              Log session
            </Button>
            <Button variant="primary" icon={<Plus size={15} />} onClick={openCreate}>
              Add problem
            </Button>
          </>
        }
      />

      <div className="space-y-4">
        {store.dsaProblems.length === 0 && store.dsaModules.length === 0 ? (
          <EmptyState
            title="Your DSA Lab is empty"
            message="No modules, topics or problems yet. Build your own roadmap here, or import a curated question list."
            icon={<Code2 size={32} />}
            action={
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" icon={<Plus size={15} />} onClick={openCreate}>Add problem</Button>
                <Button variant="primary" icon={<Layers size={15} />} onClick={() => (window as unknown as { addDsaPattern: (p: { moduleName: string; topicName: string; patternName: string }) => void }).addDsaPattern({ moduleName: 'My module', topicName: 'My topic', patternName: 'My pattern' })}>
                  Add module / pattern
                </Button>
                <Button variant="primary" icon={<Layers size={15} />} onClick={() => document.getElementById('dsa-import')?.click()}>Import</Button>
              </div>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Solved" value={stats.solvedTotal} hint={`${stats.solvedInApp} tracked here`} icon={<Code2 size={16} />} />
            <StatCard label="This week" value={stats.solvedThisWeek} hint={`${stats.solvedThisMonth} this month`} icon={<TrendingUp size={16} />} />
            <StatCard label="Independent" value={`${stats.independentRate}%`} hint={`${stats.independent} solved alone`} icon={<Target size={16} />} />
            <StatCard label="Mastered" value={stats.mastered} hint="could explain again" icon={<CheckCircle2 size={16} />} />
            <StatCard label="Avg confidence" value={`${stats.avgConfidence.toFixed(1)}/5`} hint="across the bank" icon={<Star size={16} />} />
            <StatCard label="Revision due" value={stats.revisionBacklog} hint={`${stats.needsRevision} flagged`} icon={<Repeat size={16} />} />
          </div>
        )}

        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'overview', label: 'Overview' },
            { value: 'roadmap', label: 'A2Z Roadmap', count: modules.length },
            { value: 'problems', label: 'Question bank', count: problems.length },
            { value: 'patterns', label: 'Pattern strength', count: patterns.length },
            { value: 'sessions', label: 'Sessions', count: store.dsaSessions.length },
          ]}
        />
      </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Solved" value={stats.solvedTotal} hint={`${stats.solvedInApp} tracked here`} icon={<Code2 size={16} />} />
          <StatCard label="This week" value={stats.solvedThisWeek} hint={`${stats.solvedThisMonth} this month`} icon={<TrendingUp size={16} />} />
          <StatCard label="Independent" value={`${stats.independentRate}%`} hint={`${stats.independent} solved alone`} icon={<Target size={16} />} />
          <StatCard label="Mastered" value={stats.mastered} hint="could explain again" icon={<CheckCircle2 size={16} />} />
          <StatCard label="Avg confidence" value={`${stats.avgConfidence.toFixed(1)}/5`} hint="across the bank" icon={<Star size={16} />} />
          <StatCard label="Revision due" value={stats.revisionBacklog} hint={`${stats.needsRevision} flagged`} icon={<Repeat size={16} />} />
        </div>
      )

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'overview', label: 'Overview' },
          { value: 'roadmap', label: 'A2Z Roadmap', count: modules.length },
          { value: 'problems', label: 'Question bank', count: problems.length },
          { value: 'patterns', label: 'Pattern strength', count: patterns.length },
          { value: 'sessions', label: 'Sessions', count: store.dsaSessions.length },
        ]}
      />

      {tab === 'overview' && (
        <div className="grid gap-3 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              <ProgressRing value={stats.tracked ? (stats.solvedTotal / stats.tracked) * 100 : 0} size={92} stroke={8} label="A2Z" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">
                  {stats.solvedTotal} / {stats.tracked} problems solved
                </div>
                <p className="mt-0.5 text-xs text-content-muted">
                  The denominator is the number of real problems seeded from the A2Z curriculum — it grows when you import a newer sheet.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <Badge tone="lavender">Current section · {focus.module ?? '—'}</Badge>
                  {focus.pattern && <Badge tone="sky">Pattern · {focus.pattern}</Badge>}
                </div>
                <Button variant="secondary" size="sm" className="mt-3" icon={<ChevronRight size={14} />} onClick={continueFocus}>
                  Continue this section
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="This week" subtitle="DSA momentum" icon={<Timer size={16} />} />
            <div className="space-y-3 p-4">
              <MetricBar label="Problems solved" value={stats.solvedThisWeek} right={`${stats.solvedThisWeek}`} sub="new solves logged" />
              <MetricBar label="Independent solve rate" value={stats.independentRate} sub={`${stats.independent} of ${stats.solvedInApp} tracked solves`} />
              <MetricBar label="Average confidence" value={(stats.avgConfidence / 5) * 100} right={`${stats.avgConfidence.toFixed(1)}/5`} />
              <MetricBar label="Revision backlog" value={stats.tracked ? Math.min(100, stats.revisionBacklog * 10) : 0} right={`${stats.revisionBacklog}`} sub="due or overdue" />
            </div>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader title="Focus next" subtitle="Data-driven weaknesses" icon={<AlertTriangle size={16} />} />
            <div className="space-y-2 p-4">
              {weaknesses.length === 0 && <p className="text-xs text-content-faint">Solve a few problems to surface weaknesses.</p>}
              {weaknesses.map((w) => (
                <div key={w.title} className="flex items-start gap-3 rounded-lg border p-3">
                  <span
                    className={cn(
                      'mt-1 h-2 w-2 shrink-0 rounded-full',
                      w.severity === 'high' ? 'bg-accent-clay' : w.severity === 'medium' ? 'bg-accent-sand' : 'bg-accent-sky',
                    )}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{w.title}</div>
                    <p className="text-xs text-content-muted">{w.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="You are improving in" subtitle="Recent mastery" icon={<Sparkles size={16} />} />
            <div className="space-y-3 p-4">
              {improving.length === 0 && <p className="text-xs text-content-faint">Master a problem in a pattern to see it here.</p>}
              {improving.map((p) => (
                <MetricBar
                  key={p.pattern.id}
                  label={p.pattern.name}
                  value={((p.strength ?? 0) / 5) * 100}
                  right={`${(p.strength ?? 0).toFixed(1)}/5`}
                  sub={`${p.mastered} mastered · ${p.solved}/${p.total} solved`}
                />
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === 'roadmap' && (
        <div className="space-y-2">
          {modules.map((m) => {
            const isOpen = expanded[m.id];
            const mp = patternsByModule.get(m.id) ?? [];
            return (
              <Card key={m.id} className="overflow-hidden">
                <button
                  className="flex w-full items-center gap-3 p-3.5 text-left transition-colors hover:bg-surface-muted/60"
                  onClick={() => setExpanded((e) => ({ ...e, [m.id]: !e[m.id] }))}
                  aria-expanded={!!isOpen}
                >
                  {isOpen ? <ChevronDown size={16} className="shrink-0 text-content-faint" /> : <ChevronRight size={16} className="shrink-0 text-content-faint" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">{m.name}</span>
                      {m.progress >= 100 ? <Badge tone="sage">done</Badge> : m.patternsStarted > 0 ? <Badge tone="lavender">{Math.round(m.progress)}%</Badge> : null}
                    </div>
                    <div className="mt-1 hidden text-[11px] text-content-faint sm:block">
                      {m.patternsStarted}/{m.patterns} patterns started · {m.solved} solved · {m.independent} independent · {m.revisionDue} to revise
                    </div>
                  </div>
                  <div className="w-24 shrink-0 sm:w-40">
                    <ProgressBar value={m.progress} size="sm" />
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t bg-surface-muted/30 p-3">
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {mp.map((p) => (
                        <div key={p.pattern.id} className="rounded-lg border bg-surface p-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-xs font-medium">{p.pattern.name}</span>
                            <span className="shrink-0 text-[11px] tabular-nums text-content-faint">{p.strength === null ? '—' : `${p.strength.toFixed(1)}/5`}</span>
                          </div>
                          <div className="mt-1.5">
                            <ProgressBar value={p.coverage} size="sm" />
                          </div>
                          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-content-faint">
                            <span>
                              {p.solved}/{p.total} solved
                            </span>
                            {p.independent > 0 && <span>· {p.independent} solo</span>}
                            {p.revisionDue > 0 && <span className="text-accent-sand">· {p.revisionDue} revise</span>}
                          </div>
                        </div>
                      ))}
                      {mp.length === 0 && <p className="text-xs text-content-faint">No patterns seeded for this module yet.</p>}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {tab === 'problems' && (
        <>
          <Card className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-content-faint" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, pattern or topic…" className="pl-8" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={diffFilter} onChange={(e) => setDiffFilter(e.target.value as typeof diffFilter)} className="w-auto py-1.5 text-xs" ariaLabel="Difficulty">
                <option value="all">All difficulty</option>
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {DIFFICULTY_META[d].label}
                  </option>
                ))}
              </Select>
              <Select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className="w-auto py-1.5 text-xs" ariaLabel="Module">
                <option value="all">All modules</option>
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
              <Select value={masteryFilter} onChange={(e) => setMasteryFilter(e.target.value as typeof masteryFilter)} className="w-auto py-1.5 text-xs" ariaLabel="Mastery">
                <option value="all">Any status</option>
                <option value="unattempted">Not attempted</option>
                <option value="needs-revision">Needs revision</option>
                <option value="not-independent">Not independent</option>
                <option value="mastered">Mastered</option>
              </Select>
              <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="w-auto py-1.5 text-xs" ariaLabel="Sort">
                <option value="recent">Recently solved</option>
                <option value="oldest">Oldest</option>
                <option value="hardest">Hardest</option>
                <option value="confidence">Lowest confidence</option>
                <option value="revision">Revision due</option>
                <option value="attempts">Most attempts</option>
              </Select>
            </div>
          </Card>

          {problems.length === 0 ? (
            <EmptyState
              title="No problems match"
              message="Loosen the filters or add your first problem."
              icon={<Filter size={20} />}
              action={
                <Button variant="primary" icon={<Plus size={15} />} onClick={openCreate}>
                  Add problem
                </Button>
              }
            />
          ) : (
            <>
              <Card className="hidden overflow-hidden md:block">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-surface-muted/60 text-left text-xs text-content-muted">
                        <th className="px-3 py-2 font-medium">Problem</th>
                        <th className="px-3 py-2 font-medium">Pattern</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium">Mastery</th>
                        <th className="px-3 py-2 font-medium">Confidence</th>
                        <th className="px-3 py-2 font-medium">Revision</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {problems.map((p) => {
                        const pattern = store.dsaPatterns.find((x) => x.id === p.patternId);
                        const due = p.nextRevisionAt && p.nextRevisionAt <= today;
                        return (
                          <tr key={p.id} className="align-top hover:bg-surface-muted/50">
                            <td className="max-w-[260px] px-3 py-2">
                              <div className="flex items-center gap-2">
                                {p.url ? (
                                  <a href={p.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 truncate font-medium text-brand hover:underline">
                                    {p.name}
                                    <ExternalLink size={11} className="shrink-0" />
                                  </a>
                                ) : (
                                  <span className="truncate font-medium">{p.name}</span>
                                )}
                              </div>
                              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-content-faint">
                                <Badge tone={DIFFICULTY_META[p.difficulty].tone}>{DIFFICULTY_META[p.difficulty].label}</Badge>
                                <span>
                                  {p.platform}
                                  {p.number ? ` #${p.number}` : ''}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-xs text-content-muted">{pattern?.name ?? '—'}</td>
                            <td className="px-3 py-2">
                              <Badge tone={MASTERY_STATUS_META[problemStatus(p)].tone}>{statusLabel(p)}</Badge>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex flex-wrap gap-1">
                                {MASTERY_FLAGS.map((f) => (
                                  <button
                                    key={f.key}
                                    title={f.hint}
                                    onClick={() => store.toggleProblemFlag(p.id, f.key as FlagKey)}
                                    className={cn(
                                      'rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset transition-colors',
                                      p[f.key] ? 'bg-accent-sage/15 text-accent-sage ring-accent-sage/30' : 'bg-surface-muted text-content-faint ring-border hover:text-content',
                                    )}
                                  >
                                    {f.label}
                                  </button>
                                ))}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <Stars value={p.confidence} onChange={(v) => store.setConfidence('problem', { topicId: p.id }, v)} />
                            </td>
                            <td className="px-3 py-2 text-xs">
                              {p.nextRevisionAt ? (
                                <span className={due ? 'text-accent-sand' : 'text-content-muted'}>{formatDateShort(p.nextRevisionAt)}</span>
                              ) : (
                                <span className="text-content-faint">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => setReviewFor(p)}>
                                  Review
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                                  Edit
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>

              <div className="space-y-2 md:hidden">
                {problems.map((p) => {
                  const pattern = store.dsaPatterns.find((x) => x.id === p.patternId);
                  return (
                    <Card key={p.id} className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{p.name}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-content-faint">
                            <Badge tone={DIFFICULTY_META[p.difficulty].tone}>{DIFFICULTY_META[p.difficulty].label}</Badge>
                            <span>{pattern?.name ?? 'No pattern'}</span>
                          </div>
                        </div>
                        <span className="shrink-0 text-[11px] text-content-faint">{statusLabel(p)}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {MASTERY_FLAGS.map((f) => (
                          <button
                            key={f.key}
                            onClick={() => store.toggleProblemFlag(p.id, f.key as FlagKey)}
                            className={cn(
                              'rounded-md px-2 py-1 text-[10px] font-medium ring-1 ring-inset',
                              p[f.key] ? 'bg-accent-sage/15 text-accent-sage ring-accent-sage/30' : 'bg-surface-muted text-content-faint ring-border',
                            )}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <Stars value={p.confidence} onChange={(v) => store.setConfidence('problem', { topicId: p.id }, v)} />
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setReviewFor(p)}>
                            Review
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                            Edit
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {tab === 'patterns' && (
        <div className="grid gap-3 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title="Pattern strength" subtitle="Confidence + independent solves + mastery — not just problems solved" icon={<Layers size={16} />} />
            <div className="space-y-3 p-4">
              {[...patterns]
                .filter((p) => p.total > 0)
                .sort((a, b) => (a.strength ?? 0) - (b.strength ?? 0))
                .map((p) => (
                  <MetricBar
                    key={p.pattern.id}
                    label={`${p.pattern.name}`}
                    value={((p.strength ?? 0) / 5) * 100}
                    right={p.strength === null ? '—' : `${p.strength.toFixed(1)}/5`}
                    sub={`${p.moduleName} · ${p.solved}/${p.total} solved · ${p.independent} independent${p.revisionDue ? ` · ${p.revisionDue} revise` : ''}`}
                  />
                ))}
            </div>
          </Card>
          <ChartCard title="Difficulty split" subtitle="Tracked problems">
            <DonutChart
              data={[
                { label: 'Easy', value: stats.byDifficulty.easy },
                { label: 'Medium', value: stats.byDifficulty.medium },
                { label: 'Hard', value: stats.byDifficulty.hard },
              ]}
            />
          </ChartCard>
          <ChartCard title="Mastery distribution" subtitle="How well you own the bank" className="lg:col-span-3">
            <SimpleBarChart
              horizontal
              data={[
                { label: 'Solved', value: stats.solvedInApp },
                { label: 'Understood', value: stats.understood },
                { label: 'Independent', value: stats.independent },
                { label: 'Mastered', value: stats.mastered },
                { label: 'Solved with help', value: stats.neverIndependent },
              ]}
            />
          </ChartCard>
        </div>
      )}

      {tab === 'sessions' && (
        <div className="grid gap-3 lg:grid-cols-3">
          <ChartCard title="Problems solved per week" subtitle="Last 10 weeks" className="lg:col-span-2">
            <SimpleBarChart data={weekly} />
          </ChartCard>
          <ChartCard title="Logged practice" subtitle="DSA session minutes">
            <DonutChart data={store.dsaSessions.slice(-6).map((s) => ({ label: formatDateShort(s.date), value: s.minutes }))} unit="m" />
          </ChartCard>
          <Card className="lg:col-span-3">
            <CardHeader
              title="DSA sessions"
              subtitle={`${store.dsaSessions.length} logged`}
              icon={<Timer size={16} />}
              action={
                <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => setSessionOpen(true)}>
                  Log session
                </Button>
              }
            />
            <div className="divide-y">
              {[...store.dsaSessions]
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 30)
                .map((s) => (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="w-24 shrink-0">
                      <div className="text-xs font-medium">{formatDateShort(s.date)}</div>
                      <div className="text-[11px] text-content-faint">{formatMinutes(s.minutes)}</div>
                    </div>
                    <div className="min-w-0 flex-1 text-xs text-content-muted">
                      {s.notes ?? `${s.attempted} attempted · ${s.solved} solved · ${s.revised} revised`}
                    </div>
                    <div className="hidden shrink-0 gap-3 text-[11px] text-content-faint sm:flex">
                      <span>{s.solved} solved</span>
                      <span>{s.independentSolves} solo</span>
                      {s.revised > 0 && <span>{s.revised} revised</span>}
                    </div>
                  </div>
                ))}
              {store.dsaSessions.length === 0 && <div className="px-4 py-6 text-center text-xs text-content-faint">No DSA sessions yet. Log your first one.</div>}
            </div>
          </Card>
        </div>
      )}

      {/* Review flow */}
      <Modal open={!!reviewFor} onClose={() => setReviewFor(null)} title={reviewFor ? `Revision — ${reviewFor.name}` : ''} size="sm">
        {reviewFor && (
          <div className="space-y-3">
            <p className="text-xs text-content-muted">
              Could you solve this again today? Stage {reviewFor.revisionStage + 1} · confidence {reviewFor.confidence}/5
              {reviewFor.nextRevisionAt ? ` · due ${formatDateShort(reviewFor.nextRevisionAt)}` : ''}
            </p>
            {REVIEW_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => {
                  store.reviewProblem(reviewFor.id, o.value);
                  toast.push('Revision recorded', { tone: 'success' });
                  setReviewFor(null);
                }}
                className="w-full rounded-lg border px-3 py-2.5 text-left transition-colors hover:border-content/25 hover:bg-surface-muted"
              >
                <div className="text-sm font-medium">{o.label}</div>
                <div className="text-[11px] text-content-faint">{o.hint}</div>
              </button>
            ))}
          </div>
        )}
      </Modal>

      <input
        id="dsa-import"
        type="file"
        accept=".json,.csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const { rows, errors } = parseDsaFile(file.name, String(reader.result));
              if (!rows.length) {
                toast.push(errors.join(' ') || 'No problems found in that file', { tone: 'error' });
                return;
              }
              const result = store.importDsaRows(rows);
              toast.push(`Imported ${result.problems} problem(s)` + (result.skipped ? ` · ${result.skipped} skipped` : ''), { tone: 'success' });
              if (errors.length) toast.push(errors.join(' '), { tone: 'error' });
            } catch {
              toast.push('Could not read that file as a DSA import', { tone: 'error' });
            }
          };
          reader.onerror = () => toast.push('Failed to read the file', { tone: 'error' });
          reader.readAsText(file);
        }}
      />

      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editing ? 'Edit problem' : 'Add DSA problem'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            {editing && (
              <Button
                variant="danger"
                onClick={() => {
                  store.deleteProblem(editing.id);
                  toast.push('Problem deleted', { tone: 'success' });
                  setEditorOpen(false);
                }}
              >
                Delete
              </Button>
            )}
            <Button variant="primary" onClick={save}>
              {editing ? 'Save changes' : 'Add problem'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Problem name" className="sm:col-span-2">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Koko Eating Bananas" />
            </Field>
            <Field label="Platform">
              <Input value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} />
            </Field>
            <Field label="Problem number">
              <Input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
            </Field>
            <Field label="URL" className="sm:col-span-2" hint="Leave blank to auto-generate a LeetCode/GfG link from the name.">
              <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" />
            </Field>
            <Field label="Module">
              <Select
                value={form.moduleId}
                onChange={(e) => {
                  const moduleId = e.target.value;
                  setForm({ ...form, moduleId, patternId: '' });
                }}
              >
                <option value="">— none —</option>
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Pattern">
              <Select value={form.patternId} onChange={(e) => setForm({ ...form, patternId: e.target.value })}>
                <option value="">— none —</option>
                {patterns
                  .filter((p) => !form.moduleId || p.pattern.moduleId === form.moduleId)
                  .map((p) => (
                    <option key={p.pattern.id} value={p.pattern.id}>
                      {p.topicName} · {p.pattern.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Difficulty">
              <Select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value as Difficulty })}>
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {DIFFICULTY_META[d].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Time taken (minutes)">
              <Input type="number" min={1} value={form.timeTakenMinutes} onChange={(e) => setForm({ ...form, timeTakenMinutes: Number(e.target.value) })} />
            </Field>
            <Field label="Attempts">
              <Input type="number" min={1} value={form.attempts} onChange={(e) => setForm({ ...form, attempts: Number(e.target.value) })} />
            </Field>
            <Field label="Date solved">
              <Input type="date" value={form.dateSolved} onChange={(e) => setForm({ ...form, dateSolved: e.target.value })} />
            </Field>
          </div>

          <div className="rounded-lg border p-3">
            <div className="mb-2 text-xs font-medium text-content-muted">Mastery — separate dimensions, not one rigid status</div>
            <div className="flex flex-wrap gap-3 text-sm">
              {MASTERY_FLAGS.map((f) => (
                <label key={f.key} className="flex items-center gap-2" title={f.hint}>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[rgb(var(--accent-sage))]"
                    checked={form.flags[f.key as FlagKey]}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      const next = { ...form.flags, [f.key]: checked };
                      if (f.key === 'solved' && checked) next.attempted = true;
                      if (f.key === 'mastered' && checked) {
                        next.solved = true;
                        next.understood = true;
                        next.independent = true;
                        next.needsRevision = false;
                      }
                      setForm({ ...form, flags: next });
                    }}
                  />
                  {f.label}
                </label>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-3 border-t pt-2 text-sm">
              {(['hintUsed', 'editorialUsed', 'solutionWatched'] as const).map((k) => (
                <label key={k} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[rgb(var(--accent-peach))]"
                    checked={form.flags[k]}
                    onChange={(e) => setForm({ ...form, flags: { ...form.flags, [k]: e.target.checked } })}
                  />
                  {k === 'hintUsed' ? 'Hint used' : k === 'editorialUsed' ? 'Editorial used' : 'Solution watched'}
                </label>
              ))}
            </div>
          </div>

          <Field label={`Confidence — ${CONFIDENCE_LABELS[form.confidence]}`}>
            <Stars value={form.confidence} onChange={(v) => setForm({ ...form, confidence: v })} size={20} />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Key insight">
              <Input value={form.keyInsight} onChange={(e) => setForm({ ...form, keyInsight: e.target.value })} placeholder="The idea that unlocked it" />
            </Field>
            <Field label="Mistake category">
              <Select value={form.mistake} onChange={(e) => setForm({ ...form, mistake: e.target.value })}>
                <option value="">— none —</option>
                {MISTAKE_TYPES.map((m) => (
                  <option key={m} value={m}>
                    {MISTAKE_META[m].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Time complexity">
              <Input value={form.timeComplexity} onChange={(e) => setForm({ ...form, timeComplexity: e.target.value })} placeholder="O(n log n)" />
            </Field>
            <Field label="Space complexity">
              <Input value={form.spaceComplexity} onChange={(e) => setForm({ ...form, spaceComplexity: e.target.value })} placeholder="O(1)" />
            </Field>
          </div>

          <Field label="Notes">
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <SessionModal open={sessionOpen} onClose={() => setSessionOpen(false)} />
    </div>
  );
}

function SessionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const store = useStore();
  const toast = useToast();
  const [date, setDate] = useState(todayISO());
  const [minutes, setMinutes] = useState(90);
  const [moduleId, setModuleId] = useState('');
  const [patternId, setPatternId] = useState('');
  const [attempted, setAttempted] = useState(3);
  const [solved, setSolved] = useState(2);
  const [independent, setIndependent] = useState(1);
  const [revised, setRevised] = useState(0);
  const [notes, setNotes] = useState('');

  const modules = [...store.dsaModules].sort((a, b) => a.order - b.order);
  const patterns = store.dsaPatterns.filter((p) => !moduleId || p.moduleId === moduleId);

  const submit = () => {
    store.addDsaSession({
      date,
      minutes,
      moduleId: moduleId || undefined,
      patternId: patternId || undefined,
      attempted,
      solved,
      independentSolves: independent,
      revised,
      notes: notes.trim() || undefined,
    });
    toast.push('DSA session logged', { tone: 'success' });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log a DSA session"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            Save session
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Duration (minutes)">
          <Input type="number" min={5} step={5} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
        </Field>
        <Field label="Module">
          <Select value={moduleId} onChange={(e) => { setModuleId(e.target.value); setPatternId(''); }}>
            <option value="">— none —</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Pattern">
          <Select value={patternId} onChange={(e) => setPatternId(e.target.value)}>
            <option value="">— none —</option>
            {patterns.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Attempted">
          <Input type="number" min={0} value={attempted} onChange={(e) => setAttempted(Number(e.target.value))} />
        </Field>
        <Field label="Solved">
          <Input type="number" min={0} value={solved} onChange={(e) => setSolved(Number(e.target.value))} />
        </Field>
        <Field label="Independent solves">
          <Input type="number" min={0} value={independent} onChange={(e) => setIndependent(Number(e.target.value))} />
        </Field>
        <Field label="Problems revised">
          <Input type="number" min={0} value={revised} onChange={(e) => setRevised(Number(e.target.value))} />
        </Field>
        <Field label="Result notes" className="sm:col-span-2">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="2 independent · 1 with hint · 2 marked for revision" />
        </Field>
      </div>
    </Modal>
  );
}
