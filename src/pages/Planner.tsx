import { useMemo, useState } from 'react';
import { ArrowRight, CalendarCheck, Download, Plus, Trash2, Undo2 } from 'lucide-react';
import { useStore } from '@/store';
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Modal, ProgressBar, Select, useToast } from '@/components/ui';
import { PageHeader, ToggleRow } from '@/components/common';
import { PRIORITIES, PRIORITY_META, TIERS, TIER_META } from '@/lib/constants';
import { download, formatDate, formatMinutes, startOfWeekISO, todayISO, addDaysISO, toCSV } from '@/lib/utils';
import type { Priority, TaskTier } from '@/types';

export default function Planner() {
  const store = useStore();
  const toast = useToast();
  const [date, setDate] = useState(todayISO());
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [tier, setTier] = useState<TaskTier>('normal');
  const [priority, setPriority] = useState<Priority>('medium');
  const [minutes, setMinutes] = useState(45);
  const [subjectId, setSubjectId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [showCarry, setShowCarry] = useState(true);

  const allTasks = store.tasks;
  const dayTasks = allTasks.filter((t) => t.date === date).sort((a, b) => TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier));
  const done = dayTasks.filter((t) => t.done);
  const plannedMinutes = dayTasks.reduce((a, t) => a + t.estimatedMinutes, 0);
  const doneMinutes = done.reduce((a, t) => a + t.estimatedMinutes, 0);

  const backlog = useMemo(
    () => allTasks.filter((t) => !t.done && t.date < date).sort((a, b) => b.date.localeCompare(a.date)),
    [allTasks, date],
  );

  const weekMinutes = useMemo(() => {
    const start = startOfWeekISO();
    return Array.from({ length: 7 }, (_, i) => addDaysISO(start, i)).map((d) => ({
      date: d,
      minutes: store.sessions.filter((s) => s.date === d).reduce((a, s) => a + s.minutes, 0),
    }));
  }, [store.sessions]);

  const subjects = store.subjects.filter((s) => !s.archived);
  const topics = store.topics.filter((t) => !subjectId || t.subjectId === subjectId);

  const addTask = () => {
    if (!title.trim()) {
      toast.push('Task title required', { tone: 'error' });
      return;
    }
    store.addTask({ title: title.trim(), date, tier, priority, estimatedMinutes: minutes, subjectId: subjectId || undefined, topicId: topicId || undefined });
    setTitle('');
    setOpen(false);
    toast.push('Task added', { tone: 'success' });
  };

  const subjectName = (id?: string) => store.subjects.find((s) => s.id === id)?.name;
  const topicName = (id?: string) => store.topics.find((t) => t.id === id)?.name;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Daily Planner"
        description="Plan the day, then tick it off"
        meta={
          <>
            <Badge tone="blue">{done.length}/{dayTasks.length} done</Badge>
            <Badge tone="slate">{formatMinutes(doneMinutes)} of {formatMinutes(plannedMinutes)} planned</Badge>
          </>
        }
        actions={
          <>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto py-1.5 text-xs" aria-label="Planner date" />
            <Button variant="ghost" size="sm" icon={<Download size={14} />} onClick={() => download(`planner-${date}.csv`, toCSV(dayTasks.map((t) => ({ title: t.title, date: t.date, tier: t.tier, priority: t.priority, minutes: t.estimatedMinutes, done: t.done }))), 'text/csv')} className="hidden sm:inline-flex">
              Export
            </Button>
            <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setOpen(true)}>
              Add task
            </Button>
          </>
        }
      />

      <Card className="p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium">{formatDate(date)}</div>
            <div className="text-xs text-content-muted">Planned vs completed</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold tabular-nums">{dayTasks.length ? Math.round((done.length / dayTasks.length) * 100) : 0}%</div>
            <div className="text-[11px] text-content-faint">of today's plan</div>
          </div>
        </div>
        <ProgressBar value={dayTasks.length ? (done.length / dayTasks.length) * 100 : 0} className="mt-3" size="lg" />
      </Card>

      <div className="grid gap-3 lg:grid-cols-3">
        {TIERS.map((t) => {
          const items = dayTasks.filter((x) => x.tier === t);
          return (
            <Card key={t} className="flex flex-col">
              <CardHeader
                title={TIER_META[t].label}
                subtitle={`${items.filter((i) => i.done).length}/${items.length} complete`}
                action={
                  <Button size="icon-sm" variant="ghost" aria-label={`Add ${TIER_META[t].label} task`} onClick={() => { setTier(t); setOpen(true); }}>
                    <Plus size={14} />
                  </Button>
                }
              />
              <div className="flex-1 divide-y">
                {items.length === 0 && <p className="px-4 py-5 text-xs text-content-faint">Nothing here yet.</p>}
                {items.map((task) => (
                  <div key={task.id} className="flex items-start gap-2.5 px-4 py-2.5">
                    <input type="checkbox" checked={task.done} onChange={() => store.toggleTask(task.id)} className="mt-0.5 h-4 w-4 shrink-0 accent-[rgb(var(--brand))]" aria-label={task.title} />
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm ${task.done ? 'text-content-faint line-through' : ''}`}>{task.title}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-content-faint">
                        <Badge tone={PRIORITY_META[task.priority].tone}>{PRIORITY_META[task.priority].label}</Badge>
                        <span>{task.estimatedMinutes}m</span>
                        {subjectName(task.subjectId) && <span>· {subjectName(task.subjectId)}</span>}
                        {topicName(task.topicId) && <span>· {topicName(task.topicId)}</span>}
                      </div>
                    </div>
                    <button onClick={() => store.deleteTask(task.id)} className="text-content-faint hover:text-red-500" aria-label="Delete task">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Missed tasks"
            subtitle={`${backlog.length} task(s) rolled over`}
            action={
              backlog.length > 0 && (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Undo2 size={14} />}
                  onClick={() => {
                    backlog.forEach((t) => store.updateTask(t.id, { date }));
                    toast.push(`Moved ${backlog.length} task(s) to ${formatDate(date)}`, { tone: 'success' });
                  }}
                >
                  Move all to today
                </Button>
              )
            }
          />
          <div className="divide-y">
            {backlog.slice(0, 6).map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 px-4 py-2">
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium">{t.title}</div>
                  <div className="text-[10px] text-content-faint">was due {formatDate(t.date)}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => store.updateTask(t.id, { date })}>
                  Move here
                </Button>
              </div>
            ))}
            {backlog.length === 0 && <p className="px-4 py-4 text-xs text-content-faint">Nothing overdue. Great.</p>}
          </div>
        </Card>

        <Card>
          <CardHeader title="Week at a glance" subtitle="Logged study minutes" icon={<CalendarCheck size={16} />} />
          <div className="space-y-2 p-4">
            {weekMinutes.map((d) => (
              <div key={d.date} className="flex items-center gap-3">
                <span className="w-14 shrink-0 text-[11px] text-content-muted">{formatDate(d.date).slice(0, 6)}</span>
                <div className="flex-1">
                  <ProgressBar value={Math.min(100, (d.minutes / (store.settings.dailyTargetHours * 60)) * 100)} size="sm" />
                </div>
                <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-content-faint">{formatMinutes(d.minutes)}</span>
              </div>
            ))}
          </div>
          <div className="border-t px-4 py-3">
            <ToggleRow label="Show carry-over prompts" checked={showCarry} onChange={setShowCarry} description="Highlight tasks missed on previous days" />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Jump to a day" subtitle="Open the planner for any date" />
        <div className="flex flex-wrap gap-2 p-4">
          {Array.from({ length: 7 }, (_, i) => addDaysISO(startOfWeekISO(), i)).map((d) => (
            <Button key={d} size="sm" variant={d === date ? 'primary' : 'secondary'} onClick={() => setDate(d)}>
              {formatDate(d)}
            </Button>
          ))}
          <Button size="sm" variant="ghost" icon={<ArrowRight size={14} />} onClick={() => setDate(todayISO())}>
            Today
          </Button>
        </div>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add task"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={addTask}>
              Add task
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="What do you need to do?">
            <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Solve 2 DP problems" onKeyDown={(e) => e.key === 'Enter' && addTask()} />
          </Field>
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
        </div>
      </Modal>

      {dayTasks.length === 0 && (
        <EmptyState
          title="No plan for this day"
          message="Add the tasks you want to complete and they will roll into your dashboard focus."
          action={
            <Button variant="primary" icon={<Plus size={15} />} onClick={() => setOpen(true)}>
              Plan this day
            </Button>
          }
        />
      )}
    </div>
  );
}
