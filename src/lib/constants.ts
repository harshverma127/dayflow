import type {
  ApplicationStatus,
  Difficulty,
  GoalMetric,
  MistakeType,
  MockType,
  Priority,
  ProjectStatus,
  ResourceType,
  StudyType,
  SubjectCategory,
  TaskTier,
  TopicStatus,
} from '@/types';

export const REVISION_INTERVALS = [1, 3, 7, 14, 30];

type Meta = { label: string; tone: string };

/** Soft accent tones. Green-ish = good, sand/peach = attention, clay = weak. */
export const TONE_BADGE: Record<string, string> = {
  slate: 'bg-surface-muted text-content-muted ring-border',
  blue: 'bg-accent-sky/10 text-accent-sky ring-accent-sky/25',
  sky: 'bg-accent-sky/10 text-accent-sky ring-accent-sky/25',
  violet: 'bg-accent-lavender/12 text-accent-lavender ring-accent-lavender/25',
  lavender: 'bg-accent-lavender/12 text-accent-lavender ring-accent-lavender/25',
  indigo: 'bg-accent-lavender/12 text-accent-lavender ring-accent-lavender/25',
  green: 'bg-accent-sage/12 text-accent-sage ring-accent-sage/25',
  emerald: 'bg-accent-sage/12 text-accent-sage ring-accent-sage/25',
  sage: 'bg-accent-sage/12 text-accent-sage ring-accent-sage/25',
  amber: 'bg-accent-sand/14 text-accent-sand ring-accent-sand/25',
  sand: 'bg-accent-sand/14 text-accent-sand ring-accent-sand/25',
  orange: 'bg-accent-peach/14 text-accent-peach ring-accent-peach/25',
  peach: 'bg-accent-peach/14 text-accent-peach ring-accent-peach/25',
  red: 'bg-accent-clay/12 text-accent-clay ring-accent-clay/25',
  clay: 'bg-accent-clay/12 text-accent-clay ring-accent-clay/25',
  cyan: 'bg-accent-sky/10 text-accent-sky ring-accent-sky/25',
  rose: 'bg-accent-rose/12 text-accent-rose ring-accent-rose/25',
};

/** Hex equivalents for charts (kept in sync with the CSS accents). */
export const TONE_HEX: Record<string, string> = {
  sage: '#58806a',
  sky: '#54789c',
  lavender: '#78709e',
  peach: '#b2744a',
  clay: '#aa544e',
  sand: '#9e7e48',
  rose: '#a86070',
  slate: '#8a8278',
};

// ---------------------------------------------------------------------------
// General
// ---------------------------------------------------------------------------

export const TOPIC_STATUS_META: Record<TopicStatus, Meta> = {
  'not-started': { label: 'Not started', tone: 'slate' },
  learning: { label: 'Learning', tone: 'sky' },
  practicing: { label: 'Practicing', tone: 'lavender' },
  completed: { label: 'Completed', tone: 'sage' },
  'needs-revision': { label: 'Needs revision', tone: 'sand' },
  mastered: { label: 'Mastered', tone: 'sage' },
};

export const TOPIC_STATUSES: TopicStatus[] = ['not-started', 'learning', 'practicing', 'completed', 'needs-revision', 'mastered'];

export const PRIORITY_META: Record<Priority, Meta> = {
  critical: { label: 'Critical', tone: 'clay' },
  high: { label: 'High', tone: 'peach' },
  medium: { label: 'Medium', tone: 'sky' },
  low: { label: 'Low', tone: 'slate' },
};

export const PRIORITIES: Priority[] = ['critical', 'high', 'medium', 'low'];

export const PRIORITY_RANK: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export const CATEGORY_META: Record<SubjectCategory, Meta> = {
  dsa: { label: 'DSA', tone: 'sky' },
  'core-cs': { label: 'Core CS', tone: 'lavender' },
  development: { label: 'Development', tone: 'sage' },
  interview: { label: 'Interview', tone: 'peach' },
  college: { label: 'College', tone: 'rose' },
  other: { label: 'Other', tone: 'slate' },
};

export const CATEGORIES: SubjectCategory[] = ['dsa', 'core-cs', 'development', 'interview', 'college', 'other'];

export const DIFFICULTY_META: Record<Difficulty, Meta> = {
  easy: { label: 'Easy', tone: 'sage' },
  medium: { label: 'Medium', tone: 'sand' },
  hard: { label: 'Hard', tone: 'clay' },
};

export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

export const STUDY_TYPE_META: Record<StudyType, Meta> = {
  learning: { label: 'Learning', tone: 'sky' },
  practice: { label: 'Practice', tone: 'lavender' },
  revision: { label: 'Revision', tone: 'sand' },
  'problem-solving': { label: 'Problem solving', tone: 'sage' },
  project: { label: 'Project work', tone: 'peach' },
  interview: { label: 'Interview practice', tone: 'rose' },
};

export const STUDY_TYPES: StudyType[] = ['learning', 'practice', 'revision', 'problem-solving', 'project', 'interview'];

export const TIER_META: Record<TaskTier, Meta> = {
  high: { label: 'Focus', tone: 'clay' },
  normal: { label: 'Normal', tone: 'sky' },
  optional: { label: 'If time', tone: 'slate' },
};

export const TIERS: TaskTier[] = ['high', 'normal', 'optional'];

// ---------------------------------------------------------------------------
// DSA
// ---------------------------------------------------------------------------

export type MasteryStatus =
  | 'not-attempted'
  | 'attempted'
  | 'solved-with-help'
  | 'solved'
  | 'understood'
  | 'independent'
  | 'mastered';

export const MASTERY_STATUS_META: Record<MasteryStatus, Meta> = {
  'not-attempted': { label: 'Not attempted', tone: 'slate' },
  attempted: { label: 'Attempted', tone: 'sand' },
  'solved-with-help': { label: 'Solved with help', tone: 'peach' },
  solved: { label: 'Solved', tone: 'sky' },
  understood: { label: 'Understood', tone: 'lavender' },
  independent: { label: 'Independent', tone: 'sage' },
  mastered: { label: 'Mastered', tone: 'sage' },
};

export const MASTERY_STATUSES: MasteryStatus[] = [
  'not-attempted',
  'attempted',
  'solved-with-help',
  'solved',
  'understood',
  'independent',
  'mastered',
];

export const MASTERY_FLAGS = [
  { key: 'solved', label: 'Solved', hint: 'I reached a correct solution' },
  { key: 'understood', label: 'Understood', hint: 'I understand why the approach works' },
  { key: 'independent', label: 'Independent', hint: 'I solved it without help' },
  { key: 'mastered', label: 'Mastered', hint: 'I could solve and explain it again later' },
  { key: 'needsRevision', label: 'Needs revision', hint: 'Worth revisiting soon' },
] as const;

export const CONFIDENCE_LABELS: Record<number, string> = {
  1: "Don't understand",
  2: 'Weak',
  3: 'Understand basics',
  4: 'Strong',
  5: 'Can explain confidently',
};

export const MISTAKE_META: Record<MistakeType, Meta> = {
  'pattern-not-recognized': { label: 'Pattern not recognized', tone: 'clay' },
  'wrong-data-structure': { label: 'Wrong data structure', tone: 'peach' },
  logic: { label: 'Logic mistake', tone: 'sand' },
  'edge-case': { label: 'Edge case', tone: 'lavender' },
  complexity: { label: 'Complexity issue', tone: 'sky' },
  implementation: { label: 'Implementation issue', tone: 'rose' },
  syntax: { label: 'Syntax issue', tone: 'slate' },
  misread: { label: 'Misread question', tone: 'peach' },
  'premature-optimization': { label: 'Premature optimization', tone: 'sand' },
};

export const MISTAKE_TYPES: MistakeType[] = [
  'pattern-not-recognized',
  'wrong-data-structure',
  'logic',
  'edge-case',
  'complexity',
  'implementation',
  'syntax',
  'misread',
  'premature-optimization',
];

// ---------------------------------------------------------------------------
// Projects, applications, interviews
// ---------------------------------------------------------------------------

export const PROJECT_STATUS_META: Record<ProjectStatus, Meta> = {
  idea: { label: 'Idea', tone: 'slate' },
  planning: { label: 'Planning', tone: 'sky' },
  building: { label: 'Building', tone: 'sand' },
  completed: { label: 'Completed', tone: 'sage' },
  'interview-ready': { label: 'Interview ready', tone: 'sage' },
};

export const PROJECT_STATUSES: ProjectStatus[] = ['idea', 'planning', 'building', 'completed', 'interview-ready'];

export const PROJECT_CHECKLIST_ITEMS = [
  'Problem statement',
  'Architecture',
  'Database schema',
  'APIs',
  'Authentication',
  'Security',
  'Biggest bug',
  'Technical tradeoffs',
  'Scalability',
  'Testing',
  'Deployment',
  'Future improvements',
];

export const APPLICATION_STATUS_META: Record<ApplicationStatus, Meta> = {
  interested: { label: 'Interested', tone: 'slate' },
  preparing: { label: 'Preparing', tone: 'sky' },
  applied: { label: 'Applied', tone: 'lavender' },
  oa: { label: 'OA', tone: 'rose' },
  'oa-cleared': { label: 'OA cleared', tone: 'lavender' },
  interview: { label: 'Interview', tone: 'sand' },
  'final-round': { label: 'Final round', tone: 'peach' },
  offer: { label: 'Offer', tone: 'sage' },
  rejected: { label: 'Rejected', tone: 'clay' },
  withdrawn: { label: 'Withdrawn', tone: 'slate' },
};

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'interested',
  'preparing',
  'applied',
  'oa',
  'oa-cleared',
  'interview',
  'final-round',
  'offer',
  'rejected',
  'withdrawn',
];

export const MOCK_TYPE_META: Record<MockType, Meta> = {
  dsa: { label: 'DSA', tone: 'sky' },
  technical: { label: 'Technical', tone: 'lavender' },
  'core-cs': { label: 'Core CS', tone: 'sage' },
  project: { label: 'Project', tone: 'peach' },
  lld: { label: 'LLD', tone: 'sand' },
  hld: { label: 'HLD', tone: 'clay' },
  behavioral: { label: 'Behavioral', tone: 'slate' },
  'full-mock': { label: 'Full mock', tone: 'rose' },
};

export const MOCK_TYPES: MockType[] = ['dsa', 'technical', 'core-cs', 'project', 'lld', 'hld', 'behavioral', 'full-mock'];

export const INTERVIEW_CATEGORIES = [
  'DSA',
  'DBMS',
  'OS',
  'CN',
  'OOP',
  'Java',
  'Projects',
  'LLD',
  'System Design',
  'Behavioral',
];

export const STAR_TEMPLATES = [
  'Leadership',
  'Conflict',
  'Failure',
  'Difficult challenge',
  'Teamwork',
  'Time pressure',
  'Learning quickly',
  'Mistake',
  'Achievement',
  'Technical problem',
];

export const RESOURCE_TYPE_META: Record<ResourceType, Meta> = {
  youtube: { label: 'YouTube', tone: 'clay' },
  article: { label: 'Article', tone: 'sky' },
  documentation: { label: 'Docs', tone: 'sage' },
  book: { label: 'Book', tone: 'sand' },
  leetcode: { label: 'LeetCode', tone: 'peach' },
  'practice-set': { label: 'Practice set', tone: 'lavender' },
  pdf: { label: 'PDF', tone: 'slate' },
  custom: { label: 'Custom', tone: 'slate' },
};

export const RESOURCE_TYPES: ResourceType[] = ['youtube', 'article', 'documentation', 'book', 'leetcode', 'practice-set', 'pdf', 'custom'];

// ---------------------------------------------------------------------------
// Goals, companies, misc
// ---------------------------------------------------------------------------

export const GOAL_METRIC_META: Record<GoalMetric, { label: string; unit: string; auto: boolean }> = {
  'dsa-solved': { label: 'DSA problems solved', unit: 'problems', auto: true },
  'dsa-independent': { label: 'Independent DSA solves', unit: 'problems', auto: true },
  'dsa-mastered': { label: 'Mastered DSA problems', unit: 'problems', auto: true },
  'subject-progress': { label: 'Subject completion', unit: '%', auto: true },
  'projects-ready': { label: 'Interview-ready projects', unit: 'projects', auto: true },
  mocks: { label: 'Mock interviews done', unit: 'mocks', auto: true },
  applications: { label: 'Applications sent', unit: 'applications', auto: true },
  manual: { label: 'Manual counter', unit: '', auto: false },
};

/** Areas shown on a company preparation page — all derived from tracked data. */
export const COMPANY_AREAS: { label: string; source: 'dsa' | 'subject' | 'systemDesign' | 'projects' | 'behavioral' }[] = [
  { label: 'DSA', source: 'dsa' },
  { label: 'Core CS', source: 'subject' },
  { label: 'OOP', source: 'subject' },
  { label: 'LLD', source: 'subject' },
  { label: 'System Design', source: 'systemDesign' },
  { label: 'Projects', source: 'projects' },
  { label: 'Behavioral', source: 'behavioral' },
];

export const SUBJECT_COLORS = [
  '#78809a',
  '#8a7fa0',
  '#6f8a76',
  '#b2744a',
  '#a8625c',
  '#5f7f96',
  '#a07e52',
  '#8f7f60',
  '#7d8f8a',
  '#9a7f88',
];

/**
 * Shape version of the persisted workspace.
 *
 * Lives here rather than in src/store.ts so the cloud storage adapter can
 * import it without creating a module cycle (store -> adapter -> store).
 */
export const DATA_VERSION = 2;

export const HEATMAP_LEVELS = [
  { label: 'No study', className: 'bg-surface-muted ring-1 ring-inset ring-border' },
  { label: 'Under 1 hour', className: 'bg-accent-sage/25' },
  { label: '1–2 hours', className: 'bg-accent-sage/45' },
  { label: '2–4 hours', className: 'bg-accent-sage/70' },
  { label: '4+ hours', className: 'bg-accent-sage' },
];
