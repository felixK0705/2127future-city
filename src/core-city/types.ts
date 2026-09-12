/**
 * 選択によって変化する未来シミュレーター — 共有ドメイン型定義
 *
 * このファイルは version-2d / version-3d の両ビルドから参照される単一の真実源です。
 * 内部識別子（軸コード・アーキタイプID）は UI に露出させてはいけません。
 */

/* ------------------------------------------------------------------ *
 * 軸（Axis）
 * ------------------------------------------------------------------ */

/** 4 つの二値軸。MBTI の 4 軸 / 16 タイプ構造に対応する。 */
export type AxisId = 'openness' | 'governance' | 'growth' | 'power';

/** 各軸の正極コード（スコア + 側）。内部専用。 */
export type PositivePoleCode = 'O' | 'F' | 'E' | 'C';
/** 各軸の負極コード（スコア − 側）。内部専用。 */
export type NegativePoleCode = 'L' | 'S' | 'G' | 'D';
/** 極コード。内部専用 — ユーザーには絶対に見せない。 */
export type PoleCode = PositivePoleCode | NegativePoleCode;

export interface AxisPole {
  /** 内部コード（非公開） */
  readonly code: PoleCode;
  /** 展示内部資料用の日本語ラベル（非公開） */
  readonly label: string;
  /** 説明パネル生成に使う短い言い回し（間接的な表現のみ） */
  readonly phrase: string;
}

export interface AxisDefinition {
  readonly id: AxisId;
  /** 内部資料用の軸名（非公開） */
  readonly label: string;
  /** スコアが正のときに選ばれる極 */
  readonly positive: AxisPole;
  /** スコアが負のときに選ばれる極 */
  readonly negative: AxisPole;
}

/* ------------------------------------------------------------------ *
 * 設問（Questionnaire）
 * ------------------------------------------------------------------ */

/**
 * 選択肢が軸を押す向き。
 *  1 → 正極、-1 → 負極、0 → どちらにも寄らない（重み 1 の設問のみ許容）
 */
export type OptionLean = 1 | 0 | -1;

export interface QuestionOption {
  readonly id: string;
  /** 選択肢の見出し（2026 年の政策・投資判断） */
  readonly label: string;
  /** 選択肢の補足説明（詳細画面用） */
  readonly detail: string;
  /** 一覧に出す短い手がかり（10〜12 文字程度） */
  readonly hint: string;
  readonly lean: OptionLean;
  /**
   * 「なぜこの未来が生まれたのか」パネルで使われる、
   * この選択が 2127 年に及ぼした影響を一文で示す文。
   */
  readonly consequence: string;
}

/**
 * 設問。1 問はちょうど 1 つの軸に対応する。
 *
 * weight = 2 の設問（各軸の主設問）は lean:0 の選択肢を持たないため、
 * 軸スコアが 0 になることは構造的に起こり得ない（同点判定は不要）。
 */
export interface Question {
  readonly id: string;
  readonly axis: AxisId;
  readonly weight: 1 | 2;
  /** 設問の状況設定（2026 年） */
  readonly context: string;
  readonly prompt: string;
  readonly options: readonly QuestionOption[];
}

/** 回答（設問 ID → 選択肢 ID）。 */
export type AnswerMap = Readonly<Record<string, string>>;

/* ------------------------------------------------------------------ *
 * スコアリング結果
 * ------------------------------------------------------------------ */

export type AxisScores = Readonly<Record<AxisId, number>>;

export interface AxisOutcome {
  readonly axis: AxisId;
  /** 符号付きの合計スコア（内部用） */
  readonly score: number;
  /** 選ばれた極 */
  readonly pole: AxisPole;
  /** 0..1 に正規化した傾きの強さ */
  readonly strength: number;
}

/** アーキタイプ ID — 4 文字の極コード列。内部専用。 */
export type ArchetypeId = string;

export interface ScoreResult {
  readonly scores: AxisScores;
  readonly outcomes: readonly AxisOutcome[];
  readonly archetypeId: ArchetypeId;
}

/* ------------------------------------------------------------------ *
 * ビジュアル仕様（16 アーキタイプ共通スキーマ）
 * ------------------------------------------------------------------ */

export interface Palette {
  /** 空の上端 */
  readonly skyTop: string;
  /** 空の中間 */
  readonly skyMid: string;
  /** 空の下端（地平線） */
  readonly skyBottom: string;
  /** 太陽・月・主光源の色 */
  readonly sun: string;
  /** 遠景ビル */
  readonly far: string;
  /** 中景ビル */
  readonly mid: string;
  /** 近景ビル */
  readonly near: string;
  /** 地面 */
  readonly ground: string;
  /** 窓明かり・サイン */
  readonly accent: string;
  /** 発光・ブルーム */
  readonly glow: string;
  /** 大気散乱・フォグ */
  readonly fog: string;
  /** 植生 */
  readonly foliage: string;
}

/** 街並みのシルエット規則。両レンダラが実装する語彙。 */
export type SilhouetteKind =
  | 'spires' // 細く鋭い尖塔群
  | 'terraces' // 段状に緑が乗る階段状
  | 'domes' // 密閉ドームと丸屋根
  | 'megablock' // 巨大単一構造体
  | 'lattice' // 骨組み・トラス状
  | 'mounds' // 低く丸い土塁・半地下
  | 'towers' // 均質な高層タワー
  | 'ziggurat'; // 階段ピラミッド状

export interface SkylineRules {
  readonly silhouette: SilhouetteKind;
  /** 建物の密度 0..1 */
  readonly density: number;
  /** 平均の高さ 0..1 */
  readonly heightBias: number;
  /** 高さのばらつき 0..1（統制的な都市は低い） */
  readonly variance: number;
  /** 配置の規則性 0..1（1 = 完全なグリッド） */
  readonly symmetry: number;
  /** 屋上・壁面の緑化率 0..1 */
  readonly greenery: number;
  /** ネオン／広告サインの量 0..1 */
  readonly signage: number;
  /** 建物の見た目の摩耗・増改築 0..1 */
  readonly patina: number;
  /** 天へ伸びる補助構造（アンテナ・ケーブル）0..1 */
  readonly antennae: number;
}

/** ランドマークの造形種別。両レンダラが同じ語彙を実装する。 */
export type LandmarkKind =
  | 'megatower' // 単独の超高層
  | 'ringArcology' // 空中リング
  | 'worldTree' // 巨大樹・生体構造
  | 'skyBridge' // 都市間を渡す橋
  | 'domeVault' // 巨大ドーム／保管庫
  | 'watchEye' // 監視塔・眼状構造
  | 'greatWall' // 城壁・防壁
  | 'orbitalTether' // 軌道エレベーター
  | 'terraceGarden' // 段状の空中庭園
  | 'stackedMarket' // 積層する市場・住居群
  | 'reactorStack' // 巨大煙突・エネルギー塔
  | 'assemblyRing' // 円形の集会場
  | 'iceSpire' // 氷結の尖塔
  | 'antennaForest'; // 通信塔の森

export interface Landmark {
  readonly id: string;
  /** ランドマークの固有名（ユーザーに見せてよい） */
  readonly name: string;
  readonly kind: LandmarkKind;
  /** 画面横位置 0..1 */
  readonly x: number;
  /** 奥行き 0（最奥）..1（最前） */
  readonly depth: number;
  /** 相対スケール 0.6..1.6 */
  readonly scale: number;
  /** 一文の説明（説明パネルで使用） */
  readonly note: string;
}

export type TimeOfDay = 'dawn' | 'noon' | 'dusk' | 'night' | 'overcast';

export interface LightingSpec {
  readonly timeOfDay: TimeOfDay;
  /** 主光源の強さ 0..1 */
  readonly intensity: number;
  /** 光の方向（画面横位置 0..1） */
  readonly sunX: number;
  /** 光源の高さ 0（地平線）..1（天頂） */
  readonly sunY: number;
  /** フォグの濃さ 0..1 */
  readonly haze: number;
  /** 雰囲気を一言で（説明パネルで使用） */
  readonly mood: string;
}

export type WeatherKind =
  | 'clear'
  | 'rain'
  | 'snow'
  | 'ash'
  | 'fog'
  | 'pollen'
  | 'dust'
  | 'aurora'
  | 'smog'
  | 'mist'
  | 'drones'
  | 'lanterns';

export interface WeatherSpec {
  readonly kind: WeatherKind;
  /** パーティクル量 0..1 */
  readonly density: number;
  /** 風の強さ -1..1（負 = 左へ） */
  readonly wind: number;
  readonly note: string;
}

export interface VisualSpec {
  readonly palette: Palette;
  readonly skyline: SkylineRules;
  readonly landmarks: readonly Landmark[];
  readonly lighting: LightingSpec;
  readonly weather: WeatherSpec;
}

/* ------------------------------------------------------------------ *
 * アーキタイプ
 * ------------------------------------------------------------------ */

/** 軸の傾き → 目に見える都市の特徴、の対応（説明パネル用）。 */
export interface CausalLink {
  /** どの軸に由来するか（内部用） */
  readonly axis: AxisId;
  /** 原因（市民の選択の傾向を、軸名を出さずに述べる） */
  readonly cause: string;
  /** 結果（都市に実際に見えている特徴） */
  readonly effect: string;
}

export interface Archetype {
  /** 内部 ID（4 文字の極コード）。UI には出さない。 */
  readonly id: ArchetypeId;
  /** 固定の都市名 */
  readonly cityName: string;
  /** 都市名の読み／副題 */
  readonly cityReading: string;
  /** 市民証に載る称号 */
  readonly title: string;
  /** キャッチコピー（1 行） */
  readonly tagline: string;
  /** 社会の説明（1 段落） */
  readonly society: string;
  readonly visual: VisualSpec;
  /** 原因 → 結果の対応 3〜5 件 */
  readonly causality: readonly CausalLink[];
  /** 市民証に印字する都市の統計（固定値） */
  readonly stats: readonly { readonly label: string; readonly value: string }[];
}
