import { mix, shade } from '../color';
import { clamp, createRng, lerp } from '../rng';
import {
  cylinderBand,
  cylinderFin,
  depthOf,
  drawBox,
  drawCylinder,
  drawGlow,
  faceRect,
  fillCircle,
  fillDisc,
  fillEllipse,
  fillPoly,
  glowColor,
  onFace,
  strokeRing,
  toScreen,
  type Ctx,
  type IsoCamera,
  type Point2,
  type VisibleFace,
} from './canvasPrimitives';
import type { BlockCrown, DioramaBlock, DioramaPalette } from './types';

/**
 * 一般の建物（2127 年の街並み）。
 *
 * 切妻屋根と煙突の「いまの家」は描かない。
 * 低い建物は窓帯を巻いた住居ポッド、中層は通しの窓帯と光の線、高層はガラスの外装と縦のフィン。
 * 屋根は太陽光の片流れ・ヴォールト・段状、屋上には庭・太陽光・小型風車・離着陸パッドが載る。
 * 形は箱のほかに円筒と、上階が張り出す片持ちがある。
 */

export type BuildingStyle = 'pod' | 'studio' | 'block' | 'tower';

/** 高さから用途を決める。 */
export function styleOf(block: DioramaBlock): BuildingStyle {
  if (block.height < 0.155) return 'pod';
  if (block.height < 0.235) return 'studio';
  if (block.height < 0.42) return 'block';
  return 'tower';
}

/** 面の外向き法線（ローカル: 0 = -z / 1 = +x / 2 = +z / 3 = -x）。 */
const FACE_DIRS: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

function materialColor(block: DioramaBlock, palette: DioramaPalette): string {
  switch (block.material) {
    case 'glass':
      return palette.buildingGlass;
    case 'mid':
      return palette.buildingMid;
    case 'accentPrimary':
      return palette.accentPrimary;
    case 'accentSecondary':
      return palette.accentSecondary;
    case 'tintPrimary':
      return mix(palette.accentPrimary, palette.buildingLight, 0.7);
    case 'tintSecondary':
      return mix(palette.accentSecondary, palette.buildingLight, 0.66);
    default:
      return palette.buildingLight;
  }
}

function crownOf(block: DioramaBlock): BlockCrown {
  return block.crown ?? (block.rooftop ? 'antenna' : 'none');
}

/** 法線から、回したときの見え方（手前か・明るさ）を求める。 */
function facing(camera: IsoCamera, nx: number, nz: number): { front: boolean; tone: number } {
  const c = Math.cos(camera.rot);
  const s = Math.sin(camera.rot);
  const wx = nx * c - nz * s;
  const wz = nx * s + nz * c;
  return { front: wx + wz > 0.0001, tone: clamp((wx - wz) * 0.5 + 0.5, 0, 1) };
}

function sideTone(base: string, tone: number): string {
  return shade(base, lerp(-0.26, -0.04, tone));
}

interface Palette2127 {
  readonly body: string;
  readonly glow: string;
  readonly glass: string;
  readonly darkGlass: string;
  readonly frame: string;
  readonly lit: string;
  readonly roof: string;
}

function tonesOf(block: DioramaBlock, palette: DioramaPalette): Palette2127 {
  return {
    body: materialColor(block, palette),
    glow: glowColor(palette),
    glass: mix(palette.buildingGlass, '#ffffff', 0.18),
    darkGlass: mix(palette.buildingGlass, '#22324a', 0.38),
    frame: mix(palette.buildingLight, '#ffffff', 0.55),
    // 灯りの入った窓。原色のままだと点が散って見えるので、白を強く混ぜる
    lit: mix(palette.accentSecondary, '#fffdf2', 0.62),
    roof: block.roofAccent ? palette.accentSecondary : palette.roof,
  };
}

/* ------------------------------------------------------------------ *
 * 外装
 * ------------------------------------------------------------------ */

/** 揃った窓の格子（管理された街の「一枚の図面」）。 */
function windowGrid(
  ctx: Ctx,
  face: VisibleFace,
  cols: number,
  rows: number,
  v0: number,
  v1: number,
  tones: Palette2127,
  detailed: boolean,
  seed: string,
): void {
  const rng = createRng(seed);
  const cellV = (v1 - v0) / Math.max(1, rows);
  const cellU = 0.86 / Math.max(1, cols);
  for (let r = 0; r < rows; r += 1) {
    const vLow = v0 + cellV * r + cellV * 0.2;
    const vHigh = v0 + cellV * r + cellV * 0.78;
    for (let c = 0; c < cols; c += 1) {
      const uLow = 0.07 + cellU * c + cellU * 0.16;
      const uHigh = 0.07 + cellU * c + cellU * 0.84;
      const lit = rng.chance(0.14);
      if (detailed) faceRect(ctx, face.basis, uLow - 0.006, vLow - 0.006, uHigh + 0.006, vHigh + 0.006, tones.frame, 0.85);
      faceRect(ctx, face.basis, uLow, vLow, uHigh, vHigh, lit ? tones.lit : tones.glass, lit ? 0.95 : 0.78);
    }
  }
}

/** 階ごとの通しの窓帯（ガラスの帯と白い腰壁が交互に重なる）。 */
function ribbonWindows(
  ctx: Ctx,
  face: VisibleFace,
  floors: number,
  v0: number,
  v1: number,
  tones: Palette2127,
  detailed: boolean,
): void {
  const cellV = (v1 - v0) / Math.max(1, floors);
  for (let r = 0; r < floors; r += 1) {
    const a = v0 + cellV * r + cellV * 0.26;
    const b = v0 + cellV * r + cellV * 0.86;
    faceRect(ctx, face.basis, 0.05, a, 0.95, b, tones.glass, 0.82);
    if (detailed) {
      // 天井際の反射
      faceRect(ctx, face.basis, 0.05, b - (b - a) * 0.22, 0.95, b, '#ffffff', 0.18);
    }
  }
  if (detailed) {
    const mullions = Math.max(2, Math.round(face.width / 0.03));
    for (let i = 1; i < mullions; i += 1) {
      const u = 0.05 + (0.9 / mullions) * i;
      faceRect(ctx, face.basis, u - 0.004, v0, u + 0.004, v1, tones.frame, 0.4);
    }
  }
}

/** 縦の庭（壁面緑化）。面ごとの固定の種で茂みの位置を決める。 */
function greenWall(ctx: Ctx, face: VisibleFace, palette: DioramaPalette, seed: string): void {
  const rng = createRng(seed);
  for (const [u0, u1] of [
    [0.06, 0.24],
    [0.76, 0.94],
  ] as const) {
    faceRect(ctx, face.basis, u0, 0.1, u1, 0.96, palette.foliageDeep, 0.92);
    for (let i = 0; i < 7; i += 1) {
      const v = rng.range(0.12, 0.9);
      const u = rng.range(u0, u1 - 0.06);
      faceRect(ctx, face.basis, u, v, u + 0.07, v + 0.07, shade(palette.foliage, 0.12), 0.9);
    }
  }
}

/** 足元の陰と、上端の光の線（2127 年の建物は輪郭が細く光る）。 */
function edgeLight(ctx: Ctx, face: VisibleFace, palette: DioramaPalette, tones: Palette2127, glowTop: boolean): void {
  faceRect(ctx, face.basis, 0, 0, 1, 0.07, palette.shadow, 0.16);
  faceRect(ctx, face.basis, 0, 0.07, 1, 0.16, palette.shadow, 0.07);
  faceRect(ctx, face.basis, 0, 0.972, 1, 1, glowTop ? tones.glow : '#ffffff', glowTop ? 0.85 : 0.42);
}

function drawFacade(
  ctx: Ctx,
  face: VisibleFace,
  block: DioramaBlock,
  palette: DioramaPalette,
  tones: Palette2127,
  detailed: boolean,
  height: number,
): void {
  const style = styleOf(block);
  const floors = Math.max(1, Math.round(height / 0.036));
  const cols = Math.max(1, Math.round(face.width / 0.022));

  if (block.windows === 'grid' && style !== 'tower') {
    windowGrid(ctx, face, Math.min(5, cols), Math.min(8, floors), 0.12, 0.92, tones, detailed, `${block.id}-g-${face.index}`);
  } else if (style === 'pod') {
    // 住居ポッド: 角を回り込む 1 本の大きな窓帯と、足元の光
    faceRect(ctx, face.basis, 0.08, 0.34, 0.92, 0.78, tones.darkGlass, 0.9);
    faceRect(ctx, face.basis, 0.08, 0.66, 0.92, 0.78, '#ffffff', 0.2);
    if (detailed) faceRect(ctx, face.basis, 0.05, 0.08, 0.95, 0.12, tones.glow, 0.85);
  } else if (style === 'studio') {
    // 低層: 1 階はすべてガラス、その上に光の線、上階は窓帯
    faceRect(ctx, face.basis, 0.05, 0.07, 0.95, 0.4, tones.darkGlass, 0.86);
    faceRect(ctx, face.basis, 0.03, 0.42, 0.97, 0.47, tones.glow, 0.9);
    ribbonWindows(ctx, face, Math.max(1, Math.round(floors * 0.5)), 0.5, 0.94, tones, detailed);
  } else if (style === 'block') {
    ribbonWindows(ctx, face, Math.min(8, floors), 0.1, 0.94, tones, detailed);
    // 数階おきの光の線
    if (detailed) {
      for (let i = 1; i < 3; i += 1) {
        const v = 0.1 + (0.84 / 3) * i;
        faceRect(ctx, face.basis, 0, v - 0.008, 1, v + 0.008, tones.glow, 0.7);
      }
    }
  } else {
    // 高層: ガラスの外装に縦のフィン、数十階おきに光の帯
    faceRect(ctx, face.basis, 0.04, 0.05, 0.96, 0.95, tones.glass, 0.72);
    const bands = Math.min(12, Math.max(4, Math.round(floors * 0.7)));
    for (let i = 0; i < bands; i += 1) {
      const v = 0.05 + (0.9 / bands) * i;
      faceRect(ctx, face.basis, 0.04, v, 0.96, v + (0.9 / bands) * 0.16, tones.frame, 0.5);
    }
    if (detailed) {
      const fins = Math.max(3, Math.round(face.width / 0.024));
      for (let i = 1; i < fins; i += 1) {
        const u = 0.04 + (0.92 / fins) * i;
        faceRect(ctx, face.basis, u - 0.006, 0.05, u + 0.006, 0.95, tones.frame, 0.8);
      }
      for (const v of [0.34, 0.68]) faceRect(ctx, face.basis, 0, v, 1, v + 0.014, tones.glow, 0.8);
      // 斜めの映り込み
      fillPoly(
        ctx,
        [onFace(face.basis, 0.16, 0.06), onFace(face.basis, 0.3, 0.06), onFace(face.basis, 0.6, 0.94), onFace(face.basis, 0.46, 0.94)],
        '#ffffff',
        0.16,
      );
    }
  }

  if (block.greenWall && detailed && style !== 'pod') greenWall(ctx, face, palette, `${block.id}-gw-${face.index}`);
  edgeLight(ctx, face, palette, tones, style !== 'pod');

  // 角の柱（陰影の切り替わりを締める）
  if (detailed && style !== 'pod') {
    faceRect(ctx, face.basis, 0, 0, 0.018, 1, shade(tones.body, -0.14), 0.8);
    faceRect(ctx, face.basis, 0.982, 0, 1, 1, shade(tones.body, -0.14), 0.8);
  }
}

/* ------------------------------------------------------------------ *
 * 屋根
 * ------------------------------------------------------------------ */

/** 太陽光パネルの片流れ屋根。戸口と反対側が高くなる。 */
function drawSolarRoof(
  ctx: Ctx,
  camera: IsoCamera,
  block: DioramaBlock,
  palette: DioramaPalette,
  tones: Palette2127,
  detailed: boolean,
): void {
  const hw = block.width / 2 + 0.004;
  const hd = block.depth / 2 + 0.004;
  const rise = Math.min(block.width, block.depth) * 0.3;
  const y = block.height;
  const [ax, az] = FACE_DIRS[(block.turn + 2) % 4]!;
  const alongX = ax !== 0;
  const sign = alongX ? ax : az;

  /** sa: -1 = 低い縁 / 1 = 高い縁、sb: 横方向 */
  const at = (sa: number, sb: number, h: number): Point2 => {
    const da = sa * (alongX ? hw : hd) * sign;
    const db = sb * (alongX ? hd : hw);
    return alongX ? toScreen(camera, block.x + da, h, block.z + db) : toScreen(camera, block.x + db, h, block.z + da);
  };
  const low0 = at(-1, -1, y);
  const low1 = at(-1, 1, y);
  const high1 = at(1, 1, y + rise);
  const high0 = at(1, -1, y + rise);

  fillPoly(ctx, [low0, low1, high1, high0], mix(palette.roof, '#ffffff', 0.12));
  const panel = mix('#2c4a78', palette.buildingGlass, 0.22);
  const onSlope = (u: number, v: number): Point2 => ({
    x: low0.x + (low1.x - low0.x) * u + (high0.x - low0.x) * v,
    y: low0.y + (low1.y - low0.y) * u + (high0.y - low0.y) * v,
  });
  const cols = detailed ? 3 : 1;
  const rows = detailed ? 2 : 1;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const u0 = 0.06 + (0.88 / cols) * c + 0.02;
      const u1 = 0.06 + (0.88 / cols) * (c + 1) - 0.02;
      const v0 = 0.08 + (0.84 / rows) * r + 0.03;
      const v1 = 0.08 + (0.84 / rows) * (r + 1) - 0.03;
      fillPoly(ctx, [onSlope(u0, v0), onSlope(u1, v0), onSlope(u1, v1), onSlope(u0, v1)], panel, 0.95);
      fillPoly(ctx, [onSlope(u0, v1 - 0.06), onSlope(u1, v1 - 0.06), onSlope(u1, v1), onSlope(u0, v1)], '#ffffff', 0.22);
    }
  }

  // 高い側の壁と、左右の三角の壁（手前を向いたものだけ）
  const high = facing(camera, ax, az);
  if (high.front) {
    fillPoly(ctx, [at(1, -1, y), at(1, 1, y), high1, high0], sideTone(tones.body, high.tone));
    fillPoly(ctx, [at(1, -1, y + rise * 0.8), at(1, 1, y + rise * 0.8), high1, high0], tones.glow, 0.5);
  }
  for (const sb of [-1, 1]) {
    const side = facing(camera, alongX ? 0 : sb, alongX ? sb : 0);
    if (!side.front) continue;
    fillPoly(ctx, [at(-1, sb, y), at(1, sb, y), at(1, sb, y + rise)], sideTone(tones.body, side.tone));
  }
}

/** ヴォールト屋根（かまぼこ形）。長手方向に通し、頂部に天窓の帯。 */
function drawVaultRoof(ctx: Ctx, camera: IsoCamera, block: DioramaBlock, tones: Palette2127): void {
  const alongX = block.width >= block.depth;
  const hu = (alongX ? block.width : block.depth) / 2;
  const hv = (alongX ? block.depth : block.width) / 2;
  const rise = hv * 0.85;
  const y = block.height;
  const steps = 7;
  const at = (u: number, v: number, h: number): Point2 =>
    alongX ? toScreen(camera, block.x + u, h, block.z + v) : toScreen(camera, block.x + v, h, block.z + u);
  const depthAt = (u: number, v: number): number =>
    alongX ? depthOf(camera, block.x + u, block.z + v) : depthOf(camera, block.x + v, block.z + u);

  const list: { points: Point2[]; color: string; depth: number; alpha: number }[] = [];
  for (let k = 0; k < steps; k += 1) {
    const t0 = (Math.PI * k) / steps;
    const t1 = (Math.PI * (k + 1)) / steps;
    const tm = (t0 + t1) / 2;
    const v0 = Math.cos(t0) * hv;
    const v1 = Math.cos(t1) * hv;
    const y0 = y + Math.sin(t0) * rise;
    const y1 = y + Math.sin(t1) * rise;
    const view = facing(camera, alongX ? 0 : Math.cos(tm), alongX ? Math.cos(tm) : 0);
    const light = 0.5 * Math.sin(tm) + 0.5 * view.tone;
    const skylight = k === Math.floor(steps / 2);
    list.push({
      points: [at(-hu, v0, y0), at(hu, v0, y0), at(hu, v1, y1), at(-hu, v1, y1)],
      color: skylight ? tones.glass : shade(tones.roof, lerp(-0.22, 0.08, light)),
      depth: depthAt(0, Math.cos(tm) * hv),
      alpha: 1,
    });
  }
  list.sort((a, b) => a.depth - b.depth);
  for (const item of list) fillPoly(ctx, item.points, item.color, item.alpha);

  // 手前を向いた妻（半円の面）
  for (const su of [-1, 1]) {
    const view = facing(camera, alongX ? su : 0, alongX ? 0 : su);
    if (!view.front) continue;
    const profile: Point2[] = [];
    for (let k = 0; k <= steps; k += 1) {
      const t = (Math.PI * k) / steps;
      profile.push(at(su * hu, Math.cos(t) * hv, y + Math.sin(t) * rise));
    }
    fillPoly(ctx, profile, sideTone(tones.body, view.tone));
    // 妻の丸窓の代わりに、半円に沿った光の縁
    const inner: Point2[] = [];
    for (let k = 0; k <= steps; k += 1) {
      const t = (Math.PI * k) / steps;
      inner.push(at(su * hu, Math.cos(t) * hv * 0.62, y + Math.sin(t) * rise * 0.62));
    }
    fillPoly(ctx, inner, tones.darkGlass, 0.85);
  }
}

/* ------------------------------------------------------------------ *
 * 屋上
 * ------------------------------------------------------------------ */

function drawCrown(
  ctx: Ctx,
  camera: IsoCamera,
  block: DioramaBlock,
  palette: DioramaPalette,
  tones: Palette2127,
  topY: number,
  radius: number,
  detailed: boolean,
): void {
  const crown = crownOf(block);
  const { x, z } = block;
  const y = topY + 0.002;

  switch (crown) {
    case 'garden': {
      fillDisc(ctx, camera, x, y, z, radius * 0.78, mix(palette.foliage, palette.platformTop, 0.2));
      const shrubs = createRng(`shrub:${block.id}`);
      for (let i = 0; i < 5; i += 1) {
        const p = toScreen(camera, x + shrubs.range(-radius, radius) * 0.55, y, z + shrubs.range(-radius, radius) * 0.55);
        const r = camera.span * shrubs.range(0.007, 0.013);
        fillCircle(ctx, p.x, p.y - r * 0.6, r, palette.foliageDeep);
        fillCircle(ctx, p.x - r * 0.3, p.y - r * 0.9, r * 0.6, shade(palette.foliage, 0.15));
      }
      break;
    }
    case 'solar': {
      const panel = mix('#2c4a78', palette.buildingGlass, 0.22);
      const cols = detailed ? 3 : 1;
      const size = (radius * 1.3) / cols;
      for (let r = 0; r < 2; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const px = x - radius * 0.65 + size * (c + 0.5);
          const pz = z - radius * 0.5 + radius * (r + 0.5) * 0.5;
          const quad = [
            toScreen(camera, px - size * 0.44, y + 0.006, pz - radius * 0.2),
            toScreen(camera, px + size * 0.44, y + 0.006, pz - radius * 0.2),
            toScreen(camera, px + size * 0.44, y + 0.018, pz + radius * 0.2),
            toScreen(camera, px - size * 0.44, y + 0.018, pz + radius * 0.2),
          ];
          fillPoly(ctx, quad, panel, 0.95);
          fillPoly(ctx, [quad[2]!, quad[3]!, quad[3]!, quad[2]!], '#ffffff', 0.3);
        }
      }
      break;
    }
    case 'turbine': {
      // 垂直軸の小型風車（ねじれた翼を縦の帯で表す）
      const h = Math.max(0.05, radius * 0.9);
      drawCylinder(ctx, camera, { x, z, y, radius: radius * 0.06, height: h * 0.25, color: shade(palette.buildingMid, -0.25) });
      const rotor = drawCylinder(ctx, camera, {
        x,
        z,
        y: y + h * 0.25,
        radius: radius * 0.34,
        height: h * 0.75,
        color: mix(palette.buildingLight, palette.buildingGlass, 0.3),
        noTop: true,
      });
      if (detailed) {
        for (const u of [-0.7, 0, 0.7]) {
          cylinderFin(ctx, camera, {
            x,
            z,
            radius: radius * 0.34,
            y0: y + h * 0.25,
            y1: y + h,
            u,
            width: camera.span * 0.006,
            color: shade(palette.buildingMid, -0.2),
            alpha: 0.9,
          });
        }
      }
      fillEllipse(ctx, rotor.cx, rotor.topY, rotor.rx, rotor.ry, tones.glow, 0.8);
      break;
    }
    case 'pad': {
      // 離着陸パッド: 暗い円盤に光の輪と誘導灯
      const r = radius * 0.82;
      fillDisc(ctx, camera, x, y + 0.004, z, r, shade(palette.buildingMid, -0.32));
      strokeRing(ctx, camera, x, y + 0.005, z, r * 0.78, tones.glow, Math.max(1, camera.span * 0.004), 0.95);
      fillDisc(ctx, camera, x, y + 0.006, z, r * 0.2, palette.accentSecondary, 0.9);
      if (detailed) {
        for (let i = 0; i < 6; i += 1) {
          const a = (i / 6) * Math.PI * 2;
          const p = toScreen(camera, x + Math.cos(a) * r * 0.94, y + 0.006, z + Math.sin(a) * r * 0.94);
          drawGlow(ctx, p.x, p.y, camera.span * 0.012, tones.glow, 0.8);
        }
      }
      break;
    }
    case 'antenna': {
      const base = toScreen(camera, x, y, z);
      const mast = camera.span * (0.05 + block.height * 0.08);
      fillPoly(
        ctx,
        [
          { x: base.x - 1.1, y: base.y },
          { x: base.x + 1.1, y: base.y },
          { x: base.x + 0.5, y: base.y - mast },
          { x: base.x - 0.5, y: base.y - mast },
        ],
        shade(palette.buildingMid, -0.4),
      );
      drawGlow(ctx, base.x, base.y - mast, camera.span * 0.02, palette.accentPrimary, 0.7);
      fillCircle(ctx, base.x, base.y - mast, Math.max(1.4, camera.span * 0.004), palette.accentPrimary);
      if (detailed) {
        const dish = toScreen(camera, x + radius * 0.5, y + 0.02, z - radius * 0.3);
        fillEllipse(ctx, dish.x, dish.y, camera.span * 0.012, camera.span * 0.009, tones.frame);
      }
      break;
    }
    case 'scanner': {
      // 監視の目: 小さなドームと、赤い光点
      const base = toScreen(camera, x, y, z);
      const r = radius * camera.span * 0.3;
      ctx.fillStyle = shade(palette.buildingMid, -0.15);
      ctx.beginPath();
      ctx.moveTo(base.x - r, base.y);
      ctx.bezierCurveTo(base.x - r, base.y - r * 1.2, base.x + r, base.y - r * 1.2, base.x + r, base.y);
      ctx.closePath();
      ctx.fill();
      drawGlow(ctx, base.x + r * 0.2, base.y - r * 0.5, r * 1.4, '#ff4f5e', 0.55);
      fillCircle(ctx, base.x + r * 0.2, base.y - r * 0.5, Math.max(1.2, r * 0.22), '#ff4f5e');
      break;
    }
    default:
      break;
  }
}

/* ------------------------------------------------------------------ *
 * 本体
 * ------------------------------------------------------------------ */

function drawRoundBuilding(
  ctx: Ctx,
  camera: IsoCamera,
  block: DioramaBlock,
  palette: DioramaPalette,
  tones: Palette2127,
  detailed: boolean,
): void {
  const r = Math.min(block.width, block.depth) / 2;
  const h = block.height;
  const { x, z } = block;
  const floors = Math.max(2, Math.round(h / 0.036));

  // 土台の光の輪
  fillDisc(ctx, camera, x, 0.002, z, r * 1.08, tones.glow, 0.35);
  const body = drawCylinder(ctx, camera, { x, z, y: 0, radius: r, height: h, color: tones.body, topColor: tones.roof });

  for (let i = 0; i < floors; i += 1) {
    const y0 = h * 0.08 + ((h * 0.86) / floors) * i + ((h * 0.86) / floors) * 0.24;
    const y1 = h * 0.08 + ((h * 0.86) / floors) * (i + 1) - ((h * 0.86) / floors) * 0.12;
    cylinderBand(ctx, camera, { x, z, radius: r, y0, y1, color: tones.glass, alpha: 0.8 });
  }
  if (block.greenWall) {
    for (let i = 0; i < floors; i += 3) {
      const y0 = h * 0.08 + ((h * 0.86) / floors) * i;
      cylinderBand(ctx, camera, { x, z, radius: r * 1.02, y0, y1: y0 + h * 0.03, color: palette.foliageDeep, alpha: 0.95 });
    }
  }
  if (detailed) {
    for (const u of [-0.82, -0.5, -0.16, 0.18, 0.5, 0.82]) {
      cylinderFin(ctx, camera, {
        x,
        z,
        radius: r,
        y0: h * 0.06,
        y1: h * 0.97,
        u,
        width: camera.span * 0.005,
        color: tones.frame,
        alpha: 0.75,
      });
    }
  }
  cylinderBand(ctx, camera, { x, z, radius: r, y0: 0, y1: h * 0.06, color: palette.shadow, alpha: 0.16 });
  cylinderBand(ctx, camera, { x, z, radius: r, y0: h - 0.008, y1: h, color: tones.glow, alpha: 0.9 });
  // 右肩の映り込み
  fillPoly(
    ctx,
    [
      { x: body.cx + body.rx * 0.46, y: body.bottomY },
      { x: body.cx + body.rx * 0.62, y: body.bottomY },
      { x: body.cx + body.rx * 0.62, y: body.topY },
      { x: body.cx + body.rx * 0.46, y: body.topY },
    ],
    '#ffffff',
    0.14,
  );

  if (block.roof === 'rounded') {
    // ドームの天蓋
    const ry = r * camera.span * 0.55;
    ctx.globalAlpha = 1;
    ctx.fillStyle = mix(tones.glass, '#ffffff', 0.2);
    ctx.beginPath();
    ctx.moveTo(body.cx - body.rx, body.topY);
    ctx.bezierCurveTo(body.cx - body.rx, body.topY - ry, body.cx + body.rx, body.topY - ry, body.cx + body.rx, body.topY);
    ctx.ellipse(body.cx, body.topY, body.rx, body.ry, 0, 0, Math.PI, false);
    ctx.closePath();
    ctx.fill();
    fillEllipse(ctx, body.cx - body.rx * 0.3, body.topY - ry * 0.45, body.rx * 0.22, ry * 0.2, '#ffffff', 0.5);
    return;
  }
  drawCrown(ctx, camera, block, palette, tones, h, r * 0.8, detailed);
}

export function drawBuilding(
  ctx: Ctx,
  camera: IsoCamera,
  block: DioramaBlock,
  palette: DioramaPalette,
  detailed: boolean,
): void {
  const tones = tonesOf(block, palette);
  if (block.form === 'round') {
    drawRoundBuilding(ctx, camera, block, palette, tones, detailed);
    return;
  }

  const style = styleOf(block);
  const cantilever = block.form === 'cantilever';
  const [dx, dz] = FACE_DIRS[block.turn]!;

  // ---- 土台（1 階部分を一段濃く） ----
  if (detailed && style !== 'pod') {
    drawBox(ctx, camera, {
      x: block.x,
      z: block.z,
      y: 0,
      width: block.width * 1.02,
      depth: block.depth * 1.02,
      height: Math.min(block.height * 0.16, 0.03),
      color: shade(tones.body, -0.12),
    });
  }

  // ---- 本体（片持ちなら、細い下階の上に張り出した上階を載せる） ----
  const splitY = cantilever ? block.height * 0.5 : block.height;
  const lower = drawBox(ctx, camera, {
    x: block.x,
    z: block.z,
    y: 0,
    width: cantilever ? block.width * 0.74 : block.width,
    depth: cantilever ? block.depth * 0.74 : block.depth,
    height: splitY,
    color: tones.body,
    topColor: tones.roof,
  });
  for (const face of lower.faces) drawFacade(ctx, face, block, palette, tones, detailed, splitY);

  if (cantilever) {
    const shift = Math.min(block.width, block.depth) * 0.16;
    const upper = drawBox(ctx, camera, {
      x: block.x + dx * shift,
      z: block.z + dz * shift,
      y: splitY,
      width: block.width,
      depth: block.depth,
      height: block.height - splitY,
      color: tones.body,
      topColor: tones.roof,
    });
    for (const face of upper.faces) {
      drawFacade(ctx, face, block, palette, tones, detailed, block.height - splitY);
      // 張り出しの下端に光の線
      faceRect(ctx, face.basis, 0, 0, 1, 0.05, tones.glow, 0.85);
    }
  }

  // ---- 戸口 ----
  // 戸口は建物の向き（turn）で決まる 1 面に固定する。裏を向いていれば見えないだけ。
  const front = lower.faces.find((face) => face.index === block.turn);
  if (detailed && front) {
    const top = style === 'pod' ? 0.3 : cantilever ? 0.3 : 0.16;
    faceRect(ctx, front.basis, 0.4, 0, 0.6, top, tones.darkGlass, 0.95);
    faceRect(ctx, front.basis, 0.36, top, 0.64, top + 0.035, tones.glow, 0.95);
  }

  // ---- 屋根 ----
  const roofX = cantilever ? block.x + dx * Math.min(block.width, block.depth) * 0.16 : block.x;
  const roofZ = cantilever ? block.z + dz * Math.min(block.width, block.depth) * 0.16 : block.z;
  const roofBlock: DioramaBlock = cantilever ? { ...block, x: roofX, z: roofZ } : block;

  if (block.roof === 'pitched') {
    drawSolarRoof(ctx, camera, roofBlock, palette, tones, detailed);
    return;
  }
  if (block.roof === 'rounded') {
    drawVaultRoof(ctx, camera, roofBlock, tones);
    return;
  }

  // 陸屋根はガラスの手すりで縁取る
  if (detailed) {
    const rail = drawBox(ctx, camera, {
      x: roofX,
      z: roofZ,
      y: block.height,
      width: block.width * 1.02,
      depth: block.depth * 1.02,
      height: 0.012,
      color: mix(tones.glass, '#ffffff', 0.2),
      topColor: shade(tones.roof, -0.04),
    });
    for (const face of rail.faces) faceRect(ctx, face.basis, 0, 0.8, 1, 1, tones.glow, 0.6);
  }

  if (block.roof === 'setback' || block.roof === 'stepped') {
    const tiers = block.roof === 'stepped' ? 2 : 1;
    let y = block.height + 0.012;
    let w = block.width;
    let d = block.depth;
    for (let i = 0; i < tiers; i += 1) {
      w *= 0.66;
      d *= 0.66;
      const h = block.height * 0.16;
      const tier = drawBox(ctx, camera, {
        x: roofX,
        z: roofZ,
        y,
        width: w,
        depth: d,
        height: h,
        color: tones.body,
        topColor: tones.roof,
      });
      for (const face of tier.faces) {
        faceRect(ctx, face.basis, 0.08, 0.16, 0.92, 0.8, tones.glass, 0.72);
        faceRect(ctx, face.basis, 0, 0.94, 1, 1, tones.glow, 0.85);
      }
      y += h;
    }
    // 最上段に細い尖塔
    if (detailed) {
      const tip = toScreen(camera, roofX, y, roofZ);
      const spire = camera.span * block.height * 0.18;
      fillPoly(
        ctx,
        [
          { x: tip.x - 1.4, y: tip.y },
          { x: tip.x + 1.4, y: tip.y },
          { x: tip.x, y: tip.y - spire },
        ],
        tones.frame,
      );
      drawGlow(ctx, tip.x, tip.y - spire, camera.span * 0.016, tones.glow, 0.8);
    }
    return;
  }

  drawCrown(ctx, camera, roofBlock, palette, tones, block.height + 0.012, Math.min(block.width, block.depth) * 0.45, detailed);
}
