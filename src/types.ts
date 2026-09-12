export const CATEGORY_KEYS = [
  'energy',
  'transport',
  'law',
  'education',
  'culture',
] as const

export type CategoryKey = (typeof CATEGORY_KEYS)[number]

export const METRIC_KEYS = [
  'environment',
  'freedom',
  'equity',
  'convenience',
  'diversity',
] as const

export type MetricKey = (typeof METRIC_KEYS)[number]
export type Choices = Partial<Record<CategoryKey, string>>
export type CompleteChoices = Readonly<Record<CategoryKey, string>>
export type Scores = Record<MetricKey, number>

/** 以下の識別子は内部計算専用。画面や共有URLへ表示しない。 */
export type AxisId = 'openness' | 'governance' | 'growth' | 'power'
export type AxisLean = -1 | 0 | 1
export type AxisScores = Readonly<Record<AxisId, number>>

type OpennessCode = 'O' | 'L'
type GovernanceCode = 'F' | 'S'
type GrowthCode = 'E' | 'G'
type PowerCode = 'C' | 'D'
export type ArchetypeId =
  `${OpennessCode}${GovernanceCode}${GrowthCode}${PowerCode}`

export type AxisPole = {
  readonly code:
    | OpennessCode
    | GovernanceCode
    | GrowthCode
    | PowerCode
  readonly label: string
  readonly phrase: string
}

export type AxisDefinition = {
  readonly id: AxisId
  readonly label: string
  readonly positive: AxisPole
  readonly negative: AxisPole
}

export type Policy = {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly consequence: string
  readonly effects: Readonly<Scores>
  readonly axisLeans: Readonly<Partial<Record<AxisId, AxisLean>>>
}

export type PolicyCategory = {
  readonly id: CategoryKey
  readonly label: string
  readonly prompt: string
  readonly weight: 1 | 2
  readonly primaryAxis: AxisId | null
  readonly policies: readonly Policy[]
}
