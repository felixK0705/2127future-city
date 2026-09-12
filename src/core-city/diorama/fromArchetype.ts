import { mix, shade } from '../color';
import type { Archetype, TimeOfDay } from '../types';
import type {
  DioramaConfig,
  DioramaLandmarkConfig,
  DioramaLandmarkKind,
  DioramaMood,
  DioramaPalette,
  DioramaTraits,
} from './types';

/**
 * 16 アーキタイプ → ジオラマ設定への変換。
 *
 * アーキタイプ側の配色は暗い夜景を前提にしているため、そのままでは使わない。
 * **明るいジオラマの規則（白〜ライトグレー基調＋アクセント 2 色）へ翻訳する**のがここの役割で、
 * 色相と気配だけを引き継ぎ、明度は常に明るい側へ寄せる。
 *
 * 街の「つくり」は 4 つの選択の傾き（traits）から決める。
 * 目印も傾きから選ぶので、同じ選択の組み合わせは必ず同じ目印の組み合わせになり、
 * 違う組み合わせは一目で違う街に見える。
 */

/** 傾きの強さ。どの街も「はっきりそちら側」に見えるよう、大きめに振る。 */
const LEAN = 0.85;

/** 時刻 → ムード。暗さではなく色味の傾きとして扱う。 */
const MOOD_BY_TIME: Record<TimeOfDay, DioramaMood> = {
  noon: 'daylight',
  dawn: 'warm',
  dusk: 'dusk',
  overcast: 'cool',
  night: 'cool',
};

/** 明度を確保しつつ色相を残す。 */
function lighten(color: string, amount: number): string {
  return mix(color, '#ffffff', amount);
}

/** アクセントは彩度を保ちたいので、明るすぎる場合だけ少し沈める。 */
function accentOf(color: string): string {
  return shade(color, -0.08);
}

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

function buildPalette(archetype: Archetype): DioramaPalette {
  const source = archetype.visual.palette;
  return {
    platformTop: lighten(source.fog, 0.88),
    platformEdge: lighten(source.fog, 0.72),
    platformUnder: lighten(source.fog, 0.52),
    buildingLight: lighten(source.fog, 0.95),
    buildingMid: lighten(source.mid, 0.82),
    // ガラスはわずかに青緑へ寄せ、2127 年の外装らしい冷たい光沢にする
    buildingGlass: mix(lighten(source.accent, 0.68), '#bfe8ff', 0.35),
    roof: lighten(source.near, 0.74),
    accentPrimary: accentOf(source.accent),
    accentSecondary: accentOf(source.glow),
    foliage: lighten(source.foliage, 0.08),
    foliageDeep: shade(source.foliage, -0.22),
    road: lighten(source.fog, 0.76),
    water: lighten(source.sun, 0.5),
    shadow: shade(source.fog, -0.35),
    cloud: '#ffffff',
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

  if (central) add('aiCore', [4, 4], expanding ? 1.1 : 0.92, 'primary');

  if (expanding) {
    add('skyTether', central ? [7, 1] : [4, 4], central ? 0.86 : 1.05, central ? 'secondary' : 'primary');
  } else {
    add('arcology', central ? [1, 7] : [4, 4], central ? 0.82 : 1.0, central ? 'secondary' : 'primary');
  }

  if (open) add('vertiport', central ? [7, 7] : [1, 1], 0.85, 'secondary');

  if (!central) {
    // 分散: 地区ごとに電源を持つ
    add('solarTree', [2, 6], 1, 'secondary');
    add('solarTree', [6, 2], 1, 'secondary');
    add('solarTree', [7, 6], 0.9, 'secondary');
  }

  if (!expanding) {
    add('windTurbine', [8, 2], 1, 'none');
    add('windTurbine', [0, 5], 0.92, 'none');
  }

  if (managed) {
    add('watchPylon', [3, 1], 1, 'primary');
    add('watchPylon', [5, 7], 1, 'primary');
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

  return {
    id: `archetype-${archetype.id}`,
    // 背景は空の色を大きく持ち上げた、明るい単色フィールド
    background: lighten(archetype.visual.palette.skyMid, 0.74),
    palette: buildPalette(archetype),
    mood: MOOD_BY_TIME[lighting.timeOfDay],
    landmarks: buildLandmarks(archetype, traits),
    density: 0.42 + skyline.density * 0.36,
    // 持続の街は緑が多く、拡張の街は少ない
    greenery: Math.min(0.95, Math.max(0.15, 0.25 + skyline.greenery * 0.5 - traits.growth * 0.18)),
    props: true,
    clouds: true,
    // 粒子の多い気象のときだけ、控えめにきらめきを足す
    sparkles: weather.density > 0.7,
    traits,
  };
}
