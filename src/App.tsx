import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Compass, Database } from 'lucide-react';
import { AppShell } from '@/components/Layout';
import { Button, Card, Spinner, ToastProvider } from '@/components/ui';
import { CloudStatusBar } from '@/components/CloudStatusBar';
import { MigratePrompt } from '@/components/MigratePrompt';
import { useAuth } from '@/services/AuthProvider';
import { useHydrated } from '@/lib/useHydrated';

const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Roadmap = lazy(() => import('@/pages/Roadmap'));
const DSA = lazy(() => import('@/pages/DSA'));
const Subjects = lazy(() => import('@/pages/Subjects'));
const SubjectDetail = lazy(() => import('@/pages/SubjectDetail'));
const Planner = lazy(() => import('@/pages/Planner'));
const Revision = lazy(() => import('@/pages/Revision'));
const Projects = lazy(() => import('@/pages/Projects'));
const Interviews = lazy(() => import('@/pages/Interviews'));
const Applications = lazy(() => import('@/pages/Applications'));
const Analytics = lazy(() => import('@/pages/Analytics'));
const Notes = lazy(() => import('@/pages/Notes'));
const Journal = lazy(() => import('@/pages/Journal'));
const Review = lazy(() => import('@/pages/Review'));
const Archived = lazy(() => import('@/pages/Archived'));
const Settings = lazy(() => import('@/pages/Settings'));
const Auth = lazy(() => import('@/pages/Auth'));

function PageFallback() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <Spinner />
    </div>
  );
}

function BootScreen({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <div className="flex flex-col items-center gap-3 text-content-muted">
        <Spinner />
        <span className="text-xs">{label}</span>
      </div>
    </div>
  );
}

/**
 * Shown when the Supabase environment variables are missing. Without them the
 * app cannot authenticate or sync, so it explains exactly what to set instead
 * of failing with an empty login form. Local-only mode keeps the existing
 * IndexedDB workspace usable so `npm run dev` still works on a fresh clone.
 */
function SetupNotice({ problem, onContinue }: { problem: string; onContinue: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <Card className="w-full max-w-md p-6">
        <span className="mb-4 grid h-11 w-11 place-items-center rounded-2xl border border-border bg-surface-muted">
          <Database size={19} className="text-brand" aria-hidden />
        </span>
        <h1 className="text-base font-semibold tracking-tight text-content">Connect Supabase</h1>
        <p className="mt-2 text-sm leading-relaxed text-content-muted">
          Dayflow needs a Supabase project before it can sign you in or sync your data.
        </p>
        <ol className="mt-4 space-y-2 rounded-xl border border-border bg-surface-muted px-4 py-3 text-xs leading-relaxed text-content-muted">
          <li>1. Copy <code className="text-content">.env.example</code> to <code className="text-content">.env.local</code>.</li>
          <li>
            2. Fill in <code className="text-content">VITE_SUPABASE_URL</code> and{' '}
            <code className="text-content">VITE_SUPABASE_PUBLISHABLE_KEY</code> from Project Settings → API.
          </li>
          <li>
            3. Run <code className="text-content">supabase/migrations/20260101000000_initial_dayflow_schema.sql</code> in
            the Supabase SQL Editor.
          </li>
        </ol>
        <p className="mt-3 text-xs text-content-faint">{problem}.</p>
        <Button variant="secondary" className="mt-5 w-full justify-center" onClick={onContinue}>
          Continue in local mode
        </Button>
      </Card>
    </div>
  );
}

export function App() {
  const { status, localMode, configProblem, enterLocalMode } = useAuth();
  const hydrated = useHydrated();

  // Not configured yet: explain, and offer the pre-cloud local workspace.
  if (configProblem && !localMode) {
    return (
      <ToastProvider>
        <SetupNotice problem={configProblem} onContinue={enterLocalMode} />
      </ToastProvider>
    );
  }

  // Never render the protected app before the session is known — that is what
  // would otherwise flash one user's workspace at another (spec §5, §25).
  if (status === 'initialising') return <BootScreen label="Checking your session…" />;

  if (status === 'anonymous' && !localMode) {
    return (
      <ToastProvider>
        <Suspense fallback={<BootScreen label="Loading…" />}>
          <Auth />
        </Suspense>
      </ToastProvider>
    );
  }

  // Authenticated: the adapter is fetching the workspace from Supabase, which
  // is asynchronous, so hold the first paint until it lands.
  if (!hydrated) return <BootScreen label="Loading your workspace…" />;

  return (
    <ToastProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppShell>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/roadmap" element={<Roadmap />} />
              <Route path="/dsa" element={<DSA />} />
              <Route path="/subjects" element={<Subjects />} />
              <Route path="/subjects/:subjectId" element={<SubjectDetail />} />
              <Route path="/planner" element={<Planner />} />
              <Route path="/revision" element={<Revision />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/interviews" element={<Interviews />} />
              <Route path="/applications" element={<Applications />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/notes" element={<Notes />} />
              <Route path="/journal" element={<Journal />} />
              <Route path="/review" element={<Review />} />
              <Route path="/archived" element={<Archived />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </AppShell>
        <MigratePrompt />
        <CloudStatusBar />
      </BrowserRouter>
    </ToastProvider>
  );
}

/** Shown on first paint before React mounts, to avoid a white flash. */
export function StaticSplash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <Compass size={20} className="text-content-faint" aria-hidden />
    </div>
  );
}
