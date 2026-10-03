import type {
  AppData,
  DSAProblem,
  DSAPattern,
  Goal,
  ID,
  Priority,
  Project,
  RoadmapWeek,
  StudySession,
  Subject,
  Subtopic,
  Topic,
} from '@/types';
import type { MasteryStatus } from '@/lib/constants';
import { MASTERY_STATUS_META, PRIORITY_RANK, PROJECT_CHECKLIST_ITEMS } from '@/lib/constants';
import { addDaysISO, clamp, diffDays, startOfWeekISO, todayISO } from '@/lib/utils';

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// ---------------------------------------------------------------------------
// Learning hierarchy: Subject → Unit → Topic → Subtopic → ChecklistItem
// ---------------------------------------------------------------------------

export function childTopics(topics: Topic[], parentId: ID | null): Topic[] {
  return topics.filter((t) => (t.parentId ?? null) === parentId).sort((a, b) => a.order - b.order);
}

export function topicsForSubject(topics: Topic[], subjectId: ID): Topic[] {
  return topics.filter((t) => t.subjectId === subjectId).sort((a, b) => a.order - b.order);
}

/** A subtopic is driven by its checklist items when it has any. */
export function subtopicProgress(s: Subtopic): number {
  if (s.items.length) return (s.items.filter((i) => i.done).length / s.items.length) * 100;
  return s.done ? 100 : 0;
}

/**
 * Topic progress = average of its subtopics and child topics.
 * A leaf topic with no children falls back to the Learn → Practice → Explain →
 * Apply lifecycle, so progress is always produced by completed work.
 */
export function topicProgress(t: Topic, allTopics: Topic[]): number {
  const parts: number[] = [];
  for (const s of t.subtopics) parts.push(subtopicProgress(s));
  for (const k of childTopics(allTopics, t.id)) parts.push(topicProgress(k, allTopics));
  if (parts.length) return clamp(avg(parts));
  const steps = [t.learned, t.practiced, t.canExplain, t.applied];
  const done = steps.filter(Boolean).length;
  return clamp((done / steps.length) * 100);
}

export function topicStatus(t: Topic, allTopics: Topic[]): 'not-started' | 'learning' | 'practicing' | 'completed' | 'mastered' {
  const p = topicProgress(t, allTopics);
  if (p >= 100) return t.confidence >= 4 ? 'mastered' : 'completed';
  if (p >= 60) return 'practicing';
  if (p > 0) return 'learning';
  return 'not-started';
}

export function subjectProgress(subject: Subject, topics: Topic[]): number {
  const top = childTopics(topicsForSubject(topics, subject.id), null);
  if (!top.length) return 0;
  return clamp(avg(top.map((t) => topicProgress(t, topics))));
}

export function subjectStats(subject: Subject, topics: Topic[], sessions: StudySession[]) {
  const all = topicsForSubject(topics, subject.id);
  const progress = subjectProgress(subject, topics);
  const leaves = all.filter((t) => t.kind === 'topic');
  const completed = leaves.filter((t) => topicProgress(t, topics) >= 100).length;
  const started = leaves.filter((t) => topicProgress(t, topics) > 0).length;
  const subs = sessions.filter((s) => s.subjectId === subject.id);
  const minutes = subs.reduce((a, s) => a + s.minutes, 0);
  const sessionDates = subs.map((s) => s.date).sort();
  const last = sessionDates.length ? sessionDates[sessionDates.length - 1] : undefined;
  const nextTopic =
    leaves.find((t) => topicProgress(t, topics) > 0 && topicProgress(t, topics) < 100) ??
    leaves.find((t) => topicProgress(t, topics) === 0);
  const weak = leaves.filter((t) => topicProgress(t, topics) > 0 && t.confidence > 0 && t.confidence <= 2).slice(0, 5);
  const revisionPending = leaves.filter((t) => t.nextRevisionAt && t.nextRevisionAt <= todayISO()).length;
  return { total: leaves.length, completed, started, progress, minutes, lastStudied: last, nextTopic, weak, revisionPending };
}

export function subtopicCount(topics: Topic[]): { subtopics: number; items: number } {
  let subtopics = 0;
  let items = 0;
  for (const t of topics) {
    subtopics += t.subtopics.length;
    for (const s of t.subtopics) items += s.items.length;
  }
  return { subtopics, items };
}

export function subjectById(subjects: Subject[], id?: ID): Subject | undefined {
  return subjects.find((s) => s.id === id);
}

export function topicById(topics: Topic[], id?: ID): Topic | undefined {
  return topics.find((t) => t.id === id);
}

export function priorityRank(p: Priority): number {
  return PRIORITY_RANK[p];
}

// ---------------------------------------------------------------------------
// DSA mastery
// ---------------------------------------------------------------------------

export function problemMasteryScore(p: DSAProblem): number {
  return (p.solved ? 0.4 : 0) + (p.understood ? 0.2 : 0) + (p.independent ? 0.2 : 0) + (p.mastered ? 0.2 : 0);
}

export function problemStatus(p: DSAProblem): MasteryStatus {
  if (p.mastered) return 'mastered';
  if (p.solved && p.understood && p.independent) return 'independent';
  if (p.solved && p.understood) return 'understood';
  if (p.solved && (p.hintUsed || p.editorialUsed || p.solutionWatched)) return 'solved-with-help';
  if (p.solved) return 'solved';
  if (p.attempted) return 'attempted';
  return 'not-attempted';
}

export function statusLabel(p: DSAProblem): string {
  return MASTERY_STATUS_META[problemStatus(p)].label;
}

export function moduleById(data: AppData, id?: ID) {
  return data.dsaModules.find((m) => m.id === id);
}
export function dsaTopicById(data: AppData, id?: ID) {
  return data.dsaTopics.find((t) => t.id === id);
}
export function patternById(data: AppData, id?: ID) {
  return data.dsaPatterns.find((p) => p.id === id);
}

export function problemsInPattern(data: AppData, patternId: ID): DSAProblem[] {
  return data.dsaProblems.filter((p) => p.patternId === patternId);
}

export interface PatternStat {
  pattern: DSAPattern;
  moduleName: string;
  topicName: string;
  total: number;
  solved: number;
  independent: number;
  mastered: number;
  revisionDue: number;
  /** 0-5, or null when no problems are tracked for the pattern yet */
  strength: number | null;
  coverage: number; // 0-100
}

export function patternStats(data: AppData): PatternStat[] {
  const today = todayISO();
  return data.dsaPatterns.map((pattern) => {
    const problems = problemsInPattern(data, pattern.id);
    const solved = problems.filter((p) => p.solved).length;
    const independent = problems.filter((p) => p.independent).length;
    const mastered = problems.filter((p) => p.mastered).length;
    const revisionDue = problems.filter((p) => (p.needsRevision || p.nextRevisionAt) && (p.nextRevisionAt ?? today) <= today).length;
    const rated = problems.filter((p) => p.attempted || p.solved);
    const strength = rated.length
      ? clamp(avg(rated.map((p) => (p.confidence / 5) * 0.5 + (p.independent ? 0.25 : 0) + (p.mastered ? 0.25 : 0))) * 5, 0, 5)
      : null;
    return {
      pattern,
      moduleName: moduleById(data, pattern.moduleId)?.name ?? '—',
      topicName: dsaTopicById(data, pattern.topicId)?.name ?? '—',
      total: problems.length,
      solved,
      independent,
      mastered,
      revisionDue,
      strength,
      coverage: problems.length ? (solved / problems.length) * 100 : 0,
    };
  });
}

export interface ModuleStat {
  id: ID;
  name: string;
  order: number;
  patterns: number;
  patternsStarted: number;
  patternsTouched: number;
  tracked: number;
  solved: number;
  independent: number;
  mastered: number;
  revisionDue: number;
  strength: number | null;
  progress: number;
}

export function moduleStats(data: AppData): ModuleStat[] {
  const stats = patternStats(data);
  const today = todayISO();
  return [...data.dsaModules]
    .sort((a, b) => a.order - b.order)
    .map((m) => {
      const list = stats.filter((s) => s.pattern.moduleId === m.id);
      const problems = data.dsaProblems.filter((p) => p.moduleId === m.id);
      const rated = list.filter((s) => s.strength !== null);
      const solved = problems.filter((p) => p.solved).length;
      const patternsStarted = list.filter((s) => s.solved > 0).length;
      return {
        id: m.id,
        name: m.name,
        order: m.order,
        patterns: list.length,
        patternsStarted,
        patternsTouched: list.filter((s) => s.total > 0 && (s.solved > 0 || problems.length > 0)).length,
        tracked: problems.length,
        solved,
        independent: problems.filter((p) => p.independent).length,
        mastered: problems.filter((p) => p.mastered).length,
        revisionDue: problems.filter((p) => (p.needsRevision || p.nextRevisionAt) && (p.nextRevisionAt ?? today) <= today).length,
        strength: rated.length ? avg(rated.map((s) => s.strength as number)) : null,
        progress: list.length ? (patternsStarted / list.length) * 100 : 0,
      };
    });
}

export function dsaStats(data: AppData) {
  const problems = data.dsaProblems;
  const solved = problems.filter((p) => p.solved).length;
  const historical = data.settings.historicalSolved;
  const today = todayISO();
  const weekStart = startOfWeekISO();
  const monthPrefix = today.slice(0, 7);
  const independent = problems.filter((p) => p.independent).length;
  const mastered = problems.filter((p) => p.mastered).length;
  const withTime = problems.filter((p) => p.timeTakenMinutes);
  return {
    tracked: problems.length,
    solvedInApp: solved,
    solvedTotal: solved + historical,
    historical,
    attempted: problems.filter((p) => p.attempted).length,
    independent,
    mastered,
    understood: problems.filter((p) => p.understood).length,
    byDifficulty: {
      easy: problems.filter((p) => p.difficulty === 'easy').length,
      medium: problems.filter((p) => p.difficulty === 'medium').length,
      hard: problems.filter((p) => p.difficulty === 'hard').length,
    },
    solvedThisWeek: problems.filter((p) => p.dateSolved && p.dateSolved >= weekStart).length,
    solvedThisMonth: problems.filter((p) => p.dateSolved && p.dateSolved.startsWith(monthPrefix)).length,
    avgTime: withTime.length ? Math.round(avg(withTime.map((p) => p.timeTakenMinutes as number))) : 0,
    independentRate: solved ? Math.round((independent / solved) * 100) : 0,
    avgConfidence: problems.length ? avg(problems.map((p) => p.confidence)) : 0,
    revisionBacklog: problems.filter((p) => (p.needsRevision || p.nextRevisionAt) && (p.nextRevisionAt ?? today) <= today).length,
    needsRevision: problems.filter((p) => p.needsRevision).length,
    neverIndependent: problems.filter((p) => p.solved && !p.independent).length,
  };
}

/**
 * DSA progress for the overall readiness score.
 * Pattern coverage + how deeply the solved problems are actually owned.
 */
export function dsaProgress(data: AppData): number {
  const stats = patternStats(data);
  const total = stats.length || 1;
  const coverage = stats.filter((s) => s.solved > 0).length / total;
  const all = data.dsaProblems;
  const mastery = all.length ? avg(all.map(problemMasteryScore)) : 0;
  const d = dsaStats(data);
  const independency = d.solvedInApp ? d.independent / d.solvedInApp : 0;
  return clamp(Math.round((coverage * 0.45 + mastery * 0.35 + independency * 0.2) * 100));
}

export function currentDsaFocus(data: AppData): { module?: string; pattern?: string; topic?: string } {
  const stats = patternStats(data).filter((s) => s.total > 0);
  const started = stats.filter((s) => s.solved > 0 || s.total > 0);
  const weighted = [...started].sort((a, b) => (b.solved - b.total / 2) - (a.solved - a.total / 2));
  const next = weighted.find((s) => s.solved < s.total) ?? weighted[0];
  if (!next) {
    const first = moduleStats(data)[0];
    return { module: first?.name };
  }
  return { module: next.moduleName, topic: next.topicName, pattern: next.pattern.name };
}

export interface Finding {
  title: string;
  detail: string;
  severity: 'high' | 'medium' | 'low';
  to: string;
}

/** Descriptive, data-driven weakness detection for DSA. */
export function dsaWeakness(data: AppData, limit = 5): Finding[] {
  const stats = patternStats(data).filter((s) => s.total > 0);
  const rated = stats.filter((s) => s.strength !== null);
  const findings: Finding[] = [];

  const weakest = [...rated].sort((a, b) => (a.strength as number) - (b.strength as number))[0];
  if (weakest && (weakest.strength as number) < 3) {
    findings.push({
      title: `${weakest.pattern.name} — ${(weakest.strength as number).toFixed(1)}/5`,
      detail: `Average confidence is low across ${weakest.total} tracked problem(s) in ${weakest.moduleName}. Start here.`,
      severity: (weakest.strength as number) < 2 ? 'high' : 'medium',
      to: '/dsa',
    });
  }

  const lowIndependence = [...stats]
    .filter((s) => s.solved >= 2 && s.independent / s.solved < 0.5)
    .sort((a, b) => a.independent / a.solved - b.independent / b.solved)[0];
  if (lowIndependence) {
    findings.push({
      title: `${lowIndependence.pattern.name} — only ${Math.round((lowIndependence.independent / lowIndependence.solved) * 100)}% independent`,
      detail: `You solved ${lowIndependence.solved} problem(s) here but leaned on hints or the editorial for most of them.`,
      severity: 'medium',
      to: '/dsa',
    });
  }

  const mostOverdue = [...stats].sort((a, b) => b.revisionDue - a.revisionDue)[0];
  if (mostOverdue && mostOverdue.revisionDue > 0) {
    findings.push({
      title: `${mostOverdue.revisionDue} revision item(s) overdue in ${mostOverdue.pattern.name}`,
      detail: 'Revision is what turns a solved problem into a mastered one. Clear this backlog first.',
      severity: mostOverdue.revisionDue >= 3 ? 'high' : 'low',
      to: '/revision',
    });
  }

  const neverStarted = moduleStats(data).find((m) => m.tracked > 0 && m.patternsStarted === 0);
  if (neverStarted) {
    findings.push({
      title: `${neverStarted.name} not started`,
      detail: `${neverStarted.tracked} problem(s) from the A2Z set are waiting in this module.`,
      severity: 'low',
      to: '/dsa',
    });
  }

  const untouchedBase = data.dsaProblems.filter((p) => !p.attempted).length;
  if (untouchedBase > 0) {
    findings.push({
      title: `${untouchedBase} problems never attempted`,
      detail: 'These are seeded from the A2Z curriculum and still sitting in the backlog.',
      severity: 'low',
      to: '/dsa',
    });
  }
  return findings.slice(0, limit);
}

export function improvingPatterns(data: AppData, limit = 4): PatternStat[] {
  return patternStats(data)
    .filter((s) => s.strength !== null && s.mastered > 0)
    .sort((a, b) => b.mastered / Math.max(1, b.total) - a.mastered / Math.max(1, a.total) || (b.strength as number) - (a.strength as number))
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Buckets & overall readiness
// ---------------------------------------------------------------------------

export type Bucket = 'dsa' | 'coreCs' | 'development' | 'design' | 'interview' | 'projects';

export function bucketOf(subject: Subject): Bucket {
  switch (subject.category) {
    case 'dsa':
      return 'dsa';
    case 'core-cs':
      return 'coreCs';
    case 'interview':
      return 'interview';
    case 'development':
      return /design|system design|lld/i.test(subject.name) ? 'design' : 'development';
    default:
      return 'development';
  }
}

export function projectReadiness(p: Project): number {
  const done = PROJECT_CHECKLIST_ITEMS.filter((k) => p.checklist[k]).length;
  return clamp(Math.round((done / PROJECT_CHECKLIST_ITEMS.length) * 100));
}

export function behavioralReadiness(data: AppData): number {
  if (!data.stories.length) return 0;
  return clamp(Math.round(avg(data.stories.map((s) => (s.confidence / 5) * 100))));
}

export function interviewReadiness(data: AppData): number {
  const interviewSubjects = data.subjects.filter((s) => s.category === 'interview' && !s.archived);
  const parts: number[] = [];
  if (interviewSubjects.length) parts.push(avg(interviewSubjects.map((s) => subjectProgress(s, data.topics))));
  if (data.interviewQuestions.length) parts.push(avg(data.interviewQuestions.map((q) => (q.confidence / 5) * 100)));
  if (data.mocks.length) parts.push(avg(data.mocks.map((m) => m.score)));
  if (data.stories.length) parts.push(behavioralReadiness(data));
  return Math.round(avg(parts));
}

export function bucketProgress(data: AppData): Record<Bucket, number> {
  const active = data.subjects.filter((s) => !s.archived);
  const byBucket = (b: Bucket) => avg(active.filter((s) => bucketOf(s) === b).map((s) => subjectProgress(s, data.topics)));
  return {
    dsa: dsaProgress(data),
    coreCs: Math.round(byBucket('coreCs')),
    development: Math.round(byBucket('development')),
    design: Math.round(byBucket('design')),
    interview: interviewReadiness(data),
    projects: Math.round(avg(data.projects.filter((p) => !p.archived).map((p) => projectReadiness(p)))),
  };
}

export function overallProgress(data: AppData): number {
  const buckets = bucketProgress(data);
  const w = data.settings.weights;
  const entries: [Bucket, number][] = [
    ['dsa', w.dsa],
    ['coreCs', w.coreCs],
    ['development', w.development],
    ['design', w.design],
    ['interview', w.interview],
    ['projects', w.projects],
  ];
  const totalW = entries.reduce((a, [, weight]) => a + weight, 0);
  if (!totalW) return 0;
  return Math.round(entries.reduce((a, [key, weight]) => a + buckets[key] * weight, 0) / totalW);
}

export function overallProgressDelta(data: AppData, days = 7): number {
  const cutoff = addDaysISO(todayISO(), -days);
  const recentMinutes = data.sessions.filter((s) => s.date >= cutoff).reduce((a, s) => a + s.minutes, 0);
  const roadmapMinutes = data.roadmap.reduce((a, w) => a + w.expectedHours * 60, 0) || 1;
  return Math.round((recentMinutes / roadmapMinutes) * 100);
}

/** Company-preparation areas, all derived from tracked data. */
export function companyAreaProgress(data: AppData, label: string): number {
  const subjects = data.subjects.filter((s) => !s.archived);
  const find = (re: RegExp) => subjects.find((s) => re.test(s.name));
  switch (label) {
    case 'DSA':
      return dsaProgress(data);
    case 'Core CS': {
      const list = subjects.filter((s) => s.category === 'core-cs');
      return Math.round(avg(list.map((s) => subjectProgress(s, data.topics))));
    }
    case 'OOP': {
      const s = find(/oop|java/i);
      return s ? Math.round(subjectProgress(s, data.topics)) : 0;
    }
    case 'LLD': {
      const s = find(/low level design|lld/i);
      return s ? Math.round(subjectProgress(s, data.topics)) : 0;
    }
    case 'System Design': {
      const s = find(/system design/i);
      return s ? Math.round(subjectProgress(s, data.topics)) : 0;
    }
    case 'Projects':
      return Math.round(avg(data.projects.filter((p) => !p.archived).map(projectReadiness)));
    case 'Behavioral':
      return behavioralReadiness(data);
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Study sessions, streaks, heatmap
// ---------------------------------------------------------------------------

export function studyStats(sessions: StudySession[]) {
  const today = todayISO();
  const weekStart = startOfWeekISO();
  const monthPrefix = today.slice(0, 7);
  const totalMinutes = sessions.reduce((a, s) => a + s.minutes, 0);
  const activeDays = new Set(sessions.map((s) => s.date)).size;
  return {
    totalMinutes,
    todayMinutes: sessions.filter((s) => s.date === today).reduce((a, s) => a + s.minutes, 0),
    weekMinutes: sessions.filter((s) => s.date >= weekStart).reduce((a, s) => a + s.minutes, 0),
    monthMinutes: sessions.filter((s) => s.date.startsWith(monthPrefix)).reduce((a, s) => a + s.minutes, 0),
    activeDays,
    avgPerActiveDay: activeDays ? totalMinutes / activeDays : 0,
  };
}

export function dailyMinutes(sessions: StudySession[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of sessions) map.set(s.date, (map.get(s.date) ?? 0) + s.minutes);
  return map;
}

export function computeStreak(sessions: StudySession[], today = todayISO()): { current: number; best: number } {
  const map = dailyMinutes(sessions);
  const days = [...map.keys()].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of days) {
    run = prev && diffDays(d, prev) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  let current = 0;
  let cursor = map.has(today) ? today : addDaysISO(today, -1);
  while (map.has(cursor)) {
    current += 1;
    cursor = addDaysISO(cursor, -1);
  }
  return { current, best };
}

export function dsaStreak(problems: DSAProblem[], today = todayISO()): number {
  const days = new Set(problems.filter((p) => p.dateSolved).map((p) => p.dateSolved as string));
  let current = 0;
  let cursor = days.has(today) ? today : addDaysISO(today, -1);
  while (days.has(cursor)) {
    current += 1;
    cursor = addDaysISO(cursor, -1);
  }
  return current;
}

export function heatmapWeeks(sessions: StudySession[], weeks = 18) {
  const map = dailyMinutes(sessions);
  const today = todayISO();
  const end = addDaysISO(today, 6 - ((new Date().getDay() + 6) % 7));
  const start = addDaysISO(end, -(weeks * 7 - 1));
  const out: { date: string; minutes: number; level: number }[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const date = addDaysISO(start, i);
    const minutes = map.get(date) ?? 0;
    out.push({ date, minutes, level: minutes === 0 ? 0 : minutes < 60 ? 1 : minutes < 120 ? 2 : minutes < 240 ? 3 : 4 });
  }
  return out;
}

/** Per-day breakdown used by the heatmap tooltip. */
export function dayBreakdown(data: AppData, date: string) {
  const sessions = data.sessions.filter((s) => s.date === date);
  const groups = new Map<string, number>();
  for (const s of sessions) {
    const subject = data.subjects.find((x) => x.id === s.subjectId);
    const key = subject ? subject.name : 'General';
    groups.set(key, (groups.get(key) ?? 0) + s.minutes);
  }
  const dsaSessions = data.dsaSessions.filter((s) => s.date === date);
  const dsaMinutes = dsaSessions.reduce((a, s) => a + s.minutes, 0);
  if (dsaMinutes) groups.set('DSA (sessions)', (groups.get('DSA (sessions)') ?? 0) + dsaMinutes);
  const total = sessions.reduce((a, s) => a + s.minutes, 0) + dsaMinutes;
  return { total, entries: [...groups.entries()].sort((a, b) => b[1] - a[1]) };
}

// ---------------------------------------------------------------------------
// Roadmap
// ---------------------------------------------------------------------------

export function roadmapWeekProgress(week: RoadmapWeek): number {
  if (!week.tasks.length) return 0;
  return Math.round((week.tasks.filter((t) => t.done).length / week.tasks.length) * 100);
}

export function currentWeek(roadmap: RoadmapWeek[], today = todayISO()): RoadmapWeek | undefined {
  return roadmap.find((w) => w.startDate <= today && today <= w.endDate) ?? roadmap.find((w) => w.startDate > today) ?? roadmap[roadmap.length - 1];
}

export function roadmapStats(data: AppData) {
  const weeks = data.roadmap;
  const totalTasks = weeks.reduce((a, w) => a + w.tasks.length, 0);
  const doneTasks = weeks.reduce((a, w) => a + w.tasks.filter((t) => t.done).length, 0);
  const today = todayISO();
  return {
    totalTasks,
    doneTasks,
    progress: totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0,
    daysRemaining: weeks.length ? Math.max(0, diffDays(weeks[weeks.length - 1].endDate, today)) : 0,
    week: currentWeek(weeks, today),
    totalWeeks: weeks.length,
  };
}

export function weekStatus(week: RoadmapWeek, today = todayISO()): 'not-started' | 'in-progress' | 'on-track' | 'at-risk' | 'completed' {
  const p = roadmapWeekProgress(week);
  if (p >= 100) return 'completed';
  if (week.startDate > today) return 'not-started';
  if (today > week.endDate) return 'at-risk';
  const total = week.tasks.length || 1;
  const expected = Math.round((Math.min(7, Math.max(0, diffDays(today, week.startDate) + 1)) / 7) * total);
  return week.tasks.filter((t) => t.done).length >= expected ? 'on-track' : 'in-progress';
}

export interface Assessment {
  level: 'ahead' | 'on-track' | 'slightly-behind' | 'behind';
  reason: string;
}

export function onTrackAssessment(data: AppData): Assessment {
  const today = todayISO();
  const weeks = data.roadmap;
  const current = currentWeek(weeks, today);
  if (!current) return { level: 'on-track', reason: 'No roadmap weeks have been set up yet.' };

  const p = roadmapWeekProgress(current);
  const done = current.tasks.filter((t) => t.done).length;
  const expected = Math.round((Math.min(7, Math.max(0, diffDays(today, current.startDate) + 1)) / 7) * (current.tasks.length || 1));
  const overdueHigh = data.tasks.filter((t) => !t.done && t.date < today && (t.priority === 'critical' || t.priority === 'high')).length;
  const pastIncomplete = weeks.filter((w) => today > w.endDate && roadmapWeekProgress(w) < 100).length;

  if (pastIncomplete >= 3 || overdueHigh >= 10) {
    return { level: 'behind', reason: `${pastIncomplete} past week(s) unfinished and ${overdueHigh} high-priority task(s) overdue.` };
  }
  if (p >= 100) {
    return { level: 'ahead', reason: `All ${current.tasks.length} tasks for ${current.title} are complete.` };
  }
  if (done > expected) {
    return { level: 'ahead', reason: `${p}% of ${current.title} done — ahead of the ${expected} tasks expected by today.` };
  }
  if (done >= expected || p >= 60) {
    return { level: 'on-track', reason: `${p}% of planned ${current.title} tasks completed.` };
  }
  return {
    level: 'slightly-behind',
    reason: `${done} of ${expected || 1} expected ${current.title} tasks done (${p}%).`,
  };
}

// ---------------------------------------------------------------------------
// Smart next action
// ---------------------------------------------------------------------------

export interface NextAction {
  label: string;
  reason: string;
  subjectId?: ID;
  topicId?: ID;
  to: string;
  kind: 'deadline' | 'weak' | 'topic' | 'dsa' | 'missed' | 'none';
}

export function nextAction(data: AppData): NextAction {
  const today = todayISO();

  const urgent = data.applications
    .flatMap((a) => [
      { a, date: a.oaDate, kind: 'OA' },
      { a, date: a.interviewDate, kind: 'Interview' },
      { a, date: a.deadline, kind: 'Application deadline' },
    ])
    .filter((x) => x.date && x.date >= today && diffDays(x.date, today) <= 5)
    .sort((x, y) => (x.date as string).localeCompare(y.date as string))[0];
  if (urgent) {
    return {
      label: `${urgent.a.company} — ${urgent.kind} preparation`,
      reason: `${urgent.kind} on ${urgent.date} (${diffDays(urgent.date as string, today)} day(s) away).`,
      to: '/applications',
      kind: 'deadline',
    };
  }

  const overdueRevision = data.revisions.filter((r) => !r.done && r.dueDate < today).length;
  if (overdueRevision >= 3) {
    return {
      label: `Clear ${overdueRevision} overdue revision items`,
      reason: 'Revision backlog is the cheapest way to recover lost ground.',
      to: '/revision',
      kind: 'weak',
    };
  }

  const weak = data.topics
    .filter((t) => {
      const p = topicProgress(t, data.topics);
      return t.kind === 'topic' && p > 0 && p < 100 && t.confidence > 0 && t.confidence <= 2;
    })
    .sort((a, b) => a.confidence - b.confidence)[0];
  if (weak) {
    const s = subjectById(data.subjects, weak.subjectId);
    return {
      label: `${s?.name ?? 'Topic'} — ${weak.name}`,
      reason: `Low confidence (${weak.confidence}/5)${weak.nextRevisionAt ? ` · revision due ${weak.nextRevisionAt}` : ''}.`,
      subjectId: weak.subjectId,
      topicId: weak.id,
      to: `/subjects/${weak.subjectId}`,
      kind: 'weak',
    };
  }

  const week = currentWeek(data.roadmap, today);
  const weekSubjectIds = new Set(week?.subjectIds ?? []);
  const candidates = data.topics.filter((t) => t.kind === 'topic' && topicProgress(t, data.topics) < 100);
  candidates.sort((a, b) => {
    const aw = weekSubjectIds.has(a.subjectId) ? 0 : 1;
    const bw = weekSubjectIds.has(b.subjectId) ? 0 : 1;
    if (aw !== bw) return aw - bw;
    const sa = subjectById(data.subjects, a.subjectId);
    const sb = subjectById(data.subjects, b.subjectId);
    const pa = sa ? priorityRank(sa.priority) : 3;
    const pb = sb ? priorityRank(sb.priority) : 3;
    if (pa !== pb) return pa - pb;
    return topicProgress(b, data.topics) - topicProgress(a, data.topics);
  });
  if (candidates[0]) {
    const t = candidates[0];
    const s = subjectById(data.subjects, t.subjectId);
    const remaining = t.subtopics.filter((x) => subtopicProgress(x) < 100).length;
    return {
      label: `${s?.name ?? 'Topic'} — ${t.name}`,
      reason: `${remaining} subtopic(s) remaining${s ? ` · ${s.priority} priority` : ''}.`,
      subjectId: t.subjectId,
      topicId: t.id,
      to: `/subjects/${t.subjectId}`,
      kind: 'topic',
    };
  }

  const focus = currentDsaFocus(data);
  if (focus.pattern) {
    return {
      label: `${focus.module} — ${focus.pattern}`,
      reason: 'Next unfinished pattern in the A2Z curriculum.',
      to: '/dsa',
      kind: 'dsa',
    };
  }

  const missed = data.tasks.filter((t) => !t.done && t.date < today).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (missed) return { label: missed.title, reason: `Missed on ${missed.date}.`, subjectId: missed.subjectId, topicId: missed.topicId, to: '/planner', kind: 'missed' };

  return { label: 'Add something to your plan', reason: 'Nothing urgent is outstanding right now.', to: '/planner', kind: 'none' };
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export interface Notice {
  id: string;
  kind: 'revision' | 'task' | 'deadline' | 'interview' | 'goal' | 'dsa';
  title: string;
  detail: string;
  to: string;
  date?: string;
}

export function notifications(data: AppData): Notice[] {
  const today = todayISO();
  const out: Notice[] = [];
  if (data.settings.notifications.revision) {
    for (const r of data.revisions.filter((r) => !r.done && r.dueDate <= today)) {
      out.push({
        id: r.id,
        kind: 'revision',
        title: `Revise: ${r.label}`,
        detail: r.dueDate === today ? 'Due today' : `${diffDays(today, r.dueDate)} day(s) overdue`,
        to: '/revision',
        date: r.dueDate,
      });
    }
    const dsaDue = data.dsaProblems.filter((p) => p.needsRevision && (p.nextRevisionAt ?? today) <= today);
    if (dsaDue.length) {
      out.push({ id: 'dsa-revision', kind: 'dsa', title: `${dsaDue.length} DSA problem(s) to revise`, detail: 'Spaced repetition for problem solving', to: '/revision', date: today });
    }
  }
  if (data.settings.notifications.missedTasks) {
    for (const t of data.tasks.filter((t) => !t.done && t.date < today)) {
      out.push({ id: t.id, kind: 'task', title: `Overdue: ${t.title}`, detail: `Was due ${t.date}`, to: '/planner', date: t.date });
    }
  }
  if (data.settings.notifications.deadlines) {
    for (const a of data.applications.filter((x) => !x.archived)) {
      if (a.deadline && a.deadline >= today && diffDays(a.deadline, today) <= 7) {
        out.push({ id: `${a.id}-dl`, kind: 'deadline', title: `${a.company} deadline`, detail: `${diffDays(a.deadline, today)} day(s) left`, to: '/applications', date: a.deadline });
      }
      if (a.interviewDate && a.interviewDate >= today && diffDays(a.interviewDate, today) <= 7) {
        out.push({ id: `${a.id}-iv`, kind: 'interview', title: `${a.company} interview`, detail: `In ${diffDays(a.interviewDate, today)} day(s)`, to: '/applications', date: a.interviewDate });
      }
      if (a.oaDate && a.oaDate >= today && diffDays(a.oaDate, today) <= 7) {
        out.push({ id: `${a.id}-oa`, kind: 'interview', title: `${a.company} online assessment`, detail: `In ${diffDays(a.oaDate, today)} day(s)`, to: '/applications', date: a.oaDate });
      }
    }
  }
  if (data.settings.notifications.dailyGoals) {
    const week = studyStats(data.sessions).weekMinutes;
    const target = data.settings.dailyTargetHours * 60 * 7;
    const dayOfWeek = (new Date().getDay() + 6) % 7;
    const expected = (target / 7) * (dayOfWeek + 1);
    if (week < expected * 0.6) {
      out.push({ id: 'weekly-target', kind: 'goal', title: 'Weekly study target behind', detail: `${Math.round(week / 60)}h logged vs ~${Math.round(expected / 60)}h expected`, to: '/analytics' });
    }
  }
  return out.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
}

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export function goalCurrent(g: Goal, data: AppData): number {
  switch (g.metric) {
    case 'dsa-solved':
      return dsaStats(data).solvedTotal;
    case 'dsa-independent':
      return dsaStats(data).independent;
    case 'dsa-mastered':
      return dsaStats(data).mastered;
    case 'subject-progress': {
      const s = subjectById(data.subjects, g.refId);
      return s ? subjectProgress(s, data.topics) : 0;
    }
    case 'projects-ready':
      return data.projects.filter((p) => p.status === 'interview-ready').length;
    case 'mocks':
      return data.mocks.length;
    case 'applications':
      return data.applications.filter((a) => !['interested', 'preparing'].includes(a.status)).length;
    default:
      return g.manualCurrent;
  }
}

// ---------------------------------------------------------------------------
// Factual insights
// ---------------------------------------------------------------------------

export function insights(data: AppData, limit = 6): string[] {
  const out: string[] = [];
  const stats = studyStats(data.sessions);
  const dsa = dsaStats(data);

  if (stats.weekMinutes > 0) out.push(`You studied ${(stats.weekMinutes / 60).toFixed(1)} hours this week.`);

  const dsaMinutes = data.dsaSessions.reduce((a, s) => a + s.minutes, 0);
  const totalMinutes = stats.totalMinutes + dsaMinutes;
  if (dsaMinutes && totalMinutes) out.push(`DSA represented ${Math.round((dsaMinutes / totalMinutes) * 100)}% of your logged study time.`);

  const weakest = patternStats(data)
    .filter((s) => s.strength !== null)
    .sort((a, b) => (a.strength as number) - (b.strength as number))[0];
  if (weakest && (weakest.strength as number) < 3.5) out.push(`${weakest.pattern.name} has the lowest average confidence (${(weakest.strength as number).toFixed(1)}/5).`);

  if (dsa.revisionBacklog > 0) out.push(`${dsa.revisionBacklog} DSA revision item(s) are due or overdue.`);
  if (dsa.solvedInApp > 0) out.push(`You solve ${dsa.independentRate}% of tracked problems without help.`);

  const neglected = data.subjects.filter((s) => !s.archived).map((s) => ({ s, st: subjectStats(s, data.topics, data.sessions) })).filter((x) => x.st.started > 0 && x.st.lastStudied && diffDays(todayISO(), x.st.lastStudied) >= 7).sort((a, b) => (a.st.lastStudied as string).localeCompare(b.st.lastStudied as string))[0];
  if (neglected) out.push(`${neglected.s.name} hasn't been studied for ${diffDays(todayISO(), neglected.st.lastStudied as string)} days.`);

  const untouchedSubjects = data.subjects.filter((s) => !s.archived).map((s) => ({ s, st: subjectStats(s, data.topics, data.sessions) })).filter((x) => x.st.started === 0);
  if (untouchedSubjects.length) out.push(`${untouchedSubjects.length} subject(s) have not been started yet.`);

  const mockAvg = data.mocks.length ? Math.round(avg(data.mocks.map((m) => m.score))) : 0;
  if (data.mocks.length) out.push(`Average mock interview score is ${mockAvg}% across ${data.mocks.length} mock(s).`);

  return out.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Weekly review metrics
// ---------------------------------------------------------------------------

export function weekMetrics(data: AppData, weekStart: string) {
  const end = addDaysISO(weekStart, 6);
  const inRange = (d?: string) => !!d && d >= weekStart && d <= end;
  const sessions = data.sessions.filter((s) => inRange(s.date));
  const dsaSessions = data.dsaSessions.filter((s) => inRange(s.date));
  const problemsSolved = data.dsaProblems.filter((p) => inRange(p.dateSolved));
  const tasks = data.tasks.filter((t) => inRange(t.date));
  const mocks = data.mocks.filter((m) => inRange(m.date));
  const topicsCompleted = data.topics.filter((t) => inRange(t.lastStudiedAt?.slice(0, 10)) && topicProgress(t, data.topics) >= 100).length;
  return {
    minutes: sessions.reduce((a, s) => a + s.minutes, 0) + dsaSessions.reduce((a, s) => a + s.minutes, 0),
    problems: problemsSolved.length,
    independentSolves: problemsSolved.filter((p) => p.independent).length,
    topicsCompleted,
    revisions: data.revisions.filter((r) => r.done && inRange(r.dueDate)).length,
    revisionMinutes: sessions.filter((s) => s.type === 'revision').reduce((a, s) => a + s.minutes, 0),
    tasksTotal: tasks.length,
    tasksDone: tasks.filter((t) => t.done).length,
    tasksMissed: tasks.filter((t) => !t.done && t.date < todayISO()).length,
    mockAvg: mocks.length ? Math.round(avg(mocks.map((m) => m.score))) : 0,
    mocks: mocks.length,
    weakTopics: data.topics.filter((t) => inRange(t.lastStudiedAt?.slice(0, 10)) && t.confidence <= 2).map((t) => t.name).slice(0, 5),
  };
}

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

export function recentActivity(data: AppData, limit = 12) {
  return [...data.activities].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

export function activityGrouped(data: AppData, limit = 20) {
  const list = recentActivity(data, limit);
  const groups = new Map<string, typeof list>();
  for (const a of list) {
    const day = a.at.slice(0, 10);
    const bucket = day === todayISO() ? 'Today' : diffDays(todayISO(), day) === 1 ? 'Yesterday' : day;
    const arr = groups.get(bucket) ?? [];
    arr.push(a);
    groups.set(bucket, arr);
  }
  return [...groups.entries()];
}
