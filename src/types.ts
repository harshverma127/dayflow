// ---------------------------------------------------------------------------
// PrepTrack domain model (v2)
//
// Design rules:
//  * Progress is never a user-typed number. It is always derived from real
//    completed work (checklist items, subtopics, solved problems, project
//    checklists). See src/lib/progress.ts — that file is the only place where
//    progress is calculated.
//  * Nothing is duplicated. A DSA problem knows its module/topic/pattern and
//    the dashboards query that relationship instead of storing a second count.
//  * Everything is serialisable: IDs are strings, times are ISO strings.
// ---------------------------------------------------------------------------

export type ID = string;
export type ISODate = string; // yyyy-MM-dd
export type ISODateTime = string; // full ISO timestamp

export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type Difficulty = 'easy' | 'medium' | 'hard';

export type TopicStatus =
  | 'not-started'
  | 'learning'
  | 'practicing'
  | 'completed'
  | 'needs-revision'
  | 'mastered';

export type SubjectCategory = 'dsa' | 'core-cs' | 'development' | 'interview' | 'college' | 'other';

export type StudyType =
  | 'learning'
  | 'practice'
  | 'revision'
  | 'problem-solving'
  | 'project'
  | 'interview';

export type TaskTier = 'high' | 'normal' | 'optional';

export type RoadmapStatus = 'not-started' | 'in-progress' | 'on-track' | 'at-risk' | 'completed';

export type RevisionKind = 'topic' | 'problem' | 'question';

export type RevisionConfidence = 'independent' | 'hint' | 'major-help' | 'failed';

export type ProjectStatus = 'idea' | 'planning' | 'building' | 'completed' | 'interview-ready';

export type ApplicationStatus =
  | 'interested'
  | 'preparing'
  | 'applied'
  | 'oa'
  | 'oa-cleared'
  | 'interview'
  | 'final-round'
  | 'offer'
  | 'rejected'
  | 'withdrawn';

export type MockType = 'dsa' | 'technical' | 'core-cs' | 'project' | 'lld' | 'hld' | 'behavioral' | 'full-mock';

export type ResourceType = 'youtube' | 'article' | 'documentation' | 'book' | 'leetcode' | 'practice-set' | 'pdf' | 'custom';

export type MistakeType =
  | 'pattern-not-recognized'
  | 'wrong-data-structure'
  | 'logic'
  | 'edge-case'
  | 'complexity'
  | 'implementation'
  | 'syntax'
  | 'misread'
  | 'premature-optimization';

export type ActivityKind =
  | 'topic'
  | 'subtopic'
  | 'checklist'
  | 'problem'
  | 'revision'
  | 'session'
  | 'task'
  | 'project'
  | 'application'
  | 'story'
  | 'note';

export type GoalMetric =
  | 'dsa-solved'
  | 'dsa-independent'
  | 'dsa-mastered'
  | 'subject-progress'
  | 'projects-ready'
  | 'mocks'
  | 'applications'
  | 'manual';

// ---------------------------------------------------------------------------
// Learning hierarchy: Subject → Unit → Topic → Subtopic → ChecklistItem
// ---------------------------------------------------------------------------

export interface ChecklistItem {
  id: ID;
  name: string;
  done: boolean;
  doneAt?: ISODateTime;
  confidence?: number; // 1-5
  notes?: string;
}

export interface Subtopic {
  id: ID;
  name: string;
  /** Explicit tick, used when the subtopic has no checklist items of its own. */
  done: boolean;
  confidence: number; // 1-5
  notes?: string;
  items: ChecklistItem[];
}

export interface Resource {
  id: ID;
  name: string;
  url: string;
  type: ResourceType;
  done: boolean;
  notes?: string;
}

export interface Topic {
  id: ID;
  subjectId: ID;
  /** null for top-level entries; otherwise the parent unit/topic. */
  parentId: ID | null;
  /** `unit` groups topics; `topic` holds subtopics and work. */
  kind: 'unit' | 'topic';
  name: string;
  description?: string;
  order: number;
  priority: Priority;
  confidence: number; // 1-5
  /** Learning lifecycle — used for progress when the topic has no children. */
  learned: boolean;
  practiced: boolean;
  canExplain: boolean;
  applied: boolean;
  estimatedMinutes: number;
  actualMinutes: number;
  targetDate?: ISODate;
  subtopics: Subtopic[];
  resources: Resource[];
  lastStudiedAt?: ISODateTime;
  revisionEnabled: boolean;
  nextRevisionAt?: ISODate;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Subject {
  id: ID;
  name: string;
  description?: string;
  category: SubjectCategory;
  color: string;
  priority: Priority;
  difficulty: Difficulty;
  targetDate?: ISODate;
  weeklyTargetHours?: number;
  archived: boolean;
  archivedAt?: ISODateTime;
  order: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// ---------------------------------------------------------------------------
// DSA Lab: A2Z module → topic → pattern → problems
// ---------------------------------------------------------------------------

export interface DSAModule {
  id: ID;
  name: string;
  order: number;
  notes?: string;
}

export interface DSATopic {
  id: ID;
  moduleId: ID;
  name: string;
  order: number;
  concepts: string[];
}

export interface DSAPattern {
  id: ID;
  moduleId: ID;
  topicId: ID;
  name: string;
  order: number;
  notes?: string;
}

export interface DSAProblem {
  id: ID;
  name: string;
  number?: string;
  platform: string;
  url?: string;
  moduleId?: ID;
  topicId?: ID;
  patternId?: ID;
  difficulty: Difficulty;
  /** Mastery is tracked as separate dimensions, never as one rigid workflow. */
  attempted: boolean;
  solved: boolean;
  understood: boolean;
  independent: boolean;
  mastered: boolean;
  needsRevision: boolean;
  hintUsed: boolean;
  editorialUsed: boolean;
  solutionWatched: boolean;
  dateAttempted?: ISODate;
  dateSolved?: ISODate;
  timeTakenMinutes?: number;
  attempts: number;
  confidence: number; // 1-5
  revisionStage: number;
  nextRevisionAt?: ISODate;
  notes?: string;
  mistake?: string;
  keyInsight?: string;
  timeComplexity?: string;
  spaceComplexity?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface DSACurriculumSource {
  name: string;
  url: string;
  lastSyncedAt?: ISODateTime;
  importedProblems: number;
}

/** A logged DSA practice session, richer than a generic study session. */
export interface DSASession {
  id: ID;
  date: ISODate;
  minutes: number;
  moduleId?: ID;
  topicId?: ID;
  patternId?: ID;
  attempted: number;
  solved: number;
  independentSolves: number;
  revised: number;
  notes?: string;
  createdAt: ISODateTime;
}

// ---------------------------------------------------------------------------
// Study, tasks, revision
// ---------------------------------------------------------------------------

export interface StudySession {
  id: ID;
  date: ISODate;
  subjectId?: ID;
  topicId?: ID;
  subtopicId?: ID;
  minutes: number;
  type: StudyType;
  productivity: number; // 1-5
  notes?: string;
  createdAt: ISODateTime;
}

export interface Task {
  id: ID;
  title: string;
  date: ISODate;
  tier: TaskTier;
  subjectId?: ID;
  topicId?: ID;
  subtopicId?: ID;
  estimatedMinutes: number;
  priority: Priority;
  done: boolean;
  doneAt?: ISODateTime;
  /** true when produced by the smart planner rather than typed by you */
  auto?: boolean;
  notes?: string;
  createdAt: ISODateTime;
}

export interface RevisionItem {
  id: ID;
  kind: RevisionKind;
  refId?: ID;
  label: string;
  subjectId?: ID;
  topicId?: ID;
  problemId?: ID;
  lastReviewed?: ISODate;
  dueDate: ISODate;
  intervalDays: number;
  stage: number;
  confidence: number; // 1-5
  done: boolean;
  createdAt: ISODateTime;
}

// ---------------------------------------------------------------------------
// Knowledge artefacts
// ---------------------------------------------------------------------------

export interface Note {
  id: ID;
  title: string;
  subjectId?: ID;
  topicId?: ID;
  content: string;
  tags: string[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface JournalEntry {
  id: ID;
  problem: string;
  problemId?: ID;
  mistakeType: MistakeType;
  whyStuck?: string;
  correctIdea?: string;
  remember?: string;
  date: ISODate;
  revisitDate?: ISODate;
  createdAt: ISODateTime;
}

// ---------------------------------------------------------------------------
// Portfolio, interviews, applications
// ---------------------------------------------------------------------------

export interface Project {
  id: ID;
  name: string;
  description: string;
  githubUrl?: string;
  liveUrl?: string;
  technologies: string[];
  status: ProjectStatus;
  archived: boolean;
  startDate?: ISODate;
  endDate?: ISODate;
  features: string[];
  architecture?: string;
  database?: string;
  apis?: string;
  authentication?: string;
  security?: string;
  testing?: string;
  deployment?: string;
  challenges?: string;
  tradeoffs?: string;
  futureImprovements?: string;
  checklist: Record<string, boolean>;
  color: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface InterviewQuestion {
  id: ID;
  question: string;
  category: string;
  subjectId?: ID;
  topicId?: ID;
  source?: string;
  difficulty: Difficulty;
  answer?: string;
  confidence: number; // 1-5
  lastPracticed?: ISODate;
  nextReview?: ISODate;
  asked: boolean;
  frequentlyAsked: boolean;
  needsRevision: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface BehavioralStory {
  id: ID;
  title: string;
  skill: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  usedFor?: string;
  confidence: number; // 1-5
  practicedCount: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface MockInterview {
  id: ID;
  date: ISODate;
  type: MockType;
  company?: string;
  interviewer?: string;
  durationMinutes: number;
  score: number; // 0-100
  topicsTested: string[];
  questions: string[];
  strengths?: string;
  weaknesses?: string;
  feedback?: string;
  followUp?: string;
  createdAt: ISODateTime;
}

export interface Application {
  id: ID;
  company: string;
  role: string;
  type: string;
  applicationDate?: ISODate;
  deadline?: ISODate;
  status: ApplicationStatus;
  oaDate?: ISODate;
  interviewDate?: ISODate;
  resumeVersion?: string;
  referral: boolean;
  archived: boolean;
  notes?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Company {
  id: ID;
  name: string;
  checklist: { id: ID; label: string; done: boolean }[];
  notes?: string;
  createdAt: ISODateTime;
}

// ---------------------------------------------------------------------------
// Planning, review, activity
// ---------------------------------------------------------------------------

export interface Goal {
  id: ID;
  title: string;
  metric: GoalMetric;
  /** subject id for subject-progress goals */
  refId?: ID;
  target: number;
  /** only used when metric === 'manual' */
  manualCurrent: number;
  unit: string;
  deadline?: ISODate;
  priority: Priority;
  createdAt: ISODateTime;
}

export interface RoadmapTask {
  id: ID;
  title: string;
  type: 'dsa' | 'core-cs' | 'development' | 'design' | 'project' | 'revision' | 'interview';
  subjectId?: ID;
  topicId?: ID;
  estimatedMinutes: number;
  priority: Priority;
  done: boolean;
  doneAt?: ISODateTime;
}

export interface RoadmapWeek {
  id: ID;
  weekNumber: number;
  title: string;
  focus: string;
  startDate: ISODate;
  endDate: ISODate;
  expectedHours: number;
  subjectIds: ID[];
  subjectNames: string[];
  tasks: RoadmapTask[];
}

export interface WeeklyReview {
  id: ID;
  weekStart: ISODate;
  weekEnd: ISODate;
  accomplished?: string;
  struggled?: string;
  improve?: string;
  stopWasting?: string;
  createdAt: ISODateTime;
}

export interface Activity {
  id: ID;
  kind: ActivityKind;
  label: string;
  detail?: string;
  at: ISODateTime;
  minutes?: number;
  subjectId?: ID;
  topicId?: ID;
  problemId?: ID;
  projectId?: ID;
}

export interface ProgressWeights {
  dsa: number;
  coreCs: number;
  development: number;
  design: number;
  interview: number;
  projects: number;
}

export interface Settings {
  name: string;
  targetRole: string;
  graduationYear: number;
  preferredLanguage: string;
  prepType: 'internship' | 'placement' | 'both';
  roadmapStartDate: ISODate;
  roadmapWeeks: number;
  dailyTargetHours: number;
  theme: 'light' | 'dark' | 'system';
  notifications: {
    revision: boolean;
    dailyGoals: boolean;
    missedTasks: boolean;
    deadlines: boolean;
  };
  weights: ProgressWeights;
  /** problems solved before PrepTrack existed */
  historicalSolved: number;
  pomodoro: { focus: number; break: number };
  sidebarCollapsed: boolean;
  lastBackupAt?: ISODateTime;
}

export interface AppData {
  version: number;
  subjects: Subject[];
  topics: Topic[];
  tasks: Task[];
  sessions: StudySession[];
  dsaSessions: DSASession[];
  dsaModules: DSAModule[];
  dsaTopics: DSATopic[];
  dsaPatterns: DSAPattern[];
  dsaProblems: DSAProblem[];
  dsaSource: DSACurriculumSource;
  revisions: RevisionItem[];
  notes: Note[];
  projects: Project[];
  interviewQuestions: InterviewQuestion[];
  stories: BehavioralStory[];
  mocks: MockInterview[];
  applications: Application[];
  companies: Company[];
  goals: Goal[];
  roadmap: RoadmapWeek[];
  journal: JournalEntry[];
  reviews: WeeklyReview[];
  activities: Activity[];
  settings: Settings;
}
