import type { Archetype } from '../types';

/**
 * 開放性が「開く」側に振れた 8 都市（内部 ID は O で始まる）。
 * すべてビルド時固定。実行時に生成・変更される値は一切含まない。
 */
export const OPEN_SOCIETIES: readonly Archetype[] = [
  /* ================================================================
   * OFEC — 開放 / 自由 / 拡張 / 集中
   * ============================================================== */
  {
    id: 'OFEC',
    cityName: '黄金渦都ソラリス',
    cityReading: 'おうごんかと・ソラリス',
    title: '無限交易の設計者',
    tagline: '眠らない市場が、空へ渦を巻いて伸びていく。',
    society:
      '世界中から人と資本が流れ込み、100年のあいだ一度も成長を止めなかった都市。決定は都市中枢の統合知性が下すが、街路の使い方は誰も管理していない。垂直に積み上がった市場は昼夜の区別を失い、七十以上の言語が同じ階で値段を叫び合う。市民は監視されない自由と、中枢が最適化した豊かさを同時に手にしたが、その繁栄が何を燃やして成り立っているのかを問う声は、祝祭の灯りの中に溶けて消えていく。',
    visual: {
      palette: {
        skyTop: '#102f55',
        skyMid: '#235f89',
        skyBottom: '#8fd7e8',
        sun: '#e9fbff',
        far: '#294f70',
        mid: '#34769a',
        near: '#173f60',
        ground: '#102f46',
        accent: '#73d7f4',
        glow: '#38c4dc',
        fog: '#74aeca',
        foliage: '#4a9b88',
      },
      skyline: {
        silhouette: 'spires',
        density: 0.94,
        heightBias: 0.92,
        variance: 0.74,
        symmetry: 0.42,
        greenery: 0.12,
        signage: 0.96,
        patina: 0.48,
        antennae: 0.82,
      },
      landmarks: [
        {
          id: 'ofec-spire',
          name: '万灯中枢〈ソル・スパイア〉',
          kind: 'megatower',
          x: 0.5,
          depth: 0.45,
          scale: 1.35,
          note: '都市の全取引を毎秒裁定する統合知性の座。頂点の灯は一度も消えたことがない。',
        },
        {
          id: 'ofec-tether',
          name: '天梯・黄金索',
          kind: 'orbitalTether',
          x: 0.79,
          depth: 0.2,
          scale: 1.0,
          note: '軌道上の生産環へ物資を運び上げる索。拡張への投資が最後に到達した高さ。',
        },
        {
          id: 'ofec-market',
          name: '百層市場',
          kind: 'stackedMarket',
          x: 0.2,
          depth: 0.86,
          scale: 1.15,
          note: '誰の許可も得ずに増築され続けた露店の塔。設計図は存在しない。',
        },
      ],
      lighting: {
        timeOfDay: 'night',
        intensity: 0.55,
        sunX: 0.86,
        sunY: 0.08,
        haze: 0.42,
        mood: '沈まない夕陽と、それを塗り潰す無数の看板の光',
      },
      weather: {
        kind: 'lanterns',
        density: 0.85,
        wind: 0.22,
        note: 'どこかの街区が必ず祭りの最中にあり、灯籠が絶えず立ちのぼっている。',
      },
    },
    causality: [
      {
        axis: 'openness',
        cause: '国境と都市を開き続けたこと',
        effect:
          '市場の塔が七十以上の言語の看板で覆われ、街の高さそのものが人の流入量を記録している。',
      },
      {
        axis: 'growth',
        cause: '総量の拡大に投資を振り切ったこと',
        effect: '空に軌道への索が架かり、地平線より高い位置に第二の街の床ができた。',
      },
      {
        axis: 'governance',
        cause: '監視より匿名性を選んだこと',
        effect:
          '百層市場のように、行政の図面に載らない増築が今も夜のうちに一階ずつ育っている。',
      },
      {
        axis: 'power',
        cause: '判断を統合知性に預けたこと',
        effect: 'どの街区からも見える中枢塔がひとつだけ突き抜け、街の視線をそこへ集めている。',
      },
    ],
    stats: [
      { label: '推定人口', value: '4,820万人' },
      { label: '公用語', value: '71言語（併記義務）' },
      { label: '取引の休止時間', value: '年間 0 秒' },
    ],
  },

  /* ================================================================
   * OFED — 開放 / 自由 / 拡張 / 分散
   * ============================================================== */
  {
    id: 'OFED',
    cityName: '群星港市アステリア',
    cityReading: 'ぐんせいこうし・アステリア',
    title: '万人の航路を開く者',
    tagline: '橋は、渡りたい人が架けた分だけ増えていく。',
    society:
      '中心を持たない港の連なりとして育った都市。誰でも入港でき、誰でも街区を興せる。上位の計画機関が存在しないため、交通も電力も回線も「必要になった人同士が繋いだ」痕跡のまま残り、都市全体が一枚の巨大な骨組みになっている。効率は悪く、同じ機能の設備がいくつも重複しているが、どの街区も他のどこかに依存せずに生き延びられる。地図は毎年書き換えられ、完成することがない。',
    visual: {
      palette: {
        skyTop: '#0d2436',
        skyMid: '#2f6b7a',
        skyBottom: '#f0b57a',
        sun: '#ffe6b0',
        far: '#2a4a58',
        mid: '#3d6472',
        near: '#1d3340',
        ground: '#14262f',
        accent: '#67d8e2',
        glow: '#8ce8ef',
        fog: '#6d9aa5',
        foliage: '#6f9e70',
      },
      skyline: {
        silhouette: 'lattice',
        density: 0.86,
        heightBias: 0.66,
        variance: 0.95,
        symmetry: 0.14,
        greenery: 0.3,
        signage: 0.72,
        patina: 0.86,
        antennae: 0.9,
      },
      landmarks: [
        {
          id: 'ofed-bridge',
          name: '群星橋',
          kind: 'skyBridge',
          x: 0.42,
          depth: 0.35,
          scale: 1.2,
          note: '七つの街区が別々に架け、途中で繋ぎ合わせた橋。継ぎ目の幅がすべて違う。',
        },
        {
          id: 'ofed-market',
          name: '漂着者の市',
          kind: 'stackedMarket',
          x: 0.14,
          depth: 0.82,
          scale: 1.1,
          note: '着いたばかりの人が最初の店を出す桟橋。誰も出店を許可していない。',
        },
        {
          id: 'ofed-antenna',
          name: '自由回線の森',
          kind: 'antennaForest',
          x: 0.78,
          depth: 0.62,
          scale: 1.05,
          note: '街区ごとに立てた私設中継塔の集まり。同じ電波帯が何重にも重なっている。',
        },
      ],
      lighting: {
        timeOfDay: 'dusk',
        intensity: 0.68,
        sunX: 0.12,
        sunY: 0.14,
        haze: 0.55,
        mood: '海霧を透かす低い西日、無数の作業灯が同時に点きはじめる時刻',
      },
      weather: {
        kind: 'mist',
        density: 0.72,
        wind: -0.35,
        note: '港から立つ霧が骨組みの隙間を流れ、街の輪郭を毎分すこし変えている。',
      },
    },
    causality: [
      {
        axis: 'openness',
        cause: '入港と定住を誰にも開いたこと',
        effect: '桟橋のいちばん手前に、着いた人が今日出した店が並び続けている。',
      },
      {
        axis: 'power',
        cause: '決定権を街区の手元に置いたこと',
        effect:
          '同じ役目の中継塔が何本も林立し、どの一本が倒れても街の通信は止まらない。',
      },
      {
        axis: 'growth',
        cause: '規模の拡大を選んだこと',
        effect: '骨組みが水平にも垂直にも伸び続け、橋が空の高さで幾重にも交差している。',
      },
      {
        axis: 'governance',
        cause: '記録より匿名を選んだこと',
        effect:
          '街の設備には竣工年も施主も刻まれておらず、増改築の跡だけが履歴になっている。',
      },
    ],
    stats: [
      { label: '推定人口', value: '2,140万人' },
      { label: '自治街区数', value: '1,309区' },
      { label: '公認された都市計画図', value: '存在しない' },
    ],
  },

  /* ================================================================
   * OFGC — 開放 / 自由 / 持続 / 集中
   * ============================================================== */
  {
    id: 'OFGC',
    cityName: '大樹都ユグドラ',
    cityReading: 'たいじゅと・ユグドラ',
    title: '緑の管財人',
    tagline: '街の設計は樹に任せ、樹の管理は一箇所で行う。',
    society:
      '拡張を諦める代わりに、失われた森を都市の内側へ引き戻した都市。建築は伐らずに済む高さに抑えられ、代わりに植生が構造の一部を担う。誰がどこに住むかは自由で、出自も問われない。ただし、水と炭素と種子の配分だけは中央の管財機構が握っており、それに触れる決定は市民の合議の対象にならない。緑の豊かさは、たったひとつの機構が正しく在り続けることに依存している。',
    visual: {
      palette: {
        skyTop: '#7fc4d8',
        skyMid: '#bfe3d6',
        skyBottom: '#f2f0d2',
        sun: '#fffbe0',
        far: '#8aa78c',
        mid: '#6f9070',
        near: '#4b6a52',
        ground: '#5c7a4e',
        accent: '#7ddfe5',
        glow: '#baf3f1',
        fog: '#cfe5d8',
        foliage: '#4e8c46',
      },
      skyline: {
        silhouette: 'terraces',
        density: 0.62,
        heightBias: 0.4,
        variance: 0.5,
        symmetry: 0.68,
        greenery: 0.95,
        signage: 0.14,
        patina: 0.3,
        antennae: 0.2,
      },
      landmarks: [
        {
          id: 'ofgc-tree',
          name: '大樹〈ユグドラ・プライム〉',
          kind: 'worldTree',
          x: 0.52,
          depth: 0.48,
          scale: 1.4,
          note: '都市の水循環そのものを担う生体構造。設計者は一機関、管理権も一機関にある。',
        },
        {
          id: 'ofgc-terrace',
          name: '循環段丘',
          kind: 'terraceGarden',
          x: 0.2,
          depth: 0.78,
          scale: 1.15,
          note: '住居と農地が同じ段に載る居住段丘。誰でも一段を借りられる。',
        },
        {
          id: 'ofgc-vault',
          name: '種子の円蔵',
          kind: 'domeVault',
          x: 0.82,
          depth: 0.3,
          scale: 0.95,
          note: '地球上の作物種の八割を収める円蓋。開閉の権限は管財機構のみが持つ。',
        },
      ],
      lighting: {
        timeOfDay: 'noon',
        intensity: 0.92,
        sunX: 0.5,
        sunY: 0.82,
        haze: 0.3,
        mood: '葉を透かして落ちる真昼の光、影の縁がやわらかい',
      },
      weather: {
        kind: 'pollen',
        density: 0.8,
        wind: 0.18,
        note: '一年の三分の一は花粉と胞子が舞い、空気そのものが緑がかって見える。',
      },
    },
    causality: [
      {
        axis: 'growth',
        cause: '循環と再生に投資を振り切ったこと',
        effect:
          '建物の輪郭が緑に覆われた段丘に置き換わり、都市の最高点が人工物ではなく樹になった。',
      },
      {
        axis: 'power',
        cause: '配分の判断を中央機構に委ねたこと',
        effect: '水と種子を握る円蓋がひとつだけ存在し、その周囲だけ幾何学的に整っている。',
      },
      {
        axis: 'openness',
        cause: '住む人の出自を問わなかったこと',
        effect: '段丘の一段ごとに違う作物が植わり、故郷の異なる食が同じ高さに並んでいる。',
      },
      {
        axis: 'governance',
        cause: '生活の自由を優先したこと',
        effect: '住居の形が段ごとにばらばらで、統一された様式がどこにも見当たらない。',
      },
    ],
    stats: [
      { label: '推定人口', value: '980万人' },
      { label: '市域の植被率', value: '78%' },
      { label: '建築物の高さ上限', value: '樹冠より下' },
    ],
  },

  /* ================================================================
   * OFGD — 開放 / 自由 / 持続 / 分散
   * ============================================================== */
  {
    id: 'OFGD',
    cityName: '千庭連邦ミルガルデン',
    cityReading: 'せんていれんぽう・ミルガルデン',
    title: '共有地の庭師',
    tagline: '千の庭が、それぞれの速度で同じ方向を向いている。',
    society:
      '中央政府を持たず、千を超える庭付きの街区が条約だけで結ばれた都市。誰でも来て住み、誰でも一区画を耕せる。消費には上限があり、それをどう使うかは街区ごとの合議で決まるため、隣り合う区画で暮らし方がまるで違う。高い建物は必要とされず、都市は地面に沿って低く広がった。決定は遅く、統計は揃わない。しかしどの街区も、自分たちの水と食料と電気の出どころを言い当てることができる。',
    visual: {
      palette: {
        skyTop: '#9ac9e8',
        skyMid: '#d6e8ee',
        skyBottom: '#f8e3c0',
        sun: '#fff4d6',
        far: '#9fb39a',
        mid: '#87a67f',
        near: '#5f7d5a',
        ground: '#7d9455',
        accent: '#82d9ee',
        glow: '#c7f0f4',
        fog: '#dceae0',
        foliage: '#63a04f',
      },
      skyline: {
        silhouette: 'mounds',
        density: 0.7,
        heightBias: 0.14,
        variance: 0.6,
        symmetry: 0.1,
        greenery: 0.88,
        signage: 0.2,
        patina: 0.52,
        antennae: 0.16,
      },
      landmarks: [
        {
          id: 'ofgd-ring',
          name: '千人円座',
          kind: 'assemblyRing',
          x: 0.48,
          depth: 0.8,
          scale: 1.3,
          note: '全街区の代表が年に一度だけ集まる円形の窪地。議長席は無い。',
        },
        {
          id: 'ofgd-terrace',
          name: '持ち寄りの庭',
          kind: 'terraceGarden',
          x: 0.76,
          depth: 0.55,
          scale: 1.1,
          note: 'どの街区にも属さない共有畑。誰が植えたか記録しない決まりがある。',
        },
        {
          id: 'ofgd-market',
          name: '日曜連環市',
          kind: 'stackedMarket',
          x: 0.18,
          depth: 0.44,
          scale: 0.9,
          note: '週に一度だけ立ち、翌朝には跡形もなく畳まれる市。',
        },
      ],
      lighting: {
        timeOfDay: 'dawn',
        intensity: 0.72,
        sunX: 0.18,
        sunY: 0.24,
        haze: 0.36,
        mood: '朝いちばんの低い光、土と草の匂いが立ちのぼる時間',
      },
      weather: {
        kind: 'clear',
        density: 0.4,
        wind: 0.12,
        note: '空はよく晴れる。天候の記録は街区ごとに手書きで残されている。',
      },
    },
    causality: [
      {
        axis: 'power',
        cause: '決定権を街区の住民に降ろしたこと',
        effect: '隣り合う街区で屋根の形も作物も違い、都市に統一された景観が存在しない。',
      },
      {
        axis: 'growth',
        cause: '消費の総量に上限を定めたこと',
        effect: '建物が高く伸びるのをやめ、都市が地面に沿って低く広がった。',
      },
      {
        axis: 'openness',
        cause: '来る人を選ばなかったこと',
        effect: '共有畑に世界各地の在来種が混じって植わり、季節ごとに畑の色が変わる。',
      },
      {
        axis: 'governance',
        cause: '記録も監視も最小限に留めたこと',
        effect: '誰が何を植えたかを示す札がどこにも立っていない。',
      },
    ],
    stats: [
      { label: '推定人口', value: '410万人' },
      { label: '加盟街区数', value: '1,024区' },
      { label: '一人あたり消費上限', value: '街区ごとに自主決定' },
    ],
  },

  /* ================================================================
   * OSEC — 開放 / 統制 / 拡張 / 集中
   * ============================================================== */
  {
    id: 'OSEC',
    cityName: '白光庁都ルクシオン',
    cityReading: 'はっこうちょうと・ルクシオン',
    title: '秩序ある繁栄の管理者',
    tagline: '誰でも入れる。ただし、入ってからはすべて見えている。',
    society:
      '世界のどこからでも移住でき、手続きは半日で終わる。ただし入域したその瞬間から、移動と取引と体温のすべてが都市の統合台帳に記録される。犯罪も事故も渇水も百年間ゼロに保たれ、経済は途切れず拡大した。あらゆる不都合が発生前に処理されるため、市民が都市について議論する機会はほとんどない。街は驚くほど清潔で、驚くほど静かで、そして予定通りである。',
    visual: {
      palette: {
        skyTop: '#a8c8e8',
        skyMid: '#d8e6f2',
        skyBottom: '#fdfdfa',
        sun: '#ffffff',
        far: '#b9c6d2',
        mid: '#d3dce4',
        near: '#8d9aa8',
        ground: '#c9d2d8',
        accent: '#62c8f4',
        glow: '#ffffff',
        fog: '#e4edf4',
        foliage: '#7fae8a',
      },
      skyline: {
        silhouette: 'megablock',
        density: 0.9,
        heightBias: 0.88,
        variance: 0.16,
        symmetry: 0.96,
        greenery: 0.24,
        signage: 0.3,
        patina: 0.04,
        antennae: 0.6,
      },
      landmarks: [
        {
          id: 'osec-tower',
          name: '白光庁〈ルクス・タワー〉',
          kind: 'megatower',
          x: 0.5,
          depth: 0.4,
          scale: 1.3,
          note: '全市民の台帳を保持する行政中枢。窓の配置に一切の例外がない。',
        },
        {
          id: 'osec-eye',
          name: '万眼塔',
          kind: 'watchEye',
          x: 0.24,
          depth: 0.68,
          scale: 1.1,
          note: '市域を隈なく覆う観測塔。市民はこれを「安心の目」と呼ぶ。',
        },
        {
          id: 'osec-stack',
          name: '第一動力柱',
          kind: 'reactorStack',
          x: 0.8,
          depth: 0.24,
          scale: 1.05,
          note: '拡大し続ける需要を支える供給塔。停止手順は策定されていない。',
        },
      ],
      lighting: {
        timeOfDay: 'noon',
        intensity: 1.0,
        sunX: 0.5,
        sunY: 0.9,
        haze: 0.22,
        mood: '影のできかたまで設計された、均一で白い真昼',
      },
      weather: {
        kind: 'drones',
        density: 0.9,
        wind: 0.05,
        note: '整列した観測機が一定の高度と間隔を保って巡回している。',
      },
    },
    causality: [
      {
        axis: 'governance',
        cause: '安全のために全域の可視化を選んだこと',
        effect:
          '街路が見通しのよい直線に整えられ、視線を集める観測塔がどの街区からも見える。',
      },
      {
        axis: 'power',
        cause: '判断を統合台帳と専門機関に預けたこと',
        effect: '建物の高さと窓割りがほぼ揃い、都市全体が一枚の図面のように読める。',
      },
      {
        axis: 'openness',
        cause: '移住の門戸を開いたままにしたこと',
        effect: '同じ規格の住区が延々と続き、その中に世界中の姓名の表札が並んでいる。',
      },
      {
        axis: 'growth',
        cause: '供給を増やし続ける道を選んだこと',
        effect: '都市の輪郭に、供給専用の巨大な柱が三本刻まれている。',
      },
    ],
    stats: [
      { label: '推定人口', value: '6,300万人' },
      { label: '市域の記録被覆率', value: '100%' },
      { label: '未解決事件（過去100年）', value: '0件' },
    ],
  },

  /* ================================================================
   * OSED — 開放 / 統制 / 拡張 / 分散
   * ============================================================== */
  {
    id: 'OSED',
    cityName: '網目市カナリア・メッシュ',
    cityReading: 'あみめし・カナリア・メッシュ',
    title: '相互監視の交易人',
    tagline: '見張るのは役所ではなく、隣の街区である。',
    society:
      '中央の警察機構を持たない代わりに、街区どうしが互いを観測し合う協定で秩序を維持している都市。門は誰にでも開かれ、交易は絶えず拡大しているが、新しく来た者はまずどこかの街区の観測網に登録されなければ商いができない。評判は数値化され、街区の境ごとに掲示される。自由に移動できるが、どこへ行っても誰かの目録に載っている。誰も支配していないのに、誰も見られていない場所がない。',
    visual: {
      palette: {
        skyTop: '#2b3550',
        skyMid: '#4a5a78',
        skyBottom: '#8fa0b4',
        sun: '#c9d8e8',
        far: '#48566e',
        mid: '#5a6b84',
        near: '#333d52',
        ground: '#2c3648',
        accent: '#64c9f2',
        glow: '#a7e6f8',
        fog: '#6f819a',
        foliage: '#5d8068',
      },
      skyline: {
        silhouette: 'towers',
        density: 0.88,
        heightBias: 0.7,
        variance: 0.34,
        symmetry: 0.58,
        greenery: 0.26,
        signage: 0.6,
        patina: 0.56,
        antennae: 0.86,
      },
      landmarks: [
        {
          id: 'osed-eye',
          name: '相互監視の目〈カナリア〉',
          kind: 'watchEye',
          x: 0.56,
          depth: 0.5,
          scale: 1.15,
          note: '街区が持ち回りで運用する観測塔。運用者は毎月入れ替わる。',
        },
        {
          id: 'osed-ring',
          name: '街区評議環',
          kind: 'assemblyRing',
          x: 0.24,
          depth: 0.84,
          scale: 1.0,
          note: '境界の紛争を裁く円形広場。判決は隣接街区の全員が見ている前で下される。',
        },
        {
          id: 'osed-antenna',
          name: '通達塔群',
          kind: 'antennaForest',
          x: 0.82,
          depth: 0.34,
          scale: 1.0,
          note: '認証済みの通達だけを流す塔の列。未署名の電波は届かない。',
        },
      ],
      lighting: {
        timeOfDay: 'night',
        intensity: 0.4,
        sunX: 0.3,
        sunY: 0.06,
        haze: 0.5,
        mood: '雨に濡れた夜、街区の境ごとに色の違う照明が競り合っている',
      },
      weather: {
        kind: 'rain',
        density: 0.82,
        wind: -0.3,
        note: '雨が多い。水路の管理権が街区ごとに分かれているため、路面の乾き方が場所で違う。',
      },
    },
    causality: [
      {
        axis: 'governance',
        cause: '情報の認証を必須にしたこと',
        effect: '街の掲示物がすべて同じ書式で揃い、無署名の貼り紙が一枚もない。',
      },
      {
        axis: 'power',
        cause: '権限を街区ごとに分けたこと',
        effect: '境界を越えるたびに照明の色と路面の舗装が変わり、街区の縁が目で追える。',
      },
      {
        axis: 'openness',
        cause: '門を誰にでも開いたこと',
        effect: '観測塔の登録板に、毎日新しい出身地の名が書き足されていく。',
      },
      {
        axis: 'growth',
        cause: '交易の拡大を止めなかったこと',
        effect: '同じ高さのタワーが地平線の際まで隙間なく続いている。',
      },
    ],
    stats: [
      { label: '推定人口', value: '3,050万人' },
      { label: '相互観測協定', value: '478街区が締結' },
      { label: '中央警察機構', value: '設置されていない' },
    ],
  },

  /* ================================================================
   * OSGC — 開放 / 統制 / 持続 / 集中
   * ============================================================== */
  {
    id: 'OSGC',
    cityName: '静水都アクアリウム・ノヴァ',
    cityReading: 'せいすいと・アクアリウム・ノヴァ',
    title: '気候の指揮者',
    tagline: '空気の温度も、誰が入るかも、同じ部署が決めている。',
    society:
      '気候変動を「管理対象」として完全に囲い込んだ都市。市域は連続した円蓋の下にあり、温度と湿度と降雨は中央の気候局が秒単位で調整する。移住は歓迎され、言語も信仰も自由だが、水と空気の使用量は個人単位で計測され、超過は自動的に是正される。市民は暴風も熱波も知らない。同時に、天気が自分の意思で変わるのを見たことがない。',
    visual: {
      palette: {
        skyTop: '#6e8fa8',
        skyMid: '#9db9c6',
        skyBottom: '#dfeaea',
        sun: '#eef6f2',
        far: '#8fa6ad',
        mid: '#a9bfc2',
        near: '#6b8189',
        ground: '#7f9aa0',
        accent: '#55d6d8',
        glow: '#b9f1ef',
        fog: '#cfe0e2',
        foliage: '#69a58c',
      },
      skyline: {
        silhouette: 'domes',
        density: 0.78,
        heightBias: 0.38,
        variance: 0.2,
        symmetry: 0.92,
        greenery: 0.66,
        signage: 0.18,
        patina: 0.08,
        antennae: 0.3,
      },
      landmarks: [
        {
          id: 'osgc-dome',
          name: '気候円蓋〈アクア・ドーム〉',
          kind: 'domeVault',
          x: 0.44,
          depth: 0.42,
          scale: 1.45,
          note: '市域全体を覆う気候制御殻。開口部の操作は気候局だけが行える。',
        },
        {
          id: 'osgc-ring',
          name: '静水環',
          kind: 'ringArcology',
          x: 0.62,
          depth: 0.22,
          scale: 1.1,
          note: '水を循環させながら住居を吊る環状構造。水位は常に一定。',
        },
        {
          id: 'osgc-stack',
          name: '熱交換塔',
          kind: 'reactorStack',
          x: 0.18,
          depth: 0.7,
          scale: 0.9,
          note: '余剰熱を海へ返す塔。排出量は毎分公開されている。',
        },
      ],
      lighting: {
        timeOfDay: 'overcast',
        intensity: 0.62,
        sunX: 0.42,
        sunY: 0.66,
        haze: 0.68,
        mood: '曇天を模した拡散光。影がほとんどできない、平らな明るさ',
      },
      weather: {
        kind: 'fog',
        density: 0.75,
        wind: 0.04,
        note: '円蓋の内側に凝結した霧が層をつくり、決められた時刻に散らされる。',
      },
    },
    causality: [
      {
        axis: 'growth',
        cause: '消費の総量に上限を引いたこと',
        effect: '建物が低く抑えられ、屋上のほとんどが緑と集水面に置き換わっている。',
      },
      {
        axis: 'power',
        cause: '配分の判断を中央に集めたこと',
        effect: '円蓋がひとつの幾何学として街を覆い、街区の輪郭がすべて同心円に沿っている。',
      },
      {
        axis: 'governance',
        cause: '安全と安定のために計測を受け入れたこと',
        effect: '水路と換気口の位置が寸分違わず反復し、逸脱した構造がどこにもない。',
      },
      {
        axis: 'openness',
        cause: '移住を歓迎し続けたこと',
        effect: '同じ規格の住居の窓辺に、地域の違う植物が思い思いに並んでいる。',
      },
    ],
    stats: [
      { label: '推定人口', value: '1,760万人' },
      { label: '市域の気候制御率', value: '99.4%' },
      { label: '記録上の暴風', value: '過去100年 0回' },
    ],
  },

  /* ================================================================
   * OSGD — 開放 / 統制 / 持続 / 分散
   * ============================================================== */
  {
    id: 'OSGD',
    cityName: '蜂巣郷アピス',
    cityReading: 'ほうそうきょう・アピス',
    title: '共同体規範の守り手',
    tagline: '掟は誰も書いていないが、全員が知っている。',
    society:
      '外から来る人を拒まないが、来た人はすぐに巣室のひとつに配属され、そこの作法に従うことになる。中央政府は無く、規範は街区ごとの合議で決まり、破れば全員に知られる。消費は厳しく抑えられ、暮らしは静かで手作業が多い。積み上がった住居は蜂の巣のように隣と壁を共有し、誰かが夜更かししていることも、誰かが困っていることも、壁越しにすべて伝わってしまう。',
    visual: {
      palette: {
        skyTop: '#80bdd4',
        skyMid: '#b8dfe8',
        skyBottom: '#edf9f8',
        sun: '#f7ffff',
        far: '#88afb5',
        mid: '#72a9ae',
        near: '#527d86',
        ground: '#6f9895',
        accent: '#5bd2d7',
        glow: '#b4f0ed',
        fog: '#d2e9e8',
        foliage: '#568f78',
      },
      skyline: {
        silhouette: 'ziggurat',
        density: 0.82,
        heightBias: 0.42,
        variance: 0.26,
        symmetry: 0.74,
        greenery: 0.7,
        signage: 0.12,
        patina: 0.62,
        antennae: 0.1,
      },
      landmarks: [
        {
          id: 'osgd-market',
          name: '蜜房集合住居',
          kind: 'stackedMarket',
          x: 0.5,
          depth: 0.6,
          scale: 1.3,
          note: '六角の住室が積み重なった居住体。壁は必ず隣と共有される。',
        },
        {
          id: 'osgd-ring',
          name: '合議の巣室',
          kind: 'assemblyRing',
          x: 0.22,
          depth: 0.84,
          scale: 1.05,
          note: '規範を決める円室。発言者の顔は全員に見えるよう設計されている。',
        },
        {
          id: 'osgd-terrace',
          name: '共同苗床',
          kind: 'terraceGarden',
          x: 0.8,
          depth: 0.4,
          scale: 1.0,
          note: '全戸が交代で世話をする段状の畑。当番表は壁に彫られている。',
        },
      ],
      lighting: {
        timeOfDay: 'dawn',
        intensity: 0.8,
        sunX: 0.82,
        sunY: 0.28,
        haze: 0.42,
        mood: '蜜色の朝の斜光、壁の凹凸が長い影を落とす',
      },
      weather: {
        kind: 'mist',
        density: 0.5,
        wind: 0.1,
        note: '朝の薄霧が段の間に溜まり、当番の鐘が鳴るまで動かない。',
      },
    },
    causality: [
      {
        axis: 'governance',
        cause: '規範の遵守を可視化に委ねたこと',
        effect: '住室が必ず壁を共有し、独立して立つ家屋が一軒も無い。',
      },
      {
        axis: 'power',
        cause: '決定を街区の合議に置いたこと',
        effect: '当番と持ち分が壁面に直接彫り込まれ、都市そのものが台帳になっている。',
      },
      {
        axis: 'growth',
        cause: '消費を抑える側に振ったこと',
        effect: '段のすべてに畑が載り、建物の高さが作物の日当たりで決まっている。',
      },
      {
        axis: 'openness',
        cause: '来る人を受け入れ続けたこと',
        effect: '巣室ごとに違う土地の調理の匂いが、同じ通路に混じって流れている。',
      },
    ],
    stats: [
      { label: '推定人口', value: '620万人' },
      { label: '巣室（自治単位）', value: '8,400室' },
      { label: '成文化された法典', value: '一冊も無い' },
    ],
  },
] as const;
