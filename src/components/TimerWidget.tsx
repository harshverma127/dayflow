import { useEffect, useMemo, useState } from 'react';
import { Pause, Play, RotateCcw, Timer, X } from 'lucide-react';
import { useUi } from '@/uiStore';
import { useStore } from '@/store';
import { Button, Field, Select, useToast, Segmented } from '@/components/ui';
import { STUDY_TYPES, STUDY_TYPE_META } from '@/lib/constants';
import { cn, formatMinutes } from '@/lib/utils';
import type { StudyType } from '@/types';

function fmt(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function TimerWidget() {
  const { timer, timerOpen, setTimerOpen, startTimer, pauseTimer, resetTimer, tick, setTimerPreset, setTimerContext, switchPhase } = useUi();
  const store = useStore();
  const toast = useToast();
  const [type, setType] = useState<StudyType>('learning');

  // single global ticker
  useEffect(() => {
    if (!timer.running) return;
    const id = setInterval(() => tick(), 1000);
    return () => clearInterval(id);
  }, [timer.running, tick]);

  const total = timer.phase === 'focus' ? timer.focusMinutes * 60 : timer.breakMinutes * 60;
  const pomodoroDone = timer.mode === 'pomodoro' && timer.seconds >= total;

  useEffect(() => {
    if (pomodoroDone && timer.running) {
      toast.push(timer.phase === 'focus' ? 'Focus session complete — take a break' : 'Break over — back to it', { tone: 'success' });
      pauseTimer();
      switchPhase();
    }
  }, [pomodoroDone, timer.running, timer.phase, toast, pauseTimer, switchPhase]);

  const save = () => {
    const minutes = Math.max(1, Math.round(timer.seconds / 60));
    store.addSession({ minutes, subjectId: timer.subjectId, topicId: timer.topicId, type, notes: `${timer.mode === 'pomodoro' ? 'Pomodoro' : 'Stopwatch'} session` });
    toast.push(`Logged ${formatMinutes(minutes)}`, { tone: 'success' });
    resetTimer();
  };

  const subjects = useMemo(() => store.subjects.filter((s) => !s.archived), [store.subjects]);
  const topics = useMemo(() => store.topics.filter((t) => !timer.subjectId || t.subjectId === timer.subjectId), [store.topics, timer.subjectId]);
  const progress = timer.mode === 'pomodoro' ? Math.min(100, (timer.seconds / total) * 100) : 0;

  if (!timerOpen) {
    if (!timer.running && timer.seconds === 0) return null;
    return (
      <button
        onClick={() => setTimerOpen(true)}
        className="fixed bottom-20 left-3 z-30 flex items-center gap-2 rounded-full border bg-surface px-3 py-2 text-xs font-medium shadow-lg md:bottom-4 md:left-auto md:right-4"
      >
        <span className={cn('h-2 w-2 rounded-full', timer.running ? 'animate-pulse bg-green-500' : 'bg-amber-500')} />
        <Timer size={14} />
        <span className="font-mono tabular-nums">{fmt(timer.seconds)}</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-x-3 bottom-20 z-40 md:inset-x-auto md:bottom-4 md:right-4 md:w-80">
      <div className="overflow-hidden rounded-xl border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-content-muted">
            <Timer size={14} /> Study timer
          </span>
          <Button variant="ghost" size="icon-sm" onClick={() => setTimerOpen(false)} aria-label="Hide timer">
            <X size={14} />
          </Button>
        </div>
        <div className="space-y-3 p-3">
          <Segmented
            value={timer.mode}
            onChange={(mode) => {
              resetTimer();
              useUi.setState({ timer: { ...useUi.getState().timer, mode } });
            }}
            options={[
              { value: 'pomodoro', label: 'Pomodoro' },
              { value: 'stopwatch', label: 'Stopwatch' },
            ]}
          />

          <div className="text-center">
            <div className="font-mono text-4xl font-semibold tabular-nums">{fmt(timer.seconds)}</div>
            {timer.mode === 'pomodoro' && (
              <div className="mt-1.5 space-y-1">
                <div className="text-[11px] uppercase tracking-wide text-content-faint">
                  {timer.phase === 'focus' ? 'Focus' : 'Break'} · {timer.phase === 'focus' ? timer.focusMinutes : timer.breakMinutes}m
                </div>
                <div className="mx-auto h-1 w-40 overflow-hidden rounded-full bg-surface-muted">
                  <div className="h-full bg-brand transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-2">
            {timer.running ? (
              <Button variant="secondary" icon={<Pause size={15} />} onClick={pauseTimer}>
                Pause
              </Button>
            ) : (
              <Button variant="primary" icon={<Play size={15} />} onClick={() => startTimer()}>
                Start
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={resetTimer} aria-label="Reset timer">
              <RotateCcw size={15} />
            </Button>
            <Button variant="secondary" size="sm" onClick={save} disabled={timer.seconds < 60}>
              Save
            </Button>
          </div>

          {timer.mode === 'pomodoro' && (
            <div className="flex justify-center gap-1.5">
              {[
                { f: 25, b: 5 },
                { f: 50, b: 10 },
                { f: 15, b: 3 },
              ].map((p) => (
                <button
                  key={p.f}
                  onClick={() => setTimerPreset(p.f, p.b)}
                  className={cn(
                    'rounded-md border px-2 py-1 text-[11px] font-medium',
                    timer.focusMinutes === p.f ? 'border-brand bg-brand/10 text-brand' : 'text-content-muted hover:text-content',
                  )}
                >
                  {p.f}/{p.b}
                </button>
              ))}
              <button
                onClick={() => {
                  const f = Number(prompt('Focus minutes', String(timer.focusMinutes)) ?? timer.focusMinutes);
                  const b = Number(prompt('Break minutes', String(timer.breakMinutes)) ?? timer.breakMinutes);
                  if (f > 0 && b > 0) setTimerPreset(f, b);
                }}
                className="rounded-md border px-2 py-1 text-[11px] font-medium text-content-muted hover:text-content"
              >
                Custom
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Field label="Subject">
              <Select
                value={timer.subjectId ?? ''}
                onChange={(e) => setTimerContext(e.target.value || undefined, undefined)}
                className="py-1.5 text-xs"
              >
                <option value="">— none —</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Topic">
              <Select
                value={timer.topicId ?? ''}
                onChange={(e) => setTimerContext(timer.subjectId, e.target.value || undefined)}
                className="py-1.5 text-xs"
              >
                <option value="">— none —</option>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Session type">
            <Select value={type} onChange={(e) => setType(e.target.value as StudyType)} className="py-1.5 text-xs">
              {STUDY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {STUDY_TYPE_META[t].label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>
    </div>
  );
}
