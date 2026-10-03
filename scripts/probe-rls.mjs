// Read-only connectivity/RLS probe against the configured Supabase project.
// Makes NO writes: it only asks what an anonymous request is allowed to see,
// which confirms (a) the project is reachable and (b) RLS is actually enabled.
//
// Run with: node scripts/probe-rls.mjs
// Prints no key material — only status codes and row counts.
import { readFileSync } from 'node:fs';

function readEnv(file) {
  const out = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line.trim());
    if (match && !line.trim().startsWith('#')) out[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

const env = readEnv(new URL('../.env.local', import.meta.url));
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.log('SKIP: .env.local has no Supabase URL/key.');
  process.exit(2);
}

async function get(path, extraHeaders = {}) {
  const res = await fetch(`${url}${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, ...extraHeaders },
  });
  const text = await res.text();
  return { status: res.status, body: text.slice(0, 300) };
}

// PostgREST answers 200 with an empty array when RLS filters everything out, so
// the row count is the real signal here — not the status code.
for (const table of ['settings', 'subjects']) {
  const { status, body } = await get(`/rest/v1/${table}?select=id&limit=5`);
  let detail = body.replace(/\s+/g, ' ');
  try {
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed)) detail = `${parsed.length} row(s) visible`;
  } catch {
    /* keep the raw text */
  }
  console.log(`anon select ${table}: HTTP ${status} — ${detail}`);
}

const auth = await get('/auth/v1/settings');
console.log(`auth settings endpoint: HTTP ${auth.status}`);