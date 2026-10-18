import { create } from 'zustand';

import type { Level } from '@/content/types';
import type { Focus } from '@/engine/blockBuilder';

import { loadJSON, saveJSON } from './storage';

export type BlockMinutes = 1 | 3 | 5;

export interface Settings {
  onboarded: boolean;
  /** 有聲模式. Off = no listening questions and nothing is played. */
  sound: boolean;
  autoPlay: boolean;
  speechRate: number;
  furigana: boolean;
  blockMinutes: BlockMinutes;
  /** Blocks per day. */
  dailyGoal: number;
  difficultyMode: 'auto' | 'manual';
  manualLevel: Level;
  focus: Focus;
  haptics: boolean;
  /** Move on automatically after a correct answer. */
  autoAdvance: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  onboarded: false,
  sound: true,
  autoPlay: true,
  speechRate: 1,
  furigana: true,
  blockMinutes: 3,
  dailyGoal: 3,
  difficultyMode: 'auto',
  manualLevel: 'N5',
  focus: { vocab: true, kanji: true, grammar: true },
  haptics: true,
  autoAdvance: true,
};

const KEY = 'settings:v1';

interface SettingsStore {
  settings: Settings;
  hydrate: () => Promise<void>;
  update: (patch: Partial<Settings>) => void;
}

export const useSettings = create<SettingsStore>()((set, get) => ({
  settings: DEFAULT_SETTINGS,
  hydrate: async () => {
    const saved = await loadJSON<Partial<Settings>>(KEY);
    if (saved) {
      set({ settings: { ...DEFAULT_SETTINGS, ...saved, focus: { ...DEFAULT_SETTINGS.focus, ...saved.focus } } });
    }
  },
  update: (patch) => {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    saveJSON(KEY, settings);
  },
}));
