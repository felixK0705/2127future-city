import { mix, rgba, shade } from '../color';
import { createRng } from '../rng';
import {
  depthOf,
  drawCloud,
  drawFrustum,
  fillCircle,
  fillEllipse,
  fillPoly,
  toScreen,
  type Ctx,
  type IsoCamera,
  type Point2,
  type WorldPoint,
} from './canvasPrimitives';
import type { DioramaConfig, DioramaLayout, DioramaMood } from './types';

/**
 * 街のまわりの情景。
 *
 * 雲だけの単色の背景だと、模型が宙に置かれているだけに見える。
 * 空の階調・太陽の光・幾重にも霞む山並み・雲海・遠くの浮島・気球・鳥・光の粒、
 * そして街を載せた浮島の土と岩の底までを描いて、1 枚の絵として成立させる。
 *
 * どれも config.id を種にした決定的な配置なので、同じ街は同じ景色になる。
 * 重い要素（空・山）は向きが変わったときだけ焼き直し、毎フレームは軽い要素だけを描く。
 */

interface SkyTone {
  readonly top: string;
  readonly horizon: string;
  readonly sun: string;
  readonly mountain: string;
  readonly haze: string;
  readonly stars: boolean;
}

function skyTone(background: string, mood: DioramaMood): SkyTone {
  switch (mood) {
    case 'dusk':
      return {
        top: mix(background, '#6c6fb0', 0.4),
        horizon: mix(background, '#ffc7a6', 0.62),
        sun: '#ffe2c4',
        mountain: mix(background, '#7a6f9a', 0.36),
        haze: mix(background, '#ffd9c7', 0.5),
        stars: true,
      };
    case 'cool':
      return {
        top: mix(background, '#8fb3da', 0.34),
        horizon: mix(background, '#f3f8ff', 0.66),
        sun: '#ffffff',
        mountain: mix(background, '#7d93ad', 0.3),
        haze: mix(background, '#ffffff', 0.55),
        stars: false,
      };
    case 'warm':
      return {
        top: mix(background, '#9dbfe0', 0.3),
        horizon: mix(background, '#fff0d8', 0.66),
        sun: '#fff5dc',
        mountain: mix(background, '#9a8f86', 0.28),
        haze: mix(background, '#fff4e4', 0.56),
        stars: false,
      };
    case 'calm':
    case 'daylight':
    default:
      return {
        top: mix(background, '#9cc3ea', 0.34),
        horizon: mix(background, '#fff8ec', 0.64),
        sun: '#fffaf0',
        mountain: mix(background, '#8499ae', 0.28),
        haze: mix(background, '#ffffff', 0.55),
        stars: false,
      };
  }
}

export interface Scenery {
  /** 空・太陽・光の筋・山並み（向きが変わったときだけ呼ぶ） */
  paintBackdrop(ctx: Ctx, width: number, height: number, camera: IsoCamera): void;
  /** 街より奥にある、動く遠景（浮島・気球・鳥・光の粒） */
  paintBehind(ctx: Ctx, width: number, height: number, camera: IsoCamera, elapsed: number): void;
  /** 街より手前にある、動く近景（浮島・気球・雲海） */
  paintFront(ctx: Ctx, width: number, height: number, camera: IsoCamera, elapsed: number): void;
  /** 仕上げの光（太陽のにじみ・周辺減光）。サイズが変わったときだけ焼き直す */
  paintOverlay(ctx: Ctx, width: number, height: number): void;
  /** 街を載せた浮島の、土と岩の底（台座の板より先に描く） */
  paintIslandUnderside(ctx: Ctx, camera: IsoCamera): void;
  /** 台座の縁から垂れる蔦（台座の板より後に描く） */
  paintVines(ctx: Ctx, camera: IsoCamera): void;
}

/**
 * 雲海の下端の色。canvas の下端はこの色で終わるので、
 * canvas の外（都市名カードの下の余白など）を同じ色で塗れば境目が見えない。
 */
export function sceneryFloorColor(config: DioramaConfig): string {
  return mix(skyTone(config.background, config.mood).haze, '#ffffff', 0.5);
}

/** 正方形（半辺 1）の境界までの距離。θ 方向の輪郭を作るのに使う。 */
function squareRadius(theta: number): number {
  return 1 / Math.max(Math.abs(Math.cos(theta)), Math.abs(Math.sin(theta)));
}

/** 浮島の輪。角度が増える順（外向き法線が正しく出る向き）に並べる。 */
function ring(count: number, radiusAt: (theta: number, index: number) => number): WorldPoint[] {
  const points: WorldPoint[] = [];
  for (let i = 0; i < count; i += 1) {
    const theta = (i / count) * Math.PI * 2 + Math.PI / count;
    const r = radiusAt(theta, i);
    points.push({ x: Math.cos(theta) * r, z: Math.sin(theta) * r });
  }
  return points;
}

/**
 * 遠くの浮島。山並みと同じく「画面側」に置き、街を回すと視差で横へ流れる。
 * 世界座標に置くと、寄ったときに巨大化して街に被さり、回すと街の手前を横切ってしまう。
 */
interface Islet {
  /** 横位置（周期の中の割合） */
  readonly u: number;
  /** 縦位置（画面の高さに対する割合） */
  readonly v: number;
  /** 画面の短辺に対する半径 */
  readonly size: number;
  /** 回転に対する流れやすさ（大きいほど近い） */
  readonly parallax: number;
  readonly phase: number;
  readonly tree: boolean;
  readonly falls: boolean;
  /** 上面の輪郭（単位円まわり、縦は潰してある） */
  readonly top: readonly Point2[];
  /** 底の尖りの位置（半径に対する割合） */
  readonly tip: Point2;
}

interface Balloon {
  readonly angle: number;
  readonly radius: number;
  readonly y: number;
  readonly size: number;
  readonly phase: number;
  readonly colorA: string;
  readonly colorB: string;
}

interface Flock {
  readonly y: number;
  readonly speed: number;
  readonly offset: number;
  readonly birds: readonly { dx: number; dy: number; scale: number; phase: number }[];
}

interface Mote {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly speed: number;
  readonly phase: number;
  readonly warm: boolean;
}

export function createScenery(config: DioramaConfig, layout: DioramaLayout): Scenery {
  const palette = config.palette;
  const tone = skyTone(config.background, config.mood);
  const rng = createRng(`scenery:${config.id}`);
  const thickness = layout.platform.thickness;

  /* ---------------- 山並みの形（周期関数なので回転に合わせて横へ流せる） ---------------- */

  const ridges = [0, 1, 2].map((layer) => ({
    layer,
    terms: Array.from({ length: 5 }, (_, k) => ({
      freq: [2, 3, 5, 8, 13][k]!,
      amp: rng.range(0.4, 1) / (k + 1),
      phase: rng.range(0, Math.PI * 2),
    })),
  }));

  /* ---------------- 浮島の底（岩の輪を 4 段） ---------------- */

  const jitter = createRng(`underside:${config.id}`);
  const rim = ring(24, (theta) => squareRadius(theta) * 0.97);
  const soil = ring(24, (theta) => squareRadius(theta) * 0.9 * jitter.range(0.97, 1.02));
  const rockA = ring(24, () => 0.66 * jitter.range(0.86, 1.1));
  const rockB = ring(24, () => 0.34 * jitter.range(0.8, 1.15));
  const tip = ring(24, () => 0.05);

  const vineAnchors = Array.from({ length: 16 }, (_, i) => {
    const theta = (i / 16) * Math.PI * 2 + jitter.range(-0.12, 0.12);
    const r = squareRadius(theta) * 0.985;
    return {
      x: Math.cos(theta) * r,
      z: Math.sin(theta) * r,
      length: jitter.range(0.06, 0.2),
      sway: jitter.range(-0.02, 0.02),
      show: jitter.chance(0.7),
    };
  });

  /* ---------------- 遠景の要素 ---------------- */

  const islets: Islet[] = Array.from({ length: 5 }, (_, i) => {
    const local = createRng(`islet:${config.id}:${i}`);
    const near = rng.next();
    return {
      u: (i + rng.range(0.15, 0.85)) / 5,
      v: rng.range(0.24, 0.5),
      size: 0.02 + near * 0.024,
      parallax: 0.14 + near * 0.14,
      phase: rng.range(0, Math.PI * 2),
      tree: rng.chance(0.65),
      falls: rng.chance(0.4),
      top: Array.from({ length: 10 }, (_, k) => {
        const theta = (k / 10) * Math.PI * 2;
        const r = local.range(0.86, 1.08);
        return { x: Math.cos(theta) * r, y: Math.sin(theta) * r * 0.4 };
      }),
      tip: { x: local.range(-0.25, 0.25), y: local.range(1.25, 1.7) },
    };
  });

  const balloonColors = [palette.accentPrimary, palette.accentSecondary, '#ffffff'];
  // 空を行く飛行船。開いた街は往来が多く、閉じた街には 1 隻しか来ない
  const openness = config.traits?.openness ?? 0;
  const shipCount = openness > 0.2 ? 3 : openness < -0.2 ? 1 : 2;
  const balloons: Balloon[] = Array.from({ length: shipCount }, (_, i) => ({
    angle: rng.range(0, Math.PI * 2) + i * Math.PI,
    radius: rng.range(1.55, 1.95),
    y: rng.range(0.72, 1.05),
    size: rng.range(0.055, 0.075),
    phase: rng.range(0, Math.PI * 2),
    colorA: balloonColors[i % 2]!,
    colorB: balloonColors[2]!,
  }));

  const flocks: Flock[] = Array.from({ length: 2 }, () => ({
    y: rng.range(0.1, 0.32),
    speed: rng.range(10, 18),
    offset: rng.range(0, 1),
    birds: Array.from({ length: rng.int(3, 5) }, (_, k) => ({
      dx: k * rng.range(12, 20),
      dy: (k % 2) * rng.range(5, 9) + rng.range(-3, 3),
      scale: rng.range(0.75, 1.15),
      phase: rng.range(0, Math.PI * 2),
    })),
  }));

  const motes: Mote[] = Array.from({ length: 22 }, () => ({
    x: rng.next(),
    y: rng.next(),
    r: rng.range(1.2, 3.4),
    speed: rng.range(0.004, 0.012),
    phase: rng.range(0, Math.PI * 2),
    warm: rng.chance(0.5),
  }));

  const cloudSea = Array.from({ length: 11 }, (_, i) => ({
    u: (i + rng.range(-0.3, 0.3)) / 10,
    lift: rng.range(-0.02, 0.035),
    size: rng.range(0.07, 0.11),
    speed: rng.range(0.004, 0.009),
    phase: rng.range(0, 1),
  }));

  const stars = Array.from({ length: 46 }, () => ({
    x: rng.next(),
    y: rng.range(0, 0.42),
    r: rng.range(0.5, 1.3),
    a: rng.range(0.35, 0.9),
  }));

  const sunAt = (width: number, height: number): Point2 => ({ x: width * 0.22, y: height * 0.2 });

  /* ---------------- 描画 ---------------- */

  function paintBackdrop(ctx: Ctx, width: number, height: number, camera: IsoCamera): void {
    // 空の階調（上は澄んだ色、地平線へ向かって暖かく明るく）
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, tone.top);
    sky.addColorStop(0.58, mix(tone.top, tone.horizon, 0.7));
    sky.addColorStop(1, tone.horizon);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    if (tone.stars) {
      for (const star of stars) {
        fillCircle(ctx, star.x * width, star.y * height, star.r, '#ffffff', star.a * 0.7);
      }
    }

    // 太陽とそのにじみ
    const sun = sunAt(width, height);
    const reach = Math.max(width, height) * 0.62;
    const glow = ctx.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, reach);
    glow.addColorStop(0, rgba(tone.sun, 0.9));
    glow.addColorStop(0.08, rgba(tone.sun, 0.55));
    glow.addColorStop(0.35, rgba(tone.sun, 0.16));
    glow.addColorStop(1, rgba(tone.sun, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    fillCircle(ctx, sun.x, sun.y, Math.min(width, height) * 0.045, '#ffffff', 0.92);

    // 軌道の環（100 年後の空）: 空の高いところを横切る細い弧
    ctx.save();
    ctx.strokeStyle = rgba('#ffffff', 0.55);
    ctx.lineWidth = Math.max(1, height * 0.0022);
    ctx.beginPath();
    ctx.ellipse(width * 0.56, height * 0.34, width * 0.78, height * 0.2, -0.1, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
    ctx.strokeStyle = rgba('#ffffff', 0.2);
    ctx.lineWidth = Math.max(2, height * 0.007);
    ctx.beginPath();
    ctx.ellipse(width * 0.56, height * 0.34, width * 0.8, height * 0.21, -0.1, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
    ctx.restore();

    // 光の筋（太陽から斜め下へ、ごく薄く）
    for (let i = 0; i < 6; i += 1) {
      const a = 0.35 + i * 0.16;
      const spread = 0.035 + (i % 2) * 0.02;
      const far = Math.hypot(width, height);
      fillPoly(
        ctx,
        [
          sun,
          { x: sun.x + Math.cos(a - spread) * far, y: sun.y + Math.sin(a - spread) * far },
          { x: sun.x + Math.cos(a + spread) * far, y: sun.y + Math.sin(a + spread) * far },
        ],
        '#ffffff',
        0.05,
      );
    }

    // 山並み（奥ほど淡く、霞に溶ける）。街を回すと、奥の山ほどゆっくり流れる
    const bases = [0.6, 0.69, 0.79];
    const amps = [0.085, 0.07, 0.055];
    const colors = [
      mix(tone.mountain, tone.horizon, 0.55),
      mix(tone.mountain, tone.horizon, 0.3),
      mix(mix(tone.mountain, palette.foliage, 0.35), tone.horizon, 0.18),
    ];
    const period = width * 2.2;
    for (const ridge of ridges) {
      const shift = camera.rot * width * (0.12 + ridge.layer * 0.1);
      const baseY = height * bases[ridge.layer]!;
      const amp = height * amps[ridge.layer]!;
      const points: Point2[] = [{ x: -10, y: height + 10 }];
      for (let x = -10; x <= width + 10; x += 10) {
        let h = 0;
        for (const term of ridge.terms) {
          h += term.amp * Math.sin(((x + shift) / period) * Math.PI * 2 * term.freq + term.phase);
        }
        points.push({ x, y: baseY - amp * (0.55 + h * 0.6) });
      }
      points.push({ x: width + 10, y: height + 10 });
      fillPoly(ctx, points, colors[ridge.layer]!);

      // 山裾の霞
      const mist = ctx.createLinearGradient(0, baseY - amp * 0.2, 0, baseY + height * 0.08);
      mist.addColorStop(0, rgba(tone.haze, 0));
      mist.addColorStop(1, rgba(tone.haze, 0.7));
      ctx.fillStyle = mist;
      ctx.fillRect(0, baseY - amp * 0.2, width, height);
    }
  }

  /** 世界座標に置いた遠景を、台座の奥・手前に振り分けて描く。 */
  function worldPoint(camera: IsoCamera, angle: number, radius: number, y: number): {
    point: Point2;
    depth: number;
    x: number;
    z: number;
  } {
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    return { point: toScreen(camera, x, y, z), depth: depthOf(camera, x, z), x, z };
  }

  function paintIslet(
    ctx: Ctx,
    width: number,
    height: number,
    camera: IsoCamera,
    islet: Islet,
    elapsed: number,
  ): void {
    const r = islet.size * Math.min(width, height);
    const period = width * 1.6;
    const raw = islet.u * period + camera.rot * width * islet.parallax;
    const x = (((raw % period) + period) % period) - (period - width) / 2;
    if (x < -r * 2 || x > width + r * 2) return;
    const y = islet.v * height + Math.sin(elapsed * 0.4 + islet.phase) * r * 0.22;

    // 遠いものほど空気に溶ける
    const haze = 0.5 - ((islet.parallax - 0.14) / 0.14) * 0.28;
    const grass = mix(mix(palette.foliage, palette.platformTop, 0.2), tone.haze, haze);
    const rock = mix(mix(palette.platformUnder, '#8f8276', 0.4), tone.haze, haze);
    const outline = islet.top.map((p) => ({ x: x + p.x * r, y: y + p.y * r }));
    const tip = { x: x + islet.tip.x * r, y: y + islet.tip.y * r };
    const left = { x: x - r * 0.98, y };
    const right = { x: x + r * 0.98, y };

    // 岩の底（光の当たる左、影の右、途中の段）
    fillPoly(ctx, [right, left, tip], rock);
    fillPoly(ctx, [{ x: x + r * 0.12, y: y + r * 0.34 }, right, tip], shade(rock, -0.14), 0.9);
    fillPoly(
      ctx,
      [left, { x: x - r * 0.3, y: y + r * 0.42 }, { x: x - r * 0.08, y: y + r * 0.95 }],
      shade(rock, 0.08),
      0.8,
    );
    // 芝の厚み → 上面
    fillPoly(
      ctx,
      outline.map((p) => ({ x: p.x, y: p.y + r * 0.12 })),
      shade(grass, -0.16),
    );
    fillPoly(ctx, outline, grass);

    if (islet.falls) {
      // 縁からこぼれる細い滝（下へ行くほど霧になる）
      const fx = x + r * 0.46;
      const fall = ctx.createLinearGradient(0, y + r * 0.2, 0, y + r * 2.6);
      fall.addColorStop(0, rgba('#ffffff', 0.75));
      fall.addColorStop(1, rgba('#ffffff', 0));
      ctx.fillStyle = fall;
      ctx.fillRect(fx - r * 0.035, y + r * 0.2, r * 0.07, r * 2.4);
      fillEllipse(ctx, fx, y + r * 2.5, r * 0.22, r * 0.08, '#ffffff', 0.25);
    }

    if (islet.tree) {
      const s = r * 0.36;
      const tx = x - r * 0.2;
      ctx.fillStyle = mix(mix(palette.foliageDeep, '#7a5a3c', 0.7), tone.haze, haze);
      ctx.fillRect(tx - s * 0.12, y - s * 1.1, s * 0.24, s * 1.1);
      fillCircle(ctx, tx, y - s * 1.5, s, mix(palette.foliageDeep, tone.haze, haze));
      fillCircle(ctx, tx - s * 0.25, y - s * 1.75, s * 0.55, mix(shade(palette.foliage, 0.12), tone.haze, haze));
    }
  }

  function paintBalloon(ctx: Ctx, camera: IsoCamera, balloon: Balloon, elapsed: number): void {
    const drift = elapsed * 0.02;
    const { point } = worldPoint(
      camera,
      balloon.angle + drift,
      balloon.radius,
      balloon.y + Math.sin(elapsed * 0.3 + balloon.phase) * 0.04,
    );
    const r = balloon.size * camera.span;

    // 飛行船（細長い気嚢・腹の客室・尾翼・光の帯）
    const len = r * 2.3;
    const hgt = r * 0.72;
    fillEllipse(ctx, point.x + r * 0.1, point.y + hgt * 0.25, len * 1.02, hgt * 1.05, '#000000', 0.05);
    fillPoly(
      ctx,
      [
        { x: point.x - len * 0.76, y: point.y },
        { x: point.x - len * 1.12, y: point.y - hgt * 0.95 },
        { x: point.x - len * 0.98, y: point.y },
      ],
      shade(balloon.colorB, -0.12),
    );
    fillPoly(
      ctx,
      [
        { x: point.x - len * 0.76, y: point.y },
        { x: point.x - len * 1.12, y: point.y + hgt * 0.95 },
        { x: point.x - len * 0.98, y: point.y },
      ],
      shade(balloon.colorB, -0.2),
    );
    fillEllipse(ctx, point.x, point.y, len, hgt, balloon.colorB);
    fillEllipse(ctx, point.x, point.y + hgt * 0.28, len * 0.97, hgt * 0.7, shade(balloon.colorB, -0.1), 0.55);
    fillEllipse(ctx, point.x - len * 0.15, point.y - hgt * 0.42, len * 0.6, hgt * 0.26, '#ffffff', 0.6);
    fillEllipse(ctx, point.x, point.y, len * 0.98, hgt * 0.09, balloon.colorA, 0.9);

    ctx.globalAlpha = 1;
    ctx.fillStyle = shade(palette.buildingMid, -0.05);
    ctx.beginPath();
    ctx.roundRect(point.x - len * 0.22, point.y + hgt * 0.84, len * 0.44, hgt * 0.42, hgt * 0.18);
    ctx.fill();
    ctx.fillStyle = mix(palette.buildingGlass, '#1d2a3a', 0.35);
    ctx.fillRect(point.x - len * 0.17, point.y + hgt * 0.96, len * 0.34, hgt * 0.14);
    fillCircle(ctx, point.x + len * 0.96, point.y, Math.max(1.2, r * 0.08), '#ffffff');
  }

  function paintBehind(
    ctx: Ctx,
    width: number,
    height: number,
    camera: IsoCamera,
    elapsed: number,
  ): void {
    // 光の粒（ゆっくり昇る）
    for (const mote of motes) {
      const y = ((mote.y - elapsed * mote.speed) % 1 + 1) % 1;
      const x = mote.x + Math.sin(elapsed * 0.3 + mote.phase) * 0.01;
      fillCircle(
        ctx,
        x * width,
        y * height,
        mote.r,
        mote.warm ? mix(tone.sun, palette.accentSecondary, 0.3) : '#ffffff',
        0.16 + 0.12 * Math.sin(elapsed * 1.2 + mote.phase),
      );
    }

    // 鳥の群れ
    ctx.strokeStyle = rgba(shade(tone.mountain, -0.35), 0.55);
    ctx.lineCap = 'round';
    for (const flock of flocks) {
      const travel = width + 260;
      const base = ((flock.offset * travel + elapsed * flock.speed) % travel) - 130;
      for (const bird of flock.birds) {
        const x = base + bird.dx;
        const y = flock.y * height + bird.dy + Math.sin(elapsed * 0.8 + bird.phase) * 3;
        const wing = Math.sin(elapsed * 7 + bird.phase) * 2.2 * bird.scale;
        const span = 5 * bird.scale;
        ctx.lineWidth = 1.1 * bird.scale;
        ctx.beginPath();
        ctx.moveTo(x - span, y - wing);
        ctx.quadraticCurveTo(x - span * 0.4, y - wing * 0.2 - 1, x, y);
        ctx.quadraticCurveTo(x + span * 0.4, y - wing * 0.2 - 1, x + span, y - wing);
        ctx.stroke();
      }
    }

    for (const islet of islets) paintIslet(ctx, width, height, camera, islet, elapsed);
    for (const balloon of balloons) {
      const { depth } = worldPoint(camera, balloon.angle + elapsed * 0.02, balloon.radius, balloon.y);
      if (depth < 0) paintBalloon(ctx, camera, balloon, elapsed);
    }
  }

  function paintFront(
    ctx: Ctx,
    width: number,
    height: number,
    camera: IsoCamera,
    elapsed: number,
  ): void {
    for (const balloon of balloons) {
      const { depth } = worldPoint(camera, balloon.angle + elapsed * 0.02, balloon.radius, balloon.y);
      if (depth >= 0) paintBalloon(ctx, camera, balloon, elapsed);
    }

    // 雲海（画面の下端。浮島の底がここへ沈んでいくように見せる）
    const shadow = mix(tone.haze, tone.mountain, 0.18);
    for (const puff of cloudSea) {
      const u = (((puff.u + elapsed * puff.speed) % 1.2) + 1.2) % 1.2 - 0.1;
      const size = puff.size * Math.max(width, height);
      drawCloud(
        ctx,
        { x: u * width, y: height * (0.97 - puff.lift) },
        size,
        mix(tone.haze, '#ffffff', 0.6),
        0.9,
        shadow,
      );
    }
  }

  function paintOverlay(ctx: Ctx, width: number, height: number): void {
    ctx.clearRect(0, 0, width, height);
    // 太陽のにじみを街の上にもうっすらかけ、空気に包まれた感じを出す
    const sun = sunAt(width, height);
    const bloom = ctx.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, Math.max(width, height) * 0.7);
    bloom.addColorStop(0, rgba(tone.sun, 0.3));
    bloom.addColorStop(0.45, rgba(tone.sun, 0.08));
    bloom.addColorStop(1, rgba(tone.sun, 0));
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, width, height);
    // 周辺減光（ごく弱く）
    const vignette = ctx.createRadialGradient(
      width / 2,
      height * 0.48,
      Math.min(width, height) * 0.35,
      width / 2,
      height * 0.5,
      Math.max(width, height) * 0.78,
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, rgba(shade(tone.mountain, -0.45), 0.16));
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    // 下端は不透明な一色で終える。周辺減光より後に塗らないと下端が暗くなり、
    // canvas の外（同じ色で塗った余白）との境目に線が出る
    const floorColor = sceneryFloorColor(config);
    const floor = ctx.createLinearGradient(0, height * 0.88, 0, height);
    floor.addColorStop(0, rgba(floorColor, 0));
    floor.addColorStop(1, rgba(floorColor, 1));
    ctx.fillStyle = floor;
    ctx.fillRect(0, height * 0.88, width, height * 0.12 + 1);
  }

  function paintIslandUnderside(ctx: Ctx, camera: IsoCamera): void {
    const earth = mix(palette.platformUnder, '#9b7653', 0.42);
    const rock = mix(palette.platformUnder, '#8b8d97', 0.38);
    const y0 = -thickness;
    drawFrustum(ctx, camera, { top: rim, bottom: soil, yTop: y0, yBottom: y0 - 0.09, color: earth });
    drawFrustum(ctx, camera, { top: soil, bottom: rockA, yTop: y0 - 0.09, yBottom: y0 - 0.34, color: rock });
    drawFrustum(ctx, camera, {
      top: rockA,
      bottom: rockB,
      yTop: y0 - 0.34,
      yBottom: y0 - 0.56,
      color: shade(rock, -0.08),
    });
    drawFrustum(ctx, camera, {
      top: rockB,
      bottom: tip,
      yTop: y0 - 0.56,
      yBottom: y0 - 0.74,
      color: shade(rock, -0.14),
    });
  }

  function paintVines(ctx: Ctx, camera: IsoCamera): void {
    const leaf = palette.foliageDeep;
    for (const vine of vineAnchors) {
      if (!vine.show) continue;
      // 裏側の蔦は浮島の陰に隠れるので描かない
      if (depthOf(camera, vine.x, vine.z) < 0.15) continue;
      const start = toScreen(camera, vine.x, -thickness * 0.3, vine.z);
      const drop = vine.length * camera.span;
      const bend = vine.sway * camera.span;
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = leaf;
      ctx.lineWidth = Math.max(1, camera.span * 0.004);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.quadraticCurveTo(start.x + bend, start.y + drop * 0.5, start.x + bend * 0.4, start.y + drop);
      ctx.stroke();
      ctx.globalAlpha = 1;
      for (let k = 1; k <= 4; k += 1) {
        const t = k / 4.4;
        fillEllipse(
          ctx,
          start.x + bend * t * (1.4 - t),
          start.y + drop * t,
          camera.span * 0.006,
          camera.span * 0.004,
          k % 2 === 0 ? leaf : shade(palette.foliage, 0.1),
        );
      }
    }
  }

  return { paintBackdrop, paintBehind, paintFront, paintOverlay, paintIslandUnderside, paintVines };
}
