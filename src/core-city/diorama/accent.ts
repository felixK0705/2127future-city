import { mix, shade } from '../color';
import type { ArchetypeId } from '../types';
import type { DioramaPalette } from './types';

/**
 * 都市ごとのアクセント色と、白〜ライトグレー基調のマテリアル。
 *
 * ジオラマは「白い建築可視化」を基準面とし、
 * 彩度のある色は **1 都市 1 色** に絞る。
 * 16 都市は色相環を一周するように割り、縮圖でも隣の都市と見間違えない。
 */
export type AccentFamily =
  | 'red'
  | 'copper'
  | 'gold'
  | 'yellow'
  | 'lime'
  | 'olive'
  | 'emerald'
  | 'moss'
  | 'teal'
  | 'mint'
  | 'cerulean'
  | 'steel'
  | 'azure'
  | 'indigo'
  | 'violet'
  | 'rose';

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
 *
 * 暖色は赤→銅→金→黄、緑は黄緑→オリーブ→深緑→苔、寒色はティール→ミント→シアン→鋼→青→藍、
 * 最後に紫と薔薇。近い性格の街でも色相を隣に置かない。
 */
const ACCENT_BY_ARCHETYPE: Readonly<Record<ArchetypeId, CityAccent>> = {
  // ---- 開いた社会 ----
  /** 黄金渦都ソラリス — 眠らない市場。交易とエネルギーの街 */
  OFEC: accent('gold', '#f07800', '#ffb445'),
  /** 群星港市アステリア — 誰もが橋を架ける港。多様性の街 */
  OFED: accent('rose', '#e81058', '#ff6b90'),
  /** 大樹都ユグドラ — 樹に設計を任せた街 */
  OFGC: accent('emerald', '#008f32', '#2ad45e'),
  /** 千庭連邦ミルガルデン — 千の庭が同じ方向を向く街 */
  OFGD: accent('lime', '#7ad000', '#b0f03a'),
  /** 白光庁都ルクシオン — 入ればすべて見えている街 */
  OSEC: accent('cerulean', '#0088f0', '#4ab8ff'),
  /** 網目市カナリア・メッシュ — 隣の街区が見張る交易網 */
  OSED: accent('yellow', '#e8c200', '#ffe24a'),
  /** 静水都アクアリウム・ノヴァ — 気候を指揮する街 */
  OSGC: accent('teal', '#00b888', '#3ce8c4'),
  /** 蜂巣郷アピス — 誰も書いていない掟の街 */
  OSGD: accent('copper', '#c85810', '#f08a3a'),

  // ---- 閉じた社会 ----
  /** 鉄華城市フェロニカ — 内側を大きくした要塞。製造の街 */
  LFEC: accent('red', '#d41018', '#ff5a48'),
  /** 岩窟自由市グロッタ — 外も中央も信用しない自営の街 */
  LFED: accent('violet', '#7818e8', '#c45aff'),
  /** 霧氷庭園都市フロスト・エデン — 内側にひとつだけ春を作った街 */
  LFGC: accent('mint', '#00e0d0', '#6af5e8'),
  /** 苔生集落連環モスリング — 隣とだけ深く繋がる街 */
  LFGD: accent('moss', '#2a6b38', '#5aaa58'),
  /** 単眼首都モノクル — ひとつの意思が整えた街 */
  LSEC: accent('indigo', '#2418c0', '#6a5aff'),
  /** 区画都市セクター・ナイン — 九区画が競って伸びた街 */
  LSED: accent('azure', '#1a58ff', '#6a94ff'),
  /** 終氷都クリオ・ヴォールト — 変わらないことを完成させた街 */
  LSGC: accent('steel', '#6a90c8', '#a0c0e8'),
  /** 戒律村落都市ノルマリア — 掟を細かく編む街 */
  LSGD: accent('olive', '#b8a000', '#e0d040'),
};

const FALLBACK = accent('teal', '#0aa8a0', '#3eccc4');

/** アーキタイプ ID から、その都市のアクセントを取り出す。 */
export function accentForArchetype(id: ArchetypeId): CityAccent {
  return ACCENT_BY_ARCHETYPE[id] ?? FALLBACK;
}

/**
 * 背景。白に近いライトグレーへ、アクセントの気配だけを混ぜる。
 * 空の演出はしない（スタジオの無限遠ホリゾント）。
 */
export function studioBackground(cityAccent: CityAccent): string {
  return mix('#f7f8fa', cityAccent.primary, 0.035);
}

/**
 * 白い建築可視化のマテリアル。
 *
 * 面積の大半は白。アクセントはガラス幕壁・示意樹・小人・導線だけ。
 */
export function premiumPalette(cityAccent: CityAccent): DioramaPalette {
  const { primary, secondary } = cityAccent;
  return {
    platformTop: '#f7f8fa',
    platformEdge: '#ffffff',
    platformUnder: '#e6e9ee',

    buildingLight: '#ffffff',
    buildingMid: '#eef0f3',
    buildingGlass: mix(primary, '#ffffff', 0.28),
    roof: '#ffffff',

    accentPrimary: primary,
    accentSecondary: secondary,

    foliage: mix(primary, '#ffffff', 0.16),
    foliageDeep: mix(primary, '#ffffff', 0.02),

    road: '#f1f3f5',
    water: mix('#f4f7fa', primary, 0.28),

    shadow: '#c5ccd3',
    cloud: '#ffffff',

    glassDeep: mix(shade(primary, -0.22), '#122033', 0.28),
    panel: mix('#dfe3e8', primary, 0.12),
    glow: mix(primary, '#ffffff', 0.1),
    soil: '#eef1f4',
    rock: '#e8ebef',
    bark: mix('#d5d9de', primary, 0.18),
    alert: shade(primary, -0.22),
  };
}
