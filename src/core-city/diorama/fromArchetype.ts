import type { Archetype, TimeOfDay } from '../types';
import { accentForArchetype, premiumPalette, studioBackground } from './accent';
import type {
  DioramaConfig,
  DioramaLandmarkConfig,
  DioramaLandmarkKind,
  DioramaMood,
  DioramaTraits,
} from './types';

/**
 * 16 アーキタイプ → ジオラマ設定への変換。
 *
 * アーキタイプ側の配色は暗い夜景を前提にしているため、**一切使わない**。
 * ジオラマは常に「白い建築可視化」で、
 * 色は accent.ts が都市ごとに 1 系統だけ与える（→ premiumPalette）。
 *
 * 街の「つくり」は 4 つの選択の傾き（traits）から決める。
 * 目印も傾きから選ぶので、同じ選択の組み合わせは必ず同じ目印の組み合わせになり、
 * 違う組み合わせは一目で違う街に見える。
 */

/** 傾きの強さ。どの街も「はっきりそちら側」に見えるよう、大きめに振る。 */
const LEAN = 1;

/** 時刻 → ムード。暗さではなく色味の傾きとして扱う。 */
const MOOD_BY_TIME: Record<TimeOfDay, DioramaMood> = {
  noon: 'daylight',
  dawn: 'warm',
  dusk: 'dusk',
  overcast: 'cool',
  night: 'cool',
};

/**
 * アーキタイプの内部 ID（4 文字の極コード）から傾きを取り出す。
 * ID は UI に出さないが、ここでは街のつくりを決める種として使う。
 */
export function archetypeTraits(archetype: Archetype): DioramaTraits {
  const code = archetype.id;
  const lean = (index: number, positive: string): number => (code[index] === positive ? LEAN : -LEAN);
  return {
    openness: lean(0, 'O'),
    governance: lean(1, 'F'),
    growth: lean(2, 'E'),
    power: lean(3, 'C'),
  };
}

/**
 * 傾きから目印を選ぶ。先に置いたものほど希望の区画を取りやすいので、大きなものから並べる。
 *
 *   集中 → 中央に中枢塔 / 分散 → 地区ごとの太陽光の樹
 *   拡張 → 軌道エレベーター / 持続 → 温室ドームと風力タービン
 *   開く → 空の港
 *   管理 → 監視塔
 */
function buildLandmarks(archetype: Archetype, traits: DioramaTraits): DioramaLandmarkConfig[] {
  const central = traits.power > 0;
  const expanding = traits.growth > 0;
  const open = traits.openness > 0;
  const managed = traits.governance < 0;

  const list: DioramaLandmarkConfig[] = [];
  const add = (
    kind: DioramaLandmarkKind,
    lot: readonly [number, number],
    scale: number,
    accent: 'primary' | 'secondary' | 'none',
  ): void => {
    list.push({ id: `${archetype.id}-lm${list.length}`, kind, lot, scale, accent });
  };

  if (central) add('aiCore', [4, 4], expanding ? 1.22 : 1.0, 'primary');

  if (expanding) {
    add('skyTether', central ? [7, 1] : [4, 4], central ? 0.98 : 1.18, central ? 'secondary' : 'primary');
  } else {
    add('arcology', central ? [1, 7] : [4, 4], central ? 0.9 : 1.12, central ? 'secondary' : 'primary');
  }

  if (open) {
    add('vertiport', central ? [7, 7] : [1, 1], expanding ? 1.05 : 0.88, 'secondary');
    if (expanding) add('vertiport', [1, 7], 0.78, 'none');
  }

  if (!central) {
    add('solarTree', [2, 6], 1.08, 'secondary');
    add('solarTree', [6, 2], 1.08, 'secondary');
    add('solarTree', [7, 6], 0.98, 'secondary');
    if (!expanding) add('solarTree', [1, 3], 0.86, 'none');
  }

  if (!expanding) {
    add('windTurbine', [8, 2], 1.08, 'none');
    add('windTurbine', [0, 5], 1.0, 'none');
    if (open) add('windTurbine', [8, 7], 0.86, 'none');
  }

  if (managed) {
    add('watchPylon', [3, 1], 1.1, 'primary');
    add('watchPylon', [5, 7], 1.1, 'primary');
    if (!open) add('watchPylon', [8, 4], 0.92, 'secondary');
  }

  return list;
}

/**
 * アーキタイプからジオラマ設定を作る。
 * 完全に決定的なので、同じアーキタイプなら常に同じ街になる。
 */
export function archetypeToDiorama(archetype: Archetype): DioramaConfig {
  const { skyline, lighting, weather } = archetype.visual;
  const traits = archetypeTraits(archetype);
  const cityAccent = accentForArchetype(archetype.id);

  return {
    id: `archetype-${archetype.id}`,
    // 背景はスタジオのホリゾント（白〜ライトグレー）。空の演出はしない
    background: studioBackground(cityAccent),
    palette: premiumPalette(cityAccent),
    mood: MOOD_BY_TIME[lighting.timeOfDay],
    landmarks: buildLandmarks(archetype, traits),
    // 密度と緑量は結果ごとの差が一目でわかるまで振り幅を取る
    density: Math.min(0.96, Math.max(0.16, 0.24 + skyline.density * 0.52 + traits.growth * 0.18)),
    greenery: Math.min(0.92, Math.max(0.04, 0.08 + skyline.greenery * 0.74 - traits.growth * 0.38 + (traits.openness > 0 ? 0.04 : -0.02))),
    props: true,
    clouds: true,
    // 粒子の多い気象のときだけ、控えめにきらめきを足す
    sparkles: weather.density > 0.7,
    traits,
  };
}
