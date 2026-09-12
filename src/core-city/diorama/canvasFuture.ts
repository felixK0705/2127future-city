import { mix, shade } from '../color';
import { createRng } from '../rng';
import {
  cylinderBand,
  cylinderFin,
  drawBox,
  drawCylinder,
  drawGlow,
  fillCircle,
  fillDisc,
  fillEllipse,
  fillPoly,
  glowColor,
  strokeRing,
  toScreen,
  type Ctx,
  type IsoCamera,
  type Point2,
} from './canvasPrimitives';
import type { DioramaPalette, PlacedDioramaLandmark } from './types';

/**
 * 2127 年の目印（中枢塔・軌道エレベーター・温室ドーム・風力タービン・太陽光の樹・空の港・監視塔）。
 *
 * base は静止画として焼き、動く部分（光の輪・羽根・昇降機・探照光）は spinner として毎フレーム描く。
 * どれも円筒と円盤で組むので、街を回しても形が崩れない。
 */

function accentOf(lm: PlacedDioramaLandmark, p: DioramaPalette): string {
  if (lm.accent === 'primary') return p.accentPrimary;
  if (lm.accent === 'secondary') return p.accentSecondary;
  return p.buildingMid;
}

function nearlyEdgeOn(a: Point2, b: Point2): boolean {
  const det = a.x * b.y - a.y * b.x;
  const norm = a.x * a.x + a.y * a.y + b.x * b.x + b.y * b.y;
  return norm === 0 || Math.abs(det) < norm * 0.004;
}

/* ------------------------------------------------------------------ *
 * 中枢塔（集中）
 * ------------------------------------------------------------------ */

export function aiCoreBase(ctx: Ctx, cam: IsoCamera, lm: PlacedDioramaLandmark, p: DioramaPalette, detailed: boolean): void {
  const accent = accentOf(lm, p);
  const glow = glowColor(p);
  const r0 = lm.footprint * 0.44;
  const h = lm.height;
  const glass = mix(p.buildingGlass, '#ffffff', 0.15);

  // 足元の光の環
  strokeRing(ctx, cam, lm.x, 0.003, lm.z, r0 * 1.02, glow, Math.max(1.2, cam.span * 0.005), 0.8);
  fillDisc(ctx, cam, lm.x, 0.002, lm.z, r0 * 0.96, glow, 0.18);

  // 基壇
  drawCylinder(ctx, cam, { x: lm.x, z: lm.z, y: 0, radius: r0, height: h * 0.05, color: p.buildingLight });
  cylinderBand(ctx, cam, { x: lm.x, z: lm.z, radius: r0, y0: h * 0.035, y1: h * 0.05, color: glow, alpha: 0.9 });
  drawCylinder(ctx, cam, {
    x: lm.x,
    z: lm.z,
    y: h * 0.05,
    radius: r0 * 0.72,
    height: h * 0.07,
    color: p.buildingLight,
  });
  cylinderBand(ctx, cam, { x: lm.x, z: lm.z, radius: r0 * 0.72, y0: h * 0.07, y1: h * 0.11, color: glass, alpha: 0.85 });

  // 細くなりながら伸びる塔身（段の継ぎ目が光る）
  const segments = 5;
  let y = h * 0.12;
  const bodyHeight = h * 0.72;
  for (let i = 0; i < segments; i += 1) {
    const t = i / segments;
    const r = r0 * (0.4 - t * 0.22);
    const sh = bodyHeight / segments;
    drawCylinder(ctx, cam, { x: lm.x, z: lm.z, y, radius: r, height: sh, color: i % 2 === 0 ? p.buildingLight : glass });
    if (detailed) {
      for (const u of [-0.6, 0, 0.6]) {
        cylinderFin(ctx, cam, {
          x: lm.x,
          z: lm.z,
          radius: r,
          y0: y,
          y1: y + sh,
          u,
          width: cam.span * 0.004,
          color: mix(p.buildingLight, '#ffffff', 0.5),
          alpha: 0.7,
        });
      }
    }
    cylinderBand(ctx, cam, { x: lm.x, z: lm.z, radius: r * 1.04, y0: y + sh - 0.008, y1: y + sh, color: glow, alpha: 0.95 });
    y += sh;
  }

  // 頂部の光球
  const top = toScreen(cam, lm.x, y + h * 0.04, lm.z);
  drawGlow(ctx, top.x, top.y, cam.span * 0.12, accent, 0.55);
  drawGlow(ctx, top.x, top.y, cam.span * 0.05, '#ffffff', 0.9);
  fillCircle(ctx, top.x, top.y, cam.span * 0.018, mix(accent, '#ffffff', 0.5));
  const needle = cam.span * h * 0.14;
  fillPoly(
    ctx,
    [
      { x: top.x - 1, y: top.y },
      { x: top.x + 1, y: top.y },
      { x: top.x, y: top.y - needle },
    ],
    mix(p.buildingLight, '#ffffff', 0.4),
  );
}

export function aiCoreSpinner(ctx: Ctx, cam: IsoCamera, lm: PlacedDioramaLandmark, p: DioramaPalette, angle: number): void {
  const accent = accentOf(lm, p);
  const glow = glowColor(p);
  const h = lm.height;
  const rings = [
    { y: h * 0.52, r: lm.footprint * 0.34, dir: 1 },
    { y: h * 0.7, r: lm.footprint * 0.26, dir: -1 },
  ];
  for (const ring of rings) {
    strokeRing(ctx, cam, lm.x, ring.y, lm.z, ring.r, glow, Math.max(1, cam.span * 0.003), 0.75);
    for (let i = 0; i < 5; i += 1) {
      const a = angle * ring.dir + (i / 5) * Math.PI * 2;
      const q = toScreen(cam, lm.x + Math.cos(a) * ring.r, ring.y, lm.z + Math.sin(a) * ring.r);
      drawGlow(ctx, q.x, q.y, cam.span * 0.018, i % 2 === 0 ? accent : glow, 0.8);
      fillCircle(ctx, q.x, q.y, Math.max(1.2, cam.span * 0.0045), '#ffffff');
    }
  }
}

/* ------------------------------------------------------------------ *
 * 軌道エレベーター（拡張）
 * ------------------------------------------------------------------ */

export function skyTetherBase(ctx: Ctx, cam: IsoCamera, lm: PlacedDioramaLandmark, p: DioramaPalette, detailed: boolean): void {
  const accent = accentOf(lm, p);
  const glow = glowColor(p);
  const r0 = lm.footprint * 0.44;
  const h = lm.height;

  strokeRing(ctx, cam, lm.x, 0.003, lm.z, r0, glow, Math.max(1.2, cam.span * 0.004), 0.7);
  drawCylinder(ctx, cam, { x: lm.x, z: lm.z, y: 0, radius: r0, height: h * 0.14, color: p.buildingLight });
  cylinderBand(ctx, cam, { x: lm.x, z: lm.z, radius: r0, y0: h * 0.04, y1: h * 0.11, color: mix(p.buildingGlass, '#ffffff', 0.1), alpha: 0.85 });

  // 3 本の脚で支えた錨の塔
  const top = toScreen(cam, lm.x, h, lm.z);
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const foot = toScreen(cam, lm.x + Math.cos(a) * r0 * 0.8, h * 0.14, lm.z + Math.sin(a) * r0 * 0.8);
    fillPoly(
      ctx,
      [
        { x: foot.x - 2.4, y: foot.y },
        { x: foot.x + 2.4, y: foot.y },
        { x: top.x + 1.2, y: top.y + cam.span * h * 0.12 },
        { x: top.x - 1.2, y: top.y + cam.span * h * 0.12 },
      ],
      shade(p.buildingLight, i === 1 ? -0.16 : -0.04),
    );
  }
  drawCylinder(ctx, cam, { x: lm.x, z: lm.z, y: h * 0.8, radius: r0 * 0.36, height: h * 0.2, color: p.buildingLight });
  cylinderBand(ctx, cam, { x: lm.x, z: lm.z, radius: r0 * 0.36, y0: h * 0.9, y1: h * 0.95, color: accent, alpha: 0.95 });

  // 空の上まで伸びる索（画面の上端より先まで）
  const reach = top.y + 40;
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = mix(p.buildingMid, '#ffffff', 0.2);
  ctx.lineWidth = Math.max(1.4, cam.span * 0.004);
  ctx.beginPath();
  ctx.moveTo(top.x, top.y);
  ctx.lineTo(top.x, top.y - reach);
  ctx.stroke();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = glow;
  ctx.lineWidth = Math.max(3, cam.span * 0.012);
  ctx.beginPath();
  ctx.moveTo(top.x, top.y);
  ctx.lineTo(top.x, top.y - reach);
  ctx.stroke();
  ctx.restore();
  if (detailed) drawGlow(ctx, top.x, top.y, cam.span * 0.05, glow, 0.7);
}

export function skyTetherSpinner(ctx: Ctx, cam: IsoCamera, lm: PlacedDioramaLandmark, p: DioramaPalette, angle: number): void {
  const top = toScreen(cam, lm.x, lm.height, lm.z);
  const travel = top.y + 30;
  // 昇る籠と降りる籠
  for (const offset of [0, 0.5]) {
    const t = ((angle / (Math.PI * 2) + offset) % 1 + 1) % 1;
    const y = top.y - travel * (offset === 0 ? t : 1 - t);
    const w = cam.span * 0.02;
    drawGlow(ctx, top.x, y, w * 2.2, glowColor(p), 0.7);
    ctx.globalAlpha = 1;
    ctx.fillStyle = p.buildingLight;
    ctx.beginPath();
    ctx.roundRect(top.x - w / 2, y - w * 0.7, w, w * 1.4, w * 0.3);
    ctx.fill();
    fillCircle(ctx, top.x, y, w * 0.18, accentOf(lm, p));
  }
}

/* ------------------------------------------------------------------ *
 * 温室ドーム（持続）
 * ------------------------------------------------------------------ */

export function arcologyBase(ctx: Ctx, cam: IsoCamera, lm: PlacedDioramaLandmark, p: DioramaPalette, detailed: boolean): void {
  const glow = glowColor(p);
  const r = lm.footprint * 0.46;
  const h = lm.height;
  const ring = drawCylinder(ctx, cam, { x: lm.x, z: lm.z, y: 0, radius: r, height: h * 0.1, color: p.buildingLight, topColor: mix(p.foliage, p.platformTop, 0.2) });
  cylinderBand(ctx, cam, { x: lm.x, z: lm.z, radius: r, y0: h * 0.07, y1: h * 0.1, color: glow, alpha: 0.9 });

  // ドームの中の森（ガラス越しに見える）
  const rng = createRng(`arcology:${lm.id}`);
  for (let i = 0; i < 9; i += 1) {
    const a = rng.range(0, Math.PI * 2);
    const d = Math.sqrt(rng.next()) * r * 0.7;
    const q = toScreen(cam, lm.x + Math.cos(a) * d, h * 0.1, lm.z + Math.sin(a) * d);
    const s = cam.span * rng.range(0.018, 0.034);
    fillCircle(ctx, q.x, q.y - s * 0.8, s, p.foliageDeep);
    fillCircle(ctx, q.x - s * 0.3, q.y - s * 1.1, s * 0.6, shade(p.foliage, 0.12));
  }

  // ガラスのドーム
  const cx = ring.cx;
  const cy = ring.topY;
  const rx = ring.rx;
  const ry = cam.span * h * 0.9;
  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.fillStyle = mix(p.buildingGlass, '#ffffff', 0.25);
  ctx.beginPath();
  ctx.moveTo(cx - rx, cy);
  ctx.bezierCurveTo(cx - rx, cy - ry * 1.33, cx + rx, cy - ry * 1.33, cx + rx, cy);
  ctx.ellipse(cx, cy, rx, ring.ry, 0, 0, Math.PI, false);
  ctx.closePath();
  ctx.fill();
  // 格子（子午線と緯線）
  ctx.globalAlpha = detailed ? 0.6 : 0.4;
  ctx.strokeStyle = mix(p.buildingLight, '#ffffff', 0.5);
  ctx.lineWidth = 1;
  for (let i = 1; i < 6; i += 1) {
    const t = i / 6;
    const x = cx - rx + rx * 2 * t;
    ctx.beginPath();
    ctx.moveTo(x, cy + ring.ry * Math.sqrt(1 - (2 * t - 1) ** 2));
    ctx.quadraticCurveTo(x, cy - ry * (1 - Math.abs(t - 0.5) * 1.1), cx, cy - ry);
    ctx.stroke();
  }
  for (const k of [0.35, 0.68]) {
    ctx.beginPath();
    ctx.ellipse(cx, cy - ry * k, rx * Math.sqrt(1 - k * k), ring.ry * Math.sqrt(1 - k * k), 0, 0, Math.PI);
    ctx.stroke();
  }
  ctx.restore();
  // 受光側のハイライト
  fillEllipse(ctx, cx + rx * 0.35, cy - ry * 0.55, rx * 0.18, ry * 0.26, '#ffffff', 0.45);
  drawGlow(ctx, cx, cy - ry, cam.span * 0.03, glow, 0.8);
}

/* ------------------------------------------------------------------ *
 * 風力タービン（持続）
 * ------------------------------------------------------------------ */

function turbineHub(lm: PlacedDioramaLandmark): { x: number; y: number; z: number } {
  return { x: lm.x, y: lm.height * 0.8, z: lm.z + lm.footprint * 0.12 };
}

export function windTurbineBase(ctx: Ctx, cam: IsoCamera, lm: PlacedDioramaLandmark, p: DioramaPalette): void {
  const base = toScreen(cam, lm.x, 0, lm.z);
  const hub = turbineHub(lm);
  const top = toScreen(cam, lm.x, hub.y, lm.z);
  const k = cam.span / 420;
  const glow = glowColor(p);
  fillDisc(ctx, cam, lm.x, 0.002, lm.z, lm.footprint * 0.42, shade(p.platformTop, -0.06));
  strokeRing(ctx, cam, lm.x, 0.003, lm.z, lm.footprint * 0.28, glow, Math.max(0.8, cam.span * 0.0025), 0.55);
  fillPoly(
    ctx,
    [
      { x: base.x - 3.6 * k, y: base.y },
      { x: base.x + 3.6 * k, y: base.y },
      { x: top.x + 1.25 * k, y: top.y },
      { x: top.x - 1.25 * k, y: top.y },
    ],
    p.buildingLight,
  );
  fillPoly(
    ctx,
    [
      { x: base.x, y: base.y },
      { x: base.x + 3.6 * k, y: base.y },
      { x: top.x + 1.25 * k, y: top.y },
      { x: top.x, y: top.y },
    ],
    shade(p.buildingLight, -0.12),
  );
  // 塔身のリング
  for (const t of [0.28, 0.52, 0.74]) {
    const y = toScreen(cam, lm.x, hub.y * t, lm.z);
    const w = (3.6 - t * 2.1) * k;
    fillPoly(
      ctx,
      [
        { x: y.x - w, y: y.y - 0.8 },
        { x: y.x + w, y: y.y - 0.8 },
        { x: y.x + w, y: y.y + 0.8 },
        { x: y.x - w, y: y.y + 0.8 },
      ],
      mix(p.buildingMid, glow, 0.35),
      0.85,
    );
  }
  // ナセル（本体＋ノーズコーン）
  drawBox(ctx, cam, {
    x: lm.x,
    z: lm.z + lm.footprint * 0.04,
    y: hub.y - 0.014,
    width: 0.03,
    depth: lm.footprint * 0.26,
    height: 0.028,
    color: p.buildingLight,
    topColor: mix(p.buildingLight, '#ffffff', 0.35),
  });
  drawCylinder(ctx, cam, {
    x: lm.x,
    z: lm.z + lm.footprint * 0.16,
    y: hub.y - 0.01,
    radius: 0.012,
    height: 0.02,
    color: mix(p.buildingLight, p.buildingGlass, 0.25),
  });
}

export function windTurbineSpinner(ctx: Ctx, cam: IsoCamera, lm: PlacedDioramaLandmark, p: DioramaPalette, angle: number): void {
  const h = turbineHub(lm);
  const hub = toScreen(cam, h.x, h.y, h.z);
  const alongX = toScreen(cam, h.x + 1, h.y, h.z);
  const up = toScreen(cam, h.x, h.y + 1, h.z);
  const axisX = { x: alongX.x - hub.x, y: alongX.y - hub.y };
  const axisUp = { x: up.x - hub.x, y: up.y - hub.y };
  const length = lm.height * 0.44;

  if (nearlyEdgeOn(axisX, axisUp)) {
    const len = Math.hypot(axisUp.x, axisUp.y) || 1;
    const reach = length * len;
    fillPoly(
      ctx,
      [
        { x: hub.x - 0.9, y: hub.y - reach },
        { x: hub.x + 0.9, y: hub.y - reach },
        { x: hub.x + 0.9, y: hub.y + reach },
        { x: hub.x - 0.9, y: hub.y + reach },
      ],
      mix(p.buildingLight, '#ffffff', 0.25),
    );
    return;
  }

  ctx.save();
  ctx.transform(axisX.x, axisX.y, axisUp.x, axisUp.y, hub.x, hub.y);
  ctx.rotate(angle);
  for (let i = 0; i < 3; i += 1) {
    ctx.save();
    ctx.rotate((i / 3) * Math.PI * 2);
    // 翼根 → 翼弦が広がって先端で細くなる翼型
    fillPoly(
      ctx,
      [
        { x: 0, y: -length * 0.04 },
        { x: length * 0.18, y: -length * 0.09 },
        { x: length * 0.62, y: -length * 0.055 },
        { x: length, y: -length * 0.01 },
        { x: length, y: length * 0.006 },
        { x: length * 0.62, y: length * 0.028 },
        { x: length * 0.18, y: length * 0.05 },
        { x: 0, y: length * 0.035 },
      ],
      mix(p.buildingLight, '#ffffff', 0.45),
    );
    fillPoly(
      ctx,
      [
        { x: length * 0.18, y: -length * 0.09 },
        { x: length * 0.62, y: -length * 0.055 },
        { x: length * 0.62, y: -length * 0.012 },
        { x: length * 0.18, y: -length * 0.018 },
      ],
      '#ffffff',
      0.28,
    );
    fillPoly(
      ctx,
      [
        { x: length * 0.86, y: -length * 0.016 },
        { x: length, y: -length * 0.01 },
        { x: length, y: length * 0.006 },
        { x: length * 0.86, y: length * 0.008 },
      ],
      p.accentPrimary,
    );
    ctx.restore();
  }
  fillCircle(ctx, 0, 0, length * 0.085, p.buildingLight);
  fillCircle(ctx, 0, 0, length * 0.042, mix(p.buildingGlass, '#ffffff', 0.35));
  ctx.restore();
}

/* ------------------------------------------------------------------ *
 * 太陽光の樹（分散）
 * ------------------------------------------------------------------ */

export function solarTreeBase(ctx: Ctx, cam: IsoCamera, lm: PlacedDioramaLandmark, p: DioramaPalette): void {
  const glow = glowColor(p);
  const h = lm.height;
  const panel = mix(p.panel, p.buildingGlass, 0.25);
  strokeRing(ctx, cam, lm.x, 0.003, lm.z, lm.footprint * 0.46, glow, Math.max(1, cam.span * 0.003), 0.8);
  fillDisc(ctx, cam, lm.x, 0.002, lm.z, lm.footprint * 0.42, glow, 0.14);
  drawCylinder(ctx, cam, { x: lm.x, z: lm.z, y: 0, radius: lm.footprint * 0.05, height: h * 0.86, color: p.buildingLight });

  // 高さの違う 4 枚の葉（太陽光パネル）
  const leaves = [
    { a: 0.3, y: 0.46, r: 0.34 },
    { a: 2.2, y: 0.6, r: 0.3 },
    { a: 4.1, y: 0.72, r: 0.3 },
    { a: 1.2, y: 0.9, r: 0.4 },
  ];
  for (const leaf of leaves) {
    const cx = lm.x + Math.cos(leaf.a) * lm.footprint * 0.18;
    const cz = lm.z + Math.sin(leaf.a) * lm.footprint * 0.18;
    const s = lm.footprint * leaf.r;
    const y = h * leaf.y;
    const quad = [
      toScreen(cam, cx - s, y - 0.006, cz - s),
      toScreen(cam, cx + s, y - 0.006, cz - s),
      toScreen(cam, cx + s, y + 0.01, cz + s),
      toScreen(cam, cx - s, y + 0.01, cz + s),
    ];
    const stem = toScreen(cam, lm.x, y, lm.z);
    const tip = toScreen(cam, cx, y, cz);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = shade(p.buildingLight, -0.1);
    ctx.lineWidth = Math.max(1, cam.span * 0.003);
    ctx.beginPath();
    ctx.moveTo(stem.x, stem.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();
    fillPoly(ctx, quad, panel, 0.96);
    fillPoly(ctx, [quad[2]!, quad[3]!, { x: quad[3]!.x, y: quad[3]!.y + 1.5 }, { x: quad[2]!.x, y: quad[2]!.y + 1.5 }], glow, 0.9);
  }
  const top = toScreen(cam, lm.x, h * 0.9, lm.z);
  drawGlow(ctx, top.x, top.y, cam.span * 0.03, glow, 0.6);
}

/* ------------------------------------------------------------------ *
 * 空の港（開く）
 * ------------------------------------------------------------------ */

export function vertiportBase(ctx: Ctx, cam: IsoCamera, lm: PlacedDioramaLandmark, p: DioramaPalette, detailed: boolean): void {
  const accent = accentOf(lm, p);
  const glow = glowColor(p);
  const r = lm.footprint * 0.46;
  const h = lm.height;
  const deckY = h * 0.5;

  drawCylinder(ctx, cam, { x: lm.x, z: lm.z, y: 0, radius: r * 0.55, height: deckY, color: p.buildingLight });
  cylinderBand(ctx, cam, { x: lm.x, z: lm.z, radius: r * 0.55, y0: deckY * 0.2, y1: deckY * 0.8, color: mix(p.buildingGlass, '#ffffff', 0.12), alpha: 0.85 });
  // 張り出した甲板
  drawCylinder(ctx, cam, { x: lm.x, z: lm.z, y: deckY, radius: r, height: 0.022, color: p.buildingLight, topColor: shade(p.buildingMid, -0.15) });
  cylinderBand(ctx, cam, { x: lm.x, z: lm.z, radius: r, y0: deckY, y1: deckY + 0.008, color: glow, alpha: 0.9 });
  strokeRing(ctx, cam, lm.x, deckY + 0.023, lm.z, r * 0.72, glow, Math.max(1.2, cam.span * 0.004), 0.95);
  strokeRing(ctx, cam, lm.x, deckY + 0.023, lm.z, r * 0.3, accent, Math.max(1.2, cam.span * 0.004), 0.95);
  if (detailed) {
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      const q = toScreen(cam, lm.x + Math.cos(a) * r * 0.92, deckY + 0.023, lm.z + Math.sin(a) * r * 0.92);
      drawGlow(ctx, q.x, q.y, cam.span * 0.012, glow, 0.9);
    }
  }

  // 停まっている垂直離着陸機
  const craft = toScreen(cam, lm.x + r * 0.1, deckY + 0.04, lm.z - r * 0.05);
  const s = cam.span * r * 0.32;
  fillEllipse(ctx, craft.x, craft.y + s * 0.32, s * 1.35, s * 0.42, p.shadow, 0.26);
  for (const [dx, dy] of [
    [-1.15, -0.22],
    [1.15, -0.22],
    [-0.85, 0.38],
    [0.85, 0.38],
  ] as const) {
    fillEllipse(ctx, craft.x + dx * s, craft.y + dy * s - s * 0.22, s * 0.46, s * 0.15, mix(p.buildingGlass, '#ffffff', 0.38), 0.78);
    fillCircle(ctx, craft.x + dx * s, craft.y + dy * s - s * 0.22, Math.max(0.8, s * 0.08), p.buildingLight);
  }
  fillEllipse(ctx, craft.x, craft.y - s * 0.08, s * 0.82, s * 0.3, p.buildingLight);
  fillEllipse(ctx, craft.x - s * 0.08, craft.y - s * 0.16, s * 0.42, s * 0.14, mix(p.buildingLight, '#ffffff', 0.35));
  fillEllipse(ctx, craft.x + s * 0.22, craft.y - s * 0.2, s * 0.3, s * 0.14, p.glassDeep);
  fillEllipse(ctx, craft.x + s * 0.18, craft.y - s * 0.24, s * 0.12, s * 0.06, '#ffffff', 0.35);
  fillCircle(ctx, craft.x - s * 0.55, craft.y - s * 0.04, Math.max(1, s * 0.08), glow);

  // 管制塔
  const tx = lm.x - r * 0.7;
  const tz = lm.z + r * 0.4;
  drawCylinder(ctx, cam, { x: tx, z: tz, y: 0, radius: r * 0.12, height: h * 0.9, color: p.buildingLight });
  drawCylinder(ctx, cam, { x: tx, z: tz, y: h * 0.9, radius: r * 0.2, height: h * 0.12, color: p.glassDeep });
  const beacon = toScreen(cam, tx, h * 1.04, tz);
  drawGlow(ctx, beacon.x, beacon.y, cam.span * 0.02, accent, 0.8);
}

/* ------------------------------------------------------------------ *
 * 監視塔（管理）
 * ------------------------------------------------------------------ */

export function watchPylonBase(ctx: Ctx, cam: IsoCamera, lm: PlacedDioramaLandmark, p: DioramaPalette): void {
  const r = lm.footprint * 0.3;
  const h = lm.height;
  drawCylinder(ctx, cam, { x: lm.x, z: lm.z, y: 0, radius: r * 1.4, height: 0.012, color: shade(p.buildingMid, -0.1) });
  drawCylinder(ctx, cam, { x: lm.x, z: lm.z, y: 0.012, radius: r * 0.55, height: h * 0.84, color: shade(p.buildingMid, -0.08) });
  cylinderBand(ctx, cam, { x: lm.x, z: lm.z, radius: r * 0.56, y0: h * 0.2, y1: h * 0.8, color: '#ffffff', alpha: 0.12 });
  // 頭部（監視灯は淡い機能色で、面積を取らない）
  drawCylinder(ctx, cam, { x: lm.x, z: lm.z, y: h * 0.84, radius: r * 1.2, height: h * 0.1, color: p.buildingLight, topColor: shade(p.buildingMid, -0.15) });
  cylinderBand(ctx, cam, { x: lm.x, z: lm.z, radius: r * 1.2, y0: h * 0.87, y1: h * 0.91, color: p.alert, alpha: 0.63 });
  const eye = toScreen(cam, lm.x, h * 0.89, lm.z);
  drawGlow(ctx, eye.x, eye.y, cam.span * 0.04, p.alert, 0.3);
}

export function watchPylonSpinner(ctx: Ctx, cam: IsoCamera, lm: PlacedDioramaLandmark, p: DioramaPalette, angle: number): void {
  const head = toScreen(cam, lm.x, lm.height * 0.89, lm.z);
  const reach = 0.42;
  const spread = 0.22;
  const g0 = toScreen(cam, lm.x + Math.cos(angle - spread) * reach, 0.004, lm.z + Math.sin(angle - spread) * reach);
  const g1 = toScreen(cam, lm.x + Math.cos(angle + spread) * reach, 0.004, lm.z + Math.sin(angle + spread) * reach);
  const gm = toScreen(cam, lm.x + Math.cos(angle) * reach * 0.9, 0.004, lm.z + Math.sin(angle) * reach * 0.9);
  fillPoly(ctx, [head, g0, g1], p.alert, 0.07);
  fillPoly(ctx, [toScreen(cam, lm.x, 0.004, lm.z), g0, g1], p.alert, 0.07);
  drawGlow(ctx, gm.x, gm.y, cam.span * 0.06, p.alert, 0.24);
}
