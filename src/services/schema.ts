// ---------------------------------------------------------------------------
// Table mapping — the bridge between `AppData` (src/types.ts) and Postgres.
//
// Each spec describes one table: which AppData collection feeds it, how the
// camelCase TypeScript field maps to the snake_case column, which fields are
// jsonb, which are optional (null -> undefined), and what to fall back to when
// a nullable column comes back null.
//
// `ORDER` is the order tables must be written in: parents before children, so
// a single pass never trips a foreign key. Reads use the reverse-safe order
// because `assemble` runs only after every table has loaded.
// ---------------------------------------------------------------------------

import type { AppData } from '@/types';

export type RowObject = Record<string, unknown>;

export interface EntityRow {
  id: string;
  /** The TypeScript object, used for defaults and id lookups. */
  ts: RowObject;
  /** Injected parent columns (e.g. `topic_id`) for nested child rows. */
  extra?: RowObject;
}

export interface CollectionSpec {
  /** Key into AppData for the "root" entities of this table. */
  key: keyof AppData;
  table: string;
  /** [tsField, dbColumn] pairs, excluding `id`/`user_id`. */
  cols: readonly (readonly [string, string])[];
  /** tsFields stored as jsonb; undefined becomes `[]` rather than null. */
  json?: readonly string[];
  /** tsFields that are genuinely optional: null comes back as undefined. */
  optional?: readonly string[];
  /** Fallback when a non-optional column arrives null. */
  defaults?: RowObject;
  /**
   * DB columns to copy onto the assembled object verbatim, under their own
   * column name. Child tables need their parent FK back (e.g. `topic_id`) so
   * `loadWorkspace` can re-attach them to the right parent.
   */
  passThrough?: readonly string[];
  /** Flattens nested children into this table's rows. */
  collect: (data: AppData) => EntityRow[];
  /** Rebuilds entities from rows; omit for child tables (stitched later). */
  assemble?: (rows: RowObject[]) => unknown[];
}

const flat = (
  key: keyof AppData,
  table: string,
  cols: readonly (readonly [string, string])[],
  opts: { json?: readonly string[]; optional?: readonly string[]; defaults?: RowObject; passThrough?: readonly string[] } = {},
): CollectionSpec => ({
  key,
  table,
  cols,
  json: opts.json,
  optional: opts.optional,
  defaults: opts.defaults,
  passThrough: opts.passThrough,
  collect: (data) => (data[key] as unknown as RowObject[]).map((ts) => ({ id: String(ts.id), ts })),
  assemble: (rows) => rows,
});

const OPTS = ['description', 'subjectId', 'topicId', 'subtopicId', 'problemId', 'projectId', 'refId', 'targetDate', 'notes', 'detail'];

// ---------------------------------------------------------------------------
// ORDER MATTERS: parents before children.
// ---------------------------------------------------------------------------

export const COLLECTIONS: readonly CollectionSpec[] = [
  flat('subjects', 'subjects', [
    ['name', 'name'],
    ['description', 'description'],
    ['category', 'category'],
    ['color', 'color'],
    ['priority', 'priority'],
    ['difficulty', 'difficulty'],
    ['targetDate', 'target_date'],
    ['weeklyTargetHours', 'weekly_target_hours'],
    ['archived', 'archived'],
    ['archivedAt', 'archived_at'],
    ['order', 'order'],
    ['createdAt', 'created_at'],
    ['updatedAt', 'updated_at'],
  ], {
    optional: [...OPTS, 'archivedAt', 'weeklyTargetHours'],
    defaults: { category: 'core-cs', color: '#b07a4a', priority: 'medium', difficulty: 'medium', archived: false, order: 0 },
  }),

  {
    key: 'topics',
    table: 'topics',
    cols: [
      ['subjectId', 'subject_id'],
      ['parentId', 'parent_id'],
      ['kind', 'kind'],
      ['name', 'name'],
      ['description', 'description'],
      ['order', 'order'],
      ['priority', 'priority'],
      ['confidence', 'confidence'],
      ['learned', 'learned'],
      ['practiced', 'practiced'],
      ['canExplain', 'can_explain'],
      ['applied', 'applied'],
      ['estimatedMinutes', 'estimated_minutes'],
      ['actualMinutes', 'actual_minutes'],
      ['targetDate', 'target_date'],
      ['resources', 'resources'],
      ['lastStudiedAt', 'last_studied_at'],
      ['revisionEnabled', 'revision_enabled'],
      ['nextRevisionAt', 'next_revision_at'],
      ['createdAt', 'created_at'],
      ['updatedAt', 'updated_at'],
    ],
    json: ['resources'],
    optional: ['description', 'parentId', 'targetDate', 'lastStudiedAt', 'nextRevisionAt'],
    defaults: { kind: 'topic', order: 0, priority: 'medium', confidence: 0, learned: false, practiced: false, canExplain: false, applied: false, estimatedMinutes: 0, actualMinutes: 0, revisionEnabled: true },
    collect: (data) => data.topics.map((ts) => ({ id: String(ts.id), ts: ts as unknown as RowObject })),
    assemble: (rows) => rows,
  },

  {
    key: 'topics',
    table: 'subtopics',
    cols: [
      ['name', 'name'],
      ['done', 'done'],
      ['confidence', 'confidence'],
      ['notes', 'notes'],
      ['order', 'order'],
      ['createdAt', 'created_at'],
      ['updatedAt', 'updated_at'],
    ],
    optional: ['notes'],
    passThrough: ['topic_id'],
    defaults: { done: false, confidence: 0, order: 0 },
    collect: (data) =>
      data.topics.flatMap((topic) =>
        topic.subtopics.map((sub) => ({
          id: String(sub.id),
          ts: sub as unknown as RowObject,
          extra: { topic_id: String(topic.id) },
        })),
      ),
  },

  {
    key: 'topics',
    table: 'checklist_items',
    cols: [
      ['name', 'name'],
      ['done', 'done'],
      ['doneAt', 'done_at'],
      ['confidence', 'confidence'],
      ['notes', 'notes'],
      ['order', 'order'],
      ['createdAt', 'created_at'],
      ['updatedAt', 'updated_at'],
    ],
    optional: ['doneAt', 'confidence', 'notes'],
    passThrough: ['subtopic_id'],
    defaults: { done: false, order: 0 },
    collect: (data) =>
      data.topics.flatMap((topic) =>
        topic.subtopics.flatMap((sub) =>
          sub.items.map((item) => ({
            id: String(item.id),
            ts: item as unknown as RowObject,
            extra: { subtopic_id: String(sub.id) },
          })),
        ),
      ),
  },

  flat('dsaModules', 'dsa_modules', [
    ['name', 'name'],
    ['order', 'order'],
    ['notes', 'notes'],
    ['createdAt', 'created_at'],
    ['updatedAt', 'updated_at'],
  ], { optional: ['notes'], defaults: { order: 0 } }),

  flat('dsaTopics', 'dsa_topics', [
    ['moduleId', 'module_id'],
    ['name', 'name'],
    ['order', 'order'],
    ['concepts', 'concepts'],
    ['createdAt', 'created_at'],
    ['updatedAt', 'updated_at'],
  ], { json: ['concepts'], defaults: { order: 0 } }),

  flat('dsaPatterns', 'dsa_patterns', [
    ['moduleId', 'module_id'],
    ['topicId', 'topic_id'],
    ['name', 'name'],
    ['order', 'order'],
    ['notes', 'notes'],
    ['createdAt', 'created_at'],
    ['updatedAt', 'updated_at'],
  ], { optional: ['notes'], defaults: { order: 0 } }),

  flat('dsaProblems', 'dsa_problems', [
    ['name', 'name'],
    ['number', 'number'],
    ['platform', 'platform'],
    ['url', 'url'],
    ['moduleId', 'module_id'],
    ['topicId', 'topic_id'],
    ['patternId', 'pattern_id'],
    ['difficulty', 'difficulty'],
    ['attempted', 'attempted'],
    ['solved', 'solved'],
    ['understood', 'understood'],
    ['independent', 'independent'],
    ['mastered', 'mastered'],
    ['needsRevision', 'needs_revision'],
    ['hintUsed', 'hint_used'],
    ['editorialUsed', 'editorial_used'],
    ['solutionWatched', 'solution_watched'],
    ['dateAttempted', 'date_attempted'],
    ['dateSolved', 'date_solved'],
    ['timeTakenMinutes', 'time_taken_minutes'],
    ['attempts', 'attempts'],
    ['confidence', 'confidence'],
    ['revisionStage', 'revision_stage'],
    ['nextRevisionAt', 'next_revision_at'],
    ['notes', 'notes'],
    ['mistake', 'mistake'],
    ['keyInsight', 'key_insight'],
    ['timeComplexity', 'time_complexity'],
    ['spaceComplexity', 'space_complexity'],
    ['createdAt', 'created_at'],
    ['updatedAt', 'updated_at'],
  ], {
    optional: ['number', 'url', 'moduleId', 'topicId', 'patternId', 'dateAttempted', 'dateSolved', 'timeTakenMinutes', 'nextRevisionAt', 'notes', 'mistake', 'keyInsight', 'timeComplexity', 'spaceComplexity'],
    defaults: { platform: '', difficulty: 'medium', attempted: false, solved: false, understood: false, independent: false, mastered: false, needsRevision: false, hintUsed: false, editorialUsed: false, solutionWatched: false, attempts: 0, confidence: 0, revisionStage: 0 },
  }),

  flat('dsaSessions', 'dsa_sessions', [
    ['date', 'date'],
    ['minutes', 'minutes'],
    ['moduleId', 'module_id'],
    ['topicId', 'topic_id'],
    ['patternId', 'pattern_id'],
    ['attempted', 'attempted'],
    ['solved', 'solved'],
    ['independentSolves', 'independent_solves'],
    ['revised', 'revised'],
    ['notes', 'notes'],
    ['createdAt', 'created_at'],
  ], { optional: ['moduleId', 'topicId', 'patternId', 'notes'], defaults: { minutes: 0, attempted: 0, solved: 0, independentSolves: 0, revised: 0 } }),

  flat('tasks', 'tasks', [
    ['title', 'title'],
    ['date', 'date'],
    ['tier', 'tier'],
    ['subjectId', 'subject_id'],
    ['topicId', 'topic_id'],
    ['subtopicId', 'subtopic_id'],
    ['estimatedMinutes', 'estimated_minutes'],
    ['priority', 'priority'],
    ['done', 'done'],
    ['doneAt', 'done_at'],
    ['auto', 'auto'],
    ['notes', 'notes'],
    ['createdAt', 'created_at'],
    ['updatedAt', 'updated_at'],
  ], { optional: ['subjectId', 'topicId', 'subtopicId', 'doneAt', 'notes'], defaults: { tier: 'normal', estimatedMinutes: 30, priority: 'medium', done: false, auto: false } }),

  flat('sessions', 'sessions', [
    ['date', 'date'],
    ['subjectId', 'subject_id'],
    ['topicId', 'topic_id'],
    ['subtopicId', 'subtopic_id'],
    ['minutes', 'minutes'],
    ['type', 'type'],
    ['productivity', 'productivity'],
    ['notes', 'notes'],
    ['createdAt', 'created_at'],
  ], { optional: ['subjectId', 'topicId', 'subtopicId', 'notes'], defaults: { minutes: 0, type: 'learning', productivity: 3 } }),

  flat('revisions', 'revisions', [
    ['kind', 'kind'],
    ['refId', 'ref_id'],
    ['label', 'label'],
    ['subjectId', 'subject_id'],
    ['topicId', 'topic_id'],
    ['problemId', 'problem_id'],
    ['lastReviewed', 'last_reviewed'],
    ['dueDate', 'due_date'],
    ['intervalDays', 'interval_days'],
    ['stage', 'stage'],
    ['confidence', 'confidence'],
    ['done', 'done'],
    ['createdAt', 'created_at'],
  ], { optional: ['refId', 'subjectId', 'topicId', 'problemId', 'lastReviewed'], defaults: { intervalDays: 1, stage: 0, confidence: 3, done: false } }),

  flat('notes', 'notes', [
    ['title', 'title'],
    ['subjectId', 'subject_id'],
    ['topicId', 'topic_id'],
    ['content', 'content'],
    ['tags', 'tags'],
    ['createdAt', 'created_at'],
    ['updatedAt', 'updated_at'],
  ], { json: ['tags'], optional: ['subjectId', 'topicId'], defaults: { content: '' } }),

  flat('journal', 'journal_entries', [
    ['problem', 'problem'],
    ['problemId', 'problem_id'],
    ['mistakeType', 'mistake_type'],
    ['whyStuck', 'why_stuck'],
    ['correctIdea', 'correct_idea'],
    ['remember', 'remember'],
    ['date', 'date'],
    ['revisitDate', 'revisit_date'],
    ['createdAt', 'created_at'],
  ], { optional: ['problemId', 'whyStuck', 'correctIdea', 'remember', 'revisitDate'], defaults: { mistakeType: 'logic' } }),

  flat('reviews', 'weekly_reviews', [
    ['weekStart', 'week_start'],
    ['weekEnd', 'week_end'],
    ['accomplished', 'accomplished'],
    ['struggled', 'struggled'],
    ['improve', 'improve'],
    ['stopWasting', 'stop_wasting'],
    ['createdAt', 'created_at'],
  ], { optional: ['accomplished', 'struggled', 'improve', 'stopWasting'] }),

  {
    key: 'projects',
    table: 'projects',
    cols: [
      ['name', 'name'],
      ['description', 'description'],
      ['githubUrl', 'github_url'],
      ['liveUrl', 'live_url'],
      ['technologies', 'technologies'],
      ['status', 'status'],
      ['archived', 'archived'],
      ['startDate', 'start_date'],
      ['endDate', 'end_date'],
      ['features', 'features'],
      ['architecture', 'architecture'],
      ['database', 'database'],
      ['apis', 'apis'],
      ['authentication', 'authentication'],
      ['security', 'security'],
      ['testing', 'testing'],
      ['deployment', 'deployment'],
      ['challenges', 'challenges'],
      ['tradeoffs', 'tradeoffs'],
      ['futureImprovements', 'future_improvements'],
      ['color', 'color'],
      ['createdAt', 'created_at'],
      ['updatedAt', 'updated_at'],
    ],
    json: ['technologies', 'features'],
    optional: ['githubUrl', 'liveUrl', 'startDate', 'endDate', 'architecture', 'database', 'apis', 'authentication', 'security', 'testing', 'deployment', 'challenges', 'tradeoffs', 'futureImprovements'],
    defaults: { description: '', status: 'idea', archived: false, color: '#b07a4a' },
    collect: (data) => data.projects.map((ts) => ({ id: String(ts.id), ts: ts as unknown as RowObject })),
    assemble: (rows) => rows,
  },

  flat('interviewQuestions', 'interview_questions', [
    ['question', 'question'],
    ['category', 'category'],
    ['subjectId', 'subject_id'],
    ['topicId', 'topic_id'],
    ['source', 'source'],
    ['difficulty', 'difficulty'],
    ['answer', 'answer'],
    ['confidence', 'confidence'],
    ['lastPracticed', 'last_practiced'],
    ['nextReview', 'next_review'],
    ['asked', 'asked'],
    ['frequentlyAsked', 'frequently_asked'],
    ['needsRevision', 'needs_revision'],
    ['createdAt', 'created_at'],
    ['updatedAt', 'updated_at'],
  ], { optional: ['subjectId', 'topicId', 'source', 'answer', 'lastPracticed', 'nextReview'], defaults: { category: '', difficulty: 'medium', confidence: 0, asked: false, frequentlyAsked: false, needsRevision: false } }),

  flat('stories', 'behavioral_stories', [
    ['title', 'title'],
    ['skill', 'skill'],
    ['situation', 'situation'],
    ['task', 'task'],
    ['action', 'action'],
    ['result', 'result'],
    ['usedFor', 'used_for'],
    ['confidence', 'confidence'],
    ['practicedCount', 'practiced_count'],
    ['createdAt', 'created_at'],
    ['updatedAt', 'updated_at'],
  ], { optional: ['usedFor'], defaults: { skill: '', situation: '', task: '', action: '', result: '', confidence: 0, practicedCount: 0 } }),

  flat('mocks', 'mock_interviews', [
    ['date', 'date'],
    ['type', 'type'],
    ['company', 'company'],
    ['interviewer', 'interviewer'],
    ['durationMinutes', 'duration_minutes'],
    ['score', 'score'],
    ['topicsTested', 'topics_tested'],
    ['questions', 'questions'],
    ['strengths', 'strengths'],
    ['weaknesses', 'weaknesses'],
    ['feedback', 'feedback'],
    ['followUp', 'follow_up'],
    ['createdAt', 'created_at'],
    ['updatedAt', 'updated_at'],
  ], { json: ['topicsTested', 'questions'], optional: ['company', 'interviewer', 'strengths', 'weaknesses', 'feedback', 'followUp'], defaults: { type: 'full-mock', durationMinutes: 0, score: 0 } }),

  flat('applications', 'applications', [
    ['company', 'company'],
    ['role', 'role'],
    ['type', 'type'],
    ['applicationDate', 'application_date'],
    ['deadline', 'deadline'],
    ['status', 'status'],
    ['oaDate', 'oa_date'],
    ['interviewDate', 'interview_date'],
    ['resumeVersion', 'resume_version'],
    ['referral', 'referral'],
    ['archived', 'archived'],
    ['notes', 'notes'],
    ['createdAt', 'created_at'],
    ['updatedAt', 'updated_at'],
  ], { optional: ['applicationDate', 'deadline', 'oaDate', 'interviewDate', 'resumeVersion', 'notes'], defaults: { role: '', type: '', status: 'interested', referral: false, archived: false } }),

  {
    key: 'companies',
    table: 'companies',
    cols: [['name', 'name'], ['notes', 'notes'], ['createdAt', 'created_at'], ['updatedAt', 'updated_at']],
    optional: ['notes'],
    collect: (data) => data.companies.map((ts) => ({ id: String(ts.id), ts: ts as unknown as RowObject })),
    assemble: (rows) => rows,
  },

  {
    key: 'companies',
    table: 'company_checklist_items',
    cols: [['label', 'label'], ['done', 'done'], ['order', 'order'], ['createdAt', 'created_at']],
    defaults: { done: false, order: 0 },
    passThrough: ['company_id'],
    collect: (data) =>
      data.companies.flatMap((company) =>
        company.checklist.map((item, i) => ({
          id: String(item.id),
          ts: { label: item.label, done: item.done, order: i, createdAt: company.createdAt } as RowObject,
          extra: { company_id: String(company.id) },
        })),
      ),
  },

  flat('goals', 'goals', [
    ['title', 'title'],
    ['metric', 'metric'],
    ['refId', 'ref_id'],
    ['target', 'target'],
    ['manualCurrent', 'manual_current'],
    ['unit', 'unit'],
    ['deadline', 'deadline'],
    ['priority', 'priority'],
    ['createdAt', 'created_at'],
    ['updatedAt', 'updated_at'],
  ], { optional: ['refId', 'deadline'], defaults: { metric: 'manual', target: 0, manualCurrent: 0, unit: '', priority: 'medium' } }),

  {
    key: 'roadmap',
    table: 'roadmap_weeks',
    cols: [
      ['weekNumber', 'week_number'],
      ['title', 'title'],
      ['focus', 'focus'],
      ['startDate', 'start_date'],
      ['endDate', 'end_date'],
      ['expectedHours', 'expected_hours'],
      ['subjectIds', 'subject_ids'],
      ['subjectNames', 'subject_names'],
      ['createdAt', 'created_at'],
      ['updatedAt', 'updated_at'],
    ],
    json: ['subjectIds', 'subjectNames'],
    defaults: { weekNumber: 1, title: '', focus: '', expectedHours: 0 },
    collect: (data) => data.roadmap.map((ts) => ({ id: String(ts.id), ts: ts as unknown as RowObject })),
    assemble: (rows) => rows,
  },

  {
    key: 'roadmap',
    table: 'roadmap_tasks',
    cols: [
      ['title', 'title'],
      ['type', 'type'],
      ['subjectId', 'subject_id'],
      ['topicId', 'topic_id'],
      ['estimatedMinutes', 'estimated_minutes'],
      ['priority', 'priority'],
      ['done', 'done'],
      ['doneAt', 'done_at'],
      ['order', 'order'],
    ],
    optional: ['subjectId', 'topicId', 'doneAt'],
    passThrough: ['week_id'],
    defaults: { type: 'dsa', estimatedMinutes: 30, priority: 'medium', done: false, order: 0 },
    collect: (data) =>
      data.roadmap.flatMap((week) =>
        week.tasks.map((task, i) => ({
          id: String(task.id),
          ts: { ...(task as unknown as RowObject), order: i } as RowObject,
          extra: { week_id: String(week.id) },
        })),
      ),
  },

  flat('activities', 'activities', [
    ['kind', 'kind'],
    ['label', 'label'],
    ['detail', 'detail'],
    ['at', 'at'],
    ['minutes', 'minutes'],
    ['subjectId', 'subject_id'],
    ['topicId', 'topic_id'],
    ['problemId', 'problem_id'],
    ['projectId', 'project_id'],
  ], { optional: ['detail', 'minutes', 'subjectId', 'topicId', 'problemId', 'projectId'] }),
];

/** `Project.checklist` is a `Record<string, boolean>` — synced by (project_id, key). */
export const PROJECT_CHECKLIST_TABLE = 'project_checklist_items';

/**
 * Convert one TypeScript entity into an insertable/upsertable row.
 *
 * Deliberately takes NO owner: `user_id` is ownership metadata, not user data,
 * so it is stamped in by `stampOwnership()` at the last possible moment instead
 * of being threaded in from a caller. A mapper therefore cannot be handed a
 * stale or wrong id, and `AppData` can never influence it.
 */
export function toRow(spec: CollectionSpec, entity: EntityRow): RowObject {
  const row: RowObject = { id: entity.id };
  const jsonFields = spec.json ?? [];
  for (const [tsField, column] of spec.cols) {
    const value = entity.ts[tsField];
    if (jsonFields.includes(tsField)) {
      row[column] = value === undefined || value === null ? [] : value;
    } else {
      // undefined must become null so that clearing a field actually clears the
      // column; an omitted key would be left untouched by an upsert.
      row[column] = value === undefined ? null : value;
    }
  }
  if (entity.extra) {
    for (const [key, value] of Object.entries(entity.extra)) {
      // Never let an injected parent column set ownership.
      if (key === 'user_id') continue;
      row[key] = value;
    }
  }
  return row;
}

/**
 * Stamp the authenticated user's id onto rows bound for Postgres.
 *
 * This is the single place `user_id` is ever produced, and it is the reason the
 * RLS policies (`auth.uid() = user_id`) hold: `toRow()` cannot be called without
 * it, `settingsToRow()` has no owner argument to forget, and any `user_id`
 * already present on a row is overwritten rather than trusted. Every
 * user-owned INSERT/UPSERT goes through `writeOwned()` in services/cloud.ts,
 * which calls this.
 */
export function stampOwnership<T extends RowObject>(rows: readonly T[], userId: string): T[] {
  return rows.map((row) => ({ ...row, user_id: userId }));
}

/** Convert a database row back into a TypeScript-shaped entity. */
export function fromRow(spec: CollectionSpec, raw: RowObject): RowObject {
  const out: RowObject = { id: String(raw.id) };
  const jsonFields = spec.json ?? [];
  const optional = spec.optional ?? [];
  const defaults = spec.defaults ?? {};
  for (const [tsField, column] of spec.cols) {
    const value = raw[column];
    if (value === null || value === undefined) {
      if (optional.includes(tsField)) continue;
      if (jsonFields.includes(tsField)) {
        out[tsField] = [];
        continue;
      }
      if (tsField in defaults) out[tsField] = defaults[tsField];
      continue;
    }
    out[tsField] = value;
  }
  for (const column of spec.passThrough ?? []) {
    if (raw[column] !== null && raw[column] !== undefined) out[column] = raw[column];
  }
  // Ownership survives the read. Child rows are stitched onto their parents
  // after this, and callers may need to know whose records they are holding;
  // it is never re-sent from here because writes stamp it fresh (see
  // `stampOwnership`).
  if (raw.user_id !== null && raw.user_id !== undefined) out.user_id = raw.user_id;
  return out;
}
