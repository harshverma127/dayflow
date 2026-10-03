import { useEffect, useState } from 'react';
import { useStore } from '@/store';

/**
 * True once zustand/persist has finished reading persisted state. Because the
 * store now hydrates from IndexedDB (asynchronously) we gate the UI so the app
 * never flashes an empty workspace before the saved data arrives.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useStore.persist.hasHydrated());

  useEffect(() => {
    setHydrated(useStore.persist.hasHydrated());
    const unsubFinish = useStore.persist.onFinishHydration(() => setHydrated(true));
    return () => unsubFinish();
  }, []);

  return hydrated;
}
