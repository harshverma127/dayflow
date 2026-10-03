import type { Difficulty } from '@/types';

// ---------------------------------------------------------------------------
// DSA bulk import
//
// Accepts a flat list of rows so both JSON and CSV can be normalised into the
// same shape. Every row is optional except the problem name — the module /
// topic / pattern hierarchy is created on demand. Nothing is auto-seeded.
// ---------------------------------------------------------------------------

export interface ImportedDsaRow {
  module?: string;
  topic?: string;
  pattern?: string;
  name: string;
  number?: string;
  platform?: string;
  url?: string;
  difficulty?: Difficulty;
  solved?: boolean;
  independent?: boolean;
  mastered?: boolean;
  needsRevision?: boolean;
  confidence?: number;
  notes?: string;
}

export interface DsaImportResult {
  problems: number;
  modules: number;
  topics: number;
  patterns: number;
  skipped: number;
  errors: string[];
}

const asString = (v: unknown): string | undefined => {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
};

const asBool = (v: unknown): boolean | undefined => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'solved', 'done'].includes(s)) return true;
    if (['false', '0', 'no', 'n', ''].includes(s)) return false;
  }
  return undefined;
};

const asDifficulty = (v: unknown): Difficulty | undefined => {
  const s = asString(v)?.toLowerCase();
  if (s === 'easy' || s === 'medium' || s === 'hard') return s;
  return undefined;
};

const asNumber = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/** Keys we accept, mapped from common header spellings. */
function normaliseKeys(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    const key = k.trim().toLowerCase().replace(/[\s_-]/g, '');
    out[key] = v;
  }
  return out;
}

export function rowFromRecord(input: Record<string, unknown>): { row?: ImportedDsaRow; error?: string } {
  const r = normaliseKeys(input);
  const name = asString(r.name ?? r.problem ?? r.title ?? r.question);
  if (!name) return { error: 'Missing a problem name (expected a "name" / "problem" / "title" column).' };
  const confidence = asNumber(r.confidence);
  const row: ImportedDsaRow = {
    name,
    module: asString(r.module ?? r.section ?? r.unit),
    topic: asString(r.topic ?? r.subtopic),
    pattern: asString(r.pattern ?? r.concept),
    number: asString(r.number ?? r.id ?? r.no),
    platform: asString(r.platform ?? r.site ?? r.source),
    url: asString(r.url ?? r.link),
    difficulty: asDifficulty(r.difficulty),
    solved: asBool(r.solved),
    independent: asBool(r.independent ?? r.independentsolve),
    mastered: asBool(r.mastered),
    needsRevision: asBool(r.needsrevision ?? r.revision),
    confidence: confidence === undefined ? undefined : Math.max(1, Math.min(5, Math.round(confidence))),
    notes: asString(r.notes),
  };
  return { row };
}

/** Accept an array of objects, or `{ problems: [...] }` / `{ rows: [...] }`. */
export function parseDsaJson(text: string): { rows: ImportedDsaRow[]; errors: string[] } {
  const errors: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { rows: [], errors: ['That file is not valid JSON.'] };
  }
  let list: unknown;
  if (Array.isArray(parsed)) list = parsed;
  else if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    list = obj.problems ?? obj.rows ?? obj.data ?? obj.items;
  }
  if (!Array.isArray(list)) return { rows: [], errors: ['Expected a JSON array of problems (or an object with a "problems" array).'] };
  const rows: ImportedDsaRow[] = [];
  list.forEach((item, i) => {
    if (!item || typeof item !== 'object') {
      errors.push(`Row ${i + 1}: not an object, skipped.`);
      return;
    }
    const { row, error } = rowFromRecord(item as Record<string, unknown>);
    if (error) errors.push(`Row ${i + 1}: ${error}`);
    else if (row) rows.push(row);
  });
  return { rows, errors };
}

/** Minimal CSV parser that handles quoted fields and embedded commas. */
export function parseDsaCsv(text: string): { rows: ImportedDsaRow[]; errors: string[] } {
  const errors: string[] = [];
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim().length);
  if (lines.length < 2) return { rows: [], errors: ['CSV needs a header row and at least one data row.'] };

  const splitLine = (line: string): string[] => {
    const cells: string[] = [];
    let cur = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else quoted = false;
        } else cur += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ',') {
        cells.push(cur);
        cur = '';
      } else cur += ch;
    }
    cells.push(cur);
    return cells;
  };

  const headers = splitLine(lines[0]).map((h) => h.trim());
  const rows: ImportedDsaRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
    const record: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      record[h] = cells[idx];
    });
    const { row, error } = rowFromRecord(record);
    if (error) errors.push(`Row ${i}: ${error}`);
    else if (row) rows.push(row);
  }
  return { rows, errors };
}

export function parseDsaFile(name: string, text: string): { rows: ImportedDsaRow[]; errors: string[] } {
  const lower = name.toLowerCase();
  if (lower.endsWith('.csv')) return parseDsaCsv(text);
  if (lower.endsWith('.json')) return parseDsaJson(text);
  return text.trim().startsWith('[') || text.trim().startsWith('{') ? parseDsaJson(text) : parseDsaCsv(text);
}

export const DSA_IMPORT_TEMPLATE = `Module,Topic,Pattern,Problem,Difficulty,Platform,URL,Solved
Arrays,Two Pointers,Sliding Window,Longest Substring Without Repeating Characters,medium,LeetCode,https://leetcode.com/problems/longest-substring-without-repeating-characters/,false
Arrays,Prefix Sum,Prefix Sum,Subarray Sum Equals K,medium,LeetCode,,false`;
