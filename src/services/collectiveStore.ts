import { calculateScores, isCompleteChoices } from '../lib/scoring'
import { scoreArchetype } from '../lib/archetypeScoring'
import { isArchetypeId } from '../lib/axes'
import {
  CATEGORY_KEYS,
  METRIC_KEYS,
  type ArchetypeId,
  type CategoryKey,
  type Choices,
  type CompleteChoices,
  type Scores,
} from '../types'

export const COLLECTIVE_STORAGE_KEY = 'future-city-2127-combined'
const LOCAL_EVENT = 'future-city-2127-combined-update'

export type CollectiveSubmission = {
  id: string
  choices: Record<CategoryKey, string>
  scores: Scores
  archetypeId: ArchetypeId
  createdAt: number
}

const seedChoices: Array<Record<CategoryKey, string>> = [
  { energy: 'solar-commons', transport: 'free-transit', law: 'citizen-jury', education: 'learning-commons', culture: 'open-festival' },
  { energy: 'fusion-grid', transport: 'autonomous-flow', law: 'predictive-law', education: 'ai-tutor', culture: 'algorithmic-culture' },
  { energy: 'energy-ration', transport: 'walkable-cells', law: 'citizen-jury', education: 'universal-curriculum', culture: 'living-archives' },
  { energy: 'solar-commons', transport: 'walkable-cells', law: 'personal-contract', education: 'learning-commons', culture: 'living-archives' },
  { energy: 'fusion-grid', transport: 'free-transit', law: 'citizen-jury', education: 'universal-curriculum', culture: 'open-festival' },
  { energy: 'solar-commons', transport: 'autonomous-flow', law: 'predictive-law', education: 'ai-tutor', culture: 'algorithmic-culture' },
]

const createSubmission = (
  choices: CompleteChoices,
  id: string,
  createdAt: number,
): CollectiveSubmission => {
  const scores = calculateScores(choices)
  const { archetypeId } = scoreArchetype(choices)
  return { id, choices: { ...choices }, scores, archetypeId, createdAt }
}

const seeds = seedChoices.map((choices, index) =>
  createSubmission(choices, `sample-${index + 1}`, 2127000000000 + index),
)

const isSubmission = (value: unknown): value is CollectiveSubmission => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as Record<string, unknown>
  const scores = item.scores as Record<string, unknown> | undefined
  return (
    typeof item.id === 'string' &&
    typeof item.createdAt === 'number' &&
    typeof item.archetypeId === 'string' &&
    isArchetypeId(item.archetypeId) &&
    isCompleteChoices((item.choices ?? {}) as Choices) &&
    !!scores &&
    METRIC_KEYS.every(
      (key) => typeof scores[key] === 'number' && Number.isFinite(scores[key]),
    )
  )
}

const readStored = (): CollectiveSubmission[] => {
  if (typeof localStorage === 'undefined') return seeds
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(COLLECTIVE_STORAGE_KEY) ?? 'null')
    return Array.isArray(parsed) && parsed.every(isSubmission) && parsed.length ? parsed : seeds
  } catch {
    return seeds
  }
}

let cache: CollectiveSubmission[] | undefined
const submissions = () => (cache ??= readStored())

export const getCollectiveSubmissions = (): readonly CollectiveSubmission[] => [
  ...submissions(),
]

/**
 * 完成した五問を一件追加する。不完全な回答は追加しない。
 * 画面側は完了イベント一回につき、この関数を一度だけ呼ぶ。
 */
export const addCollectiveSubmission = (
  choices: Choices,
): CollectiveSubmission | undefined => {
  if (!isCompleteChoices(choices)) return undefined
  const current = submissions()

  const submission = createSubmission(
    choices,
    `visitor-${Date.now().toString(36)}-${current.length}`,
    Date.now(),
  )
  cache = [...current, submission]
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(COLLECTIVE_STORAGE_KEY, JSON.stringify(cache))
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(LOCAL_EVENT))
  try {
    const channel = new BroadcastChannel(COLLECTIVE_STORAGE_KEY)
    channel.postMessage('updated')
    channel.close()
  } catch {
    // storage event が利用できる環境では、そちらで同期される。
  }
  return submission
}

export const subscribeToCollective = (listener: () => void): (() => void) => {
  if (typeof window === 'undefined') return () => undefined
  const refresh = () => {
    cache = readStored()
    listener()
  }
  window.addEventListener('storage', refresh)
  window.addEventListener(LOCAL_EVENT, refresh)

  let channel: BroadcastChannel | undefined
  try {
    channel = new BroadcastChannel(COLLECTIVE_STORAGE_KEY)
    channel.addEventListener('message', refresh)
  } catch {
    channel = undefined
  }

  return () => {
    window.removeEventListener('storage', refresh)
    window.removeEventListener(LOCAL_EVENT, refresh)
    channel?.close()
  }
}

export const aggregateChoices = (
  values: readonly CollectiveSubmission[] = submissions(),
): Record<CategoryKey, Record<string, number>> => {
  const result = Object.fromEntries(CATEGORY_KEYS.map((key) => [key, {}])) as Record<
    CategoryKey,
    Record<string, number>
  >
  for (const item of values) {
    for (const key of CATEGORY_KEYS) {
      const selected = item.choices[key]
      result[key][selected] = (result[key][selected] ?? 0) + 1
    }
  }
  return result
}

export const collectiveAverage = (
  values: readonly CollectiveSubmission[] = submissions(),
): Scores => {
  const divisor = Math.max(1, values.length)
  return Object.fromEntries(
    METRIC_KEYS.map((key) => [
      key,
      Math.round(values.reduce((sum, item) => sum + item.scores[key], 0) / divisor),
    ]),
  ) as Scores
}

export const countSameArchetype = (
  archetypeId: ArchetypeId,
  values: readonly CollectiveSubmission[] = submissions(),
): number => values.filter((item) => item.archetypeId === archetypeId).length

export const collectiveAggregate = aggregateChoices
export const sameArchetypeCount = countSameArchetype
