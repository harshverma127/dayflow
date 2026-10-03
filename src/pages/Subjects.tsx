import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, ArrowRight, BookOpen, MoreVertical, Plus, Search } from 'lucide-react';
import { useStore } from '@/store';
import { Badge, Button, Card, ConfirmDialog, Dropdown, EmptyState, Field, Input, Modal, Select, Textarea, useToast } from '@/components/ui';
import { MetricBar, PageHeader } from '@/components/common';
import { CATEGORIES, CATEGORY_META, DIFFICULTIES, DIFFICULTY_META, PRIORITIES, PRIORITY_META, SUBJECT_COLORS } from '@/lib/constants';
import { formatDate, formatMinutes } from '@/lib/utils';
import { subjectStats } from '@/lib/progress';
import type { Difficulty, Priority, Subject, SubjectCategory } from '@/types';

const blank = {
  name: '',
  description: '',
  category: 'core-cs' as SubjectCategory,
  priority: 'high' as Priority,
  difficulty: 'medium' as Difficulty,
  targetDate: '',
  weeklyTargetHours: 8,
  color: SUBJECT_COLORS[0],
  topicsText: '',
};

export default function Subjects() {
  const store = useStore();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState<'all' | SubjectCategory>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [form, setForm] = useState({ ...blank });
  const [toDelete, setToDelete] = useState<Subject | null>(null);

  const subjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    return store.subjects
      .filter((s) => (showArchived ? true : !s.archived))
      .filter((s) => (catFilter === 'all' ? true : s.category === catFilter))
      .filter((s) => (q ? s.name.toLowerCase().includes(q) || (s.description ?? '').toLowerCase().includes(q) : true))
      .sort((a, b) => a.order - b.order)
      .map((s) => ({ subject: s, stats: subjectStats(s, store.topics, store.sessions) }));
  }, [store, query, catFilter, showArchived]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...blank });
    setFormOpen(true);
  };

  const openEdit = (s: Subject) => {
    setEditing(s);
    setForm({
      name: s.name,
      description: s.description ?? '',
      category: s.category,
      priority: s.priority,
      difficulty: s.difficulty,
      targetDate: s.targetDate ?? '',
      weeklyTargetHours: s.weeklyTargetHours ?? 8,
      color: s.color,
      topicsText: '',
    });
    setFormOpen(true);
  };

  const save = () => {
    if (!form.name.trim()) {
      toast.push('Subject name is required', { tone: 'error' });
      return;
    }
    const parsed = form.topicsText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, subs] = line.split('|');
        return { name: name.trim(), subs: (subs ?? '').split(',').map((x) => x.trim()).filter(Boolean) };
      });
    const payload = {
      name: form.name.trim(),
      description: form.description,
      category: form.category,
      priority: form.priority,
      difficulty: form.difficulty,
      targetDate: form.targetDate || undefined,
      weeklyTargetHours: form.weeklyTargetHours,
      color: form.color,
    };
    if (editing) {
      store.updateSubject(editing.id, payload);
      toast.push('Subject updated', { tone: 'success' });
    } else {
      store.addSubject({
        ...payload,
        units: parsed.length ? [{ name: 'Core topics', topics: parsed }] : [],
      });
      toast.push('Subject created', { tone: 'success' });
    }
    setFormOpen(false);
  };

  const move = (subject: Subject, dir: -1 | 1) => {
    const ordered = [...store.subjects].sort((a, b) => a.order - b.order);
    const idx = ordered.findIndex((s) => s.id === subject.id);
    const swap = ordered[idx + dir];
    if (!swap) return;
    store.updateSubject(subject.id, { order: swap.order });
    store.updateSubject(swap.id, { order: subject.order });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Subjects"
        description="Everything you are preparing, organised as subjects → topics → subtopics"
        meta={
          <>
            <Badge tone="slate">{store.subjects.filter((s) => !s.archived).length} active</Badge>
            <Badge tone="slate">{store.topics.length} topics</Badge>
            <Badge tone="slate">{store.topics.reduce((a, t) => a + t.subtopics.length, 0)} subtopics</Badge>
          </>
        }
        actions={
          <Button variant="primary" icon={<Plus size={15} />} onClick={openCreate}>
            Add Subject
          </Button>
        }
      />

      <Card className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-content-faint" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search subjects…" className="pl-8" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={catFilter} onChange={(e) => setCatFilter(e.target.value as typeof catFilter)} className="w-auto py-1.5 text-xs">
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_META[c].label}
              </option>
            ))}
          </Select>
          <Button size="sm" variant={showArchived ? 'primary' : 'secondary'} onClick={() => setShowArchived((v) => !v)}>
            {showArchived ? 'Showing archived' : 'Show archived'}
          </Button>
        </div>
      </Card>

      {subjects.length === 0 ? (
        <EmptyState
          title="No subjects yet"
          message="Create your first subject — you can nest topics and subtopics inside it."
          action={
            <Button variant="primary" icon={<Plus size={15} />} onClick={openCreate}>
              Add Subject
            </Button>
          }
          icon={<BookOpen size={20} />}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {subjects.map(({ subject, stats }) => (
            <Card key={subject.id} className="flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2.5">
                  <span className="mt-0.5 h-9 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: subject.color }} />
                  <div className="min-w-0">
                    <Link to={`/subjects/${subject.id}`} className="block truncate text-sm font-semibold hover:text-brand">
                      {subject.name}
                    </Link>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge tone={CATEGORY_META[subject.category].tone}>{CATEGORY_META[subject.category].label}</Badge>
                      <Badge tone={PRIORITY_META[subject.priority].tone}>{PRIORITY_META[subject.priority].label}</Badge>
                      {subject.archived && <Badge tone="slate">archived</Badge>}
                    </div>
                  </div>
                </div>
                <Dropdown
                  trigger={
                    <button className="rounded-md p-1 text-content-faint hover:bg-surface-muted hover:text-content" aria-label="Subject actions">
                      <MoreVertical size={16} />
                    </button>
                  }
                  items={[
                    { label: 'Edit', onSelect: () => openEdit(subject) },
                    { label: 'Move up', onSelect: () => move(subject, -1) },
                    { label: 'Move down', onSelect: () => move(subject, 1) },
                    { label: subject.archived ? 'Unarchive' : 'Archive', onSelect: () => store.updateSubject(subject.id, { archived: !subject.archived }) },
                    { label: 'Delete', danger: true, onSelect: () => setToDelete(subject) },
                  ]}
                />
              </div>

              {subject.description && <p className="mt-2 line-clamp-2 text-xs text-content-muted">{subject.description}</p>}

              <div className="mt-3 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-content-muted">Completion</span>
                  <span className="font-semibold tabular-nums">{stats.progress}%</span>
                </div>
                <MetricBar label={`${stats.completed} of ${stats.total} topics complete`} value={stats.progress} color={subject.color} right="" />
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
                <div>
                  <div className="text-sm font-semibold">{stats.completed}/{stats.total}</div>
                  <div className="text-content-faint">topics</div>
                </div>
                <div>
                  <div className="text-sm font-semibold">{formatMinutes(stats.minutes)}</div>
                  <div className="text-content-faint">studied</div>
                </div>
                <div>
                  <div className="text-sm font-semibold">{stats.weak.length}</div>
                  <div className="text-content-faint">weak</div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t pt-3 text-[11px] text-content-faint">
                <span>Last: {stats.lastStudied ? formatDate(stats.lastStudied) : '—'}</span>
                <span>Due: {subject.targetDate ? formatDate(subject.targetDate) : '—'}</span>
              </div>

              {stats.nextTopic && (
                <Link to={`/subjects/${subject.id}`} className="mt-2 flex items-center gap-1.5 text-xs text-brand hover:underline">
                  <ArrowRight size={13} /> Next: {stats.nextTopic.name}
                </Link>
              )}

              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] text-content-faint">{DIFFICULTY_META[subject.difficulty].label} difficulty</span>
                <Link to={`/subjects/${subject.id}`} className="text-[11px] font-medium text-brand hover:underline">
                  Open
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'Add Subject'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save}>
              {editing ? 'Save changes' : 'Create subject'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Subject name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Advanced DBMS" />
          </Field>
          <Field label="Description">
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What does this subject cover?" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Category">
              <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as SubjectCategory })}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_META[c].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Priority">
              <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_META[p].label}
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
            <Field label="Target completion date">
              <Input type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} />
            </Field>
            <Field label="Weekly target (hours)">
              <Input type="number" min={1} value={form.weeklyTargetHours} onChange={(e) => setForm({ ...form, weeklyTargetHours: Number(e.target.value) })} />
            </Field>
          </div>

          <Field label="Colour">
            <div className="flex flex-wrap gap-2">
              {SUBJECT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setForm({ ...form, color: c })}
                  aria-label={`Colour ${c}`}
                  className={`h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-surface transition-transform ${form.color === c ? 'ring-brand' : 'ring-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </Field>

          {!editing && (
            <Field
              label="Topics (optional)"
              hint="One per line. Use  Topic | subtopic, subtopic  to add subtopics."
            >
              <Textarea
                value={form.topicsText}
                onChange={(e) => setForm({ ...form, topicsText: e.target.value })}
                placeholder={'Transactions | ACID, Commit, Rollback\nIndexing | B-Tree, Composite Index'}
                className="min-h-[110px] font-mono text-xs"
              />
            </Field>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete subject"
        message={`Delete "${toDelete?.name}" and all of its topics, subtopics and sessions? This cannot be undone automatically, but you can use Undo right after.`}
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) {
            store.deleteSubject(toDelete.id);
            toast.push('Subject deleted', {
              tone: 'success',
              action: { label: 'Undo', onClick: () => store.undo() },
            });
          }
          setToDelete(null);
        }}
      />

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" icon={<Archive size={14} />} onClick={() => setShowArchived((v) => !v)}>
          {showArchived ? 'Hide' : 'Show'} archived
        </Button>
      </div>
    </div>
  );
}
