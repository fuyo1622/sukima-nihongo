import { create } from 'zustand';

import type { Session } from '@/engine/session';

import { loadJSON, removeKey, saveJSON } from './storage';

const KEY = 'session:v1';
/** An unfinished block older than this is dropped; its answers were already recorded. */
const MAX_AGE_MS = 3 * 24 * 3_600_000;

interface SessionStore {
  session: Session | null;
  hydrate: () => Promise<void>;
  /** Replaces the current block and saves it immediately. */
  set: (session: Session | null) => void;
}

export const useSession = create<SessionStore>()((set) => ({
  session: null,
  hydrate: async () => {
    const saved = await loadJSON<Session>(KEY);
    if (saved?.v === 1 && Date.now() - saved.updatedAt < MAX_AGE_MS) set({ session: saved });
    else if (saved) removeKey(KEY);
  },
  set: (session) => {
    set({ session });
    if (session) saveJSON(KEY, session);
    else removeKey(KEY);
  },
}));
