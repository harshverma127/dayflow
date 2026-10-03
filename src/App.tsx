import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/Layout';
import { Spinner, ToastProvider } from '@/components/ui';
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

function PageFallback() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <Spinner />
    </div>
  );
}

export function App() {
  const hydrated = useHydrated();

  // The workspace is stored in IndexedDB and hydrates asynchronously. Hold the
  // first paint until it is ready so users never see a flash of empty state.
  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-3 text-content-muted">
          <Spinner />
          <span className="text-xs">Loading your workspace…</span>
        </div>
      </div>
    );
  }

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
      </BrowserRouter>
    </ToastProvider>
  );
}
