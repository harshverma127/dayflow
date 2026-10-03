import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronDown, Clock, Flag, Plus, Target } from 'lucide-react';
import { useStore } from '@/store';
import { Badge, Button, Card, Field, Input, Modal, ProgressBar, Select, useToast } from '@/components/ui';
import { CheckRow, MetricBar, PageHeader } from '@/components/common';
import { PRIORITIES, PRIORITY_META } from '@/lib/constants';
import { cn, formatDate, formatMinutes } from '@/lib/utils';
import { onTrackAssessment, roadmapStats, weekStatus } from '@/lib/progress';
import type { Priority, RoadmapWeek } from '@/types';

const STATUS_META: Record<string, { label: string; tone: string }> = {
  'not-started': { label: 'Not Started', tone: 'slate' },
  'in-progress': { label: 'In Progress', tone: 'blue' },
  'on-track': { label: 'On Track', tone: 'green' },
  'at-risk': { label: 'At Risk', tone: 'red' },
  completed: { label: 'Completed', tone: 'emerald' },
};

function WeekCard({ week }: { week: RoadmapWeek }) {
  const store = useStore();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [minutes, setMinutes] = useState(120);
  const [priority, setPriority] = useState<Priority>('medium');
  const [editing, setEditing] = useState(false);
  const [focus, setFocus] = useState(week.focus);
  const [hours, setHours] = useState(week.expectedHours);

  const done = week.tasks.filter((t) => t.done).length;
  const progress = week.tasks.length ? Math.round((done / week.tasks.length) * 100) : 0;
  const status = weekStatus(week);
  const actualMinutes = store.sessions
    .filter((s) => s.date >= week.startDate && s.date <= week.endDate)
    .reduce((a, s) => a + s.minutes, 0);

  const plannedMinutes = week.tasks.reduce((a, t) => a + t.estimatedMinutes, 0);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-surface-muted text-center">
            <span className="text-[9px] font-medium uppercase text-content-faint">Week</span>
            <span className="text-sm font-bold leading-none">{week.weekNumber}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-semibold">{week.title}</h3>
              <Badge tone={STATUS_META[status].tone}>{STATUS_META[status].label}</Badge>
            </div>
            <p className="mt-0.5 line-clamp-1 text-xs text-content-muted">{week.focus}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-content-faint">
              <span className="flex items-center gap-1">
                <CalendarDays size={11} /> {formatDate(week.startDate)} → {formatDate(week.endDate)}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={11} /> {formatMinutes(actualMinutes)} / {week.expectedHours}h
              </span>
              <span className="flex items-center gap-1">
                <Flag size={11} /> {done}/{week.tasks.length} tasks
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:w-52 sm:flex-col sm:items-stretch">
          <MetricBar label="Week progress" value={progress} />
          <div className="flex gap-1.5 sm:mt-1">
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button size="sm" variant="secondary" icon={<ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} />} onClick={() => setOpen((v) => !v)}>
              Tasks
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t px-4 py-2">
        <span className="text-[11px] text-content-faint">Subjects:</span>
        {week.subjectNames.map((n) => (
          <Badge key={n} tone="blue">
            {n}
          </Badge>
        ))}
        <span className="ml-auto text-[11px] text-content-faint">Planned {formatMinutes(plannedMinutes)}</span>
      </div>

      {open && (
        <div className="border-t bg-surface-muted/40">
          <div className="divide-y">
            {week.tasks.map((t) => (
              <CheckRow
                key={t.id}
                checked={t.done}
                onChange={() => store.toggleRoadmapTask(week.id, t.id)}
                label={t.title}
                sub={`${t.type.replace('-', ' ')} · ${t.estimatedMinutes}m`}
                right={<Badge tone={PRIORITY_META[t.priority].tone}>{PRIORITY_META[t.priority].label}</Badge>}
              />
            ))}
            {week.tasks.length === 0 && <p className="px-4 py-4 text-xs text-content-faint">No tasks in this week yet.</p>}
          </div>
          <div className="flex items-center gap-2 px-3 py-2">
            <Button size="sm" variant="ghost" icon={<Plus size={14} />} onClick={() => setAdding(true)}>
              Add task
            </Button>
            {week.subjectIds[0] && (
              <Link to={`/subjects/${week.subjectIds[0]}`} className="text-xs text-brand hover:underline">
                Open subjects
              </Link>
            )}
          </div>
        </div>
      )}

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title={`Add task to ${week.title}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!title.trim()) return;
                store.addRoadmapTask(week.id, { title: title.trim(), type: 'core-cs', estimatedMinutes: minutes, priority });
                setTitle('');
                setAdding(false);
                toast.push('Roadmap task added', { tone: 'success' });
              }}
            >
              Add
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Task">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Revise indexing internals" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Estimated minutes">
              <Input type="number" min={15} step={15} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
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
        </div>
      </Modal>

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title={`Edit ${week.title}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                store.updateRoadmapWeek(week.id, { focus, expectedHours: hours });
                setEditing(false);
                toast.push('Week updated', { tone: 'success' });
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Main focus">
            <Input value={focus} onChange={(e) => setFocus(e.target.value)} />
          </Field>
          <Field label="Expected hours">
            <Input type="number" min={1} value={hours} onChange={(e) => setHours(Number(e.target.value))} />
          </Field>
        </div>
      </Modal>
    </Card>
  );
}

export default function Roadmap() {
  const store = useStore();
  const stats = roadmapStats(store);
  const assessment = onTrackAssessment(store);

  const tone: Record<string, string> = { ahead: 'green', 'on-track': 'green', 'slightly-behind': 'amber', 'significantly-behind': 'red' };

  return (
    <div className="space-y-4">
      <PageHeader
        title="My Roadmap"
        description={`${stats.totalWeeks}-week placement roadmap`}
        meta={
          <>
            <Badge tone="slate">{stats.doneTasks}/{stats.totalTasks} tasks complete</Badge>
            <Badge tone="blue">{stats.daysRemaining} days remaining</Badge>
            <Badge tone={tone[assessment.level]}>
              <Target size={11} /> {assessment.level.replace('-', ' ')}
            </Badge>
          </>
        }
      />

      <Card className="p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium">Roadmap progress</div>
            <div className="text-xs text-content-muted">{assessment.reason}</div>
          </div>
          <span className="text-2xl font-semibold tabular-nums">{stats.progress}%</span>
        </div>
        <ProgressBar value={stats.progress} className="mt-3" size="lg" />
        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-lg font-semibold">{stats.week?.weekNumber ?? '—'}</div>
            <div className="text-[11px] text-content-faint">current week</div>
          </div>
          <div>
            <div className="text-lg font-semibold">{formatMinutes(store.sessions.reduce((a, s) => a + s.minutes, 0))}</div>
            <div className="text-[11px] text-content-faint">hours studied</div>
          </div>
          <div>
            <div className="text-lg font-semibold">{store.subjects.filter((s) => !s.archived).length}</div>
            <div className="text-[11px] text-content-faint">active subjects</div>
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        {store.roadmap.map((w) => (
          <WeekCard key={w.id} week={w} />
        ))}
      </div>
    </div>
  );
}
