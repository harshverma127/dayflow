-- ===========================================================================
-- RLS verification for Dayflow
-- ---------------------------------------------------------------------------
-- Two layers:
--
--   PART 1 — static checks. Run these any time in the Supabase SQL Editor.
--            They prove the policies EXIST and are shaped correctly.
--
--   PART 2 — behavioural checks. These prove the policies actually BLOCK
--            cross-user access. They need two real users, so they are written
--            for a script with service-role access (a test harness), NOT for
--            the dashboard SQL Editor, because the editor runs as a privileged
--            role that RLS does not apply to.
--
-- Running Part 2 is the only way to honestly claim "RLS is secure". Policies
-- existing is not the same as ownership being enforced.
-- ===========================================================================


-- ===========================================================================
-- PART 1 — STATIC CHECKS (safe to paste into the SQL Editor)
-- ===========================================================================

\echo '--- 1a. every table has RLS enabled (expect 0) ---'
select count(*) as tables_without_rls
from pg_tables
where schemaname = 'public' and rowsecurity = false;

\echo '--- 1b. every table has all four operation policies (expect no rows) ---'
with tables as (
  select tablename from pg_tables where schemaname = 'public'
),
ops as (select unnest(array['select','insert','update','delete']) as cmd),
missing as (
  select t.tablename
  from tables t
  cross join ops o
  where not exists (
    select 1 from pg_policies p
    where p.schemaname = 'public' and p.tablename = t.tablename and p.cmd = o.cmd
  )
)
select * from missing;

\echo '--- 1c. no anonymous policies anywhere (expect 0) ---'
select count(*) as anon_policies
from pg_policies
where schemaname = 'public' and 'anon' = any(roles);

\echo '--- 1d. no policies that skip the auth.uid() ownership check ---'
-- Every policy on a user-owned table must mention auth.uid().
with owned as (
  select c.relname as tablename
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attname = 'user_id'
  where n.nspname = 'public' and c.relkind = 'r'
)
select p.tablename, p.policyname
from pg_policies p
join owned o on o.tablename = p.tablename
where p.schemaname = 'public'
  and p.qual is not null and p.qual not ilike '%auth.uid()%'
  and p.with_check is not null and p.with_check not ilike '%auth.uid()%';

\echo '--- 1e. policy count per table (expect 4 each, 28 tables) ---'
select tablename, count(*) as policies
from pg_policies
where schemaname = 'public'
group by tablename
having count(*) <> 4;

\echo '--- 1f. user_id is indexed on every user-owned table ---'
select t.tablename
from pg_tables t
where t.schemaname = 'public'
  and exists (
    select 1 from pg_attribute a
    where a.attrelid = (quote_ident(t.schemaname)||'.'||quote_ident(t.tablename))::regclass
      and a.attname = 'user_id'
  )
  and not exists (
    select 1 from pg_indexes i
    where i.schemaname = 'public' and i.tablename = t.tablename and i.indexdef ilike '%user_id%'
  );


-- ===========================================================================
-- PART 2 — BEHAVIOURAL CHECKS
--
-- Requires two authenticated users and a way to execute statements as each
-- JWT. The shape below uses Supabase's `request.jwt.claims` setting, which
-- only a service-role connection may set — that is exactly why this cannot be
-- run from the dashboard.
--
-- Harness sketch (Node + @supabase/supabase-js):
--
--   const a = createClient(url, anon, { global: { headers: { Authorization:
--            `Bearer ${await signInAsA()}` } } });
--   const b = createClient(url, anon, { global: { headers: { Authorization:
--            `Bearer ${await signInAsB()}` } } });
--
-- Then assert:
--
--   A can read own rows          -> a.from('subjects').select()      returns rows
--   A can insert own rows        -> a.from('subjects').insert({...}) succeeds
--   A can update own rows        -> a.from('subjects').update({...}).eq('id', aId) returns 1 row
--   A can delete own rows        -> a.from('subjects').delete().eq('id', aId) returns 1 row
--
--   B cannot read A rows         -> b.from('subjects').select().eq('id', aId) returns 0 rows
--   B cannot update A rows       -> .update({name:'hijacked'}).eq('id', aId) updates 0 rows
--   B cannot delete A rows       -> .delete().eq('id', aId) deletes 0 rows
--
--   B cannot create children under A's parents:
--     a) topic pointing at A's subject
--        b.from('topics').insert({ user_id: bUserId, subject_id: aSubjectId, ... })
--        -> rejected by WITH CHECK public.owns_subject(subject_id)
--     b) checklist item pointing at A's subtopic
--        b.from('checklist_items').insert({ user_id: bUserId, subtopic_id: aSubId, ... })
--        -> rejected by public.owns_subtopic(subtopic_id)
--     c) DSA pattern pointing at A's DSA topic
--        b.from('dsa_patterns').insert({ user_id: bUserId, topic_id: aDsaTopicId, ... })
--        -> rejected by public.owns_dsa_topic(topic_id)
--     d) problem pointing at A's pattern
--        b.from('dsa_problems').insert({ user_id: bUserId, pattern_id: aPatternId, ... })
--        -> rejected by public.owns_dsa_pattern(pattern_id)
--
--   B cannot forge ownership: inserting a row with user_id = A's id
--        -> rejected by the (select auth.uid()) = user_id WITH CHECK
--
--   Also worth asserting: the same writes SUCCEED when B uses its own
--   subject_id / subtopic_id, proving the helpers are not simply denying
--   everything.
--
-- The equivalent pure-SQL version, run once per user with the claims set:
--
--   set local request.jwt.claims = '{"sub":"<uuid-of-user-b>","role":"authenticated"}';
--
--   -- expect 0 rows
--   select * from public.subjects where user_id = '<uuid-of-user-a>';
--
--   -- expect: ERROR new row violates row-level security policy
--   insert into public.topics (user_id, subject_id, kind, name)
--   values ('<uuid-of-user-b>', '<uuid-of-user-a-subject>', 'topic', 'should fail');
--
--   rollback;
-- ===========================================================================
