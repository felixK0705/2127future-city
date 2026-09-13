import { clamp } from './rng';
import type { DioramaConfig, DioramaTraits } from './diorama/types';

/** 五項內容分數。接受 0..1 或 0..100；超出範圍的值會被截斷。 */
export interface DioramaMetricScores {
  readonly environment: number;
  readonly convenience: number;
  readonly diversity: number;
  readonly freedom: number;
  readonly equity: number;
}

const normalizeScore = (value: number): number => {
  const finite = Number.isFinite(value) ? value : 0;
  return clamp(Math.abs(finite) > 1 ? finite / 100 : finite, 0, 1);
};

/**
 * 依五項內容分數微調 Canvas2D 城市設定。
 *
 * 不使用亂數、不改動傳入物件，也不改變 config.id，因此相同輸入必定產生
 * 相同設定與相同的決定性版面。
 */
export function tuneDioramaWithScores(
  config: DioramaConfig,
  scores: DioramaMetricScores,
): DioramaConfig {
  const environment = normalizeScore(scores.environment);
  const convenience = normalizeScore(scores.convenience);
  const diversity = normalizeScore(scores.diversity);
  const freedom = normalizeScore(scores.freedom);
  const equity = normalizeScore(scores.equity);
  const traits: DioramaTraits = config.traits ?? {
    openness: 0,
    governance: 0,
    growth: 0,
    power: 0,
  };

  return {
    ...config,
    greenery: clamp((config.greenery ?? 0.5) + (environment - 0.5) * 0.62, 0, 1),
    density: clamp((config.density ?? 0.62) + (convenience - 0.5) * 0.26, 0, 1),
    trafficScale: 0.55 + convenience * 0.9,
    signageScale: 0.45 + diversity * 1.1,
    roofVariation: diversity,
    patina: freedom,
    irregularity: freedom,
    heightVariance: 1.25 - equity * 0.75,
    traits: {
      ...traits,
      governance: clamp(traits.governance + (freedom - 0.5) * 0.3, -1, 1),
    },
  };
}
