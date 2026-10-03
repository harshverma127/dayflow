// ---------------------------------------------------------------------------
// Local -> cloud import.
//
// The IndexedDB workspace is never thrown away. When a user signs in for the
// first time on a device that already has local data, we offer to upload it.
// This module handles the fiddly part: the historical ID format
// (`sub_lz3k2_1_ab3xy`) is not a UUID, so every identifier and every reference
// is remapped consistently before anything is written. Relationships survive
// because the remap is a single shared lookup table applied to both sides.
// ---------------------------------------------------------------------------

import type { AppData } from '@/types';
import { createInitialData } from '@/data/seed';
import { isUuid, newUuid } from '@/lib/utils';
import { countWorkspace, syncWorkspace } from './cloud';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  /** Per-collection counts, used for the confirmation preview. */
  counts: Record<string, number>;
}

/** Collections that make up the workspace, in the order they are displayed. */
const COLLECTIONS = [
  'subjects',
  'topics',
  'tasks',
  'sessions',
  'dsaModules',
  'dsaTopics',
  'dsaPatterns',
  'dsaProblems',
  'dsaSessions',
  'revisions',
  'notes',
  'projects',
  'interviewQuestions',
  'stories',
  'mocks',
  'applications',
  'companies',
  'goals',
  'roadmap',
  'journal',
  'reviews',
  'activities',
] as const;

export function countEntities(data: AppData): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const key of COLLECTIONS) {
    const value = (data as unknown as Record<string, unknown>)[key];
    counts[key] = Array.isArray(value) ? value.length : 0;
  }
  counts.topics += data.topics.reduce((n, t) => n + t.subtopics.length, 0);
  counts.checklistItems = data.topics.reduce(
    (n, t) => n + t.subtopics.reduce((m, s) => m + s.items.length, 0),
    0,
  );
  return counts;
}

/** True when the workspace holds anything worth migrating. */
export function hasLocalData(data: AppData | null): boolean {
  if (!data) return false;
  return Object.entries(countEntities(data)).some(([key, n]) => key !== 'checklistItems' && n > 0);
}

/**
 * Checks the blob is shaped like an `AppData` before anything is uploaded.
 * Returns counts either way so the confirmation screen can show what will move.
 */
export function validateLocalData(raw: unknown): ValidationResult {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object') {
    return { ok: false, errors: ['That file does not contain a Dayflow workspace.'], counts: {} };
  }
  const data = raw as Partial<AppData>;
  if (!Array.isArray(data.subjects)) errors.push('subjects is missing or not a list');
  if (!Array.isArray(data.topics)) errors.push('topics is missing or not a list');
  for (const key of COLLECTIONS) {
    const value = (data as unknown as Record<string, unknown>)[key];
    if (value !== undefined && !Array.isArray(value)) errors.push(`${key} is not a list`);
  }
  if (data.topics) {
    for (const topic of data.topics) {
      if (!topic || typeof topic !== 'object') {
        errors.push('a topic entry is malformed');
        break;
      }
      if (!Array.isArray(topic.subtopics)) {
        errors.push(`topic "${String(topic.name)}" has no subtopics list`);
        break;
      }
    }
  }
  if (!data.settings || typeof data.settings !== 'object') errors.push('settings is missing');

  return {
    ok: errors.length === 0,
    errors,
    counts: errors.length ? {} : countEntities({ ...createInitialData(), ...data } as AppData),
  };
}

// ---------------------------------------------------------------------------
// UUID remapping
// ---------------------------------------------------------------------------

/**
 * Rewrites every legacy id into a UUID, updating all references in the same
 * pass so parent/child links stay intact.
 *
 * IDs that are already valid UUIDs are kept as-is, which is the "preserve IDs
 * where safe" requirement: an import of data created by this version of the
 * app does not renumber anything.
 */
export function ensureUuidIds(data: AppData): { data: AppData; remapped: number } {
  const mapping = new Map<string, string>();
  // Optional references in `types.ts` are `ID | undefined`; only `Topic.parentId`
  // is `ID | null`, and it is normalised with `?? null` below.
  const map = (id: string | null | undefined): string | undefined => {
    if (id === undefined || id === null || id === '') return undefined;
    if (isUuid(id)) return id;
    const existing = mapping.get(id);
    if (existing) return existing;
    const next = newUuid();
    mapping.set(id, next);
    return next;
  };

  const out = structuredClone(data) as AppData;

  out.subjects = out.subjects.map((s) => ({ ...s, id: map(s.id)! }));
  out.topics = out.topics.map((t) => ({
    ...t,
    id: map(t.id)!,
    subjectId: map(t.subjectId)!,
    parentId: map(t.parentId) ?? null,
    subtopics: t.subtopics.map((sub) => ({
      ...sub,
      id: map(sub.id)!,
      items: sub.items.map((item) => ({ ...item, id: map(item.id)! })),
    })),
    // Resource ids are never referenced elsewhere.
    resources: t.resources.map((r) => ({ ...r, id: map(r.id)! })),
  }));
  out.tasks = out.tasks.map((t) => ({
    ...t,
    id: map(t.id)!,
    subjectId: map(t.subjectId),
    topicId: map(t.topicId),
    subtopicId: map(t.subtopicId),
  }));
  out.sessions = out.sessions.map((s) => ({
    ...s,
    id: map(s.id)!,
    subjectId: map(s.subjectId),
    topicId: map(s.topicId),
    subtopicId: map(s.subtopicId),
  }));
  out.dsaModules = out.dsaModules.map((m) => ({ ...m, id: map(m.id)! }));
  out.dsaTopics = out.dsaTopics.map((t) => ({ ...t, id: map(t.id)!, moduleId: map(t.moduleId)! }));
  out.dsaPatterns = out.dsaPatterns.map((p) => ({
    ...p,
    id: map(p.id)!,
    moduleId: map(p.moduleId)!,
    topicId: map(p.topicId)!,
  }));
  out.dsaProblems = out.dsaProblems.map((p) => ({
    ...p,
    id: map(p.id)!,
    moduleId: map(p.moduleId),
    topicId: map(p.topicId),
    patternId: map(p.patternId),
  }));
  out.dsaSessions = out.dsaSessions.map((s) => ({
    ...s,
    id: map(s.id)!,
    moduleId: map(s.moduleId),
    topicId: map(s.topicId),
    patternId: map(s.patternId),
  }));
  out.revisions = out.revisions.map((r) => ({
    ...r,
    id: map(r.id)!,
    refId: map(r.refId),
    subjectId: map(r.subjectId),
    topicId: map(r.topicId),
    problemId: map(r.problemId),
  }));
  out.notes = out.notes.map((n) => ({
    ...n,
    id: map(n.id)!,
    subjectId: map(n.subjectId),
    topicId: map(n.topicId),
  }));
  out.journal = out.journal.map((j) => ({ ...j, id: map(j.id)!, problemId: map(j.problemId) }));
  out.reviews = out.reviews.map((r) => ({ ...r, id: map(r.id)! }));
  out.projects = out.projects.map((p) => ({ ...p, id: map(p.id)! }));
  out.interviewQuestions = out.interviewQuestions.map((q) => ({
    ...q,
    id: map(q.id)!,
    subjectId: map(q.subjectId),
    topicId: map(q.topicId),
  }));
  out.stories = out.stories.map((s) => ({ ...s, id: map(s.id)! }));
  out.mocks = out.mocks.map((m) => ({ ...m, id: map(m.id)! }));
  out.applications = out.applications.map((a) => ({ ...a, id: map(a.id)! }));
  out.companies = out.companies.map((c) => ({
    ...c,
    id: map(c.id)!,
    checklist: c.checklist.map((i) => ({ ...i, id: map(i.id)! })),
  }));
  out.goals = out.goals.map((g) => ({ ...g, id: map(g.id)!, refId: map(g.refId) }));
  out.roadmap = out.roadmap.map((w) => ({
    ...w,
    id: map(w.id)!,
    // `subjectIds` are references; `subjectNames` are display strings.
    subjectIds: w.subjectIds.map((id) => map(id)!),
    tasks: w.tasks.map((t) => ({
      ...t,
      id: map(t.id)!,
      subjectId: map(t.subjectId),
      topicId: map(t.topicId),
    })),
  }));
  out.activities = out.activities.map((a) => ({
    ...a,
    id: map(a.id)!,
    subjectId: map(a.subjectId),
    topicId: map(a.topicId),
    problemId: map(a.problemId),
    projectId: map(a.projectId),
  }));

  return { data: out, remapped: mapping.size };
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export interface ImportReport {
  remapped: number;
  /** Rows the import expected to create. */
  expected: Record<string, number>;
  /** Rows actually present afterwards. */
  actual: Record<string, number>;
}

/**
 * Uploads a local workspace to the authenticated user's account.
 *
 * Writes go through the same diffing layer the app uses day to day, seeded
 * from an empty baseline so every record is an insert. Parents are uploaded
 * before children (see COLLECTIONS ordering in services/schema.ts) and counts
 * are re-read afterwards so the caller can verify nothing was dropped. The
 * owner is resolved from the session by the sync layer, not passed in here.
 *
 * On any failure the local data is left untouched — the caller keeps the
 * IndexedDB copy as a backup until this resolves successfully.
 */
export async function importLocalToCloud(raw: unknown): Promise<ImportReport> {
  const validation = validateLocalData(raw);
  if (!validation.ok) {
    throw new Error(validation.errors.join(' ') || 'That data could not be read.');
  }

  const { data: remapped, remapped: remappedCount } = ensureUuidIds({ ...createInitialData(), ...(raw as AppData) });
  const expected = countEntities(remapped);

  await syncWorkspace(createInitialData(), remapped);

  const actual = await countWorkspace();
  return { remapped: remappedCount, expected, actual };
}
