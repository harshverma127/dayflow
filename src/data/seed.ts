import type { AppData, Settings } from '@/types';
import { todayISO } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Empty workspace
//
// PrepTrack ships with NO user data. A brand-new install contains zero
// subjects, problems, sessions, projects… — only neutral configuration
// defaults. Everything else is created by the user (or imported).
//
// If you ever need a fixture for a test, build one locally rather than
// re-introducing sample content here.
// ---------------------------------------------------------------------------

export function defaultSettings(): Settings {
  return {
    name: '',
    targetRole: '',
    graduationYear: new Date().getFullYear(),
    preferredLanguage: '',
    prepType: 'both',
    roadmapStartDate: todayISO(),
    roadmapWeeks: 8,
    dailyTargetHours: 6,
    theme: 'system',
    notifications: { revision: true, dailyGoals: true, missedTasks: true, deadlines: true },
    weights: { dsa: 30, coreCs: 30, development: 10, design: 10, interview: 10, projects: 10 },
    historicalSolved: 0,
    pomodoro: { focus: 25, break: 5 },
    sidebarCollapsed: false,
  };
}

/** A completely empty workspace. Used for first-run state and reset. */
export function createInitialData(): AppData {
  return {
    version: 2,
    subjects: [],
    topics: [],
    tasks: [],
    sessions: [],
    dsaSessions: [],
    dsaModules: [],
    dsaTopics: [],
    dsaPatterns: [],
    dsaProblems: [],
    dsaSource: { name: '', url: '', importedProblems: 0 },
    revisions: [],
    notes: [],
    projects: [],
    interviewQuestions: [],
    stories: [],
    mocks: [],
    applications: [],
    companies: [],
    goals: [],
    roadmap: [],
    journal: [],
    reviews: [],
    activities: [],
    settings: defaultSettings(),
  };
}
