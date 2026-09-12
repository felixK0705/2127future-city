import type { ArchetypeId, AxisDefinition, AxisId } from '../types.ts'

/** 軸名・極コード・生成IDは内部専用であり、画面へ表示しない。 */
export const AXES = [
  {
    id: 'openness',
    label: '開放性',
    positive: {
      code: 'O',
      label: '開放的多文化社会',
      phrase: '異なる出自の人々を招き入れ続けること',
    },
    negative: {
      code: 'L',
      label: '閉鎖的単一社会',
      phrase: '境界を引き、内側の暮らしを守り抜くこと',
    },
  },
  {
    id: 'governance',
    label: '統治',
    positive: {
      code: 'F',
      label: '自由・分散型',
      phrase: '匿名と自由を、多少の混乱ごと引き受けること',
    },
    negative: {
      code: 'S',
      label: '統制・監視型',
      phrase: '安全のために、見られることを受け入れること',
    },
  },
  {
    id: 'growth',
    label: '成長モデル',
    positive: {
      code: 'E',
      label: '物質的拡張優先',
      phrase: '限界の先へ、規模を広げ続けること',
    },
    negative: {
      code: 'G',
      label: '持続可能性優先',
      phrase: '手に入るものの総量に、暮らしを合わせること',
    },
  },
  {
    id: 'power',
    label: '権力構造',
    positive: {
      code: 'C',
      label: '集中管理（大企業／AI 主導）',
      phrase: '判断を、より賢く速い仕組みに預けること',
    },
    negative: {
      code: 'D',
      label: '分散自治（市民主導）',
      phrase: '決定権を、暮らしている人の手元に置くこと',
    },
  },
] as const satisfies readonly AxisDefinition[]

export const AXIS_ORDER = AXES.map((axis) => axis.id) as readonly AxisId[]

const AXIS_INDEX = new Map<AxisId, AxisDefinition>(
  AXES.map((axis) => [axis.id, axis]),
)

export const getAxis = (id: AxisId): AxisDefinition => {
  const axis = AXIS_INDEX.get(id)
  if (!axis) throw new Error(`未知の軸です: ${id}`)
  return axis
}

export const ALL_ARCHETYPE_IDS = AXES.reduce<string[]>(
  (ids, axis) =>
    ids.flatMap((prefix) => [
      `${prefix}${axis.positive.code}`,
      `${prefix}${axis.negative.code}`,
    ]),
  [''],
) as ArchetypeId[]

export const isArchetypeId = (value: string): value is ArchetypeId =>
  ALL_ARCHETYPE_IDS.includes(value as ArchetypeId)
