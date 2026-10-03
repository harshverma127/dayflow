// Dev-time consistency check between the SQL migration and the TypeScript
// mapper. Run with: node scripts/check-schema-sync.cjs
//
// A typo in a snake_case column name would otherwise only appear as a runtime
// PostgREST error the first time a user edits a record, so it is worth
// catching statically.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20260101000000_initial_dayflow_schema.sql'), 'utf8');
const schemaTs = fs.readFileSync(path.join(root, 'src/services/schema.ts'), 'utf8');
const typesTs = fs.readFileSync(path.join(root, 'src/types.ts'), 'utf8');

// ---- 1. columns declared in the DDL -----------------------------------------
const sqlCols = {};
const tableRe = /create table if not exists public\.(\w+)\s*\(([\s\S]*?)\n\);/g;
let m;
while ((m = tableRe.exec(sql))) {
  const set = new Set();
  for (const rawLine of m[2].split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('--')) continue;
    const c = line.match(/^"?([a-z_]+)"?\s+[a-z]/i);
    if (c) set.add(c[1]);
  }
  sqlCols[m[1]] = set;
}

// ---- 2. columns the mapper writes -------------------------------------------
// Two spec shapes exist in schema.ts:
//   flat('subjects', 'subjects', [ ['name','name'], ... ], opts)
//   { key: 'topics', table: 'topics', cols: [ ['name','name'], ... ], ... }

/** Reads the balanced `[ ... ]` that starts at `from`, honouring quotes. */
function readBracketArray(src, from) {
  const start = src.indexOf('[', from);
  if (start < 0) return '';
  let depth = 0;
  let quote = null;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === quote && src[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '[') depth += 1;
    else if (ch === ']') {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return '';
}

const tsCols = {};

// flat('key', 'table', [ ... ])
const flatRe = /flat\(\s*'(\w+)'\s*,\s*'(\w+)'\s*,/g;
while ((m = flatRe.exec(schemaTs))) {
  tsCols[m[2]] = [...readBracketArray(schemaTs, m.index + m[0].length - 1).matchAll(/\['(\w+)',\s*'(\w+)'\]/g)].map((x) => ({
    camel: x[1],
    snake: x[2],
  }));
}

// { key: 'k', table: 't', cols: [ ... ] }
const objRe = /\{\s*\n\s*key:\s*'(\w+)',\s*\n\s*table:\s*'(\w+)',[\s\S]{0,40}?cols:\s*/g;
while ((m = objRe.exec(schemaTs))) {
  tsCols[m[2]] = [...readBracketArray(schemaTs, m.index + m[0].length).matchAll(/\['(\w+)',\s*'(\w+)'\]/g)].map((x) => ({
    camel: x[1],
    snake: x[2],
  }));
}

// ---- 3. every AppData collection must be mapped ------------------------------
const appDataBlock = (typesTs.match(/export interface AppData \{([\s\S]*?)\n\}/) || [, ''])[1];
const appDataKeys = [...appDataBlock.matchAll(/^\s{2}(\w+)[?:]/gm)].map((x) => x[1]);
const mappedKeys = new Set(
  [...schemaTs.matchAll(/flat\(\s*'(\w+)'/g)].map((x) => x[1]).concat([...schemaTs.matchAll(/key:\s*'(\w+)'/g)].map((x) => x[1])),
);

// ---- 4. report --------------------------------------------------------------
let bad = 0;
let checked = 0;

console.log(`SQL tables declared: ${Object.keys(sqlCols).length}`);
console.log(`Tables mapped in TS: ${Object.keys(tsCols).length}`);
console.log(`AppData collections: ${appDataKeys.length}`);
console.log('');

for (const [table, list] of Object.entries(tsCols)) {
  if (!sqlCols[table]) {
    console.log(`NO SUCH TABLE in SQL: ${table}`);
    bad += 1;
    continue;
  }
  for (const col of list) {
    checked += 1;
    if (!sqlCols[table].has(col.snake)) {
      console.log(`MISSING COLUMN ${table}.${col.snake}  (mapped from ${col.camel})`);
      bad += 1;
    }
  }
  for (const col of ['id', 'user_id']) {
    if (!sqlCols[table].has(col)) {
      console.log(`MISSING COLUMN ${table}.${col}`);
      bad += 1;
    }
  }
}

// `version` is a shape number, not a collection. `settings` / `dsaSource` are
// mapped by hand in cloud.ts, and `project_checklist_items` is keyed by
// (project_id, key) rather than by id, so all four are exempt here.
const HANDLED = new Set(['version', 'settings', 'dsaSource']);
for (const key of appDataKeys) {
  if (!mappedKeys.has(key) && !HANDLED.has(key)) {
    console.log(`AppData collection not mapped to a table: ${key}`);
    bad += 1;
  }
}

console.log('');
console.log(`Checked ${checked} mapped columns across ${Object.keys(tsCols).length} tables.`);
if (bad) {
  console.log(`RESULT: ${bad} problem(s).`);
  process.exit(1);
}
console.log('RESULT: schema and mapper agree.');
