import { create } from 'zustand';
import type { ID } from '@/types';

export type TimerMode = 'stopwatch' | 'pomodoro';

interface UiState {
  commandOpen: boolean;
  quickAddOpen: boolean;
  mobileNavOpen: boolean;
  timerOpen: boolean;
  timer: {
    running: boolean;
    mode: TimerMode;
    seconds: number;
    phase: 'focus' | 'break';
    focusMinutes: number;
    breakMinutes: number;
    subjectId?: ID;
    topicId?: ID;
  };
  setCommandOpen: (v: boolean) => void;
  setQuickAddOpen: (v: boolean) => void;
  setMobileNavOpen: (v: boolean) => void;
  setTimerOpen: (v: boolean) => void;
  startTimer: (patch?: Partial<UiState['timer']>) => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  tick: () => void;
  setTimerPreset: (focus: number, brk: number) => void;
  setTimerContext: (subjectId?: ID, topicId?: ID) => void;
  switchPhase: () => void;
}

export const useUi = create<UiState>((set) => ({
  commandOpen: false,
  quickAddOpen: false,
  mobileNavOpen: false,
  timerOpen: false,
  timer: {
    running: false,
    mode: 'pomodoro',
    seconds: 0,
    phase: 'focus',
    focusMinutes: 25,
    breakMinutes: 5,
  },
  setCommandOpen: (v) => set({ commandOpen: v }),
  setQuickAddOpen: (v) => set({ quickAddOpen: v }),
  setMobileNavOpen: (v) => set({ mobileNavOpen: v }),
  setTimerOpen: (v) => set({ timerOpen: v }),
  startTimer: (patch) => set((s) => ({ timer: { ...s.timer, ...patch, running: true } })),
  pauseTimer: () => set((s) => ({ timer: { ...s.timer, running: false } })),
  resetTimer: () => set((s) => ({ timer: { ...s.timer, running: false, seconds: 0, phase: 'focus' } })),
  tick: () => set((s) => ({ timer: { ...s.timer, seconds: s.timer.seconds + 1 } })),
  setTimerPreset: (focus, brk) => set((s) => ({ timer: { ...s.timer, focusMinutes: focus, breakMinutes: brk, seconds: 0, running: false, phase: 'focus' } })),
  setTimerContext: (subjectId, topicId) => set((s) => ({ timer: { ...s.timer, subjectId, topicId } })),
  switchPhase: () => set((s) => ({ timer: { ...s.timer, phase: s.timer.phase === 'focus' ? 'break' : 'focus', seconds: 0 } })),
}));
