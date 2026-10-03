import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, configProblem, supabase } from './supabase';
import { getCurrentSession, markAuthReady, setCurrentSession } from './auth';
import { forgetCloudBaseline, clearPreCloudLocalSnapshot } from './cloudStorage';
import { resetCloudStatus, setCloudStatus } from './cloudStatus';
import { useStore } from '@/store';
import { createInitialData } from '@/data/seed';

export type AuthStatus = 'initialising' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  /** `initialising` until Supabase has told us whether a session exists. */
  status: AuthStatus;
  user: User | null;
  email: string | null;
  /** True after a password-recovery link has been followed. */
  recoveryMode: boolean;
  /** True when Supabase env vars are missing and the app is in local-only mode. */
  localMode: boolean;
  configProblem: string | null;
  enterLocalMode: () => void;
  exitRecoveryMode: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Resolves the Supabase session before anything protected is rendered.
 *
 * On a session *change* (not just on mount) the store is switched over:
 *   sign in  -> rehydrate, which re-runs the adapter and loads from Supabase
 *   sign out -> reset to an empty workspace so the previous user's records are
 *               never left in memory or in the IndexedDB cache
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('initialising');
  const [user, setUser] = useState<User | null>(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [localMode, setLocalMode] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      // No Supabase: skip straight to the local workspace. The adapter already
      // falls back to IndexedDB when it is not configured.
      setStatus('anonymous');
      markAuthReady();
      return;
    }

    let cancelled = false;
    // Identity of the session the store currently reflects, so we can tell a
    // genuine account switch from an unrelated token refresh.
    let appliedUserId: string | null = null;

    const applySession = (session: Session | null) => {
      if (cancelled) return;
      setCurrentSession(session);
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      const nextId = nextUser?.id ?? null;

      if (nextId !== appliedUserId) {
        const previousId = appliedUserId;
        appliedUserId = nextId;
        if (previousId && !nextId) {
          // Signing out: wipe the in-memory workspace and the local cache so a
          // signed-out visitor cannot see the previous account's data.
          forgetCloudBaseline();
          clearPreCloudLocalSnapshot();
          resetCloudStatus();
          useStore.setState({ ...createInitialData(), _history: [] });
        }
        if (nextId) {
          // Signing in (or switching accounts): reload from the new user's
          // rows through the same persistence adapter.
          void useStore.persist.rehydrate();
        }
      }

      setStatus(nextUser ? 'authenticated' : 'anonymous');
    };

    // Seed from any existing session so a refresh does not flash the
    // sign-in screen before the first auth event arrives.
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      applySession(data.session ?? null);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
      applySession(session ?? null);
      markAuthReady();
    });

    markAuthReady();

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const enterLocalMode = useCallback(() => {
    setLocalMode(true);
    setStatus('anonymous');
    markAuthReady();
    setCloudStatus({ state: 'local', pending: false });
  }, []);

  const exitRecoveryMode = useCallback(() => setRecoveryMode(false), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      email: user?.email ?? getCurrentSession()?.user.email ?? null,
      recoveryMode,
      localMode,
      configProblem,
      enterLocalMode,
      exitRecoveryMode,
    }),
    [status, user, recoveryMode, localMode, enterLocalMode, exitRecoveryMode],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
