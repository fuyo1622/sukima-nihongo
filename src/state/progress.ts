import { create } from 'zustand';

import { typeOfId } from '@/content';
import { ITEM_TYPES, type ItemType } from '@/content/types';
import { emptyProgress, type ProgressData } from '@/engine/progress';
import type { CardState } from '@/engine/srs';

import { loadJSON, removeKey, saveJSON } from './storage';

// Cards are stored in one shard per item type, so an answer rewrites only a slice of the data.
const META_KEY = 'progress:meta:v1';
const cardsKey = (type: ItemType) => `progress:cards:${type}:v1`;

type Meta = Omit<ProgressData, 'cards'>;

function metaOf(p: ProgressData): Meta {
  return { v: p.v, ability: p.ability, days: p.days, placementDone: p.placementDone };
}

function shard(cards: Record<string, CardState>, type: ItemType): Record<string, CardState> {
  const out: Record<string, CardState> = {};
  for (const id in cards) if (typeOfId(id) === type) out[id] = cards[id];
  return out;
}

interface ProgressStore {
  data: ProgressData;
  hydrate: () => Promise<void>;
  /** Replaces the progress and persists the parts that changed. */
  commit: (next: ProgressData) => void;
  reset: () => void;
}

export const useProgress = create<ProgressStore>()((set, get) => ({
  data: emptyProgress(),
  hydrate: async () => {
    const [meta, ...shards] = await Promise.all([
      loadJSON<Meta>(META_KEY),
      ...ITEM_TYPES.map((t) => loadJSON<Record<string, CardState>>(cardsKey(t))),
    ]);
    if (!meta) return;
    const cards: Record<string, CardState> = Object.assign({}, ...shards.filter(Boolean));
    set({ data: { ...emptyProgress(), ...meta, cards } });
  },
  commit: (next) => {
    const prev = get().data;
    set({ data: next });
    if (next.cards !== prev.cards) {
      const changed = new Set<ItemType>();
      for (const id in next.cards) {
        if (next.cards[id] !== prev.cards[id]) {
          const type = typeOfId(id);
          if (type) changed.add(type);
        }
      }
      for (const type of changed) saveJSON(cardsKey(type), shard(next.cards, type));
    }
    saveJSON(META_KEY, metaOf(next));
  },
  reset: () => {
    set({ data: emptyProgress() });
    removeKey(META_KEY);
    for (const type of ITEM_TYPES) removeKey(cardsKey(type));
  },
}));
