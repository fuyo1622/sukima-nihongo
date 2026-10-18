import { LEVELS, type Level } from '../content/types';

/**
 * Difficulty bands on the shared 0–1000 scale. Item difficulty `d` and learner ability θ
 * live on the same scale, so "θ = 420" reads as "comfortable with early-to-mid N4 material".
 */
export const LEVEL_BANDS: Record<Level, readonly [number, number]> = {
  kana: [0, 150],
  N5: [150, 350],
  N4: [350, 500],
  N3: [500, 650],
  N2: [650, 800],
  N1: [800, 1000],
};

export const LEVEL_INFO: Record<Level, { label: string; title: string; desc: string }> = {
  kana: { label: '入門', title: '五十音', desc: '平假名與片假名，日語的第一步' },
  N5: { label: 'N5', title: '基礎入門', desc: '看得懂假名和基本漢字寫成的簡單句子' },
  N4: { label: 'N4', title: '基礎', desc: '能理解日常生活中基本的日語' },
  N3: { label: 'N3', title: '中級', desc: '能大致理解日常場合使用的日語' },
  N2: { label: 'N2', title: '中高級', desc: '能理解日常與較廣泛場合的日語，常見的職場門檻' },
  N1: { label: 'N1', title: '高級', desc: '能理解各種場合的日語，包含報紙社論與抽象文章' },
};

export function levelForTheta(theta: number): Level {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (theta >= LEVEL_BANDS[LEVELS[i]][0]) return LEVELS[i];
  }
  return 'kana';
}

/** Position of θ inside its level band, 0–1 (for "N4 · 40%" style displays). */
export function progressInLevel(theta: number): number {
  const [lo, hi] = LEVEL_BANDS[levelForTheta(theta)];
  return Math.min(1, Math.max(0, (theta - lo) / (hi - lo)));
}

export function nextLevel(level: Level): Level | undefined {
  return LEVELS[LEVELS.indexOf(level) + 1];
}
