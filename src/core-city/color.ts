/**
 * Canvas2D 都市繪製共用的色彩工具。
 */

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export function hexToRgb(hex: string): Rgb {
  const value = hex.replace('#', '');
  const int = Number.parseInt(value, 16);
  return {
    r: (int >> 16) & 0xff,
    g: (int >> 8) & 0xff,
    b: int & 0xff,
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${((clamp(r) << 16) | (clamp(g) << 8) | clamp(b)).toString(16).padStart(6, '0')}`;
}

/** 轉成通用的 0xRRGGBB 數值。 */
export function hexToInt(hex: string): number {
  return Number.parseInt(hex.replace('#', ''), 16);
}

/** amount > 0 で明るく、< 0 で暗く（−1..1）。 */
export function shade(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  if (amount >= 0) {
    return rgbToHex({
      r: r + (255 - r) * amount,
      g: g + (255 - g) * amount,
      b: b + (255 - b) * amount,
    });
  }
  const k = 1 + amount;
  return rgbToHex({ r: r * k, g: g * k, b: b * k });
}

export function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex({
    r: ca.r + (cb.r - ca.r) * t,
    g: ca.g + (cb.g - ca.g) * t,
    b: ca.b + (cb.b - ca.b) * t,
  });
}

export function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** 相対輝度（0..1）。文字色の自動反転などに使う。 */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return (0.2127 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** WCAG 2 のコントラスト比（1..21）。ガンマを外した相対輝度で比べる。 */
export function contrastRatio(a: string, b: string): number {
  const linear = (hex: string): number => {
    const { r, g, b: blue } = hexToRgb(hex);
    const channel = (v: number): number => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2127 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(blue);
  };
  const [hi, lo] = [linear(a), linear(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * 都市の淡いアクセント色を、明るい面の上で文字・塗りボタンに使える濃さまで沈める。
 * 色相は保ったまま、背景とのコントラスト比が min を超える最初の段で止める。
 */
export function inkOf(hex: string, background = '#ffffff', min = 4.6): string {
  for (let step = 0; step <= 20; step += 1) {
    const candidate = shade(hex, -step * 0.04);
    if (contrastRatio(candidate, background) >= min) return candidate;
  }
  return shade(hex, -0.8);
}
