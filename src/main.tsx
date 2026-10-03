import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';
import '@/index.css';

// PrepTrack starts from an empty workspace. All data comes from the persisted
// store (IndexedDB, falling back to localStorage) or from user action — there
// is no seeding step here.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
