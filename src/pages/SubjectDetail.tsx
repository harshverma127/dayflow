import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  ExternalLink,
  Layers,
  Link2,
  Plus,
  RotateCcw,
  Star,
  Trash2,
} from 'lucide-react';
import { useStore } from '@/store';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  ProgressRing,
  Select,
  Stars,
  Textarea,
  Tooltip,
  useToast,
} from '@/components/ui';
import { MetricBar } from '@/components/common';
import {
  CATEGORY_META,
  CONFIDENCE_LABELS,
  PRIORITIES,
  PRIORITY_META,
  RESOURCE_TYPES,
  RESOURCE_TYPE_META,
  TOPIC_STATUS_META,
} from '@/lib/constants';
import { cn, formatDate, formatMinutes, todayISO } from '@/lib/utils';
import { childTopics, subjectStats, subtopicProgress, topicProgress, topicStatus } from '@/lib/progress';
import type { Priority, ResourceType, Subtopic, Topic } from '@/types';

const LIFECYCLE: { key: 'learned' | 'practiced' | 'canExplain' | 'applied'; label: string }[] = [
  { key: 'learned', label: 'Learned' },
  { key: 'practiced', label: 'Practiced' },
  { key: 'canExplain', label: 'Can explain' },
  { key: 'applied', label: 'Applied' },
];

function ConfidenceDots({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <span className="inline-flex items-center gap-0.5" title={CONFIDENCE_LABELS[value]}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={(e) => {
            e.stopPropagation();
            onChange(n);
          }}
          aria-label={`Confidence ${n}`}
          className={cn('h-2 w-2 rounded-full transition-colors', n <= value ? 'bg-accent-sage' : 'bg-surface-muted ring-1 ring-inset ring-border')}
        />
      ))}
    </span>
  );
}

function SubtopicRow({ topic, sub }: { topic: Topic; sub: Subtopic }) {
  const store = useStore();
  const [itemName, setItemName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(sub.name);
  const progress = subtopicProgress(sub);
  const hasItems = sub.items.length > 0;

  return (
    <div className="rounded-lg border bg-surface p-2.5">
      <div className="flex items-start gap-2">
        {hasItems ? (
          <span className="mt-1 h-4 w-4 shrink-0 overflow-hidden rounded-full ring-1 ring-inset ring-border" aria-hidden>
            <span className="block h-full bg-accent-sage/70" style={{ width: `${progress}%` }} />
          </span>
        ) : (
          <Checkbox checked={sub.done} onChange={() => store.toggleSubtopicDone(topic.id, sub.id)} className="mt-0.5" />
        )}
        <div className="min-w-0 flex-1">
          {editingName ? (
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                if (name.trim()) store.updateSubtopic(topic.id, sub.id, { name: name.trim() });
                setEditingName(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (name.trim()) store.updateSubtopic(topic.id, sub.id, { name: name.trim() });
                  setEditingName(false);
                }
              }}
              className="py-1 text-xs"
            />
          ) : (
            <button
              onClick={() => {
                setName(sub.name);
                setEditingName(true);
              }}
              className={cn('text-left text-sm', (sub.done || progress >= 100) && 'text-content-faint')}
            >
              {sub.name}
            </button>
          )}
          {hasItems && (
            <div className="mt-1.5 space-y-0.5">
              {sub.items.map((item) => (
                <div key={item.id} className="group flex items-center gap-2">
                  <Checkbox checked={item.done} onChange={() => store.toggleChecklistItem(topic.id, sub.id, item.id)} />
                  <span className={cn('min-w-0 flex-1 truncate text-xs', item.done && 'text-content-faint line-through')}>{item.name}</span>
                  <button
                    onClick={() => store.deleteChecklistItem(topic.id, sub.id, item.id)}
                    className="opacity-0 transition-opacity group-hover:opacity-100 text-content-faint hover:text-accent-clay"
                    aria-label="Delete checklist item"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-1.5 pt-1">
                <Input
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="Add checklist item…"
                  className="py-1 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && itemName.trim()) {
                      store.addChecklistItem(topic.id, sub.id, itemName.trim());
                      setItemName('');
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          {hasItems ? (
            <span className="text-[11px] tabular-nums text-content-faint">{Math.round(progress)}%</span>
          ) : null}
          <ConfidenceDots value={sub.confidence} onChange={(v) => store.setConfidence('subtopic', { topicId: topic.id, subId: sub.id }, v)} />
          <button onClick={() => store.deleteSubtopic(topic.id, sub.id)} className="text-content-faint hover:text-accent-clay" aria-label={`Delete ${sub.name}`}>
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

function TopicWork({ topic }: { topic: Topic }) {
  const store = useStore();
  const [newSub, setNewSub] = useState('');
  const [resName, setResName] = useState('');
  const [resUrl, setResUrl] = useState('');
  const [resType, setResType] = useState<ResourceType>('article');

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-lg border bg-surface p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-content-muted">Subtopics &amp; checklist</span>
          <span className="text-[11px] text-content-faint">{topic.subtopics.length} subtopic(s)</span>
        </div>
        <div className="space-y-1.5">
          {topic.subtopics.map((sub) => (
            <SubtopicRow key={sub.id} topic={topic} sub={sub} />
          ))}
          {topic.subtopics.length === 0 && (
            <p className="py-1 text-xs text-content-faint">No subtopics yet — add a few, or use the lifecycle below.</p>
          )}
        </div>
        <div className="mt-2 flex gap-1.5">
          <Input
            value={newSub}
            onChange={(e) => setNewSub(e.target.value)}
            placeholder="Add subtopic…"
            className="py-1.5 text-xs"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newSub.trim()) {
                store.addSubtopic(topic.id, newSub.trim());
                setNewSub('');
              }
            }}
          />
          <Button
            size="icon-sm"
            variant="primary"
            aria-label="Add subtopic"
            onClick={() => {
              if (newSub.trim()) {
                store.addSubtopic(topic.id, newSub.trim());
                setNewSub('');
              }
            }}
          >
            <Plus size={14} />
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-lg border bg-surface p-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-content-muted">Resources</span>
          <div className="mt-2 space-y-1.5">
            {topic.resources.map((r) => (
              <div key={r.id} className="flex items-center gap-2 text-xs">
                <Checkbox checked={r.done} onChange={() => store.toggleResource(topic.id, r.id)} />
                <span className={cn('min-w-0 flex-1 truncate', r.done && 'text-content-faint line-through')}>{r.name}</span>
                <Badge tone={RESOURCE_TYPE_META[r.type].tone}>{RESOURCE_TYPE_META[r.type].label}</Badge>
                {r.url && (
                  <a href={r.url} target="_blank" rel="noreferrer" className="text-brand" aria-label="Open resource">
                    <ExternalLink size={13} />
                  </a>
                )}
                <button onClick={() => store.deleteResource(topic.id, r.id)} className="text-content-faint hover:text-accent-clay" aria-label="Delete resource">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            {topic.resources.length === 0 && <p className="text-xs text-content-faint">No resources saved.</p>}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <Input value={resName} onChange={(e) => setResName(e.target.value)} placeholder="Name" className="py-1.5 text-xs" />
            <Select value={resType} onChange={(e) => setResType(e.target.value as ResourceType)} className="py-1.5 text-xs" ariaLabel="Resource type">
              {RESOURCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {RESOURCE_TYPE_META[t].label}
                </option>
              ))}
            </Select>
            <Input value={resUrl} onChange={(e) => setResUrl(e.target.value)} placeholder="https://…" className="col-span-2 py-1.5 text-xs" />
            <Button
              size="sm"
              variant="secondary"
              className="col-span-2"
              icon={<Link2 size={14} />}
              onClick={() => {
                if (!resName.trim()) return;
                store.addResource(topic.id, { name: resName.trim(), url: resUrl.trim(), type: resType, done: false });
                setResName('');
                setResUrl('');
              }}
            >
              Add resource
            </Button>
          </div>
        </div>

        <div className="rounded-lg border bg-surface p-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-content-muted">Notes</span>
          <Textarea
            value={topic.description ?? ''}
            onChange={(e) => store.updateTopic(topic.id, { description: e.target.value })}
            placeholder="Quick notes for this topic…"
            className="mt-2 min-h-[84px] text-xs"
          />
        </div>
      </div>
    </div>
  );
}

function TopicNode({ topic, allTopics, depth, onDelete }: { topic: Topic; allTopics: Topic[]; depth: number; onDelete: (t: Topic) => void }) {
  const store = useStore();
  const [open, setOpen] = useState(depth === 0);
  const children = childTopics(allTopics, topic.id);
  const progress = topicProgress(topic, allTopics);
  const status = topicStatus(topic, allTopics);
  const isUnit = topic.kind === 'unit';

  return (
    <div className={cn(isUnit ? '' : 'border-b last:border-0')}>
      <div className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center" style={{ paddingLeft: depth * 16 }}>
        <button onClick={() => setOpen((v) => !v)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={open}>
          {open ? <ChevronDown size={15} className="shrink-0 text-content-faint" /> : <ChevronRight size={15} className="shrink-0 text-content-faint" />}
          <span className={cn('truncate', isUnit ? 'text-sm font-semibold' : 'text-sm font-medium')}>{topic.name}</span>
          {!isUnit && <Badge tone={TOPIC_STATUS_META[status].tone}>{TOPIC_STATUS_META[status].label}</Badge>}
          {isUnit && children.length > 0 && <span className="text-[11px] text-content-faint">{children.length} topics</span>}
        </button>
        <div className="flex shrink-0 items-center gap-2 sm:w-64">
          <div className="min-w-0 flex-1">
            <MetricBar label="" value={progress} right={`${Math.round(progress)}%`} />
          </div>
          <Stars value={topic.confidence} onChange={(v) => store.setConfidence('topic', { topicId: topic.id }, v)} />
          <div className="flex">
            <button onClick={() => store.moveTopic(topic.id, -1)} className="text-content-faint hover:text-content" aria-label="Move up">
              <ChevronUp size={14} />
            </button>
            <button onClick={() => store.moveTopic(topic.id, 1)} className="text-content-faint hover:text-content" aria-label="Move down">
              <ChevronDown size={14} />
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className="space-y-3 pb-3" style={{ paddingLeft: depth * 16 }}>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={topic.priority}
              onChange={(e) => store.updateTopic(topic.id, { priority: e.target.value as Priority })}
              className="w-auto py-1 text-xs"
              ariaLabel="Priority"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_META[p].label}
                </option>
              ))}
            </Select>
            <label className="flex items-center gap-1.5 text-xs text-content-muted">
              Target
              <input
                type="date"
                value={topic.targetDate ?? ''}
                onChange={(e) => store.updateTopic(topic.id, { targetDate: e.target.value || undefined })}
                className="rounded-md border bg-surface px-2 py-1 text-xs"
              />
            </label>
            {!isUnit && (
              <div className="flex flex-wrap items-center gap-1">
                {LIFECYCLE.map((l) => (
                  <button
                    key={l.key}
                    onClick={() => store.toggleLifecycle(topic.id, l.key)}
                    className={cn(
                      'rounded-md px-2 py-1 text-[11px] font-medium ring-1 ring-inset transition-colors',
                      topic[l.key] ? 'bg-accent-sage/15 text-accent-sage ring-accent-sage/30' : 'bg-surface-muted text-content-muted ring-border hover:text-content',
                    )}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            )}
            <Tooltip label={topic.revisionEnabled ? 'Revision reminders on' : 'Revision reminders off'}>
              <Button size="sm" variant="ghost" icon={<RotateCcw size={13} />} onClick={() => store.updateTopic(topic.id, { revisionEnabled: !topic.revisionEnabled })}>
                {topic.revisionEnabled ? 'Revision on' : 'Revision off'}
              </Button>
            </Tooltip>
            <Button size="sm" variant="ghost" icon={<Check size={13} />} onClick={() => store.completeTopic(topic.id)}>
              Complete
            </Button>
            <button onClick={() => onDelete(topic)} className="ml-auto text-content-faint hover:text-accent-clay" aria-label="Delete topic">
              <Trash2 size={14} />
            </button>
          </div>

          {!isUnit && <TopicWork topic={topic} />}

          <div className="space-y-1">
            {children.map((c) => (
              <TopicNode key={c.id} topic={c} allTopics={allTopics} depth={depth + 1} onDelete={onDelete} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SubjectDetail() {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const store = useStore();
  const toast = useToast();
  const subject = store.subjects.find((s) => s.id === subjectId);
  const [addOpen, setAddOpen] = useState(false);
  const [addKind, setAddKind] = useState<'unit' | 'topic'>('topic');
  const [parentId, setParentId] = useState('');
  const [name, setName] = useState('');
  const [subs, setSubs] = useState('');
  const [toDelete, setToDelete] = useState<Topic | null>(null);
  const [deleteSubject, setDeleteSubject] = useState(false);

  const all = useMemo(() => (subjectId ? store.topics.filter((t) => t.subjectId === subjectId) : []), [store.topics, subjectId]);
  const roots = useMemo(() => childTopics(all, null), [all]);
  const units = useMemo(() => all.filter((t) => t.kind === 'unit'), [all]);

  if (!subject) {
    return (
      <EmptyState
        title="Subject not found"
        message="It may have been deleted or archived."
        action={
          <Button variant="primary" onClick={() => navigate('/subjects')}>
            Back to subjects
          </Button>
        }
      />
    );
  }

  const stats = subjectStats(subject, store.topics, store.sessions);
  const sessions = store.sessions.filter((s) => s.subjectId === subject.id).sort((a, b) => b.date.localeCompare(a.date));

  const openAdd = (kind: 'unit' | 'topic', parent = '') => {
    setAddKind(kind);
    setParentId(parent);
    setName('');
    setSubs('');
    setAddOpen(true);
  };

  return (
    <div className="space-y-4">
      <Link to="/subjects" className="inline-flex items-center gap-1.5 text-xs text-content-muted hover:text-content">
        <ArrowLeft size={14} /> All subjects
      </Link>

      <Card className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <ProgressRing value={stats.progress} size={86} color={subject.color} sublabel="complete" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold">{subject.name}</h1>
              <Badge tone={CATEGORY_META[subject.category].tone}>{CATEGORY_META[subject.category].label}</Badge>
              <Badge tone={PRIORITY_META[subject.priority].tone}>{PRIORITY_META[subject.priority].label}</Badge>
              {subject.archived && <Badge tone="slate">archived</Badge>}
            </div>
            {subject.description && <p className="mt-1 text-sm text-content-muted">{subject.description}</p>}
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <div>
                <div className="text-sm font-semibold">
                  {stats.completed}/{stats.total}
                </div>
                <div className="text-content-faint">topics complete</div>
              </div>
              <div>
                <div className="flex items-center gap-1 text-sm font-semibold">
                  <Clock size={13} /> {formatMinutes(stats.minutes)}
                </div>
                <div className="text-content-faint">time studied</div>
              </div>
              <div>
                <div className="text-sm font-semibold">{stats.revisionPending}</div>
                <div className="text-content-faint">revision due</div>
              </div>
              <div>
                <div className="text-sm font-semibold">{subject.targetDate ? formatDate(subject.targetDate) : '—'}</div>
                <div className="text-content-faint">target date</div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => openAdd('topic')}>
              Add topic
            </Button>
            <Button size="sm" variant="secondary" icon={<Layers size={14} />} onClick={() => openAdd('unit')}>
              Add unit
            </Button>
            <Button size="sm" variant="secondary" onClick={() => store.setSubjectArchived(subject.id, !subject.archived)}>
              {subject.archived ? 'Restore' : 'Archive'}
            </Button>
            <Button size="sm" variant="ghost" className="text-accent-clay" onClick={() => setDeleteSubject(true)}>
              Delete
            </Button>
          </div>
        </div>

        {stats.weak.length > 0 && (
          <div className="mt-3 rounded-lg border border-accent-sand/30 bg-accent-sand/5 p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-accent-sand">
              <Star size={13} /> Weak areas — low confidence, worth revising
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {stats.weak.map((t) => (
                <Badge key={t.id} tone="sand">
                  {t.name}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Topic tree</h2>
          <span className="text-[11px] text-content-faint">Progress is calculated from checklist items you actually complete</span>
        </div>
        {roots.length === 0 ? (
          <EmptyState
            title="No topics yet"
            message="Break this subject into units and topics to start tracking real progress."
            action={
              <Button variant="primary" size="sm" onClick={() => openAdd('unit')}>
                Add a unit
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-border/60">
            {roots.map((t) => (
              <TopicNode key={t.id} topic={t} allTopics={all} depth={0} onDelete={setToDelete} />
            ))}
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Study sessions ({sessions.length})</h2>
          <Link to="/planner" className="text-xs text-brand hover:underline">
            Log a session
          </Link>
        </div>
        <div className="divide-y">
          {sessions.slice(0, 8).map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-2 text-xs">
              <span className="w-24 shrink-0">{formatDate(s.date)}</span>
              <span className="flex-1 text-content-muted">{s.type.replace('-', ' ')}</span>
              <span className="tabular-nums">{formatMinutes(s.minutes)}</span>
              <Button size="icon-sm" variant="ghost" onClick={() => store.deleteSession(s.id)} aria-label="Delete session">
                <Trash2 size={13} />
              </Button>
            </div>
          ))}
          {sessions.length === 0 && <p className="px-4 py-4 text-xs text-content-faint">No sessions logged for this subject yet.</p>}
        </div>
      </Card>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={addKind === 'unit' ? 'Add a unit' : 'Add a topic'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!name.trim()) return;
                if (addKind === 'unit') {
                  store.addUnit(subject.id, name.trim());
                } else {
                  store.addTopic({
                    subjectId: subject.id,
                    parentId: parentId || null,
                    name: name.trim(),
                    subtopics: subs.split(',').map((s) => s.trim()).filter(Boolean),
                  });
                }
                toast.push(addKind === 'unit' ? 'Unit added' : 'Topic added', { tone: 'success' });
                setAddOpen(false);
              }}
            >
              Add
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label={addKind === 'unit' ? 'Unit name' : 'Topic name'}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={addKind === 'unit' ? 'e.g. Normalization' : 'e.g. Isolation Levels'} />
          </Field>
          {addKind === 'topic' && (
            <>
              <Field label="Parent unit">
                <Select value={parentId} onChange={(e) => setParentId(e.target.value)}>
                  <option value="">— top level —</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Subtopics" hint="Comma separated — each can hold its own checklist.">
                <Input value={subs} onChange={(e) => setSubs(e.target.value)} placeholder="Read Committed, Repeatable Read, Serializable" />
              </Field>
            </>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete topic"
        message={`Delete "${toDelete?.name}" and everything nested under it?`}
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) {
            store.deleteTopic(toDelete.id);
            toast.push('Topic deleted', { tone: 'success', action: { label: 'Undo', onClick: () => store.undo() } });
          }
          setToDelete(null);
        }}
      />

      <ConfirmDialog
        open={deleteSubject}
        title="Delete subject"
        message={`Delete "${subject.name}" and all associated topics? Archiving keeps the history.`}
        onCancel={() => setDeleteSubject(false)}
        onConfirm={() => {
          store.deleteSubject(subject.id);
          navigate('/subjects');
          toast.push('Subject deleted', { tone: 'success', action: { label: 'Undo', onClick: () => store.undo() } });
        }}
      />

      <p className="text-[11px] text-content-faint">Today is {formatDate(todayISO())}. Topic progress averages its checklist work — there is no manual percentage.</p>
    </div>
  );
}
