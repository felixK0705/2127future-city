import { mix, shade } from '../color';
import {
  drawBox,
  drawCylinder,
  drawGlow,
  faceRect,
  fillCircle,
  fillEllipse,
  fillPoly,
  glowColor,
  toScreen,
  type Ctx,
  type IsoCamera,
} from './canvasPrimitives';
import type {
  DioramaDrone,
  DioramaGuideway,
  DioramaPalette,
  DioramaSkybridge,
  DioramaWallSegment,
} from './types';

/**
 * 街の骨組み（外周の障壁・空中回廊・高架軌道）と、空を行き来する小型機。
 * 選択の傾きがいちばん直接に目に見える部分なので、形は単純でも輪郭を光らせて目立たせる。
 */

/** 障壁の 1 区間。半透明の光の膜と、足元の基礎・柱。門は 2 本の柱と光の梁。 */
export function drawWallSegment(ctx: Ctx, cam: IsoCamera, seg: DioramaWallSegment, palette: DioramaPalette): void {
  const glow = glowColor(palette);
  if (seg.gate) {
    for (const [x, z] of [
      [seg.x0, seg.z0],
      [seg.x1, seg.z1],
    ] as const) {
      drawCylinder(ctx, cam, { x, z, y: 0, radius: 0.02, height: seg.height * 2, color: shade(palette.buildingMid, -0.15) });
      const cap = toScreen(cam, x, seg.height * 2, z);
      drawGlow(ctx, cap.x, cap.y, cam.span * 0.02, palette.alert, 0.53);
    }
    const a = toScreen(cam, seg.x0, seg.height * 1.8, seg.z0);
    const b = toScreen(cam, seg.x1, seg.height * 1.8, seg.z1);
    const t = Math.max(1.2, cam.span * 0.005);
    fillPoly(
      ctx,
      [
        { x: a.x, y: a.y - t },
        { x: b.x, y: b.y - t },
        { x: b.x, y: b.y + t },
        { x: a.x, y: a.y + t },
      ],
      palette.alert,
      0.6,
    );
    return;
  }

  const b0 = toScreen(cam, seg.x0, 0, seg.z0);
  const b1 = toScreen(cam, seg.x1, 0, seg.z1);
  const plinth = cam.span * 0.014;
  const top = cam.span * seg.height;
  // 基礎
  fillPoly(
    ctx,
    [b0, b1, { x: b1.x, y: b1.y - plinth }, { x: b0.x, y: b0.y - plinth }],
    shade(palette.buildingMid, -0.15),
  );
  // 光の膜
  fillPoly(
    ctx,
    [
      { x: b0.x, y: b0.y - plinth },
      { x: b1.x, y: b1.y - plinth },
      { x: b1.x, y: b1.y - top },
      { x: b0.x, y: b0.y - top },
    ],
    glow,
    0.26,
  );
  // 上端の光の線
  const line = Math.max(0.8, cam.span * 0.0025);
  fillPoly(
    ctx,
    [
      { x: b0.x, y: b0.y - top - line },
      { x: b1.x, y: b1.y - top - line },
      { x: b1.x, y: b1.y - top + line },
      { x: b0.x, y: b0.y - top + line },
    ],
    mix(glow, '#ffffff', 0.4),
    0.95,
  );
  // 柱
  const w = Math.max(1, cam.span * 0.003);
  fillPoly(
    ctx,
    [
      { x: b0.x - w, y: b0.y },
      { x: b0.x + w, y: b0.y },
      { x: b0.x + w, y: b0.y - top - line },
      { x: b0.x - w, y: b0.y - top - line },
    ],
    shade(palette.buildingMid, -0.15),
  );
}

/** 空中回廊（ガラスの筒）。 */
export function drawSkybridge(ctx: Ctx, cam: IsoCamera, bridge: DioramaSkybridge, palette: DioramaPalette): void {
  const alongX = Math.abs(bridge.x1 - bridge.x0) >= Math.abs(bridge.z1 - bridge.z0);
  const length = alongX ? Math.abs(bridge.x1 - bridge.x0) : Math.abs(bridge.z1 - bridge.z0);
  if (length < 0.005) return;
  const tube = drawBox(ctx, cam, {
    x: (bridge.x0 + bridge.x1) / 2,
    z: (bridge.z0 + bridge.z1) / 2,
    y: bridge.y,
    width: alongX ? length : 0.036,
    depth: alongX ? 0.036 : length,
    height: 0.026,
    color: mix(palette.buildingGlass, '#ffffff', 0.15),
    topColor: palette.buildingLight,
  });
  for (const face of tube.faces) {
    faceRect(ctx, face.basis, 0, 0.3, 1, 0.8, palette.glassDeep, 0.7);
    faceRect(ctx, face.basis, 0, 0, 1, 0.12, glowColor(palette), 0.9);
  }
}

/** 高架軌道の 1 区画ぶんの桁（と、ときどき橋脚）。 */
export function drawGuideway(ctx: Ctx, cam: IsoCamera, g: DioramaGuideway, palette: DioramaPalette): void {
  if (g.pier) {
    drawCylinder(ctx, cam, { x: g.x, z: g.z, y: 0, radius: 0.014, height: g.y - 0.016, color: palette.buildingLight });
  }
  const beam = drawBox(ctx, cam, {
    x: g.x,
    z: g.z,
    y: g.y - 0.016,
    width: g.axis === 'x' ? g.length * 1.01 : 0.036,
    depth: g.axis === 'z' ? g.length * 1.01 : 0.036,
    height: 0.016,
    color: palette.buildingLight,
    topColor: shade(palette.buildingMid, -0.12),
  });
  for (const face of beam.faces) faceRect(ctx, face.basis, 0, 0.72, 1, 0.9, glowColor(palette), 0.85);
}

/** 高架軌道を走るリニアの 1 両。 */
export function drawTrainCar(
  ctx: Ctx,
  cam: IsoCamera,
  spec: { x: number; z: number; y: number; alongX: boolean; head: boolean; palette: DioramaPalette },
): void {
  const { palette } = spec;
  const len = 0.085;
  const car = drawBox(ctx, cam, {
    x: spec.x,
    z: spec.z,
    y: spec.y + 0.004,
    width: spec.alongX ? len : 0.032,
    depth: spec.alongX ? 0.032 : len,
    height: 0.026,
    color: palette.buildingLight,
    topColor: mix(palette.buildingLight, '#ffffff', 0.4),
  });
  for (const face of car.faces) {
    faceRect(ctx, face.basis, 0.04, 0.42, 0.96, 0.86, palette.glassDeep, 0.93);
    faceRect(ctx, face.basis, 0, 0.14, 1, 0.24, palette.accentPrimary, 0.92);
    faceRect(ctx, face.basis, 0.06, 0.68, 0.34, 0.8, '#ffffff', 0.2);
    for (let i = 1; i < 4; i += 1) {
      const u = 0.05 + (0.9 / 4) * i;
      faceRect(ctx, face.basis, u - 0.01, 0.42, u + 0.01, 0.86, mix(palette.buildingLight, '#ffffff', 0.3), 0.55);
    }
  }
  if (spec.head) {
    const nose = toScreen(cam, spec.x, spec.y + 0.018, spec.z);
    drawGlow(ctx, nose.x, nose.y, cam.span * 0.03, '#ffffff', 0.68);
    fillCircle(ctx, nose.x, nose.y, Math.max(1, cam.span * 0.005), '#ffffff');
  }
}

/** 小型機の現在位置（周回軌道の上）。 */
export function dronePosition(drone: DioramaDrone, t: number): { x: number; y: number; z: number } {
  const a = drone.phase + drone.speed * t;
  return {
    x: Math.cos(a) * drone.radius,
    y: drone.y + Math.sin(t * 1.3 + drone.phase) * 0.02,
    z: Math.sin(a) * drone.radius,
  };
}

/** 小型機。巡回機は淡い機能色の灯と地面へ落ちる走査光、配送機はアクセントの灯と小さな荷物。 */
export function drawDrone(ctx: Ctx, cam: IsoCamera, drone: DioramaDrone, t: number, palette: DioramaPalette): void {
  const at = dronePosition(drone, t);
  const p = toScreen(cam, at.x, at.y, at.z);
  const ground = toScreen(cam, at.x, 0.002, at.z);
  const s = cam.span * 0.018;
  const patrol = drone.kind === 'patrol';
  const light = patrol ? palette.alert : glowColor(palette);
  const body = patrol ? shade(palette.buildingMid, -0.08) : palette.buildingLight;

  fillEllipse(ctx, ground.x, ground.y, s * 1.6, s * 0.65, palette.shadow, 0.14);
  if (patrol) {
    fillPoly(
      ctx,
      [
        { x: p.x, y: p.y + s * 0.5 },
        { x: ground.x - s * 3.2, y: ground.y },
        { x: ground.x + s * 3.2, y: ground.y },
      ],
      light,
      0.06,
    );
    fillEllipse(ctx, ground.x, ground.y, s * 3.2, s * 1.25, light, 0.08);
  } else {
    ctx.globalAlpha = 1;
    ctx.fillStyle = palette.accentSecondary;
    ctx.beginPath();
    ctx.roundRect(p.x - s * 0.32, p.y + s * 0.36, s * 0.64, s * 0.42, s * 0.08);
    ctx.fill();
    ctx.fillStyle = mix(palette.accentSecondary, '#ffffff', 0.35);
    ctx.fillRect(p.x - s * 0.22, p.y + s * 0.4, s * 0.44, s * 0.12);
  }

  const arms: readonly (readonly [number, number])[] = [
    [-1.05, -0.48],
    [1.05, -0.48],
    [-1.05, 0.28],
    [1.05, 0.28],
  ];
  ctx.strokeStyle = shade(body, -0.12);
  ctx.lineWidth = Math.max(1.1, s * 0.16);
  ctx.lineCap = 'round';
  for (const [dx, dy] of arms) {
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + dx * s, p.y + dy * s);
    ctx.stroke();
  }

  const blur = mix(palette.buildingGlass, '#ffffff', 0.42);
  const spin = t * 28 + drone.phase * 6;
  for (const [dx, dy] of arms) {
    const cx = p.x + dx * s;
    const cy = p.y + dy * s;
    fillEllipse(ctx, cx, cy, s * 0.7, s * 0.22, blur, 0.55);
    fillEllipse(ctx, cx, cy, s * 0.55, s * 0.16, mix(blur, '#ffffff', 0.4), 0.35);
    fillCircle(ctx, cx, cy, Math.max(0.8, s * 0.1), body);
    const blade = 0.5 + 0.5 * Math.sin(spin + dx);
    fillEllipse(ctx, cx, cy, s * (0.38 + 0.2 * blade), s * 0.06, mix(palette.buildingMid, '#ffffff', 0.2), 0.45);
  }

  fillEllipse(ctx, p.x, p.y, s * 0.78, s * 0.36, body);
  fillEllipse(ctx, p.x, p.y - s * 0.06, s * 0.48, s * 0.2, mix(body, '#ffffff', 0.35));
  fillEllipse(ctx, p.x + s * 0.08, p.y - s * 0.02, s * 0.22, s * 0.12, palette.glassDeep, 0.9);
  fillCircle(ctx, p.x, p.y + s * 0.18, Math.max(0.9, s * 0.1), shade(body, -0.1));

  const blink = 0.5 + 0.5 * Math.sin(t * 6 + drone.phase * 3);
  drawGlow(ctx, p.x, p.y, s * 1.9, light, 0.28 + 0.38 * blink);
  fillCircle(ctx, p.x - s * 0.42, p.y - s * 0.02, Math.max(0.8, s * 0.09), light);
  fillCircle(ctx, p.x + s * 0.42, p.y - s * 0.02, Math.max(0.8, s * 0.09), '#ffffff');
}
