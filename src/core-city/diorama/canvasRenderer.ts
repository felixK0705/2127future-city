import { mix, shade } from '../color';
import { clamp, createRng } from '../rng';
import { buildDioramaLayout } from './layout';
import {
  chamferedSquare,
  depthOf,
  drawBench,
  drawBoat,
  drawFigure,
  drawBridge,
  drawCloud,
  drawContactShadow,
  drawExtrudedPolygon,
  drawLawn,
  drawSignalLamp,
  drawSignalPost,
  drawSparkle,
  drawStreetLamp,
  drawSurface,
  drawTree,
  drawVehicle,
  glowColor,
  toScreen,
  withOpacity,
  type Ctx,
  type IsoCamera,
} from './canvasPrimitives';
import { drawBuilding } from './canvasBuildings';
import { drawLandmarkBase, drawLandmarkSpinner, landmarkSpinSeconds } from './canvasLandmarks';
import { createScenery } from './canvasScenery';
import { drawDrone, drawGuideway, drawSkybridge, drawTrainCar, drawWallSegment } from './canvasInfra';
import type {
  DioramaConfig,
  DioramaLayout,
  DioramaRoad,
  DioramaSignal,
  DioramaGuideway,
  DioramaSkybridge,
  DioramaVehicle,
  DioramaWallSegment,
  PlacedDioramaLandmark,
  RendererInfo,
} from './types';

/**
 * Canvas2D によるアイソメトリック・ジオラマ都市。
 *
 * **WebGL を一切使わない。** 2D コンテキストはどのブラウザでも利用できる。
 *
 * 街は Y 軸まわりに回せて、拡大縮小もできる。回すと見える面が変わるため、
 * 静止部分は向きが変わるたびに焼き直す。
 *
 * 操作中も**描く内容は一切省かない**。以前は操作中だけ窓・樹影・路面標示を省いた簡略版に
 * 切り替えていたため、触った瞬間に街が別物に変わって見えた。
 * 拡大縮小も静止部分を焼き直す。前回の絵を伸ばすと、壁が透明画素と混ざって
 * 建物が透けて見える。焼く解像度は落とさない。完成した 1 枚だけを画面へ載せる。
 */

export interface CanvasDioramaHandle {
  readonly info: RendererInfo;
  resize(width: number, height: number): void;
  /** 市民証に載せる 1 枚（dataURL） */
  snapshot(): string;
  /** 前面にパネルが出ているあいだは描画を止める */
  setPaused(paused: boolean): void;
  /** 視点を初期状態へ戻す */
  resetView(): void;
  /** 回転角を指定して焼き直す（検証・キャプチャ用） */
  setView(rotation: number): void;
  destroy(): void;
}

export class CanvasUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CanvasUnavailableError';
  }
}

/** Canvas2D が使えるかどうか（実質どの環境でも true）。 */
export function probeCanvas2D(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    return Boolean(document.createElement('canvas').getContext('2d'));
  } catch {
    return false;
  }
}

const MIN_ZOOM = 0.65;
const MAX_ZOOM = 2.6;

/* ------------------------------------------------------------------ *
 * 交通
 * ------------------------------------------------------------------ */

/** 信号の周期（秒）。青→黄→赤。2 方向が同時に青になることはない */
const SIGNAL_CYCLE = 10;

function signalState(axis: 'x' | 'z', t: number): 'go' | 'caution' | 'stop' {
  const p = ((t % SIGNAL_CYCLE) + SIGNAL_CYCLE) % SIGNAL_CYCLE;
  if (axis === 'z') return p < 4 ? 'go' : p < 5 ? 'caution' : 'stop';
  return p < 5 ? 'stop' : p < 9 ? 'go' : 'caution';
}

const vehicleLength = (vehicle: DioramaVehicle): number => (vehicle.kind === 'bus' ? 0.13 : 0.078);

/** 台座の外側で見えなくなる位置（ここで反対側から入り直す） */
const EDGE = 1.08;
/** この範囲で車を出し入れする（瞬間移動に見せないためのフェード） */
const FADE = 0.16;

interface CarState {
  readonly vehicle: DioramaVehicle;
  readonly road: DioramaRoad;
  /** 道路に沿った位置 */
  s: number;
  speed: number;
}

function lanePosition(road: DioramaRoad, direction: 1 | -1, s: number): { x: number; z: number } {
  // 左側通行: 進む向きで車線が決まるので、対向車は必ず別の車線を走る
  const offset = road.lane * direction * (road.axis === 'z' ? -1 : 1);
  return road.axis === 'z' ? { x: road.at + offset, z: s } : { x: s, z: road.at + offset };
}

/* ------------------------------------------------------------------ */

function metricsOf(layout: DioramaLayout): { topUnits: number; bottomUnits: number } {
  const tallestBlock = layout.blocks.reduce((max, block) => Math.max(max, block.height), 0);
  const tallestLandmark = layout.landmarks.reduce(
    (max, landmark) => Math.max(max, landmark.height * 1.06),
    0,
  );
  return {
    topUnits: 0.5 + Math.max(0.35, tallestBlock, tallestLandmark),
    // 浮島の岩の底まで入るように、下は多めに取る
    bottomUnits: 0.5 + layout.platform.thickness + 0.42,
  };
}

/** 回る部品の軸の位置（世界座標）。遮蔽の前後判定に使う。 */
function spinnerHub(landmark: PlacedDioramaLandmark): { x: number; z: number; y: number; reach: number } {
  if (landmark.kind === 'windTurbine') {
    return {
      x: landmark.x,
      z: landmark.z + landmark.footprint * 0.12,
      y: landmark.height * 0.8,
      reach: landmark.height * 0.4,
    };
  }
  if (landmark.kind === 'aiCore') {
    return { x: landmark.x, z: landmark.z, y: landmark.height * 0.6, reach: landmark.footprint * 0.5 };
  }
  if (landmark.kind === 'skyTether') {
    return { x: landmark.x, z: landmark.z, y: landmark.height, reach: 0.1 };
  }
  if (landmark.kind === 'watchPylon') {
    return { x: landmark.x, z: landmark.z, y: 0.1, reach: 0.45 };
  }
  if (landmark.kind === 'windmill') {
    return {
      x: landmark.x,
      z: landmark.z + landmark.footprint * 0.46 * 0.44,
      y: landmark.height * 0.7 * 0.92,
      reach: landmark.height * 0.48,
    };
  }
  return { x: landmark.x, z: landmark.z, y: landmark.height * 0.42, reach: landmark.height * 0.34 };
}

export function createCanvasDiorama(options: {
  canvas: HTMLCanvasElement;
  config: DioramaConfig;
  width: number;
  height: number;
}): CanvasDioramaHandle {
  const { canvas, config } = options;
  const palette = config.palette;

  const context = canvas.getContext('2d', { alpha: false });
  if (!context) {
    throw new CanvasUnavailableError('この端末では Canvas2D コンテキストを取得できません');
  }
  const ctx: Ctx = context;

  const info: RendererInfo = {
    library: 'canvas',
    libraryVersion: 'native',
    backend: 'canvas2d',
    isWebGL: false,
    contextName: context.constructor.name,
    gpu: '',
    summary: `canvas2d / ${context.constructor.name} / WebGL 不使用`,
  };
  console.info(`[diorama] ${info.summary}`);

  const layout = buildDioramaLayout(config);
  const scenery = createScenery(config, layout);
  const cell = layout.platform.cell;

  let width = options.width;
  let height = options.height;
  let dpr = Math.min(1.5, window.devicePixelRatio || 1);

  /** 視点 */
  let rotation = 0;
  let zoom = 1;
  const metrics = metricsOf(layout);
  const fitSpan = (): number =>
    Math.min(width / 2.3, (height * 0.94) / (metrics.topUnits + metrics.bottomUnits));
  let baseSpan = fitSpan();

  const cameraNow = (): IsoCamera => {
    const span = baseSpan * zoom;
    const contentHeight = (metrics.topUnits + metrics.bottomUnits) * span;
    return {
      span,
      ox: width / 2,
      oy: (height - contentHeight) / 2 + metrics.topUnits * span,
      rot: rotation,
    };
  };

  let camera = cameraNow();

  const staticCanvas = document.createElement('canvas');
  const backdropCanvas = document.createElement('canvas');
  const overlayCanvas = document.createElement('canvas');

  /* ---------------- 焼く対象の並び ---------------- */

  type Centered<T> = T & { readonly x: number; readonly z: number };

  type Item =
    | { kind: 'block'; depth: number; value: (typeof layout.blocks)[number] }
    | { kind: 'tree'; depth: number; value: (typeof layout.trees)[number] }
    | { kind: 'prop'; depth: number; value: (typeof layout.props)[number] }
    | { kind: 'landmark'; depth: number; value: PlacedDioramaLandmark }
    | { kind: 'signal'; depth: number; value: DioramaSignal }
    | { kind: 'wall'; depth: number; value: Centered<DioramaWallSegment> }
    | { kind: 'skybridge'; depth: number; value: Centered<DioramaSkybridge> }
    | { kind: 'guideway'; depth: number; value: DioramaGuideway };

  interface Occluder {
    readonly depth: number;
    readonly x0: number;
    readonly y0: number;
    readonly x1: number;
    readonly y1: number;
    readonly item: Item;
  }

  let occluders: Occluder[] = [];
  const occluderMasks = new WeakMap<Occluder, { canvas: HTMLCanvasElement; sx: number; sy: number }>();

  function maskOf(occluder: Occluder): { canvas: HTMLCanvasElement; sx: number; sy: number } {
    const cached = occluderMasks.get(occluder);
    if (cached) return cached;
    const pad = 6;
    const sx = Math.floor(occluder.x0) - pad;
    const sy = Math.floor(occluder.y0) - pad;
    const w = Math.max(1, Math.ceil(occluder.x1) + pad - sx);
    const h = Math.max(1, Math.ceil(occluder.y1) + pad - sy);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    const ictx = canvas.getContext('2d');
    if (ictx) {
      ictx.setTransform(dpr, 0, 0, dpr, -sx * dpr, -sy * dpr);
      if (occluder.item.kind === 'tree') paintTreeMask(ictx, occluder.item.value);
      else paintItem(ictx, occluder.item);
      if (occluder.item.kind === 'landmark') solidifyMask(ictx);
    }
    const mask = { canvas, sx, sy };
    occluderMasks.set(occluder, mask);
    return mask;
  }

  /** 葉は半透明なので、そのまま destination-out すると人が木を突き抜ける。不透明な輪郭で消す。 */
  function paintTreeMask(
    target: Ctx,
    tree: (typeof layout.trees)[number],
  ): void {
    const base = toScreen(camera, tree.x, 0, tree.z);
    const crown = tree.size * camera.span;
    const trunkHeight = crown * (tree.kind === 'cone' ? 1.05 : 1.48);
    const top = base.y - trunkHeight;
    target.save();
    target.globalAlpha = 1;
    target.globalCompositeOperation = 'source-over';
    target.fillStyle = '#000000';
    const trunkW = Math.max(2.2, crown * 0.12);
    target.fillRect(base.x - trunkW / 2, top + crown * 0.02, trunkW, trunkHeight + crown * 0.04);
    target.beginPath();
    if (tree.kind === 'cone') target.ellipse(base.x, top - crown * 0.28, crown * 0.86, crown * 0.96, 0, 0, Math.PI * 2);
    else target.ellipse(base.x, top - crown * 0.1, crown * 1.02, crown * 0.88, 0, 0, Math.PI * 2);
    target.fill();
    target.restore();
  }

  function solidifyMask(ctx: CanvasRenderingContext2D): void {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    if (w < 1 || h < 1) return;
    const img = ctx.getImageData(0, 0, w, h);
    const data = img.data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i]! > 16) data[i] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  function paintItem(target: Ctx, item: Item): void {
    switch (item.kind) {
      case 'tree':
        drawTree(target, camera, item.value, palette, true);
        break;
      case 'landmark':
        drawLandmarkBase(target, camera, item.value, palette, true);
        break;
      case 'block':
        drawBuilding(target, camera, item.value, palette, true);
        break;
      case 'signal':
        drawSignalPost(target, camera, item.value.x, item.value.z, palette);
        break;
      case 'prop': {
        const prop = item.value;
        const alongX = prop.turn % 2 === 0;
        if (prop.kind === 'bench') drawBench(target, camera, prop.x, prop.z, alongX, palette);
        else if (prop.kind === 'lamp') drawStreetLamp(target, camera, prop.x, prop.z, palette);
        else if (prop.kind === 'boat') {
          drawBoat(
            target,
            camera,
            prop.x,
            prop.z,
            alongX,
            prop.color === 'accentSecondary' ? palette.accentSecondary : palette.buildingLight,
            palette,
          );
        }
        break;
      }
      case 'wall':
        drawWallSegment(target, camera, item.value, palette);
        break;
      case 'skybridge':
        drawSkybridge(target, camera, item.value, palette);
        break;
      case 'guideway':
        drawGuideway(target, camera, item.value, palette);
        break;
      default:
        break;
    }
  }

  function screenBox(x: number, z: number, radius: number, top: number) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const h of [0, top]) {
      for (const dx of [-radius, radius]) {
        for (const dz of [-radius, radius]) {
          const point = toScreen(camera, x + dx, h, z + dz);
          if (point.x < x0) x0 = point.x;
          if (point.y < y0) y0 = point.y;
          if (point.x > x1) x1 = point.x;
          if (point.y > y1) y1 = point.y;
        }
      }
    }
    return { x0, y0, x1, y1 };
  }

  function occluderOf(item: Item): Occluder {
    let radius = 0.06;
    let top = 0.12;
    if (item.kind === 'block') {
      radius = Math.max(item.value.width, item.value.depth) * 0.6;
      top = item.value.height + Math.max(item.value.width, item.value.depth) * 0.6;
    } else if (item.kind === 'tree') {
      radius = item.value.size * 1.4;
      top = item.value.size * 3.4;
    } else if (item.kind === 'landmark') {
      radius = item.value.footprint * 0.7;
      top = item.value.height;
    } else if (item.kind === 'wall') {
      radius = Math.max(Math.abs(item.value.x1 - item.value.x0), Math.abs(item.value.z1 - item.value.z0)) * 0.55;
      top = item.value.height * 2;
    } else if (item.kind === 'skybridge') {
      radius = Math.max(Math.abs(item.value.x1 - item.value.x0), Math.abs(item.value.z1 - item.value.z0)) * 0.55;
      top = item.value.y + 0.03;
    } else if (item.kind === 'guideway') {
      radius = item.value.length * 0.55;
      top = item.value.y + 0.01;
    }
    return { depth: item.depth, ...screenBox(item.value.x, item.value.z, radius, top), item };
  }

  /**
   * candidate が点 at を隠すか。
   * 建物を中心の奥行きだけで比べると、角の歩道に立つ信号や脇を走る車との前後を取り違える
   * （大きな箱は、中心が点より奥でも手前の角が点より前に出る）。
   * 点が建物の底面の外にあれば、底面の辺で分けて判定する（箱は軸に沿っていて、奥行きは線形）。
   */
  function hides(
    candidate: Occluder,
    depth: number,
    at: { readonly x: number; readonly z: number } | undefined,
    gx: number,
    gz: number,
  ): boolean {
    const item = candidate.item;
    // items の depth は「一番奥の角」（描画順用）。隠れ判定に使うと、
    // 木や建物の中心より手前にいる人でも「建物の方が奥」と誤判定して突き抜ける。
    const frontDepth = depthOf(camera, item.value.x, item.value.z);
    if (!at) return frontDepth > depth;
    if (item.kind === 'tree') {
      const dx = at.x - item.value.x;
      const dz = at.z - item.value.z;
      const reach = item.value.size * 1.25;
      if (dx * dx + dz * dz < reach * reach) return true;
      return frontDepth > depth;
    }
    if (item.kind === 'landmark') {
      const hx = item.value.footprint * 0.5;
      const hz = hx;
      const ox = at.x - item.value.x;
      const oz = at.z - item.value.z;
      if (Math.abs(ox) < hx && Math.abs(oz) < hz) return true;
      const pointInFront =
        (ox >= hx && gx > 0) || (ox <= -hx && gx < 0) || (oz >= hz && gz > 0) || (oz <= -hz && gz < 0);
      return !pointInFront;
    }
    if (item.kind !== 'block') return frontDepth > depth;
    const ox = at.x - item.value.x;
    const oz = at.z - item.value.z;
    const hx = item.value.width / 2;
    const hz = item.value.depth / 2;
    if (Math.abs(ox) < hx && Math.abs(oz) < hz) return true;
    // 点がカメラ側の面より外にあれば、建物のどこにも隠されない
    const pointInFront =
      (ox >= hx && gx > 0) || (ox <= -hx && gx < 0) || (oz >= hz && gz > 0) || (oz <= -hz && gz < 0);
    return !pointInFront;
  }

  /** 動くものだけを描く作業用の層（画面と同じ大きさ。使う範囲だけ毎回消す） */
  const moverCanvas = document.createElement('canvas');
  const moverCtx = moverCanvas.getContext('2d');
  /** 遠景・近景は半フレームに一度焼き、毎フレームは重ねるだけにする */
  const behindCanvas = document.createElement('canvas');
  const frontCanvas = document.createElement('canvas');
  const baseCanvas = document.createElement('canvas');
  const topCanvas = document.createElement('canvas');
  const frameCanvas = document.createElement('canvas');
  const behindCtx = behindCanvas.getContext('2d');
  const frontCtx = frontCanvas.getContext('2d');
  const baseCtx = baseCanvas.getContext('2d');
  const topCtx = topCanvas.getContext('2d');
  const frameCtx = frameCanvas.getContext('2d');
  /** 画面へ出す前に完成させる作業用。view は各フレームここを指す */
  let view: Ctx = ctx;
  let liveDirty = true;
  /** このフレームの浮島の上下動（px）。焼いた街と同じだけずらして描く */
  let frameBob = 0;

  /**
   * 動くもの（車・信号・リニア・回る部品）を、手前にあるものに隠される部分を除いて描く。
   *
   * 以前は動くものを描いた上から、手前の建物を矩形で切り抜いて描き直していた。
   * 建物は焼いた街にすでに描かれているので二度塗りになり、半透明の窓や縁の
   * アンチエイリアスが矩形の中だけ濃くなって、細い枠が車と一緒に動いて見えた。
   * いまは作業用の層に動くものだけを描き、手前のものの形で消してから重ねる。二度塗りは起きない。
   *
   * at（描いたものの足元の位置）を渡すと、建物との前後を底面の辺で正しく判定する。
   */
  function drawOccluded(
    depth: number,
    box: { x0: number; y0: number; x1: number; y1: number },
    at: { readonly x: number; readonly z: number } | undefined,
    /** 消さないもの（リニアの車両に対する高架の桁など） */
    skip: ((item: Item) => boolean) | undefined,
    draw: (target: Ctx) => void,
  ): void {
    const mctx = moverCtx;
    if (!mctx) {
      draw(view);
      return;
    }

    // 浮上光や影は足元の箱より少し広がるので、余白を取った範囲で扱う
    const margin = camera.span * 0.08 + 4;
    const region = {
      x0: box.x0 - margin,
      y0: box.y0 - margin,
      x1: box.x1 + margin,
      y1: box.y1 + margin,
    };
    const px0 = clamp(Math.floor(region.x0 * dpr), 0, moverCanvas.width);
    const py0 = clamp(Math.floor((region.y0 + frameBob) * dpr), 0, moverCanvas.height);
    const px1 = clamp(Math.ceil(region.x1 * dpr), 0, moverCanvas.width);
    const py1 = clamp(Math.ceil((region.y1 + frameBob) * dpr), 0, moverCanvas.height);
    if (px1 <= px0 || py1 <= py0) return;

    const gx = depthOf(camera, 1, 0) - depthOf(camera, 0, 0);
    const gz = depthOf(camera, 0, 1) - depthOf(camera, 0, 0);
    const front = occluders.filter(
      (candidate) =>
        candidate.x0 < region.x1 &&
        candidate.x1 > region.x0 &&
        candidate.y0 < region.y1 &&
        candidate.y1 > region.y0 &&
        !skip?.(candidate.item) &&
        hides(candidate, depth, at, gx, gz),
    );
    if (front.length === 0) {
      draw(view);
      return;
    }

    mctx.setTransform(1, 0, 0, 1, 0, 0);
    mctx.globalCompositeOperation = 'source-over';
    mctx.globalAlpha = 1;
    mctx.clearRect(px0, py0, px1 - px0, py1 - py0);

    mctx.save();
    mctx.setTransform(dpr, 0, 0, dpr, 0, frameBob * dpr);
    mctx.beginPath();
    mctx.rect(region.x0, region.y0, region.x1 - region.x0, region.y1 - region.y0);
    mctx.clip();
    draw(mctx);

    mctx.setTransform(1, 0, 0, 1, 0, 0);
    mctx.globalCompositeOperation = 'destination-out';
    for (const occluder of front) {
      const mask = maskOf(occluder);
      mctx.drawImage(mask.canvas, mask.sx * dpr, (mask.sy + frameBob) * dpr);
    }
    mctx.restore();
    mctx.globalCompositeOperation = 'source-over';

    view.save();
    view.setTransform(1, 0, 0, 1, 0, 0);
    view.globalAlpha = 1;
    view.drawImage(moverCanvas, px0, py0, px1 - px0, py1 - py0, px0, py0, px1 - px0, py1 - py0);
    view.restore();
  }

  /* ---------------- 静止部分 ---------------- */

  /**
   * 焼き込み用の canvas を、大きさが変わるときだけ作り直す。
   * width / height への代入は同じ値でも中身と GPU 側の資源を捨てて作り直すため、
   * 回転・拡大の操作中に毎フレーム代入すると描画が詰まる（ソフトウェア描画の環境では数秒単位）。
   */
  function fitLayer(layer: HTMLCanvasElement, w: number, h: number): void {
    const cw = Math.max(1, Math.round(w));
    const ch = Math.max(1, Math.round(h));
    if (layer.width !== cw) layer.width = cw;
    if (layer.height !== ch) layer.height = ch;
  }

  function paintStatic(scale: number): void {
    fitLayer(staticCanvas, width * scale, height * scale);
    const sctx = staticCanvas.getContext('2d');
    if (!sctx) return;
    // 作り直さないので、状態と中身は自分で初期化する
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.globalAlpha = 1;
    sctx.globalCompositeOperation = 'source-over';
    sctx.clearRect(0, 0, staticCanvas.width, staticCanvas.height);
    sctx.setTransform(scale, 0, 0, scale, 0, 0);

    // --- 浮島の底（土と岩）→ 台座の板（芝の縁つき）→ 垂れる蔦 ---
    scenery.paintIslandUnderside(sctx, camera);
    drawExtrudedPolygon(sctx, camera, chamferedSquare(layout.platform.half, layout.platform.corner), {
      y: 0,
      thickness: layout.platform.thickness,
      topColor: palette.platformTop,
      sideColor: palette.platformEdge,
      underColor: palette.platformUnder,
      lipColor: mix(palette.platformTop, '#ffffff', 0.45),
      lipRatio: 0.12,
    });

    // --- 地面（水面・広場・芝生・道路・橋） ---
    const roadColor = shade(palette.road, -0.06);
    const curbColor = mix(palette.platformTop, palette.road, 0.2);

    for (const surface of layout.surfaces) {
      if (surface.kind === 'water' || surface.bridge) {
        drawSurface(sctx, camera, {
          x: surface.x,
          z: surface.z,
          width: surface.width,
          depth: surface.depth,
          y: 0.001,
          color: palette.water,
        });
        // 水際の明るい縁
        drawSurface(sctx, camera, {
          x: surface.x,
          z: surface.z,
          width: surface.width * 0.96,
          depth: surface.depth * 0.96,
          y: 0.0012,
          color: shade(palette.water, 0.12),
          alpha: 0.35,
        });
      } else if (surface.kind === 'plaza') {
        drawSurface(sctx, camera, {
          x: surface.x,
          z: surface.z,
          width: surface.width,
          depth: surface.depth,
          y: 0.001,
          color: mix(palette.platformTop, palette.road, 0.3),
          alpha: 0.85,
        });
      }
    }

    for (const lawn of layout.lawns) drawLawn(sctx, camera, lawn, palette);

    for (const surface of layout.surfaces) {
      if (surface.kind !== 'road') continue;
      if (surface.bridge) {
        drawBridge(sctx, camera, surface, palette);
        continue;
      }
      drawSurface(sctx, camera, {
        x: surface.x,
        z: surface.z,
        width: surface.width * 0.98,
        depth: surface.depth * 0.98,
        y: 0.0015,
        color: curbColor,
        alpha: 0.6,
      });
      drawSurface(sctx, camera, {
        x: surface.x,
        z: surface.z,
        width: surface.width * 0.88,
        depth: surface.depth * 0.88,
        y: 0.002,
        color: roadColor,
      });

      if (surface.orientation === 'cross') {
        for (const [dx, dz] of [
          [0.36, 0],
          [-0.36, 0],
          [0, 0.36],
          [0, -0.36],
        ] as const) {
          for (let i = -2; i <= 2; i += 1) {
            const along = i * surface.width * 0.13;
            drawSurface(sctx, camera, {
              x: surface.x + dx * surface.width + (dz !== 0 ? along : 0),
              z: surface.z + dz * surface.depth + (dx !== 0 ? along : 0),
              width: dx !== 0 ? surface.width * 0.1 : surface.width * 0.07,
              depth: dx !== 0 ? surface.depth * 0.07 : surface.depth * 0.1,
              y: 0.0025,
              color: palette.glow,
              alpha: 0.6,
            });
          }
        }
      } else {
        const ns = surface.orientation === 'ns';
        for (let i = -1; i <= 1; i += 1) {
          const along = i * surface.width * 0.3;
          drawSurface(sctx, camera, {
            x: surface.x + (ns ? 0 : along),
            z: surface.z + (ns ? along : 0),
            width: ns ? surface.width * 0.03 : surface.width * 0.18,
            depth: ns ? surface.depth * 0.18 : surface.depth * 0.03,
            y: 0.0025,
            // 走行帯は光の線として引く（2127 年の誘導路）
            color: palette.glow,
            alpha: 0.55,
          });
        }
      }
    }

    // --- 光の導管（中枢塔から放射状に、地面へ埋め込まれた光の線） ---
    if (layout.conduits.length > 0) {
      const glow = glowColor(palette);
      sctx.lineCap = 'round';
      for (const conduit of layout.conduits) {
        const a = toScreen(camera, conduit.x0, 0.003, conduit.z0);
        const b = toScreen(camera, conduit.x1, 0.003, conduit.z1);
        sctx.globalAlpha = 0.35;
        sctx.strokeStyle = glow;
        sctx.lineWidth = Math.max(2, camera.span * 0.012);
        sctx.beginPath();
        sctx.moveTo(a.x, a.y);
        sctx.lineTo(b.x, b.y);
        sctx.stroke();
        sctx.globalAlpha = 0.9;
        sctx.strokeStyle = '#ffffff';
        sctx.lineWidth = Math.max(1, camera.span * 0.0025);
        sctx.beginPath();
        sctx.moveTo(a.x, a.y);
        sctx.lineTo(b.x, b.y);
        sctx.stroke();
      }
      sctx.globalAlpha = 1;
    }

    // --- 接地影（やわらかいアンビエントオクルージョンだけ。硬い影は作らない） ---
    for (const block of layout.blocks) {
      drawContactShadow(sctx, camera, block.x, block.z, Math.max(block.width, block.depth) * 0.95, palette.shadow, 0.26);
    }
    for (const landmark of layout.landmarks) {
      drawContactShadow(sctx, camera, landmark.x, landmark.z, landmark.footprint * 0.56, palette.shadow, 0.28);
    }
    for (const tree of layout.trees) {
      drawContactShadow(sctx, camera, tree.x, tree.z, tree.size * 1.6, palette.shadow, 0.18);
    }

    // --- 街（回転後の奥行き順） ---
    // 中心だけで比べると、大きい建物の角が手前の小さい建物より後に描かれ、
    // 半透明の窓から後ろが抜けて「透けた」ように見える。
    const footprintDepth = (x: number, z: number, hx: number, hz: number): number => {
      let min = Infinity;
      for (const dx of [-hx, hx] as const) {
        for (const dz of [-hz, hz] as const) {
          const depth = depthOf(camera, x + dx, z + dz);
          if (depth < min) min = depth;
        }
      }
      return min;
    };
    const items: Item[] = [
      ...layout.blocks.map((value) => ({
        kind: 'block' as const,
        depth: footprintDepth(value.x, value.z, value.width / 2, value.depth / 2),
        value,
      })),
      ...layout.trees.map((value) => ({
        kind: 'tree' as const,
        depth: footprintDepth(value.x, value.z, value.size, value.size),
        value,
      })),
      ...layout.props.map((value) => ({ kind: 'prop' as const, depth: depthOf(camera, value.x, value.z), value })),
      ...layout.landmarks.map((value) => ({
        kind: 'landmark' as const,
        depth: footprintDepth(value.x, value.z, value.footprint * 0.55, value.footprint * 0.55),
        value,
      })),
      ...layout.wall.map((seg) => {
        const value = { ...seg, x: (seg.x0 + seg.x1) / 2, z: (seg.z0 + seg.z1) / 2 };
        return { kind: 'wall' as const, depth: depthOf(camera, value.x, value.z), value };
      }),
      ...layout.skybridges.map((bridge) => {
        const value = { ...bridge, x: (bridge.x0 + bridge.x1) / 2, z: (bridge.z0 + bridge.z1) / 2 };
        return { kind: 'skybridge' as const, depth: depthOf(camera, value.x, value.z), value };
      }),
      ...(layout.maglev?.segments ?? []).map((value) => ({
        kind: 'guideway' as const,
        depth: depthOf(camera, value.x, value.z) + 0.001,
        value,
      })),
      // 信号は焼かずに毎フレーム描く（建物との前後を底面の辺で判定するため。renderFrame 参照）
    ].sort((a, b) => a.depth - b.depth);

    for (const item of items) paintItem(sctx, item);
    occluders = items.map(occluderOf);
  }

  /* ---------------- 交通の状態 ---------------- */

  const cars: CarState[] = layout.traffic.vehicles.map((vehicle) => ({
    vehicle,
    road: layout.traffic.roads[vehicle.road]!,
    s: vehicle.start,
    speed: vehicle.speed,
  }));

  function stepTraffic(dt: number, t: number): void {
    const junction = layout.traffic.intersection;
    for (const car of cars) {
      const { vehicle, road } = car;
      const dir = vehicle.direction;
      const length = vehicleLength(vehicle);
      let target = vehicle.speed;

      // 信号: 交差点手前の停止線で止まる（すでに停止線を越えていれば進み切る）
      if (junction) {
        const center = road.axis === 'z' ? junction.z : junction.x;
        const stopLine = center - dir * (cell * 0.52 + length / 2);
        const toStop = (stopLine - car.s) * dir;
        const state = signalState(road.axis, t);
        if (state !== 'go' && toStop > -0.002 && toStop < 0.16) {
          target = Math.min(target, Math.max(0, toStop) * 2.2);
        }
      }

      // 前の車に詰めすぎない
      for (const other of cars) {
        if (other === car || other.road !== road || other.vehicle.direction !== dir) continue;
        const gap = (other.s - car.s) * dir;
        if (gap <= 0) continue;
        const minGap = (length + vehicleLength(other.vehicle)) / 2 + 0.03;
        if (gap < minGap + 0.1) target = Math.min(target, Math.max(0, (gap - minGap) * 1.8));
      }

      car.speed += (target - car.speed) * Math.min(1, dt * 3.2);
      car.s += car.speed * dir * dt;

      // 台座の外へ出たら、反対側の入口が空いてから入り直す
      if (car.s * dir > EDGE) {
        const spawn = -dir * EDGE;
        const blocked = cars.some(
          (other) =>
            other !== car &&
            other.road === road &&
            other.vehicle.direction === dir &&
            Math.abs(other.s - spawn) < 0.2,
        );
        if (!blocked) {
          car.s = spawn;
          car.speed = vehicle.speed;
        } else {
          car.s = dir * EDGE;
          car.speed = 0;
        }
      }
    }
  }

  /* ---------------- 毎フレーム ---------------- */

  let elapsed = 0;
  let frameId = 0;
  let paused = false;
  let lastTime = 0;
  let staticDirty = true;
  let backdropDirty = true;
  let overlayDirty = true;
  let interacting = false;
  let refineTimer = 0;
  let bakedRotation = Number.NaN;

  const cloudRng = createRng(`cloudphase:${config.id}`);
  const cloudDrift = layout.clouds.map(() => cloudRng.range(0, Math.PI * 2));
  const cloudShadow = mix(palette.cloud, config.background, 0.4);

  const bakeScale = (): number => dpr;

  function ensureLayers(): void {
    if (backdropDirty || bakedRotation !== camera.rot) {
      const scale = bakeScale();
      fitLayer(backdropCanvas, width * scale, height * scale);
      const bctx = backdropCanvas.getContext('2d');
      if (bctx) {
        // 空は不透明な塗りで全面を覆うので、消さずに上から描き直す
        bctx.globalAlpha = 1;
        bctx.setTransform(scale, 0, 0, scale, 0, 0);
        scenery.paintBackdrop(bctx, width, height, camera);
      }
      bakedRotation = camera.rot;
      backdropDirty = false;
    }
    if (staticDirty) {
      paintStatic(bakeScale());
      staticDirty = false;
    }
    if (overlayDirty) {
      overlayCanvas.width = Math.max(1, Math.round(width * dpr));
      overlayCanvas.height = Math.max(1, Math.round(height * dpr));
      const octx = overlayCanvas.getContext('2d');
      if (octx) {
        octx.setTransform(dpr, 0, 0, dpr, 0, 0);
        scenery.paintOverlay(octx, width, height);
      }
      overlayDirty = false;
    }
  }

  function drawClouds(target: Ctx, front: boolean, bob: number): void {
    layout.clouds.forEach((cloud, index) => {
      const isFront = depthOf(camera, cloud.x, cloud.z) >= 0;
      if (isFront !== front) return;
      // 奥と手前で置き場所を変えない（切り替わる瞬間に雲が跳ばないように）
      const sway = Math.sin(cloudDrift[index]!) * camera.span * 0.04;
      const point = toScreen(camera, cloud.x * 1.2, cloud.y, cloud.z * 1.2);
      // 寄って見ているときは、手前の雲が通りを覆わないよう薄くする
      const alpha = front ? 0.9 * clamp((2 - zoom) / 0.9, 0.18, 1) : 0.9;
      drawCloud(
        target,
        { x: point.x + sway, y: point.y + bob * 0.5 },
        cloud.size * camera.span * 0.9,
        palette.cloud,
        alpha,
        cloudShadow,
      );
    });
  }

  function composeBase(): void {
    if (!baseCtx) return;
    fitLayer(baseCanvas, width * dpr, height * dpr);
    baseCtx.setTransform(1, 0, 0, 1, 0, 0);
    baseCtx.globalAlpha = 1;
    baseCtx.globalCompositeOperation = 'source-over';
    baseCtx.imageSmoothingEnabled = false;
    if (backdropCanvas.width > 0) baseCtx.drawImage(backdropCanvas, 0, 0, baseCanvas.width, baseCanvas.height);
    if (behindCanvas.width > 0) baseCtx.drawImage(behindCanvas, 0, 0, baseCanvas.width, baseCanvas.height);
    if (staticCanvas.width > 0) baseCtx.drawImage(staticCanvas, 0, 0, baseCanvas.width, baseCanvas.height);
  }

  function refreshLiveLayers(bob: number): void {
    if (!behindCtx || !frontCtx) return;
    fitLayer(behindCanvas, width * dpr, height * dpr);
    fitLayer(frontCanvas, width * dpr, height * dpr);
    behindCtx.setTransform(1, 0, 0, 1, 0, 0);
    behindCtx.clearRect(0, 0, behindCanvas.width, behindCanvas.height);
    behindCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scenery.paintBehind(behindCtx, width, height, camera, 0);
    drawClouds(behindCtx, false, bob);
    frontCtx.setTransform(1, 0, 0, 1, 0, 0);
    frontCtx.clearRect(0, 0, frontCanvas.width, frontCanvas.height);
    frontCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawClouds(frontCtx, true, bob);
    scenery.paintFront(frontCtx, width, height, camera, 0);
    composeBase();
    composeTop();
  }

  function composeTop(): void {
    if (!topCtx) return;
    fitLayer(topCanvas, width * dpr, height * dpr);
    topCtx.setTransform(1, 0, 0, 1, 0, 0);
    topCtx.globalAlpha = 1;
    topCtx.globalCompositeOperation = 'source-over';
    topCtx.clearRect(0, 0, topCanvas.width, topCanvas.height);
    if (frontCanvas.width > 0) topCtx.drawImage(frontCanvas, 0, 0, topCanvas.width, topCanvas.height);
    if (overlayCanvas.width > 0) topCtx.drawImage(overlayCanvas, 0, 0, topCanvas.width, topCanvas.height);
  }

  function renderFrame(): void {
    const rebuilt = staticDirty || backdropDirty;
    ensureLayers();

    const bob = 0;
    frameBob = 0;
    if (rebuilt || liveDirty || baseCanvas.width < 2) {
      refreshLiveLayers(bob);
      liveDirty = false;
    }

    const scene = frameCtx ?? ctx;
    view = scene;
    if (scene !== ctx) {
      fitLayer(frameCanvas, width * dpr, height * dpr);
      scene.setTransform(1, 0, 0, 1, 0, 0);
      scene.globalAlpha = 1;
      scene.globalCompositeOperation = 'source-over';
    }
    scene.imageSmoothingEnabled = false;

    // --- 空・遠景・焼いた街を一枚にまとめた土台 ---
    scene.setTransform(1, 0, 0, 1, 0, 0);
    if (baseCanvas.width > 0) scene.drawImage(baseCanvas, 0, 0, width * dpr, height * dpr);
    scene.setTransform(dpr, 0, 0, dpr, 0, bob * dpr);
    scene.imageSmoothingEnabled = true;

    // 水面のきらめき
    {
      for (const surface of layout.surfaces) {
        if (surface.kind !== 'water' && !surface.bridge) continue;
        for (let k = 0; k < 2; k += 1) {
          const t = Math.sin(elapsed * 0.8 + surface.x * 7 + surface.z * 5 + k * 2.1);
          drawSurface(scene, camera, {
            x: surface.x + t * surface.width * 0.18,
            z: surface.z + (k - 0.5) * surface.depth * 0.4,
            width: surface.width * 0.3,
            depth: surface.depth * 0.035,
            y: 0.0014,
            color: '#ffffff',
            alpha: 0.28 + 0.2 * t,
          });
        }
      }
    }

    // 回る部品（手前の建物・自分の塔より奥にあれば、それらを描き直して隠す）
    for (const landmark of layout.landmarks) {
      const seconds = landmarkSpinSeconds(landmark.kind);
      if (seconds === null) continue;
      const hub = spinnerHub(landmark);
      const center = toScreen(camera, hub.x, hub.y, hub.z);
      const reach = hub.reach * camera.span;
      drawOccluded(
        depthOf(camera, hub.x, hub.z),
        { x0: center.x - reach, y0: center.y - reach, x1: center.x + reach, y1: center.y + reach },
        undefined,
        undefined,
        (target) =>
          drawLandmarkSpinner(target, camera, landmark, palette, (elapsed / seconds) * Math.PI * 2, true),
      );
    }

    // 信号と車（奥から順に。焼いた街の上に描くので、手前にある建物は重なった範囲だけ描き直す）
    type Mover =
      | { kind: 'signal'; depth: number; x: number; z: number; signal: DioramaSignal }
      | { kind: 'car'; depth: number; x: number; z: number; car: CarState }
      | { kind: 'train'; depth: number; x: number; z: number; head: boolean; fade: number }
      | {
          kind: 'walker';
          depth: number;
          x: number;
          z: number;
          walk: number;
          alongX: boolean;
          direction: 1 | -1;
          size: number;
          fade: number;
        };

    const walkers: Mover[] = layout.figures.map((figure) => {
      const traveled = figure.start + elapsed * figure.speed * figure.direction;
      const loop = EDGE * 2;
      let s = ((traveled + EDGE) % loop + loop) % loop - EDGE;
      const x = figure.axis === 'x' ? s : figure.at;
      const z = figure.axis === 'z' ? s : figure.at;
      const walk = ((elapsed * figure.speed * figure.stride) % 1 + 1) % 1;
      return {
        kind: 'walker' as const,
        depth: depthOf(camera, x, z),
        x,
        z,
        walk,
        alongX: figure.axis === 'x',
        direction: figure.direction,
        size: figure.size,
        fade: clamp((EDGE - Math.abs(s)) / FADE, 0, 1),
      };
    });

    // 高架軌道のリニア（台座の端で出入りする）
    const maglev = layout.maglev;
    const trainCars: Mover[] = [];
    if (maglev) {
      const lead = ((elapsed * maglev.speed) % 3.2) - 1.6;
      for (let i = 0; i < maglev.cars; i += 1) {
        const s = lead - i * 0.092;
        const x = maglev.axis === 'z' ? maglev.at : s;
        const z = maglev.axis === 'z' ? s : maglev.at;
        trainCars.push({
          kind: 'train',
          depth: depthOf(camera, x, z),
          x,
          z,
          head: i === 0,
          fade: clamp((EDGE - Math.abs(s)) / FADE, 0, 1),
        });
      }
    }
    const movers: Mover[] = [
      ...layout.traffic.signals.map((signal) => ({
        kind: 'signal' as const,
        depth: depthOf(camera, signal.x, signal.z),
        x: signal.x,
        z: signal.z,
        signal,
      })),
      ...cars.map((car) => {
        const at = lanePosition(car.road, car.vehicle.direction, car.s);
        return { kind: 'car' as const, depth: depthOf(camera, at.x, at.z), x: at.x, z: at.z, car };
      }),
      ...trainCars,
      ...walkers,
    ].sort((a, b) => a.depth - b.depth);

    for (const mover of movers) {
      if (mover.kind === 'signal') {
        const { x, z, signal } = mover;
        drawOccluded(mover.depth, screenBox(x, z, 0.03, 0.16), mover, undefined, (target) => {
          drawSignalPost(target, camera, x, z, palette);
          drawSignalLamp(target, camera, x, z, signalState(signal.axis, elapsed), palette);
        });
        continue;
      }
      if (mover.kind === 'walker') {
        const { x, z, walk, alongX, direction, size, fade } = mover;
        if (fade <= 0) continue;
        drawOccluded(mover.depth, screenBox(x, z, 0.04, 0.1), mover, undefined, (target) => {
          withOpacity(fade, () =>
            drawFigure(target, camera, x, z, palette, { walk, alongX, direction, size }),
          );
        });
        continue;
      }
      if (mover.kind === 'train') {
        if (mover.fade <= 0 || !maglev) continue;
        const { x, z, head, fade } = mover;
        drawOccluded(
          mover.depth,
          screenBox(x, z, 0.06, maglev.y + 0.04),
          mover,
          (item) => item.kind === 'guideway',
          (target) =>
            withOpacity(fade, () =>
              drawTrainCar(target, camera, { x, z, y: maglev.y, alongX: maglev.axis === 'x', head, palette }),
            ),
        );
        continue;
      }
      const { car, x, z, depth } = mover;
      const edgeFade = clamp((EDGE - Math.abs(car.s)) / FADE, 0, 1);
      if (edgeFade <= 0) continue;
      const vehicle = car.vehicle;
      drawOccluded(depth, screenBox(x, z, vehicleLength(vehicle) * 0.6, 0.08), mover, undefined, (target) =>
        withOpacity(edgeFade, () =>
          drawVehicle(target, camera, {
            x,
            z,
            alongX: car.road.axis === 'x',
            long: vehicle.kind === 'bus',
            direction: vehicle.direction,
            color:
              vehicle.color === 'accentPrimary'
                ? palette.accentPrimary
                : vehicle.color === 'accentSecondary'
                  ? palette.accentSecondary
                  : palette.buildingLight,
            palette,
            detailed: true,
          }),
        ),
      );
    }

    // 空を行き来する小型機（どの建物よりも高いところを飛ぶので、前後の描き直しは要らない）
    for (const drone of layout.drones) drawDrone(scene, camera, drone, elapsed, palette);

    scene.setTransform(dpr, 0, 0, dpr, 0, 0);

    // --- 手前の雲・近景・きらめき・仕上げの光 ---
    for (const sparkle of layout.sparkles) {
      const twinkle = 0.2 + 0.6 * (0.5 + 0.5 * Math.sin(elapsed * 2 + sparkle.phase * 6.28));
      const point = toScreen(camera, sparkle.x, sparkle.y, sparkle.z);
      drawSparkle(scene, { x: point.x, y: point.y + bob }, sparkle.size * camera.span * 1.4, palette.cloud, twinkle);
    }

    scene.imageSmoothingEnabled = false;
    scene.setTransform(1, 0, 0, 1, 0, 0);
    if (topCanvas.width > 0) scene.drawImage(topCanvas, 0, 0, width * dpr, height * dpr);

    if (scene !== ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(frameCanvas, 0, 0);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const tick = (time: number): void => {
    if (document.hidden || paused) {
      frameId = 0;
      return;
    }
    frameId = requestAnimationFrame(tick);
    const delta = lastTime === 0 ? 0 : Math.min(0.05, (time - lastTime) / 1000);
    lastTime = time;
    elapsed += delta;
    stepTraffic(delta, elapsed);
    renderFrame();
  };

  /** 視点が変わったら焼き直す。拡大では空を焼き直さない（視差は向きだけ）。 */
  function invalidate(nowInteracting: boolean, kind: 'zoom' | 'rotate' | 'all' = 'all'): void {
    camera = cameraNow();
    interacting = nowInteracting;
    window.clearTimeout(refineTimer);
    staticDirty = true;
    liveDirty = true;
    if (kind !== 'zoom') backdropDirty = true;
    if (nowInteracting) {
      refineTimer = window.setTimeout(() => {
        interacting = false;
      }, 160);
    }
  }

  /* ---------------- 操作（回転・拡大） ---------------- */

  const pointers = new Map<number, { x: number; y: number }>();
  let dragging = false;
  let lastX = 0;
  let pinchDistance = 0;

  const onPointerDown = (event: PointerEvent): void => {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    canvas.setPointerCapture?.(event.pointerId);
    canvas.style.cursor = 'grabbing';
    if (pointers.size === 1) {
      dragging = true;
      lastX = event.clientX;
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDistance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
    }
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      if (pinchDistance > 0) {
        zoom = clamp(zoom * (distance / pinchDistance), MIN_ZOOM, MAX_ZOOM);
        invalidate(true, 'zoom');
      }
      pinchDistance = distance;
      return;
    }

    if (!dragging) return;
    const dx = event.clientX - lastX;
    // 押しただけ（数 px の手ぶれ）では回さない
    if (Math.abs(dx) < 1) return;
    lastX = event.clientX;
    rotation += dx * 0.0075;
    invalidate(true, 'rotate');
  };

  const endPointer = (event: PointerEvent): void => {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinchDistance = 0;
    if (pointers.size === 0) {
      dragging = false;
      canvas.style.cursor = 'grab';
    }
  };

  const onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    zoom = clamp(zoom * Math.exp(-event.deltaY * 0.0012), MIN_ZOOM, MAX_ZOOM);
    invalidate(true, 'zoom');
  };

  canvas.style.touchAction = 'none';
  canvas.style.cursor = 'grab';
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('pointerleave', endPointer);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  function applySize(): void {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    fitLayer(moverCanvas, width * dpr, height * dpr);
    baseSpan = fitSpan();
    overlayDirty = true;
    invalidate(false);
    renderFrame();
  }

  applySize();
  frameId = requestAnimationFrame(tick);

  const onVisibility = (): void => {
    if (document.hidden || paused) {
      cancelAnimationFrame(frameId);
      frameId = 0;
      return;
    }
    if (frameId === 0) {
      lastTime = 0;
      frameId = requestAnimationFrame(tick);
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  return {
    info,

    resize(nextWidth, nextHeight) {
      if (nextWidth < 2 || nextHeight < 2) return;
      if (Math.abs(nextWidth - width) < 1 && Math.abs(nextHeight - height) < 1) return;
      width = nextWidth;
      height = nextHeight;
      dpr = Math.min(1.5, window.devicePixelRatio || 1);
      applySize();
    },

    snapshot() {
      // 保存する 1 枚は必ず高解像度で焼いてから取り出す
      interacting = false;
      staticDirty = true;
      backdropDirty = true;
      renderFrame();
      return canvas.toDataURL('image/jpeg', 0.92);
    },

    setPaused(next) {
      if (next === paused) return;
      paused = next;
      if (paused) {
        cancelAnimationFrame(frameId);
        frameId = 0;
      } else {
        lastTime = 0;
        frameId = requestAnimationFrame(tick);
      }
    },

    resetView() {
      rotation = 0;
      zoom = 1;
      invalidate(false);
      renderFrame();
    },

    setView(nextRotation) {
      rotation = nextRotation;
      invalidate(false);
      renderFrame();
    },

    destroy() {
      cancelAnimationFrame(frameId);
      window.clearTimeout(refineTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', endPointer);
      canvas.removeEventListener('pointercancel', endPointer);
      canvas.removeEventListener('pointerleave', endPointer);
      canvas.removeEventListener('wheel', onWheel);
      for (const layer of [staticCanvas, backdropCanvas, overlayCanvas, moverCanvas, behindCanvas, frontCanvas, baseCanvas, topCanvas, frameCanvas]) {
        layer.width = 0;
        layer.height = 0;
      }
    },
  };
}
