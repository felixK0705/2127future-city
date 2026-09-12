import { mix, shade } from '../color';
import type { ArchetypeId } from '../types';
import type { DioramaPalette } from './types';

/**
 * 都市ごとのアクセント色と、白〜ライトグレー基調のマテリアル。
 *
 * ジオラマは「白い建築可視化」を基準面とし、
 * 彩度のある色は **1 都市 1 系統だけ** に絞る。
 * どの系統を使うかは選択の結果（=アーキタイプ）の性格で決まる:
 *
 *   green     … 環境・持続を選んだ街（緑・農・自給）
 *   turquoise … 環境と管理が組み合わさった街（水・気候制御・保存）
 *   cyan      … 技術・利便・可視化を選んだ街（情報網・監視・高速）
 *   amber     … 産業・交易・エネルギーを選んだ街（市場・製造・巣）
 *   coral     … 文化・多様・個の集まりを選んだ街（港・雑多な自営）
 *
 * 同じ系統の中でも都市ごとに色相と明度をずらすので、16 都市の色は重複しない。
 */
export type AccentFamily = 'green' | 'turquoise' | 'cyan' | 'amber' | 'coral';

export interface CityAccent {
  readonly family: AccentFamily;
  /** 主アクセント。ガラス面・光の線・樹冠に乗る */
  readonly primary: string;
  /** 副アクセント。屋上・小物・窓明かりのワンポイント */
  readonly secondary: string;
}

const accent = (family: AccentFamily, primary: string, secondary: string): CityAccent => ({
  family,
  primary,
  secondary,
});

/**
 * 16 アーキタイプのアクセント。
 * 極コードは openness / governance / growth / power の順（O·L / F·S / E·G / C·D）。
 */
const ACCENT_BY_ARCHETYPE: Readonly<Record<ArchetypeId, CityAccent>> = {
  // ---- 開いた社会 ----
  /** 黄金渦都ソラリス — 眠らない市場。交易とエネルギーの街 */
  OFEC: accent('amber', '#f08c12', '#f4b445'),
  /** 群星港市アステリア — 誰もが橋を架ける港。多様性の街 */
  OFED: accent('coral', '#ee4d4a', '#f47a78'),
  /** 大樹都ユグドラ — 樹に設計を任せた街 */
  OFGC: accent('green', '#12a85a', '#3dcc7a'),
  /** 千庭連邦ミルガルデン — 千の庭が同じ方向を向く街 */
  OFGD: accent('green', '#3cb35a', '#6ad07a'),
  /** 白光庁都ルクシオン — 入ればすべて見えている街 */
  OSEC: accent('cyan', '#0aa0d8', '#3ec8ee'),
  /** 網目市カナリア・メッシュ — 隣の街区が見張る交易網 */
  OSED: accent('amber', '#e8b400', '#f2cc3a'),
  /** 静水都アクアリウム・ノヴァ — 気候を指揮する街 */
  OSGC: accent('turquoise', '#0ab3a6', '#3ad4c6'),
  /** 蜂巣郷アピス — 誰も書いていない掟の街 */
  OSGD: accent('amber', '#d98a10', '#e8b03c'),

  // ---- 閉じた社会 ----
  /** 鉄華城市フェロニカ — 内側を大きくした要塞。製造の街 */
  LFEC: accent('amber', '#e65c18', '#f08a48'),
  /** 岩窟自由市グロッタ — 外も中央も信用しない自営の街 */
  LFED: accent('coral', '#9a4fd4', '#c07aee'),
  /** 霧氷庭園都市フロスト・エデン — 内側にひとつだけ春を作った街 */
  LFGC: accent('turquoise', '#14c0b0', '#4ee0d0'),
  /** 苔生集落連環モスリング — 隣とだけ深く繋がる街 */
  LFGD: accent('green', '#3e9a2e', '#68c04e'),
  /** 単眼首都モノクル — ひとつの意思が整えた街 */
  LSEC: accent('cyan', '#1568c4', '#4a94e4'),
  /** 区画都市セクター・ナイン — 九区画が競って伸びた街 */
  LSED: accent('cyan', '#1a86c8', '#4aafdc'),
  /** 終氷都クリオ・ヴォールト — 変わらないことを完成させた街 */
  LSGC: accent('turquoise', '#0a9cb8', '#3cc4dc'),
  /** 戒律村落都市ノルマリア — 掟を細かく編む街 */
  LSGD: accent('green', '#8aa818', '#b4cc3c'),
};

const FALLBACK = accent('turquoise', '#0aa8a0', '#3eccc4');

/** アーキタイプ ID から、その都市のアクセントを取り出す。 */
export function accentForArchetype(id: ArchetypeId): CityAccent {
  return ACCENT_BY_ARCHETYPE[id] ?? FALLBACK;
}

/**
 * 背景。白に近いライトグレーへ、アクセントの気配だけを混ぜる。
 * 空の演出はしない（スタジオの無限遠ホリゾント）。
 */
export function studioBackground(cityAccent: CityAccent): string {
  return mix('#f4f6f8', cityAccent.primary, 0.018);
}

/**
 * 白い建築可視化のマテリアル。
 *
 * 面積の大半は白。アクセントはガラス幕壁・示意樹・小人・導線だけ。
 */
export function premiumPalette(cityAccent: CityAccent): DioramaPalette {
  const { primary, secondary } = cityAccent;
  return {
    platformTop: mix('#f3f5f7', primary, 0.03),
    platformEdge: '#fbfcfd',
    platformUnder: '#e8ecf0',

    buildingLight: '#fbfcfd',
    buildingMid: '#eef1f4',
    buildingGlass: mix(primary, '#ffffff', 0.22),
    roof: '#ffffff',

    accentPrimary: primary,
    accentSecondary: secondary,

    foliage: mix(primary, '#ffffff', 0.12),
    foliageDeep: shade(primary, -0.08),

    road: '#eef1f4',
    water: mix('#ffffff', primary, 0.28),

    shadow: mix('#b8c0c6', primary, 0.1),
    cloud: '#ffffff',

    glassDeep: mix(shade(primary, -0.28), '#2a3340', 0.22),
    panel: mix(primary, '#3f4a54', 0.55),
    glow: mix(primary, '#ffffff', 0.06),
    soil: '#eef1f4',
    rock: '#e6eaee',
    bark: mix(primary, '#d8dce0', 0.35),
    alert: shade(primary, -0.22),
  };
}
