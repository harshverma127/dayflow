// ---------------------------------------------------------------------------
// Supabase client — the ONE place a SupabaseClient is constructed.
//
// Credentials come from `import.meta.env` and are never hardcoded. Only the
// publishable (public) key belongs here: it is safe to ship to the browser
// precisely because Row Level Security decides what a caller may read or
// write. The `service_role` key must never appear in frontend code — it
// bypasses RLS and would hand every user's data to anyone with dev tools.
// ---------------------------------------------------------------------------

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** True when both required variables are present and non-empty. */
export const isSupabaseConfigured: boolean = Boolean(url && publishableKey);

/**
 * Human-readable description of what is missing, for the setup screen.
 * Never echoes the values themselves.
 */
export const configProblem: string | null = !isSupabaseConfigured
  ? !url && !publishableKey
    ? 'Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local'
    : !url
      ? 'Set VITE_SUPABASE_URL in .env.local'
      : 'Set VITE_SUPABASE_PUBLISHABLE_KEY in .env.local'
  : null;

/**
 * A single shared client. When the app is not configured we still create one
 * against a placeholder host so that importing this module never throws and
 * modules can call `isSupabaseConfigured` first. Supabase's auth client needs
 * a URL at construction time.
 */
export const supabase: SupabaseClient = createClient(
  isSupabaseConfigured ? (url as string) : 'https://placeholder.invalid',
  isSupabaseConfigured ? (publishableKey as string) : 'placeholder',
  {
    auth: {
      // Session lives in localStorage so it survives a reload (spec §25).
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  },
);

// ---------------------------------------------------------------------------
// Error translation
//
// Raw PostgREST errors leak schema details ("duplicate key value violates
// unique constraint \"...\"" / "new row violates row-level security policy")
// into the UI. Every service funnels its errors through `friendlyError` so the
// user sees a sentence they can act on, and the underlying code is preserved
// for logging.
// ---------------------------------------------------------------------------

export interface FriendlyError {
  message: string;
  /** PostgREST `code`, or 'network' / 'unknown'. Useful for branching. */
  code: string;
  /** True when retrying later could plausibly succeed. */
  retryable: boolean;
}

const RLS_CODES = new Set(['42501', 'PGRST301', 'PGRST302']);

/** Maps a PostgREST / Auth / network error onto a user-facing message. */
export function friendlyError(error: unknown): FriendlyError {
  if (!error) return { message: 'Something went wrong.', code: 'unknown', retryable: false };

  // supabase-js network failures surface as a plain TypeError from fetch.
  if (error instanceof TypeError) {
    return {
      message: 'Cannot reach the server. Check your connection and retry.',
      code: 'network',
      retryable: true,
    };
  }

  const raw = error as { code?: string; message?: string; status?: number; name?: string };

  // Auth errors carry their own codes.
  if (raw.code === 'invalid_credentials') {
    return { message: 'That email and password combination is not correct.', code: raw.code, retryable: false };
  }
  if (raw.code === 'email_not_confirmed') {
    return { message: 'Confirm your email address first — check your inbox for the link.', code: raw.code, retryable: false };
  }
  if (raw.code === 'user_already_exists') {
    return { message: 'An account already exists for that email.', code: raw.code, retryable: false };
  }
  if (raw.code === 'weak_password') {
    return { message: 'Choose a stronger password (at least 8 characters).', code: raw.code, retryable: false };
  }
  if (raw.code === 'over_request_rate_limit' || raw.code === 'over_email_send_rate_limit') {
    return { message: 'Too many attempts. Wait a moment and try again.', code: raw.code, retryable: true };
  }
  if (raw.code === 'otp_expired') {
    return { message: 'That link has expired. Request a new one.', code: raw.code, retryable: false };
  }

  const code = raw.code ?? '';
  if (RLS_CODES.has(code)) {
    return {
      message: 'You do not have access to that record.',
      code,
      retryable: false,
    };
  }
  if (code === 'PGRST116') {
    return { message: 'That record no longer exists.', code, retryable: false };
  }
  if (code === '23505') {
    return { message: 'That already exists.', code, retryable: false };
  }
  if (code === '23503') {
    return { message: 'This record refers to something that no longer exists.', code, retryable: false };
  }
  if (code === '23514') {
    return { message: 'Some values are not allowed for that field.', code, retryable: false };
  }
  if (code === '23502') {
    return { message: 'A required field is missing.', code, retryable: false };
  }
  if (code.startsWith('08') || code === '57014' || raw.status === 0) {
    return { message: 'Cannot reach the server. Check your connection and retry.', code: code || 'network', retryable: true };
  }

  return {
    message: 'Something went wrong saving your data.',
    code: code || 'unknown',
    retryable: false,
  };
}

/** Narrow helper so callers can `throw new Error(friendlyError(e).message)`. */
export function errorMessage(error: unknown): string {
  return friendlyError(error).message;
}
