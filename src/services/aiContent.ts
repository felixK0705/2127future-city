import { CATEGORY_KEYS, type Choices, type Scores } from '../types'
import { findPolicy } from '../data/policies'
import { METRIC_LABELS } from '../data/copy'

export type CityIdentity = {
  cityName: string
  typeTitle?: string
  title?: string
}

export type CityContent = {
  headline: string
  dailyLife: string
  analysis: string
}

const METRIC_KEYS = [
  'environment',
  'freedom',
  'equity',
  'convenience',
  'diversity',
] as const

const isJapaneseText = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  value.length <= 240 &&
  /[\u3040-\u30ff\u3400-\u9fff]/u.test(value)

const isCityContent = (value: unknown): value is CityContent => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return (
    Object.keys(record).length === 3 &&
    isJapaneseText(record.headline) &&
    isJapaneseText(record.dailyLife) &&
    isJapaneseText(record.analysis)
  )
}

const fallbackContent = (
  choices: Choices,
  scores: Scores,
  identity: CityIdentity,
): CityContent => {
  const typeTitle = identity.typeTitle ?? identity.title ?? '未来都市の市民'
  const policies = CATEGORY_KEYS.map((category) =>
    findPolicy(category, choices[category] ?? ''),
  )
  const ranked = [...METRIC_KEYS].sort(
    (left, right) =>
      scores[right] - scores[left] || METRIC_KEYS.indexOf(left) - METRIC_KEYS.indexOf(right),
  )
  const strongest = ranked[0] ?? METRIC_KEYS[0]
  const weakest = ranked[ranked.length - 1] ?? METRIC_KEYS[0]
  const first = policies[0]?.title ?? '選ばれたエネルギー政策'
  const transport = policies[1]?.title ?? '選ばれた移動政策'
  const learning = policies[3]?.title ?? '選ばれた教育政策'

  return {
    headline: `${identity.cityName}で「${first}」が始動――${typeTitle}の都市づくり`,
    dailyLife: `住民は「${transport}」で街を行き交い、「${learning}」で世代を越えて学ぶ。便利さと負担の両方を引き受ける暮らしが続いている。`,
    analysis: `${typeTitle}の強みは${METRIC_LABELS[strongest]}（${scores[strongest]}）。一方、${METRIC_LABELS[weakest]}（${scores[weakest]}）を誰が補うかが、この都市の次の課題になる。`,
  }
}

export async function generateCityContent(
  choices: Choices,
  scores: Scores,
  identity: CityIdentity,
): Promise<CityContent> {
  const typeTitle = identity.typeTitle ?? identity.title ?? '未来都市の市民'
  const policies = CATEGORY_KEYS.map((category) => {
    const policy = findPolicy(category, choices[category] ?? '')
    return {
      category,
      title: policy?.title ?? '',
      summary: policy
        ? `${policy.description} ${policy.consequence}`
        : '政策は選択されていません。',
    }
  })

  try {
    const response = await fetch('/api/city-content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        policies,
        scores: Object.fromEntries(METRIC_KEYS.map((key) => [key, scores[key]])),
        cityName: identity.cityName,
        typeTitle,
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) throw new Error(`AI_SERVICE_${response.status}`)
    const content: unknown = await response.json()
    if (!isCityContent(content)) throw new Error('INVALID_AI_RESPONSE')
    return content
  } catch (error) {
    console.info(
      'AI都市通信を決定済みの展示文へ切り替えました。',
      error instanceof Error ? error.message : error,
    )
    return fallbackContent(choices, scores, identity)
  }
}
