import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  Activity,
  AppData,
  Application,
  ApplicationStatus,
  BehavioralStory,
  ChecklistItem,
  Company,
  DSAProblem,
  DSAModule,
  DSAPattern,
  DSASession,
  DSATopic,
  Difficulty,
  Goal,
  ID,
  InterviewQuestion,
  JournalEntry,
  MockInterview,
  Note,
  Project,
  Resource,
  RevisionConfidence,
  RevisionItem,
  RoadmapTask,
  Settings,
  StudySession,
  Subject,
  Subtopic,
  Task,
  Topic,
  TopicStatus,
  WeeklyReview,
} from '@/types';
import { createInitialData } from '@/data/seed';
import { cloudStorage } from '@/services/cloudStorage';
import { DATA_VERSION, REVISION_INTERVALS } from '@/lib/constants';
import type { DsaImportResult, ImportedDsaRow } from '@/lib/dsaImport';
import { migrateV1toV2 } from '@/lib/migration';
import { addDaysISO, nowISO, todayISO, uid } from '@/lib/utils';

// Kept identical to v1 on purpose: the persisted payload carries its own
// `version`, so existing data is found, backed up and migrated rather than lost.
const STORAGE_KEY = 'preptrack:v1';
const BACKUP_KEY = 'preptrack:backup:pre-migration';
export { DATA_VERSION };

type LifecycleKey = 'learned' | 'practiced' | 'canExplain' | 'applied';
type ProblemFlag = 'attempted' | 'solved' | 'understood' | 'independent' | 'mastered' | 'needsRevision' | 'hintUsed' | 'editorialUsed' | 'solutionWatched';

interface Actions {
  updateSettings: (patch: Partial<Settings>) => void;
  importData: (data: AppData) => void;
  resetData: () => void;
  clearAll: () => void;
  markBackup: () => void;
  readBackup: () => string | null;
  undo: () => void;
  _history: AppData[];

  // subjects
  addSubject: (input: {
    name: string;
    description?: string;
    category?: Subject['category'];
    priority?: Subject['priority'];
    difficulty?: Subject['difficulty'];
    targetDate?: string;
    weeklyTargetHours?: number;
    color?: string;
    units?: { name: string; topics: { name: string; subs: string[] }[] }[];
  }) => ID;
  updateSubject: (id: ID, patch: Partial<Subject>) => void;
  deleteSubject: (id: ID) => void;
  setSubjectArchived: (id: ID, archived: boolean) => void;
  moveSubject: (id: ID, dir: -1 | 1) => void;

  // topic tree
  addUnit: (subjectId: ID, name: string) => ID;
  addTopic: (input: { subjectId: ID; parentId?: ID | null; name: string; subtopics?: string[] }) => ID;
  updateTopic: (id: ID, patch: Partial<Topic>) => void;
  deleteTopic: (id: ID) => void;
  toggleLifecycle: (id: ID, key: LifecycleKey) => void;
  completeTopic: (id: ID) => void;
  moveTopic: (id: ID, dir: -1 | 1) => void;

  // subtopics & checklist
  addSubtopic: (topicId: ID, name: string) => void;
  updateSubtopic: (topicId: ID, subId: ID, patch: Partial<Subtopic>) => void;
  deleteSubtopic: (topicId: ID, subId: ID) => void;
  toggleSubtopicDone: (topicId: ID, subId: ID) => void;
  addChecklistItem: (topicId: ID, subId: ID, name: string) => void;
  toggleChecklistItem: (topicId: ID, subId: ID, itemId: ID) => void;
  updateChecklistItem: (topicId: ID, subId: ID, itemId: ID, patch: Partial<ChecklistItem>) => void;
  deleteChecklistItem: (topicId: ID, subId: ID, itemId: ID) => void;
  setConfidence: (kind: 'topic' | 'subtopic' | 'problem' | 'question' | 'story', ids: { topicId?: ID; subId?: ID; itemId?: ID }, value: number) => void;

  // resources
  addResource: (topicId: ID, resource: Omit<Resource, 'id'>) => void;
  toggleResource: (topicId: ID, resourceId: ID) => void;
  deleteResource: (topicId: ID, resourceId: ID) => void;

  // tasks
  addTask: (input: Partial<Task> & { title: string }) => ID;
  updateTask: (id: ID, patch: Partial<Task>) => void;
  deleteTask: (id: ID) => void;
  toggleTask: (id: ID) => void;
  planDay: (date: string) => number;

  // study sessions
  addSession: (input: Partial<StudySession> & { minutes: number }) => void;
  deleteSession: (id: ID) => void;
  addDsaSession: (input: Partial<DSASession> & { minutes: number }) => void;

  // dsa
  addProblem: (input: Partial<DSAProblem> & { name: string }) => ID;
  updateProblem: (id: ID, patch: Partial<DSAProblem>) => void;
  deleteProblem: (id: ID) => void;
  toggleProblemFlag: (id: ID, key: ProblemFlag) => void;
  reviewProblem: (id: ID, result: RevisionConfidence) => void;
  addDsaPattern: (input: { moduleName: string; topicName: string; patternName: string }) => void;
  addDsaModule: (name: string) => ID;
  updateDsaModule: (id: ID, patch: Partial<DSAModule>) => void;
  deleteDsaModule: (id: ID) => void;
  addDsaTopic: (moduleId: ID, name: string) => ID;
  deleteDsaTopic: (id: ID) => void;
  createDsaPattern: (input: { moduleId: ID; topicId: ID; name: string }) => ID;
  deleteDsaPattern: (id: ID) => void;
  importDsaRows: (rows: ImportedDsaRow[], opts?: { skipExisting?: boolean }) => DsaImportResult;

  // revisions
  addRevisionItem: (input: Partial<RevisionItem> & { label: string; dueDate: string }) => void;
  updateRevisionItem: (id: ID, patch: Partial<RevisionItem>) => void;
  deleteRevisionItem: (id: ID) => void;
  reviewRevision: (id: ID, result: RevisionConfidence) => void;

  // notes
  addNote: (input: Partial<Note> & { title: string }) => ID;
  updateNote: (id: ID, patch: Partial<Note>) => void;
  deleteNote: (id: ID) => void;

  // projects
  addProject: (input: Partial<Project> & { name: string }) => ID;
  updateProject: (id: ID, patch: Partial<Project>) => void;
  deleteProject: (id: ID) => void;
  toggleProjectChecklist: (id: ID, key: string) => void;

  // interviews
  addQuestion: (input: Partial<InterviewQuestion> & { question: string }) => ID;
  updateQuestion: (id: ID, patch: Partial<InterviewQuestion>) => void;
  deleteQuestion: (id: ID) => void;
  addMock: (input: Partial<MockInterview> & { date: string }) => void;
  deleteMock: (id: ID) => void;
  addStory: (input: Partial<BehavioralStory> & { title: string }) => ID;
  updateStory: (id: ID, patch: Partial<BehavioralStory>) => void;
  deleteStory: (id: ID) => void;

  // applications & companies
  addApplication: (input: Partial<Application> & { company: string; role: string }) => void;
  updateApplication: (id: ID, patch: Partial<Application>) => void;
  deleteApplication: (id: ID) => void;
  setApplicationStatus: (id: ID, status: ApplicationStatus) => void;
  addCompany: (input: Partial<Company> & { name: string }) => ID;
  updateCompany: (id: ID, patch: Partial<Company>) => void;
  deleteCompany: (id: ID) => void;
  toggleCompanyChecklist: (id: ID, itemId: ID) => void;

  // goals
  addGoal: (input: Partial<Goal> & { title: string }) => void;
  updateGoal: (id: ID, patch: Partial<Goal>) => void;
  deleteGoal: (id: ID) => void;

  // roadmap
  toggleRoadmapTask: (weekId: ID, taskId: ID) => void;
  addRoadmapTask: (weekId: ID, task: Omit<RoadmapTask, 'id' | 'done'>) => void;
  updateRoadmapWeek: (weekId: ID, patch: Partial<{ title: string; focus: string; expectedHours: number }>) => void;

  // journal & reviews
  addJournal: (input: Partial<JournalEntry> & { problem: string }) => void;
  updateJournal: (id: ID, patch: Partial<JournalEntry>) => void;
  deleteJournal: (id: ID) => void;
  saveReview: (input: Partial<WeeklyReview> & { weekStart: string; weekEnd: string }) => void;
}

export type Store = AppData & Actions;

function pickData(s: Store): AppData {
  return {
    version: DATA_VERSION,
    subjects: s.subjects,
    topics: s.topics,
    tasks: s.tasks,
    sessions: s.sessions,
    dsaSessions: s.dsaSessions,
    dsaModules: s.dsaModules,
    dsaTopics: s.dsaTopics,
    dsaPatterns: s.dsaPatterns,
    dsaProblems: s.dsaProblems,
    dsaSource: s.dsaSource,
    revisions: s.revisions,
    notes: s.notes,
    projects: s.projects,
    interviewQuestions: s.interviewQuestions,
    stories: s.stories,
    mocks: s.mocks,
    applications: s.applications,
    companies: s.companies,
    goals: s.goals,
    roadmap: s.roadmap,
    journal: s.journal,
    reviews: s.reviews,
    activities: s.activities,
    settings: s.settings,
  };
}

function patchList<T extends { id: ID }>(list: T[], id: ID, patch: Partial<T>): T[] {
  return list.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

function snapshot(data: AppData): AppData {
  return JSON.parse(JSON.stringify(data)) as AppData;
}

const ACTIVITY_CAP = 400;

export const useStore = create<Store>()(
  persist(
    (set, get) => {
      const pushHistory = () => {
        const hist = [...get()._history, snapshot(pickData(get()))].slice(-6);
        set({ _history: hist });
      };

      const log = (entry: Omit<Activity, 'id' | 'at'> & { at?: string }) => {
        const item: Activity = { id: uid('act'), at: entry.at ?? nowISO(), ...entry };
        set((s) => ({ activities: [...s.activities, item].slice(-ACTIVITY_CAP) }));
      };

      /**
       * When every subtopic of a topic is complete we schedule it into the
       * revision queue and record an activity — this is the only place topic
       * completion is detected, so no manual percentage is ever needed.
       */
      const syncTopicCompletion = (topicId: ID) => {
        const s = get();
        const topic = s.topics.find((t) => t.id === topicId);
        if (!topic || !topic.revisionEnabled) return;
        const subtopics = topic.subtopics;
        if (!subtopics.length) return;
        const allDone = subtopics.every((sub) => (sub.items.length ? sub.items.every((i) => i.done) : sub.done));
        const alreadyQueued = s.revisions.some((r) => r.topicId === topicId && !r.done);
        if (!allDone || alreadyQueued) return;
        const subjectName = s.subjects.find((x) => x.id === topic.subjectId)?.name ?? 'Topic';
        const today = todayISO();
        set((st) => ({
          revisions: [
            ...st.revisions,
            {
              id: uid('rev'),
              kind: 'topic' as const,
              refId: topicId,
              label: `${subjectName} — ${topic.name}`,
              subjectId: topic.subjectId,
              topicId,
              lastReviewed: today,
              dueDate: addDaysISO(today, REVISION_INTERVALS[0]),
              intervalDays: REVISION_INTERVALS[0],
              stage: 0,
              confidence: Math.max(topic.confidence, 3),
              done: false,
              createdAt: nowISO(),
            },
          ],
        }));
        log({ kind: 'topic', label: `Completed ${subjectName} — ${topic.name}`, detail: 'Added to the revision queue', subjectId: topic.subjectId, topicId });
      };

      return {
        ...createInitialData(),
        _history: [],

        updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

        importData: (data) => {
          pushHistory();
          // Never trust an imported blob to be complete: fill any missing
          // collection from the empty defaults so the app stays coherent.
          set({ ...createInitialData(), ...data, settings: { ...createInitialData().settings, ...(data.settings ?? {}) }, _history: get()._history });
        },

        resetData: () => {
          pushHistory();
          set({ ...createInitialData(), _history: get()._history });
        },

        clearAll: () => {
          pushHistory();
          // Wipe all user content but keep the user's configuration preferences.
          set({ ...createInitialData(), settings: { ...get().settings, historicalSolved: 0 }, _history: get()._history });
        },

        markBackup: () => set((s) => ({ settings: { ...s.settings, lastBackupAt: nowISO() } })),

        readBackup: () => {
          try {
            return localStorage.getItem(BACKUP_KEY);
          } catch {
            return null;
          }
        },

        undo: () => {
          const hist = get()._history;
          const last = hist[hist.length - 1];
          if (!last) return;
          set({ ...last, _history: hist.slice(0, -1) });
        },

        // ---------------- subjects ----------------
        addSubject: (input) => {
          const id = uid('sub');
          const subject: Subject = {
            id,
            name: input.name,
            description: input.description ?? '',
            category: input.category ?? 'other',
            color: input.color ?? '#6f8a76',
            priority: input.priority ?? 'medium',
            difficulty: input.difficulty ?? 'medium',
            targetDate: input.targetDate,
            weeklyTargetHours: input.weeklyTargetHours ?? 8,
            archived: false,
            order: get().subjects.length,
            createdAt: nowISO(),
            updatedAt: nowISO(),
          };
          const units: Topic[] = [];
          const topics: Topic[] = [];
          (input.units ?? []).forEach((u, ui) => {
            const unitId = uid('unit');
            units.push({
              id: unitId,
              subjectId: id,
              parentId: null,
              kind: 'unit',
              name: u.name,
              order: ui,
              priority: subject.priority,
              confidence: 1,
              learned: false,
              practiced: false,
              canExplain: false,
              applied: false,
              estimatedMinutes: 0,
              actualMinutes: 0,
              subtopics: [],
              resources: [],
              revisionEnabled: false,
              createdAt: nowISO(),
              updatedAt: nowISO(),
            });
            u.topics.forEach((t, ti) => {
              topics.push({
                id: uid('top'),
                subjectId: id,
                parentId: unitId,
                kind: 'topic',
                name: t.name,
                order: ti,
                priority: subject.priority,
                confidence: 1,
                learned: false,
                practiced: false,
                canExplain: false,
                applied: false,
                estimatedMinutes: 120,
                actualMinutes: 0,
                subtopics: t.subs.map((name) => ({ id: uid('sub'), name, done: false, confidence: 1, items: [] })),
                resources: [],
                revisionEnabled: true,
                createdAt: nowISO(),
                updatedAt: nowISO(),
              });
            });
          });
          set((s) => ({ subjects: [...s.subjects, subject], topics: [...s.topics, ...units, ...topics] }));
          log({ kind: 'topic', label: `Added subject ${subject.name}`, subjectId: id });
          return id;
        },

        updateSubject: (id, patch) => set((s) => ({ subjects: patchList(s.subjects, id, { ...patch, updatedAt: nowISO() }) })),

        deleteSubject: (id) => {
          pushHistory();
          set((s) => ({
            subjects: s.subjects.filter((x) => x.id !== id),
            topics: s.topics.filter((t) => t.subjectId !== id),
            tasks: s.tasks.filter((t) => t.subjectId !== id),
            sessions: s.sessions.filter((x) => x.subjectId !== id),
            revisions: s.revisions.filter((r) => r.subjectId !== id),
            notes: s.notes.map((n) => (n.subjectId === id ? { ...n, subjectId: undefined } : n)),
            goals: s.goals.map((g) => (g.refId === id ? { ...g, metric: 'manual' as const, refId: undefined } : g)),
            roadmap: s.roadmap.map((w) => ({
              ...w,
              subjectIds: w.subjectIds.filter((x) => x !== id),
              subjectNames: w.subjectNames.filter((_, i) => w.subjectIds[i] !== id),
            })),
          }));
        },

        setSubjectArchived: (id, archived) => {
          set((s) => ({ subjects: patchList(s.subjects, id, { archived, archivedAt: archived ? nowISO() : undefined, updatedAt: nowISO() }) }));
          if (archived) log({ kind: 'topic', label: `Archived ${get().subjects.find((x) => x.id === id)?.name ?? 'subject'}` });
        },

        moveSubject: (id, dir) => {
          const ordered = [...get().subjects].sort((a, b) => a.order - b.order);
          const idx = ordered.findIndex((s) => s.id === id);
          const swap = ordered[idx + dir];
          if (!swap) return;
          set((s) => ({ subjects: patchList(patchList(s.subjects, id, { order: swap.order }), swap.id, { order: ordered[idx].order }) }));
        },

        // ---------------- topic tree ----------------
        addUnit: (subjectId, name) => {
          const id = uid('unit');
          const unit: Topic = {
            id,
            subjectId,
            parentId: null,
            kind: 'unit',
            name,
            order: get().topics.filter((t) => t.subjectId === subjectId && t.parentId === null).length,
            priority: 'medium',
            confidence: 1,
            learned: false,
            practiced: false,
            canExplain: false,
            applied: false,
            estimatedMinutes: 0,
            actualMinutes: 0,
            subtopics: [],
            resources: [],
            revisionEnabled: false,
            createdAt: nowISO(),
            updatedAt: nowISO(),
          };
          set((s) => ({ topics: [...s.topics, unit] }));
          return id;
        },

        addTopic: (input) => {
          const id = uid('top');
          const siblings = get().topics.filter((t) => t.subjectId === input.subjectId && (t.parentId ?? null) === (input.parentId ?? null));
          const topic: Topic = {
            id,
            subjectId: input.subjectId,
            parentId: input.parentId ?? null,
            kind: 'topic',
            name: input.name,
            order: siblings.length,
            priority: 'medium',
            confidence: 1,
            learned: false,
            practiced: false,
            canExplain: false,
            applied: false,
            estimatedMinutes: 120,
            actualMinutes: 0,
            subtopics: (input.subtopics ?? []).map((name) => ({ id: uid('sub'), name, done: false, confidence: 1, items: [] })),
            resources: [],
            revisionEnabled: true,
            createdAt: nowISO(),
            updatedAt: nowISO(),
          };
          set((s) => ({ topics: [...s.topics, topic] }));
          return id;
        },

        updateTopic: (id, patch) => set((s) => ({ topics: patchList(s.topics, id, { ...patch, updatedAt: nowISO() }) })),

        deleteTopic: (id) => {
          pushHistory();
          set((s) => {
            const children = new Set<ID>([id]);
            let changed = true;
            while (changed) {
              changed = false;
              for (const t of s.topics) {
                if (t.parentId && children.has(t.parentId) && !children.has(t.id)) {
                  children.add(t.id);
                  changed = true;
                }
              }
            }
            return {
              topics: s.topics.filter((t) => !children.has(t.id)),
              revisions: s.revisions.filter((r) => !r.topicId || !children.has(r.topicId)),
              tasks: s.tasks.map((t) => (t.topicId && children.has(t.topicId) ? { ...t, topicId: undefined } : t)),
              sessions: s.sessions.map((x) => (x.topicId && children.has(x.topicId) ? { ...x, topicId: undefined } : x)),
            };
          });
        },

        toggleLifecycle: (id, key) =>
          set((s) => ({
            topics: s.topics.map((t) => (t.id === id ? { ...t, [key]: !t[key], updatedAt: nowISO(), lastStudiedAt: nowISO() } : t)),
          })),

        completeTopic: (id) => {
          const topic = get().topics.find((t) => t.id === id);
          if (!topic) return;
          const subjectName = get().subjects.find((x) => x.id === topic.subjectId)?.name ?? 'Subject';
          set((s) => ({
            topics: s.topics.map((t) =>
              t.id === id
                ? {
                    ...t,
                    learned: true,
                    practiced: true,
                    canExplain: true,
                    applied: true,
                    lastStudiedAt: nowISO(),
                    updatedAt: nowISO(),
                    confidence: Math.max(t.confidence, 3),
                    subtopics: t.subtopics.map((sub) => ({ ...sub, done: true, items: sub.items.map((i) => (i.done ? i : { ...i, done: true, doneAt: nowISO() })) })),
                  }
                : t,
            ),
          }));
          log({ kind: 'topic', label: `Completed ${subjectName} — ${topic.name}`, subjectId: topic.subjectId, topicId: id });
          syncTopicCompletion(id);
        },

        moveTopic: (id, dir) => {
          const t = get().topics.find((x) => x.id === id);
          if (!t) return;
          const siblings = get().topics.filter((x) => x.subjectId === t.subjectId && (x.parentId ?? null) === (t.parentId ?? null)).sort((a, b) => a.order - b.order);
          const idx = siblings.findIndex((x) => x.id === id);
          const swap = siblings[idx + dir];
          if (!swap) return;
          set((s) => ({ topics: patchList(patchList(s.topics, id, { order: swap.order }), swap.id, { order: siblings[idx].order }) }));
        },

        // ---------------- subtopics & checklist ----------------
        addSubtopic: (topicId, name) =>
          set((s) => ({
            topics: s.topics.map((t) => (t.id === topicId ? { ...t, subtopics: [...t.subtopics, { id: uid('sub'), name, done: false, confidence: 1, items: [] }], updatedAt: nowISO() } : t)),
          })),

        updateSubtopic: (topicId, subId, patch) =>
          set((s) => ({
            topics: s.topics.map((t) => (t.id === topicId ? { ...t, subtopics: t.subtopics.map((x) => (x.id === subId ? { ...x, ...patch } : x)) } : t)),
          })),

        deleteSubtopic: (topicId, subId) =>
          set((s) => ({
            topics: s.topics.map((t) => (t.id === topicId ? { ...t, subtopics: t.subtopics.filter((x) => x.id !== subId) } : t)),
          })),

        toggleSubtopicDone: (topicId, subId) => {
          const topic = get().topics.find((t) => t.id === topicId);
          const sub = topic?.subtopics.find((x) => x.id === subId);
          set((s) => ({
            topics: s.topics.map((t) =>
              t.id === topicId
                ? { ...t, updatedAt: nowISO(), lastStudiedAt: nowISO(), subtopics: t.subtopics.map((x) => (x.id === subId ? { ...x, done: !x.done } : x)) }
                : t,
            ),
          }));
          if (sub && !sub.done) {
            log({ kind: 'subtopic', label: `Completed ${topic?.name} → ${sub.name}`, subjectId: topic?.subjectId, topicId });
          }
          syncTopicCompletion(topicId);
        },

        addChecklistItem: (topicId, subId, name) =>
          set((s) => ({
            topics: s.topics.map((t) =>
              t.id === topicId
                ? { ...t, updatedAt: nowISO(), subtopics: t.subtopics.map((x) => (x.id === subId ? { ...x, items: [...x.items, { id: uid('item'), name, done: false }] } : x)) }
                : t,
            ),
          })),

        toggleChecklistItem: (topicId, subId, itemId) => {
          let label: string | undefined;
          set((s) => {
            const topic = s.topics.find((t) => t.id === topicId);
            const sub = topic?.subtopics.find((x) => x.id === subId);
            const item = sub?.items.find((i) => i.id === itemId);
            if (item && !item.done) label = `${topic?.name} → ${sub?.name} → ${item.name}`;
            return {
              topics: s.topics.map((t) =>
                t.id === topicId
                  ? {
                      ...t,
                      updatedAt: nowISO(),
                      subtopics: t.subtopics.map((x) =>
                        x.id === subId
                          ? { ...x, items: x.items.map((i) => (i.id === itemId ? { ...i, done: !i.done, doneAt: !i.done ? nowISO() : undefined } : i)) }
                          : x,
                      ),
                    }
                  : t,
              ),
            };
          });
          if (label) log({ kind: 'checklist', label: `Checked ${label}`, topicId });
          syncTopicCompletion(topicId);
        },

        updateChecklistItem: (topicId, subId, itemId, patch) =>
          set((s) => ({
            topics: s.topics.map((t) =>
              t.id === topicId
                ? { ...t, subtopics: t.subtopics.map((x) => (x.id === subId ? { ...x, items: x.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) } : x)) }
                : t,
            ),
          })),

        deleteChecklistItem: (topicId, subId, itemId) =>
          set((s) => ({
            topics: s.topics.map((t) =>
              t.id === topicId ? { ...t, subtopics: t.subtopics.map((x) => (x.id === subId ? { ...x, items: x.items.filter((i) => i.id !== itemId) } : x)) } : t,
            ),
          })),

        setConfidence: (kind, ids, value) => {
          const { topicId, subId } = ids;
          if (kind === 'topic' && topicId) set((s) => ({ topics: patchList(s.topics, topicId, { confidence: value, updatedAt: nowISO() }) }));
          else if (kind === 'subtopic' && topicId && subId)
            set((s) => ({
              topics: s.topics.map((t) => (t.id === topicId ? { ...t, subtopics: t.subtopics.map((x) => (x.id === subId ? { ...x, confidence: value } : x)) } : t)),
            }));
          else if (kind === 'problem' && topicId) set((s) => ({ dsaProblems: patchList(s.dsaProblems, topicId, { confidence: value, updatedAt: nowISO() }) }));
          else if (kind === 'question' && topicId) set((s) => ({ interviewQuestions: patchList(s.interviewQuestions, topicId, { confidence: value, needsRevision: value <= 2, updatedAt: nowISO() }) }));
          else if (kind === 'story' && topicId) set((s) => ({ stories: patchList(s.stories, topicId, { confidence: value, updatedAt: nowISO() }) }));
        },

        // ---------------- resources ----------------
        addResource: (topicId, resource) =>
          set((s) => ({ topics: s.topics.map((t) => (t.id === topicId ? { ...t, resources: [...t.resources, { ...resource, id: uid('res') }] } : t)) })),
        toggleResource: (topicId, resourceId) =>
          set((s) => ({
            topics: s.topics.map((t) => (t.id === topicId ? { ...t, resources: t.resources.map((r) => (r.id === resourceId ? { ...r, done: !r.done } : r)) } : t)),
          })),
        deleteResource: (topicId, resourceId) =>
          set((s) => ({ topics: s.topics.map((t) => (t.id === topicId ? { ...t, resources: t.resources.filter((r) => r.id !== resourceId) } : t)) })),

        // ---------------- tasks ----------------
        addTask: (input) => {
          const id = uid('task');
          const task: Task = {
            id,
            title: input.title,
            date: input.date ?? todayISO(),
            tier: input.tier ?? 'normal',
            subjectId: input.subjectId,
            topicId: input.topicId,
            subtopicId: input.subtopicId,
            estimatedMinutes: input.estimatedMinutes ?? 30,
            priority: input.priority ?? 'medium',
            done: false,
            auto: input.auto ?? false,
            notes: input.notes,
            createdAt: nowISO(),
          };
          set((s) => ({ tasks: [...s.tasks, task] }));
          return id;
        },

        updateTask: (id, patch) => set((s) => ({ tasks: patchList(s.tasks, id, patch) })),

        deleteTask: (id) => {
          pushHistory();
          set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
        },

        toggleTask: (id) => {
          const task = get().tasks.find((t) => t.id === id);
          set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done, doneAt: !t.done ? nowISO() : undefined } : t)) }));
          if (task && !task.done) log({ kind: 'task', label: `Completed task: ${task.title}`, subjectId: task.subjectId, topicId: task.topicId });
        },

        /** Suggest a day's plan from revision, weak areas and the roadmap. Does not modify data. */
        planDay: (date) => {
          const s = get();
          const existing = s.tasks.filter((t) => t.date === date).map((t) => t.title.toLowerCase());
          const suggestions: { title: string; minutes: number; priority: Task['priority']; subjectId?: ID; topicId?: ID }[] = [];

          const dueProblems = s.dsaProblems.filter((p) => p.needsRevision && (p.nextRevisionAt ?? date) <= date).slice(0, 3);
          const dueTopics = s.revisions.filter((r) => !r.done && r.dueDate <= date).slice(0, 2);
          for (const r of dueTopics) suggestions.push({ title: `Revise: ${r.label}`, minutes: 30, priority: 'high', subjectId: r.subjectId, topicId: r.topicId });
          if (dueProblems.length) suggestions.push({ title: `Revise ${dueProblems.length} DSA problem(s): ${dueProblems.map((p) => p.name).slice(0, 2).join(', ')}`, minutes: 45, priority: 'high' });

          const focus = s.topics
            .filter((t) => t.kind === 'topic' && t.confidence > 0 && t.confidence <= 2 && t.subtopics.some((sub) => sub.done))
            .slice(0, 1);
          for (const t of focus) {
            const subject = s.subjects.find((x) => x.id === t.subjectId);
            suggestions.push({ title: `${subject?.name ?? 'Topic'} — ${t.name} (weak area)`, minutes: 60, priority: 'critical', subjectId: t.subjectId, topicId: t.id });
          }

          suggestions.push({ title: 'DSA: solve 2 new problems', minutes: 60, priority: 'high' });

          const week = s.roadmap.find((w) => w.startDate <= date && date <= w.endDate);
          const nextRoadmapTask = week?.tasks.find((t) => !t.done);
          if (nextRoadmapTask) suggestions.push({ title: nextRoadmapTask.title, minutes: nextRoadmapTask.estimatedMinutes, priority: nextRoadmapTask.priority, subjectId: nextRoadmapTask.subjectId, topicId: nextRoadmapTask.topicId });

          const targetRemaining = s.settings.dailyTargetHours * 60 - suggestions.reduce((a, x) => a + x.minutes, 0);
          if (targetRemaining > 30) suggestions.push({ title: 'Continue learning the current topic', minutes: Math.min(90, targetRemaining), priority: 'medium' });

          let created = 0;
          for (const suggestion of suggestions) {
            if (existing.includes(suggestion.title.toLowerCase())) continue;
            get().addTask({ ...suggestion, date, auto: true });
            created += 1;
          }
          if (created) log({ kind: 'task', label: `Generated a suggested plan for ${date}`, detail: `${created} task(s) added` });
          return created;
        },

        // ---------------- study sessions ----------------
        addSession: (input) => {
          set((s) => ({
            sessions: [
              ...s.sessions,
              {
                id: uid('sess'),
                date: input.date ?? todayISO(),
                subjectId: input.subjectId,
                topicId: input.topicId,
                subtopicId: input.subtopicId,
                minutes: input.minutes,
                type: input.type ?? 'learning',
                productivity: input.productivity ?? 3,
                notes: input.notes,
                createdAt: nowISO(),
              },
            ],
            topics: input.topicId
              ? s.topics.map((t) => (t.id === input.topicId ? { ...t, actualMinutes: t.actualMinutes + input.minutes, lastStudiedAt: nowISO() } : t))
              : s.topics,
          }));
          const subject = get().subjects.find((x) => x.id === input.subjectId);
          log({ kind: 'session', label: `Studied ${subject?.name ?? 'a subject'}`, detail: `${input.minutes} minutes · ${input.type ?? 'learning'}`, minutes: input.minutes, subjectId: input.subjectId, topicId: input.topicId });
        },

        deleteSession: (id) => {
          pushHistory();
          set((s) => ({ sessions: s.sessions.filter((x) => x.id !== id) }));
        },

        addDsaSession: (input) => {
          const session: DSASession = {
            id: uid('dsess'),
            date: input.date ?? todayISO(),
            minutes: input.minutes,
            moduleId: input.moduleId,
            topicId: input.topicId,
            patternId: input.patternId,
            attempted: input.attempted ?? 0,
            solved: input.solved ?? 0,
            independentSolves: input.independentSolves ?? 0,
            revised: input.revised ?? 0,
            notes: input.notes,
            createdAt: nowISO(),
          };
          set((s) => ({ dsaSessions: [...s.dsaSessions, session] }));
          log({
            kind: 'session',
            label: `DSA session · ${input.minutes} minutes`,
            detail: `${session.attempted} attempted · ${session.solved} solved · ${session.revised} revised`,
            minutes: input.minutes,
          });
        },

        // ---------------- dsa ----------------
        addProblem: (input) => {
          const id = uid('prob');
          const problem: DSAProblem = {
            id,
            name: input.name,
            number: input.number,
            platform: input.platform ?? 'LeetCode',
            url: input.url,
            moduleId: input.moduleId,
            topicId: input.topicId,
            patternId: input.patternId,
            difficulty: input.difficulty ?? 'medium',
            attempted: input.attempted ?? false,
            solved: input.solved ?? false,
            understood: input.understood ?? false,
            independent: input.independent ?? false,
            mastered: input.mastered ?? false,
            needsRevision: input.needsRevision ?? false,
            hintUsed: input.hintUsed ?? false,
            editorialUsed: input.editorialUsed ?? false,
            solutionWatched: input.solutionWatched ?? false,
            dateAttempted: input.dateAttempted,
            dateSolved: input.dateSolved,
            timeTakenMinutes: input.timeTakenMinutes,
            attempts: input.attempts ?? 1,
            confidence: input.confidence ?? 1,
            revisionStage: 0,
            notes: input.notes,
            mistake: input.mistake,
            keyInsight: input.keyInsight,
            timeComplexity: input.timeComplexity,
            spaceComplexity: input.spaceComplexity,
            createdAt: nowISO(),
            updatedAt: nowISO(),
          };
          set((s) => ({ dsaProblems: [...s.dsaProblems, problem] }));
          return id;
        },

        updateProblem: (id, patch) => set((s) => ({ dsaProblems: patchList(s.dsaProblems, id, { ...patch, updatedAt: nowISO() }) })),

        deleteProblem: (id) => {
          pushHistory();
          set((s) => ({ dsaProblems: s.dsaProblems.filter((p) => p.id !== id), revisions: s.revisions.filter((r) => r.problemId !== id) }));
        },

        toggleProblemFlag: (id, key) => {
          const problem = get().dsaProblems.find((p) => p.id === id);
          if (!problem) return;
          const next = !problem[key];
          const today = todayISO();
          const patch: Partial<DSAProblem> = { [key]: next } as Partial<DSAProblem>;
          if (key === 'solved') {
            patch.dateSolved = next ? problem.dateSolved ?? today : undefined;
            patch.attempted = next ? true : problem.attempted;
            if (next) patch.nextRevisionAt = addDaysISO(today, REVISION_INTERVALS[0]);
          }
          if (key === 'attempted' && next && !problem.dateAttempted) patch.dateAttempted = today;
          if (key === 'independent' && next) {
            patch.solved = true;
            patch.attempted = true;
            patch.dateSolved = problem.dateSolved ?? today;
          }
          if (key === 'needsRevision') patch.nextRevisionAt = next ? today : undefined;
          if (key === 'mastered' && next) {
            patch.solved = true;
            patch.understood = true;
            patch.independent = true;
            patch.needsRevision = false;
            patch.nextRevisionAt = undefined;
          }
          set((s) => ({ dsaProblems: patchList(s.dsaProblems, id, { ...patch, updatedAt: nowISO() }) }));
          if (next && (key === 'solved' || key === 'mastered')) {
            log({ kind: 'problem', label: `${key === 'mastered' ? 'Mastered' : 'Solved'} ${problem.name}`, detail: problem.patternId ? `Pattern: ${get().dsaPatterns.find((p) => p.id === problem.patternId)?.name ?? ''}` : undefined, problemId: id });
          }
        },

        reviewProblem: (id, result) => {
          const today = todayISO();
          set((s) => ({
            dsaProblems: s.dsaProblems.map((p) => {
              if (p.id !== id) return p;
              if (result === 'failed') {
                const stage = Math.max(0, p.revisionStage - 1);
                return { ...p, revisionStage: stage, confidence: Math.max(1, p.confidence - 2), needsRevision: true, nextRevisionAt: addDaysISO(today, REVISION_INTERVALS[stage]), updatedAt: nowISO() };
              }
              if (result === 'major-help') {
                return { ...p, confidence: Math.max(1, p.confidence - 1), needsRevision: true, nextRevisionAt: addDaysISO(today, REVISION_INTERVALS[p.revisionStage]), updatedAt: nowISO() };
              }
              if (result === 'hint') {
                return { ...p, hintUsed: true, confidence: Math.max(1, p.confidence), needsRevision: true, nextRevisionAt: addDaysISO(today, REVISION_INTERVALS[Math.min(p.revisionStage, REVISION_INTERVALS.length - 1)]), updatedAt: nowISO() };
              }
              const stage = Math.min(REVISION_INTERVALS.length - 1, p.revisionStage + 1);
              const graduated = p.revisionStage >= REVISION_INTERVALS.length - 1;
              return {
                ...p,
                revisionStage: stage,
                confidence: Math.min(5, p.confidence + 1),
                independent: true,
                needsRevision: !graduated,
                nextRevisionAt: graduated ? undefined : addDaysISO(today, REVISION_INTERVALS[stage]),
                updatedAt: nowISO(),
              };
            }),
          }));
          const problem = get().dsaProblems.find((p) => p.id === id);
          log({ kind: 'revision', label: `Revised ${problem?.name ?? 'problem'}`, detail: result.replace('-', ' '), problemId: id });
        },

        addDsaPattern: ({ moduleName, topicName, patternName }) => {
          const s = get();
          const moduleId = uid('mod');
          const topicId = uid('dtop');
          const patternId = uid('pat');
          const module: DSAModuleLike = { id: moduleId, name: moduleName, order: s.dsaModules.length };
          const topic: DSATopic = { id: topicId, moduleId, name: topicName, order: 0, concepts: [] };
          const pattern: DSAPattern = { id: patternId, moduleId, topicId, name: patternName, order: 0 };
          set({ dsaModules: [...s.dsaModules, module], dsaTopics: [...s.dsaTopics, topic], dsaPatterns: [...s.dsaPatterns, pattern] });
        },

        addDsaModule: (name) => {
          const id = uid('mod');
          set((s) => ({ dsaModules: [...s.dsaModules, { id, name, order: s.dsaModules.length }] }));
          return id;
        },

        updateDsaModule: (id, patch) => set((s) => ({ dsaModules: patchList(s.dsaModules, id, patch) })),

        deleteDsaModule: (id) => {
          pushHistory();
          set((s) => ({
            dsaModules: s.dsaModules.filter((m) => m.id !== id),
            dsaTopics: s.dsaTopics.filter((t) => t.moduleId !== id),
            dsaPatterns: s.dsaPatterns.filter((p) => p.moduleId !== id),
            dsaProblems: s.dsaProblems.map((p) => (p.moduleId === id ? { ...p, moduleId: undefined, topicId: undefined, patternId: undefined } : p)),
          }));
        },

        addDsaTopic: (moduleId, name) => {
          const id = uid('dtop');
          set((s) => ({ dsaTopics: [...s.dsaTopics, { id, moduleId, name, order: s.dsaTopics.filter((t) => t.moduleId === moduleId).length, concepts: [] }] }));
          return id;
        },

        deleteDsaTopic: (id) => {
          pushHistory();
          set((s) => ({
            dsaTopics: s.dsaTopics.filter((t) => t.id !== id),
            dsaPatterns: s.dsaPatterns.filter((p) => p.topicId !== id),
            dsaProblems: s.dsaProblems.map((p) => (p.topicId === id ? { ...p, topicId: undefined, patternId: undefined } : p)),
          }));
        },

        createDsaPattern: ({ moduleId, topicId, name }) => {
          const id = uid('pat');
          set((s) => ({ dsaPatterns: [...s.dsaPatterns, { id, moduleId, topicId, name, order: s.dsaPatterns.filter((p) => p.topicId === topicId).length }] }));
          return id;
        },

        deleteDsaPattern: (id) => {
          pushHistory();
          set((s) => ({
            dsaPatterns: s.dsaPatterns.filter((p) => p.id !== id),
            dsaProblems: s.dsaProblems.map((p) => (p.patternId === id ? { ...p, patternId: undefined } : p)),
          }));
        },

        /**
         * Import rows from JSON/CSV. Missing modules/topics/patterns are created
         * on demand; existing problems are never overwritten unless the caller
         * chooses otherwise. Returns a summary for the UI.
         */
        importDsaRows: (rows, opts) => {
          const skipExisting = opts?.skipExisting ?? true;
          const result: DsaImportResult = { problems: 0, modules: 0, topics: 0, patterns: 0, skipped: 0, errors: [] };
          if (!rows.length) return result;
          pushHistory();
          const s = get();
          const modules = [...s.dsaModules];
          const topics = [...s.dsaTopics];
          const patterns = [...s.dsaPatterns];
          const problems = [...s.dsaProblems];
          const moduleByName = new Map(modules.map((m) => [m.name.toLowerCase(), m]));
          const topicByKey = new Map(topics.map((t) => [`${t.moduleId}::${t.name.toLowerCase()}`, t]));
          const patternByKey = new Map(patterns.map((p) => [`${p.topicId}::${p.name.toLowerCase()}`, p]));
          const problemKeys = new Set(problems.map((p) => `${p.name.toLowerCase()}::${p.platform.toLowerCase()}`));
          const today = todayISO();

          for (const row of rows) {
            const moduleName = row.module?.trim() || 'Imported';
            let module = moduleByName.get(moduleName.toLowerCase());
            if (!module) {
              module = { id: uid('mod'), name: moduleName, order: modules.length };
              modules.push(module);
              moduleByName.set(moduleName.toLowerCase(), module);
              result.modules += 1;
            }
            const topicName = row.topic?.trim() || 'General';
            const topicKey = `${module.id}::${topicName.toLowerCase()}`;
            let topic = topicByKey.get(topicKey);
            if (!topic) {
              topic = { id: uid('dtop'), moduleId: module.id, name: topicName, order: topics.filter((t) => t.moduleId === module!.id).length, concepts: [] };
              topics.push(topic);
              topicByKey.set(topicKey, topic);
              result.topics += 1;
            }
            let patternId: ID | undefined;
            if (row.pattern?.trim()) {
              const patternKey = `${topic.id}::${row.pattern.trim().toLowerCase()}`;
              let pattern = patternByKey.get(patternKey);
              if (!pattern) {
                pattern = { id: uid('pat'), moduleId: module.id, topicId: topic.id, name: row.pattern.trim(), order: patterns.filter((p) => p.topicId === topic!.id).length };
                patterns.push(pattern);
                patternByKey.set(patternKey, pattern);
                result.patterns += 1;
              }
              patternId = pattern.id;
            }
            const platform = row.platform?.trim() || 'LeetCode';
            const dupKey = `${row.name.toLowerCase()}::${platform.toLowerCase()}`;
            if (problemKeys.has(dupKey) && skipExisting) {
              result.skipped += 1;
              continue;
            }
            const solved = row.solved ?? false;
            const independent = row.independent ?? false;
            const problem: DSAProblem = {
              id: uid('prob'),
              name: row.name.trim(),
              number: row.number,
              platform,
              url: row.url,
              moduleId: module.id,
              topicId: topic.id,
              patternId,
              difficulty: row.difficulty ?? 'medium',
              attempted: solved,
              solved,
              understood: solved && (row.confidence ?? 1) >= 3,
              independent,
              mastered: row.mastered ?? (solved && independent && (row.confidence ?? 1) >= 5),
              needsRevision: row.needsRevision ?? false,
              hintUsed: false,
              editorialUsed: false,
              solutionWatched: false,
              dateSolved: solved ? today : undefined,
              dateAttempted: solved ? today : undefined,
              attempts: 1,
              confidence: row.confidence ?? 1,
              revisionStage: 0,
              nextRevisionAt: row.needsRevision ? today : undefined,
              notes: row.notes,
              createdAt: nowISO(),
              updatedAt: nowISO(),
            };
            problems.push(problem);
            problemKeys.add(dupKey);
            result.problems += 1;
          }

          set({ dsaModules: modules, dsaTopics: topics, dsaPatterns: patterns, dsaProblems: problems });
          if (result.problems) log({ kind: 'problem', label: `Imported ${result.problems} DSA problem(s)`, detail: result.skipped ? `${result.skipped} already existed` : undefined });
          return result;
        },

        // ---------------- revisions ----------------
        addRevisionItem: (input) =>
          set((s) => ({
            revisions: [
              ...s.revisions,
              {
                id: uid('rev'),
                kind: input.kind ?? 'topic',
                refId: input.refId,
                label: input.label,
                subjectId: input.subjectId,
                topicId: input.topicId,
                problemId: input.problemId,
                lastReviewed: input.lastReviewed ?? todayISO(),
                dueDate: input.dueDate,
                intervalDays: input.intervalDays ?? 1,
                stage: input.stage ?? 0,
                confidence: input.confidence ?? 3,
                done: false,
                createdAt: nowISO(),
              },
            ],
          })),

        updateRevisionItem: (id, patch) => set((s) => ({ revisions: patchList(s.revisions, id, patch) })),

        deleteRevisionItem: (id) => {
          pushHistory();
          set((s) => ({ revisions: s.revisions.filter((r) => r.id !== id) }));
        },

        reviewRevision: (id, result) => {
          const today = todayISO();
          const item = get().revisions.find((r) => r.id === id);
          set((s) => ({
            revisions: s.revisions.map((r) => {
              if (r.id !== id) return r;
              if (result === 'failed') {
                const stage = Math.max(0, r.stage - 1);
                return { ...r, stage, confidence: Math.max(1, r.confidence - 2), lastReviewed: today, dueDate: addDaysISO(today, REVISION_INTERVALS[stage]) };
              }
              if (result === 'major-help') {
                return { ...r, confidence: Math.max(1, r.confidence - 1), lastReviewed: today, dueDate: addDaysISO(today, REVISION_INTERVALS[r.stage]) };
              }
              if (result === 'hint') {
                return { ...r, confidence: Math.max(1, r.confidence), lastReviewed: today, dueDate: addDaysISO(today, REVISION_INTERVALS[Math.min(r.stage, REVISION_INTERVALS.length - 1)]) };
              }
              const stage = Math.min(REVISION_INTERVALS.length - 1, r.stage + 1);
              const graduated = r.stage >= REVISION_INTERVALS.length - 1;
              return { ...r, stage, confidence: Math.min(5, r.confidence + 1), lastReviewed: today, done: graduated, dueDate: addDaysISO(today, REVISION_INTERVALS[stage]) };
            }),
          }));
          log({ kind: 'revision', label: `Revised ${item?.label ?? 'item'}`, detail: result.replace('-', ' ') });
        },

        // ---------------- notes ----------------
        addNote: (input) => {
          const id = uid('note');
          set((s) => ({
            notes: [...s.notes, { id, title: input.title, subjectId: input.subjectId, topicId: input.topicId, content: input.content ?? '', tags: input.tags ?? [], createdAt: nowISO(), updatedAt: nowISO() }],
          }));
          log({ kind: 'note', label: `Saved note “${input.title}”` });
          return id;
        },
        updateNote: (id, patch) => set((s) => ({ notes: patchList(s.notes, id, { ...patch, updatedAt: nowISO() }) })),
        deleteNote: (id) => {
          pushHistory();
          set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }));
        },

        // ---------------- projects ----------------
        addProject: (input) => {
          const id = uid('prj');
          set((s) => ({
            projects: [
              ...s.projects,
              {
                id,
                name: input.name,
                description: input.description ?? '',
                githubUrl: input.githubUrl,
                liveUrl: input.liveUrl,
                technologies: input.technologies ?? [],
                status: input.status ?? 'idea',
                archived: false,
                startDate: input.startDate ?? todayISO(),
                endDate: input.endDate,
                features: input.features ?? [],
                architecture: input.architecture,
                database: input.database,
                apis: input.apis,
                authentication: input.authentication,
                security: input.security,
                testing: input.testing,
                deployment: input.deployment,
                challenges: input.challenges,
                tradeoffs: input.tradeoffs,
                futureImprovements: input.futureImprovements,
                checklist: input.checklist ?? {},
                color: input.color ?? '#6f8a76',
                createdAt: nowISO(),
                updatedAt: nowISO(),
              },
            ],
          }));
          return id;
        },
        updateProject: (id, patch) => set((s) => ({ projects: patchList(s.projects, id, { ...patch, updatedAt: nowISO() }) })),
        deleteProject: (id) => {
          pushHistory();
          set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
        },
        toggleProjectChecklist: (id, key) => {
          const project = get().projects.find((p) => p.id === id);
          set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, checklist: { ...p.checklist, [key]: !p.checklist[key] }, updatedAt: nowISO() } : p)) }));
          if (project && !project.checklist[key]) log({ kind: 'project', label: `${project.name}: ${key}`, detail: 'Interview readiness checked', projectId: id });
        },

        // ---------------- interviews ----------------
        addQuestion: (input) => {
          const id = uid('iq');
          set((s) => ({
            interviewQuestions: [
              ...s.interviewQuestions,
              {
                id,
                question: input.question,
                category: input.category ?? 'Core CS',
                subjectId: input.subjectId,
                topicId: input.topicId,
                source: input.source,
                difficulty: input.difficulty ?? 'medium',
                answer: input.answer,
                confidence: input.confidence ?? 1,
                lastPracticed: input.lastPracticed,
                nextReview: input.nextReview,
                asked: input.asked ?? false,
                frequentlyAsked: input.frequentlyAsked ?? false,
                needsRevision: input.needsRevision ?? false,
                createdAt: nowISO(),
                updatedAt: nowISO(),
              },
            ],
          }));
          return id;
        },
        updateQuestion: (id, patch) => set((s) => ({ interviewQuestions: patchList(s.interviewQuestions, id, { ...patch, updatedAt: nowISO() }) })),
        deleteQuestion: (id) => {
          pushHistory();
          set((s) => ({ interviewQuestions: s.interviewQuestions.filter((q) => q.id !== id) }));
        },
        addMock: (input) => {
          set((s) => ({
            mocks: [
              ...s.mocks,
              {
                id: uid('mock'),
                date: input.date,
                type: input.type ?? 'dsa',
                company: input.company,
                interviewer: input.interviewer,
                durationMinutes: input.durationMinutes ?? 60,
                score: input.score ?? 0,
                topicsTested: input.topicsTested ?? [],
                questions: input.questions ?? [],
                strengths: input.strengths,
                weaknesses: input.weaknesses,
                feedback: input.feedback,
                followUp: input.followUp,
                createdAt: nowISO(),
              },
            ],
          }));
          log({ kind: 'session', label: `Logged a ${input.type ?? 'dsa'} mock interview`, detail: `Score ${input.score ?? 0}%` });
        },
        deleteMock: (id) => {
          pushHistory();
          set((s) => ({ mocks: s.mocks.filter((m) => m.id !== id) }));
        },
        addStory: (input) => {
          const id = uid('story');
          set((s) => ({
            stories: [
              ...s.stories,
              {
                id,
                title: input.title,
                skill: input.skill ?? 'General',
                situation: input.situation ?? '',
                task: input.task ?? '',
                action: input.action ?? '',
                result: input.result ?? '',
                usedFor: input.usedFor,
                confidence: input.confidence ?? 1,
                practicedCount: 0,
                createdAt: nowISO(),
                updatedAt: nowISO(),
              },
            ],
          }));
          return id;
        },
        updateStory: (id, patch) => set((s) => ({ stories: patchList(s.stories, id, { ...patch, updatedAt: nowISO() }) })),
        deleteStory: (id) => {
          pushHistory();
          set((s) => ({ stories: s.stories.filter((x) => x.id !== id) }));
        },

        // ---------------- applications & companies ----------------
        addApplication: (input) => {
          set((s) => ({
            applications: [
              ...s.applications,
              {
                id: uid('app'),
                company: input.company,
                role: input.role,
                type: input.type ?? 'Internship',
                applicationDate: input.applicationDate,
                deadline: input.deadline,
                status: input.status ?? 'interested',
                oaDate: input.oaDate,
                interviewDate: input.interviewDate,
                resumeVersion: input.resumeVersion,
                referral: input.referral ?? false,
                archived: false,
                notes: input.notes,
                createdAt: nowISO(),
                updatedAt: nowISO(),
              },
            ],
          }));
        },
        updateApplication: (id, patch) => set((s) => ({ applications: patchList(s.applications, id, { ...patch, updatedAt: nowISO() }) })),
        deleteApplication: (id) => {
          pushHistory();
          set((s) => ({ applications: s.applications.filter((a) => a.id !== id) }));
        },
        setApplicationStatus: (id, status) => {
          const app = get().applications.find((a) => a.id === id);
          set((s) => ({ applications: patchList(s.applications, id, { status, updatedAt: nowISO() }) }));
          if (app) log({ kind: 'application', label: `${app.company} → ${status.replace('-', ' ')}`, detail: app.role });
        },
        addCompany: (input) => {
          const id = uid('cmp');
          set((s) => ({ companies: [...s.companies, { id, name: input.name, checklist: input.checklist ?? [], notes: input.notes, createdAt: nowISO() }] }));
          return id;
        },
        updateCompany: (id, patch) => set((s) => ({ companies: patchList(s.companies, id, patch) })),
        deleteCompany: (id) => {
          pushHistory();
          set((s) => ({ companies: s.companies.filter((c) => c.id !== id) }));
        },
        toggleCompanyChecklist: (id, itemId) =>
          set((s) => ({
            companies: s.companies.map((c) => (c.id === id ? { ...c, checklist: c.checklist.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)) } : c)),
          })),

        // ---------------- goals ----------------
        addGoal: (input) =>
          set((s) => ({
            goals: [
              ...s.goals,
              {
                id: uid('goal'),
                title: input.title,
                metric: input.metric ?? 'manual',
                refId: input.refId,
                target: input.target ?? 100,
                manualCurrent: input.manualCurrent ?? 0,
                unit: input.unit ?? '',
                deadline: input.deadline,
                priority: input.priority ?? 'medium',
                createdAt: nowISO(),
              },
            ],
          })),
        updateGoal: (id, patch) => set((s) => ({ goals: patchList(s.goals, id, patch) })),
        deleteGoal: (id) => {
          pushHistory();
          set((s) => ({ goals: s.goals.filter((g) => g.id !== id) }));
        },

        // ---------------- roadmap ----------------
        toggleRoadmapTask: (weekId, taskId) =>
          set((s) => ({
            roadmap: s.roadmap.map((w) =>
              w.id === weekId ? { ...w, tasks: w.tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done, doneAt: !t.done ? nowISO() : undefined } : t)) } : w,
            ),
          })),
        addRoadmapTask: (weekId, task) =>
          set((s) => ({ roadmap: s.roadmap.map((w) => (w.id === weekId ? { ...w, tasks: [...w.tasks, { ...task, id: uid('rtask'), done: false }] } : w)) })),
        updateRoadmapWeek: (weekId, patch) => set((s) => ({ roadmap: s.roadmap.map((w) => (w.id === weekId ? { ...w, ...patch } : w)) })),

        // ---------------- journal & reviews ----------------
        addJournal: (input) =>
          set((s) => ({
            journal: [
              ...s.journal,
              {
                id: uid('jrn'),
                problem: input.problem,
                problemId: input.problemId,
                mistakeType: input.mistakeType ?? 'logic',
                whyStuck: input.whyStuck,
                correctIdea: input.correctIdea,
                remember: input.remember,
                date: input.date ?? todayISO(),
                revisitDate: input.revisitDate,
                createdAt: nowISO(),
              },
            ],
          })),
        updateJournal: (id, patch) => set((s) => ({ journal: patchList(s.journal, id, patch) })),
        deleteJournal: (id) => {
          pushHistory();
          set((s) => ({ journal: s.journal.filter((j) => j.id !== id) }));
        },

        saveReview: (input) =>
          set((s) => {
            const existing = s.reviews.find((r) => r.weekStart === input.weekStart);
            if (existing) return { reviews: s.reviews.map((r) => (r.weekStart === input.weekStart ? { ...r, ...input } : r)) };
            return {
              reviews: [
                ...s.reviews,
                {
                  id: uid('rev'),
                  weekStart: input.weekStart,
                  weekEnd: input.weekEnd,
                  accomplished: input.accomplished,
                  struggled: input.struggled,
                  improve: input.improve,
                  stopWasting: input.stopWasting,
                  createdAt: nowISO(),
                },
              ],
            };
          }),
      };
    },
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => cloudStorage),
      version: DATA_VERSION,
      partialize: (state) => pickData(state),
      migrate: (persisted, version) => {
        try {
          if (version < DATA_VERSION && persisted && typeof persisted === 'object') {
            // keep a copy of the previous shape before touching anything
            try {
              localStorage.setItem(BACKUP_KEY, JSON.stringify(persisted));
            } catch {
              /* storage full or unavailable — migration still proceeds */
            }
            return migrateV1toV2(persisted as Record<string, unknown>);
          }
        } catch {
          /* fall through to a fresh state if migration fails */
        }
        return persisted as AppData;
      },
      merge: (persisted, current) => {
        if (!persisted || typeof persisted !== 'object') return current;
        return { ...current, ...(persisted as Partial<AppData>) };
      },
      onRehydrateStorage: () => (state) => {
        if (state) state._history = [];
      },
    },
  ),
);

// Small local alias so addDsaPattern stays readable without importing the type name twice.
type DSAModuleLike = AppData['dsaModules'][number];
export type { Difficulty, TopicStatus };
