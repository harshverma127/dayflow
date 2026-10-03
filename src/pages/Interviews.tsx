import { useMemo, useState } from 'react';
import { Building2, ChevronDown, MessagesSquare, Plus, Sparkles, Target, Trash2, Video } from 'lucide-react';
import { useStore } from '@/store';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Stars,
  StatCard,
  Tabs,
  Textarea,
  useToast,
} from '@/components/ui';
import { CheckRow, MetricBar, PageHeader } from '@/components/common';
import { ChartCard, SimpleBarChart } from '@/components/charts';
import {
  COMPANY_AREAS,
  DIFFICULTIES,
  DIFFICULTY_META,
  INTERVIEW_CATEGORIES,
  MOCK_TYPES,
  MOCK_TYPE_META,
  STAR_TEMPLATES,
} from '@/lib/constants';
import { cn, formatDate, todayISO, uid } from '@/lib/utils';
import { behavioralReadiness, companyAreaProgress, interviewReadiness } from '@/lib/progress';
import type { BehavioralStory, Company, Difficulty, InterviewQuestion, MockType } from '@/types';

type Tab = 'questions' | 'mocks' | 'companies' | 'stories';

export default function Interviews() {
  const store = useStore();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('questions');

  // questions
  const [qOpen, setQOpen] = useState(false);
  const [editingQ, setEditingQ] = useState<InterviewQuestion | null>(null);
  const [qForm, setQForm] = useState({ question: '', category: 'DBMS', difficulty: 'medium' as Difficulty, answer: '', confidence: 1, frequentlyAsked: false, needsRevision: false });
  const [catFilter, setCatFilter] = useState('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [toDeleteQ, setToDeleteQ] = useState<InterviewQuestion | null>(null);

  // mocks
  const [mOpen, setMOpen] = useState(false);
  const [mForm, setMForm] = useState({ date: todayISO(), type: 'dsa' as MockType, company: '', interviewer: '', durationMinutes: 60, score: 60, topicsTested: '', strengths: '', weaknesses: '', followUp: '' });

  // companies
  const [cOpen, setCOpen] = useState(false);
  const [editingC, setEditingC] = useState<Company | null>(null);
  const [cForm, setCForm] = useState({ name: '', notes: '' });

  // stories
  const [sOpen, setSOpen] = useState(false);
  const [editingS, setEditingS] = useState<BehavioralStory | null>(null);
  const [sForm, setSForm] = useState({ title: '', skill: STAR_TEMPLATES[0], situation: '', task: '', action: '', result: '', usedFor: '', confidence: 3 });
  const [toDeleteS, setToDeleteS] = useState<BehavioralStory | null>(null);

  const questions = useMemo(
    () => store.interviewQuestions.filter((q) => (catFilter === 'all' ? true : q.category === catFilter)).sort((a, b) => a.confidence - b.confidence),
    [store.interviewQuestions, catFilter],
  );

  const mockScores = [...store.mocks].sort((a, b) => a.date.localeCompare(b.date)).map((m) => ({ label: formatDate(m.date).slice(0, 6), value: m.score }));
  const avgScore = store.mocks.length ? Math.round(store.mocks.reduce((a, m) => a + m.score, 0) / store.mocks.length) : 0;
  const weakQuestions = store.interviewQuestions.filter((q) => q.needsRevision || q.confidence <= 2).length;

  const companyReadiness = () => Math.round(COMPANY_AREAS.reduce((a, area) => a + companyAreaProgress(store, area.label), 0) / COMPANY_AREAS.length);

  const openStory = (s?: BehavioralStory) => {
    if (s) {
      setEditingS(s);
      setSForm({ title: s.title, skill: s.skill, situation: s.situation, task: s.task, action: s.action, result: s.result, usedFor: s.usedFor ?? '', confidence: s.confidence });
    } else {
      setEditingS(null);
      setSForm({ title: '', skill: STAR_TEMPLATES[0], situation: '', task: '', action: '', result: '', usedFor: '', confidence: 3 });
    }
    setSOpen(true);
  };

  const saveStory = () => {
    if (!sForm.title.trim()) {
      toast.push('Give the story a title', { tone: 'error' });
      return;
    }
    const payload = { ...sForm, title: sForm.title.trim(), usedFor: sForm.usedFor.trim() || undefined };
    if (editingS) {
      store.updateStory(editingS.id, payload);
      toast.push('Story updated', { tone: 'success' });
    } else {
      store.addStory(payload);
      toast.push('STAR story saved', { tone: 'success' });
    }
    setSOpen(false);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Interview Preparation"
        description="Question bank, mock interviews, company readiness and STAR stories"
        meta={
          <>
            <Badge tone="slate">{store.interviewQuestions.length} questions</Badge>
            <Badge tone="slate">{store.mocks.length} mocks</Badge>
            <Badge tone="sage">{interviewReadiness(store)}% interview readiness</Badge>
            {weakQuestions > 0 && <Badge tone="sand">{weakQuestions} need work</Badge>}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Questions" value={store.interviewQuestions.length} hint={`${weakQuestions} low confidence`} icon={<MessagesSquare size={16} />} />
        <StatCard label="Mock interviews" value={store.mocks.length} icon={<Video size={16} />} />
        <StatCard label="Avg mock score" value={`${avgScore}%`} progress={avgScore} icon={<Target size={16} />} />
        <StatCard label="STAR stories" value={store.stories.length} hint={`${behavioralReadiness(store)}% ready`} icon={<Sparkles size={16} />} />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'questions', label: 'Questions', count: store.interviewQuestions.length },
          { value: 'mocks', label: 'Mock Interviews', count: store.mocks.length },
          { value: 'companies', label: 'Companies', count: store.companies.length },
          { value: 'stories', label: 'STAR Stories', count: store.stories.length },
        ]}
      />

      {tab === 'questions' && (
        <div className="space-y-3">
          <Card className="flex flex-wrap items-center gap-2 p-3">
            <Select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="w-auto py-1.5 text-xs" ariaLabel="Category">
              <option value="all">All categories</option>
              {INTERVIEW_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <span className="text-xs text-content-faint">Sorted by weakest confidence first</span>
            <Button
              className="ml-auto"
              variant="primary"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => {
                setEditingQ(null);
                setQForm({ question: '', category: 'DBMS', difficulty: 'medium', answer: '', confidence: 1, frequentlyAsked: false, needsRevision: false });
                setQOpen(true);
              }}
            >
              Add question
            </Button>
          </Card>

          {questions.length === 0 && <EmptyState title="No questions yet" message="Add the questions you keep getting asked or keep forgetting." />}

          <div className="space-y-2">
            {questions.map((q) => (
              <Card key={q.id} className="p-3">
                <div className="flex items-start gap-3">
                  <button onClick={() => setExpanded(expanded === q.id ? null : q.id)} className="flex min-w-0 flex-1 items-start gap-2 text-left">
                    <ChevronDown size={15} className={cn('mt-0.5 shrink-0 text-content-faint transition-transform', expanded === q.id && 'rotate-180')} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{q.question}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge tone="lavender">{q.category}</Badge>
                        <Badge tone={DIFFICULTY_META[q.difficulty].tone}>{DIFFICULTY_META[q.difficulty].label}</Badge>
                        {q.asked && <Badge tone="sage">asked</Badge>}
                        {q.frequentlyAsked && <Badge tone="clay">frequently asked</Badge>}
                        {q.needsRevision && <Badge tone="sand">needs revision</Badge>}
                      </div>
                    </div>
                  </button>
                  <div className="flex shrink-0 items-center gap-2">
                    <Stars value={q.confidence} onChange={(v) => store.updateQuestion(q.id, { confidence: v, needsRevision: v <= 2 })} />
                    <button onClick={() => setToDeleteQ(q)} className="text-content-faint hover:text-accent-clay" aria-label="Delete question">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {expanded === q.id && (
                  <div className="mt-3 space-y-2 border-t pt-3">
                    <div className="rounded-lg bg-surface-muted p-3 text-xs leading-relaxed text-content-muted">{q.answer || 'No answer saved yet — add your own notes.'}</div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-content-faint">
                      <span>Last practiced: {q.lastPracticed ? formatDate(q.lastPracticed) : '—'}</span>
                      <span>Next review: {q.nextReview ? formatDate(q.nextReview) : '—'}</span>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="ml-auto"
                        onClick={() => {
                          store.updateQuestion(q.id, { lastPracticed: todayISO(), nextReview: undefined, needsRevision: false });
                          toast.push('Marked as practiced', { tone: 'success' });
                        }}
                      >
                        Practiced today
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          store.updateQuestion(q.id, { asked: !q.asked });
                        }}
                      >
                        {q.asked ? 'Unmark asked' : 'Mark asked'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingQ(q);
                          setQForm({ question: q.question, category: q.category, difficulty: q.difficulty, answer: q.answer ?? '', confidence: q.confidence, frequentlyAsked: q.frequentlyAsked, needsRevision: q.needsRevision });
                          setQOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {tab === 'mocks' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setMOpen(true)}>
              Log mock interview
            </Button>
          </div>
          <ChartCard title="Mock performance over time" subtitle={store.mocks.length ? `Average ${avgScore}%` : 'No mocks logged yet'}>
            <SimpleBarChart data={mockScores} unit="%" />
          </ChartCard>
          <div className="grid gap-3 lg:grid-cols-2">
            {[...store.mocks].sort((a, b) => b.date.localeCompare(a.date)).map((m) => (
              <Card key={m.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={MOCK_TYPE_META[m.type].tone}>{MOCK_TYPE_META[m.type].label}</Badge>
                      <span className="text-xs text-content-muted">{formatDate(m.date)}</span>
                      {m.company && <Badge tone="slate">{m.company}</Badge>}
                    </div>
                    <div className="mt-2 text-2xl font-semibold tabular-nums">{m.score}%</div>
                    <div className="text-[11px] text-content-faint">
                      {m.durationMinutes} min · {m.interviewer || 'self'}
                    </div>
                  </div>
                  <button onClick={() => store.deleteMock(m.id)} className="text-content-faint hover:text-accent-clay" aria-label="Delete mock">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="mt-3 space-y-1.5 text-xs">
                  {m.topicsTested.length > 0 && (
                    <div>
                      <span className="text-content-faint">Topics: </span>
                      {m.topicsTested.join(', ')}
                    </div>
                  )}
                  {m.strengths && (
                    <div>
                      <span className="text-accent-sage">Strengths: </span>
                      {m.strengths}
                    </div>
                  )}
                  {m.weaknesses && (
                    <div>
                      <span className="text-accent-sand">Weaknesses: </span>
                      {m.weaknesses}
                    </div>
                  )}
                  {m.followUp && (
                    <div>
                      <span className="text-content-faint">Follow-up: </span>
                      {m.followUp}
                    </div>
                  )}
                </div>
              </Card>
            ))}
            {store.mocks.length === 0 && <EmptyState title="No mock interviews yet" message="Log a mock to track your interview performance over time." icon={<Video size={20} />} />}
          </div>
        </div>
      )}

      {tab === 'companies' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => {
                setEditingC(null);
                setCForm({ name: '', notes: '' });
                setCOpen(true);
              }}
            >
              Add company
            </Button>
          </div>

          {store.companies.length === 0 && <EmptyState title="No company profiles" message="Create a profile per company to see your readiness per area and keep a prep checklist." icon={<Building2 size={20} />} />}

          <div className="grid gap-3 lg:grid-cols-2">
            {store.companies.map((c) => (
              <Card key={c.id}>
                <CardHeader
                  title={c.name}
                  subtitle={`${companyReadiness()}% prepared across ${COMPANY_AREAS.length} areas`}
                  icon={<Building2 size={16} />}
                  action={
                    <>
                      <Button size="sm" variant="ghost" onClick={() => { setEditingC(c); setCForm({ name: c.name, notes: c.notes ?? '' }); setCOpen(true); }}>
                        Edit
                      </Button>
                      <Button size="icon-sm" variant="ghost" className="text-accent-clay" onClick={() => { store.deleteCompany(c.id); toast.push('Company removed', { tone: 'success', action: { label: 'Undo', onClick: () => store.undo() } }); }} aria-label="Delete company">
                        <Trash2 size={14} />
                      </Button>
                    </>
                  }
                />
                <div className="space-y-2.5 p-4">
                  {COMPANY_AREAS.map((area) => {
                    const value = companyAreaProgress(store, area.label);
                    return <MetricBar key={area.label} label={area.label} value={value} right={`${value}%`} />;
                  })}
                </div>
                <div className="border-t">
                  {c.checklist.map((item) => (
                    <CheckRow key={item.id} label={item.label} checked={item.done} onChange={() => store.toggleCompanyChecklist(c.id, item.id)} />
                  ))}
                  {c.checklist.length === 0 && <p className="px-4 py-3 text-xs text-content-faint">No checklist items yet.</p>}
                  <div className="flex gap-1.5 px-3 pb-3">
                    <Input
                      placeholder="Add checklist item…"
                      className="py-1.5 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                          store.updateCompany(c.id, { checklist: [...c.checklist, { id: uid('chk'), label: e.currentTarget.value.trim(), done: false }] });
                          e.currentTarget.value = '';
                        }
                      }}
                    />
                  </div>
                </div>
                {c.notes && <p className="border-t px-4 py-3 text-xs text-content-muted">{c.notes}</p>}
              </Card>
            ))}
          </div>

          <Card className="p-4">
            <p className="text-xs text-content-muted">
              Readiness per area is computed live from your real progress — DSA strength, subject completion, project checklists and STAR story confidence — never a self-rated number.
            </p>
          </Card>
        </div>
      )}

      {tab === 'stories' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => openStory()}>
              New STAR story
            </Button>
          </div>

          {store.stories.length === 0 ? (
            <EmptyState
              title="No STAR stories yet"
              message="Draft one story per behavioural theme — leadership, conflict, failure — so you always have a story ready."
              icon={<Sparkles size={20} />}
              action={
                <Button variant="primary" icon={<Plus size={15} />} onClick={() => openStory()}>
                  New STAR story
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {store.stories.map((s) => (
                <Card key={s.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold">{s.title}</span>
                        <Badge tone="lavender">{s.skill}</Badge>
                      </div>
                      <div className="mt-1 text-[11px] text-content-faint">
                        Practiced {s.practicedCount}× {s.usedFor ? `· used for ${s.usedFor}` : ''}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Stars value={s.confidence} onChange={(v) => store.updateStory(s.id, { confidence: v })} />
                      <button onClick={() => setToDeleteS(s)} className="text-content-faint hover:text-accent-clay" aria-label="Delete story">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1.5 text-xs">
                    {s.situation && (
                      <div>
                        <span className="font-medium text-content-muted">S. </span>
                        <span className="text-content-muted">{s.situation}</span>
                      </div>
                    )}
                    {s.task && (
                      <div>
                        <span className="font-medium text-content-muted">T. </span>
                        <span className="text-content-muted">{s.task}</span>
                      </div>
                    )}
                    {s.action && (
                      <div>
                        <span className="font-medium text-content-muted">A. </span>
                        <span className="text-content-muted">{s.action}</span>
                      </div>
                    )}
                    {s.result && (
                      <div className="rounded-lg border border-brand/20 bg-brand/5 p-2">
                        <span className="font-medium">R. </span>
                        {s.result}
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-1.5">
                    <Button size="sm" variant="secondary" onClick={() => { store.updateStory(s.id, { practicedCount: s.practicedCount + 1 }); toast.push('Logged a practice run', { tone: 'success' }); }}>
                      Practiced
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openStory(s)}>
                      Edit
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Question modal */}
      <Modal
        open={qOpen}
        onClose={() => setQOpen(false)}
        title={editingQ ? 'Edit question' : 'Add interview question'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setQOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!qForm.question.trim()) {
                  toast.push('Question text required', { tone: 'error' });
                  return;
                }
                if (editingQ) {
                  store.updateQuestion(editingQ.id, qForm);
                  toast.push('Question updated', { tone: 'success' });
                } else {
                  store.addQuestion(qForm);
                  toast.push('Question added', { tone: 'success' });
                }
                setQOpen(false);
              }}
            >
              {editingQ ? 'Save' : 'Add'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Question">
            <Textarea value={qForm.question} onChange={(e) => setQForm({ ...qForm, question: e.target.value })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Category">
              <Select value={qForm.category} onChange={(e) => setQForm({ ...qForm, category: e.target.value })}>
                {INTERVIEW_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Difficulty">
              <Select value={qForm.difficulty} onChange={(e) => setQForm({ ...qForm, difficulty: e.target.value as Difficulty })}>
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {DIFFICULTY_META[d].label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Answer / notes">
            <Textarea value={qForm.answer} onChange={(e) => setQForm({ ...qForm, answer: e.target.value })} className="min-h-[120px]" />
          </Field>
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <div className="label-base">Confidence</div>
              <Stars value={qForm.confidence} onChange={(v) => setQForm({ ...qForm, confidence: v })} size={20} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={qForm.frequentlyAsked} onChange={(e) => setQForm({ ...qForm, frequentlyAsked: e.target.checked })} className="h-4 w-4 accent-[rgb(var(--brand))]" />
              Frequently asked
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={qForm.needsRevision} onChange={(e) => setQForm({ ...qForm, needsRevision: e.target.checked })} className="h-4 w-4 accent-[rgb(var(--brand))]" />
              Needs revision
            </label>
          </div>
        </div>
      </Modal>

      {/* Mock modal */}
      <Modal
        open={mOpen}
        onClose={() => setMOpen(false)}
        title="Log mock interview"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setMOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                store.addMock({ ...mForm, topicsTested: mForm.topicsTested.split(',').map((t) => t.trim()).filter(Boolean) });
                setMOpen(false);
                toast.push('Mock interview logged', { tone: 'success' });
              }}
            >
              Save mock
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Date">
              <Input type="date" value={mForm.date} onChange={(e) => setMForm({ ...mForm, date: e.target.value })} />
            </Field>
            <Field label="Type">
              <Select value={mForm.type} onChange={(e) => setMForm({ ...mForm, type: e.target.value as MockType })}>
                {MOCK_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {MOCK_TYPE_META[t].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Company">
              <Input value={mForm.company} onChange={(e) => setMForm({ ...mForm, company: e.target.value })} placeholder="Practice / Microsoft" />
            </Field>
            <Field label="Interviewer">
              <Input value={mForm.interviewer} onChange={(e) => setMForm({ ...mForm, interviewer: e.target.value })} />
            </Field>
            <Field label="Duration (minutes)">
              <Input type="number" min={10} step={5} value={mForm.durationMinutes} onChange={(e) => setMForm({ ...mForm, durationMinutes: Number(e.target.value) })} />
            </Field>
            <Field label="Score (0-100)">
              <Input type="number" min={0} max={100} value={mForm.score} onChange={(e) => setMForm({ ...mForm, score: Number(e.target.value) })} />
            </Field>
          </div>
          <Field label="Topics tested" hint="Comma separated">
            <Input value={mForm.topicsTested} onChange={(e) => setMForm({ ...mForm, topicsTested: e.target.value })} placeholder="DBMS, OS, Arrays" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Strengths">
              <Textarea value={mForm.strengths} onChange={(e) => setMForm({ ...mForm, strengths: e.target.value })} />
            </Field>
            <Field label="Weaknesses">
              <Textarea value={mForm.weaknesses} onChange={(e) => setMForm({ ...mForm, weaknesses: e.target.value })} />
            </Field>
          </div>
          <Field label="Follow-up actions">
            <Textarea value={mForm.followUp} onChange={(e) => setMForm({ ...mForm, followUp: e.target.value })} />
          </Field>
        </div>
      </Modal>

      {/* Company modal */}
      <Modal
        open={cOpen}
        onClose={() => setCOpen(false)}
        title={editingC ? `Edit ${editingC.name}` : 'Add company'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!cForm.name.trim()) {
                  toast.push('Company name required', { tone: 'error' });
                  return;
                }
                if (editingC) {
                  store.updateCompany(editingC.id, { name: cForm.name.trim(), notes: cForm.notes });
                } else {
                  store.addCompany({ name: cForm.name.trim(), notes: cForm.notes, checklist: [] });
                }
                setCOpen(false);
                toast.push('Company saved', { tone: 'success' });
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Company name">
            <Input value={cForm.name} onChange={(e) => setCForm({ ...cForm, name: e.target.value })} placeholder="e.g. Microsoft" />
          </Field>
          <Field label="Notes">
            <Textarea value={cForm.notes} onChange={(e) => setCForm({ ...cForm, notes: e.target.value })} />
          </Field>
          <p className="text-[11px] text-content-faint">After saving, add a prep checklist. Readiness per area is derived automatically from your tracked progress.</p>
          <MetricBar label="Overall readiness" value={companyReadiness()} />
        </div>
      </Modal>

      {/* Story modal */}
      <Modal
        open={sOpen}
        onClose={() => setSOpen(false)}
        title={editingS ? 'Edit STAR story' : 'New STAR story'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveStory}>
              {editingS ? 'Save changes' : 'Save story'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Title">
              <Input value={sForm.title} onChange={(e) => setSForm({ ...sForm, title: e.target.value })} placeholder="e.g. Migrating the team to CI/CD" />
            </Field>
            <Field label="Theme / skill">
              <Select value={sForm.skill} onChange={(e) => setSForm({ ...sForm, skill: e.target.value })}>
                {STAR_TEMPLATES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Situation">
            <Textarea value={sForm.situation} onChange={(e) => setSForm({ ...sForm, situation: e.target.value })} />
          </Field>
          <Field label="Task">
            <Textarea value={sForm.task} onChange={(e) => setSForm({ ...sForm, task: e.target.value })} />
          </Field>
          <Field label="Action">
            <Textarea value={sForm.action} onChange={(e) => setSForm({ ...sForm, action: e.target.value })} />
          </Field>
          <Field label="Result">
            <Textarea value={sForm.result} onChange={(e) => setSForm({ ...sForm, result: e.target.value })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Used for">
              <Input value={sForm.usedFor} onChange={(e) => setSForm({ ...sForm, usedFor: e.target.value })} placeholder="e.g. Leadership round" />
            </Field>
            <div>
              <div className="label-base">Confidence</div>
              <Stars value={sForm.confidence} onChange={(v) => setSForm({ ...sForm, confidence: v })} size={20} />
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDeleteQ}
        title="Delete question"
        message={`Delete "${toDeleteQ?.question}"?`}
        onCancel={() => setToDeleteQ(null)}
        onConfirm={() => {
          if (toDeleteQ) {
            store.deleteQuestion(toDeleteQ.id);
            toast.push('Question deleted', { tone: 'success', action: { label: 'Undo', onClick: () => store.undo() } });
          }
          setToDeleteQ(null);
        }}
      />

      <ConfirmDialog
        open={!!toDeleteS}
        title="Delete story"
        message={`Delete the STAR story "${toDeleteS?.title}"?`}
        onCancel={() => setToDeleteS(null)}
        onConfirm={() => {
          if (toDeleteS) {
            store.deleteStory(toDeleteS.id);
            toast.push('Story deleted', { tone: 'success', action: { label: 'Undo', onClick: () => store.undo() } });
          }
          setToDeleteS(null);
        }}
      />
    </div>
  );
}
