import { mix, rgba, shade } from '../color';
import { createRng, lerp } from '../rng';
import { ISO_VERTICAL_RATIO } from './iso';
import type { DioramaPalette } from './types';

/**
 * Canvas2D によるアイソメトリック描画のプリミティブ。
 *
 * WebGL を使わないので、どのブラウザでも同じ絵が出る。
 *
 * 街全体は Y 軸まわりに回せる。回転すると立体の「見えている面」が変わるため、
 * 直方体は 4 つの側面それぞれの法線を見て、手前を向いた面だけを描く（背面消去）。
 * 面の明るさも法線から決めるので、回すと陰影が自然に移り変わる。
 */

export type Ctx = CanvasRenderingContext2D;

export interface IsoCamera {
  /** ワールド 1.0（台座の半辺）に対応する画面上の長さ（px）。拡大率を含む */
  readonly span: number;
  readonly ox: number;
  readonly oy: number;
  /** Y 軸まわりの回転（ラジアン） */
  readonly rot: number;
}

export interface Point2 {
  readonly x: number;
  readonly y: number;
}

/**
 * 塗り全体にかける不透明度。
 * 各塗り関数は自分で globalAlpha を設定するため、外側で globalAlpha を下げても効かない。
 * フェードさせたい描画はこれで包む。
 */
let opacityScale = 1;

export function withOpacity(scale: number, draw: () => void): void {
  const previous = opacityScale;
  opacityScale = previous * Math.max(0, Math.min(1, scale));
  try {
    draw();
  } finally {
    opacityScale = previous;
  }
}

/** ワールド座標をカメラの回転にかけた後の平面座標。 */
export function spin(camera: IsoCamera, x: number, z: number): { x: number; z: number } {
  const c = Math.cos(camera.rot);
  const s = Math.sin(camera.rot);
  return { x: x * c - z * s, z: x * s + z * c };
}

export function toScreen(camera: IsoCamera, x: number, y: number, z: number): Point2 {
  const r = spin(camera, x, z);
  return {
    x: camera.ox + (r.x - r.z) * camera.span * 0.5,
    y: camera.oy + (r.x + r.z) * camera.span * 0.5 * ISO_VERTICAL_RATIO - y * camera.span,
  };
}

/** 描画順（奥→手前）の比較キー。回転後の座標で測る。 */
export function depthOf(camera: IsoCamera, x: number, z: number): number {
  const r = spin(camera, x, z);
  return r.x + r.z;
}

/* ------------------------------------------------------------------ *
 * 塗りのユーティリティ
 * ------------------------------------------------------------------ */

export function fillPoly(ctx: Ctx, points: readonly Point2[], color: string, alpha = 1): void {
  if (points.length < 3) return;
  ctx.globalAlpha = alpha * opacityScale;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i]!.x, points[i]!.y);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

export function fillCircle(ctx: Ctx, x: number, y: number, r: number, color: string, alpha = 1): void {
  ctx.globalAlpha = alpha * opacityScale;
  ctx.fillStyle = color;
  ctx.beginPath();
  // 下限は 0。ワールド単位へ変換した座標系（風車の羽根など）でも使うので、
  // 「0.1px」のつもりの下限が 0.1 ワールド単位＝巨大な円になってしまう。
  ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

export function fillEllipse(
  ctx: Ctx,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
  alpha = 1,
): void {
  ctx.globalAlpha = alpha * opacityScale;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------------ *
 * 直方体（回転対応・背面消去つき）
 * ------------------------------------------------------------------ */

export interface FaceBasis {
  readonly origin: Point2;
  readonly du: Point2;
  readonly dv: Point2;
}

export interface VisibleFace {
  /**
   * どの側面か（ローカル座標で固定: 0 = -z / 1 = +x / 2 = +z / 3 = -x）。
   * 回転しても変わらないので、窓の点灯や戸口の位置を決める種に使う。
   * （depth は回すたびに変わるため、種に使うと街の見た目が変わってしまう）
   */
  readonly index: number;
  readonly basis: FaceBasis;
  /** 面の明るさ 0（陰）..1（受光） */
  readonly tone: number;
  /** 面の横幅（ワールド単位）。窓の数を決めるのに使う */
  readonly width: number;
  /** 面の高さ（ワールド単位） */
  readonly height: number;
  /** 奥行きの比較キー */
  readonly depth: number;
}

export interface BoxResult {
  readonly faces: readonly VisibleFace[];
  readonly topCenter: Point2;
  readonly topCorners: readonly Point2[];
}

export interface BoxSpec {
  readonly x: number;
  readonly z: number;
  readonly y: number;
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  readonly color: string;
  readonly topColor?: string;
  /** true なら塗らずに面の情報だけを返す（装飾を載せる土台の計測用） */
  readonly invisible?: boolean;
}

/** 側面の明るさ。法線の向きから決めるので、回すと陰影が移る。 */
function toneOf(nx: number, nz: number): number {
  return Math.min(1, Math.max(0, (nx - nz) * 0.5 + 0.5));
}

function sideColor(base: string, tone: number): string {
  return mix('#dce1e7', base, lerp(0.78, 1, tone));
}

function sub(a: Point2, b: Point2): Point2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function screenCross(a: Point2, b: Point2, c: Point2): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

/** 直方体の画面上の輪郭。欠けた側面から後ろが透けないように、先に不透明で埋める。 */
function convexHull(points: readonly Point2[]): Point2[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (sorted.length < 3) return sorted;
  const lower: Point2[] = [];
  for (const point of sorted) {
    while (lower.length >= 2 && screenCross(lower[lower.length - 2]!, lower[lower.length - 1]!, point) <= 0) {
      lower.pop();
    }
    lower.push(point);
  }
  const upper: Point2[] = [];
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const point = sorted[i]!;
    while (upper.length >= 2 && screenCross(upper[upper.length - 2]!, upper[upper.length - 1]!, point) <= 0) {
      upper.pop();
    }
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/**
 * 側面が見えているか。
 * 2:1 ダイメトリックでは、法線の深さ成分が 0 付近でも横方向に面積が残る。
 * 法線だけで切ると、回転の途中で壁が消えて建物が透ける。
 */
function wallIsVisible(wx: number, wz: number, a: Point2, b: Point2, c: Point2): boolean {
  const area = screenCross(a, b, c);
  if (Math.abs(area) > 0.8) return true;
  return wx + wz > -0.28;
}

/**
 * 直方体を描き、見えている側面の情報を返す。
 * 返り値の面に窓や装飾を載せると、回転に追従する。
 */
export function drawBox(ctx: Ctx, camera: IsoCamera, spec: BoxSpec): BoxResult {
  const hw = spec.width / 2;
  const hd = spec.depth / 2;
  const y0 = spec.y;
  const y1 = spec.y + spec.height;
  const c = Math.cos(camera.rot);
  const s = Math.sin(camera.rot);

  // 4 隅（ローカル）と、それを結ぶ 4 つの側面
  const local: readonly (readonly [number, number])[] = [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ];
  // 各側面の外向き法線（ローカル）
  const normals: readonly (readonly [number, number])[] = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];

  const bottom = local.map(([lx, lz]) => toScreen(camera, spec.x + lx, y0, spec.z + lz));
  const top = local.map(([lx, lz]) => toScreen(camera, spec.x + lx, y1, spec.z + lz));

  const faces: VisibleFace[] = [];
  const drawList: { points: Point2[]; color: string; depth: number }[] = [];

  for (let i = 0; i < 4; i += 1) {
    const j = (i + 1) % 4;
    const [nx, nz] = normals[i]!;
    // 法線を回してから、手前を向いているかを判定する
    const wx = nx * c - nz * s;
    const wz = nx * s + nz * c;
    if (!wallIsVisible(wx, wz, bottom[i]!, bottom[j]!, top[j]!)) continue;

    const tone = toneOf(wx, wz);
    const quad = [bottom[i]!, bottom[j]!, top[j]!, top[i]!];
    const mid = local[i]!;
    const midJ = local[j]!;
    const depth = depthOf(
      camera,
      spec.x + (mid[0] + midJ[0]) / 2,
      spec.z + (mid[1] + midJ[1]) / 2,
    );

    drawList.push({ points: quad, color: sideColor(spec.color, tone), depth });
    faces.push({
      index: i,
      basis: {
        origin: bottom[i]!,
        du: sub(bottom[j]!, bottom[i]!),
        dv: sub(top[i]!, bottom[i]!),
      },
      tone,
      width: i % 2 === 0 ? spec.width : spec.depth,
      height: spec.height,
      depth,
    });
  }

  if (!spec.invisible) {
    fillPoly(ctx, convexHull([...bottom, ...top]), spec.color);
    // 奥の面から描く
    drawList.sort((a, b) => a.depth - b.depth);
    for (const item of drawList) fillPoly(ctx, item.points, item.color);
    fillPoly(ctx, top, shade(spec.topColor ?? spec.color, 0.07));
  }

  return {
    faces,
    topCenter: toScreen(camera, spec.x, y1, spec.z),
    topCorners: top,
  };
}

/** 面の (u, v) 座標から画面座標へ。u, v ともに 0..1。 */
export function onFace(face: FaceBasis, u: number, v: number): Point2 {
  return {
    x: face.origin.x + face.du.x * u + face.dv.x * v,
    y: face.origin.y + face.du.y * u + face.dv.y * v,
  };
}

/** 面の上に矩形を置く（u, v はいずれも 0..1）。 */
export function faceRect(
  ctx: Ctx,
  face: FaceBasis,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  color: string,
  alpha = 1,
): void {
  fillPoly(
    ctx,
    [onFace(face, u0, v0), onFace(face, u1, v0), onFace(face, u1, v1), onFace(face, u0, v1)],
    color,
    alpha,
  );
}

/* ------------------------------------------------------------------ *
 * 押し出し多角形（台座）
 * ------------------------------------------------------------------ */

export interface WorldPoint {
  readonly x: number;
  readonly z: number;
}

/** 面取りした正方形（台座の輪郭）。 */
export function chamferedSquare(half: number, corner: number): WorldPoint[] {
  const h = half;
  const c = corner;
  return [
    { x: -h + c, z: -h },
    { x: h - c, z: -h },
    { x: h, z: -h + c },
    { x: h, z: h - c },
    { x: h - c, z: h },
    { x: -h + c, z: h },
    { x: -h, z: h - c },
    { x: -h, z: -h + c },
  ];
}

/** 凸多角形を厚み付きで描く（手前側の稜線だけを押し出す）。 */
export function drawExtrudedPolygon(
  ctx: Ctx,
  camera: IsoCamera,
  shape: readonly WorldPoint[],
  options: {
    readonly y: number;
    readonly thickness: number;
    readonly topColor: string;
    readonly sideColor: string;
    readonly underColor?: string;
    /** 側面の上端に回す帯（芝の縁など） */
    readonly lipColor?: string;
    /** 帯の高さ（厚みに対する比） */
    readonly lipRatio?: number;
  },
): void {
  const top = shape.map((point) => toScreen(camera, point.x, options.y, point.z));

  let leftIndex = 0;
  let rightIndex = 0;
  top.forEach((point, index) => {
    if (point.x < top[leftIndex]!.x) leftIndex = index;
    if (point.x > top[rightIndex]!.x) rightIndex = index;
  });

  const forward: Point2[] = [];
  for (let i = leftIndex; ; i = (i + 1) % top.length) {
    forward.push(top[i]!);
    if (i === rightIndex) break;
  }
  const backward: Point2[] = [];
  for (let i = leftIndex; ; i = (i - 1 + top.length) % top.length) {
    backward.push(top[i]!);
    if (i === rightIndex) break;
  }
  const average = (chain: Point2[]): number =>
    chain.reduce((sum, point) => sum + point.y, 0) / chain.length;
  const near = average(forward) > average(backward) ? forward : backward;

  const drop = options.thickness * camera.span;
  fillPoly(
    ctx,
    [...near, ...[...near].reverse().map((p) => ({ x: p.x, y: p.y + drop }))],
    options.sideColor,
  );
  if (options.underColor) {
    fillPoly(
      ctx,
      [
        ...near.map((p) => ({ x: p.x, y: p.y + drop * 0.74 })),
        ...[...near].reverse().map((p) => ({ x: p.x, y: p.y + drop })),
      ],
      options.underColor,
    );
  }
  if (options.lipColor) {
    const lip = drop * (options.lipRatio ?? 0.3);
    fillPoly(
      ctx,
      [...near, ...[...near].reverse().map((p) => ({ x: p.x, y: p.y + lip }))],
      options.lipColor,
    );
    // 芝の縁のすぐ下に落ちる細い陰
    fillPoly(
      ctx,
      [
        ...near.map((p) => ({ x: p.x, y: p.y + lip })),
        ...[...near].reverse().map((p) => ({ x: p.x, y: p.y + lip * 1.35 })),
      ],
      shade(options.sideColor, -0.12),
      0.6,
    );
  }
  fillPoly(ctx, top, options.topColor);
}

/** 台座の上に貼る平らな面（道路・広場・水面）。 */
export function drawSurface(
  ctx: Ctx,
  camera: IsoCamera,
  spec: {
    x: number;
    z: number;
    width: number;
    depth: number;
    y: number;
    color: string;
    alpha?: number;
  },
): void {
  const hw = spec.width / 2;
  const hd = spec.depth / 2;
  fillPoly(
    ctx,
    [
      toScreen(camera, spec.x - hw, spec.y, spec.z - hd),
      toScreen(camera, spec.x + hw, spec.y, spec.z - hd),
      toScreen(camera, spec.x + hw, spec.y, spec.z + hd),
      toScreen(camera, spec.x - hw, spec.y, spec.z + hd),
    ],
    spec.color,
    spec.alpha ?? 1,
  );
}

/** 接地影（ソフト AO）。 */
export function drawContactShadow(
  ctx: Ctx,
  camera: IsoCamera,
  x: number,
  z: number,
  size: number,
  color: string,
  strength: number,
): void {
  const center = toScreen(camera, x, 0.002, z);
  const rx = size * camera.span * 1.05;
  const ry = rx * ISO_VERTICAL_RATIO;
  const gradient = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, rx);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.save();
  ctx.globalAlpha = strength;
  ctx.translate(center.x, center.y);
  ctx.scale(1, ry / rx);
  ctx.translate(-center.x, -center.y);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(center.x, center.y, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ------------------------------------------------------------------ *
 * 屋根
 * ------------------------------------------------------------------ */

/**
 * 切妻屋根。棟の向きに沿って 2 枚の斜面と、両端の妻壁を描く。
 * 回転しても、見えている斜面だけが出る。
 */
export function drawGableRoof(
  ctx: Ctx,
  camera: IsoCamera,
  spec: {
    x: number;
    z: number;
    y: number;
    width: number;
    depth: number;
    rise: number;
    color: string;
    gableColor: string;
    /** true なら棟が x 方向 */
    alongX: boolean;
    /** 軒の出 */
    eave?: number;
    /** 屋根板の厚み（鼻隠しの高さ） */
    thickness?: number;
  },
): void {
  const eave = spec.eave ?? 0.007;
  const thickness = spec.thickness ?? 0.009;
  const c = Math.cos(camera.rot);
  const s = Math.sin(camera.rot);
  const y = spec.y;
  const ridgeY = y + spec.rise;

  // 棟に沿う向きを u、棟を横切る向きを v として扱い、
  // alongX の場合分けを座標変換だけに閉じ込める。
  const hu = (spec.alongX ? spec.width : spec.depth) / 2 + eave;
  const hv = (spec.alongX ? spec.depth : spec.width) / 2 + eave;

  const at = (u: number, v: number, h: number): Point2 =>
    spec.alongX
      ? toScreen(camera, spec.x + u, h, spec.z + v)
      : toScreen(camera, spec.x + v, h, spec.z + u);
  const depthAt = (u: number, v: number): number =>
    spec.alongX
      ? depthOf(camera, spec.x + u, spec.z + v)
      : depthOf(camera, spec.x + v, spec.z + u);
  /** ローカル法線を回して、手前を向いているかとトーンを求める。 */
  const facing = (nu: number, nv: number): { front: boolean; tone: number } => {
    const nx = spec.alongX ? nu : nv;
    const nz = spec.alongX ? nv : nu;
    const wx = nx * c - nz * s;
    const wz = nx * s + nz * c;
    return { front: wx + wz > -0.28, tone: toneOf(wx, wz) };
  };

  const list: { points: Point2[]; color: string; depth: number }[] = [];

  // ---- 斜面と、その先端の鼻隠し ----
  for (const sv of [-1, 1]) {
    const view = facing(0, sv);
    if (!view.front) continue;
    const eaveA = at(-hu, sv * hv, y);
    const eaveB = at(hu, sv * hv, y);
    const depth = depthAt(0, sv * hv);
    // 屋根は空を向いているぶん明るいので、側面より持ち上げる
    list.push({
      points: [eaveA, eaveB, at(hu, 0, ridgeY), at(-hu, 0, ridgeY)],
      color: sideColor(spec.color, view.tone * 0.45 + 0.55),
      depth,
    });
    list.push({
      points: [eaveA, eaveB, at(hu, sv * hv, y - thickness), at(-hu, sv * hv, y - thickness)],
      color: shade(spec.color, -0.32),
      depth: depth + 0.002,
    });
  }

  // ---- 妻壁 ----
  for (const su of [-1, 1]) {
    const view = facing(su, 0);
    if (!view.front) continue;
    list.push({
      points: [at(su * hu, -hv, y), at(su * hu, hv, y), at(su * hu, 0, ridgeY)],
      color: sideColor(spec.gableColor, view.tone),
      depth: depthAt(su * hu, 0),
    });
  }

  // ---- 棟包み ----
  const capV = Math.min(hv * 0.14, 0.008);
  const capY = ridgeY - capV * 0.5;
  list.push({
    points: [
      at(-hu, -capV, capY),
      at(hu, -capV, capY),
      at(hu, capV, capY),
      at(-hu, capV, capY),
    ],
    color: shade(spec.color, 0.1),
    depth: depthAt(0, 0) + 0.004,
  });

  list.sort((a, b) => a.depth - b.depth);
  for (const item of list) fillPoly(ctx, item.points, item.color);
}

/** 四角錐（塔の屋根）。見えている面だけ描く。 */
export function drawPyramidRoof(
  ctx: Ctx,
  camera: IsoCamera,
  spec: { x: number; z: number; y: number; half: number; height: number; color: string },
): void {
  const { x, z, y, half, height } = spec;
  const apex = toScreen(camera, x, y + height, z);
  const c = Math.cos(camera.rot);
  const s = Math.sin(camera.rot);
  const corners: readonly (readonly [number, number])[] = [
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, half],
  ];
  const normals: readonly (readonly [number, number])[] = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];
  const list: { points: Point2[]; color: string; depth: number }[] = [];
  for (let i = 0; i < 4; i += 1) {
    const j = (i + 1) % 4;
    const [nx, nz] = normals[i]!;
    const wx = nx * c - nz * s;
    const wz = nx * s + nz * c;
    if (wx + wz <= 0) continue;
    const a = toScreen(camera, x + corners[i]![0], y, z + corners[i]![1]);
    const b = toScreen(camera, x + corners[j]![0], y, z + corners[j]![1]);
    list.push({
      points: [a, b, apex],
      color: shade(spec.color, lerp(-0.24, -0.02, toneOf(wx, wz))),
      depth: depthOf(camera, x + (corners[i]![0] + corners[j]![0]) / 2, z + (corners[i]![1] + corners[j]![1]) / 2),
    });
  }
  list.sort((a, b) => a.depth - b.depth);
  for (const item of list) fillPoly(ctx, item.points, item.color);
}

/* ------------------------------------------------------------------ *
 * 樹木
 * ------------------------------------------------------------------ */

export function drawTree(
  ctx: Ctx,
  camera: IsoCamera,
  tree: { x: number; z: number; size: number; kind: 'round' | 'cone' | 'cloud'; tone: 0 | 1 },
  palette: DioramaPalette,
  detailed: boolean,
): void {
  const base = toScreen(camera, tree.x, 0, tree.z);
  const crown = tree.size * camera.span;
  const trunkHeight = crown * (tree.kind === 'cone' ? 1.05 : 1.48);
  const leaf = mix(tree.tone === 1 ? palette.foliageDeep : palette.foliage, '#ffffff', 0.22);
  const leafLite = mix(leaf, '#ffffff', 0.48);
  const top = base.y - trunkHeight;
  const rng = createRng(`tree:${tree.x.toFixed(3)}:${tree.z.toFixed(3)}`);

  fillEllipse(ctx, base.x, base.y + crown * 0.02, crown * 0.18, crown * 0.06, palette.shadow, 0.1);

  ctx.save();
  ctx.globalAlpha = 0.72 * opacityScale;
  ctx.strokeStyle = mix(palette.bark, leaf, 0.35);
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(0.8, crown * 0.038);
  ctx.beginPath();
  ctx.moveTo(base.x, base.y);
  ctx.lineTo(base.x - crown * 0.02, top + crown * 0.08);
  ctx.stroke();
  ctx.lineWidth = Math.max(0.6, crown * 0.03);
  const forks: readonly (readonly [number, number, number])[] =
    tree.kind === 'cone'
      ? [
          [-0.2, 0.42, 0.55],
          [0.18, 0.58, 0.7],
          [-0.1, 0.78, 0.82],
        ]
      : tree.kind === 'cloud'
        ? [
            [-0.48, 0.28, 0.35],
            [0.46, 0.34, 0.4],
            [-0.22, 0.58, 0.62],
            [0.26, 0.66, 0.7],
            [0.02, 0.88, 0.9],
          ]
        : [
            [-0.38, 0.36, 0.42],
            [0.36, 0.44, 0.5],
            [-0.16, 0.7, 0.74],
            [0.14, 0.82, 0.86],
          ];
  for (const [dx, join, tip] of forks) {
    ctx.beginPath();
    ctx.moveTo(base.x - crown * 0.02, top + crown * (1 - join) * 0.2);
    ctx.lineTo(base.x + dx * crown, top - tip * crown * 0.12);
    ctx.stroke();
  }
  ctx.restore();

  if (tree.kind === 'cone') {
    const tiers = detailed ? 5 : 3;
    for (let i = 0; i < tiers; i += 1) {
      const t = i / (tiers - 1);
      const w = crown * (0.92 - t * 0.62);
      const y = top - crown * (0.08 + t * 0.95);
      fillEllipse(ctx, base.x + crown * 0.04, y + crown * 0.04, w * 0.92, w * 0.38, shade(leaf, -0.08), 0.22);
      fillEllipse(ctx, base.x, y, w, w * 0.36, leaf, 0.38);
      if (detailed) fillEllipse(ctx, base.x - w * 0.22, y - w * 0.12, w * 0.42, w * 0.16, leafLite, 0.28);
    }
    return;
  }

  const clusters: readonly (readonly [number, number, number])[] =
    tree.kind === 'cloud'
      ? [
          [-0.38, -0.08, 0.46],
          [0.4, -0.02, 0.42],
          [0.02, -0.42, 0.58],
          [-0.18, 0.22, 0.34],
          [0.22, 0.18, 0.32],
        ]
      : [
          [0.02, -0.38, 0.62],
          [-0.32, 0.02, 0.42],
          [0.3, 0.06, 0.4],
          [-0.08, 0.28, 0.3],
        ];
  for (const cluster of clusters) {
    const dx = cluster[0];
    const dy = cluster[1];
    const scale = cluster[2];
    fillEllipse(ctx, base.x + dx * crown + crown * 0.05, top + dy * crown + crown * 0.06, crown * scale * 0.95, crown * scale * 0.62, shade(leaf, -0.08), 0.16);
  }
  for (const cluster of clusters) {
    const dx = cluster[0];
    const dy = cluster[1];
    const scale = cluster[2];
    fillEllipse(ctx, base.x + dx * crown, top + dy * crown, crown * scale, crown * scale * 0.66, leaf, 0.36);
  }
  if (detailed) {
    for (let i = 0; i < Math.min(3, clusters.length); i += 1) {
      const cluster = clusters[i]!;
      const dx = cluster[0];
      const dy = cluster[1];
      const scale = cluster[2];
      fillEllipse(
        ctx,
        base.x + dx * crown - crown * 0.16,
        top + dy * crown - crown * 0.14,
        crown * scale * 0.38,
        crown * scale * 0.22,
        leafLite,
        0.28,
      );
    }
    const dots = 10;
    for (let i = 0; i < dots; i += 1) {
      fillCircle(
        ctx,
        base.x + rng.range(-0.42, 0.42) * crown,
        top + rng.range(-0.5, 0.22) * crown,
        Math.max(0.5, crown * rng.range(0.028, 0.05)),
        leafLite,
        0.35,
      );
    }
  }
}

function limb(
  ctx: Ctx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  width: number,
  color: string,
): void {
  ctx.save();
  ctx.globalAlpha = 0.94 * opacityScale;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.restore();
}

/** 歩いている人。胴・頭・振る手足を持つ小さな立体。 */
export function drawFigure(
  ctx: Ctx,
  camera: IsoCamera,
  x: number,
  z: number,
  palette: DioramaPalette,
  motion: { walk: number; alongX: boolean; direction: 1 | -1; size: number },
): void {
  const foot = toScreen(camera, x, 0, z);
  const ahead = toScreen(
    camera,
    x + (motion.alongX ? motion.direction * 0.08 : 0),
    0,
    z + (motion.alongX ? 0 : motion.direction * 0.08),
  );
  const faceLen = Math.hypot(ahead.x - foot.x, ahead.y - foot.y) || 1;
  const nx = (ahead.x - foot.x) / faceLen;
  const ny = (ahead.y - foot.y) / faceLen;
  const h = camera.span * motion.size;
  const swing = Math.sin(motion.walk * Math.PI * 2);
  const lean = h * 0.07;
  const cx = foot.x + nx * lean;
  const hipY = foot.y - h * 0.4;
  const shoulderY = foot.y - h * 0.7;
  const headY = foot.y - h * 0.9;
  const stride = h * 0.22;
  const body = palette.accentPrimary;
  const cloth = mix(body, '#ffffff', 0.18);
  const skin = mix(body, '#ffffff', 0.42);

  fillEllipse(ctx, foot.x, foot.y + h * 0.02, h * 0.2, h * 0.08, palette.shadow, 0.22);

  const backLeg = -swing;
  limb(
    ctx,
    cx,
    hipY,
    cx + nx * backLeg * stride,
    foot.y - Math.abs(backLeg) * h * 0.05 + ny * backLeg * stride * 0.18,
    Math.max(1.6, h * 0.09),
    shade(body, -0.12),
  );
  limb(
    ctx,
    cx,
    shoulderY,
    cx + nx * swing * h * 0.16,
    shoulderY + h * 0.2 + ny * swing * h * 0.08,
    Math.max(1.3, h * 0.07),
    shade(cloth, -0.08),
  );

  fillEllipse(ctx, cx, (hipY + shoulderY) * 0.5, h * 0.11, h * 0.2, cloth, 0.96);
  fillEllipse(ctx, cx - nx * h * 0.03, (hipY + shoulderY) * 0.5 - h * 0.04, h * 0.07, h * 0.14, mix(cloth, '#ffffff', 0.28), 0.55);

  limb(
    ctx,
    cx,
    hipY,
    cx + nx * swing * stride,
    foot.y - Math.abs(swing) * h * 0.06 + ny * swing * stride * 0.18,
    Math.max(1.7, h * 0.1),
    body,
  );
  limb(
    ctx,
    cx,
    shoulderY,
    cx - nx * swing * h * 0.17,
    shoulderY + h * 0.22 - ny * swing * h * 0.08,
    Math.max(1.3, h * 0.07),
    cloth,
  );

  fillCircle(ctx, cx + nx * lean * 0.45, headY + ny * lean * 0.2, h * 0.13, skin, 0.98);
  fillCircle(ctx, cx + nx * lean * 0.45 - h * 0.04, headY + ny * lean * 0.2 - h * 0.04, h * 0.05, '#ffffff', 0.45);
}

/* ------------------------------------------------------------------ *
 * 小物（車・ベンチ・街灯・小舟）
 * ------------------------------------------------------------------ */

/** 浮上の光・発光体の色。都市のアクセントをそのまま光らせる */
export function glowColor(palette: DioramaPalette): string {
  return palette.glow;
}

/**
 * 2127 年の自律走行ポッド。タイヤは無く、路面から少し浮いて、
 * 足元に浮上光を落とす。バスは窓帯の長いシャトルになる。
 */
export function drawVehicle(
  ctx: Ctx,
  camera: IsoCamera,
  spec: {
    x: number;
    z: number;
    alongX: boolean;
    long: boolean;
    color: string;
    palette: DioramaPalette;
    detailed: boolean;
    /** 進行方向。前照灯（前）と尾灯（後ろ）の位置を決める */
    direction?: 1 | -1;
  },
): void {
  const { palette } = spec;
  const direction = spec.direction ?? 1;
  const length = spec.long ? 0.14 : 0.082;
  const width = spec.long ? 0.048 : 0.042;
  const w = spec.alongX ? length : width;
  const d = spec.alongX ? width : length;
  const hover = 0.016;
  const bodyH = spec.long ? 0.038 : 0.02;
  const glow = glowColor(palette);
  const glass = palette.glassDeep;
  const glassFront = mix(palette.buildingGlass, '#ffffff', 0.38);

  const frontIndex = spec.alongX ? (direction > 0 ? 1 : 3) : direction > 0 ? 2 : 0;
  const backIndex = (frontIndex + 2) % 4;
  const isEnd = (index: number): boolean => index % 2 === frontIndex % 2;

  drawContactShadow(ctx, camera, spec.x, spec.z, length * 0.52, palette.shadow, 0.22);
  drawContactShadow(ctx, camera, spec.x, spec.z, length * 0.7, glow, 0.55);

  // 浮上ユニット（前後 2 基）
  const unitShift = length * 0.28 * direction;
  for (const sign of [-1, 1] as const) {
    drawBox(ctx, camera, {
      x: spec.x + (spec.alongX ? unitShift * sign * 0.35 : 0),
      z: spec.z + (spec.alongX ? 0 : unitShift * sign * 0.35),
      y: hover * 0.22,
      width: spec.alongX ? w * 0.22 : d * 0.7,
      depth: spec.alongX ? d * 0.7 : w * 0.22,
      height: hover * 0.5,
      color: shade(palette.buildingMid, -0.12),
      topColor: glow,
    });
  }

  const body = drawBox(ctx, camera, {
    x: spec.x,
    z: spec.z,
    y: hover,
    width: w,
    depth: d,
    height: bodyH,
    color: spec.color,
    topColor: mix(spec.color, '#ffffff', 0.22),
  });

  if (spec.long) {
    for (const face of body.faces) {
      if (isEnd(face.index)) {
        faceRect(ctx, face.basis, 0.1, 0.38, 0.9, 0.92, face.index === frontIndex ? glassFront : glass, 0.95);
        if (spec.detailed && face.index === frontIndex) {
          faceRect(ctx, face.basis, 0.14, 0.52, 0.5, 0.82, '#ffffff', 0.28);
        }
        continue;
      }
      faceRect(ctx, face.basis, 0.05, 0.42, 0.95, 0.88, glass, 0.94);
      faceRect(ctx, face.basis, 0.03, 0.12, 0.97, 0.22, glow, 0.92);
      if (spec.detailed) {
        for (let i = 1; i < 5; i += 1) {
          const u = 0.05 + (0.9 / 5) * i;
          faceRect(ctx, face.basis, u - 0.008, 0.42, u + 0.008, 0.88, mix(spec.color, '#ffffff', 0.35), 0.7);
        }
        faceRect(ctx, face.basis, 0.08, 0.72, 0.38, 0.84, '#ffffff', 0.22);
      }
    }
  } else {
    for (const face of body.faces) {
      if (!isEnd(face.index)) faceRect(ctx, face.basis, 0.04, 0.22, 0.96, 0.36, glow, 0.88);
    }
    const shift = length * 0.06 * direction;
    const canopy = drawBox(ctx, camera, {
      x: spec.x + (spec.alongX ? shift : 0),
      z: spec.z + (spec.alongX ? 0 : shift),
      y: hover + bodyH,
      width: spec.alongX ? length * 0.58 : width * 0.82,
      depth: spec.alongX ? width * 0.82 : length * 0.58,
      height: 0.014,
      color: glass,
      topColor: mix(glassFront, '#ffffff', 0.28),
    });
    if (spec.detailed) {
      for (const face of canopy.faces) {
        if (face.index === frontIndex) {
          faceRect(ctx, face.basis, 0.08, 0.18, 0.92, 0.92, glassFront, 0.9);
          faceRect(ctx, face.basis, 0.14, 0.48, 0.48, 0.86, '#ffffff', 0.38);
        } else if (!isEnd(face.index)) {
          faceRect(ctx, face.basis, 0.08, 0.22, 0.92, 0.86, glass, 0.88);
          faceRect(ctx, face.basis, 0.12, 0.62, 0.42, 0.8, '#ffffff', 0.2);
        }
      }
    }
  }

  if (!spec.detailed) return;

  for (const face of body.faces) {
    if (face.index === frontIndex) {
      faceRect(ctx, face.basis, 0.08, spec.long ? 0.18 : 0.42, 0.92, spec.long ? 0.32 : 0.68, '#ffffff', 0.96);
      faceRect(ctx, face.basis, 0.12, spec.long ? 0.2 : 0.46, 0.36, spec.long ? 0.3 : 0.64, glow, 0.85);
      faceRect(ctx, face.basis, 0.64, spec.long ? 0.2 : 0.46, 0.88, spec.long ? 0.3 : 0.64, glow, 0.85);
    } else if (face.index === backIndex) {
      faceRect(ctx, face.basis, 0.1, spec.long ? 0.2 : 0.46, 0.9, spec.long ? 0.32 : 0.7, '#ef5a4c', 0.88);
    }
  }

  // 屋根のセンサー（ライダー）
  const roofY = hover + bodyH + (spec.long ? 0.002 : 0.016);
  const sensor = toScreen(camera, spec.x, roofY, spec.z);
  fillCircle(ctx, sensor.x, sensor.y, Math.max(1.2, camera.span * 0.004), mix(palette.buildingMid, '#ffffff', 0.4));
  fillCircle(ctx, sensor.x, sensor.y, Math.max(0.7, camera.span * 0.0022), glow);
}

/** 道路沿いの光の柱（2127 年の街灯）。細い柱の上部が縦に光る。 */
export function drawStreetLamp(
  ctx: Ctx,
  camera: IsoCamera,
  x: number,
  z: number,
  palette: DioramaPalette,
): void {
  const base = toScreen(camera, x, 0, z);
  const k = camera.span / 420;
  const height = 0.1 * camera.span;
  const pole = mix(palette.buildingLight, palette.buildingMid, 0.45);
  const light = glowColor(palette);

  fillEllipse(ctx, base.x, base.y, 2.8 * k, 1.4 * k, shade(palette.buildingMid, -0.22), 0.7);
  fillPoly(
    ctx,
    [
      { x: base.x - 1.4 * k, y: base.y },
      { x: base.x + 1.4 * k, y: base.y },
      { x: base.x + 0.75 * k, y: base.y - height },
      { x: base.x - 0.75 * k, y: base.y - height },
    ],
    pole,
  );
  fillPoly(
    ctx,
    [
      { x: base.x, y: base.y },
      { x: base.x + 1.4 * k, y: base.y },
      { x: base.x + 0.75 * k, y: base.y - height },
      { x: base.x, y: base.y - height },
    ],
    shade(pole, -0.16),
    0.8,
  );

  const barTop = base.y - height;
  const barBottom = base.y - height * 0.58;
  drawGlow(ctx, base.x, (barTop + barBottom) / 2, camera.span * 0.038, light, 0.6);
  fillPoly(
    ctx,
    [
      { x: base.x - 1.15 * k, y: barBottom },
      { x: base.x + 1.15 * k, y: barBottom },
      { x: base.x + 1.15 * k, y: barTop },
      { x: base.x - 1.15 * k, y: barTop },
    ],
    '#ffffff',
    0.96,
  );
  fillCircle(ctx, base.x, barTop - 1.4 * k, 1.9 * k, light);
  fillCircle(ctx, base.x - 0.4 * k, barTop - 1.7 * k, 0.6 * k, '#ffffff', 0.7);
}

export function drawBench(
  ctx: Ctx,
  camera: IsoCamera,
  x: number,
  z: number,
  alongX: boolean,
  palette: DioramaPalette,
): void {
  drawBox(ctx, camera, {
    x,
    z,
    y: 0.006,
    width: alongX ? 0.062 : 0.024,
    depth: alongX ? 0.024 : 0.062,
    height: 0.012,
    color: mix(palette.buildingMid, palette.bark, 0.6),
  });
}

/** 水上艇（尖った船首、ガラスの天蓋、船尾の引き波）。 */
export function drawBoat(
  ctx: Ctx,
  camera: IsoCamera,
  x: number,
  z: number,
  alongX: boolean,
  color: string,
  palette: DioramaPalette,
): void {
  const len = 0.12;
  const wid = 0.04;
  const glow = glowColor(palette);
  drawSurface(ctx, camera, {
    x: x - (alongX ? len * 0.55 : 0),
    z: z - (alongX ? 0 : len * 0.55),
    width: alongX ? len * 1.15 : wid * 0.7,
    depth: alongX ? wid * 0.7 : len * 1.15,
    y: 0.0015,
    color: '#ffffff',
    alpha: 0.36,
  });
  const hull = drawBox(ctx, camera, {
    x,
    z,
    y: 0.004,
    width: alongX ? len : wid,
    depth: alongX ? wid : len,
    height: 0.015,
    color,
    topColor: mix(color, '#ffffff', 0.22),
  });
  for (const face of hull.faces) {
    faceRect(ctx, face.basis, 0.04, 0.58, 0.96, 0.78, glow, 0.8);
  }
  const nose = alongX ? 0.055 : 0;
  const noseZ = alongX ? 0 : 0.055;
  const bow = toScreen(camera, x + nose, 0.012, z + noseZ);
  const port = toScreen(camera, x + (alongX ? len * 0.18 : -wid * 0.42), 0.006, z + (alongX ? -wid * 0.42 : len * 0.18));
  const star = toScreen(camera, x + (alongX ? len * 0.18 : wid * 0.42), 0.006, z + (alongX ? wid * 0.42 : len * 0.18));
  fillPoly(ctx, [bow, port, star], mix(color, '#ffffff', 0.12), 0.92);
  drawBox(ctx, camera, {
    x: x - (alongX ? len * 0.06 : 0),
    z: z - (alongX ? 0 : len * 0.06),
    y: 0.019,
    width: alongX ? len * 0.42 : wid * 0.68,
    depth: alongX ? wid * 0.68 : len * 0.42,
    height: 0.014,
    color: palette.glassDeep,
    topColor: mix(palette.buildingGlass, '#ffffff', 0.38),
  });
  const mast = toScreen(camera, x, 0.046, z);
  fillCircle(ctx, mast.x, mast.y, Math.max(0.8, camera.span * 0.003), glow, 0.85);
}

/* ------------------------------------------------------------------ *
 * 空の装飾
 * ------------------------------------------------------------------ */

/**
 * 積雲。平らな底・陰になった下半分・日の当たる上面、の 3 層で描く。
 * （楕円を 3 つ重ねただけだと、白い円の塊にしか見えない）
 */
export function drawCloud(
  ctx: Ctx,
  center: Point2,
  size: number,
  color: string,
  alpha: number,
  shadowTint?: string,
): void {
  const shadow = shadowTint ?? shade(color, -0.1);
  const puffs: readonly (readonly [number, number, number])[] = [
    [-0.78, 0.16, 0.46],
    [-0.36, -0.14, 0.66],
    [0.16, -0.26, 0.8],
    [0.62, -0.02, 0.6],
    [0.98, 0.2, 0.4],
  ];

  // 平らな底（陰）
  fillEllipse(ctx, center.x + size * 0.1, center.y + size * 0.26, size * 1.34, size * 0.2, shadow, alpha * 0.9);
  // 下半分の陰
  for (const [dx, dy, r] of puffs) {
    fillEllipse(ctx, center.x + dx * size, center.y + dy * size * 0.62 + size * 0.07, size * r, size * r * 0.78, shadow, alpha);
  }
  // 本体
  for (const [dx, dy, r] of puffs) {
    fillEllipse(ctx, center.x + dx * size, center.y + dy * size * 0.62 - size * 0.03, size * r * 0.94, size * r * 0.72, color, alpha);
  }
  // 日の当たる上面
  for (const [dx, dy, r] of puffs.slice(1, 4)) {
    fillEllipse(
      ctx,
      center.x + dx * size - size * r * 0.2,
      center.y + dy * size * 0.62 - size * r * 0.32,
      size * r * 0.5,
      size * r * 0.34,
      '#ffffff',
      alpha * 0.85,
    );
  }
}

export function drawSparkle(ctx: Ctx, center: Point2, size: number, color: string, alpha: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, size * 0.16);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(center.x, center.y - size);
  ctx.lineTo(center.x, center.y + size);
  ctx.moveTo(center.x - size, center.y);
  ctx.lineTo(center.x + size, center.y);
  ctx.stroke();
  ctx.restore();
  fillCircle(ctx, center.x, center.y, size * 0.22, color, alpha);
}

/** 背景の柔らかいむら（単色の面を保ったまま、中心をわずかに持ち上げる）。 */
export function paintBackdrop(ctx: Ctx, width: number, height: number, background: string): void {
  const gradient = ctx.createRadialGradient(
    width * 0.5,
    height * 0.42,
    Math.min(width, height) * 0.05,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.72,
  );
  gradient.addColorStop(0, shade(background, 0.06));
  gradient.addColorStop(0.55, shade(background, 0.02));
  gradient.addColorStop(1, shade(background, -0.03));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

/* ------------------------------------------------------------------ *
 * 浮島の底・芝生・橋・信号機
 * ------------------------------------------------------------------ */

/**
 * 上下 2 つの輪を結ぶ錐台の側面。浮島の岩の底などに使う。
 * 凸形状なので、手前を向いた面を奥から順に塗れば前後関係は崩れない。
 */
export function drawFrustum(
  ctx: Ctx,
  camera: IsoCamera,
  spec: {
    readonly top: readonly WorldPoint[];
    readonly bottom: readonly WorldPoint[];
    readonly yTop: number;
    readonly yBottom: number;
    readonly color: string;
  },
): void {
  const c = Math.cos(camera.rot);
  const s = Math.sin(camera.rot);
  const count = Math.min(spec.top.length, spec.bottom.length);
  const list: { points: Point2[]; color: string; depth: number }[] = [];

  for (let i = 0; i < count; i += 1) {
    const j = (i + 1) % count;
    const a = spec.top[i]!;
    const b = spec.top[j]!;
    // 輪は時計回りに並んでいるので、辺ベクトルを 90 度回すと外向き法線になる
    const nx = b.z - a.z;
    const nz = -(b.x - a.x);
    const length = Math.hypot(nx, nz) || 1;
    const wx = (nx / length) * c - (nz / length) * s;
    const wz = (nx / length) * s + (nz / length) * c;
    if (wx + wz <= 0) continue;

    list.push({
      points: [
        toScreen(camera, a.x, spec.yTop, a.z),
        toScreen(camera, b.x, spec.yTop, b.z),
        toScreen(camera, spec.bottom[j]!.x, spec.yBottom, spec.bottom[j]!.z),
        toScreen(camera, spec.bottom[i]!.x, spec.yBottom, spec.bottom[i]!.z),
      ],
      color: sideColor(spec.color, toneOf(wx, wz)),
      depth: depthOf(camera, (a.x + b.x) / 2, (a.z + b.z) / 2),
    });
  }

  list.sort((p, q) => p.depth - q.depth);
  for (const item of list) fillPoly(ctx, item.points, item.color);
}

/** 公園の白い床。アクセントの点だけを散らす。 */
export function drawLawn(
  ctx: Ctx,
  camera: IsoCamera,
  lawn: { id: string; x: number; z: number; width: number; depth: number },
  palette: DioramaPalette,
): void {
  const pad = mix(palette.platformTop, palette.foliage, 0.04);
  drawSurface(ctx, camera, {
    x: lawn.x,
    z: lawn.z,
    width: lawn.width,
    depth: lawn.depth,
    y: 0.0012,
    color: mix(pad, '#ffffff', 0.35),
  });
  drawSurface(ctx, camera, {
    x: lawn.x,
    z: lawn.z,
    width: lawn.width * 0.92,
    depth: lawn.depth * 0.92,
    y: 0.0014,
    color: pad,
  });
  const rng = createRng(`lawn:${lawn.id}`);
  for (let i = 0; i < 6; i += 1) {
    const p = toScreen(
      camera,
      lawn.x + rng.range(-0.38, 0.38) * lawn.width,
      0.002,
      lawn.z + rng.range(-0.38, 0.38) * lawn.depth,
    );
    fillCircle(ctx, p.x, p.y, Math.max(0.6, camera.span * 0.0032), palette.accentPrimary, 0.35);
  }
}

/** 水面を渡る橋（床版・欄干・橋脚）。 */
export function drawBridge(
  ctx: Ctx,
  camera: IsoCamera,
  surface: { x: number; z: number; width: number; depth: number; orientation?: 'ns' | 'ew' | 'cross' },
  palette: DioramaPalette,
): void {
  const alongZ = surface.orientation !== 'ew';
  const deckColor = mix(palette.buildingLight, palette.road, 0.4);
  const rail = shade(palette.buildingMid, -0.08);

  // 床版の上面は道路と同じ高さ（y≒0）に揃える。
  // 高くすると、車（y=0 を走る）が橋の床に沈んで見える。
  // 橋脚（水面から立ち上がる）
  for (const t of [-0.3, 0.3]) {
    drawBox(ctx, camera, {
      x: surface.x + (alongZ ? 0 : t * surface.width),
      z: surface.z + (alongZ ? t * surface.depth : 0),
      y: -0.03,
      width: alongZ ? surface.width * 0.7 : surface.width * 0.12,
      depth: alongZ ? surface.depth * 0.12 : surface.depth * 0.7,
      height: 0.022,
      color: shade(deckColor, -0.18),
    });
  }
  // 床版
  drawBox(ctx, camera, {
    x: surface.x,
    z: surface.z,
    y: -0.008,
    width: alongZ ? surface.width * 0.86 : surface.width,
    depth: alongZ ? surface.depth : surface.depth * 0.86,
    height: 0.0095,
    color: deckColor,
    topColor: shade(palette.road, -0.06),
  });
  // 欄干（道路の両側）
  for (const side of [-1, 1]) {
    drawBox(ctx, camera, {
      x: surface.x + (alongZ ? side * surface.width * 0.42 : 0),
      z: surface.z + (alongZ ? 0 : side * surface.depth * 0.42),
      y: 0.0015,
      width: alongZ ? 0.008 : surface.width,
      depth: alongZ ? surface.depth : 0.008,
      height: 0.016,
      color: rail,
    });
  }
}

/** 信号機の柱と灯器（灯りは動的に drawSignalLamp で重ねる）。 */
export function drawSignalPost(
  ctx: Ctx,
  camera: IsoCamera,
  x: number,
  z: number,
  palette: DioramaPalette,
): void {
  const base = toScreen(camera, x, 0, z);
  const height = 0.1 * camera.span;
  const pole = shade(palette.buildingMid, -0.18);
  fillPoly(
    ctx,
    [
      { x: base.x - 1.1, y: base.y },
      { x: base.x + 1.1, y: base.y },
      { x: base.x + 0.9, y: base.y - height },
      { x: base.x - 0.9, y: base.y - height },
    ],
    pole,
  );
  const w = camera.span * 0.03;
  const h = camera.span * 0.012;
  ctx.globalAlpha = opacityScale;
  ctx.fillStyle = shade(palette.buildingMid, -0.28);
  ctx.beginPath();
  ctx.roundRect(base.x - w / 2, base.y - height - h, w, h, h * 0.4);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/**
 * 信号の灯り。進行・注意・停止は本来の緑・黄・赤で示す。
 */
export function drawSignalLamp(
  ctx: Ctx,
  camera: IsoCamera,
  x: number,
  z: number,
  state: 'go' | 'caution' | 'stop',
  palette: DioramaPalette,
): void {
  const base = toScreen(camera, x, 0, z);
  const height = 0.1 * camera.span;
  const w = camera.span * 0.03;
  const h = camera.span * 0.012;
  const cy = base.y - height - h / 2;
  const off = shade(palette.buildingMid, -0.3);
  const slots = [
    { u: -0.3, color: '#39c47a', on: state === 'go' },
    { u: 0, color: '#f2c14e', on: state === 'caution' },
    { u: 0.3, color: '#ef5a4c', on: state === 'stop' },
  ];
  for (const slot of slots) {
    const cx = base.x + slot.u * w;
    if (slot.on) fillCircle(ctx, cx, cy, h * 1.15, slot.color, 0.38);
    fillCircle(ctx, cx, cy, h * 0.34, slot.on ? slot.color : off, slot.on ? 1 : 0.85);
    if (slot.on) fillCircle(ctx, cx - h * 0.08, cy - h * 0.08, h * 0.12, '#ffffff', 0.7);
  }
}

export { createRng, toneOf, sideColor };

/* ------------------------------------------------------------------ *
 * 光と円筒（2127 年の造形）
 * ------------------------------------------------------------------ */

/** 光のにじみ（中心から外へ透明になる円）。灯りや発光体のまわりに使う。 */
export function drawGlow(ctx: Ctx, x: number, y: number, r: number, color: string, alpha: number): void {
  if (!(r > 0)) return;
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
  gradient.addColorStop(0, rgba(color, Math.min(1, alpha * opacityScale)));
  gradient.addColorStop(1, rgba(color, 0));
  ctx.globalAlpha = 1;
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** 水平な円盤（世界座標の半径 radius、高さ y）。 */
export function fillDisc(
  ctx: Ctx,
  camera: IsoCamera,
  x: number,
  y: number,
  z: number,
  radius: number,
  color: string,
  alpha = 1,
): void {
  const c = toScreen(camera, x, y, z);
  const rx = radius * camera.span * Math.SQRT1_2;
  fillEllipse(ctx, c.x, c.y, rx, rx * ISO_VERTICAL_RATIO, color, alpha);
}

/** 水平な輪（円周の線）。 */
export function strokeRing(
  ctx: Ctx,
  camera: IsoCamera,
  x: number,
  y: number,
  z: number,
  radius: number,
  color: string,
  lineWidth: number,
  alpha = 1,
  half: 'all' | 'front' | 'back' = 'all',
): void {
  const c = toScreen(camera, x, y, z);
  const rx = radius * camera.span * Math.SQRT1_2;
  ctx.globalAlpha = alpha * opacityScale;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  if (half === 'front') ctx.ellipse(c.x, c.y, rx, rx * ISO_VERTICAL_RATIO, 0, 0, Math.PI);
  else if (half === 'back') ctx.ellipse(c.x, c.y, rx, rx * ISO_VERTICAL_RATIO, 0, Math.PI, Math.PI * 2);
  else ctx.ellipse(c.x, c.y, rx, rx * ISO_VERTICAL_RATIO, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

export interface CylinderResult {
  /** 画面上の中心 x */
  readonly cx: number;
  readonly bottomY: number;
  readonly topY: number;
  /** 画面上の楕円の半径 */
  readonly rx: number;
  readonly ry: number;
}

/**
 * 鉛直な円筒。円は回しても形が変わらないので、背面消去は要らない。
 * 側面は受光側（画面右）ほど明るい階調で塗り、上面は楕円。
 */
export function drawCylinder(
  ctx: Ctx,
  camera: IsoCamera,
  spec: {
    x: number;
    z: number;
    y: number;
    radius: number;
    height: number;
    color: string;
    topColor?: string;
    /** 側面だけ描く（上に別のものを載せるとき） */
    noTop?: boolean;
  },
): CylinderResult {
  const b = toScreen(camera, spec.x, spec.y, spec.z);
  const t = toScreen(camera, spec.x, spec.y + spec.height, spec.z);
  const rx = spec.radius * camera.span * Math.SQRT1_2;
  const ry = rx * ISO_VERTICAL_RATIO;

  const gradient = ctx.createLinearGradient(b.x - rx, 0, b.x + rx, 0);
  gradient.addColorStop(0, shade(spec.color, -0.26));
  gradient.addColorStop(0.5, shade(spec.color, -0.12));
  gradient.addColorStop(0.84, shade(spec.color, -0.01));
  gradient.addColorStop(1, shade(spec.color, -0.09));
  ctx.globalAlpha = opacityScale;
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(t.x - rx, t.y);
  ctx.lineTo(b.x - rx, b.y);
  ctx.ellipse(b.x, b.y, rx, ry, 0, Math.PI, 0, true);
  ctx.lineTo(t.x + rx, t.y);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  if (!spec.noTop) fillEllipse(ctx, t.x, t.y, rx, ry, shade(spec.topColor ?? spec.color, 0.07));
  return { cx: b.x, bottomY: b.y, topY: t.y, rx, ry };
}

/** 円筒の手前半分に巻く帯（窓の帯・光の帯）。 */
export function cylinderBand(
  ctx: Ctx,
  camera: IsoCamera,
  spec: { x: number; z: number; radius: number; y0: number; y1: number; color: string; alpha?: number },
): void {
  const lo = toScreen(camera, spec.x, spec.y0, spec.z);
  const hi = toScreen(camera, spec.x, spec.y1, spec.z);
  const rx = spec.radius * camera.span * Math.SQRT1_2;
  const ry = rx * ISO_VERTICAL_RATIO;
  ctx.globalAlpha = (spec.alpha ?? 1) * opacityScale;
  ctx.fillStyle = spec.color;
  ctx.beginPath();
  ctx.moveTo(lo.x - rx, lo.y);
  ctx.ellipse(lo.x, lo.y, rx, ry, 0, Math.PI, 0, true);
  ctx.lineTo(hi.x + rx, hi.y);
  ctx.ellipse(hi.x, hi.y, rx, ry, 0, 0, Math.PI, false);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** 円筒の手前に立つ縦の線（方立て・リブ）。u は -1（左端）..1（右端）。 */
export function cylinderFin(
  ctx: Ctx,
  camera: IsoCamera,
  spec: {
    x: number;
    z: number;
    radius: number;
    y0: number;
    y1: number;
    u: number;
    /** 線の太さ（px） */
    width: number;
    color: string;
    alpha?: number;
  },
): void {
  const lo = toScreen(camera, spec.x, spec.y0, spec.z);
  const hi = toScreen(camera, spec.x, spec.y1, spec.z);
  const rx = spec.radius * camera.span * Math.SQRT1_2;
  const ry = rx * ISO_VERTICAL_RATIO;
  const bulge = Math.sqrt(Math.max(0, 1 - spec.u * spec.u));
  const px = lo.x + rx * spec.u;
  const hw = Math.max(0.35, spec.width * 0.5 * (0.35 + 0.65 * bulge));
  const off = ry * bulge;
  fillPoly(
    ctx,
    [
      { x: px - hw, y: lo.y + off },
      { x: px + hw, y: lo.y + off },
      { x: px + hw, y: hi.y + off },
      { x: px - hw, y: hi.y + off },
    ],
    spec.color,
    spec.alpha ?? 1,
  );
}
