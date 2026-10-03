import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store';
import { Button, Field, Input, Modal, Select, Stars, Textarea, useToast } from '@/components/ui';
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_META,
  CATEGORIES,
  CATEGORY_META,
  DIFFICULTIES,
  DIFFICULTY_META,
  INTERVIEW_CATEGORIES,
  MOCK_TYPES,
  MOCK_TYPE_META,
  PRIORITIES,
  PRIORITY_META,
  PROJECT_STATUSES,
  PROJECT_STATUS_META,
  STUDY_TYPES,
  STUDY_TYPE_META,
  SUBJECT_COLORS,
  TIERS,
  TIER_META,
} from '@/lib/constants';
import { todayISO } from '@/lib/utils';
import type { ApplicationStatus, Difficulty, MockType, Priority, ProjectStatus, StudyType, SubjectCategory, TaskTier } from '@/types';

const APP_STATUS_OPTIONS = APPLICATION_STATUSES.map((s) => ({ value: s, label: APPLICATION_STATUS_META[s].label }));

type Kind = 'problem' | 'dsaSession' | 'session' | 'task' | 'subject' | 'topic' | 'note' | 'project' | 'question' | 'mock' | 'application' | 'story';

const CHOICES: { kind: Kind; label: string }[] = [
  { kind: 'problem', label: 'DSA problem' },
  { kind: 'dsaSession', label: 'DSA session' },
  { kind: 'session', label: 'Study session' },
  { kind: 'task', label: 'Task' },
  { kind: 'subject', label: 'Subject' },
  { kind: 'topic', label: 'Topic' },
  { kind: 'note', label: 'Note' },
  { kind: 'project', label: 'Project' },
  { kind: 'question', label: 'Interview question' },
  { kind: 'mock', label: 'Mock interview' },
  { kind: 'application', label: 'Application' },
  { kind: 'story', label: 'STAR story' },
];

const TITLES: Record<Kind, string> = {
  problem: 'Add a DSA problem',
  dsaSession: 'Log a DSA session',
  session: 'Log a study session',
  task: 'Add a task',
  subject: 'Add a subject',
  topic: 'Add a topic',
  note: 'Add a note',
  project: 'Add a project',
  question: 'Add an interview question',
  mock: 'Log a mock interview',
  application: 'Add an application',
  story: 'Add a STAR story',
};

export function QuickAdd({ open, onClose, presets, initialKind }: { open: boolean; onClose: () => void; presets?: { label: string; action: string }[]; initialKind?: Kind }) {
  const store = useStore();
  const navigate = useNavigate();
  const toast = useToast();
  const [kind, setKind] = useState<Kind | null>(initialKind ?? null);

  // shared fields
  const [title, setTitle] = useState('');
  const [secondary, setSecondary] = useState('');
  const [body, setBody] = useState('');
  const [date, setDate] = useState(todayISO());
  const [minutes, setMinutes] = useState(60);
  const [confidence, setConfidence] = useState(3);
  const [subjectId, setSubjectId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [category, setCategory] = useState<SubjectCategory>('core-cs');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [priority, setPriority] = useState<Priority>('medium');
  const [tier, setTier] = useState<TaskTier>('normal');
  const [studyType, setStudyType] = useState<StudyType>('learning');
  const [moduleId, setModuleId] = useState('');
  const [patternId, setPatternId] = useState('');
  const [projectStatus, setProjectStatus] = useState<ProjectStatus>('building');
  const [mockType, setMockType] = useState<MockType>('dsa');
  const [score, setScore] = useState(65);
  const [appStatus, setAppStatus] = useState<ApplicationStatus>('interested');
  const [referral, setReferral] = useState(false);
  const [independent, setIndependent] = useState(true);
  const [color, setColor] = useState(SUBJECT_COLORS[0]);

  const subjects = store.subjects.filter((s) => !s.archived);
  const units = useMemo(() => store.topics.filter((t) => t.kind === 'unit' && (!subjectId || t.subjectId === subjectId)), [store.topics, subjectId]);
  const topics = useMemo(
    () => store.topics.filter((t) => t.kind === 'topic' && (!subjectId || t.subjectId === subjectId) && (!unitId || t.parentId === unitId)),
    [store.topics, subjectId, unitId],
  );
  const modules = useMemo(() => [...store.dsaModules].sort((a, b) => a.order - b.order), [store.dsaModules]);
  const patterns = useMemo(() => store.dsaPatterns.filter((p) => !moduleId || p.moduleId === moduleId), [store.dsaPatterns, moduleId]);

  const reset = () => {
    setTitle('');
    setSecondary('');
    setBody('');
    setMinutes(60);
    setConfidence(3);
    setTopicId('');
  };

  const close = () => {
    onClose();
    setTimeout(() => {
      setKind(initialKind ?? null);
      reset();
    }, 200);
  };

  const fail = (msg: string) => toast.push(msg, { tone: 'error' });

  const submit = () => {
    if (!kind) return;
    switch (kind) {
      case 'problem': {
        if (!title.trim()) return fail('Problem name is required');
        const pattern = store.dsaPatterns.find((p) => p.id === patternId);
        store.addProblem({
          name: title.trim(),
          platform: secondary.trim() || 'LeetCode',
          moduleId: pattern?.moduleId,
          topicId: pattern?.topicId,
          patternId: pattern?.id,
          difficulty,
          attempted: true,
          solved: true,
          independent,
          understood: confidence >= 3,
          confidence,
          dateSolved: date,
          timeTakenMinutes: minutes,
          url: secondary.startsWith('http') ? secondary.trim() : undefined,
        });
        toast.push('Problem added to the question bank', { tone: 'success' });
        close();
        navigate('/dsa');
        return;
      }
      case 'dsaSession':
        store.addDsaSession({ date, minutes, patternId: patternId || undefined, attempted: Number(secondary) || 1, solved: 1, independentSolves: independent ? 1 : 0, notes: body });
        toast.push('DSA session logged', { tone: 'success' });
        close();
        navigate('/dsa');
        return;
      case 'session':
        store.addSession({ date, minutes, subjectId: subjectId || undefined, topicId: topicId || undefined, type: studyType, productivity: confidence, notes: body });
        toast.push('Study session saved', { tone: 'success' });
        close();
        navigate('/analytics');
        return;
      case 'task':
        if (!title.trim()) return fail('Task title is required');
        store.addTask({ title: title.trim(), date, tier, priority, estimatedMinutes: minutes, subjectId: subjectId || undefined, topicId: topicId || undefined });
        toast.push('Task added', { tone: 'success' });
        close();
        navigate('/planner');
        return;
      case 'subject':
        if (!title.trim()) return fail('Subject name is required');
        store.addSubject({ name: title.trim(), description: body, category, priority, color });
        toast.push('Subject created', { tone: 'success' });
        close();
        navigate('/subjects');
        return;
      case 'topic': {
        if (!title.trim()) return fail('Topic name is required');
        const sid = subjectId || subjects[0]?.id;
        if (!sid) return fail('Create a subject first');
        store.addTopic({ subjectId: sid, parentId: unitId || null, name: title.trim(), subtopics: secondary.split(',').map((s) => s.trim()).filter(Boolean) });
        toast.push('Topic added', { tone: 'success' });
        close();
        navigate(`/subjects/${sid}`);
        return;
      }
      case 'note':
        if (!title.trim()) return fail('Note title is required');
        store.addNote({ title: title.trim(), content: body, subjectId: subjectId || undefined, tags: secondary.split(',').map((t) => t.trim()).filter(Boolean) });
        toast.push('Note saved', { tone: 'success' });
        close();
        navigate('/notes');
        return;
      case 'project':
        if (!title.trim()) return fail('Project name is required');
        store.addProject({ name: title.trim(), description: body, technologies: secondary.split(',').map((t) => t.trim()).filter(Boolean), status: projectStatus, color });
        toast.push('Project created', { tone: 'success' });
        close();
        navigate('/projects');
        return;
      case 'question':
        if (!title.trim()) return fail('Question text is required');
        store.addQuestion({ question: title.trim(), category: secondary || 'Core CS', difficulty, answer: body, confidence });
        toast.push('Question added', { tone: 'success' });
        close();
        navigate('/interviews');
        return;
      case 'mock':
        store.addMock({ date, type: mockType, company: secondary || undefined, durationMinutes: minutes, score, topicsTested: body.split(',').map((t) => t.trim()).filter(Boolean) });
        toast.push('Mock interview logged', { tone: 'success' });
        close();
        navigate('/interviews');
        return;
      case 'application':
        if (!title.trim() || !secondary.trim()) return fail('Company and role are required');
        store.addApplication({ company: title.trim(), role: secondary.trim(), status: appStatus, applicationDate: date, referral, type: 'Internship' });
        toast.push('Application tracked', { tone: 'success' });
        close();
        navigate('/applications');
        return;
      case 'story':
        if (!title.trim()) return fail('Give the story a title');
        store.addStory({ title: title.trim(), skill: secondary || 'General', situation: body, confidence });
        toast.push('STAR story started', { tone: 'success' });
        close();
        navigate('/interviews');
        return;
    }
  };

  const active = kind;

  return (
    <Modal
      open={open}
      onClose={close}
      title={active ? TITLES[active] : 'What do you want to add?'}
      footer={
        active ? (
          <>
            {!initialKind && (
              <Button variant="ghost" onClick={() => setKind(null)}>
                Back
              </Button>
            )}
            <Button variant="primary" onClick={submit}>
              Save
            </Button>
          </>
        ) : undefined
      }
    >
      {!active ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(presets ?? CHOICES).map((p) => {
            const choice = ('action' in p ? p.action : p.kind) as Kind;
            return (
              <button
                key={choice}
                onClick={() => setKind(choice)}
                className="rounded-xl border bg-surface px-3 py-3.5 text-sm font-medium text-content transition-colors hover:border-content/25 hover:bg-surface-muted"
              >
                {p.label}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {active !== 'dsaSession' && active !== 'session' && active !== 'mock' && (
            <Field label={active === 'question' ? 'Question' : active === 'problem' ? 'Problem name' : 'Title'}>
              <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Be specific…" />
            </Field>
          )}

          {active === 'problem' && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Platform">
                  <Input value={secondary} onChange={(e) => setSecondary(e.target.value)} placeholder="LeetCode" />
                </Field>
                <Field label="URL (optional)">
                  <Input value={secondary.startsWith('http') ? secondary : ''} onChange={(e) => setSecondary(e.target.value)} placeholder="https://…" />
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
                <Field label="Difficulty">
                  <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
                    {DIFFICULTIES.map((d) => (
                      <option key={d} value={d}>
                        {DIFFICULTY_META[d].label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Time taken (min)">
                  <Input type="number" min={1} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
                </Field>
              </div>
              <Field label="Confidence">
                <Stars value={confidence} onChange={setConfidence} size={20} />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={independent} onChange={(e) => setIndependent(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--accent-sage))]" />
                Solved independently
              </label>
            </>
          )}

          {active === 'dsaSession' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Date">
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label="Minutes">
                <Input type="number" min={5} step={5} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
              </Field>
              <Field label="Problems attempted">
                <Input type="number" min={0} value={secondary} onChange={(e) => setSecondary(e.target.value)} />
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
              <Field label="Notes" className="sm:col-span-2">
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} />
              </Field>
            </div>
          )}

          {active === 'session' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Subject">
                <Select value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setTopicId(''); }}>
                  <option value="">— none —</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Topic">
                <Select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
                  <option value="">— none —</option>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Minutes">
                <Input type="number" min={5} step={5} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
              </Field>
              <Field label="Type">
                <Select value={studyType} onChange={(e) => setStudyType(e.target.value as StudyType)}>
                  {STUDY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {STUDY_TYPE_META[t].label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Date">
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label="Productivity">
                <Stars value={confidence} onChange={setConfidence} size={20} />
              </Field>
            </div>
          )}

          {active === 'task' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="List">
                <Select value={tier} onChange={(e) => setTier(e.target.value as TaskTier)}>
                  {TIERS.map((t) => (
                    <option key={t} value={t}>
                      {TIER_META[t].label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Priority">
                <Select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_META[p].label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Estimated minutes">
                <Input type="number" min={5} step={5} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
              </Field>
              <Field label="Date">
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label="Subject">
                <Select value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setTopicId(''); }}>
                  <option value="">— none —</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Topic">
                <Select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
                  <option value="">— none —</option>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}

          {active === 'subject' && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Category">
                  <Select value={category} onChange={(e) => setCategory(e.target.value as SubjectCategory)}>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_META[c].label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Priority">
                  <Select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {PRIORITY_META[p].label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Colour">
                <div className="flex flex-wrap gap-2">
                  {SUBJECT_COLORS.map((c) => (
                    <button key={c} onClick={() => setColor(c)} aria-label={`Colour ${c}`} className={`h-6 w-6 rounded-full ring-2 ring-offset-2 ring-offset-surface ${color === c ? 'ring-content/40' : 'ring-transparent'}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </Field>
              <Field label="Description">
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} />
              </Field>
            </>
          )}

          {active === 'topic' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Subject">
                <Select value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setUnitId(''); }}>
                  <option value="">— none —</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Unit">
                <Select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
                  <option value="">— top level —</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Subtopics (comma separated)" className="sm:col-span-2">
                <Input value={secondary} onChange={(e) => setSecondary(e.target.value)} placeholder="ACID, Commit, Rollback" />
              </Field>
            </div>
          )}

          {active === 'note' && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Tags (comma separated)">
                  <Input value={secondary} onChange={(e) => setSecondary(e.target.value)} placeholder="dbms, interview" />
                </Field>
                <Field label="Subject">
                  <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                    <option value="">— none —</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Content">
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[140px] font-mono text-xs" />
              </Field>
            </>
          )}

          {active === 'project' && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Technologies (comma separated)">
                  <Input value={secondary} onChange={(e) => setSecondary(e.target.value)} placeholder="React, Spring Boot" />
                </Field>
                <Field label="Status">
                  <Select value={projectStatus} onChange={(e) => setProjectStatus(e.target.value as ProjectStatus)}>
                    {PROJECT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {PROJECT_STATUS_META[s].label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Description">
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} />
              </Field>
            </>
          )}

          {active === 'question' && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Category">
                  <Select value={secondary} onChange={(e) => setSecondary(e.target.value)}>
                    <option value="">— select —</option>
                    {INTERVIEW_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Difficulty">
                  <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
                    {DIFFICULTIES.map((d) => (
                      <option key={d} value={d}>
                        {DIFFICULTY_META[d].label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Answer / notes">
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} />
              </Field>
              <Field label="Confidence">
                <Stars value={confidence} onChange={setConfidence} size={20} />
              </Field>
            </>
          )}

          {active === 'mock' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Date">
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label="Type">
                <Select value={mockType} onChange={(e) => setMockType(e.target.value as MockType)}>
                  {MOCK_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {MOCK_TYPE_META[t].label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Company / source">
                <Input value={secondary} onChange={(e) => setSecondary(e.target.value)} placeholder="Practice / Microsoft" />
              </Field>
              <Field label="Score (%)">
                <Input type="number" min={0} max={100} value={score} onChange={(e) => setScore(Number(e.target.value))} />
              </Field>
              <Field label="Topics tested (comma separated)" className="sm:col-span-2">
                <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder="DBMS, OS" />
              </Field>
            </div>
          )}

          {active === 'application' && (
            <>
              <Field label="Role">
                <Input value={secondary} onChange={(e) => setSecondary(e.target.value)} placeholder="SWE Intern" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Status">
                  <Select value={appStatus} onChange={(e) => setAppStatus(e.target.value as ApplicationStatus)}>
                    {APP_STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Application date">
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={referral} onChange={(e) => setReferral(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--accent-sage))]" />
                Applied through a referral
              </label>
            </>
          )}

          {active === 'story' && (
            <>
              <Field label="Skill demonstrated">
                <Input value={secondary} onChange={(e) => setSecondary(e.target.value)} placeholder="Leadership, Failure, Teamwork…" />
              </Field>
              <Field label="Situation">
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} />
              </Field>
              <Field label="Confidence">
                <Stars value={confidence} onChange={setConfidence} size={20} />
              </Field>
            </>
          )}

          {(active === 'task' || active === 'session') && !subjectId && subjects.length > 0 && (
            <p className="text-[11px] text-content-faint">Linking a subject/topic makes the session feed your analytics automatically.</p>
          )}
        </div>
      )}
    </Modal>
  );
}
