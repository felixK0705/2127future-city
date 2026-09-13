import { useEffect, useState } from 'react'
import { createCanvasDiorama, getArchetype, tuneDioramaWithScores, archetypeToDiorama } from './core-city'
import { scoreArchetype } from './lib/archetypeScoring'
import { ALL_ARCHETYPE_IDS } from './lib/axes'
import { enumerateCompleteChoices } from './lib/verify'
import { calculateScores } from './lib/scoring'
import type { ArchetypeId, CompleteChoices } from './types'

const ANGLES = [
  { key: '0', label: '0°', rot: 0 },
  { key: '90', label: '90°', rot: Math.PI / 2 },
  { key: '180', label: '180°', rot: Math.PI },
] as const

const representatives = (() => {
  const map = {} as Record<ArchetypeId, CompleteChoices>
  for (const choices of enumerateCompleteChoices()) {
    const id = scoreArchetype(choices).archetypeId
    if (!map[id]) map[id] = choices
  }
  return map
})()

type AngleKey = (typeof ANGLES)[number]['key']

type CityRow = {
  readonly id: ArchetypeId
  readonly cityName: string
  readonly shots: Record<AngleKey, string>
  readonly sat: Record<AngleKey, number>
  readonly delta: number
}

function sampleSaturation(dataUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      const scale = 160
      canvas.width = scale
      canvas.height = Math.max(1, Math.round((image.height / image.width) * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(0)
        return
      }
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
      let sat = 0
      let count = 0
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]!
        const g = data[i + 1]!
        const b = data[i + 2]!
        const max = Math.max(r, g, b)
        const min = Math.min(r, g, b)
        if (max > 238 && min > 226) continue
        sat += max === 0 ? 0 : (max - min) / max
        count += 1
      }
      resolve(count ? sat / count : 0)
    }
    image.onerror = () => resolve(0)
    image.src = dataUrl
  })
}

export function AuditCities() {
  const [rows, setRows] = useState<CityRow[]>([])
  const [status, setStatus] = useState('準備中')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const canvas = document.createElement('canvas')
      const next: CityRow[] = []
      for (let i = 0; i < ALL_ARCHETYPE_IDS.length; i += 1) {
        const id = ALL_ARCHETYPE_IDS[i]!
        const choices = representatives[id]
        if (!choices) throw new Error(`類型の代表政策が見つかりません: ${id}`)
        const archetype = getArchetype(id)
        setStatus(`${i + 1}/${ALL_ARCHETYPE_IDS.length} ${archetype.cityName}`)
        await new Promise((resolve) => requestAnimationFrame(resolve))
        if (cancelled) return

        const scores = calculateScores(choices)
        const handle = createCanvasDiorama({
          canvas,
          config: tuneDioramaWithScores(archetypeToDiorama(archetype), scores),
          width: 720,
          height: 480,
        })
        handle.setPaused(true)
        const shots = {} as Record<AngleKey, string>
        const sat = {} as Record<AngleKey, number>
        for (const angle of ANGLES) {
          handle.setView(angle.rot)
          shots[angle.key] = handle.snapshot()
          sat[angle.key] = await sampleSaturation(shots[angle.key])
        }
        handle.destroy()
        const delta = Math.max(
          Math.abs(sat['90'] - sat['0']),
          Math.abs(sat['180'] - sat['0']),
          Math.abs(sat['180'] - sat['90']),
        )
        next.push({ id, cityName: archetype.cityName, shots, sat, delta })
        if (!cancelled) setRows([...next])
      }
      if (!cancelled) setStatus('完了')
    }
    run().catch((caught: unknown) => {
      if (!cancelled) setError(caught instanceof Error ? caught.message : '検査に失敗しました。')
    })
    return () => {
      cancelled = true
    }
  }, [])

  const flagged = rows.filter((row) => row.delta > 0.045)

  return (
    <div className="audit-root">
      <header className="audit-head">
        <p>都市模型の角度検査</p>
        <strong>{status}</strong>
        {flagged.length > 0 ? (
          <span className="audit-flag">彩度差あり {flagged.map((row) => row.id).join(' / ')}</span>
        ) : rows.length === ALL_ARCHETYPE_IDS.length ? (
          <span>16都市、0° / 90° / 180° の彩度差は許容範囲</span>
        ) : null}
        {error ? <span className="audit-flag">{error}</span> : null}
      </header>
      <div className="audit-grid">
        {rows.map((row) => (
          <article key={row.id} className={`audit-card${row.delta > 0.045 ? ' is-flagged' : ''}`}>
            <h2>
              {row.id} {row.cityName}
              <small>Δsat {row.delta.toFixed(3)}</small>
            </h2>
            <div className="audit-shots">
              {ANGLES.map((angle) => (
                <figure key={angle.key}>
                  <img src={row.shots[angle.key]} alt={`${row.cityName} ${angle.label}`} />
                  <figcaption>
                    {angle.label} sat {row.sat[angle.key].toFixed(3)}
                  </figcaption>
                </figure>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
