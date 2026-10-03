// Exercises the row mapper (toRow / fromRow) against a fixture, with no
// network and no Supabase. Run with: node scripts/test-mapping.cjs
//
// This is the part of the cloud layer that silently corrupts data if it is
// wrong (snake_case names, undefined -> null, jsonb defaults, parent FK
// pass-through), so it is worth asserting rather than eyeballing.
import { COLLECTIONS, fromRow, stampOwnership, toRow } from '../src/services/schema';

const specFor = (table) => COLLECTIONS.find((s) => s.table === table);
let failures = 0;

function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    failures += 1;
    console.log(`FAIL ${name}\n  expected ${e}\n  actual   ${a}`);
  } else {
    console.log(`ok   ${name}`);
  }
}

// --- toRow: camel -> snake, undefined -> null, ownership ---------------------
const subjectSpec = specFor('subjects');
const userId = '11111111-1111-4111-8111-111111111111';
const row = toRow(
  subjectSpec,
  {
    id: '22222222-2222-4222-8222-222222222222',
    ts: {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Operating Systems',
      category: 'core-cs',
      color: '#b07a4a',
      priority: 'high',
      difficulty: 'hard',
      archived: false,
      order: 2,
      description: undefined,
      weeklyTargetHours: 5,
    },
  },
);
check('toRow.id', row.id, '22222222-2222-4222-8222-222222222222');
check('toRow never invents ownership (stampOwnership does that)', row.user_id, undefined);
check('toRow undefined optional becomes null', row.description, null);
check('toRow target_date is null when unset', row.target_date, null);
check('toRow weekly_target_hours', row.weekly_target_hours, 5);
check('toRow uses snake_case', row.next_revision_at, undefined);

// --- toRow: jsonb columns never go null -------------------------------------
const problemSpec = specFor('dsa_problems');
const problemRow = toRow(
  problemSpec,
  {
    id: '33333333-3333-4333-8333-333333333333',
    ts: { name: 'Koko Eating Bananas', difficulty: 'hard', solved: true, mastery: undefined },
  },
);
check('jsonb-ish column absent -> null', problemRow.key_insight, null);
check('flag default preserved', problemRow.solved, true);
check('nullable fk is null, not undefined', problemRow.module_id, null);

// --- fromRow: snake -> camel, defaults for non-optional, optionals dropped ----
const restored = fromRow(subjectSpec, {
  id: '22222222-2222-4222-8222-222222222222',
  user_id: userId,
  name: 'Operating Systems',
  category: 'core-cs',
  color: '#b07a4a',
  priority: 'high',
  difficulty: 'hard',
  target_date: null,
  weekly_target_hours: null,
  archived: false,
  archived_at: null,
  order: 2,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  description: null,
});
check('fromRow camelCase names', restored.name, 'Operating Systems');
check('fromRow null optional is dropped (not undefined-valued key)', 'description' in restored, false);
check('fromRow numeric from postgres', restored.weeklyTargetHours, undefined);
check('fromRow boolean', restored.archived, false);
check('fromRow quotes "order" back to order', restored.order, 2);
check('fromRow preserves ownership on read', restored.user_id, userId);

// A missing non-optional value falls back to the declared default rather than
// silently becoming undefined (which would break arithmetic downstream).
const defaulted = fromRow(problemSpec, { id: 'x', name: 'P', difficulty: 'medium' });
check('fromRow applies defaults for absent columns', defaulted.confidence, 0);
check('fromRow defaults boolean false', defaulted.mastered, false);

// --- child specs carry their parent FK through ------------------------------
const subtopicSpec = specFor('subtopics');
const subtopicEntity = {
  id: '44444444-4444-4444-8444-444444444444',
  ts: { id: '44444444-4444-4444-8444-444444444444', name: 'Scheduling', done: false, confidence: 0 },
  extra: { topic_id: '55555555-5555-4555-8555-555555555555' },
};
const subRow = toRow(subtopicSpec, subtopicEntity);
check('child row writes its parent fk', subRow.topic_id, '55555555-5555-4555-8555-555555555555');

const subRestored = fromRow(subtopicSpec, {
  id: subRow.id,
  user_id: userId,
  topic_id: '55555555-5555-4555-8555-555555555555',
  name: 'Scheduling',
  done: false,
  confidence: 2,
  notes: null,
  order: 0,
});
check('child row keeps parent fk on read (passThrough)', subRestored.topic_id, '55555555-5555-4555-8555-555555555555');
check('child row name restored', subRestored.name, 'Scheduling');

// --- ownership: the only producer of user_id --------------------------------
// This is the regression guard for the live 42501 failure: a settings row built
// with no owner anywhere in sight still has to leave the write path carrying the
// session's id, because `on_conflict=user_id` needs the conflict column present.
const settingsPayload = {
  name: 'Test User',
  target_role: 'SDE-1',
  graduation_year: 2027,
  daily_target_hours: 3,
  theme: 'dark',
};
const [ownedSettings] = stampOwnership([settingsPayload], userId);
check('stamped settings row carries the session user_id', ownedSettings.user_id, userId);
check('settings fields are otherwise untouched', ownedSettings.name, 'Test User');

const [ownedSubject] = stampOwnership([row], userId);
check('stamped entity row carries the session user_id', ownedSubject.user_id, userId);

// AppData must never be able to choose the owner.
const impostor = '99999999-9999-4999-8999-999999999999';
const [overridden] = stampOwnership([{ ...settingsPayload, user_id: impostor }], userId);
check('a user_id in the payload is overwritten, not trusted', overridden.user_id, userId);

const [sneakyExtra] = stampOwnership([toRow(subtopicSpec, { ...subtopicEntity, extra: { topic_id: '55555555-5555-4555-8555-555555555555', user_id: impostor } })], userId);
check('injected parent columns cannot set ownership', sneakyExtra.user_id, userId);
check('injected parent columns still work', sneakyExtra.topic_id, '55555555-5555-4555-8555-555555555555');

check('stampOwnership does not mutate its input', settingsPayload.user_id, undefined);

// --- ordering: every parent table must be written before its children --------
const order = COLLECTIONS.map((s) => s.table);
const mustPrecede = [
  ['subjects', 'topics'],
  ['topics', 'subtopics'],
  ['subtopics', 'checklist_items'],
  ['dsa_modules', 'dsa_topics'],
  ['dsa_topics', 'dsa_patterns'],
  ['dsa_modules', 'dsa_patterns'],
  ['dsa_problems', 'revisions'],
  ['roadmap_weeks', 'roadmap_tasks'],
  ['companies', 'company_checklist_items'],
  ['projects', 'activities'],
];
for (const [parent, child] of mustPrecede) {
  const ok = order.indexOf(parent) < order.indexOf(child);
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} order: ${parent} before ${child}`);
}

console.log('');
if (failures) {
  console.log(`${failures} failing assertion(s).`);
  process.exit(1);
}
console.log('All mapper assertions passed.');
