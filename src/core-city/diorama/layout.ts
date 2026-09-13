import { clamp, createRng, lerp, type Rng } from '../rng';
import type {
  BlockCrown,
  BlockForm,
  BlockMaterial,
  BlockRoof,
  BlockWindows,
  DioramaBlock,
  DioramaCloud,
  DioramaConduit,
  DioramaConfig,
  DioramaDrone,
  DioramaFigure,
  DioramaGuideway,
  DioramaLandmarkKind,
  DioramaLawn,
  DioramaLayout,
  DioramaMaglev,
  DioramaMood,
  DioramaPlatform,
  DioramaProp,
  DioramaRoad,
  DioramaSignal,
  DioramaSkybridge,
  DioramaSparkle,
  DioramaSurface,
  DioramaTraffic,
  DioramaTraits,
  DioramaTree,
  DioramaVehicle,
  DioramaWallSegment,
  PlacedDioramaLandmark,
  TreeKind,
} from './types';

/**
 * ジオラマのレイアウト生成。
 *
 * 入力は `DioramaConfig` だけで、出力は 2D / 3D 両レンダラが解釈する `DioramaLayout`。
 * 乱数は config.id を種にした決定的なものだけを使うため、
 * 同じ設定なら常に同じ街が組み上がる。
 *
 * 市民の選択の傾き（config.traits）は、街の「つくり」そのものに出す。
 *   閉じる → 外周の障壁と検問の門 / 開く → 空の港・往来の多さ
 *   管理 → 揃った格子・揃った高さ・監視機 / 自由 → 高さも形も色もまちまち
 *   拡張 → 高く密に・空中回廊・高架軌道 / 持続 → 低く・緑と太陽光と水
 *   集中 → 中心へ向かって高くなり、光の導管が集まる / 分散 → 平らで、屋上ごとに電源
 */

/** 1 辺の区画数。奇数にして中心区画を作る。 */
const GRID = 9;
/** 台座の厚み（半辺 = 1 に対する比） */
const THICKNESS = 0.15;

/** 目印の造形ごとの基準寸法（設置面の一辺・全高）。 */
const LANDMARK_SIZE: Record<DioramaLandmarkKind, { footprint: number; height: number }> = {
  signalTower: { footprint: 0.7, height: 1.05 },
  clockTower: { footprint: 0.62, height: 0.72 },
  domeHall: { footprint: 1.25, height: 0.46 },
  archGate: { footprint: 1.05, height: 0.5 },
  skyscraper: { footprint: 0.72, height: 0.92 },
  windmill: { footprint: 0.68, height: 0.6 },
  ferrisWheel: { footprint: 1.0, height: 0.78 },
  pagoda: { footprint: 0.8, height: 0.66 },
  aiCore: { footprint: 0.82, height: 1.0 },
  skyTether: { footprint: 0.8, height: 0.6 },
  arcology: { footprint: 1.2, height: 0.42 },
  windTurbine: { footprint: 0.2, height: 0.6 },
  solarTree: { footprint: 0.2, height: 0.26 },
  vertiport: { footprint: 0.92, height: 0.3 },
  watchPylon: { footprint: 0.18, height: 0.5 },
};

/**
 * ムードごとの微調整。
 * **配色とモチーフの偏りだけを変え、光の硬さには一切関与しない。**
 */
interface MoodTuning {
  readonly glassBias: number;
  readonly pitchedBias: number;
  readonly greenBonus: number;
  readonly waterChance: number;
  readonly carBias: number;
  readonly windows: BlockWindows;
}

const MOOD: Record<DioramaMood, MoodTuning> = {
  daylight: { glassBias: 0.16, pitchedBias: 0.2, greenBonus: 0, waterChance: 0.3, carBias: 1, windows: 'grid' },
  calm: { glassBias: 0.1, pitchedBias: 0.34, greenBonus: 0.18, waterChance: 0.45, carBias: 0.7, windows: 'bands' },
  cool: { glassBias: 0.3, pitchedBias: 0.08, greenBonus: -0.05, waterChance: 0.6, carBias: 0.9, windows: 'grid' },
  warm: { glassBias: 0.08, pitchedBias: 0.4, greenBonus: 0.1, waterChance: 0.25, carBias: 1.1, windows: 'bands' },
  dusk: { glassBias: 0.22, pitchedBias: 0.14, greenBonus: 0.02, waterChance: 0.35, carBias: 0.8, windows: 'grid' },
};

const NEUTRAL_TRAITS: DioramaTraits = { openness: 0, governance: 0, growth: 0, power: 0 };

type LotUse = 'free' | 'road' | 'landmark' | 'water';

function lotCenter(index: number, cell: number): number {
  return -1 + cell * (index + 0.5);
}

const pos = (value: number): number => Math.max(0, value);

function normalizeTraits(traits: DioramaTraits | undefined): DioramaTraits {
  const source = traits ?? NEUTRAL_TRAITS;
  return {
    openness: clamp(source.openness, -1, 1),
    governance: clamp(source.governance, -1, 1),
    growth: clamp(source.growth, -1, 1),
    power: clamp(source.power, -1, 1),
  };
}

/** 重みつきの選択（決定的）。 */
function weighted<T>(rng: Rng, entries: readonly (readonly [T, number])[]): T {
  const total = entries.reduce((sum, [, w]) => sum + Math.max(0, w), 0);
  let roll = rng.next() * total;
  for (const [value, w] of entries) {
    roll -= Math.max(0, w);
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1]![0];
}

function pickMaterial(
  rng: Rng,
  tuning: MoodTuning,
  height: number,
  traits: DioramaTraits,
  order: number,
  patina: number,
): BlockMaterial {
  const roll = rng.next();
  // 彩度の高い色は小さな建物にだけ、ごく少量。面積で使わない。
  if (height < 0.22 && roll > 0.97 && order < 0.5) {
    return rng.chance(0.6) ? 'accentSecondary' : 'accentPrimary';
  }
  const tint = pos(traits.governance) * 0.18 + patina * 0.06;
  if (roll < tint) return rng.chance(0.5) ? 'tintPrimary' : 'tintSecondary';
  const glass = tint + tuning.glassBias * 0.7 + (height > 0.4 ? 0.28 : 0.12) + pos(traits.growth) * 0.12;
  if (roll < glass) return 'glass';
  // 管理された街は白一色に揃う
  if (order > 0.6) return roll < 0.86 ? 'light' : 'mid';
  if (roll < 0.66) return 'light';
  return 'mid';
}

function pickRoof(
  rng: Rng,
  tuning: MoodTuning,
  height: number,
  traits: DioramaTraits,
  form: BlockForm,
  variation: number,
): BlockRoof {
  if (form === 'round') return rng.chance(0.4 + variation * 0.25) ? 'rounded' : 'flat';
  if (height > 0.42) {
    return rng.chance(0.35 + variation * 0.3)
      ? 'setback'
      : rng.chance(0.25 + variation * 0.35)
        ? 'stepped'
        : 'flat';
  }
  // 持続の街は、低い建物の屋根が太陽光の片流れになる
  if (rng.chance(tuning.pitchedBias * 0.4 + pos(-traits.growth) * 0.34 + variation * 0.18)) return 'pitched';
  if (rng.chance(0.1 + pos(traits.governance) * 0.12 + variation * 0.12)) return 'rounded';
  return 'flat';
}

function pickCrown(
  rng: Rng,
  traits: DioramaTraits,
  height: number,
  roof: BlockRoof,
  order: number,
): BlockCrown {
  if (roof === 'setback' || roof === 'stepped' || roof === 'pitched' || roof === 'rounded') return 'none';
  const sustain = pos(-traits.growth);
  const distributed = pos(-traits.power);
  return weighted<BlockCrown>(rng, [
    ['garden', 0.22 + sustain * 0.9],
    ['solar', 0.12 + sustain * 0.45 + distributed * 0.7],
    ['turbine', distributed * 0.55 + sustain * 0.12],
    ['pad', height > 0.26 ? 0.08 + pos(traits.openness) * 0.5 + pos(traits.growth) * 0.3 : 0],
    ['antenna', height > 0.2 ? 0.14 + pos(traits.power) * 0.25 : 0.02],
    ['scanner', order > 0.55 ? order * 0.8 : 0],
    ['none', 0.4],
  ]);
}

function pickTree(rng: Rng): { kind: TreeKind; size: number; tone: 0 | 1 } {
  const roll = rng.next();
  const kind: TreeKind = roll < 0.52 ? 'round' : roll < 0.82 ? 'cloud' : 'cone';
  return {
    kind,
    size: rng.range(0.058, 0.1) * (kind === 'cone' ? 0.9 : 1),
    tone: rng.chance(0.38) ? 1 : 0,
  };
}

/**
 * 外周の障壁。台座の縁（面取りした正方形）に沿って区間に分け、
 * 道路が縁を抜けるところだけを検問の門にする。
 */
function buildWall(
  inset: number,
  corner: number,
  height: number,
  roadX: number,
  roadZ: number,
  cell: number,
): DioramaWallSegment[] {
  const segments: DioramaWallSegment[] = [];
  const I = inset;
  const c = corner;
  let index = 0;
  const push = (x0: number, z0: number, x1: number, z1: number, gate: boolean): void => {
    segments.push({ id: `wall-${index}`, x0, z0, x1, z1, height, gate });
    index += 1;
  };

  /** 固定軸の上を from → to へ。gateAt の前後 cell/2 を門にする */
  const straight = (fixed: 'x' | 'z', value: number, from: number, to: number, gateAt: number): void => {
    const dir = Math.sign(to - from);
    const half = cell * 0.5;
    const cuts = [from, gateAt - dir * half, gateAt + dir * half, to];
    for (let k = 0; k < 3; k += 1) {
      const a = cuts[k]!;
      const b = cuts[k + 1]!;
      if ((b - a) * dir <= 0) continue;
      const gate = k === 1;
      const pieces = gate ? 1 : Math.max(1, Math.ceil(Math.abs(b - a) / 0.22));
      for (let p = 0; p < pieces; p += 1) {
        const s0 = a + ((b - a) * p) / pieces;
        const s1 = a + ((b - a) * (p + 1)) / pieces;
        if (fixed === 'z') push(s0, value, s1, value, gate);
        else push(value, s0, value, s1, gate);
      }
    }
  };

  straight('z', -I, -I + c, I - c, roadX);
  push(I - c, -I, I, -I + c, false);
  straight('x', I, -I + c, I - c, roadZ);
  push(I, I - c, I - c, I, false);
  straight('z', I, I - c, -I + c, roadX);
  push(-I + c, I, -I, I - c, false);
  straight('x', -I, I - c, -I + c, roadZ);
  push(-I, -I + c, -I + c, -I, false);
  return segments;
}

export function buildDioramaLayout(config: DioramaConfig): DioramaLayout {
  const rng = createRng(`diorama:${config.id}`);
  const tuning = MOOD[config.mood];
  const cell = 2 / GRID;
  const traits = normalizeTraits(config.traits);
  /** 管理の強さ 0（自由）..1（管理） */
  const irregularity = clamp(config.irregularity ?? 0, 0, 1);
  const patina = clamp(config.patina ?? 0, 0, 1);
  const roofVariation = clamp(config.roofVariation ?? 0.5, 0, 1);
  const signageScale = clamp(config.signageScale ?? 1, 0, 2);
  const trafficScale = clamp(config.trafficScale ?? 1, 0, 2);
  const heightVariance = clamp(config.heightVariance ?? 1, 0.25, 1.5);
  const order = clamp((1 - traits.governance) / 2 - irregularity * 0.22, 0, 1);
  const managed = order > 0.6;

  const density = clamp((config.density ?? 0.62) + traits.growth * 0.1, 0, 1);
  const greenery = clamp((config.greenery ?? 0.5) + tuning.greenBonus, 0, 1);
  const withProps = config.props ?? true;
  const withClouds = config.clouds ?? true;
  const withSparkles = config.sparkles ?? false;

  const platform: DioramaPlatform = {
    half: 1,
    thickness: THICKNESS,
    corner: cell * 0.55,
    cell,
    grid: GRID,
  };

  /* ---------------- 区画の用途を決める ---------------- */

  const use: LotUse[][] = Array.from({ length: GRID }, () =>
    Array.from({ length: GRID }, (): LotUse => 'free'),
  );

  // 道路: 縦横 1 本ずつ（中心を外して抜けを作る）。
  // 中枢塔を持つ街は、中心の 3×3 を塔のために空けておく。
  const roadChoices = traits.power > 0.2 ? [2, 6] : [2, 3, 5, 6];
  const roadCol = rng.pick(roadChoices);
  const roadRow = rng.pick(roadChoices);
  for (let i = 0; i < GRID; i += 1) {
    use[i]![roadCol] = 'road';
    use[roadRow]![i] = 'road';
  }

  // 水辺: 縁の 1 列を水面にすることがある（持続・開いた街ほど水が多い）。
  // 道路と重なる区画は水に沈めず「橋」として残し、道が途切れないようにする。
  const waterChance = clamp(
    tuning.waterChance + pos(-traits.growth) * 0.45 + traits.openness * 0.18,
    0,
    0.95,
  );
  let waterEdge: 'none' | 'north' | 'south' | 'east' | 'west' = 'none';
  const bridges = new Set<string>();
  if (rng.chance(waterChance)) {
    waterEdge = rng.pick(['north', 'south', 'east', 'west'] as const);
    for (let i = 0; i < GRID; i += 1) {
      const [r, c] =
        waterEdge === 'north'
          ? [0, i]
          : waterEdge === 'south'
            ? [GRID - 1, i]
            : waterEdge === 'west'
              ? [i, 0]
              : [i, GRID - 1];
      if (use[r]![c] === 'road') bridges.add(`${c},${r}`);
      else use[r]![c] = 'water';
    }
  }

  /** 中心 (row, col) から半径 span の正方形がすべて空いているか。 */
  const fits = (row: number, col: number, span: number): boolean => {
    for (let dr = -span; dr <= span; dr += 1) {
      for (let dc = -span; dc <= span; dc += 1) {
        const r = row + dr;
        const c = col + dc;
        if (r < 0 || r >= GRID || c < 0 || c >= GRID) return false;
        if (use[r]![c] !== 'free') return false;
      }
    }
    return true;
  };

  /** 希望の区画から近い順に、空いている置き場所を探す（決定的）。 */
  const findLot = (row: number, col: number, span: number): [number, number] | null => {
    for (let radius = 0; radius < GRID; radius += 1) {
      for (let dr = -radius; dr <= radius; dr += 1) {
        for (let dc = -radius; dc <= radius; dc += 1) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== radius) continue;
          if (fits(row + dr, col + dc, span)) return [row + dr, col + dc];
        }
      }
    }
    return null;
  };

  // 目印の区画を確保。道路・水面・他の目印とは決して重ねない
  // （重ねると道が途切れ、車が建物を突き抜けてしまう）。
  const landmarks: PlacedDioramaLandmark[] = [];
  for (const landmark of config.landmarks) {
    const wantCol = clamp(Math.round(landmark.lot[0]), 0, GRID - 1);
    const wantRow = clamp(Math.round(landmark.lot[1]), 0, GRID - 1);
    const size = LANDMARK_SIZE[landmark.kind];
    let scale = landmark.scale ?? 1;

    // 大きい造形は隣接区画も占有する。3×3 が取れなければ 1 区画に縮めて置く
    let span = size.footprint * scale > cell * 1.1 ? 1 : 0;
    let lot = findLot(wantRow, wantCol, span);
    if (!lot && span > 0) {
      span = 0;
      lot = findLot(wantRow, wantCol, 0);
      scale = Math.min(scale, 0.62);
    }
    if (!lot) continue;
    const [row, col] = lot;

    for (let dr = -span; dr <= span; dr += 1) {
      for (let dc = -span; dc <= span; dc += 1) {
        use[row + dr]![col + dc] = 'landmark';
      }
    }

    // 設置面は、確保した区画（1×1 または 3×3）の 9 割に必ず収める。
    // 収めないと大きなドームや観覧車の脚が隣の道路区画へはみ出し、車がその上を走ってしまう。
    const reserved = cell * (span * 2 + 1) * 0.9;
    landmarks.push({
      ...landmark,
      lot: [col, row],
      scale,
      x: lotCenter(col, cell),
      z: lotCenter(row, cell),
      footprint: Math.min(size.footprint * scale * cell * 2.6, reserved),
      height: size.height * scale,
    });
  }

  /* ---------------- 面（道路・広場・水面） ---------------- */

  const surfaces: DioramaSurface[] = [];
  for (let row = 0; row < GRID; row += 1) {
    for (let col = 0; col < GRID; col += 1) {
      const lot = use[row]![col]!;
      if (lot === 'road') {
        const onColumn = col === roadCol;
        const onRow = row === roadRow;
        surfaces.push({
          id: `road-${col}-${row}`,
          kind: 'road',
          orientation: onColumn && onRow ? 'cross' : onColumn ? 'ns' : 'ew',
          bridge: bridges.has(`${col},${row}`),
          x: lotCenter(col, cell),
          z: lotCenter(row, cell),
          width: cell,
          depth: cell,
        });
      } else if (lot === 'water') {
        surfaces.push({
          id: `water-${col}-${row}`,
          kind: 'water',
          x: lotCenter(col, cell),
          z: lotCenter(row, cell),
          width: cell,
          depth: cell,
        });
      }
    }
  }

  /* ---------------- 建物・公園・広場 ---------------- */

  const blocks: DioramaBlock[] = [];
  const trees: DioramaTree[] = [];
  const lawns: DioramaLawn[] = [];
  /** 区画ごとに何を置いたか（並木を植えてよい場所の判定に使う） */
  const lotContent = new Map<string, 'park' | 'plaza' | 'block'>();
  const center = (GRID - 1) / 2;
  const maxDist = Math.hypot(center, center);

  // 拡張の街は高く、持続の街は低く抑える
  const heightCap = clamp(0.46 + traits.growth * 0.36, 0.22, 0.9);
  // 集中の街は中心へ急に高くなり、分散の街は高さが平らに揃う
  const falloff = traits.power >= 0 ? 1.7 + traits.power * 1.7 : 1.35 + traits.power * 1.15;
  const flatten = pos(-traits.power) * 0.62;
  // 高さのばらつき（自由ほど大きく、管理ほど小さい）
  const spreadLow = lerp(0.4, 0.88, order);
  const spreadHigh = lerp(1.25, 0.98, order);

  for (let row = 0; row < GRID; row += 1) {
    for (let col = 0; col < GRID; col += 1) {
      if (use[row]![col] !== 'free') continue;

      const x = lotCenter(col, cell);
      const z = lotCenter(row, cell);
      const dist = Math.hypot(col - center, row - center) / maxDist;
      const roll = rng.next();

      // 縁に近いほど緑地になりやすい
      const parkChance = greenery * (0.2 + dist * 0.45);
      if (roll < parkChance) {
        lotContent.set(`${col},${row}`, 'park');
        lawns.push({ id: `lawn-${col}-${row}`, x, z, width: cell * 0.92, depth: cell * 0.92 });
        const count = rng.int(2, 4);
        for (let i = 0; i < count; i += 1) {
          const tree = pickTree(rng);
          trees.push({
            id: `tree-${col}-${row}-${i}`,
            x: x + rng.range(-cell * 0.32, cell * 0.32),
            z: z + rng.range(-cell * 0.32, cell * 0.32),
            ...tree,
          });
        }
        continue;
      }

      if (roll > parkChance + density) {
        lotContent.set(`${col},${row}`, 'plaza');
        // 広場（何も建てない）。ベンチや街灯を置く候補になる
        surfaces.push({
          id: `plaza-${col}-${row}`,
          kind: 'plaza',
          x,
          z,
          width: cell * 0.86,
          depth: cell * 0.86,
        });
        continue;
      }

      const centerFactor = lerp(Math.pow(1 - dist, falloff), 0.42, flatten);
      const randomHeight = lerp(1, rng.range(spreadLow, spreadHigh), heightVariance);
      let height =
        lerp(0.09, heightCap, centerFactor * randomHeight) +
        rng.range(-0.02, 0.05) * (1 - order) * heightVariance;
      // 管理された街は、高さが一定の刻みに揃う（一枚の図面から起こしたように）
      if (managed) height = Math.round(height / 0.07) * 0.07;
      height = clamp(height, 0.07, heightCap + 0.04);

      const material = pickMaterial(rng, tuning, height, traits, order, patina);

      let form: BlockForm = 'box';
      if (!managed) {
        const r = rng.next();
        const roundChance = 0.08 + pos(traits.governance) * 0.16 + pos(traits.growth) * 0.08;
        const cantileverChance = height > 0.2 ? 0.08 + pos(traits.governance) * 0.12 + pos(traits.growth) * 0.12 : 0;
        if (r < roundChance && height > 0.12) form = 'round';
        else if (r < roundChance + cantileverChance) form = 'cantilever';
      }

      // 管理された街は同じ寸法・同じ向き。自由な街は大きさも位置もずれる
      const irregularSize = clamp((1 - order) + irregularity * 0.45, 0, 1);
      const width = lerp(cell * 0.72, cell * rng.range(0.48, 0.8), irregularSize);
      const depth =
        form === 'round' ? width : lerp(cell * 0.72, cell * rng.range(0.48, 0.8), irregularSize);
      const wobble = cell * 0.05 * clamp((1 - order) + irregularity * 0.6, 0, 1.4);
      const roof = pickRoof(rng, tuning, height, traits, form, roofVariation);
      const crown = pickCrown(rng, traits, height, roof, order);

      blocks.push({
        id: `block-${col}-${row}`,
        col,
        row,
        x: x + rng.range(-wobble, wobble),
        z: z + rng.range(-wobble, wobble),
        width,
        depth,
        height,
        material,
        roof,
        roofAccent: rng.chance(clamp((height < 0.24 ? 0.22 : 0.08) * signageScale, 0, 0.85)),
        windows:
          material === 'glass'
            ? 'bands'
            : managed
              ? 'grid'
              : rng.chance(clamp(0.48 + signageScale * 0.24 - patina * 0.12, 0.2, 0.95))
                ? tuning.windows
                : 'none',
        // 管理された街は、すべての戸口（と窓）が同じ方向を向く
        turn: managed ? 2 : rng.pick([0, 1, 2, 3] as const),
        rooftop: crown === 'antenna' || crown === 'scanner',
        form,
        crown,
        greenWall: traits.growth < -0.2 && height > 0.14 && rng.chance(0.3 + pos(-traits.growth) * 0.4),
      });

      lotContent.set(`${col},${row}`, 'block');

      // 建物のわきに 1 本だけ木を添えることがある。
      // 建物にめり込まないよう、小さな建物の区画の「角」にだけ、小ぶりな木を置く
      const placedBlock = blocks[blocks.length - 1]!;
      if (
        rng.chance(greenery * 0.4) &&
        placedBlock.width < cell * 0.64 &&
        placedBlock.depth < cell * 0.64
      ) {
        const tree = pickTree(rng);
        const sx = rng.chance(0.5) ? 1 : -1;
        const sz = rng.chance(0.5) ? 1 : -1;
        trees.push({
          id: `tree-side-${col}-${row}`,
          x: x + sx * cell * 0.4,
          z: z + sz * cell * 0.4,
          ...tree,
          size: tree.size * 0.62,
        });
      }
    }
  }

  // 台座の縁をぐるりと囲む並木
  const edgeTrees = Math.round(lerp(18, 36, greenery));
  for (let i = 0; i < edgeTrees; i += 1) {
    const t = i / edgeTrees;
    const side = Math.floor(t * 4);
    const along = (t * 4 - side) * 2 - 1;
    const inset = 0.92;
    const tree = pickTree(rng);
    const position =
      side === 0
        ? { x: along * inset, z: -inset }
        : side === 1
          ? { x: inset, z: along * inset }
          : side === 2
            ? { x: -along * inset, z: inset }
            : { x: -inset, z: -along * inset };
    // 並木は芝生・広場の縁にだけ植える（道路・水面・建物の上には置かない）
    const edgeCol = clamp(Math.floor((position.x + 1) / cell), 0, GRID - 1);
    const edgeRow = clamp(Math.floor((position.z + 1) / cell), 0, GRID - 1);
    const edgeLot = lotContent.get(`${edgeCol},${edgeRow}`);
    if (edgeLot !== 'park' && edgeLot !== 'plaza') continue;

    trees.push({
      id: `tree-edge-${i}`,
      x: position.x + rng.range(-0.02, 0.02),
      z: position.z + rng.range(-0.02, 0.02),
      ...tree,
      size: tree.size * 0.9,
    });
  }

  /* ---------------- 空中回廊（拡張） ---------------- */

  const skybridges: DioramaSkybridge[] = [];
  if (traits.growth > 0) {
    const byLot = new Map(blocks.map((block) => [`${block.col},${block.row}`, block]));
    const limit = Math.round(2 + traits.growth * 5);
    for (const block of blocks) {
      if (skybridges.length >= limit) break;
      if (block.height < 0.28) continue;
      for (const [dc, dr] of [
        [1, 0],
        [0, 1],
      ] as const) {
        const other = byLot.get(`${block.col + dc},${block.row + dr}`);
        if (!other || other.height < 0.28 || skybridges.length >= limit) continue;
        const y = Math.min(block.height, other.height) * rng.range(0.5, 0.78);
        skybridges.push({
          id: `skybridge-${block.id}-${dc}${dr}`,
          x0: dc ? block.x + block.width / 2 : (block.x + other.x) / 2,
          z0: dr ? block.z + block.depth / 2 : (block.z + other.z) / 2,
          x1: dc ? other.x - other.width / 2 : (block.x + other.x) / 2,
          z1: dr ? other.z - other.depth / 2 : (block.z + other.z) / 2,
          y,
        });
      }
    }
  }

  /* ---------------- 小物 ---------------- */

  const props: DioramaProp[] = [];
  if (withProps) {
    // 道路沿いの光の柱（2 区画おき、左右交互。交差点と橋の上には立てない）
    for (let i = 1; i < GRID - 1; i += 2) {
      const side = (i >> 1) % 2 === 0 ? 1 : -1;
      if (i !== roadRow && !bridges.has(`${roadCol},${i}`)) {
        props.push({
          id: `lamp-ns-${i}`,
          x: lotCenter(roadCol, cell) + side * cell * 0.44,
          z: lotCenter(i, cell),
          kind: 'lamp',
          turn: 0,
          color: 'light',
        });
      }
      if (i !== roadCol && !bridges.has(`${i},${roadRow}`)) {
        props.push({
          id: `lamp-ew-${i}`,
          x: lotCenter(i, cell),
          z: lotCenter(roadRow, cell) - side * cell * 0.44,
          kind: 'lamp',
          turn: 1,
          color: 'light',
        });
      }
    }

    // 広場のベンチと光の柱
    const plazas = surfaces.filter((surface) => surface.kind === 'plaza');
    for (const plaza of plazas) {
      if (!rng.chance(0.55)) continue;
      props.push({
        id: `bench-${plaza.id}`,
        x: plaza.x + rng.range(-0.04, 0.04),
        z: plaza.z + rng.range(-0.04, 0.04),
        kind: rng.chance(0.5) ? 'bench' : 'lamp',
        turn: rng.pick([0, 1, 2, 3] as const),
        color: 'light',
      });
    }

    // 水辺には水上艇
    if (waterEdge !== 'none') {
      const boats = 2 + Math.round(pos(traits.openness) * 2 + pos(-traits.growth) * 1.4);
      for (let i = 0; i < boats; i += 1) {
        const along = rng.range(-0.7, 0.7);
        const edge = 1 - cell * 0.5;
        props.push({
          id: `boat-${i}`,
          x: waterEdge === 'west' ? -edge : waterEdge === 'east' ? edge : along,
          z: waterEdge === 'north' ? -edge : waterEdge === 'south' ? edge : along,
          kind: 'boat',
          turn: waterEdge === 'north' || waterEdge === 'south' ? 0 : 1,
          color: rng.chance(0.5) ? 'accentSecondary' : 'light',
        });
      }
    }
  }

  /* ---------------- 交通 ---------------- */

  // 道路は台座の端から端まで通っている（地標は道路を避けて置き、水面は橋で渡る）。
  // 車は左側通行の 2 車線。向きの違う車は必ず別の車線を走るので、すれ違っても重ならない。
  const lane = cell * 0.2;
  const roads: DioramaRoad[] = [
    { id: 'road-ns', axis: 'z', at: lotCenter(roadCol, cell), lane },
    { id: 'road-ew', axis: 'x', at: lotCenter(roadRow, cell), lane },
  ];
  const vehicles: DioramaVehicle[] = [];
  if (withProps) {
    // 開いた街は往来が多く、閉じた街は少ない
    const flow = tuning.carBias * (1 + traits.openness * 0.4) * trafficScale;
    const perLane = trafficScale === 0 ? 0 : Math.max(1, Math.round(rng.range(1.2, 2.2) * flow));
    roads.forEach((_, roadIndex) => {
      for (const direction of [1, -1] as const) {
        for (let k = 0; k < perLane; k += 1) {
          const roll = rng.next();
          vehicles.push({
            id: `car-${roadIndex}-${direction}-${k}`,
            road: roadIndex,
            direction,
            // 同じ車線の車は等間隔にばらし、最初から重ならないようにする
            start: -1 + (2 / perLane) * (k + rng.range(0.15, 0.55)),
            kind: rng.chance(0.2) ? 'bus' : 'car',
            // 管理された街の車体は白一色
            color: managed ? 'light' : roll < 0.45 ? 'accentPrimary' : roll < 0.72 ? 'accentSecondary' : 'light',
            speed: rng.range(0.09, 0.125),
          });
        }
      }
    });
  }

  const ix = lotCenter(roadCol, cell);
  const iz = lotCenter(roadRow, cell);
  const corner = cell * 0.47;
  const signals: DioramaSignal[] = [
    { x: ix - corner, z: iz - corner, axis: 'z' },
    { x: ix + corner, z: iz + corner, axis: 'z' },
    { x: ix + corner, z: iz - corner, axis: 'x' },
    { x: ix - corner, z: iz + corner, axis: 'x' },
  ];
  const traffic: DioramaTraffic = { roads, vehicles, intersection: { x: ix, z: iz }, signals };

  /* ---------------- 高架軌道（拡張） ---------------- */

  let maglev: DioramaMaglev | null = null;
  if (traits.growth > 0.12) {
    const y = 0.2 + traits.growth * 0.05;
    const segments: DioramaGuideway[] = [];
    for (let row = 0; row < GRID; row += 1) {
      segments.push({
        id: `guideway-${row}`,
        x: ix,
        z: lotCenter(row, cell),
        axis: 'z',
        length: cell,
        y,
        pier: row !== roadRow && row % 2 === 1,
      });
    }
    maglev = { axis: 'z', at: ix, y, cars: 3, speed: 0.26, segments };
  }

  /* ---------------- 外周の障壁（閉じる） ---------------- */

  const wall: DioramaWallSegment[] =
    traits.openness < -0.2
      ? buildWall(0.985, platform.corner * 0.985, 0.05 + pos(-traits.openness) * 0.06, ix, iz, cell)
      : [];

  /* ---------------- 光の導管（集中） ---------------- */

  const conduits: DioramaConduit[] = [];
  if (traits.power > 0.2) {
    const core = landmarks.find((landmark) => landmark.kind === 'aiCore');
    const cx = core?.x ?? 0;
    const cz = core?.z ?? 0;
    for (const [tx, tz] of [
      [-0.86, -0.86],
      [0.86, -0.86],
      [0.86, 0.86],
      [-0.86, 0.86],
      [0, -0.95],
      [0.95, 0],
      [0, 0.95],
      [-0.95, 0],
    ] as const) {
      conduits.push({ x0: cx, z0: cz, x1: tx, z1: tz });
    }
  }

  /* ---------------- 空の小型機 ---------------- */

  const drones: DioramaDrone[] = [];
  if (withProps) {
    if (managed) {
      const count = 3 + Math.round(order * 2);
      for (let i = 0; i < count; i += 1) {
        drones.push({
          id: `patrol-${i}`,
          kind: 'patrol',
          radius: rng.range(0.32, 0.85),
          y: rng.range(0.5, 0.72),
          speed: rng.range(0.18, 0.3) * (i % 2 === 0 ? 1 : -1),
          phase: rng.range(0, Math.PI * 2),
        });
      }
    }
    const couriers = 1 + Math.round(pos(traits.openness) * 2 + pos(traits.growth) * 2);
    for (let i = 0; i < couriers; i += 1) {
      drones.push({
        id: `courier-${i}`,
        kind: 'courier',
        radius: rng.range(0.4, 1.0),
        y: rng.range(0.34, 0.6),
        speed: rng.range(0.3, 0.46) * (i % 2 === 0 ? -1 : 1),
        phase: rng.range(0, Math.PI * 2),
      });
    }
  }

  /* ---------------- 浮遊する装飾 ---------------- */

  const clouds: DioramaCloud[] = [];
  if (withClouds) {
    const count = rng.int(4, 6);
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + rng.range(-0.3, 0.3);
      const radius = rng.range(1.25, 1.75);
      clouds.push({
        id: `cloud-${i}`,
        x: Math.cos(angle) * radius,
        y: rng.range(-0.32, 0.52),
        z: Math.sin(angle) * radius,
        size: rng.range(0.16, 0.3),
        speed: rng.range(0.12, 0.26),
        phase: rng.next(),
      });
    }
  }

  const figures: DioramaFigure[] = [];
  if (withProps) {
    const crowd = Math.round(lerp(6, 28, pos(traits.openness) * 0.62 + (1 - order) * 0.18 + 0.12));
    const sidewalk = cell * 0.4;
    const nsAt = [lotCenter(roadCol, cell) - sidewalk, lotCenter(roadCol, cell) + sidewalk];
    const ewAt = [lotCenter(roadRow, cell) - sidewalk, lotCenter(roadRow, cell) + sidewalk];
    for (let i = 0; i < crowd; i += 1) {
      const alongZ = i % 2 === 0;
      const side = (i >> 1) % 2;
      // 同じ歩道は同じ向き。近い車線と揃える（左通行の隣を歩く）
      const direction: 1 | -1 = alongZ ? (side === 0 ? 1 : -1) : (side === 0 ? -1 : 1);
      figures.push({
        id: `fig-${i}`,
        axis: alongZ ? 'z' : 'x',
        at: alongZ ? nsAt[side]! : ewAt[side]!,
        start: rng.range(-0.92, 0.92),
        direction,
        speed: rng.range(0.035, 0.055) * (1 + pos(traits.openness) * 0.15),
        stride: rng.range(18, 26),
        size: rng.range(0.036, 0.048),
      });
    }
  }

  const sparkles: DioramaSparkle[] = [];
  if (withSparkles) {
    const count = rng.int(8, 12);
    for (let i = 0; i < count; i += 1) {
      const angle = rng.range(0, Math.PI * 2);
      const radius = rng.range(0.7, 1.5);
      sparkles.push({
        id: `sparkle-${i}`,
        x: Math.cos(angle) * radius,
        y: rng.range(0.3, 1.0),
        z: Math.sin(angle) * radius,
        size: rng.range(0.015, 0.032),
        phase: rng.next(),
      });
    }
  }

  return {
    configId: config.id,
    platform,
    surfaces,
    lawns,
    traffic,
    blocks,
    landmarks,
    trees,
    figures,
    props,
    clouds,
    sparkles,
    traits,
    wall,
    skybridges,
    maglev,
    drones,
    conduits,
  };
}

export { GRID as DIORAMA_GRID, LANDMARK_SIZE as DIORAMA_LANDMARK_SIZE };
