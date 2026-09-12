/**
 * 決定的な擬似乱数。
 *
 * 都市のレイアウトは「アーキタイプ ID から導かれた固定シード」だけを入力に生成される。
 * したがって同じアーキタイプの都市は、いつ・誰が・どちらのビルドで見ても完全に同一になる。
 * Math.random() は本プロジェクトのどこでも使用してはならない。
 */

/** FNV-1a 32bit。文字列 → 安定した符号なし整数。 */
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export interface Rng {
  /** 0..1 */
  next(): number;
  /** min..max */
  range(min: number, max: number): number;
  /** min..max の整数 */
  int(min: number, max: number): number;
  /** 確率 p で true */
  chance(p: number): boolean;
  /** 配列から 1 つ選ぶ */
  pick<T>(items: readonly T[]): T;
}

/** mulberry32 — 小さく高速で、同一シードで必ず同一列を返す。 */
export function createRng(seed: number | string): Rng {
  let state = (typeof seed === 'string' ? hashString(seed) : seed >>> 0) || 0x9e3779b9;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => Math.floor(min + (max - min + 1) * next()),
    chance: (p) => next() < p,
    pick: (items) => {
      if (items.length === 0) throw new Error('空の配列からは選べません');
      return items[Math.floor(next() * items.length)]!;
    },
  };
}

/** 数値を 0..1 に丸める。 */
export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
