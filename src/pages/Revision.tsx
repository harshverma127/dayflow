import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, CheckCircle2, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useStore } from '@/store';
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Modal, Select, StatCard, Tabs, useToast } from '@/components/ui';
import { PageHeader } from '@/components/common';
import { REVISION_INTERVALS } from '@/lib/constants';
import { addDaysISO, diffDays, formatDate, todayISO } from '@/lib/utils';
import type { RevisionConfidence } from '@/types';

export default function Revision() {
  const store = useStore();
  const toast = useToast();
  const today = todayISO();
  const [tab, setTab] = useState<'due' | 'upcoming' | 'done'>('due');
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [interval, setIntervalDays] = useState(1);
  const [dueDate, setDueDate] = useState(today);

  const active = store.revisions.filter((r) => !r.done);
  const due = active.filter((r) => r.dueDate <= today).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const upcoming = active.filter((r) => r.dueDate > today).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const completed = store.revisions.filter((r) => r.done).sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  const overdue = due.filter((r) => r.dueDate < today).length;

  const REVIEW_OUTCOMES: { value: RevisionConfidence; label: string; message: string }[] = [
    { value: 'independent', label: 'Independently', message: 'Nice — moved to the next interval' },
    { value: 'hint', label: 'Needed a hint', message: 'Scheduled sooner to reinforce it' },
    { value: 'major-help', label: 'Needed help', message: 'Confidence lowered and rescheduled' },
    { value: 'failed', label: "Couldn't recall", message: 'Back a stage — confidence lowered' },
  ];

  const review = (id: string, result: RevisionConfidence) => {
    const item = store.revisions.find((r) => r.id === id);
    store.reviewRevision(id, result);
    const message = REVIEW_OUTCOMES.find((o) => o.value === result)?.message ?? 'Rescheduled';
    toast.push(`${item?.label ?? 'Item'}: ${message}`, { tone: result === 'independent' ? 'success' : 'default' });
  };

  const groupedUpcoming = useMemo(() => {
    const map = new Map<string, typeof upcoming>();
    for (const r of upcoming) {
      const list = map.get(r.dueDate) ?? [];
      list.push(r);
      map.set(r.dueDate, list);
    }
    return [...map.entries()];
  }, [upcoming]);

  const weekDone = store.revisions.filter((r) => r.done && diffDays(today, r.dueDate) <= 7 && diffDays(today, r.dueDate) >= 0).length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Revision"
        description="Spaced repetition across everything you have completed"
        meta={
          <>
            <Badge tone={due.length ? 'amber' : 'green'}>{due.length} due now</Badge>
            {overdue > 0 && <Badge tone="red">{overdue} overdue</Badge>}
            <Badge tone="slate">{upcoming.length} scheduled</Badge>
          </>
        }
        actions={
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => setOpen(true)}>
            Add revision
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Due today" value={due.filter((r) => r.dueDate === today).length} icon={<RotateCcw size={16} />} />
        <StatCard label="Overdue" value={overdue} hint="Not a problem — clear them one by one" icon={<CalendarClock size={16} />} />
        <StatCard label="Scheduled" value={upcoming.length} />
        <StatCard label="Reviewed this week" value={weekDone} icon={<CheckCircle2 size={16} />} />
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-content-muted">
          <span className="font-medium text-content">Intervals:</span>
          {REVISION_INTERVALS.map((i) => (
            <Badge key={i} tone="slate">
              {i === 1 ? '1 day' : `${i} days`}
            </Badge>
          ))}
          <span className="ml-auto text-content-faint">Independent → next interval · Hint → soon · Help → repeat · Couldn't recall → back a stage</span>
        </div>
      </Card>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'due', label: 'Due now', count: due.length },
          { value: 'upcoming', label: 'Upcoming', count: upcoming.length },
          { value: 'done', label: 'Completed', count: completed.length },
        ]}
      />

      {tab === 'due' && (
        <div className="space-y-3">
          {due.length === 0 && <EmptyState title="Nothing due" message="Your revision queue is clear. Complete topics to build it back up." icon={<CheckCircle2 size={20} />} />}
          {due.map((r) => {
            const subject = store.subjects.find((s) => s.id === r.subjectId);
            return (
              <Card key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{r.label}</span>
                    {r.dueDate < today && <Badge tone="red">{diffDays(today, r.dueDate)}d overdue</Badge>}
                    {r.dueDate === today && <Badge tone="amber">due today</Badge>}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-content-faint">
                    <span>Last reviewed {r.lastReviewed ? formatDate(r.lastReviewed) : '—'}</span>
                    <span>Interval {r.intervalDays} day(s)</span>
                    <span>Confidence {r.confidence}/5</span>
                    {subject && <span>{subject.name}</span>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {subject && (
                    <Link to={`/subjects/${subject.id}`} className="mr-1 text-xs font-medium text-brand hover:underline">
                      Revise now →
                    </Link>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => review(r.id, 'independent')}>
                    Independently
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => review(r.id, 'hint')}>
                    Needed a hint
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => review(r.id, 'major-help')}>
                    Needed help
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => review(r.id, 'failed')}>
                    Couldn't recall
                  </Button>
                  <button onClick={() => store.deleteRevisionItem(r.id)} className="text-content-faint hover:text-red-500" aria-label="Remove from revision queue">
                    <Trash2 size={14} />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {tab === 'upcoming' && (
        <div className="space-y-3">
          {groupedUpcoming.length === 0 && <EmptyState title="No upcoming revisions" message="Items appear here once scheduled." />}
          {groupedUpcoming.map(([date, items]) => (
            <Card key={date}>
              <CardHeader title={formatDate(date)} subtitle={`${items.length} item(s) · in ${diffDays(date, today)} day(s)`} />
              <div className="divide-y">
                {items.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium">{r.label}</div>
                      <div className="text-[10px] text-content-faint">confidence {r.confidence}/5 · stage {r.stage + 1}</div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => store.updateRevisionItem(r.id, { dueDate: today })}>
                      Pull to today
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'done' && (
        <Card>
          <div className="divide-y">
            {completed.length === 0 && <p className="px-4 py-5 text-sm text-content-faint">No revisions completed yet.</p>}
            {completed.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium">{r.label}</div>
                  <div className="text-[10px] text-content-faint">{formatDate(r.dueDate)} · confidence {r.confidence}/5</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => store.updateRevisionItem(r.id, { done: false, dueDate: today })}>
                  Reopen
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add revision item"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!label.trim()) {
                  toast.push('Add a label for the revision item', { tone: 'error' });
                  return;
                }
                store.addRevisionItem({ label: label.trim(), subjectId: subjectId || undefined, dueDate, intervalDays: interval, stage: REVISION_INTERVALS.indexOf(interval) });
                setLabel('');
                setOpen(false);
                toast.push('Revision scheduled', { tone: 'success' });
              }}
            >
              Schedule
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="What do you need to revise?">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. OS — Deadlock avoidance" />
          </Field>
          <Field label="Subject">
            <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">— none —</option>
              {store.subjects.filter((s) => !s.archived).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Interval">
              <Select value={interval} onChange={(e) => setIntervalDays(Number(e.target.value))}>
                {REVISION_INTERVALS.map((i) => (
                  <option key={i} value={i}>
                    {i} day(s)
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Due date" hint={`Suggested: ${addDaysISO(today, interval)}`}>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}
