import type { CategoryKey, Policy, PolicyCategory } from '../types.ts'

export const POLICY_CATEGORIES = [
  {
    id: 'energy',
    label: 'エネルギー',
    prompt: '都市を動かす力を、どこから得ますか？',
    weight: 2,
    primaryAxis: 'growth',
    policies: [
      {
        id: 'solar-commons',
        title: '太陽の共有地',
        description: '屋根や道路を市民共同の発電所にする。',
        consequence: '地域で電力を分け合う一方、天候による変動を受け入れる。',
        effects: { environment: 18, freedom: 4, equity: 10, convenience: -3, diversity: 2 },
        axisLeans: { growth: -1, power: -1, openness: 1 },
      },
      {
        id: 'fusion-grid',
        title: '核融合メガグリッド',
        description: '巨大な中央発電所が都市全体を安定して支える。',
        consequence: '潤沢な電力と引き換えに、管理権限が一か所へ集中する。',
        effects: { environment: 8, freedom: -8, equity: 1, convenience: 18, diversity: -2 },
        axisLeans: { growth: 1, power: 1, governance: -1 },
      },
      {
        id: 'energy-ration',
        title: '一人一日エネルギー枠',
        description: '全員に同量の電力枠を配り、消費を見える化する。',
        consequence: '公平で低負荷だが、暮らし方の選択には制限が生まれる。',
        effects: { environment: 20, freedom: -14, equity: 16, convenience: -12, diversity: -3 },
        axisLeans: { growth: -1, governance: -1, power: 1 },
      },
    ],
  },
  {
    id: 'transport',
    label: '移動',
    prompt: '人と物は、どのように都市を移動しますか？',
    weight: 1,
    primaryAxis: null,
    policies: [
      {
        id: 'walkable-cells',
        title: '徒歩15分の小都市群',
        description: '生活に必要な場所を徒歩圏にまとめる。',
        consequence: '静かな街になるが、遠距離移動の自由度は下がる。',
        effects: { environment: 15, freedom: -2, equity: 8, convenience: 5, diversity: 6 },
        axisLeans: { growth: -1, governance: 1 },
      },
      {
        id: 'autonomous-flow',
        title: '完全自動モビリティ',
        description: 'AI交通網が最短経路で人と物を運ぶ。',
        consequence: '移動は速いが、行動データが都市に蓄積される。',
        effects: { environment: 2, freedom: -7, equity: -3, convenience: 22, diversity: 1 },
        axisLeans: { governance: -1, power: 1 },
      },
      {
        id: 'free-transit',
        title: '公共交通を無償化',
        description: '列車、船、バスを誰でも無料で使える。',
        consequence: '移動格差を減らす代わりに、混雑と公費負担が増える。',
        effects: { environment: 9, freedom: 9, equity: 18, convenience: 10, diversity: 7 },
        axisLeans: { openness: 1, power: -1 },
      },
    ],
  },
  {
    id: 'law',
    label: '法とルール',
    prompt: '都市の安全と自由を、どう両立させますか？',
    weight: 2,
    primaryAxis: 'governance',
    policies: [
      {
        id: 'predictive-law',
        title: '予測型AI司法',
        description: '危険の兆候をAIが検知し、事件を未然に防ぐ。',
        consequence: '安全性は高まるが、まだ起きていない行動も判断材料になる。',
        effects: { environment: 0, freedom: -22, equity: -8, convenience: 15, diversity: -10 },
        axisLeans: { governance: -1, power: 1, openness: -1 },
      },
      {
        id: 'citizen-jury',
        title: '市民くじ引き議会',
        description: '無作為に選ばれた市民が法律を更新する。',
        consequence: '多様な声が届く一方、決定には時間がかかる。',
        effects: { environment: 3, freedom: 12, equity: 14, convenience: -10, diversity: 15 },
        axisLeans: { governance: 1, power: -1, openness: 1 },
      },
      {
        id: 'personal-contract',
        title: '選べる個人ルール',
        description: '共通の最低限以外は、所属コミュニティごとに決める。',
        consequence: '自分らしい規範を選べるが、地域間の差が広がる。',
        effects: { environment: -2, freedom: 22, equity: -12, convenience: 1, diversity: 14 },
        axisLeans: { governance: 1, power: -1 },
      },
    ],
  },
  {
    id: 'education',
    label: '教育',
    prompt: '次の世代は、何をどう学びますか？',
    weight: 2,
    primaryAxis: 'power',
    policies: [
      {
        id: 'ai-tutor',
        title: '一人一台AI教師',
        description: '理解度と関心に合わせて、学習内容を毎日組み替える。',
        consequence: '効率的だが、同じ教室で迷う経験は少なくなる。',
        effects: { environment: 1, freedom: 8, equity: -4, convenience: 17, diversity: -5 },
        axisLeans: { power: 1, governance: -1 },
      },
      {
        id: 'learning-commons',
        title: 'まち全体を学校に',
        description: '工房、森、市場で世代を超えて学ぶ。',
        consequence: '多様な知恵に触れるが、成果の測定は難しい。',
        effects: { environment: 8, freedom: 13, equity: 10, convenience: -6, diversity: 18 },
        axisLeans: { power: -1, openness: 1 },
      },
      {
        id: 'universal-curriculum',
        title: '世界共通カリキュラム',
        description: '全員が同じ基礎知識と技能を身につける。',
        consequence: '教育格差を抑える一方、地域固有の学びが薄れる。',
        effects: { environment: 3, freedom: -9, equity: 20, convenience: 8, diversity: -14 },
        axisLeans: { power: 1, openness: -1 },
      },
    ],
  },
  {
    id: 'culture',
    label: '文化',
    prompt: '都市の記憶と表現を、誰が育てますか？',
    weight: 2,
    primaryAxis: 'openness',
    policies: [
      {
        id: 'living-archives',
        title: '記憶を残す街区',
        description: '古い建物や祭りを更新しながら使い続ける。',
        consequence: '地域の物語は残るが、再開発の速度は落ちる。',
        effects: { environment: 7, freedom: 5, equity: 3, convenience: -7, diversity: 18 },
        axisLeans: { openness: 1, growth: -1 },
      },
      {
        id: 'algorithmic-culture',
        title: '好みに最適化された文化',
        description: 'AIが一人ひとりに最適な作品と空間を生成する。',
        consequence: '満足度は高いが、偶然の出会いが減る。',
        effects: { environment: -2, freedom: 10, equity: -6, convenience: 16, diversity: -12 },
        axisLeans: { openness: -1, power: 1 },
      },
      {
        id: 'open-festival',
        title: '毎月ひらく市民祭',
        description: '公共空間を誰でも表現できる舞台にする。',
        consequence: '異なる文化が混ざる一方、静けさと効率は損なわれる。',
        effects: { environment: 1, freedom: 14, equity: 8, convenience: -9, diversity: 22 },
        axisLeans: { openness: 1, governance: 1, power: -1 },
      },
    ],
  },
] as const satisfies readonly PolicyCategory[]

export const findCategory = (
  categoryId: CategoryKey,
): PolicyCategory | undefined =>
  POLICY_CATEGORIES.find((category) => category.id === categoryId)

export const findPolicy = (
  categoryId: CategoryKey,
  policyId: string,
): Policy | undefined =>
  findCategory(categoryId)?.policies.find((policy) => policy.id === policyId)
