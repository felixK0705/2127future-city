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
      drawCylinder(ctx, cam, { x, z, y: 0, radius: 0.02, height: seg.height * 2, color: shade(palette.buildingMid, -0.2) });
      const cap = toScreen(cam, x, seg.height * 2, z);
      drawGlow(ctx, cap.x, cap.y, cam.span * 0.02, '#ff5a6a', 0.8);
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
      '#ff5a6a',
      0.9,
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
    shade(palette.buildingMid, -0.28),
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
    shade(palette.buildingMid, -0.2),
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
    faceRect(ctx, face.basis, 0, 0.3, 1, 0.8, mix(palette.buildingGlass, '#1d2a3a', 0.25), 0.7);
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
    faceRect(ctx, face.basis, 0.04, 0.46, 0.96, 0.8, mix(palette.buildingGlass, '#1d2a3a', 0.4), 0.92);
    faceRect(ctx, face.basis, 0, 0.16, 1, 0.26, palette.accentPrimary, 0.9);
  }
  if (spec.head) {
    const nose = toScreen(cam, spec.x, spec.y + 0.018, spec.z);
    drawGlow(ctx, nose.x, nose.y, cam.span * 0.025, '#ffffff', 0.6);
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

/** 小型機。巡回機は赤い灯と地面へ落ちる淡い走査光、配送機は青い灯と小さな荷物。 */
export function drawDrone(ctx: Ctx, cam: IsoCamera, drone: DioramaDrone, t: number, palette: DioramaPalette): void {
  const at = dronePosition(drone, t);
  const p = toScreen(cam, at.x, at.y, at.z);
  const ground = toScreen(cam, at.x, 0.002, at.z);
  const s = cam.span * 0.016;
  const patrol = drone.kind === 'patrol';
  const light = patrol ? '#ff4f5e' : glowColor(palette);

  fillEllipse(ctx, ground.x, ground.y, s * 1.4, s * 0.6, palette.shadow, 0.12);
  if (patrol) {
    fillPoly(
      ctx,
      [
        { x: p.x, y: p.y + s * 0.4 },
        { x: ground.x - s * 3, y: ground.y },
        { x: ground.x + s * 3, y: ground.y },
      ],
      light,
      0.07,
    );
    fillEllipse(ctx, ground.x, ground.y, s * 3, s * 1.2, light, 0.1);
  } else {
    ctx.globalAlpha = 1;
    ctx.fillStyle = palette.accentSecondary;
    ctx.fillRect(p.x - s * 0.35, p.y + s * 0.3, s * 0.7, s * 0.5);
  }
  // 4 つの回転翼
  const blur = mix(palette.buildingGlass, '#ffffff', 0.5);
  for (const [dx, dy] of [
    [-1, -0.45],
    [1, -0.45],
    [-1, 0.25],
    [1, 0.25],
  ] as const) {
    fillEllipse(ctx, p.x + dx * s, p.y + dy * s, s * 0.62, s * 0.2, blur, 0.75);
  }
  fillEllipse(ctx, p.x, p.y, s * 0.72, s * 0.34, patrol ? shade(palette.buildingMid, -0.45) : palette.buildingLight);
  const blink = 0.5 + 0.5 * Math.sin(t * 6 + drone.phase * 3);
  drawGlow(ctx, p.x, p.y, s * 1.8, light, 0.35 + 0.4 * blink);
  fillCircle(ctx, p.x, p.y - s * 0.05, Math.max(1, s * 0.16), light);
}
