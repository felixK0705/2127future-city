import { useEffect, useMemo, useState } from 'react'
import { DioramaStage } from './components/Experience'
import { getArchetype } from './core-city'
import { scoreArchetype } from './lib/archetypeScoring'
import { ALL_ARCHETYPE_IDS } from './lib/axes'
import { enumerateCompleteChoices } from './lib/verify'
import { calculateScores } from './lib/scoring'
import type { ArchetypeId, CompleteChoices } from './types'

const WAIT_MS = 1200

const representatives = (() => {
  const map = {} as Record<ArchetypeId, CompleteChoices>
  for (const choices of enumerateCompleteChoices()) {
    const id = scoreArchetype(choices).archetypeId
    if (!map[id]) map[id] = choices
  }
  return map
})()

export function CaptureCities() {
  const [index, setIndex] = useState(0)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const id = ALL_ARCHETYPE_IDS[index]
  if (!id) throw new Error('アーキタイプ一覧が空です。')

  const choices = representatives[id]
  if (!choices) throw new Error(`類型の代表政策が見つかりません: ${id}`)

  const scores = useMemo(() => calculateScores(choices), [choices])
  const archetype = getArchetype(id)

  useEffect(() => {
    document.title = `capture ${index + 1}/${ALL_ARCHETYPE_IDS.length} ${id}`
    let cancelled = false
    const timer = window.setTimeout(async () => {
      const canvas = document.querySelector('.diorama-stage canvas')
      if (!(canvas instanceof HTMLCanvasElement) || cancelled) return
      const png = canvas.toDataURL('image/png')
      try {
        const response = await fetch('/api/save-city-capture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: archetype.id,
            cityName: archetype.cityName,
            png,
          }),
        })
        if (!response.ok) throw new Error(`保存に失敗しました: ${response.status}`)
        if (cancelled) return
        if (index + 1 < ALL_ARCHETYPE_IDS.length) {
          setIndex((current) => current + 1)
        } else {
          document.title = 'capture-done'
          setDone(true)
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : '保存に失敗しました。')
        }
      }
    }, WAIT_MS)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [archetype.cityName, archetype.id, id, index])

  return (
    <div className="capture-root" data-capture-id={id} data-capture-done={done ? '1' : '0'}>
      <DioramaStage scores={scores} archetypeId={id} />
      {error ? <p className="capture-status">{error}</p> : null}
    </div>
  )
}
