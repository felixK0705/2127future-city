import { hashString } from '../core-city'

export const ISSUE_YEAR = 2127

export const formatIssueDate = (visitDate: Date = new Date()): string =>
  `${ISSUE_YEAR}年${visitDate.getMonth() + 1}月${visitDate.getDate()}日`

/** 表示値から内部の類型コードを復元できない、決定的な市民番号です。 */
export const deriveCitizenNumber = (
  cityName: string,
  archetypeId: string,
): string => {
  const hash = hashString(`${cityName}::${archetypeId}`)
  const block = (hash & 0xffff).toString(16).toUpperCase().padStart(4, '0')
  const check = (((hash >>> 16) % 900) + 100).toString()
  return `${ISSUE_YEAR}-${block}-${check}`
}
