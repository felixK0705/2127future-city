import { runVerification } from '../src/lib/verify.ts'

try {
  const report = runVerification()
  console.log('検証に成功しました。')
  console.log(`組み合わせ: ${report.combinations}`)
  console.log(`軸スコア0: ${report.zeroAxisCombinations}`)
  console.log(`有効な類型: ${report.coveredArchetypes}/16`)
  console.log(`非決定的な再計算: ${report.nondeterministicCombinations}`)
  console.log(`街区・説明・市民番号の非決定的な再計算: ${report.nondeterministicArtifacts}`)
  console.log(`表示文の内部識別子・年号違反: ${report.visibleStringViolations}`)
  console.log('類型ごとの到達数:')
  for (const [id, count] of Object.entries(report.coverage)) {
    console.log(`  ${id}: ${count}`)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
