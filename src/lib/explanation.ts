import type { Archetype } from '../core-city'
import { POLICY_CATEGORIES, findPolicy } from '../data/policies'
import type { Choices } from '../types'

export type StaticWhy = {
  policyLines: readonly {
    category: string
    title: string
    consequence: string
  }[]
  citySignatures: readonly {
    cause: string
    effect: string
  }[]
}

/** 同じ五つの選択と類型から、常に同じ静的な因果説明を返します。 */
export const buildStaticWhy = (
  choices: Choices,
  archetype: Archetype,
): StaticWhy => ({
  policyLines: POLICY_CATEGORIES.map((category) => {
    const policy = findPolicy(category.id, choices[category.id] ?? '')
    return {
      category: category.label,
      title: policy?.title ?? '未選択',
      consequence: policy?.consequence ?? 'この政策は選択されていません。',
    }
  }),
  citySignatures: archetype.causality.map(({ cause, effect }) => ({ cause, effect })),
})
