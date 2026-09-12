import { findPolicy, POLICY_CATEGORIES } from '../data/policies.ts'
import { METRIC_LABELS } from '../data/copy.ts'
import {
  CATEGORY_KEYS,
  METRIC_KEYS,
  type Choices,
  type CompleteChoices,
  type MetricKey,
  type Scores,
} from '../types.ts'

export const BASE_SCORE = 50

export const calculateScores = (choices: Choices): Scores => {
  const totals: Scores = {
    environment: BASE_SCORE,
    freedom: BASE_SCORE,
    equity: BASE_SCORE,
    convenience: BASE_SCORE,
    diversity: BASE_SCORE,
  }

  for (const category of POLICY_CATEGORIES) {
    const policyId = choices[category.id]
    if (!policyId) continue
    const policy = findPolicy(category.id, policyId)
    if (!policy) continue

    for (const metric of METRIC_KEYS) {
      totals[metric] += policy.effects[metric]
    }
  }

  return Object.fromEntries(
    METRIC_KEYS.map((metric) => [
      metric,
      Math.max(0, Math.min(100, totals[metric])),
    ]),
  ) as Scores
}

export const isCompleteChoices = (
  choices: Choices,
): choices is CompleteChoices =>
  CATEGORY_KEYS.every((categoryId) => {
    const policyId = choices[categoryId]
    return Boolean(policyId && findPolicy(categoryId, policyId))
  })

export const getTradeoffs = (scores: Scores) => {
  const ranked = [...METRIC_KEYS].sort(
    (left, right) => scores[right] - scores[left],
  )
  const toItem = (key: MetricKey) => ({
    key,
    label: METRIC_LABELS[key],
    value: scores[key],
  })

  return {
    gained: ranked.slice(0, 2).map(toItem),
    released: ranked.slice(-2).reverse().map(toItem),
  }
}

export const choicesSignature = (choices: Choices) =>
  CATEGORY_KEYS.map((key) => choices[key] ?? 'none').join('|')
