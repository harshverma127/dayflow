# PrepTrack — Placement OS

A personal **coding-interview & placement preparation workspace** for a CSE student targeting
SWE internships, campus interviews, big-tech-style coding rounds and final placements.

Every number, bar and chart is **derived from real work you log** — there are no fake sliders or
manually typed percentages. Progress comes from checked checklist items, completed subtopics,
solved problems and project checklists. Everything persists in your browser and survives refreshes.

Built to feel like a calm, premium study planner rather than a blue SaaS admin panel: soft ivory /
warm-charcoal surfaces, muted sage / lavender / sand accents, generous spacing and Linear-Notion-like
cleanliness.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:5183
```

Other scripts:

```bash
npm run build        # typecheck + production build into dist/
npm run preview      # serve the production build
npm run typecheck    # tsc --noEmit
```

Node 18+ recommended (developed on Node 24).

---

## The idea

PrepTrack is organised around one learning hierarchy and one lab:

```
Subject → Unit → Topic → Subtopic → ChecklistItem
```

and a dedicated **DSA Lab** built on **Striver's A2Z DSA Course**:

```
A2Z Module → Topic → Pattern → Problem (mastery tracked as separate flags)
```

Progress is calculated in exactly one place (`src/lib/progress.ts`), so the dashboard, subjects,
analytics, insights and notifications can never disagree with each other.

---

## What you can do

| Area | Capabilities |
| --- | --- |
| **Dashboard** | Greeting, current roadmap week, overall readiness, Today's focus, smart "study next", weak areas, revision due, recent activity, goal snapshots |
| **DSA Lab** | Full A2Z curriculum (19 modules → topics → patterns → ~250 real problems) with an overview, expandable roadmap, searchable question bank, **per-problem mastery flags** (attempted / solved / understood / independent / mastered / needs revision / hint / editorial / solution watched), confidence stars, mistake tags and complexities, **pattern-strength** scoring, weakness detection, "you are improving in", practice-session logging and spaced revision |
| **Subjects** | Subject cards with live completion, search, category filter, archive, reorder, create-from-text (topics + subtopics) |
| **Subject detail** | Expandable **Unit → Topic → Subtopic → checklist-item** tree; per-topic learning lifecycle (learned / practiced / can explain / applied); priorities, target dates and per-topic revision toggles; subtopics with checklists, confidence dots and inline rename; resources; notes; study history |
| **Revise** | A single spaced-repetition centre (1 / 3 / 7 / 14 / 30-day intervals) pulling in topics and DSA problems, with **Independently / Needed a hint / Needed help / Couldn't recall** outcomes that reschedule automatically |
| **Daily Planner** | High / Normal / Optional lists, planner that is aware of your real data, roll-over of missed tasks |
| **Study timer** | Stopwatch + Pomodoro, attach a subject/topic, saves straight into study history |
| **Notes** | Markdown notes with tags, subjects and search |
| **Projects** | Status, stack, links, features, and structured interview-readiness fields (architecture, database, APIs, auth, security, testing, deployment, challenges, trade-offs, future work) plus a **12-point interview checklist** that drives readiness |
| **Interviews** | Question bank with confidence + revision flags, mock interviews with score history, **company prep pages whose area readiness is derived from your real progress**, and **STAR stories** |
| **Applications** | Company, role, status pipeline, OA/interview dates, referral, notes, archive |
| **Analytics** | Weighted overall progress, track readiness, roadmap adherence, subject completion, interview & project readiness, GitHub-style heatmap, streaks, **auto-computed goals**, monthly comparison, CSV export |
| **Journal** | Problem-solving mistake log (9 mistake types), why you got stuck, correct idea, what to remember, revisit date, mistake distribution |
| **Weekly review** | Weekly metrics + saved reflection, month-over-month comparison |
| **Archived** | Subjects, projects and applications are archived (not hard-deleted) and can be restored or permanently removed here |
| **Settings** | Profile, prep type, roadmap anchor, theme, notifications, configurable progress weights, historical solved count, JSON backup/restore, CSV export, reset/clear with confirmation |

Plus a global **Ctrl/⌘ + K command palette**, `N` quick-add (12 kinds), a notification centre,
toasts with **Undo** on destructive actions, dark/light/system themes and a mobile bottom nav + FAB.

---

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Ctrl`/`⌘` + `K` | Command palette (navigate + search subjects, topics, problems, notes, projects, questions, applications) |
| `N` | Quick add (task, problem, session, subject, topic, note, project, interview question, …) |
| `?` or `/` | Show shortcut hint |
| `Esc` | Close dialogs / palette |

---

## How progress is calculated

Everything is derived — nothing is typed in by hand.

- **Subtopic** → the fraction of its checklist items completed (or its explicit tick when it has no items).
- **Topic** → average of its subtopics and child topics; falls back to the 4-step learning lifecycle when it has no children.
- **Subject** → average of its topics.
- **DSA Lab** → a **problem-mastery score** from the individual flags, rolled up into **pattern strength** (0–5) and module coverage; DSA progress is curriculum coverage, not a typed percentage.
- **Track buckets** — subjects map to `DSA`, `Core CS`, `Development`, `Design` (LLD / System Design) and `Interview`; `Projects` come from each project's checklist.
  - *Interview readiness* blends interview-subject progress, question confidence, mock scores and STAR-story confidence.
- **Overall preparation** → weighted average of the buckets (weights configurable in **Settings → Analytics weighting**).
- **Goals** → most metrics are **auto-tracked** (`dsa-solved`, `dsa-independent`, `dsa-mastered`, `subject-progress`, `projects-ready`, `mocks`, `applications`); only the "manual counter" metric is typed.
- **Streaks / heatmap** → consecutive days of logged activity, and study minutes bucketed into 5 intensity levels.

---

## Your data is preserved

The store is versioned (`DATA_VERSION = 2`) and the persister migrates older payloads in place:

- A **pre-migration backup** is written to `preptrack:backup:pre-migration` before any upgrade.
- The old flat **DSA subject is archived** (kept, not deleted) and its problems are matched into the
  new A2Z tree by name, so nothing is lost.
- Existing goals infer an **auto metric** from their title where possible.

Your workspace lives in `localStorage` under the `preptrack:v1` key. The payload carries its own
`version`, so the key name never needs to change.

### Getting data in and out

- **Settings → Data & backup → Download backup (JSON)** writes the entire store to a file.
- **Restore backup** reads a validated JSON backup back in (invalid files produce a friendly error).
- **Export problems (CSV)** (Settings) and **Export sessions** (Analytics) give spreadsheet-friendly files.
- **Reset** and **Clear all data** ask for confirmation first, and **Undo** restores the previous snapshot.

---

## Tech stack

- **React 18 + TypeScript + Vite**
- **Tailwind CSS** with CSS-variable design tokens (light/dark/system)
- **Zustand** + `persist` middleware writing to `localStorage`
- **React Router** (lazy-loaded routes per page)
- **Recharts** for charts
- **lucide-react** icons, **date-fns** for date maths

No backend is required. The store is a plain serialisable object, so a REST/GraphQL API, cloud sync or
auth can be layered on later without changing the domain model.

---

## Project structure

```
src/
├── main.tsx                 # entry point
├── App.tsx                  # router + lazy pages, wrapped in AppShell and ToastProvider
├── index.css                # warm design tokens (CSS variables), base + component styles
├── tailwind.config.js       # exposes accent-*, brand, content, surface, border, shadows, animations
├── types.ts                 # full v2 domain model
├── store.ts                 # zustand store: every CRUD action, migration hook, log(), undo
├── uiStore.ts               # ephemeral UI state (palette, drawers, study timer)
├── data/
│   ├── seed.ts              # roadmap, subjects/topics, DSA curriculum, projects, goals, samples
│   └── dsaCurriculum.ts     # Striver A2Z modules → topics → patterns + ~250 problems
├── lib/
│   ├── constants.ts         # label/tone metadata + option lists for every enum
│   ├── progress.ts          # the single progress/analytics/insights engine
│   ├── migration.ts         # v1 → v2 upgrade
│   └── utils.ts             # dates, formatting, ids, CSV/download helpers
├── components/
│   ├── ui.tsx               # Button, Card, Modal, Drawer, Badge, Progress*, Toast, Stars, …
│   ├── common.tsx           # PageHeader, MetricBar, ReadinessRow, CheckRow, ToggleRow
│   ├── charts.tsx           # themed recharts wrappers
│   ├── Layout.tsx           # sidebar / bottom nav / topbar / notifications / FAB
│   ├── CommandPalette.tsx   # Ctrl+K
│   ├── QuickAdd.tsx         # N quick add
│   └── TimerWidget.tsx      # Pomodoro + stopwatch
└── pages/                   # Dashboard, Roadmap, DSA, Subjects, SubjectDetail, Planner, Revision,
                             # Projects, Interviews, Applications, Analytics, Notes, Journal,
                             # Review, Archived, Settings
```

---

## Accessibility & responsiveness

- Semantic landmarks, labelled controls, `role="dialog"` + `aria-modal`, keyboard-operable inputs,
  `focus-visible` rings and visible toggle states.
- One layout that adapts: persistent sidebar on desktop/tablet, bottom navigation + drawer + floating
  `+` on mobile, tables that collapse into cards, charts that resize, and no horizontal page overflow.
