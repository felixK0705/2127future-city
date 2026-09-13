/**
 * アイソメトリック・ジオラマ都市レンダラ — 共有の型定義。
 *
 * Canvas2D 版は、この 1 つの設定オブジェクトだけを外部入力として受け取り、
 * `DioramaLayout` を解釈して画づくりを行う。
 * アートディレクションの逸脱を防ぐため、色・造形の語彙はすべてここで閉じている。
 */

/* ------------------------------------------------------------------ *
 * 入力: 設定
 * ------------------------------------------------------------------ */

/**
 * ジオラマの配色。
 *
 * 基調は白。彩度のある色は都市ごとのアクセント 1 系統だけ。
 * ガラス幕壁・示意樹・小人・全息パネルに乗せ、面積の 2〜3 割まで。
 *
 * 茶色・濃紺・原色の赤緑は使わない。必要な機能色（警告灯・信号）も
 * すべてこの型の中で淡く定義し、描画側にハードコードしない。
 */
export interface DioramaPalette {
  /** 台座の上面 */
  readonly platformTop: string;
  /** 台座の側面（厚みの見える面） */
  readonly platformEdge: string;
  /** 台座の底面・影側 */
  readonly platformUnder: string;
  /** 建物の主色（明るいニュートラル） */
  readonly buildingLight: string;
  /** 建物の副色（ややトーンを落としたニュートラル） */
  readonly buildingMid: string;
  /** ガラス幕壁（アクセントを透かした色） */
  readonly buildingGlass: string;
  /** 屋根 */
  readonly roof: string;
  /** 主アクセント（署名となる建造物に 1〜2 箇所だけ） */
  readonly accentPrimary: string;
  /** 副アクセント（小物・屋根のワンポイント） */
  readonly accentSecondary: string;
  /** 示意樹の葉（アクセント） */
  readonly foliage: string;
  /** 示意樹の葉の陰側 */
  readonly foliageDeep: string;
  /** 道路・舗装 */
  readonly road: string;
  /** 水面（運河・池） */
  readonly water: string;
  /** 接地影（ソフト AO）の色 */
  readonly shadow: string;
  /** 浮遊する雲・粒子 */
  readonly cloud: string;
  /** 奥まったガラス（窓の内側・乗り物の風防）。濃紺の代わりに使う */
  readonly glassDeep: string;
  /** 太陽光パネル・機器のマット面 */
  readonly panel: string;
  /** 発光（光の導管・浮上光・ライトストリップ） */
  readonly glow: string;
  /** 浮島の土（茶色は使わない） */
  readonly soil: string;
  /** 浮島の岩・遠景の岩 */
  readonly rock: string;
  /** 樹の幹・支柱 */
  readonly bark: string;
  /** 機能色（監視灯・停止信号）。淡く、面積を取らない */
  readonly alert: string;
}

/**
 * ムード。
 *
 * **配色と小物の選択にのみ影響し、ライティングの硬さは変えない。**
 * 暗いムードでもコントラストの強い影は作らず、常にソフトなスタジオ照明を保つ。
 */
export type DioramaMood = 'daylight' | 'calm' | 'cool' | 'warm' | 'dusk';

/** 目印になる建造物の造形種別。両レンダラが同じ語彙を実装する。 */
export type DioramaLandmarkKind =
  | 'signalTower' // 紅白の電波塔
  | 'clockTower' // 時計塔
  | 'domeHall' // ドーム屋根の公会堂
  | 'archGate' // 門・アーチ
  | 'skyscraper' // ガラスの高層棟
  | 'windmill' // 風車（羽根が回る）
  | 'ferrisWheel' // 観覧車（回る）
  | 'pagoda' // 層塔・五重塔
  // ---- 2127 年の都市の語彙（archetypeToDiorama はこちらだけを使う） ----
  | 'aiCore' // 都市を束ねる中枢塔（光の輪がめぐる）
  | 'skyTether' // 軌道エレベーター（索が空の上まで伸びる）
  | 'arcology' // ガラスの温室ドーム
  | 'windTurbine' // 3 枚羽根の風力タービン（回る）
  | 'solarTree' // 太陽光パネルの樹（地区ごとの電源）
  | 'vertiport' // 空の港（離着陸パッド）
  | 'watchPylon'; // 監視塔（探照光がめぐる）

/**
 * 市民の選択の傾き。各軸 -1..1。
 *
 *   openness   + 開く（空の港・人の往来）   / − 閉じる（外周の障壁と検問）
 *   governance + 自由（高さも色もまちまち） / − 管理（揃った格子・監視塔・巡回機）
 *   growth     + 拡張（高く密に・空中回廊・高架軌道・軌道索） / − 持続（緑・太陽光・風車・水）
 *   power      + 集中（中央の中枢塔と光の導管） / − 分散（地区ごとの電源と屋上設備）
 *
 * 同じアーキタイプからは常に同じ値が出るので、同じ街になる。
 */
export interface DioramaTraits {
  readonly openness: number;
  readonly governance: number;
  readonly growth: number;
  readonly power: number;
}

/** 目印の配置指定。lot はグリッド座標（0 起点）。 */
export interface DioramaLandmarkConfig {
  readonly id: string;
  readonly kind: DioramaLandmarkKind;
  /** グリッド上の区画 [col, row] */
  readonly lot: readonly [number, number];
  /** 大きさの倍率（0.7〜1.4 程度） */
  readonly scale?: number;
  /** どのアクセント色を使うか（none なら基調色のみ） */
  readonly accent?: 'primary' | 'secondary' | 'none';
}

/** レンダラへの唯一の外部入力。 */
export interface DioramaConfig {
  /** レイアウト生成のシード。同じ id なら常に同じ街になる */
  readonly id: string;
  /** 背景の単色フィールド（地平線や環境は描かない） */
  readonly background: string;
  readonly palette: DioramaPalette;
  readonly mood: DioramaMood;
  readonly landmarks: readonly DioramaLandmarkConfig[];
  /** 建物の充填率 0..1（既定 0.62） */
  readonly density?: number;
  /** 緑の量 0..1（既定 0.5） */
  readonly greenery?: number;
  /** 車・ベンチなどの小物を置くか（既定 true） */
  readonly props?: boolean;
  /** 台座のまわりに浮かぶ雲を出すか（既定 true） */
  readonly clouds?: boolean;
  /** きらめく粒子を出すか（既定 false／使うときも控えめ） */
  readonly sparkles?: boolean;
  /** 動態車流倍率。0 會停用車輛，1 為原始密度。 */
  readonly trafficScale?: number;
  /** 招牌／外牆亮點倍率。 */
  readonly signageScale?: number;
  /** 屋頂形式的變化量 0..1。 */
  readonly roofVariation?: number;
  /** 外觀使用痕跡 0..1；會增加非規整材質與立面差異。 */
  readonly patina?: number;
  /** 建物尺寸、位置與形體的不規則程度 0..1。 */
  readonly irregularity?: number;
  /** 高度變異倍率；1 為原始變異，越低越均等。 */
  readonly heightVariance?: number;
  /** 選択の傾き。省略時はすべて 0（中庸な街） */
  readonly traits?: DioramaTraits;
}

/* ------------------------------------------------------------------ *
 * 出力: レイアウト
 * ------------------------------------------------------------------ */

/**
 * 座標系（両レンダラ共通）
 *
 *   x, z ∈ [-1, 1] … 台座の広がり（1 = 台座の半辺）
 *   y            … 高さ。1.0 = 台座の半辺と同じ長さ
 *
 * 2D 版はこれを 2:1 のダイメトリック投影で画面に落とし、
 * 3D 版は同じ数値をワールド座標へ一様スケールする。
 */
export interface DioramaVec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export type BlockMaterial =
  | 'light'
  | 'mid'
  | 'glass'
  | 'accentPrimary'
  | 'accentSecondary'
  // アクセントを白で薄めたパステル（自由な街の、ばらばらな外壁）
  | 'tintPrimary'
  | 'tintSecondary';
export type BlockRoof = 'flat' | 'pitched' | 'setback' | 'stepped' | 'rounded';
export type BlockWindows = 'grid' | 'bands' | 'none';
/** 建物の形。round = 円筒、cantilever = 上階が片側へ張り出す */
export type BlockForm = 'box' | 'round' | 'cantilever';
/** 屋上に載せるもの */
export type BlockCrown = 'none' | 'garden' | 'solar' | 'turbine' | 'pad' | 'antenna' | 'scanner';

/** 一般の建物（目印以外）。 */
export interface DioramaBlock {
  readonly id: string;
  readonly col: number;
  readonly row: number;
  /** 区画中心 */
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  readonly material: BlockMaterial;
  readonly roof: BlockRoof;
  readonly roofAccent: boolean;
  readonly windows: BlockWindows;
  /** 90 度単位の向き */
  readonly turn: 0 | 1 | 2 | 3;
  /** 屋上のアンテナ・設備 */
  readonly rooftop: boolean;
  /** 形（省略時 box） */
  readonly form?: BlockForm;
  /** 屋上に載せるもの（省略時は rooftop から決める） */
  readonly crown?: BlockCrown;
  /** 壁面緑化（縦の庭） */
  readonly greenWall?: boolean;
}

export type TreeKind = 'round' | 'cone' | 'cloud';

export interface DioramaTree {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  /** 樹冠の大きさ */
  readonly size: number;
  readonly kind: TreeKind;
  /** 0 = 明るい緑 / 1 = 濃い緑 */
  readonly tone: 0 | 1;
}

export type PropKind = 'car' | 'bus' | 'bench' | 'lamp' | 'boat';

/** 歩道を歩く人。位置は毎フレーム、軸に沿って進める。 */
export interface DioramaFigure {
  readonly id: string;
  readonly axis: 'x' | 'z';
  /** 進行軸と直交する座標（歩道の中心線） */
  readonly at: number;
  readonly start: number;
  readonly direction: 1 | -1;
  readonly speed: number;
  /** 歩幅。大きいほど足の振りが速い */
  readonly stride: number;
  readonly size: number;
}

export interface DioramaProp {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly kind: PropKind;
  readonly turn: 0 | 1 | 2 | 3;
  readonly color: 'accentPrimary' | 'accentSecondary' | 'light';
  /** 車が走る軸（アニメーション用）。停止物は undefined */
  readonly axis?: 'x' | 'z';
  /** 走行方向 1 / -1 */
  readonly direction?: 1 | -1;
  /** 進行の位相 0..1 */
  readonly phase?: number;
}

/** 舗装された区画（道路・広場・水面）。 */
export type SurfaceKind = 'road' | 'plaza' | 'water';

export interface DioramaSurface {
  readonly id: string;
  readonly kind: SurfaceKind;
  /** 道路の向き。交差部は cross */
  readonly orientation?: 'ns' | 'ew' | 'cross';
  /** 水面の上を渡る道路（橋として描く） */
  readonly bridge?: boolean;
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly depth: number;
}

/** 公園の芝生。 */
export interface DioramaLawn {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly depth: number;
}

/** 車が走る 1 本の道路（台座の端から端まで通っている）。 */
export interface DioramaRoad {
  readonly id: string;
  /** 走る方向の軸 */
  readonly axis: 'x' | 'z';
  /** 軸と直交する方向の座標（道路の中心線） */
  readonly at: number;
  /** 中心線から車線中央までのずれ */
  readonly lane: number;
}

/** 道路を走る車。位置は道路に沿った座標 s（-1..1）で持つ。 */
export interface DioramaVehicle {
  readonly id: string;
  /** traffic.roads の添字 */
  readonly road: number;
  /** 進行方向（s が増える向きが 1） */
  readonly direction: 1 | -1;
  /** 走り出す位置（s） */
  readonly start: number;
  readonly kind: 'car' | 'bus';
  readonly color: 'accentPrimary' | 'accentSecondary' | 'light';
  /** 巡航速度（ワールド単位 / 秒） */
  readonly speed: number;
}

/** 交差点の信号機。 */
export interface DioramaSignal {
  readonly x: number;
  readonly z: number;
  /** どちらの道路に向けた信号か */
  readonly axis: 'x' | 'z';
}

export interface DioramaTraffic {
  readonly roads: readonly DioramaRoad[];
  readonly vehicles: readonly DioramaVehicle[];
  /** 2 本の道路が交わる点（無ければ null） */
  readonly intersection: { readonly x: number; readonly z: number } | null;
  readonly signals: readonly DioramaSignal[];
}

export interface DioramaCloud {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly size: number;
  /** 漂う速さ */
  readonly speed: number;
  readonly phase: number;
}

export interface DioramaSparkle {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly size: number;
  readonly phase: number;
}

export interface PlacedDioramaLandmark extends DioramaLandmarkConfig {
  readonly x: number;
  readonly z: number;
  /** 設置面の一辺 */
  readonly footprint: number;
  /** 全高 */
  readonly height: number;
}

export interface DioramaPlatform {
  /** 半辺（常に 1） */
  readonly half: number;
  /** 板の厚み */
  readonly thickness: number;
  /** 角の落とし幅（丸みの表現） */
  readonly corner: number;
  /** 区画の一辺 */
  readonly cell: number;
  /** 区画数（1 辺） */
  readonly grid: number;
}

/** 外周の障壁の 1 区間（閉じた街）。gate なら検問の門として描く。 */
export interface DioramaWallSegment {
  readonly id: string;
  readonly x0: number;
  readonly z0: number;
  readonly x1: number;
  readonly z1: number;
  readonly height: number;
  readonly gate: boolean;
}

/** 高い建物どうしを結ぶ空中回廊。 */
export interface DioramaSkybridge {
  readonly id: string;
  readonly x0: number;
  readonly z0: number;
  readonly x1: number;
  readonly z1: number;
  /** 床の高さ */
  readonly y: number;
}

/** 道路の上を走る高架軌道（1 区画ぶんの桁）。 */
export interface DioramaGuideway {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  /** 桁の向き */
  readonly axis: 'x' | 'z';
  readonly length: number;
  readonly y: number;
  /** 橋脚を立てるか（交差点の上には立てない） */
  readonly pier: boolean;
}

export interface DioramaMaglev {
  /** 軌道が沿う道路の軸と位置 */
  readonly axis: 'x' | 'z';
  readonly at: number;
  readonly y: number;
  readonly cars: number;
  readonly speed: number;
  readonly segments: readonly DioramaGuideway[];
}

/** 空を行き来する小型機。patrol = 巡回する監視機、courier = 配送機 */
export interface DioramaDrone {
  readonly id: string;
  readonly kind: 'patrol' | 'courier';
  readonly radius: number;
  readonly y: number;
  /** 周回の角速度（rad/s）。符号で向き */
  readonly speed: number;
  readonly phase: number;
}

/** 地面に埋め込まれた光の導管（中枢塔から放射状に）。 */
export interface DioramaConduit {
  readonly x0: number;
  readonly z0: number;
  readonly x1: number;
  readonly z1: number;
}

export interface DioramaLayout {
  readonly configId: string;
  readonly platform: DioramaPlatform;
  readonly surfaces: readonly DioramaSurface[];
  readonly lawns: readonly DioramaLawn[];
  readonly traffic: DioramaTraffic;
  readonly blocks: readonly DioramaBlock[];
  readonly landmarks: readonly PlacedDioramaLandmark[];
  readonly trees: readonly DioramaTree[];
  readonly figures: readonly DioramaFigure[];
  readonly props: readonly DioramaProp[];
  readonly clouds: readonly DioramaCloud[];
  readonly sparkles: readonly DioramaSparkle[];
  /** 選択の傾き（config.traits を補完したもの） */
  readonly traits: DioramaTraits;
  readonly wall: readonly DioramaWallSegment[];
  readonly skybridges: readonly DioramaSkybridge[];
  readonly maglev: DioramaMaglev | null;
  readonly drones: readonly DioramaDrone[];
  readonly conduits: readonly DioramaConduit[];
}

/* ------------------------------------------------------------------ *
 * 実行時の Canvas2D レンダラ情報
 * ------------------------------------------------------------------ */

export interface RendererInfo {
  readonly library: 'canvas';
  readonly libraryVersion: string;
  /** 実際に確保されたコンテキスト */
  readonly backend: 'canvas2d' | 'unavailable';
  /** Canvas2D 版は常に false。既存の診断 UI との互換用。 */
  readonly isWebGL: boolean;
  /** getContext が返したオブジェクトのコンストラクタ名 */
  readonly contextName: string;
  /** GPU 名（取得できた場合） */
  readonly gpu: string;
  /** QA 用の 1 行サマリ */
  readonly summary: string;
}
