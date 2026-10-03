// ---------------------------------------------------------------------------
// Authentication (Supabase Email + Password).
//
// Everything here goes through the shared client and the shared error
// translator, so no raw database or auth error ever reaches the UI.
// ---------------------------------------------------------------------------

import type { Session, User } from '@supabase/supabase-js';
import { supabase, friendlyError, type FriendlyError } from './supabase';

// ---------------------------------------------------------------------------
// Session readiness
//
// The store's persistence adapter has to decide between "load from Supabase"
// and "load from IndexedDB", and it cannot make that call until Supabase has
// told us whether there is a session. Rather than guess, the adapter awaits
// `waitForAuthReady()`, which resolves on the first auth event (including the
// INITIAL_SESSION event supabase-js emits on start-up). That is what prevents
// both a flash of another user's data and a flash of an empty workspace.
// ---------------------------------------------------------------------------

let authReady = false;
const readyWaiters: (() => void)[] = [];

export function markAuthReady(): void {
  if (authReady) return;
  authReady = true;
  readyWaiters.splice(0).forEach((fn) => fn());
}

export function waitForAuthReady(): Promise<void> {
  if (authReady) return Promise.resolve();
  return new Promise<void>((resolve) => readyWaiters.push(resolve));
}

// ---------------------------------------------------------------------------
// Current session cache
//
// The auth provider is the only writer. Caching here lets non-React code (the
// storage adapter) read the user id synchronously instead of awaiting a
// network-free round trip through getSession().
// ---------------------------------------------------------------------------

let currentSession: Session | null = null;

export function setCurrentSession(session: Session | null): void {
  currentSession = session;
}

export function getCurrentSession(): Session | null {
  return currentSession;
}

export function getCurrentUser(): User | null {
  return currentSession?.user ?? null;
}

export function getCurrentUserId(): string | null {
  return currentSession?.user?.id ?? null;
}

/**
 * The authenticated user's id, resolved from the live Supabase session.
 *
 * This is the ONLY source of `user_id` in the app. Nothing in `AppData`, in a
 * React component or in a row mapper may supply ownership, so every user-owned
 * write asks for it here and stamps it in immediately before the request. That
 * is what keeps the `auth.uid() = user_id` RLS policies satisfiable without ever
 * exposing the id to a form field or hardcoding it.
 *
 * The synchronous session cache answers immediately in normal use. When it is
 * cold (a restored tab, a first write racing the first auth event) we re-ask
 * the auth server, which is also the strongest check available: `getUser()`
 * validates the token rather than trusting local storage.
 */
export async function requireUserId(): Promise<string> {
  const cached = getCurrentUserId();
  if (cached) return cached;

  const { data, error } = await supabase.auth.getUser();
  const user = data?.user;
  if (error && !user) throw new Error('Could not verify your session. Sign in again.');
  if (!user) throw new Error('Not authenticated');

  // `getUser()` hands back the validated user only, so there is no session to
  // cache here; the id itself is what callers need.
  return user.id;
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

export interface AuthOutcome {
  error?: FriendlyError;
  /** Present when the user must confirm their email before signing in. */
  needsEmailConfirmation?: boolean;
  /** Only populated when the profile returned by Supabase is non-empty. */
  email?: string;
}

export async function signUp(email: string, password: string): Promise<AuthOutcome> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) return { error: friendlyError(error) };
  // When email confirmation is on, `session` is null until the link is used.
  if (!data.session) return { needsEmailConfirmation: true, email: email.trim() };
  setCurrentSession(data.session);
  return { email: data.user?.email ?? email.trim() };
}

export async function signIn(email: string, password: string): Promise<AuthOutcome> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) return { error: friendlyError(error) };
  setCurrentSession(data.session);
  return { email: data.user?.email ?? email.trim() };
}

export async function signOut(): Promise<FriendlyError | undefined> {
  const { error } = await supabase.auth.signOut();
  setCurrentSession(null);
  return error ? friendlyError(error) : undefined;
}

export async function sendPasswordReset(email: string): Promise<FriendlyError | undefined> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: window.location.origin,
  });
  return error ? friendlyError(error) : undefined;
}

/** Called after the recovery link has been followed and a session exists. */
export async function updatePassword(password: string): Promise<FriendlyError | undefined> {
  const { error } = await supabase.auth.updateUser({ password });
  return error ? friendlyError(error) : undefined;
}

export async function resendConfirmation(email: string): Promise<FriendlyError | undefined> {
  const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
  return error ? friendlyError(error) : undefined;
}
