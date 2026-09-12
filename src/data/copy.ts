export const UI_COPY = {
  intro: {
    title: '2127 未来都市デザイナー',
    lead: '未来は、選択の積み重ねでできている。',
    start: '未来都市を設計する',
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
