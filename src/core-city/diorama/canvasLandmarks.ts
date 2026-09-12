import { mix, shade } from '../color';
import { createRng } from '../rng';
import {
  drawBox,
  drawPyramidRoof,
  faceRect,
  fillCircle,
  fillEllipse,
  fillPoly,
  toScreen,
  type Ctx,
  type IsoCamera,
  type VisibleFace,
} from './canvasPrimitives';
import type {
  DioramaLandmarkKind,
  DioramaPalette,
  PlacedDioramaLandmark,
} from './types';
import {
  aiCoreBase,
  aiCoreSpinner,
  arcologyBase,
  skyTetherBase,
  skyTetherSpinner,
  solarTreeBase,
  vertiportBase,
  watchPylonBase,
  watchPylonSpinner,
  windTurbineBase,
  windTurbineSpinner,
} from './canvasFuture';

/**
 * 目印になる建造物の造形（Canvas2D）。
 *
 * 「白基調＋アクセントは 1〜2 箇所」という規則の中で、
 * 開口部・手すり・段・軒といった要素まで描いて模型らしさを出す。
 * 回る部品（風車・観覧車）は base と spinner に分け、
 * base は静止画としてキャッシュ、spinner だけを毎フレーム描く。
 */

export function landmarkSpinSeconds(kind: DioramaLandmarkKind): number | null {
  if (kind === 'windmill') return 9;
  if (kind === 'ferrisWheel') return 26;
  if (kind === 'windTurbine') return 5;
  if (kind === 'aiCore') return 14;
  if (kind === 'skyTether') return 16;
  if (kind === 'watchPylon') return 7;
  return null;
}

function accentColor(landmark: PlacedDioramaLandmark, palette: DioramaPalette): string {
  if (landmark.accent === 'primary') return palette.accentPrimary;
  if (landmark.accent === 'secondary') return palette.accentSecondary;
  return palette.buildingMid;
}

/** 面に窓を並べる小さな補助。 */
function faceWindows(
  ctx: Ctx,
  face: VisibleFace,
  cols: number,
  rows: number,
  glass: string,
  frame: string,
  detailed: boolean,
  v0 = 0.12,
  v1 = 0.9,
): void {
  const cellU = 0.84 / Math.max(1, cols);
  const cellV = (v1 - v0) / Math.max(1, rows);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const u0 = 0.08 + cellU * c + cellU * 0.18;
      const u1 = 0.08 + cellU * c + cellU * 0.82;
      const a = v0 + cellV * r + cellV * 0.22;
      const b = v0 + cellV * r + cellV * 0.78;
      if (detailed) faceRect(ctx, face.basis, u0 - 0.007, a - 0.007, u1 + 0.007, b + 0.007, frame, 0.8);
      faceRect(ctx, face.basis, u0, a, u1, b, glass, 0.75);
    }
  }
}

/* ------------------------------------------------------------------ *
 * base
 * ------------------------------------------------------------------ */

function signalTower(
  ctx: Ctx,
  cam: IsoCamera,
  lm: PlacedDioramaLandmark,
  p: DioramaPalette,
  detailed: boolean,
): void {
  const accent = accentColor(lm, p);
  const segments = 6;
  const base = lm.footprint * 0.42;
  const bodyHeight = lm.height * 0.76;
  let y = 0;

  for (let i = 0; i < segments; i += 1) {
    const t = i / segments;
    const size = base * (1 - t * 0.7);
    const height = bodyHeight / segments;
    const seg = drawBox(ctx, cam, {
      x: lm.x,
      z: lm.z,
      y,
      width: size,
      depth: size,
      height,
      color: p.buildingLight,
    });
    // 鉄骨の斜材
    if (detailed) {
      for (const face of seg.faces) {
        faceRect(ctx, face.basis, 0.04, 0, 0.1, 1, shade(p.buildingMid, -0.2), 0.55);
        faceRect(ctx, face.basis, 0.9, 0, 0.96, 1, shade(p.buildingMid, -0.2), 0.55);
        faceRect(ctx, face.basis, 0.1, 0.46, 0.9, 0.54, shade(p.buildingMid, -0.12), 0.4);
      }
    }
    y += height;
    if (i < segments - 1) {
      drawBox(ctx, cam, {
        x: lm.x,
        z: lm.z,
        y,
        width: size * 1.06,
        depth: size * 1.06,
        height: height * 0.14,
        color: accent,
      });
      y += height * 0.14;
    }
  }

  // 展望台（少し張り出す）
  const deck = drawBox(ctx, cam, {
    x: lm.x,
    z: lm.z,
    y: bodyHeight * 0.6,
    width: base * 0.78,
    depth: base * 0.78,
    height: lm.height * 0.075,
    color: p.buildingLight,
    topColor: p.buildingGlass,
  });
  for (const face of deck.faces) {
    faceRect(ctx, face.basis, 0.06, 0.2, 0.94, 0.82, mix(p.buildingGlass, '#ffffff', 0.2), 0.8);
  }

  const top = toScreen(cam, lm.x, y, lm.z);
  const mast = lm.height * 0.22 * cam.span;
  fillPoly(
    ctx,
    [
      { x: top.x - 1.8, y: top.y },
      { x: top.x + 1.8, y: top.y },
      { x: top.x + 0.9, y: top.y - mast },
      { x: top.x - 0.9, y: top.y - mast },
    ],
    accent,
  );
  fillCircle(ctx, top.x, top.y - mast - 3, 3.6, p.accentSecondary);
}

function clockTower(
  ctx: Ctx,
  cam: IsoCamera,
  lm: PlacedDioramaLandmark,
  p: DioramaPalette,
  detailed: boolean,
): void {
  const accent = accentColor(lm, p);
  const size = lm.footprint * 0.42;
  const bodyHeight = lm.height * 0.74;
  const glass = mix(p.buildingGlass, '#ffffff', 0.25);
  const frame = mix(p.buildingLight, '#ffffff', 0.5);

  const body = drawBox(ctx, cam, {
    x: lm.x,
    z: lm.z,
    y: 0,
    width: size,
    depth: size,
    height: bodyHeight,
    color: p.buildingLight,
  });

  // 時計盤は 4 面すべてに付ける（手前の 1 面だけにすると、回すたびに盤が別の面へ跳ぶ）。
  // 面の座標系へ変換してから円を描くので、盤は壁と同じ角度で正しく潰れて見える。
  const ry = (size * 0.3) / bodyHeight;
  for (const face of body.faces) {
    faceWindows(ctx, face, 2, 4, glass, frame, detailed, 0.1, 0.66);
    const { origin, du, dv } = face.basis;
    // 真横を向いた面（幅 1px に満たない細い帯）には盤を描かない。見えないうえ、
    // 潰れかけた行列で楕円を描くとラスタライズが極端に重くなる環境がある
    if (nearlyEdgeOn(du, dv)) continue;
    ctx.save();
    ctx.transform(du.x, du.y, dv.x, dv.y, origin.x, origin.y);
    ctx.globalAlpha = 1;
    ctx.fillStyle = frame;
    ctx.beginPath();
    ctx.ellipse(0.5, 0.82, 0.34, ry * 1.13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = mix('#ffffff', p.buildingLight, 0.2);
    ctx.beginPath();
    ctx.ellipse(0.5, 0.82, 0.29, ry * 0.97, 0, 0, Math.PI * 2);
    ctx.fill();
    if (detailed) {
      // 面の座標は v が上向き。短針は真上、長針は右
      ctx.fillStyle = shade(p.buildingMid, -0.5);
      ctx.fillRect(0.488, 0.82, 0.024, ry * 0.62);
      ctx.fillRect(0.5, 0.82 - ry * 0.05, 0.2, ry * 0.1);
    }
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.ellipse(0.5, 0.82, 0.035, ry * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 軒
  drawBox(ctx, cam, {
    x: lm.x,
    z: lm.z,
    y: bodyHeight,
    width: size * 1.24,
    depth: size * 1.24,
    height: 0.016,
    color: p.roof,
  });
  drawPyramidRoof(ctx, cam, {
    x: lm.x,
    z: lm.z,
    y: bodyHeight + 0.016,
    half: size * 0.62,
    height: lm.height * 0.26,
    color: accent,
  });
}

function domeHall(
  ctx: Ctx,
  cam: IsoCamera,
  lm: PlacedDioramaLandmark,
  p: DioramaPalette,
  detailed: boolean,
): void {
  const accent = accentColor(lm, p);
  const width = lm.footprint * 0.86;
  const bodyHeight = lm.height * 0.5;
  const glass = mix(p.buildingGlass, '#ffffff', 0.25);
  const frame = mix(p.buildingLight, '#ffffff', 0.5);

  const body = drawBox(ctx, cam, {
    x: lm.x,
    z: lm.z,
    y: 0,
    width,
    depth: width * 0.8,
    height: bodyHeight,
    color: p.buildingLight,
  });

  for (const face of body.faces) {
    // 柱列（等間隔の縦材）と、その間のアーチ窓
    const columns = Math.max(4, Math.round(face.width / 0.05));
    for (let i = 0; i < columns; i += 1) {
      const u = 0.06 + (0.88 / columns) * i;
      const w = (0.88 / columns) * 0.34;
      if (detailed) faceRect(ctx, face.basis, u, 0.05, u + w, 0.86, shade(p.buildingLight, -0.08), 0.9);
      faceRect(ctx, face.basis, u + w, 0.16, u + (0.88 / columns) * 0.92, 0.76, glass, 0.55);
    }
    faceRect(ctx, face.basis, 0.02, 0.86, 0.98, 0.95, frame, 0.9);
  }

  // ドーム
  const center = toScreen(cam, lm.x, bodyHeight, lm.z);
  const rx = width * cam.span * 0.34;
  const ry = lm.height * 0.42 * cam.span;
  fillEllipse(ctx, center.x, center.y, rx * 1.06, rx * 0.5, shade(p.roof, -0.12));

  ctx.fillStyle = mix(p.buildingLight, p.roof, 0.3);
  ctx.beginPath();
  ctx.moveTo(center.x - rx, center.y);
  ctx.bezierCurveTo(center.x - rx, center.y - ry, center.x + rx, center.y - ry, center.x + rx, center.y);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 0.7;
  ctx.fillStyle = shade(p.buildingLight, 0.14);
  ctx.beginPath();
  ctx.moveTo(center.x - rx, center.y);
  ctx.bezierCurveTo(center.x - rx, center.y - ry, center.x + rx * 0.06, center.y - ry, center.x + rx * 0.06, center.y);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // 子午線のリブ
  if (detailed) {
    ctx.save();
    ctx.strokeStyle = shade(p.roof, -0.18);
    ctx.lineWidth = 1.1;
    ctx.globalAlpha = 0.55;
    for (let i = 1; i < 5; i += 1) {
      const t = i / 5;
      const x = center.x - rx + rx * 2 * t;
      ctx.beginPath();
      ctx.moveTo(x, center.y);
      ctx.quadraticCurveTo(x, center.y - ry * (1 - Math.abs(t - 0.5) * 1.2), center.x, center.y - ry);
      ctx.stroke();
    }
    ctx.restore();
  }

  fillCircle(ctx, center.x, center.y - ry - 5, 4.5, accent);
}

function archGate(
  ctx: Ctx,
  cam: IsoCamera,
  lm: PlacedDioramaLandmark,
  p: DioramaPalette,
  detailed: boolean,
): void {
  const accent = accentColor(lm, p);
  const span = lm.footprint * 0.72;
  const pier = span * 0.24;
  const height = lm.height * 0.76;

  for (const side of [-1, 1]) {
    const leg = drawBox(ctx, cam, {
      x: lm.x + side * (span * 0.5 - pier * 0.5),
      z: lm.z,
      y: 0,
      width: pier,
      depth: pier,
      height,
      color: p.buildingLight,
    });
    if (detailed) {
      for (const face of leg.faces) {
        // 石積みの目地
        for (let i = 1; i < 5; i += 1) {
          const v = (i / 5) * 0.92;
          faceRect(ctx, face.basis, 0.06, v, 0.94, v + 0.012, shade(p.buildingLight, -0.12), 0.7);
        }
      }
    }
  }

  const beam = drawBox(ctx, cam, {
    x: lm.x,
    z: lm.z,
    y: height,
    width: span,
    depth: pier * 0.92,
    height: lm.height * 0.15,
    color: p.buildingLight,
    topColor: accent,
  });
  if (detailed) {
    for (const face of beam.faces) {
      faceRect(ctx, face.basis, 0.06, 0.3, 0.94, 0.62, accent, 0.85);
    }
  }
  drawBox(ctx, cam, {
    x: lm.x,
    z: lm.z,
    y: height + lm.height * 0.15,
    width: span * 0.6,
    depth: pier * 0.7,
    height: lm.height * 0.06,
    color: accent,
  });
}

function skyscraper(
  ctx: Ctx,
  cam: IsoCamera,
  lm: PlacedDioramaLandmark,
  p: DioramaPalette,
  detailed: boolean,
): void {
  const accent = accentColor(lm, p);
  const glass = mix(p.buildingGlass, '#ffffff', 0.3);
  const frame = mix(p.buildingLight, '#ffffff', 0.5);
  let y = 0;
  let size = lm.footprint * 0.44;

  for (let i = 0; i < 3; i += 1) {
    const height = (lm.height * 0.9) / 3;
    const tier = drawBox(ctx, cam, {
      x: lm.x,
      z: lm.z,
      y,
      width: size,
      depth: size * 0.9,
      height,
      color: i === 0 ? p.buildingLight : p.buildingGlass,
      topColor: p.roof,
    });
    for (const face of tier.faces) {
      const bands = 7;
      for (let b = 0; b < bands; b += 1) {
        const v = 0.06 + (0.88 / bands) * b;
        faceRect(ctx, face.basis, 0.07, v, 0.93, v + (0.88 / bands) * 0.66, glass, 0.7);
      }
      if (detailed) {
        const mullions = Math.max(3, Math.round(face.width / 0.028));
        for (let m = 1; m < mullions; m += 1) {
          const u = 0.07 + (0.86 / mullions) * m;
          faceRect(ctx, face.basis, u - 0.004, 0.06, u + 0.004, 0.94, frame, 0.5);
        }
      }
    }
    y += height;
    size *= 0.78;
  }

  const top = toScreen(cam, lm.x, y, lm.z);
  const mast = lm.height * 0.14 * cam.span;
  fillPoly(
    ctx,
    [
      { x: top.x - 1.4, y: top.y },
      { x: top.x + 1.4, y: top.y },
      { x: top.x + 0.7, y: top.y - mast },
      { x: top.x - 0.7, y: top.y - mast },
    ],
    shade(p.buildingMid, -0.2),
  );
  fillCircle(ctx, top.x, top.y - mast, 3, accent);
}

function pagoda(
  ctx: Ctx,
  cam: IsoCamera,
  lm: PlacedDioramaLandmark,
  p: DioramaPalette,
  detailed: boolean,
): void {
  const accent = accentColor(lm, p);
  const tiers = 4;
  let y = 0;
  let size = lm.footprint * 0.4;

  for (let i = 0; i < tiers; i += 1) {
    const height = (lm.height * 0.64) / tiers;
    const tier = drawBox(ctx, cam, {
      x: lm.x,
      z: lm.z,
      y,
      width: size,
      depth: size,
      height,
      color: p.buildingLight,
    });
    if (detailed) {
      for (const face of tier.faces) {
        // 連子窓
        const slats = 5;
        for (let s = 0; s < slats; s += 1) {
          const u = 0.14 + (0.72 / slats) * s;
          faceRect(ctx, face.basis, u, 0.22, u + (0.72 / slats) * 0.5, 0.78, shade(p.buildingMid, -0.18), 0.55);
        }
      }
    }
    y += height;

    // 深い軒
    drawBox(ctx, cam, {
      x: lm.x,
      z: lm.z,
      y,
      width: size * 1.55,
      depth: size * 1.55,
      height: 0.016,
      color: shade(p.roof, -0.05),
    });
    drawPyramidRoof(ctx, cam, {
      x: lm.x,
      z: lm.z,
      y: y + 0.016,
      half: size * 0.78,
      height: height * 0.52,
      color: i === tiers - 1 ? accent : mix(p.roof, accent, 0.28),
    });
    y += 0.016 + height * 0.3;
    size *= 0.84;
  }

  const top = toScreen(cam, lm.x, y + lm.height * 0.05, lm.z);
  fillPoly(
    ctx,
    [
      { x: top.x - 1.6, y: top.y },
      { x: top.x + 1.6, y: top.y },
      { x: top.x + 0.8, y: top.y - cam.span * 0.06 },
      { x: top.x - 0.8, y: top.y - cam.span * 0.06 },
    ],
    accent,
  );
  fillCircle(ctx, top.x, top.y - cam.span * 0.065, 3.2, p.accentSecondary);
}

/** 風車の塔（羽根は spinner 側）。 */
function windmillBase(
  ctx: Ctx,
  cam: IsoCamera,
  lm: PlacedDioramaLandmark,
  p: DioramaPalette,
  detailed: boolean,
): void {
  const accent = accentColor(lm, p);
  const base = lm.footprint * 0.46;
  const bodyHeight = lm.height * 0.7;
  const glass = mix(p.buildingGlass, '#ffffff', 0.3);
  const frame = mix(p.buildingLight, '#ffffff', 0.5);

  // 石造りの塔（上へ細くなる）。段数は常に一定（操作中に形が変わらないように）
  const segments = 5;
  const segmentFaces: (readonly VisibleFace[])[] = [];
  let y = 0;
  for (let i = 0; i < segments; i += 1) {
    const t = i / segments;
    const size = base * (1 - t * 0.34);
    const height = bodyHeight / segments;
    const seg = drawBox(ctx, cam, {
      x: lm.x,
      z: lm.z,
      y,
      width: size,
      depth: size,
      height,
      color: i % 2 === 0 ? p.buildingLight : shade(p.buildingLight, -0.03),
    });
    if (detailed) {
      for (const face of seg.faces) {
        // 石積みの目地
        faceRect(ctx, face.basis, 0.04, 0.46, 0.96, 0.53, shade(p.buildingLight, -0.13), 0.6);
      }
    }
    segmentFaces.push(seg.faces);
    y += height;
  }

  // 見張り台の手すり
  const deck = drawBox(ctx, cam, {
    x: lm.x,
    z: lm.z,
    y: bodyHeight * 0.56,
    width: base * 1.12,
    depth: base * 1.12,
    height: lm.height * 0.035,
    color: shade(p.roof, -0.08),
  });
  if (detailed) {
    for (const face of deck.faces) {
      const posts = 7;
      for (let i = 0; i < posts; i += 1) {
        const u = 0.06 + (0.88 / posts) * i;
        faceRect(ctx, face.basis, u, 0.1, u + 0.02, 0.95, shade(p.buildingMid, -0.2), 0.8);
      }
    }
  }

  // 入口（塔の根元、+z 側に固定）と、中段の小窓。
  // 以前は透明色の箱で面を測っていたが、shade() が rgba を解釈できず黒い箱が塔に被さっていた。
  // 実際に積んだ段の面へ直接載せる。
  const doorFace = segmentFaces[0]?.find((face) => face.index === 2);
  if (doorFace && detailed) {
    faceRect(ctx, doorFace.basis, 0.34, 0, 0.66, 0.78, mix(accent, '#5a3a24', 0.55), 0.95);
    faceRect(ctx, doorFace.basis, 0.3, 0.78, 0.7, 0.88, shade(p.buildingLight, -0.16), 0.9);
  }
  for (const face of segmentFaces[2] ?? []) {
    faceWindows(ctx, face, 1, 1, glass, frame, detailed, 0.18, 0.82);
  }

  // 円錐の帽子
  drawBox(ctx, cam, {
    x: lm.x,
    z: lm.z,
    y: bodyHeight,
    width: base * 0.9,
    depth: base * 0.9,
    height: 0.014,
    color: shade(p.roof, -0.1),
  });
  drawPyramidRoof(ctx, cam, {
    x: lm.x,
    z: lm.z,
    y: bodyHeight + 0.014,
    half: base * 0.46,
    height: lm.height * 0.24,
    color: accent,
  });
}

/** 観覧車の支柱（車輪は spinner 側）。 */
function ferrisBase(
  ctx: Ctx,
  cam: IsoCamera,
  lm: PlacedDioramaLandmark,
  p: DioramaPalette,
  detailed: boolean,
): void {
  const hubY = lm.height * 0.42;
  const hub = toScreen(cam, lm.x, hubY, lm.z);

  // 基礎
  drawBox(ctx, cam, {
    x: lm.x,
    z: lm.z,
    y: 0,
    width: lm.footprint * 0.7,
    depth: lm.footprint * 0.34,
    height: 0.02,
    color: shade(p.platformEdge, -0.05),
  });

  for (const side of [-1, 1]) {
    const foot = toScreen(cam, lm.x + side * lm.footprint * 0.26, 0.02, lm.z);
    fillPoly(
      ctx,
      [
        { x: foot.x - 6, y: foot.y },
        { x: foot.x + 6, y: foot.y },
        { x: hub.x + 4, y: hub.y },
        { x: hub.x - 4, y: hub.y },
      ],
      shade(p.buildingMid, side > 0 ? -0.08 : -0.22),
    );
    if (detailed) {
      // 補強の斜材
      ctx.save();
      ctx.strokeStyle = shade(p.buildingMid, -0.3);
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.7;
      for (let i = 1; i < 4; i += 1) {
        const t = i / 4;
        ctx.beginPath();
        ctx.moveTo(foot.x + (hub.x - foot.x) * t - 5, foot.y + (hub.y - foot.y) * t);
        ctx.lineTo(foot.x + (hub.x - foot.x) * (t + 0.2) + 5, foot.y + (hub.y - foot.y) * (t + 0.2));
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

/* ------------------------------------------------------------------ *
 * spinner
 * ------------------------------------------------------------------ */

/**
 * 面の座標系（2 本の基底ベクトル）がほぼ潰れているか。面や円盤を真横から見ている状態。
 * 成分は普通の大きさでも行列式がほぼ 0 の行列で円や線を描くと、
 * ラスタライズが極端に重くなる環境がある（ソフトウェア描画では 1 フレーム数秒）。
 */
function nearlyEdgeOn(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  const det = a.x * b.y - a.y * b.x;
  const norm = a.x * a.x + a.y * a.y + b.x * b.x + b.y * b.y;
  return norm === 0 || Math.abs(det) < norm * 0.004;
}

/** 真横から見た円盤（羽根・観覧車の輪）は一本の線。潰れた行列を使わずに線として描く。 */
function edgeOnBar(
  ctx: Ctx,
  hub: { x: number; y: number },
  up: { x: number; y: number },
  reach: number,
  color: string,
): void {
  const len = Math.hypot(up.x, up.y) || 1;
  const nx = (-up.y / len) * 0.8;
  const ny = (up.x / len) * 0.8;
  const top = { x: hub.x + up.x * reach, y: hub.y + up.y * reach };
  const bottom = { x: hub.x - up.x * reach, y: hub.y - up.y * reach };
  fillPoly(
    ctx,
    [
      { x: top.x + nx, y: top.y + ny },
      { x: top.x - nx, y: top.y - ny },
      { x: bottom.x - nx, y: bottom.y - ny },
      { x: bottom.x + nx, y: bottom.y + ny },
    ],
    color,
    0.9,
  );
}

function windmillSpinner(
  ctx: Ctx,
  cam: IsoCamera,
  lm: PlacedDioramaLandmark,
  p: DioramaPalette,
  angle: number,
  detailed: boolean,
): void {
  const accent = accentColor(lm, p);
  const base = lm.footprint * 0.46;
  const bodyHeight = lm.height * 0.7;

  /*
   * 羽根は「+z 側を向いた鉛直な円盤」として、ワールドの平面に載せて描く。
   * 画面上の平面で回すと、街をどの角度に回しても羽根だけが常に正面を向き、
   * 模型に見えない。ワールドの x 軸と上方向を画面へ写した 2 本のベクトルで
   * 座標系を作ると、角度に応じて楕円に潰れ、真横からは一本の線になる。
   */
  const hx = lm.x;
  const hy = bodyHeight * 0.92;
  const hz = lm.z + base * 0.44;
  const hub = toScreen(cam, hx, hy, hz);
  const alongX = toScreen(cam, hx + 1, hy, hz);
  const up = toScreen(cam, hx, hy + 1, hz);
  const length = lm.height * 0.46;

  const axisX = { x: alongX.x - hub.x, y: alongX.y - hub.y };
  const axisUp = { x: up.x - hub.x, y: up.y - hub.y };
  if (nearlyEdgeOn(axisX, axisUp)) {
    edgeOnBar(ctx, hub, axisUp, length, shade(p.buildingMid, -0.25));
    return;
  }

  ctx.save();
  ctx.transform(alongX.x - hub.x, alongX.y - hub.y, up.x - hub.x, up.y - hub.y, hub.x, hub.y);
  ctx.rotate(angle);

  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2;
    ctx.save();
    ctx.rotate(a);

    // 骨組み
    fillPoly(
      ctx,
      [
        { x: 0, y: -length * 0.035 },
        { x: length, y: -length * 0.02 },
        { x: length, y: length * 0.02 },
        { x: 0, y: length * 0.035 },
      ],
      shade(p.buildingMid, -0.25),
    );
    // 帆
    fillPoly(
      ctx,
      [
        { x: length * 0.18, y: -length * 0.02 },
        { x: length * 0.96, y: -length * 0.012 },
        { x: length * 0.96, y: -length * 0.2 },
        { x: length * 0.18, y: -length * 0.22 },
      ],
      i % 2 === 0 ? mix(p.buildingLight, '#ffffff', 0.4) : p.buildingLight,
    );
    if (detailed) {
      // 帆の桟
      ctx.strokeStyle = shade(p.buildingMid, -0.3);
      // 座標系がワールド単位なので、線幅も画面 0.9px 相当に換算する
      ctx.lineWidth = 0.9 / cam.span;
      ctx.globalAlpha = 0.7;
      for (let k = 1; k < 5; k += 1) {
        const t = 0.18 + (0.78 / 5) * k;
        ctx.beginPath();
        ctx.moveTo(length * t, -length * 0.015);
        ctx.lineTo(length * t, -length * 0.21);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  fillCircle(ctx, 0, 0, length * 0.075, accent);
  fillCircle(ctx, 0, 0, length * 0.032, shade(accent, -0.3));
  ctx.restore();
}

function ferrisSpinner(
  ctx: Ctx,
  cam: IsoCamera,
  lm: PlacedDioramaLandmark,
  p: DioramaPalette,
  angle: number,
  detailed: boolean,
): void {
  const accent = accentColor(lm, p);
  // 輪は x 軸に沿った鉛直面に載せる（支柱も x 方向に開いている）。
  // 画面の平面で描くと、どの角度から見ても真円のまま張り付いて見えてしまう。
  const radius = lm.height * 0.3;
  const hx = lm.x;
  const hy = lm.height * 0.42;
  const hz = lm.z;
  const hub = toScreen(cam, hx, hy, hz);
  const alongX = toScreen(cam, hx + 1, hy, hz);
  const up = toScreen(cam, hx, hy + 1, hz);
  const px = 1 / cam.span;

  const axisX = { x: alongX.x - hub.x, y: alongX.y - hub.y };
  const axisUp = { x: up.x - hub.x, y: up.y - hub.y };
  if (nearlyEdgeOn(axisX, axisUp)) {
    edgeOnBar(ctx, hub, axisUp, radius * 1.12, p.buildingLight);
    return;
  }

  ctx.save();
  ctx.transform(alongX.x - hub.x, alongX.y - hub.y, up.x - hub.x, up.y - hub.y, hub.x, hub.y);
  ctx.rotate(angle);

  ctx.strokeStyle = p.buildingLight;
  ctx.lineWidth = 3.4 * px;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = shade(p.buildingMid, -0.05);
  ctx.lineWidth = 1.8 * px;
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  const cabins = 12;
  for (let i = 0; i < cabins; i += 1) {
    const a = (i / cabins) * Math.PI * 2;
    const cx = Math.cos(a) * radius;
    const cy = Math.sin(a) * radius;
    ctx.strokeStyle = shade(p.buildingMid, -0.1);
    ctx.lineWidth = 1.3 * px;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(cx, cy);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // ゴンドラは輪の回転を打ち消して、常に真下へ吊る（この座標系は y が上向き）
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-angle);
    const w = radius * 0.16;
    ctx.fillStyle = i % 2 === 0 ? accent : p.accentSecondary;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -w * 0.9, w, w * 0.85, w * 0.28);
    ctx.fill();
    if (detailed) {
      ctx.fillStyle = mix(p.buildingGlass, '#ffffff', 0.4);
      ctx.beginPath();
      ctx.roundRect(-w * 0.32, -w * 0.5, w * 0.64, w * 0.3, w * 0.12);
      ctx.fill();
    }
    ctx.restore();
  }

  fillCircle(ctx, 0, 0, radius * 0.1, p.buildingLight);
  ctx.restore();
}

/* ------------------------------------------------------------------ *
 * ディスパッチ
 * ------------------------------------------------------------------ */

type BaseFn = (
  ctx: Ctx,
  cam: IsoCamera,
  lm: PlacedDioramaLandmark,
  p: DioramaPalette,
  detailed: boolean,
) => void;

const BASE: Record<DioramaLandmarkKind, BaseFn> = {
  signalTower,
  clockTower,
  domeHall,
  archGate,
  skyscraper,
  pagoda,
  windmill: windmillBase,
  ferrisWheel: ferrisBase,
  aiCore: aiCoreBase,
  skyTether: skyTetherBase,
  arcology: arcologyBase,
  windTurbine: windTurbineBase,
  solarTree: solarTreeBase,
  vertiport: vertiportBase,
  watchPylon: watchPylonBase,
};

export function drawLandmarkBase(
  ctx: Ctx,
  camera: IsoCamera,
  landmark: PlacedDioramaLandmark,
  palette: DioramaPalette,
  detailed: boolean,
): void {
  BASE[landmark.kind](ctx, camera, landmark, palette, detailed);
}

export function drawLandmarkSpinner(
  ctx: Ctx,
  camera: IsoCamera,
  landmark: PlacedDioramaLandmark,
  palette: DioramaPalette,
  angle: number,
  detailed: boolean,
): void {
  if (landmark.kind === 'windmill') windmillSpinner(ctx, camera, landmark, palette, angle, detailed);
  else if (landmark.kind === 'ferrisWheel') ferrisSpinner(ctx, camera, landmark, palette, angle, detailed);
  else if (landmark.kind === 'windTurbine') windTurbineSpinner(ctx, camera, landmark, palette, angle);
  else if (landmark.kind === 'aiCore') aiCoreSpinner(ctx, camera, landmark, palette, angle);
  else if (landmark.kind === 'skyTether') skyTetherSpinner(ctx, camera, landmark, palette, angle);
  else if (landmark.kind === 'watchPylon') watchPylonSpinner(ctx, camera, landmark, angle);
}

export { createRng };
