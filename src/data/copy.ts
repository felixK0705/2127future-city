export const UI_COPY = {
  intro: {
    title: '2127 未来都市デザイナー',
    lead: '未来は、選択の積み重ねでできている。',
    start: '未来都市を設計する',
    nickname: 'ニックネーム',
  },
  policies: {
    progress: '五つの選択',
    previous: '前の選択へ戻る',
    next: '次の選択へ',
    complete: '都市を完成させる',
  },
  jump: {
    title: '100年後へ',
    skip: '時間移動をスキップ',
  },
  reveal: {
    lead: 'あなたの選択が、この種類の未来をつくりました。',
    owner: (nickname: string) => {
      const name = nickname.trim()
      return name ? `${name} さんの未来都市` : 'あなたの未来都市'
    },
    gained: '得たもの',
    released: '手放したもの',
  },
  why: {
    title: 'なぜ、この都市になったのでしょうか',
    news: '都市通信',
    headline: '見出し',
    dailyLife: 'ある住民の一日',
    analysis: '強みと見えない課題',
    loading: '2127年から通信を受信しています。',
    error: '通信を受信できないため、保存された展示稿を表示します。',
  },
  collective: {
    title: 'みんなが選んだ未来',
    total: '未来を設計した人数',
    sameType: 'あなたと同じ種類の未来',
    empty: '最初の未来を設計してください。',
  },
  souvenir: {
    title: '未来の記念品',
    cityName: '都市の名前',
    defaultCityName: '余白市',
    download: '記念品を保存する',
    share: '未来を共有する',
    shareText: '私が設計した2127年の都市です。',
    issued: '2127年発行',
  },
  reflection: {
    question: 'あなたにとってよい未来は、みんなにとってもよい未来だろうか？',
    restart: 'もう一度設計する',
  },
  accessibility: {
    radar: '五つの都市指標',
    diorama: 'あなたが設計した2127年の都市景観',
  },
} as const

/** ダウンロード画像だけが使う文言。report.ts に直書きすると文字化けしやすい。 */
export const REPORT_COPY = {
  plate: '2127年発行　未来都市来訪記念',
  unnamedCity: '名もなき未来都市',
  visit: '来訪日',
  citizen: '市民番号',
  metrics: 'この都市の五つの指標',
  policies: '選んだ五つの政策',
  unselected: '未選択',
  tradeoff: (strong: string, weak: string) =>
    `${strong}を伸ばす代わりに、${weak}をどう守るかが問われる都市です。`,
  filename: (cityName: string) => `${cityName || '2127未来都市'}-来訪記念.png`,
  missingSnapshot: 'ジオラマ画像が見つかりません。',
  badSnapshot: 'ジオラマ画像を読み込めませんでした。',
  noContext: '記念品画像を作成できませんでした。',
  writeFailed: '記念品画像の書き出しに失敗しました。',
  createFailed: '記念品画像の作成に失敗しました。もう一度お試しください。',
  downloadFailed: '記念品をダウンロードできませんでした。もう一度お試しください。',
} as const

export const METRIC_LABELS = {
  environment: '環境',
  freedom: '自由',
  equity: '公平',
  convenience: '利便性',
  diversity: '文化的多様性',
} as const

/** Material Symbols ligature names, keyed by metric and policy category. */
export const METRIC_ICONS = {
  environment: 'eco',
  freedom: 'flight_takeoff',
  equity: 'balance',
  convenience: 'bolt',
  diversity: 'diversity_3',
} as const

export const CATEGORY_ICONS = {
  energy: 'solar_power',
  transport: 'tram',
  law: 'gavel',
  education: 'school',
  culture: 'theater_comedy',
} as const
