import { POLICY_CATEGORIES } from '../data/policies.ts'
import {
  CATEGORY_KEYS,
  type ArchetypeId,
  type Choices,
  type CompleteChoices,
} from '../types.ts'
import { scoreArchetype } from './archetypeScoring.ts'
import { ALL_ARCHETYPE_IDS, isArchetypeId } from './axes.ts'
import { calculateScores, isCompleteChoices } from './scoring.ts'
import { archetypeToDiorama, buildDioramaLayout, getArchetype, tuneDioramaWithScores } from '../core-city/index.ts'
import { buildStaticWhy } from './explanation.ts'
import { deriveCitizenNumber } from './citizenCard.ts'

export type VerificationReport = {
  readonly combinations: number
  readonly zeroAxisCombinations: number
  readonly invalidArchetypeIds: number
  readonly coveredArchetypes: number
  readonly missingArchetypes: readonly ArchetypeId[]
  readonly nondeterministicCombinations: number
  readonly nondeterministicArtifacts: number
  readonly visibleStringViolations: number
  readonly coverage: Readonly<Record<ArchetypeId, number>>
}

export const enumerateCompleteChoices = (): readonly CompleteChoices[] => {
  const combinations: CompleteChoices[] = []

  const visit = (index: number, choices: Choices): void => {
    if (index === CATEGORY_KEYS.length) {
      if (!isCompleteChoices(choices)) {
        throw new Error('完全な政策組み合わせを生成できませんでした。')
      }
      combinations.push({ ...choices })
      return
    }

    const categoryId = CATEGORY_KEYS[index]
    if (!categoryId) throw new Error('政策カテゴリの順序が不正です。')
    const category = POLICY_CATEGORIES.find((item) => item.id === categoryId)
    if (!category) throw new Error(`政策カテゴリが見つかりません: ${categoryId}`)

    for (const policy of category.policies) {
      visit(index + 1, { ...choices, [categoryId]: policy.id })
    }
  }

  visit(0, {})
  return combinations
}

export const runVerification = (): VerificationReport => {
  const combinations = enumerateCompleteChoices()
  const coverage = Object.fromEntries(
    ALL_ARCHETYPE_IDS.map((id) => [id, 0]),
  ) as Record<ArchetypeId, number>

  let zeroAxisCombinations = 0
  let invalidArchetypeIds = 0
  let nondeterministicCombinations = 0
  let nondeterministicArtifacts = 0
  let visibleStringViolations = 0

  for (const choices of combinations) {
    const firstScores = calculateScores(choices)
    const firstArchetype = scoreArchetype(choices)

    if (Object.values(firstArchetype.scores).some((score) => score === 0)) {
      zeroAxisCombinations += 1
    }
    if (!isArchetypeId(firstArchetype.archetypeId)) {
      invalidArchetypeIds += 1
    } else {
      coverage[firstArchetype.archetypeId] += 1
    }

    const secondScores = calculateScores(choices)
    const secondArchetype = scoreArchetype(choices)
    if (
      JSON.stringify(firstScores) !== JSON.stringify(secondScores) ||
      JSON.stringify(firstArchetype) !== JSON.stringify(secondArchetype)
    ) {
      nondeterministicCombinations += 1
    }

    const archetype = getArchetype(firstArchetype.archetypeId)
    const config = tuneDioramaWithScores(archetypeToDiorama(archetype), firstScores)
    const firstArtifacts = {
      layout: buildDioramaLayout(config),
      why: buildStaticWhy(choices, archetype),
      citizenNumber: deriveCitizenNumber('余白市', firstArchetype.archetypeId),
    }
    const secondArtifacts = {
      layout: buildDioramaLayout(config),
      why: buildStaticWhy(choices, archetype),
      citizenNumber: deriveCitizenNumber('余白市', firstArchetype.archetypeId),
    }
    if (JSON.stringify(firstArtifacts) !== JSON.stringify(secondArtifacts)) {
      nondeterministicArtifacts += 1
    }
    const visible = JSON.stringify({
      cityName: archetype.cityName,
      title: archetype.title,
      tagline: archetype.tagline,
      society: archetype.society,
      why: firstArtifacts.why,
      citizenNumber: firstArtifacts.citizenNumber,
    })
    if (visible.includes(firstArchetype.archetypeId) || visible.includes('2126')) {
      visibleStringViolations += 1
    }
  }

  const missingArchetypes = ALL_ARCHETYPE_IDS.filter(
    (id) => coverage[id] === 0,
  )
  const report: VerificationReport = {
    combinations: combinations.length,
    zeroAxisCombinations,
    invalidArchetypeIds,
    coveredArchetypes: ALL_ARCHETYPE_IDS.length - missingArchetypes.length,
    missingArchetypes,
    nondeterministicCombinations,
    nondeterministicArtifacts,
    visibleStringViolations,
    coverage,
  }

  const failures: string[] = []
  if (report.combinations !== 243) {
    failures.push(`組み合わせ数: ${report.combinations}（期待値243）`)
  }
  if (report.zeroAxisCombinations > 0) {
    failures.push(`軸スコア0の組み合わせ: ${report.zeroAxisCombinations}`)
  }
  if (report.invalidArchetypeIds > 0) {
    failures.push(`不正な類型ID: ${report.invalidArchetypeIds}`)
  }
  if (report.missingArchetypes.length > 0) {
    failures.push(`未到達の類型: ${report.missingArchetypes.join(', ')}`)
  }
  if (report.nondeterministicCombinations > 0) {
    failures.push(`非決定的な再計算: ${report.nondeterministicCombinations}`)
  }
  if (report.nondeterministicArtifacts > 0) {
    failures.push(`街区・説明・市民番号の非決定的な再計算: ${report.nondeterministicArtifacts}`)
  }
  if (report.visibleStringViolations > 0) {
    failures.push(`表示文の内部識別子または年号違反: ${report.visibleStringViolations}`)
  }
  if (failures.length > 0) {
    throw new Error(`検証に失敗しました。\n${failures.join('\n')}`)
  }

  return report
}
