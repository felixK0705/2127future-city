import type { Archetype, ArchetypeId } from '../types';
import { CLOSED_SOCIETIES } from './closedSocieties';
import { OPEN_SOCIETIES } from './openSocieties';

/** 16 個固定アーキタイプ。順序は正極優先で固定。 */
export const ARCHETYPES: readonly Archetype[] = [...OPEN_SOCIETIES, ...CLOSED_SOCIETIES];

const EXPECTED_IDS = [
  'OFEC', 'OFED', 'OFGC', 'OFGD',
  'OSEC', 'OSED', 'OSGC', 'OSGD',
  'LFEC', 'LFED', 'LFGC', 'LFGD',
  'LSEC', 'LSED', 'LSGC', 'LSGD',
] as const satisfies readonly ArchetypeId[];

const REGISTRY = new Map<ArchetypeId, Archetype>(ARCHETYPES.map((archetype) => [archetype.id, archetype]));

/** 驗證 16 型完整性、ID 與顯示名稱唯一性。 */
export function validateArchetypeDataset(): void {
  const problems: string[] = [];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const seenTitles = new Set<string>();
  const seenLandmarkNames = new Set<string>();

  if (ARCHETYPES.length !== EXPECTED_IDS.length) {
    problems.push(`アーキタイプ数が ${ARCHETYPES.length} 件（期待値 ${EXPECTED_IDS.length} 件）`);
  }
  for (const id of EXPECTED_IDS) {
    if (!REGISTRY.has(id)) problems.push(`未定義のアーキタイプ: ${id}`);
  }
  for (const archetype of ARCHETYPES) {
    if (seenIds.has(archetype.id)) problems.push(`ID が重複: ${archetype.id}`);
    seenIds.add(archetype.id);
    if (seenNames.has(archetype.cityName)) problems.push(`都市名が重複: ${archetype.cityName}`);
    seenNames.add(archetype.cityName);
    if (seenTitles.has(archetype.title)) problems.push(`称号が重複: ${archetype.title}`);
    seenTitles.add(archetype.title);
    if (archetype.causality.length < 3 || archetype.causality.length > 5) {
      problems.push(`${archetype.id}: 因果の項目数が 3〜5 の範囲外（${archetype.causality.length}）`);
    }
    if (archetype.visual.landmarks.length < 2 || archetype.visual.landmarks.length > 3) {
      problems.push(`${archetype.id}: ランドマーク数が 2〜3 の範囲外（${archetype.visual.landmarks.length}）`);
    }
    for (const landmark of archetype.visual.landmarks) {
      if (seenLandmarkNames.has(landmark.name)) problems.push(`ランドマーク名が重複: ${landmark.name}`);
      seenLandmarkNames.add(landmark.name);
    }
  }
  if (problems.length > 0) {
    throw new Error(`アーキタイプデータセットの不整合:\n - ${problems.join('\n - ')}`);
  }
}

/** ID からアーキタイプを取得する。 */
export function getArchetype(id: ArchetypeId): Archetype {
  const archetype = REGISTRY.get(id);
  if (!archetype) throw new Error(`未定義のアーキタイプ: ${id}`);
  return archetype;
}

export { OPEN_SOCIETIES, CLOSED_SOCIETIES };
