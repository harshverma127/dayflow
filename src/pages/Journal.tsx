import { useMemo, useState } from 'react';
import { NotebookPen, Plus, Trash2 } from 'lucide-react';
import { useStore } from '@/store';
import { Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, Modal, Select, StatCard, Textarea, useToast } from '@/components/ui';
import { PageHeader } from '@/components/common';
import { ChartCard, DonutChart } from '@/components/charts';
import { MISTAKE_META, MISTAKE_TYPES } from '@/lib/constants';
import { diffDays, formatDate, todayISO, addDaysISO } from '@/lib/utils';
import type { JournalEntry, MistakeType } from '@/types';

export default function Journal() {
  const store = useStore();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<JournalEntry | null>(null);
  const [toDelete, setToDelete] = useState<JournalEntry | null>(null);
  const [filter, setFilter] = useState<'all' | MistakeType>('all');
  const [form, setForm] = useState({
    problem: '',
    problemId: '',
    mistakeType: 'pattern-not-recognized' as MistakeType,
    whyStuck: '',
    correctIdea: '',
    remember: '',
    date: todayISO(),
    revisitDate: addDaysISO(todayISO(), 3),
  });

  const entries = useMemo(
    () => [...store.journal].filter((j) => (filter === 'all' ? true : j.mistakeType === filter)).sort((a, b) => b.date.localeCompare(a.date)),
    [store.journal, filter],
  );

  const dueForRevisit = store.journal.filter((j) => j.revisitDate && j.revisitDate <= todayISO());

  const openCreate = () => {
    setEditing(null);
    setForm({ problem: '', problemId: '', mistakeType: 'pattern-not-recognized', whyStuck: '', correctIdea: '', remember: '', date: todayISO(), revisitDate: addDaysISO(todayISO(), 3) });
    setOpen(true);
  };

  const save = () => {
    if (!form.problem.trim()) {
      toast.push('Which problem was it?', { tone: 'error' });
      return;
    }
    const payload = { ...form, problemId: form.problemId || undefined, revisitDate: form.revisitDate || undefined };
    if (editing) {
      store.updateJournal(editing.id, payload);
      toast.push('Journal entry updated', { tone: 'success' });
    } else {
      store.addJournal(payload);
      toast.push('Mistake logged — this one is gold', { tone: 'success' });
    }
    setOpen(false);
  };

  const byType = MISTAKE_TYPES.map((t) => ({ label: MISTAKE_META[t].label, value: store.journal.filter((j) => j.mistakeType === t).length })).filter((x) => x.value > 0);
  const topMistake = [...byType].sort((a, b) => b.value - a.value)[0];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Problem-Solving Journal"
        description="Log what went wrong so you never repeat it"
        meta={
          <>
            <Badge tone="slate">{store.journal.length} entries</Badge>
            {dueForRevisit.length > 0 && <Badge tone="amber">{dueForRevisit.length} to revisit</Badge>}
          </>
        }
        actions={
          <Button variant="primary" icon={<Plus size={15} />} onClick={openCreate}>
            Log a mistake
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Entries" value={store.journal.length} icon={<NotebookPen size={16} />} />
        <StatCard label="To revisit" value={dueForRevisit.length} />
        <StatCard label="Top mistake" value={topMistake?.label ?? '—'} />
        <StatCard label="Distinct problems" value={new Set(store.journal.map((j) => j.problem)).size} />
      </div>

      {store.journal.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-3">
          <ChartCard title="Mistake distribution" subtitle="What actually trips you up" className="lg:col-span-2">
            <DonutChart data={byType} />
          </ChartCard>
          <Card className="p-4">
            <h3 className="text-sm font-semibold">Pattern to watch</h3>
            <p className="mt-1 text-xs text-content-muted">
              Your most common mistake type is <span className="font-medium text-content">{topMistake?.label ?? 'unknown'}</span>. Before your next contest or mock, re-read these entries and name the pattern out loud.
            </p>
            <div className="mt-3 space-y-2">
              {byType.slice(0, 4).map((t) => (
                <div key={t.label} className="flex items-center justify-between text-xs">
                  <span className="text-content-muted">{t.label}</span>
                  <span className="tabular-nums">{t.value}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      <Card className="flex flex-wrap items-center gap-2 p-3">
        <Select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="w-auto py-1.5 text-xs">
          <option value="all">All mistake types</option>
          {MISTAKE_TYPES.map((t) => (
            <option key={t} value={t}>
              {MISTAKE_META[t].label}
            </option>
          ))}
        </Select>
        <span className="ml-auto text-xs text-content-faint">Mistake categories: {MISTAKE_TYPES.length}</span>
      </Card>

      {entries.length === 0 ? (
        <EmptyState title="No entries yet" message="After a problem you struggled with, write down what went wrong. It compounds fast." action={<Button variant="primary" icon={<Plus size={15} />} onClick={openCreate}>Log a mistake</Button>} icon={<NotebookPen size={20} />} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {entries.map((j) => (
            <Card key={j.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{j.problem}</span>
                    <Badge tone={MISTAKE_META[j.mistakeType].tone}>{MISTAKE_META[j.mistakeType].label}</Badge>
                  </div>
                  <div className="mt-1 text-[11px] text-content-faint">
                    {formatDate(j.date)}
                    {j.revisitDate && (
                      <span className={j.revisitDate <= todayISO() ? 'ml-2 text-amber-500' : 'ml-2'}>
                        revisit {formatDate(j.revisitDate)} {j.revisitDate <= todayISO() ? `(${diffDays(todayISO(), j.revisitDate)}d ago)` : ''}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(j); setForm({ problem: j.problem, problemId: j.problemId ?? '', mistakeType: j.mistakeType, whyStuck: j.whyStuck ?? '', correctIdea: j.correctIdea ?? '', remember: j.remember ?? '', date: j.date, revisitDate: j.revisitDate ?? '' }); setOpen(true); }}>
                    Edit
                  </Button>
                  <button onClick={() => setToDelete(j)} className="text-content-faint hover:text-red-500" aria-label="Delete entry">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="mt-3 space-y-2 text-xs">
                {j.whyStuck && (
                  <div>
                    <span className="text-content-faint">Why I got stuck: </span>
                    <span className="text-content-muted">{j.whyStuck}</span>
                  </div>
                )}
                {j.correctIdea && (
                  <div>
                    <span className="text-content-faint">Correct idea: </span>
                    <span className="text-content-muted">{j.correctIdea}</span>
                  </div>
                )}
                {j.remember && (
                  <div className="rounded-lg border border-brand/20 bg-brand/5 p-2">
                    <span className="text-content-faint">Remember: </span>
                    <span>{j.remember}</span>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit journal entry' : 'Log a mistake'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save}>
              {editing ? 'Save entry' : 'Save entry'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Problem">
            <Input value={form.problem} onChange={(e) => setForm({ ...form, problem: e.target.value })} placeholder="e.g. Subarray Sum Equals K" />
          </Field>
          <Field label="Link to a tracked problem (optional)">
            <Select value={form.problemId} onChange={(e) => setForm({ ...form, problemId: e.target.value })}>
              <option value="">— none —</option>
              {store.dsaProblems.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Mistake type">
              <Select value={form.mistakeType} onChange={(e) => setForm({ ...form, mistakeType: e.target.value as MistakeType })}>
                {MISTAKE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {MISTAKE_META[t].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Date">
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
          </div>
          <Field label="Why I got stuck">
            <Textarea value={form.whyStuck} onChange={(e) => setForm({ ...form, whyStuck: e.target.value })} />
          </Field>
          <Field label="Correct idea / approach">
            <Input value={form.correctIdea} onChange={(e) => setForm({ ...form, correctIdea: e.target.value })} placeholder="e.g. Prefix sum + hashmap" />
          </Field>
          <Field label="What to remember next time">
            <Textarea value={form.remember} onChange={(e) => setForm({ ...form, remember: e.target.value })} />
          </Field>
          <Field label="Revisit date">
            <Input type="date" value={form.revisitDate} onChange={(e) => setForm({ ...form, revisitDate: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete journal entry"
        message={`Delete the entry for "${toDelete?.problem}"?`}
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) {
            store.deleteJournal(toDelete.id);
            toast.push('Entry deleted', { tone: 'success', action: { label: 'Undo', onClick: () => store.undo() } });
          }
          setToDelete(null);
        }}
      />
    </div>
  );
}
