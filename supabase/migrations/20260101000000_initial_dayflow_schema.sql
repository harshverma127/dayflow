-- ===========================================================================
-- Dayflow — initial schema
-- ---------------------------------------------------------------------------
-- Derived directly from the TypeScript domain model in `src/types.ts`
-- (`AppData` v2). Every collection in `AppData` maps to exactly one table
-- here, plus separate child tables where the model nests data
-- (topic -> subtopic -> checklist item, project checklist, company checklist,
-- roadmap week -> roadmap task).
--
-- Design decisions
--   * `uuid` primary keys, generated client-side (see src/lib/utils.ts `uid`).
--   * `user_id uuid not null references auth.users(id) on delete cascade` on
--     every user-owned row. Nothing in `public` is world-readable.
--   * Row Level Security on every table, with a SEPARATE policy per operation
--     (select / insert / update / delete), each comparing `auth.uid()` to
--     `user_id`. This is the pattern Supabase currently recommends.
--   * Child-record safety: owning `user_id` on a child is NOT enough, because a
--     client could point it at another user's parent. Every table that has a
--     parent FK therefore also gets a `SECURITY DEFINER` ownership helper, and
--     the INSERT policy checks it with `WITH CHECK`. See "OWNERSHIP HELPERS".
--   * No enums: text + CHECK keeps the migration re-runnable and keeps the
--     TypeScript union types in src/types.ts as the single source of truth.
--
-- This migration is additive only. It creates tables that do not exist; it
-- never drops a database, schema or table. Running it on a fresh Supabase
-- project is the intended path.
-- ===========================================================================

-- ===========================================================================
-- 2. SETTINGS
-- One row per user. user_id is the primary key, which is also the unique
-- constraint required by the spec.
-- ===========================================================================

create table if not exists public.settings (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null unique references auth.users (id) on delete cascade,
  name                 text not null default '',
  target_role          text not null default '',
  graduation_year      integer not null default 2026,
  preferred_language   text not null default '',
  prep_type            text not null default 'both' check (prep_type in ('internship', 'placement', 'both')),
  roadmap_start_date   date,
  roadmap_weeks        integer not null default 8 check (roadmap_weeks > 0),
  daily_target_hours   numeric(5, 2) not null default 6,
  theme                text not null default 'system' check (theme in ('light', 'dark', 'system')),
  notifications        jsonb not null default '{"revision":true,"dailyGoals":true,"missedTasks":true,"deadlines":true}'::jsonb,
  weights              jsonb not null default '{"dsa":30,"coreCs":25,"development":20,"design":10,"interview":10,"projects":5}'::jsonb,
  historical_solved    integer not null default 0 check (historical_solved >= 0),
  pomodoro             jsonb not null default '{"focus":25,"break":5}'::jsonb,
  sidebar_collapsed    boolean not null default false,
  last_backup_at       timestamptz,
  dsa_source           jsonb not null default '{"name":"","url":"","importedProblems":0}'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ===========================================================================
-- 3. LEARNING HIERARCHY: subjects -> topics -> subtopics -> checklist_items
-- ===========================================================================

create table if not exists public.subjects (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  name               text not null,
  description        text,
  category           text not null default 'core-cs'
                        check (category in ('dsa','core-cs','development','interview','college','other')),
  color              text not null default '#b07a4a',
  priority           text not null default 'medium' check (priority in ('critical','high','medium','low')),
  difficulty         text not null default 'medium' check (difficulty in ('easy','medium','hard')),
  target_date        date,
  weekly_target_hours numeric(6, 2),
  archived           boolean not null default false,
  archived_at        timestamptz,
  "order"            integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.topics (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  subject_id         uuid not null references public.subjects (id) on delete cascade,
  parent_id          uuid references public.topics (id) on delete cascade,
  kind               text not null default 'topic' check (kind in ('unit','topic')),
  name               text not null,
  description        text,
  "order"            integer not null default 0,
  priority           text not null default 'medium' check (priority in ('critical','high','medium','low')),
  confidence         integer not null default 0 check (confidence between 0 and 5),
  learned            boolean not null default false,
  practiced          boolean not null default false,
  can_explain        boolean not null default false,
  applied            boolean not null default false,
  estimated_minutes  integer not null default 0,
  actual_minutes     integer not null default 0,
  target_date        date,
  resources          jsonb not null default '[]'::jsonb,
  last_studied_at    timestamptz,
  revision_enabled   boolean not null default true,
  next_revision_at   date,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.subtopics (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  topic_id    uuid not null references public.topics (id) on delete cascade,
  name        text not null,
  done        boolean not null default false,
  confidence  integer not null default 0 check (confidence between 0 and 5),
  notes       text,
  "order"     integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.checklist_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  subtopic_id uuid not null references public.subtopics (id) on delete cascade,
  name        text not null,
  done        boolean not null default false,
  done_at     timestamptz,
  confidence  integer check (confidence between 0 and 5),
  notes       text,
  "order"     integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ===========================================================================
-- 4. PLANNER AND STUDY SESSIONS
--     `revisions` is created at the end of section 5, immediately after
--     `dsa_problems`, because it carries a foreign key to that table and
--     Postgres resolves `references` eagerly at creation time.
-- ===========================================================================

create table if not exists public.tasks (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  title             text not null,
  date              date not null default current_date,
  tier              text not null default 'normal' check (tier in ('high','normal','optional')),
  subject_id        uuid references public.subjects (id) on delete set null,
  topic_id          uuid references public.topics (id) on delete set null,
  subtopic_id       uuid references public.subtopics (id) on delete set null,
  estimated_minutes integer not null default 30,
  priority          text not null default 'medium' check (priority in ('critical','high','medium','low')),
  done              boolean not null default false,
  done_at           timestamptz,
  "auto"            boolean not null default false,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  date         date not null default current_date,
  subject_id   uuid references public.subjects (id) on delete set null,
  topic_id     uuid references public.topics (id) on delete set null,
  subtopic_id  uuid references public.subtopics (id) on delete set null,
  minutes      integer not null default 0 check (minutes >= 0),
  type         text not null default 'learning'
                 check (type in ('learning','practice','revision','problem-solving','project','interview')),
  productivity integer not null default 3 check (productivity between 1 and 5),
  notes        text,
  created_at   timestamptz not null default now()
);

-- (see note at the top of this section for `revisions`)

-- ===========================================================================
-- 5. DSA LAB: module -> topic -> pattern -> problem, plus practice sessions
-- ===========================================================================

create table if not exists public.dsa_modules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  "order"     integer not null default 0,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.dsa_topics (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  module_id   uuid not null references public.dsa_modules (id) on delete cascade,
  name        text not null,
  "order"     integer not null default 0,
  concepts    jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.dsa_patterns (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  module_id   uuid not null references public.dsa_modules (id) on delete cascade,
  topic_id    uuid not null references public.dsa_topics (id) on delete cascade,
  name        text not null,
  "order"     integer not null default 0,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.dsa_problems (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  name                text not null,
  number              text,
  platform            text not null default '',
  url                 text,
  module_id           uuid references public.dsa_modules (id) on delete set null,
  topic_id            uuid references public.dsa_topics (id) on delete set null,
  pattern_id          uuid references public.dsa_patterns (id) on delete set null,
  difficulty          text not null default 'medium' check (difficulty in ('easy','medium','hard')),
  attempted           boolean not null default false,
  solved              boolean not null default false,
  understood          boolean not null default false,
  independent         boolean not null default false,
  mastered            boolean not null default false,
  needs_revision      boolean not null default false,
  hint_used           boolean not null default false,
  editorial_used      boolean not null default false,
  solution_watched    boolean not null default false,
  date_attempted      date,
  date_solved         date,
  time_taken_minutes  integer,
  attempts            integer not null default 0 check (attempts >= 0),
  confidence          integer not null default 0 check (confidence between 0 and 5),
  revision_stage      integer not null default 0,
  next_revision_at    date,
  notes               text,
  mistake             text,
  key_insight         text,
  time_complexity     text,
  space_complexity    text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- A DSA practice session IS the attempt history in the current model: it
-- records how many problems were attempted / solved / independently solved in
-- one sitting. There is no separate `dsa_attempts` collection in `AppData`,
-- so no such table is created.
create table if not exists public.dsa_sessions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  date                date not null default current_date,
  minutes             integer not null default 0 check (minutes >= 0),
  module_id           uuid references public.dsa_modules (id) on delete set null,
  topic_id            uuid references public.dsa_topics (id) on delete set null,
  pattern_id          uuid references public.dsa_patterns (id) on delete set null,
  attempted           integer not null default 0,
  solved              integer not null default 0,
  independent_solves  integer not null default 0,
  revised             integer not null default 0,
  notes               text,
  created_at          timestamptz not null default now()
);

-- `revisions` references both `topics` and `dsa_problems`, so it is defined
-- here once both parents exist.
create table if not exists public.revisions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  kind          text not null check (kind in ('topic','problem','question')),
  ref_id        uuid,
  label         text not null,
  subject_id    uuid references public.subjects (id) on delete set null,
  topic_id      uuid references public.topics (id) on delete cascade,
  problem_id    uuid references public.dsa_problems (id) on delete cascade,
  last_reviewed date,
  due_date      date not null default current_date,
  interval_days integer not null default 1,
  stage         integer not null default 0,
  confidence    integer not null default 3 check (confidence between 0 and 5),
  done          boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ===========================================================================
-- 6. KNOWLEDGE ARTEFACTS
-- ===========================================================================

create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null,
  subject_id  uuid references public.subjects (id) on delete set null,
  topic_id    uuid references public.topics (id) on delete set null,
  content     text not null default '',
  tags        jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.journal_entries (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  problem        text not null,
  problem_id     uuid references public.dsa_problems (id) on delete set null,
  mistake_type   text not null default 'logic'
                   check (mistake_type in (
                     'pattern-not-recognized','wrong-data-structure','logic','edge-case',
                     'complexity','implementation','syntax','misread','premature-optimization')),
  why_stuck      text,
  correct_idea   text,
  remember       text,
  date           date not null default current_date,
  revisit_date   date,
  created_at     timestamptz not null default now()
);

create table if not exists public.weekly_reviews (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  week_start    date not null,
  week_end      date not null,
  accomplished  text,
  struggled     text,
  improve       text,
  stop_wasting  text,
  created_at    timestamptz not null default now(),
  unique (user_id, week_start)
);

-- ===========================================================================
-- 7. PORTFOLIO
-- `Project.checklist` is a `Record<string, boolean>` in the model, so each key
-- becomes a row here rather than being duplicated as a jsonb blob.
-- ===========================================================================

create table if not exists public.projects (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,
  name                  text not null,
  description           text not null default '',
  github_url            text,
  live_url              text,
  technologies          jsonb not null default '[]'::jsonb,
  status                text not null default 'idea'
                          check (status in ('idea','planning','building','completed','interview-ready')),
  archived              boolean not null default false,
  start_date            date,
  end_date              date,
  features              jsonb not null default '[]'::jsonb,
  architecture          text,
  database              text,
  apis                  text,
  authentication        text,
  security              text,
  testing               text,
  deployment            text,
  challenges            text,
  tradeoffs             text,
  future_improvements   text,
  color                 text not null default '#b07a4a',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table if not exists public.project_checklist_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  project_id  uuid not null references public.projects (id) on delete cascade,
  key         text not null,
  done        boolean not null default false,
  "order"     integer not null default 0,
  unique (project_id, key)
);

-- ===========================================================================
-- 8. INTERVIEWS
-- ===========================================================================

create table if not exists public.interview_questions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  question          text not null,
  category          text not null default '',
  subject_id        uuid references public.subjects (id) on delete set null,
  topic_id          uuid references public.topics (id) on delete set null,
  source            text,
  difficulty        text not null default 'medium' check (difficulty in ('easy','medium','hard')),
  answer            text,
  confidence        integer not null default 0 check (confidence between 0 and 5),
  last_practiced    date,
  next_review       date,
  asked             boolean not null default false,
  frequently_asked   boolean not null default false,
  needs_revision    boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.behavioral_stories (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  title           text not null,
  skill           text not null default '',
  situation       text not null default '',
  task            text not null default '',
  action          text not null default '',
  result          text not null default '',
  used_for        text,
  confidence      integer not null default 0 check (confidence between 0 and 5),
  practiced_count integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.mock_interviews (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  date               date not null default current_date,
  type               text not null default 'full-mock'
                       check (type in ('dsa','technical','core-cs','project','lld','hld','behavioral','full-mock')),
  company            text,
  interviewer        text,
  duration_minutes   integer not null default 0,
  score              integer not null default 0 check (score between 0 and 100),
  topics_tested      jsonb not null default '[]'::jsonb,
  questions          jsonb not null default '[]'::jsonb,
  strengths          text,
  weaknesses         text,
  feedback           text,
  follow_up          text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ===========================================================================
-- 9. APPLICATIONS
-- ===========================================================================

create table if not exists public.applications (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  company           text not null,
  role              text not null default '',
  type              text not null default '',
  application_date  date,
  deadline          date,
  status            text not null default 'interested'
                      check (status in ('interested','preparing','applied','oa','oa-cleared',
                                        'interview','final-round','offer','rejected','withdrawn')),
  oa_date           date,
  interview_date    date,
  resume_version    text,
  referral          boolean not null default false,
  archived          boolean not null default false,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.companies (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.company_checklist_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  company_id  uuid not null references public.companies (id) on delete cascade,
  label       text not null,
  done        boolean not null default false,
  "order"     integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ===========================================================================
-- 10. GOALS, ROADMAP, ACTIVITY
-- ===========================================================================
-- `Goal.refId` is polymorphic (subject id for subject-progress goals, and a
-- free reference for other metrics), so it is intentionally a plain uuid with
-- no foreign key. Documented rather than modelled incorrectly.
-- ===========================================================================

create table if not exists public.goals (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  title           text not null,
  metric          text not null default 'manual'
                    check (metric in ('dsa-solved','dsa-independent','dsa-mastered','subject-progress',
                                      'projects-ready','mocks','applications','manual')),
  ref_id          uuid,
  target          numeric(12, 2) not null default 0,
  manual_current  numeric(12, 2) not null default 0,
  unit            text not null default '',
  deadline        date,
  priority        text not null default 'medium' check (priority in ('critical','high','medium','low')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.roadmap_weeks (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  week_number    integer not null default 1,
  title          text not null default '',
  focus          text not null default '',
  start_date     date not null default current_date,
  end_date       date not null default current_date,
  expected_hours numeric(6, 2) not null default 0,
  subject_ids    jsonb not null default '[]'::jsonb,
  subject_names  jsonb not null default '[]'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.roadmap_tasks (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  week_id           uuid not null references public.roadmap_weeks (id) on delete cascade,
  title             text not null,
  type              text not null default 'dsa'
                      check (type in ('dsa','core-cs','development','design','project','revision','interview')),
  subject_id        uuid references public.subjects (id) on delete set null,
  topic_id          uuid references public.topics (id) on delete set null,
  estimated_minutes integer not null default 30,
  priority          text not null default 'medium' check (priority in ('critical','high','medium','low')),
  done              boolean not null default false,
  done_at           timestamptz,
  "order"           integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.activities (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('topic','subtopic','checklist','problem','revision',
                                             'session','task','project','application','story','note')),
  label       text not null,
  detail      text,
  at          timestamptz not null default now(),
  minutes     integer,
  subject_id  uuid references public.subjects (id) on delete cascade,
  topic_id    uuid references public.topics (id) on delete cascade,
  problem_id  uuid references public.dsa_problems (id) on delete cascade,
  project_id  uuid references public.projects (id) on delete cascade
);

-- ===========================================================================
-- 11. INDEXES
--     * user_id on every table: it is the RLS policy filter column, so without
--       it every policy evaluation is a sequential scan.
--     * parent foreign keys, so cascades and relationship joins stay indexed.
--     * the date columns the dashboards actually filter and sort on.
-- Deliberately not over-indexed: low-cardinality booleans are left alone.
-- ===========================================================================

create index if not exists idx_settings_user                     on public.settings (user_id);

create index if not exists idx_subjects_user                    on public.subjects (user_id);
create index if not exists idx_subjects_user_archived           on public.subjects (user_id, archived);

create index if not exists idx_topics_user                      on public.topics (user_id);
create index if not exists idx_topics_subject                   on public.topics (subject_id);
create index if not exists idx_topics_parent                    on public.topics (parent_id);
create index if not exists idx_topics_user_revision             on public.topics (user_id, next_revision_at);

create index if not exists idx_subtopics_user                   on public.subtopics (user_id);
create index if not exists idx_subtopics_topic                  on public.subtopics (topic_id);

create index if not exists idx_checklist_items_user             on public.checklist_items (user_id);
create index if not exists idx_checklist_items_subtopic         on public.checklist_items (subtopic_id);

create index if not exists idx_tasks_user                       on public.tasks (user_id);
create index if not exists idx_tasks_user_date                  on public.tasks (user_id, date);
create index if not exists idx_tasks_subject                    on public.tasks (subject_id);
create index if not exists idx_tasks_topic                      on public.tasks (topic_id);

create index if not exists idx_sessions_user                    on public.sessions (user_id);
create index if not exists idx_sessions_user_date               on public.sessions (user_id, date);
create index if not exists idx_sessions_subject                 on public.sessions (subject_id);

create index if not exists idx_revisions_user                   on public.revisions (user_id);
create index if not exists idx_revisions_user_due               on public.revisions (user_id, due_date);
create index if not exists idx_revisions_topic                  on public.revisions (topic_id);
create index if not exists idx_revisions_problem                on public.revisions (problem_id);

create index if not exists idx_dsa_modules_user                on public.dsa_modules (user_id);

create index if not exists idx_dsa_topics_user                  on public.dsa_topics (user_id);
create index if not exists idx_dsa_topics_module                on public.dsa_topics (module_id);

create index if not exists idx_dsa_patterns_user                on public.dsa_patterns (user_id);
create index if not exists idx_dsa_patterns_module              on public.dsa_patterns (module_id);
create index if not exists idx_dsa_patterns_topic               on public.dsa_patterns (topic_id);

create index if not exists idx_dsa_problems_user                on public.dsa_problems (user_id);
create index if not exists idx_dsa_problems_module              on public.dsa_problems (module_id);
create index if not exists idx_dsa_problems_topic               on public.dsa_problems (topic_id);
create index if not exists idx_dsa_problems_pattern             on public.dsa_problems (pattern_id);
create index if not exists idx_dsa_problems_revision             on public.dsa_problems (user_id, next_revision_at);
create index if not exists idx_dsa_problems_solved               on public.dsa_problems (user_id, solved, mastered);

create index if not exists idx_dsa_sessions_user                on public.dsa_sessions (user_id);
create index if not exists idx_dsa_sessions_user_date           on public.dsa_sessions (user_id, date);

create index if not exists idx_notes_user                       on public.notes (user_id);
create index if not exists idx_notes_subject                    on public.notes (subject_id);
create index if not exists idx_notes_topic                      on public.notes (topic_id);

create index if not exists idx_journal_entries_user             on public.journal_entries (user_id);
create index if not exists idx_journal_entries_date             on public.journal_entries (user_id, date);

create index if not exists idx_weekly_reviews_user              on public.weekly_reviews (user_id);
create index if not exists idx_weekly_reviews_user_start        on public.weekly_reviews (user_id, week_start);

create index if not exists idx_projects_user                    on public.projects (user_id);
create index if not exists idx_projects_user_status             on public.projects (user_id, archived, status);

create index if not exists idx_project_checklist_items_user     on public.project_checklist_items (user_id);
create index if not exists idx_project_checklist_items_project  on public.project_checklist_items (project_id);

create index if not exists idx_interview_questions_user         on public.interview_questions (user_id);
create index if not exists idx_interview_questions_subject      on public.interview_questions (subject_id);
create index if not exists idx_interview_questions_topic        on public.interview_questions (topic_id);

create index if not exists idx_behavioral_stories_user          on public.behavioral_stories (user_id);

create index if not exists idx_mock_interviews_user             on public.mock_interviews (user_id);
create index if not exists idx_mock_interviews_user_date        on public.mock_interviews (user_id, date);

create index if not exists idx_applications_user                on public.applications (user_id);
create index if not exists idx_applications_user_deadline       on public.applications (user_id, deadline);
create index if not exists idx_applications_user_status         on public.applications (user_id, status, archived);

create index if not exists idx_companies_user                   on public.companies (user_id);

create index if not exists idx_company_checklist_items_user    on public.company_checklist_items (user_id);
create index if not exists idx_company_checklist_items_company  on public.company_checklist_items (company_id);

create index if not exists idx_goals_user                       on public.goals (user_id);
create index if not exists idx_goals_user_deadline              on public.goals (user_id, deadline);

create index if not exists idx_roadmap_weeks_user               on public.roadmap_weeks (user_id);
create index if not exists idx_roadmap_weeks_user_week          on public.roadmap_weeks (user_id, week_number);

create index if not exists idx_roadmap_tasks_user               on public.roadmap_tasks (user_id);
create index if not exists idx_roadmap_tasks_week               on public.roadmap_tasks (week_id);
create index if not exists idx_roadmap_tasks_subject            on public.roadmap_tasks (subject_id);

create index if not exists idx_activities_user                 on public.activities (user_id);
create index if not exists idx_activities_user_at              on public.activities (user_id, at desc);

-- ===========================================================================
-- 11. OWNSHIP HELPERS
-- ---------------------------------------------------------------------------
-- These must be SECURITY DEFINER: they read a parent table whose RLS policies
-- would otherwise recurse infinitely when evaluated from inside a child's
-- INSERT policy. `search_path` is pinned for safety, and each function filters
-- explicitly on `auth.uid()`, so bypassing RLS does not widen access.
-- They are also `stable`, so the planner can call them once per statement.
-- ===========================================================================

create or replace function public.owns_subject(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.subjects s where s.id = p_id and s.user_id = (select auth.uid())
  );
$$;

create or replace function public.owns_topic(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.topics t where t.id = p_id and t.user_id = (select auth.uid())
  );
$$;

create or replace function public.owns_subtopic(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.subtopics t where t.id = p_id and t.user_id = (select auth.uid())
  );
$$;

create or replace function public.owns_dsa_module(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.dsa_modules m where m.id = p_id and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.owns_dsa_topic(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.dsa_topics t where t.id = p_id and t.user_id = (select auth.uid())
  );
$$;

create or replace function public.owns_dsa_pattern(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.dsa_patterns p where p.id = p_id and p.user_id = (select auth.uid())
  );
$$;

create or replace function public.owns_dsa_problem(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.dsa_problems p where p.id = p_id and p.user_id = (select auth.uid())
  );
$$;

create or replace function public.owns_project(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.projects p where p.id = p_id and p.user_id = (select auth.uid())
  );
$$;

create or replace function public.owns_company(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.companies c where c.id = p_id and c.user_id = (select auth.uid())
  );
$$;

create or replace function public.owns_roadmap_week(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.roadmap_weeks w where w.id = p_id and w.user_id = (select auth.uid())
  );
$$;

-- ===========================================================================
-- 12. ROW LEVEL SECURITY
--     Enabled on every table. No table is left unprotected and no anonymous
--     policy is created anywhere in this file.
--
--     Policy shape follows current Supabase guidance:
--       * one policy per operation;
--       * `(select auth.uid())` so the value is evaluated once per statement
--         instead of once per row;
--       * `USING` for read/update/delete, `WITH CHECK` for insert/update.
--
--     Ownership is always `row.user_id = auth.uid()` — never a client-supplied
--     value. Where a row points at a parent, the INSERT policy additionally
--     requires that the parent is owned by the same authenticated user, which
--     is what stops "insert a topic pointing at User B's subject".
--
--     The policies below are cleared first so re-running this migration
--     replaces them instead of failing on a duplicate name.
-- ===========================================================================

do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end;
$$;

alter table public.settings              enable row level security;
alter table public.subjects              enable row level security;
alter table public.topics                enable row level security;
alter table public.subtopics             enable row level security;
alter table public.checklist_items       enable row level security;
alter table public.tasks                 enable row level security;
alter table public.sessions              enable row level security;
alter table public.revisions             enable row level security;
alter table public.dsa_modules           enable row level security;
alter table public.dsa_topics            enable row level security;
alter table public.dsa_patterns          enable row level security;
alter table public.dsa_problems          enable row level security;
alter table public.dsa_sessions          enable row level security;
alter table public.notes                 enable row level security;
alter table public.journal_entries       enable row level security;
alter table public.weekly_reviews        enable row level security;
alter table public.projects              enable row level security;
alter table public.project_checklist_items enable row level security;
alter table public.interview_questions   enable row level security;
alter table public.behavioral_stories    enable row level security;
alter table public.mock_interviews       enable row level security;
alter table public.applications          enable row level security;
alter table public.companies             enable row level security;
alter table public.company_checklist_items enable row level security;
alter table public.goals                 enable row level security;
alter table public.roadmap_weeks         enable row level security;
alter table public.roadmap_tasks         enable row level security;
alter table public.activities            enable row level security;

-- ---------------------------------------------------------------------------
-- settings (singleton per user)
-- ---------------------------------------------------------------------------
create policy settings_select_own on public.settings
  for select to authenticated using ((select auth.uid()) = user_id);
create policy settings_insert_own on public.settings
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy settings_update_own on public.settings
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy settings_delete_own on public.settings
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- subjects
-- ---------------------------------------------------------------------------
create policy subjects_select_own on public.subjects
  for select to authenticated using ((select auth.uid()) = user_id);
create policy subjects_insert_own on public.subjects
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy subjects_update_own on public.subjects
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy subjects_delete_own on public.subjects
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- topics — parent is another topic, so ownership of BOTH subject_id and
-- parent_id is required on insert.
-- ---------------------------------------------------------------------------
create policy topics_select_own on public.topics
  for select to authenticated using ((select auth.uid()) = user_id);
create policy topics_insert_own on public.topics
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and public.owns_subject(subject_id)
    and (parent_id is null or public.owns_topic(parent_id))
  );
create policy topics_update_own on public.topics
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and public.owns_subject(subject_id)
    and (parent_id is null or public.owns_topic(parent_id))
  );
create policy topics_delete_own on public.topics
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- subtopics
-- ---------------------------------------------------------------------------
create policy subtopics_select_own on public.subtopics
  for select to authenticated using ((select auth.uid()) = user_id);
create policy subtopics_insert_own on public.subtopics
  for insert to authenticated with check (
    (select auth.uid()) = user_id and public.owns_topic(topic_id)
  );
create policy subtopics_update_own on public.subtopics
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and public.owns_topic(topic_id));
create policy subtopics_delete_own on public.subtopics
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- checklist_items
-- ---------------------------------------------------------------------------
create policy checklist_items_select_own on public.checklist_items
  for select to authenticated using ((select auth.uid()) = user_id);
create policy checklist_items_insert_own on public.checklist_items
  for insert to authenticated with check (
    (select auth.uid()) = user_id and public.owns_subtopic(subtopic_id)
  );
create policy checklist_items_update_own on public.checklist_items
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and public.owns_subtopic(subtopic_id));
create policy checklist_items_delete_own on public.checklist_items
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
create policy tasks_select_own on public.tasks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy tasks_insert_own on public.tasks
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and (subject_id is null or public.owns_subject(subject_id))
    and (topic_id is null or public.owns_topic(topic_id))
    and (subtopic_id is null or public.owns_subtopic(subtopic_id))
  );
create policy tasks_update_own on public.tasks
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (subject_id is null or public.owns_subject(subject_id))
    and (topic_id is null or public.owns_topic(topic_id))
    and (subtopic_id is null or public.owns_subtopic(subtopic_id))
  );
create policy tasks_delete_own on public.tasks
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------------
create policy sessions_select_own on public.sessions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy sessions_insert_own on public.sessions
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and (subject_id is null or public.owns_subject(subject_id))
    and (topic_id is null or public.owns_topic(topic_id))
    and (subtopic_id is null or public.owns_subtopic(subtopic_id))
  );
create policy sessions_update_own on public.sessions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (subject_id is null or public.owns_subject(subject_id))
    and (topic_id is null or public.owns_topic(topic_id))
    and (subtopic_id is null or public.owns_subtopic(subtopic_id))
  );
create policy sessions_delete_own on public.sessions
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- revisions
-- ---------------------------------------------------------------------------
create policy revisions_select_own on public.revisions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy revisions_insert_own on public.revisions
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and (subject_id is null or public.owns_subject(subject_id))
    and (topic_id is null or public.owns_topic(topic_id))
    and (problem_id is null or public.owns_dsa_problem(problem_id))
  );
create policy revisions_update_own on public.revisions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (subject_id is null or public.owns_subject(subject_id))
    and (topic_id is null or public.owns_topic(topic_id))
    and (problem_id is null or public.owns_dsa_problem(problem_id))
  );
create policy revisions_delete_own on public.revisions
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- dsa_modules
-- ---------------------------------------------------------------------------
create policy dsa_modules_select_own on public.dsa_modules
  for select to authenticated using ((select auth.uid()) = user_id);
create policy dsa_modules_insert_own on public.dsa_modules
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy dsa_modules_update_own on public.dsa_modules
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy dsa_modules_delete_own on public.dsa_modules
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- dsa_topics — must belong to one of the caller's modules
-- ---------------------------------------------------------------------------
create policy dsa_topics_select_own on public.dsa_topics
  for select to authenticated using ((select auth.uid()) = user_id);
create policy dsa_topics_insert_own on public.dsa_topics
  for insert to authenticated with check (
    (select auth.uid()) = user_id and public.owns_dsa_module(module_id)
  );
create policy dsa_topics_update_own on public.dsa_topics
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and public.owns_dsa_module(module_id));
create policy dsa_topics_delete_own on public.dsa_topics
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- dsa_patterns — must belong to one of the caller's modules AND topics
-- ---------------------------------------------------------------------------
create policy dsa_patterns_select_own on public.dsa_patterns
  for select to authenticated using ((select auth.uid()) = user_id);
create policy dsa_patterns_insert_own on public.dsa_patterns
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and public.owns_dsa_module(module_id)
    and public.owns_dsa_topic(topic_id)
  );
create policy dsa_patterns_update_own on public.dsa_patterns
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and public.owns_dsa_module(module_id)
    and public.owns_dsa_topic(topic_id)
  );
create policy dsa_patterns_delete_own on public.dsa_patterns
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- dsa_problems — module / topic / pattern are all optional references
-- ---------------------------------------------------------------------------
create policy dsa_problems_select_own on public.dsa_problems
  for select to authenticated using ((select auth.uid()) = user_id);
create policy dsa_problems_insert_own on public.dsa_problems
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and (module_id is null or public.owns_dsa_module(module_id))
    and (topic_id is null or public.owns_dsa_topic(topic_id))
    and (pattern_id is null or public.owns_dsa_pattern(pattern_id))
  );
create policy dsa_problems_update_own on public.dsa_problems
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (module_id is null or public.owns_dsa_module(module_id))
    and (topic_id is null or public.owns_dsa_topic(topic_id))
    and (pattern_id is null or public.owns_dsa_pattern(pattern_id))
  );
create policy dsa_problems_delete_own on public.dsa_problems
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- dsa_sessions
-- ---------------------------------------------------------------------------
create policy dsa_sessions_select_own on public.dsa_sessions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy dsa_sessions_insert_own on public.dsa_sessions
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and (module_id is null or public.owns_dsa_module(module_id))
    and (topic_id is null or public.owns_dsa_topic(topic_id))
    and (pattern_id is null or public.owns_dsa_pattern(pattern_id))
  );
create policy dsa_sessions_update_own on public.dsa_sessions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (module_id is null or public.owns_dsa_module(module_id))
    and (topic_id is null or public.owns_dsa_topic(topic_id))
    and (pattern_id is null or public.owns_dsa_pattern(pattern_id))
  );
create policy dsa_sessions_delete_own on public.dsa_sessions
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- notes
-- ---------------------------------------------------------------------------
create policy notes_select_own on public.notes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy notes_insert_own on public.notes
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and (subject_id is null or public.owns_subject(subject_id))
    and (topic_id is null or public.owns_topic(topic_id))
  );
create policy notes_update_own on public.notes
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (subject_id is null or public.owns_subject(subject_id))
    and (topic_id is null or public.owns_topic(topic_id))
  );
create policy notes_delete_own on public.notes
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- journal_entries
-- ---------------------------------------------------------------------------
create policy journal_entries_select_own on public.journal_entries
  for select to authenticated using ((select auth.uid()) = user_id);
create policy journal_entries_insert_own on public.journal_entries
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and (problem_id is null or public.owns_dsa_problem(problem_id))
  );
create policy journal_entries_update_own on public.journal_entries
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (problem_id is null or public.owns_dsa_problem(problem_id))
  );
create policy journal_entries_delete_own on public.journal_entries
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- weekly_reviews
-- ---------------------------------------------------------------------------
create policy weekly_reviews_select_own on public.weekly_reviews
  for select to authenticated using ((select auth.uid()) = user_id);
create policy weekly_reviews_insert_own on public.weekly_reviews
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy weekly_reviews_update_own on public.weekly_reviews
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy weekly_reviews_delete_own on public.weekly_reviews
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------
create policy projects_select_own on public.projects
  for select to authenticated using ((select auth.uid()) = user_id);
create policy projects_insert_own on public.projects
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy projects_update_own on public.projects
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy projects_delete_own on public.projects
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- project_checklist_items
-- ---------------------------------------------------------------------------
create policy project_checklist_items_select_own on public.project_checklist_items
  for select to authenticated using ((select auth.uid()) = user_id);
create policy project_checklist_items_insert_own on public.project_checklist_items
  for insert to authenticated with check (
    (select auth.uid()) = user_id and public.owns_project(project_id)
  );
create policy project_checklist_items_update_own on public.project_checklist_items
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and public.owns_project(project_id));
create policy project_checklist_items_delete_own on public.project_checklist_items
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- interview_questions
-- ---------------------------------------------------------------------------
create policy interview_questions_select_own on public.interview_questions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy interview_questions_insert_own on public.interview_questions
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and (subject_id is null or public.owns_subject(subject_id))
    and (topic_id is null or public.owns_topic(topic_id))
  );
create policy interview_questions_update_own on public.interview_questions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (subject_id is null or public.owns_subject(subject_id))
    and (topic_id is null or public.owns_topic(topic_id))
  );
create policy interview_questions_delete_own on public.interview_questions
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- behavioral_stories
-- ---------------------------------------------------------------------------
create policy behavioral_stories_select_own on public.behavioral_stories
  for select to authenticated using ((select auth.uid()) = user_id);
create policy behavioral_stories_insert_own on public.behavioral_stories
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy behavioral_stories_update_own on public.behavioral_stories
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy behavioral_stories_delete_own on public.behavioral_stories
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- mock_interviews
-- ---------------------------------------------------------------------------
create policy mock_interviews_select_own on public.mock_interviews
  for select to authenticated using ((select auth.uid()) = user_id);
create policy mock_interviews_insert_own on public.mock_interviews
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy mock_interviews_update_own on public.mock_interviews
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy mock_interviews_delete_own on public.mock_interviews
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- applications
-- ---------------------------------------------------------------------------
create policy applications_select_own on public.applications
  for select to authenticated using ((select auth.uid()) = user_id);
create policy applications_insert_own on public.applications
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy applications_update_own on public.applications
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy applications_delete_own on public.applications
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------------
create policy companies_select_own on public.companies
  for select to authenticated using ((select auth.uid()) = user_id);
create policy companies_insert_own on public.companies
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy companies_update_own on public.companies
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy companies_delete_own on public.companies
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- company_checklist_items
-- ---------------------------------------------------------------------------
create policy company_checklist_items_select_own on public.company_checklist_items
  for select to authenticated using ((select auth.uid()) = user_id);
create policy company_checklist_items_insert_own on public.company_checklist_items
  for insert to authenticated with check (
    (select auth.uid()) = user_id and public.owns_company(company_id)
  );
create policy company_checklist_items_update_own on public.company_checklist_items
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and public.owns_company(company_id));
create policy company_checklist_items_delete_own on public.company_checklist_items
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- goals — ref_id is polymorphic and deliberately has no FK
-- ---------------------------------------------------------------------------
create policy goals_select_own on public.goals
  for select to authenticated using ((select auth.uid()) = user_id);
create policy goals_insert_own on public.goals
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy goals_update_own on public.goals
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy goals_delete_own on public.goals
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- roadmap_weeks
-- ---------------------------------------------------------------------------
create policy roadmap_weeks_select_own on public.roadmap_weeks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy roadmap_weeks_insert_own on public.roadmap_weeks
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy roadmap_weeks_update_own on public.roadmap_weeks
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy roadmap_weeks_delete_own on public.roadmap_weeks
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- roadmap_tasks
-- ---------------------------------------------------------------------------
create policy roadmap_tasks_select_own on public.roadmap_tasks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy roadmap_tasks_insert_own on public.roadmap_tasks
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and public.owns_roadmap_week(week_id)
    and (subject_id is null or public.owns_subject(subject_id))
    and (topic_id is null or public.owns_topic(topic_id))
  );
create policy roadmap_tasks_update_own on public.roadmap_tasks
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and public.owns_roadmap_week(week_id)
    and (subject_id is null or public.owns_subject(subject_id))
    and (topic_id is null or public.owns_topic(topic_id))
  );
create policy roadmap_tasks_delete_own on public.roadmap_tasks
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- activities
-- ---------------------------------------------------------------------------
create policy activities_select_own on public.activities
  for select to authenticated using ((select auth.uid()) = user_id);
create policy activities_insert_own on public.activities
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and (subject_id is null or public.owns_subject(subject_id))
    and (topic_id is null or public.owns_topic(topic_id))
    and (problem_id is null or public.owns_dsa_problem(problem_id))
    and (project_id is null or public.owns_project(project_id))
  );
create policy activities_update_own on public.activities
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (subject_id is null or public.owns_subject(subject_id))
    and (topic_id is null or public.owns_topic(topic_id))
    and (problem_id is null or public.owns_dsa_problem(problem_id))
    and (project_id is null or public.owns_project(project_id))
  );
create policy activities_delete_own on public.activities
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ===========================================================================
-- 13. GRANT
--     Authenticated clients need table privileges for RLS to be the thing that
--     actually filters their access. No grants to `anon`.
-- ===========================================================================

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
