import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';
import { AuthProvider } from '@/services/AuthProvider';
import '@/index.css';

// Dayflow starts from an empty workspace. Supabase is the source of truth once
// you are signed in; before that (or while offline) the IndexedDB cache backs
// the store. Nothing here seeds sample content.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
