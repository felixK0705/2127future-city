import { findPolicy, POLICY_CATEGORIES } from '../data/policies.ts'
import type {
  ArchetypeId,
  AxisId,
  AxisScores,
  Choices,
  CompleteChoices,
} from '../types.ts'
import { AXIS_ORDER, getAxis, isArchetypeId } from './axes.ts'
import { isCompleteChoices } from './scoring.ts'

export type ArchetypeScoreResult = {
  readonly scores: AxisScores
  readonly archetypeId: ArchetypeId
}

const requireCompleteChoices = (choices: Choices): CompleteChoices => {
  if (!isCompleteChoices(choices)) {
    throw new Error('五つの政策をすべて選択してください。')
  }
  return choices
}

/**
 * 各軸は、その軸を担当する主政策（重み2）と移動政策（重み1）だけで決める。
 * 他軸向け lean も政策データに保持するが、ここでは主軸の因果を曖昧にしない。
 */
export const calculateAxisScores = (choices: Choices): AxisScores => {
  const complete = requireCompleteChoices(choices)
  const transport = findPolicy('transport', complete.transport)
  if (!transport) throw new Error('移動政策が見つかりません。')

  return Object.fromEntries(
    AXIS_ORDER.map((axisId) => {
      const mainCategory = POLICY_CATEGORIES.find(
        (category) => category.primaryAxis === axisId,
      )
      if (!mainCategory || mainCategory.weight !== 2) {
        throw new Error(`主政策の設定が不正です: ${axisId}`)
      }

      const mainPolicy = findPolicy(
        mainCategory.id,
        complete[mainCategory.id],
      )
      if (!mainPolicy) {
        throw new Error(`主政策が見つかりません: ${mainCategory.id}`)
      }

      const mainLean = mainPolicy.axisLeans[axisId]
      if (mainLean !== -1 && mainLean !== 1) {
        throw new Error(`主政策の傾きが不正です: ${mainPolicy.id}`)
      }

      const transportLean = transport.axisLeans[axisId] ?? 0
      const score = mainLean * mainCategory.weight + transportLean
      if (score === 0) {
        throw new Error(`軸スコアが0になりました: ${axisId}`)
      }
      return [axisId, score]
    }),
  ) as AxisScores
}

export const toArchetypeId = (scores: AxisScores): ArchetypeId => {
  const value = AXIS_ORDER.map((axisId: AxisId) => {
    const score = scores[axisId]
    if (score === 0) {
      throw new Error(`軸スコアが0のため判定できません: ${axisId}`)
    }
    const axis = getAxis(axisId)
    return score > 0 ? axis.positive.code : axis.negative.code
  }).join('')

  if (!isArchetypeId(value)) {
    throw new Error(`生成された類型IDが不正です: ${value}`)
  }
  return value
}

export const scoreArchetype = (choices: Choices): ArchetypeScoreResult => {
  const scores = calculateAxisScores(choices)
  return { scores, archetypeId: toArchetypeId(scores) }
}
