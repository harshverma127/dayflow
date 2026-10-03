// ---------------------------------------------------------------------------
// Cloud data access — load and persist the whole workspace.
//
// Why whole-workspace sync instead of one query per component
// ------------------------------------------------------------
// The app already owns a single normalised `AppData` object in a zustand store
// that every page reads from (src/store.ts). Rather than teaching 14 pages
// about Supabase, this module is the *only* thing that speaks SQL, and it is
// installed as the store's persistence adapter. That keeps Supabase the single
// source of truth after sign-in while leaving the progress engine in
// src/lib/progress.ts and every page untouched.
//
// Reads fetch each table in parallel and stitch the nested children back onto
// their parents. Writes diff the previous snapshot against the next one and
// issue only upserts / deletes for what actually changed.
// ---------------------------------------------------------------------------

import type {
  AppData,
  ChecklistItem,
  Company,
  Project,
  RoadmapTask,
  RoadmapWeek,
  Settings,
  Subtopic,
  Topic,
} from '@/types';
import { createInitialData } from '@/data/seed';
import { supabase } from './supabase';
import { COLLECTIONS, PROJECT_CHECKLIST_TABLE, fromRow, stampOwnership, toRow, type EntityRow, type RowObject } from './schema';
import { requireUserId } from './auth';
import { setCloudStatus } from './cloudStatus';

/** PostgREST handles large bodies fine, but chunking keeps any single request bounded. */
const CHUNK = 200;

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// ---------------------------------------------------------------------------
// Settings (singleton per user)
// ---------------------------------------------------------------------------

function settingsFromRow(row: RowObject, fallback: Settings): Settings {
  return {
    name: (row.name as string) ?? fallback.name,
    targetRole: (row.target_role as string) ?? fallback.targetRole,
    graduationYear: (row.graduation_year as number) ?? fallback.graduationYear,
    preferredLanguage: (row.preferred_language as string) ?? fallback.preferredLanguage,
    prepType: (row.prep_type as Settings['prepType']) ?? fallback.prepType,
    roadmapStartDate: (row.roadmap_start_date as string) ?? fallback.roadmapStartDate,
    roadmapWeeks: (row.roadmap_weeks as number) ?? fallback.roadmapWeeks,
    dailyTargetHours: Number(row.daily_target_hours ?? fallback.dailyTargetHours),
    theme: (row.theme as Settings['theme']) ?? fallback.theme,
    notifications: (row.notifications as Settings['notifications']) ?? fallback.notifications,
    weights: (row.weights as Settings['weights']) ?? fallback.weights,
    historicalSolved: (row.historical_solved as number) ?? fallback.historicalSolved,
    pomodoro: (row.pomodoro as Settings['pomodoro']) ?? fallback.pomodoro,
    sidebarCollapsed: (row.sidebar_collapsed as boolean) ?? fallback.sidebarCollapsed,
    lastBackupAt: (row.last_backup_at as string | undefined) ?? fallback.lastBackupAt,
  };
}

function settingsToRow(settings: Settings, dsaSource: AppData['dsaSource']): RowObject {
  return {
    name: settings.name,
    target_role: settings.targetRole,
    graduation_year: settings.graduationYear,
    preferred_language: settings.preferredLanguage,
    prep_type: settings.prepType,
    roadmap_start_date: settings.roadmapStartDate || null,
    roadmap_weeks: settings.roadmapWeeks,
    daily_target_hours: settings.dailyTargetHours,
    theme: settings.theme,
    notifications: settings.notifications,
    weights: settings.weights,
    historical_solved: settings.historicalSolved,
    pomodoro: settings.pomodoro,
    sidebar_collapsed: settings.sidebarCollapsed,
    last_backup_at: settings.lastBackupAt ?? null,
    dsa_source: dsaSource,
  };
}

interface SettingsBundle {
  settings: Settings;
  dsaSource: AppData['dsaSource'];
}

/**
 * Reads the settings row, creating it on first sign-in.
 *
 * This is the ONLY row the app ever inserts by itself, and it contains only
 * empty defaults from `createInitialData()` — never sample content. A new
 * account therefore has zero subjects, topics, problems, projects and so on.
 *
 * The create path carries the authenticated `user_id` (stamped by
 * `writeOwned`), because `settings.user_id` is both `not null` and the
 * `on_conflict` target: without it Postgres rejected the row with
 * `42501 new row violates row-level security policy for table "settings"`.
 */
async function loadOrCreateSettings(userId: string): Promise<SettingsBundle> {
  const defaults = createInitialData();
  const { data, error } = await supabase.from('settings').select('*').maybeSingle();
  if (error) throw error;
  if (data) {
    const row = data as RowObject;
    return {
      settings: settingsFromRow(row, defaults.settings),
      dsaSource: { ...defaults.dsaSource, ...((row.dsa_source as AppData['dsaSource']) ?? {}) },
    };
  }
  await writeOwned('settings', [settingsToRow(defaults.settings, defaults.dsaSource)], 'user_id', userId);
  return { settings: defaults.settings, dsaSource: defaults.dsaSource };
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Fetches the authenticated user's entire workspace.
 * RLS guarantees every returned row belongs to the caller, so no client-side
 * ownership filtering is needed (or relied upon).
 */
export async function loadWorkspace(): Promise<AppData> {
  const data = createInitialData();

  // Reads are scoped by RLS alone; the id is resolved here only so that the
  // first-run settings row can be created with a real owner.
  const userId = await requireUserId();

  const settingsPromise = loadOrCreateSettings(userId);
  const tablePromises = COLLECTIONS.map(async (spec) => {
    const { data: rows, error } = await supabase.from(spec.table).select('*');
    if (error) throw error;
    return [spec.table, (rows ?? []) as RowObject[]] as const;
  });
  const projectItemsPromise = supabase
    .from(PROJECT_CHECKLIST_TABLE)
    .select('project_id, key, done, "order"');

  const [bundle, tableResults, projectItemsResult] = await Promise.all([
    settingsPromise,
    Promise.all(tablePromises),
    projectItemsPromise,
  ]);
  if (projectItemsResult.error) throw projectItemsResult.error;

  const rowsByTable = new Map<string, RowObject[]>(tableResults);
  const entitiesFor = (table: string): RowObject[] => {
    const spec = COLLECTIONS.find((s) => s.table === table);
    if (!spec) return [];
    return (rowsByTable.get(table) ?? []).map((row) => fromRow(spec, row));
  };

  // --- topic -> subtopic -> checklist tree --------------------------------
  const itemsBySubtopic = new Map<string, ChecklistItem[]>();
  for (const raw of entitiesFor('checklist_items')) {
    const subtopicId = String(raw.subtopic_id);
    const { subtopic_id, ...item } = raw as Record<string, unknown>;
    const list = itemsBySubtopic.get(subtopicId) ?? [];
    list.push(item as unknown as ChecklistItem);
    itemsBySubtopic.set(subtopicId, list);
  }
  const subtopicsByTopic = new Map<string, Subtopic[]>();
  for (const raw of entitiesFor('subtopics')) {
    const topicId = String(raw.topic_id);
    const { topic_id, ...sub } = raw as Record<string, unknown>;
    const list = subtopicsByTopic.get(topicId) ?? [];
    list.push({ ...(sub as unknown as Subtopic), items: itemsBySubtopic.get(String(sub.id)) ?? [] });
    subtopicsByTopic.set(topicId, list);
  }
  const topics = (entitiesFor('topics') as unknown as Topic[])
    .map((t) => ({ ...t, subtopics: subtopicsByTopic.get(String(t.id)) ?? [], resources: t.resources ?? [] }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // --- projects carry a `Record<string, boolean>` checklist ---------------
  const projectChecklist = new Map<string, Record<string, boolean>>();
  const orderedItems = ((projectItemsResult.data ?? []) as RowObject[]).sort(
    (a, b) => Number(a.order ?? 0) - Number(b.order ?? 0),
  );
  for (const row of orderedItems) {
    const pid = String(row.project_id);
    const record = projectChecklist.get(pid) ?? {};
    record[String(row.key)] = Boolean(row.done);
    projectChecklist.set(pid, record);
  }
  const projects = (entitiesFor('projects') as unknown as Project[]).map((p) => ({
    ...p,
    checklist: projectChecklist.get(String(p.id)) ?? {},
  }));

  // --- companies carry an ordered checklist array -------------------------
  const companyItemsById = new Map<string, Company['checklist']>();
  for (const raw of entitiesFor('company_checklist_items')) {
    const { company_id, ...item } = raw as Record<string, unknown>;
    const cid = String(company_id);
    const list = companyItemsById.get(cid) ?? [];
    list.push(item as unknown as Company['checklist'][number]);
    companyItemsById.set(cid, list);
  }
  const companies = (entitiesFor('companies') as unknown as Company[]).map((c) => ({
    ...c,
    checklist: companyItemsById.get(String(c.id)) ?? [],
  }));

  // --- roadmap weeks carry an ordered task list ---------------------------
  const tasksByWeek = new Map<string, RoadmapTask[]>();
  for (const raw of entitiesFor('roadmap_tasks')) {
    const weekId = String(raw.week_id);
    const { week_id, order, ...task } = raw as Record<string, unknown>;
    const list = tasksByWeek.get(weekId) ?? [];
    list.push(task as unknown as RoadmapTask);
    tasksByWeek.set(weekId, list);
  }
  const roadmap = (entitiesFor('roadmap_weeks') as unknown as RoadmapWeek[])
    .map((w) => ({ ...w, tasks: tasksByWeek.get(String(w.id)) ?? [] }))
    .sort((a, b) => (a.weekNumber ?? 0) - (b.weekNumber ?? 0));

  // --- flat collections ---------------------------------------------------
  const flatAssign: Partial<Record<keyof AppData, unknown>> = {
    subjects: entitiesFor('subjects'),
    tasks: entitiesFor('tasks'),
    sessions: entitiesFor('sessions'),
    dsaSessions: entitiesFor('dsa_sessions'),
    dsaModules: entitiesFor('dsa_modules'),
    dsaTopics: entitiesFor('dsa_topics'),
    dsaPatterns: entitiesFor('dsa_patterns'),
    dsaProblems: entitiesFor('dsa_problems'),
    revisions: entitiesFor('revisions'),
    notes: entitiesFor('notes'),
    journal: entitiesFor('journal_entries'),
    reviews: entitiesFor('weekly_reviews'),
    interviewQuestions: entitiesFor('interview_questions'),
    stories: entitiesFor('behavioral_stories'),
    mocks: entitiesFor('mock_interviews'),
    applications: entitiesFor('applications'),
    goals: entitiesFor('goals'),
    activities: (entitiesFor('activities') as unknown as AppData['activities']).sort((a, b) =>
      String(a.at).localeCompare(String(b.at)),
    ),
    topics,
    projects,
    companies,
    roadmap,
  };

  Object.assign(data, flatAssign);
  data.settings = bundle.settings;
  data.dsaSource = bundle.dsaSource;
  return data;
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * The single write path for user-owned tables.
 *
 * Nothing in this module inserts or upserts by hand any more: every row is
 * stamped with the authenticated `user_id` immediately before it is sent, so a
 * caller cannot forget it, pass a stale one, or smuggle one in through a mapped
 * field. `on_conflict: 'user_id'` only works because the column is present here.
 */
async function writeOwned(table: string, rows: RowObject[], onConflict: string, userId: string): Promise<void> {
  const owned = stampOwnership(rows, userId);
  for (const batch of chunks(owned, CHUNK)) {
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) throw error;
  }
}

/**
 * `Project.checklist` is a keyed map, so these rows are identified by
 * (project_id, key) rather than by a client-held UUID. Stale keys are removed
 * explicitly; rows for deleted projects go via ON DELETE CASCADE.
 */
async function syncProjectChecklists(projects: Project[], userId: string): Promise<void> {
  for (const project of projects) {
    const entries = Object.entries(project.checklist ?? {});
    const rows: RowObject[] = entries.map(([key, done], i) => ({
      project_id: String(project.id),
      key,
      done: Boolean(done),
      order: i,
    }));
    if (rows.length) await writeOwned(PROJECT_CHECKLIST_TABLE, rows, 'project_id,key', userId);

    const query = supabase
      .from(PROJECT_CHECKLIST_TABLE)
      .delete()
      .eq('user_id', userId)
      .eq('project_id', String(project.id));
    if (entries.length) {
      const inList = entries.map(([k]) => `"${k.replace(/"/g, '')}"`).join(',');
      const { error } = await query.not('key', 'in', `(${inList})`);
      if (error) throw error;
    } else {
      const { error } = await query;
      if (error) throw error;
    }
  }
}

function projectChecklistDiff(prev: AppData, next: AppData): boolean {
  const before = new Map(prev.projects.map((p) => [String(p.id), p.checklist]));
  for (const project of next.projects) {
    if (JSON.stringify(before.get(String(project.id)) ?? {}) !== JSON.stringify(project.checklist)) return true;
  }
  for (const id of before.keys()) if (!next.projects.some((p) => String(p.id) === id)) return true;
  return false;
}

/**
 * Persists the difference between two workspace snapshots.
 *
 * Only rows that were added, changed or removed are touched. Parents are
 * written before children (see `COLLECTIONS` ordering) and removals rely on
 * `ON DELETE CASCADE`, so removing a subject also clears its topics,
 * subtopics and checklist items in one statement.
 *
 * The owner comes from the session, never from the caller and never from
 * `AppData`: `requireUserId()` is called once per sync and the resulting id is
 * stamped onto every row by `writeOwned()`. Deletes are scoped to that same id
 * on top of RLS.
 */
export async function syncWorkspace(prev: AppData, next: AppData): Promise<number> {
  const userId = await requireUserId();

  let written = 0;

  for (const spec of COLLECTIONS) {
    const nextRows = spec.collect(next);
    const prevRows = spec.collect(prev);
    const prevById = new Map(prevRows.map((r) => [r.id, r]));

    const toUpsert: EntityRow[] = [];
    for (const row of nextRows) {
      const before = prevById.get(row.id);
      if (!before || JSON.stringify(toRow(spec, before)) !== JSON.stringify(toRow(spec, row))) {
        toUpsert.push(row);
      }
    }

    const nextIds = new Set(nextRows.map((r) => r.id));
    const removed = prevRows.map((r) => r.id).filter((id) => !nextIds.has(id));

    if (toUpsert.length) {
      await writeOwned(spec.table, toUpsert.map((row) => toRow(spec, row)), 'id', userId);
      written += toUpsert.length;
    }
    if (removed.length) {
      for (const batch of chunks(removed, CHUNK)) {
        const { error } = await supabase.from(spec.table).delete().eq('user_id', userId).in('id', batch);
        if (error) throw error;
      }
      written += removed.length;
    }
  }

  if (projectChecklistDiff(prev, next)) await syncProjectChecklists(next.projects, userId);

  await writeOwned('settings', [settingsToRow(next.settings, next.dsaSource)], 'user_id', userId);

  setCloudStatus({ pending: false, lastSyncedAt: Date.now() });
  return written;
}

/** Row counts per table, used to verify an import actually landed. */
export async function countWorkspace(): Promise<Record<string, number>> {
  const tables = [...new Set([...COLLECTIONS.map((s) => s.table), PROJECT_CHECKLIST_TABLE])];
  const entries = await Promise.all(
    tables.map(async (table) => {
      const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
      return [table, error ? 0 : (count ?? 0)] as const;
    }),
  );
  return Object.fromEntries(entries);
}
