# Supabase setup for Dayflow

This folder holds everything you need to turn a blank Supabase project into the
backend for the Dayflow frontend. There is no separate server — the React app
talks to Supabase Auth and Postgres directly, and Vercel only serves the static
build.

```
supabase/
  migrations/
    20260101000000_initial_dayflow_schema.sql   <- tables, FKs, indexes, RLS
  verify_rls.sql                                <- ownership checks you can run
  README.md                                     <- this file
```

---

## 1. Create the project

1. Go to <https://supabase.com> and create a project.
2. Wait for the database to finish provisioning.
3. Note the region. It is not configurable later for this project.

---

## 2. Run the schema

1. In the Supabase dashboard, open **SQL Editor** (left sidebar).
2. Click **New query**.
3. Open `supabase/migrations/20260101000000_initial_dayflow_schema.sql` in this
   repository, copy the whole file, and paste it into the editor.
4. Click **Run** (or press Ctrl/Cmd + Enter).

The script is additive and re-runnable:

- it only uses `create table if not exists`, so it is safe on a new project;
- it drops and recreates the `public` policies it owns, so running it twice
  refreshes them instead of failing on a duplicate name;
- it never drops a database, schema or table.

### What it creates

- **28 tables**, all keyed by `uuid`, all carrying
  `user_id uuid not null references auth.users(id) on delete cascade`.
- **Foreign keys** for every parent/child relationship the app has:
  subject → topic → subtopic → checklist item, DSA module → topic → pattern →
  problem, project → checklist item, roadmap week → task, company → checklist
  item, and so on.
- **Indexes** on `user_id` everywhere (it is the RLS policy filter column), on
  every parent foreign key, and on the date columns the dashboards filter on.
- **Row Level Security** enabled on all 28 tables, with four policies each
  (`select` / `insert` / `update` / `delete`), every one comparing
  `(select auth.uid()) = user_id`.
- **10 `SECURITY DEFINER` ownership helpers** (`owns_subject`, `owns_topic`,
  `owns_dsa_pattern`, …) that the `insert`/`update` policies use to prove a
  referenced parent also belongs to the caller.

---

## 3. Verify the tables

Run this in the SQL Editor:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

Expect **28 rows**, every `rowsecurity` value `true`.

---

## 4. Verify RLS is on

```sql
select count(*) as tables_without_rls
from pg_tables
where schemaname = 'public' and rowsecurity = false;
```

Expect `0`.

---

## 5. Verify the policies

Every table should have four policies, all restricted to `authenticated`:

```sql
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
order by tablename, cmd;
```

Expect **112 rows** (28 tables × 4 operations). There should be **no** policy
that lists the `anon` role — run this to confirm:

```sql
select count(*) as anon_policies
from pg_policies
where schemaname = 'public' and 'anon' = any(roles);
```

Expect `0`.

---

## 6. Verify ownership logic

`verify_rls.sql` in this folder contains the real end-to-end check. It needs
two authenticated users, so the quickest route is the browser:

1. Sign up **User A** with the app, add one subject and one DSA problem.
2. Sign up **User B** in a private window with a different email.
3. Run `verify_rls.sql`'s checks against the two JWTs (see the comments at the
   top of that file).

Or paste the individual assertions from that file into the SQL Editor while
signed in through the app.

---

## 7. Authentication settings

Under **Authentication → Providers → Email**:

- Keep **Email** enabled (it is by default).
- Turn **Confirm email** on for production. With it on, sign-up returns a
  "check your inbox" state and the session only exists after the link is used;
  the app handles both paths.
- Under **Authentication → URL Configuration**, set **Site URL** to your Vercel
  domain (e.g. `https://your-app.vercel.app`) and add the same URL to
  **Redirect URLs**. This is what makes password-reset links return to the app.

No other provider is required.

---

## 8. Environment variables

In **Project Settings → API** you will find:

- **Project URL**
- **Publishable key** (newer projects; older ones call it the anon key)

Copy `.env.example` to `.env.local` at the repo root and paste them in:

```bash
cp .env.example .env.local
```

```dotenv
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

`.env.local` is already covered by `.gitignore` (`.env*`). Never commit it.

**Never put the `service_role` / secret key in frontend code.** It bypasses RLS,
so shipping it in a bundle would expose every user's data to anyone who opens
dev tools. `src/services/supabase.ts` only ever reads the publishable key.

---

## 9. Vercel

1. Import the repo in Vercel (framework preset: Vite).
2. Add the same two variables under **Settings → Environment Variables** and
   redeploy. Vite inlines `VITE_*` values at build time, so they must be set
   before the build runs.
3. No build command changes are needed — `npm run build` already emits
   `dist/`.

---

## 10. Local development

```bash
npm install
cp .env.example .env.local   # fill in your project URL + publishable key
npm run dev
```

If the variables are missing the app still starts: it shows a setup panel and
offers to continue against the local IndexedDB workspace, so you can keep
working offline.

---

## How `user_id` gets onto every row

Ownership is never sent by a form, a page or the data in the store. It is
injected in exactly one place, immediately before the request leaves:

1. `requireUserId()` in `src/services/auth.ts` resolves the id from the live
   Supabase session (the cached session first, `supabase.auth.getUser()` when the
   cache is cold) and throws `Not authenticated` if there is none.
2. `writeOwned()` in `src/services/cloud.ts` is the only place in the app that
   calls `.upsert()`. It stamps `user_id` via `stampOwnership()` on every row,
   overwriting anything that was already there.

So the `settings` payload that once failed with
`42501 new row violates row-level security policy for table "settings"` now
carries `user_id`, which is what makes `on_conflict=user_id` meaningful —
without it, Postgres had no conflict column to match on and the row could not
satisfy `auth.uid() = user_id`.

Rules this keeps in place:

- `toRow()` takes no owner argument, so a mapper cannot be given a stale id.
- `fromRow()` still returns `user_id`, so ownership survives the read and child
  stitching.
- Deletes are additionally scoped with `.eq('user_id', userId)`, on top of RLS.
- No policy is weakened; the database still trusts only `auth.uid()`.

If you ever see `42501` again, the write did not come from `writeOwned()`.

To confirm RLS is doing its job without signing in, run `npm run probe:rlS`:
it reads the two tables anonymously and expects **0 rows** back.

---

## Resetting a table

If you need to start over on a test project, drop the schema in the SQL
Editor — this is destructive and is intentionally NOT part of the migration:

```sql
drop schema public cascade;
```

Then re-run the migration file.
