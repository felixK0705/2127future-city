/**
 * アイソメトリックの投影規則。
 *
 * 2D 版の画面投影と 3D 版のカメラ角度が食い違わないよう、
 * 「2:1 ダイメトリック」という 1 つの定義をここに置いて両方から参照する。
 */

/** 縦横比。1 単位の奥行きは 1 単位の横幅の半分の高さに落ちる（2:1）。 */
export const ISO_VERTICAL_RATIO = 0.5;

/**
 * 3D 版のカメラ方向（正規化前）。
 * (1, tan(θ)·√2, 1) で θ = atan(0.5) = 26.565°。上の 2:1 と同じ傾き。
 */
export const ISO_CAMERA_DIRECTION = Object.freeze({
  x: 1,
  y: Math.SQRT2 * ISO_VERTICAL_RATIO,
  z: 1,
});

/** 画面上の傾き（度）。UI 側で図解を合わせたいときに使う。 */
export const ISO_SCREEN_ANGLE_DEG = (Math.atan(ISO_VERTICAL_RATIO) * 180) / Math.PI;

export interface IsoPoint {
  readonly sx: number;
  readonly sy: number;
}

/**
 * ワールド座標（x, y, z）を画面座標へ落とす。
 *
 * @param span 台座の半辺 1 に対応する画面上の長さ（px）
 */
export function projectIso(x: number, y: number, z: number, span: number): IsoPoint {
  return {
    sx: (x - z) * span * 0.5,
    sy: (x + z) * span * 0.5 * ISO_VERTICAL_RATIO - y * span,
  };
}

/** 描画順（奥→手前）の比較キー。値が小さいほど奥。 */
export function isoDepth(x: number, z: number, y = 0): number {
  return x + z + y * 0.001;
}
