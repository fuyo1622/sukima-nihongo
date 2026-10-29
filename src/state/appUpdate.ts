import { create } from 'zustand';

import { useProgress } from './progress';
import { useSettings } from './settings';

interface AppUpdateStore {
  /** The web app was updated since it last ran, and the learner's progress came along. */
  updated: boolean;
  dismiss: () => void;
}

export const useAppUpdate = create<AppUpdateStore>()((set) => ({
  updated: false,
  dismiss: () => set({ updated: false }),
}));

/**
 * Remembers which build is running (after the stores are loaded). When it differs from the last run
 * and there is progress, 今天 says the app was updated and the progress kept.
 */
export function noteBuild(build: string | null): void {
  if (!build) return;
  const { settings, update } = useSettings.getState();
  if (settings.lastBuild === build) return;
  const hasProgress = Object.keys(useProgress.getState().data.cards).length > 0;
  if (settings.lastBuild && hasProgress) useAppUpdate.setState({ updated: true });
  update({ lastBuild: build });
}
