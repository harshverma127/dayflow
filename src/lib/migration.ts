import type {
  AppData,
  DSAProblem,
  Difficulty,
  Goal,
  GoalMetric,
  Priority,
  Project,
  StudySession,
  Subject,
  SubjectCategory,
  Subtopic,
  Topic,
} from '@/types';
import { createInitialData } from '@/data/seed';
import { nowISO, todayISO, uid } from '@/lib/utils';

/** Shape of the data written by v1 of the app. Everything is optional. */
type AnyRecord = Record<string, unknown>;

const asArray = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

function migrateSubtopic(raw: AnyRecord): Subtopic {
  const status = String(raw.status ?? 'not-started');
  const progressOverride = typeof raw.progressOverride === 'number' ? (raw.progressOverride as number) : null;
  const done = status === 'completed' || status === 'mastered' || (progressOverride ?? 0) >= 100;
  return {
    id: String(raw.id ?? uid('sub')),
    name: String(raw.name ?? 'Untitled'),
    done,
    confidence: typeof raw.confidence === 'number' ? (raw.confidence as number) : done ? 4 : 1,
    notes: (raw.notes as string) ?? undefined,
    items: [],
  };
}

function migrateTopic(raw: AnyRecord, subjectId: string): Topic {
  const status = String(raw.status ?? 'not-started');
  const subs = asArray<AnyRecord>(raw.subtopics).map(migrateSubtopic);
  return {
    id: String(raw.id ?? uid('top')),
    subjectId,
    parentId: null,
    kind: 'topic',
    name: String(raw.name ?? 'Untitled topic'),
    description: (raw.description as string) ?? undefined,
    order: typeof raw.order === 'number' ? (raw.order as number) : 0,
    priority: (raw.priority as Priority) ?? 'medium',
    confidence: typeof raw.confidence === 'number' ? (raw.confidence as number) : 1,
    learned: status !== 'not-started',
    practiced: status === 'practicing' || status === 'completed' || status === 'mastered' || status === 'needs-revision',
    canExplain: status === 'completed' || status === 'mastered',
    applied: status === 'mastered',
    estimatedMinutes: typeof raw.estimatedMinutes === 'number' ? (raw.estimatedMinutes as number) : 120,
    actualMinutes: typeof raw.actualMinutes === 'number' ? (raw.actualMinutes as number) : 0,
    targetDate: (raw.targetDate as string) ?? undefined,
    subtopics: subs,
    resources: asArray<Topic['resources'][number]>(raw.resources),
    lastStudiedAt: (raw.lastStudiedAt as string) ?? undefined,
    revisionEnabled: raw.revisionEnabled !== false,
    nextRevisionAt: (raw.nextRevisionAt as string) ?? undefined,
    createdAt: String(raw.createdAt ?? nowISO()),
    updatedAt: String(raw.updatedAt ?? nowISO()),
  };
}

const SOLVED_STATUSES = ['solved', 'solved-with-hint', 'needs-revision', 'mastered'];

function migrateProblem(raw: AnyRecord, lookup: Map<string, DSAProblem>): DSAProblem {
  const status = String(raw.status ?? 'solved');
  const solved = SOLVED_STATUSES.includes(status);
  const name = String(raw.name ?? 'Untitled problem');
  const template = lookup.get(name);
  return {
    id: String(raw.id ?? uid('prob')),
    name,
    number: (raw.number as string) ?? template?.number,
    platform: String(raw.platform ?? 'LeetCode'),
    url: (raw.url as string) ?? template?.url,
    moduleId: template?.moduleId,
    topicId: template?.topicId,
    patternId: template?.patternId,
    difficulty: (raw.difficulty as Difficulty) ?? 'medium',
    attempted: solved || status === 'attempted',
    solved,
    understood: raw.solvedUnderstanding === true || (solved && (raw.confidence as number) >= 3),
    independent: raw.solvedIndependently === true,
    mastered: status === 'mastered',
    needsRevision: raw.needsRevision === true || status === 'needs-revision',
    hintUsed: raw.hintUsed === true,
    editorialUsed: false,
    solutionWatched: false,
    dateAttempted: (raw.dateSolved as string) ?? undefined,
    dateSolved: (raw.dateSolved as string) ?? undefined,
    timeTakenMinutes: typeof raw.timeTakenMinutes === 'number' ? (raw.timeTakenMinutes as number) : undefined,
    attempts: typeof raw.attempts === 'number' ? (raw.attempts as number) : 1,
    confidence: typeof raw.confidence === 'number' ? (raw.confidence as number) : 1,
    revisionStage: 0,
    nextRevisionAt: raw.needsRevision === true && raw.dateSolved ? todayISO() : undefined,
    notes: (raw.notes as string) ?? undefined,
    mistake: (raw.mistake as string) ?? undefined,
    keyInsight: (raw.optimalApproach as string) ?? undefined,
    timeComplexity: (raw.timeComplexity as string) ?? undefined,
    spaceComplexity: (raw.spaceComplexity as string) ?? undefined,
    createdAt: String(raw.createdAt ?? nowISO()),
    updatedAt: String(raw.updatedAt ?? nowISO()),
  };
}

function migrateProject(raw: AnyRecord): Project {
  return {
    id: String(raw.id ?? uid('prj')),
    name: String(raw.name ?? 'Untitled project'),
    description: String(raw.description ?? ''),
    githubUrl: (raw.githubUrl as string) ?? undefined,
    liveUrl: (raw.liveUrl as string) ?? undefined,
    technologies: asArray<string>(raw.technologies),
    status: (raw.status as Project['status']) ?? 'building',
    archived: false,
    startDate: (raw.startDate as string) ?? undefined,
    endDate: (raw.endDate as string) ?? undefined,
    features: asArray<string>(raw.features),
    architecture: (raw.architecture as string) ?? undefined,
    challenges: (raw.challenges as string) ?? undefined,
    tradeoffs: (raw.technicalDecisions as string) ?? undefined,
    futureImprovements: (raw.futureImprovements as string) ?? undefined,
    checklist: (raw.checklist as Record<string, boolean>) ?? {},
    color: String(raw.color ?? '#6f8a76'),
    createdAt: String(raw.createdAt ?? nowISO()),
    updatedAt: String(raw.updatedAt ?? nowISO()),
  };
}

function migrateGoal(raw: AnyRecord, subjects: Subject[]): Goal {
  const title = String(raw.title ?? 'Goal');
  const lower = title.toLowerCase();
  const matchedSubject = subjects.find((s) => /complete/i.test(title) && lower.includes(s.name.toLowerCase().split(' ')[0]));

  // Infer an auto-tracked metric from the title so existing goals start
  // updating themselves from real activity instead of a typed-in number.
  let metric: GoalMetric = 'manual';
  let refId: string | undefined;
  if (/independent/i.test(lower)) metric = 'dsa-independent';
  else if (/master/i.test(lower)) metric = 'dsa-mastered';
  else if (/\bdsa\b|problem/i.test(lower)) metric = 'dsa-solved';
  else if (/mock/i.test(lower)) metric = 'mocks';
  else if (/appl(y|ication)/i.test(lower)) metric = 'applications';
  else if (/project|portfolio/i.test(lower)) metric = 'projects-ready';
  else if (matchedSubject) {
    metric = 'subject-progress';
    refId = matchedSubject.id;
  }

  return {
    id: String(raw.id ?? uid('goal')),
    title,
    metric,
    refId,
    target: typeof raw.target === 'number' ? (raw.target as number) : 100,
    manualCurrent: typeof raw.current === 'number' ? (raw.current as number) : 0,
    unit: String(raw.unit ?? ''),
    deadline: (raw.deadline as string) ?? undefined,
    priority: (raw.priority as Priority) ?? 'medium',
    createdAt: String(raw.createdAt ?? nowISO()),
  };
}

/**
 * Upgrade a v1 payload to v2. User-created content is carried across; the DSA
 * curriculum is added additively (existing problems keep their data, new
 * curriculum problems arrive as a backlog).
 */
export function migrateV1toV2(old: AnyRecord): AppData {
  const seeded = createInitialData();

  // --- subjects & topics -------------------------------------------------
  const subjects: Subject[] = asArray<AnyRecord>(old.subjects).map((raw) => ({
    id: String(raw.id ?? uid('sub')),
    name: String(raw.name ?? 'Untitled subject'),
    description: (raw.description as string) ?? undefined,
    category: (raw.category as SubjectCategory) ?? 'other',
    color: String(raw.color ?? '#6f8a76'),
    priority: (raw.priority as Priority) ?? 'medium',
    difficulty: (raw.difficulty as Difficulty) ?? 'medium',
    targetDate: (raw.targetDate as string) ?? undefined,
    weeklyTargetHours: typeof raw.weeklyTargetHours === 'number' ? (raw.weeklyTargetHours as number) : 8,
    // the DSA subject is superseded by the DSA Lab
    archived: raw.category === 'dsa' ? true : raw.archived === true,
    archivedAt: raw.category === 'dsa' ? nowISO() : undefined,
    order: typeof raw.order === 'number' ? (raw.order as number) : 0,
    createdAt: String(raw.createdAt ?? nowISO()),
    updatedAt: String(raw.updatedAt ?? nowISO()),
  }));

  const topics: Topic[] = asArray<AnyRecord>(old.topics).map((raw) => migrateTopic(raw, String(raw.subjectId ?? '')));

  // --- DSA curriculum ----------------------------------------------------
  const lookup = new Map<string, DSAProblem>();
  for (const p of seeded.dsaProblems) lookup.set(p.name, p);

  const migratedProblems = asArray<AnyRecord>(old.dsaProblems).map((raw) => migrateProblem(raw, lookup));
  const existingNames = new Set(migratedProblems.map((p) => p.name));
  const backlog = seeded.dsaProblems.filter((p) => !existingNames.has(p.name));

  // --- sessions & tasks --------------------------------------------------
  const sessions: StudySession[] = asArray<AnyRecord>(old.sessions).map((raw) => ({
    id: String(raw.id ?? uid('sess')),
    date: String(raw.date ?? todayISO()),
    subjectId: (raw.subjectId as string) ?? undefined,
    topicId: (raw.topicId as string) ?? undefined,
    minutes: typeof raw.minutes === 'number' ? (raw.minutes as number) : 0,
    type: (raw.type as StudySession['type']) ?? 'learning',
    productivity: typeof raw.productivity === 'number' ? (raw.productivity as number) : 3,
    notes: (raw.notes as string) ?? undefined,
    createdAt: String(raw.createdAt ?? nowISO()),
  }));

  const oldRoadmapIds = new Set(asArray<AnyRecord>(old.roadmap).map((w) => String(w.id)));
  const roadmap = asArray<AnyRecord>(old.roadmap).map((w) => ({
    id: String(w.id ?? uid('week')),
    weekNumber: Number(w.weekNumber ?? 1),
    title: String(w.title ?? 'Week'),
    focus: String(w.focus ?? ''),
    startDate: String(w.startDate ?? todayISO()),
    endDate: String(w.endDate ?? todayISO()),
    expectedHours: Number(w.expectedHours ?? 20),
    subjectIds: asArray<string>(w.subjectIds),
    subjectNames: asArray<string>(w.subjectNames),
    tasks: asArray<AnyRecord>(w.tasks).map((t) => ({
      id: String(t.id ?? uid('rtask')),
      title: String(t.title ?? ''),
      type: (t.type as 'dsa') ?? 'core-cs',
      subjectId: (t.subjectId as string) ?? undefined,
      topicId: (t.topicId as string) ?? undefined,
      estimatedMinutes: Number(t.estimatedMinutes ?? 60),
      priority: (t.priority as Priority) ?? 'medium',
      done: t.done === true,
      doneAt: (t.doneAt as string) ?? undefined,
    })),
  }));
  void oldRoadmapIds;

  const revisions = asArray<AnyRecord>(old.revisions).map((r) => ({
    id: String(r.id ?? uid('rev')),
    kind: 'topic' as const,
    refId: (r.topicId as string) ?? undefined,
    label: String(r.label ?? 'Revision item'),
    subjectId: (r.subjectId as string) ?? undefined,
    topicId: (r.topicId as string) ?? undefined,
    lastReviewed: (r.lastStudied as string) ?? undefined,
    dueDate: String(r.dueDate ?? todayISO()),
    intervalDays: Number(r.intervalDays ?? 1),
    stage: Number(r.stage ?? 0),
    confidence: Number(r.confidence ?? 3),
    done: r.done === true,
    createdAt: String(r.createdAt ?? nowISO()),
  }));

  const oldCompanies = asArray<AnyRecord>(old.companies).map((c) => ({
    id: String(c.id ?? uid('cmp')),
    name: String(c.name ?? 'Company'),
    checklist: asArray<{ id?: string; label?: string; done?: boolean }>(c.checklist).map((i) => ({
      id: String(i.id ?? uid('chk')),
      label: String(i.label ?? 'Item'),
      done: i.done === true,
    })),
    notes: (c.notes as string) ?? undefined,
    createdAt: String(c.createdAt ?? nowISO()),
  }));

  const settingsRaw = (old.settings as AnyRecord) ?? {};
  const difficulty: Difficulty = 'medium';
  void difficulty;

  return {
    version: 2,
    subjects,
    topics,
    tasks: asArray<AnyRecord>(old.tasks).map((t) => ({
      id: String(t.id ?? uid('task')),
      title: String(t.title ?? ''),
      date: String(t.date ?? todayISO()),
      tier: (t.tier as 'normal') ?? 'normal',
      subjectId: (t.subjectId as string) ?? undefined,
      topicId: (t.topicId as string) ?? undefined,
      estimatedMinutes: Number(t.estimatedMinutes ?? 30),
      priority: (t.priority as Priority) ?? 'medium',
      done: t.done === true,
      doneAt: (t.doneAt as string) ?? undefined,
      auto: t.auto === true,
      createdAt: String(t.createdAt ?? nowISO()),
    })),
    sessions,
    dsaSessions: [],
    dsaModules: seeded.dsaModules,
    dsaTopics: seeded.dsaTopics,
    dsaPatterns: seeded.dsaPatterns,
    dsaProblems: [...migratedProblems, ...backlog],
    dsaSource: seeded.dsaSource,
    revisions,
    notes: asArray<AnyRecord>(old.notes).map((n) => ({
      id: String(n.id ?? uid('note')),
      title: String(n.title ?? 'Note'),
      subjectId: (n.subjectId as string) ?? undefined,
      topicId: (n.topicId as string) ?? undefined,
      content: String(n.content ?? ''),
      tags: asArray<string>(n.tags),
      createdAt: String(n.createdAt ?? nowISO()),
      updatedAt: String(n.updatedAt ?? nowISO()),
    })),
    projects: asArray<AnyRecord>(old.projects).map(migrateProject),
    interviewQuestions: asArray<AnyRecord>(old.interviewQuestions).map((q) => ({
      id: String(q.id ?? uid('iq')),
      question: String(q.question ?? ''),
      category: String(q.category ?? 'Core CS'),
      subjectId: undefined,
      topicId: undefined,
      source: undefined,
      difficulty: (q.difficulty as Difficulty) ?? 'medium',
      answer: (q.answer as string) ?? undefined,
      confidence: Number(q.confidence ?? 1),
      lastPracticed: (q.lastPracticed as string) ?? undefined,
      nextReview: (q.nextPractice as string) ?? undefined,
      asked: false,
      frequentlyAsked: q.frequentlyAsked === true,
      needsRevision: q.needsRevision === true,
      createdAt: String(q.createdAt ?? nowISO()),
      updatedAt: String(q.updatedAt ?? nowISO()),
    })),
    stories: [],
    mocks: asArray<AnyRecord>(old.mocks).map((m) => ({
      id: String(m.id ?? uid('mock')),
      date: String(m.date ?? todayISO()),
      type: (m.type as 'dsa') ?? 'dsa',
      company: (m.company as string) ?? undefined,
      interviewer: (m.interviewer as string) ?? undefined,
      durationMinutes: Number(m.durationMinutes ?? 60),
      score: Number(m.score ?? 0),
      topicsTested: asArray<string>(m.topicsTested),
      questions: asArray<string>(m.questions),
      strengths: (m.strengths as string) ?? undefined,
      weaknesses: (m.weaknesses as string) ?? undefined,
      feedback: (m.feedback as string) ?? undefined,
      followUp: (m.followUp as string) ?? undefined,
      createdAt: String(m.createdAt ?? nowISO()),
    })),
    applications: asArray<AnyRecord>(old.applications).map((a) => ({
      id: String(a.id ?? uid('app')),
      company: String(a.company ?? ''),
      role: String(a.role ?? ''),
      type: String(a.type ?? 'Internship'),
      applicationDate: (a.applicationDate as string) ?? undefined,
      deadline: (a.deadline as string) ?? undefined,
      status: (a.status as 'applied') ?? 'interested',
      oaDate: (a.oaDate as string) ?? undefined,
      interviewDate: (a.interviewDate as string) ?? undefined,
      resumeVersion: (a.resumeVersion as string) ?? undefined,
      referral: a.referral === true,
      archived: false,
      notes: (a.notes as string) ?? undefined,
      createdAt: String(a.createdAt ?? nowISO()),
      updatedAt: String(a.updatedAt ?? nowISO()),
    })),
    companies: oldCompanies,
    goals: asArray<AnyRecord>(old.goals).map((g) => migrateGoal(g, subjects)),
    roadmap: roadmap.length ? roadmap : seeded.roadmap,
    journal: asArray<AnyRecord>(old.journal).map((j) => ({
      id: String(j.id ?? uid('jrn')),
      problem: String(j.problem ?? ''),
      problemId: (j.problemId as string) ?? undefined,
      mistakeType: (j.mistakeType as 'logic') ?? 'logic',
      whyStuck: (j.whyStuck as string) ?? undefined,
      correctIdea: (j.correctPattern as string) ?? undefined,
      remember: (j.lesson as string) ?? undefined,
      date: String(j.date ?? todayISO()),
      revisitDate: (j.revisitDate as string) ?? undefined,
      createdAt: String(j.createdAt ?? nowISO()),
    })),
    reviews: asArray<AnyRecord>(old.reviews).map((r) => ({
      id: String(r.id ?? uid('rev')),
      weekStart: String(r.weekStart ?? todayISO()),
      weekEnd: String(r.weekEnd ?? todayISO()),
      accomplished: (r.accomplished as string) ?? undefined,
      struggled: (r.struggled as string) ?? undefined,
      improve: (r.improve as string) ?? undefined,
      stopWasting: (r.stopWasting as string) ?? undefined,
      createdAt: String(r.createdAt ?? nowISO()),
    })),
    activities: [],
    settings: {
      ...seeded.settings,
      name: String(settingsRaw.name ?? seeded.settings.name),
      targetRole: String(settingsRaw.targetRole ?? seeded.settings.targetRole),
      graduationYear: Number(settingsRaw.graduationYear ?? seeded.settings.graduationYear),
      preferredLanguage: String(settingsRaw.preferredLanguage ?? seeded.settings.preferredLanguage),
      prepType: (settingsRaw.goalType as 'both') ?? 'both',
      roadmapStartDate: String(settingsRaw.roadmapStartDate ?? seeded.settings.roadmapStartDate),
      roadmapWeeks: Number(settingsRaw.roadmapWeeks ?? seeded.settings.roadmapWeeks),
      dailyTargetHours: Number(settingsRaw.dailyTargetHours ?? seeded.settings.dailyTargetHours),
      theme: (settingsRaw.theme as 'dark') ?? 'dark',
      notifications: { ...seeded.settings.notifications, ...((settingsRaw.notifications as object) ?? {}) },
      weights: { ...seeded.settings.weights, ...((settingsRaw.weights as object) ?? {}) },
      historicalSolved: Number(settingsRaw.historicalSolved ?? 0),
      pomodoro: { ...seeded.settings.pomodoro, ...((settingsRaw.pomodoro as object) ?? {}) },
      sidebarCollapsed: settingsRaw.sidebarCollapsed === true,
    },
  };
}

/** A tiny guard used before applying an imported file. */
export function looksLikeData(value: unknown): value is AnyRecord {
  if (!value || typeof value !== 'object') return false;
  const v = value as AnyRecord;
  return Array.isArray(v.subjects) && typeof v.settings === 'object';
}
