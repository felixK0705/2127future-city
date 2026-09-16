import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import gsap from 'gsap'
import {
  accentForArchetype,
  archetypeToDiorama,
  createCanvasDiorama,
  getArchetype,
  tuneDioramaWithScores,
  type Archetype,
} from '../core-city'
import { POLICY_CATEGORIES, findPolicy } from '../data/policies'
import { CATEGORY_ICONS, METRIC_LABELS, UI_COPY } from '../data/copy'
import { useEnter } from '../hooks/useEnter'
import { calculateScores, getTradeoffs } from '../lib/scoring'
import { buildStaticWhy } from '../lib/explanation'
import {
  aggregateChoices,
  collectiveAverage,
  countSameArchetype,
  getCollectiveSubmissions,
  subscribeToCollective,
} from '../services/collectiveStore'
import { createShareUrl, deriveCitizenNumber, downloadReport } from '../services/report'
import { METRIC_KEYS, type ArchetypeId, type CategoryKey, type Choices, type Scores } from '../types'

const metricLabels = METRIC_LABELS as Record<string, string>
const categoryIcons = CATEGORY_ICONS as Record<string, string>
/** shortened so the five-column readouts stay on one line each */
const metricShort: Record<string, string> = { ...metricLabels, diversity: '多様性' }

/** Material Symbols glyph. Decorative only: labels always accompany it. */
function Icon({ name }: { name: string }) {
  return <span className="icon" aria-hidden="true">{name}</span>
}

/** the weakest indicator is the one printed in red — nothing is weakest at a tie */
function lowestMetric(scores: Scores) {
  const low = METRIC_KEYS.reduce((worst, key) => (scores[key] < scores[worst] ? key : worst), METRIC_KEYS[0])
  return METRIC_KEYS.some((key) => scores[key] > scores[low]) ? low : null
}

export function RadarChart({
  scores,
  compact = false,
  label = '都市指標のレーダーチャート',
}: {
  scores: Scores
  compact?: boolean
  label?: string
}) {
  const size = compact ? 300 : 360
  const center = size / 2
  // kept well inside the box: 「文化的多様性」 needs real room beside the left axis
  const radius = size * 0.31
  const point = (index: number, value: number) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / METRIC_KEYS.length
    const distance = radius * (value / 100)
    return `${center + Math.cos(angle) * distance},${center + Math.sin(angle) * distance}`
  }
  const polygon = METRIC_KEYS.map((key, index) => point(index, scores[key])).join(' ')

  return (
    <figure className={`radar ${compact ? 'radar--compact' : ''}`} aria-label={label}>
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        {[25, 50, 75, 100].map((level) => (
          <polygon
            key={level}
            className="radar__grid"
            points={METRIC_KEYS.map((_, index) => point(index, level)).join(' ')}
          />
        ))}
        {METRIC_KEYS.map((key, index) => {
          const end = point(index, 100).split(',')
          const text = point(index, 118).split(',')
          return (
            <g key={key}>
              <line className="radar__axis" x1={center} y1={center} x2={end[0]} y2={end[1]} />
              <text x={text[0]} y={text[1]} textAnchor="middle">
                {metricLabels[key]}
              </text>
            </g>
          )
        })}
        <polygon className="radar__value" points={polygon} />
        {METRIC_KEYS.map((key, index) => {
          const dot = point(index, scores[key]).split(',')
          return <circle key={key} cx={dot[0]} cy={dot[1]} r="4" />
        })}
      </svg>
      <figcaption className="sr-only">
        {METRIC_KEYS.map((key) => `${metricLabels[key]}は${scores[key]}です。`).join('')}
      </figcaption>
    </figure>
  )
}

function BlueprintCity({ scores }: { scores: Scores }) {
  const heights = METRIC_KEYS.map((key) => 46 + scores[key] * 1.35)
  return (
    <svg className="city-svg" viewBox="0 0 800 460" role="img" aria-label="選択から生まれる未来都市の模型">
      <defs>
        <linearGradient id="city-sky" x1="0" y1="0" x2="0" y2="1">
          <stop className="city-svg__sky-top" offset="0" />
          <stop className="city-svg__sky-base" offset="1" />
        </linearGradient>
      </defs>
      <rect width="800" height="460" fill="url(#city-sky)" />
      <path className="city-svg__sun" d="M620 55a54 54 0 1 0 1 0Z" />
      <path className="city-svg__land" d="M0 370Q160 305 320 362T800 332V460H0Z" />
      {heights.map((height, index) => {
        const x = 80 + index * 132
        const y = 382 - height
        return (
          <g key={METRIC_KEYS[index]}>
            <rect className="city-svg__building" x={x} y={y} width={82} height={height} rx="3" />
            {[0, 1, 2].map((row) => (
              <g key={row}>
                <rect className="city-svg__window" x={x + 15} y={y + 18 + row * 34} width="14" height="14" />
                <rect className="city-svg__window" x={x + 52} y={y + 18 + row * 34} width="14" height="14" />
              </g>
            ))}
          </g>
        )
      })}
      <path className="city-svg__rail" d="M0 405C180 345 350 430 800 365" />
    </svg>
  )
}

export type DioramaStageHandle = {
  snapshot: () => string | null
  setPaused: (paused: boolean) => void
}

type DioramaController = {
  snapshot?: () => string | null
  setPaused?: (paused: boolean) => void
  resize?: (width: number, height: number) => void
  destroy?: () => void
}

export const DioramaStage = forwardRef<DioramaStageHandle, { scores: Scores; archetypeId: string; onReady?: () => void }>(
  function DioramaStage({ scores, archetypeId, onReady }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const stageRef = useRef<HTMLDivElement>(null)
    const controllerRef = useRef<DioramaController | null>(null)
    const onReadyRef = useRef(onReady)
    onReadyRef.current = onReady
    const [fallback, setFallback] = useState(false)
    // scores is a fresh object on every render, so rebuild on the values only
    const scoreKey = METRIC_KEYS.map((key) => scores[key]).join(',')

    useEffect(() => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const stage = stageRef.current
      if (reduced || !canvasRef.current || !stage) {
        setFallback(true)
        onReadyRef.current?.()
        return
      }
      try {
        const archetype = getArchetype(archetypeId as ArchetypeId)
        const plan = tuneDioramaWithScores(archetypeToDiorama(archetype), scores)
        controllerRef.current = createCanvasDiorama({
          canvas: canvasRef.current,
          config: plan,
          width: Math.max(320, stage.clientWidth),
          height: Math.max(240, stage.clientHeight),
        }) as DioramaController
        onReadyRef.current?.()
        // observe the stage, not the canvas: the renderer writes inline px sizes
        // onto the canvas, so observing it would freeze the size at first paint.
        let skipFirst = true
        const observer = new ResizeObserver(([entry]) => {
          if (!entry) return
          if (skipFirst) {
            skipFirst = false
            return
          }
          controllerRef.current?.resize?.(entry.contentRect.width, entry.contentRect.height)
        })
        observer.observe(stage)
        return () => {
          observer.disconnect()
          controllerRef.current?.destroy?.()
        }
      } catch {
        setFallback(true)
        onReadyRef.current?.()
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [archetypeId, scoreKey])

    useImperativeHandle(ref, () => ({
      snapshot: () => {
        if (fallback) return null
        return controllerRef.current?.snapshot?.() ?? canvasRef.current?.toDataURL('image/png') ?? null
      },
      setPaused: (paused) => controllerRef.current?.setPaused?.(paused),
    }), [fallback])

    return (
      <div className="diorama-stage" ref={stageRef}>
        {fallback ? (
          <BlueprintCity scores={scores} />
        ) : (
          <canvas ref={canvasRef} aria-label="選択から生まれた未来都市の動く模型" />
        )}
      </div>
    )
  },
)

export function CityVisualization({
  scores,
  archetypeId,
  onReady,
}: {
  scores: Scores
  archetypeId: string
  onReady?: () => void
}) {
  return <DioramaStage scores={scores} archetypeId={archetypeId} onReady={onReady} />
}

/** the five indicators as a plain label/number list, weakest one in red */
function MetricRows({ scores }: { scores: Scores }) {
  const low = lowestMetric(scores)
  return (
    <dl className="metric-rows">
      {METRIC_KEYS.map((key) => (
        <div key={key}>
          <dt>{metricLabels[key]}</dt>
          <dd className={key === low ? 'is-low' : ''}>{scores[key]}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Intro({
  nickname,
  setNickname,
  onStart,
}: {
  nickname: string
  setNickname: (name: string) => void
  onStart: () => void
}) {
  const ref = useEnter<HTMLElement>('intro')
  const canStart = nickname.trim().length > 0
  return (
    <main className="screen intro" id="main-content" ref={ref}>
      <header className="topbar">
        <a className="brand" href="#intro-title" aria-label="2127"><span>2127</span></a>
      </header>
      <section className="intro__card panel">
        <p className="eyebrow eyebrow--latin" data-enter>Future City Designer</p>
        <h1 id="intro-title" data-enter>未来は、選択の<br />積み重ねでできている。</h1>
        <p className="lede" data-enter>5つの政策を選び、あなたの未来都市を設計します。</p>
        <div className="intro__field" data-enter>
          <label className="sr-only" htmlFor="nickname">{UI_COPY.intro.nickname}</label>
          <input
            id="nickname"
            name="nickname"
            type="text"
            autoComplete="nickname"
            required
            aria-required="true"
            placeholder={UI_COPY.intro.nickname}
            maxLength={16}
            value={nickname}
            onChange={(event) => setNickname(event.target.value.slice(0, 16))}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && canStart) onStart()
            }}
          />
        </div>
        <button className="button button--primary button--large" disabled={!canStart} onClick={onStart} data-enter>
          <span>未来都市を設計する</span>
          <Icon name="arrow_forward" />
        </button>
      </section>
    </main>
  )
}

export function PolicyFlow({
  choices,
  step,
  onStepChange,
  onChoose,
  onComplete,
}: {
  choices: Choices
  step: number
  onStepChange: (step: number) => void
  onChoose: (category: CategoryKey, policy: string) => void
  onComplete: (category: CategoryKey, policy: string) => void
}) {
  const category = POLICY_CATEGORIES[step]!
  const selected = choices[category.id]
  const scores = calculateScores(choices)
  const [transitioning, setTransitioning] = useState(false)
  const policyRefs = useRef<Array<HTMLButtonElement | null>>([])
  useEffect(() => setTransitioning(false), [step])
  const selectPolicy = (policyId: string) => {
    if (transitioning) return
    setTransitioning(true)
    onChoose(category.id, policyId)
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180
    window.setTimeout(() => {
      if (step === POLICY_CATEGORIES.length - 1) onComplete(category.id, policyId)
      else onStepChange(step + 1)
    }, delay)
  }
  const movePolicyFocus = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = category.policies.length - 1
    let next = index
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = index === last ? 0 : index + 1
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = index === 0 ? last : index - 1
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = last
    else return
    event.preventDefault()
    const policy = category.policies[next]
    if (policy) {
      onChoose(category.id, policy.id)
      policyRefs.current[next]?.focus()
    }
  }

  const ref = useEnter<HTMLElement>(step)

  return (
    <main className="screen policy-screen" id="main-content" ref={ref}>
      <header className="topbar">
        <div className="brand"><span>2127</span></div>
        <div className="progress" aria-label={`全5問のうち第${step + 1}問です。`}>
          <span>{String(step + 1).padStart(2, '0')} / 05</span>
          <div>{POLICY_CATEGORIES.map((item, index) => <i key={item.id} className={index <= step ? 'is-active' : ''} />)}</div>
        </div>
      </header>
      <div className="policy-layout">
        <section aria-labelledby="question-title">
          <p className="eyebrow" data-enter><Icon name={categoryIcons[category.id] ?? 'balance'} />{category.label}</p>
          <h1 id="question-title" data-enter>{category.prompt}</h1>
          <div className="policy-options" role="radiogroup" aria-label={`${category.label}の方針`} aria-busy={transitioning}>
            {category.policies.map((policy, index) => {
              const active = selected === policy.id
              return (
                <button
                  type="button"
                  key={policy.id}
                  className={`policy-card ${active ? 'is-selected' : ''}`}
                  role="radio"
                  aria-checked={active}
                  disabled={transitioning}
                  tabIndex={active || (!selected && index === 0) ? 0 : -1}
                  ref={(node) => { policyRefs.current[index] = node }}
                  onKeyDown={(event) => movePolicyFocus(event, index)}
                  onClick={() => selectPolicy(policy.id)}
                  data-enter
                >
                  <Icon name={active ? 'check_circle' : 'radio_button_unchecked'} />
                  <strong>{policy.title}</strong>
                  <span>{policy.description}</span>
                </button>
              )
            })}
          </div>
          <nav className="policy-nav" aria-label="質問の移動">
            <button className="back-button" disabled={step === 0 || transitioning} onClick={() => onStepChange(step - 1)}>
              <Icon name="arrow_back" />
              <span>戻る</span>
            </button>
          </nav>
        </section>
        <aside className="live-panel panel" aria-labelledby="live-title" data-enter>
          <h2 id="live-title">都市のバランス</h2>
          <RadarChart scores={scores} compact />
          <MetricRows scores={scores} />
        </aside>
      </div>
    </main>
  )
}

export function TimeJump({
  onArrive,
  onDismiss,
  cityReady = false,
}: {
  onArrive: () => void
  onDismiss?: () => void
  cityReady?: boolean
}) {
  const [covering, setCovering] = useState(false)
  const screenRef = useRef<HTMLDivElement>(null)
  const veilRef = useRef<HTMLDivElement>(null)
  const orbRef = useRef<HTMLDivElement>(null)
  const yearRef = useRef<HTMLElement>(null)
  const coveringRef = useRef(false)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0
    let hold = 0
    let coverTween: gsap.core.Tween | undefined
    let cancelled = false
    let shownYear = 2027

    const writeYear = (year: number) => {
      if (!yearRef.current || year === shownYear) return
      shownYear = year
      yearRef.current.textContent = String(year)
    }

    const cover = () => {
      if (cancelled || coveringRef.current) return
      writeYear(2127)
      const reveal = () => {
        coveringRef.current = true
        setCovering(true)
        onArrive()
      }
      if (reduced) {
        reveal()
        return
      }
      coverTween = gsap.to(veilRef.current, {
        opacity: 1,
        duration: 0.16,
        ease: 'power2.inOut',
        onComplete: reveal,
      })
    }

    if (reduced) {
      writeYear(2127)
      hold = window.setTimeout(cover, 160)
      return () => {
        cancelled = true
        window.clearTimeout(hold)
        coverTween?.kill()
      }
    }

    const started = performance.now()
    const tick = (now: number) => {
      if (cancelled) return
      const raw = Math.min(1, Math.max(0, (now - started) / 2000))
      const eased = 1 - (1 - raw) ** 3
      writeYear(Math.round(2027 + 100 * eased))
      if (raw < 1) frame = requestAnimationFrame(tick)
      else hold = window.setTimeout(cover, 80)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      window.clearTimeout(hold)
      coverTween?.kill()
    }
  }, [onArrive])

  useEffect(() => {
    if (!covering) return
    if (!cityReady) {
      const timeout = window.setTimeout(() => onDismiss?.(), 560)
      return () => window.clearTimeout(timeout)
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onDismiss?.()
      return
    }
    const leave = gsap.timeline({ onComplete: () => onDismiss?.() })
    leave.to(orbRef.current, { opacity: 0, duration: 0.32, ease: 'power2.out' })
    leave.to(screenRef.current, { opacity: 0, duration: 0.28, ease: 'power2.out' }, '<')
    return () => {
      leave.kill()
    }
  }, [covering, cityReady, onDismiss])

  return (
    <div
      className="screen time-jump"
      id={covering ? undefined : 'main-content'}
      role={covering ? undefined : 'main'}
      aria-hidden={covering || undefined}
      ref={screenRef}
    >
      <div className="time-jump__veil" ref={veilRef} />
      <div className="time-jump__orb" ref={orbRef}>
        <p className="eyebrow"><Icon name="flight_takeoff" />100年後へ</p>
        <strong ref={yearRef}>2027</strong>
      </div>
    </div>
  )
}

export function CityReveal({
  cityName,
  title,
  nickname,
  scores,
  archetypeId,
  onContinue,
  onReady,
}: {
  cityName: string
  title: string
  nickname: string
  scores: Scores
  archetypeId: string
  onContinue: () => void
  onReady?: () => void
}) {
  const tradeoffs = getTradeoffs(scores)
  return (
    <main className="screen reveal-screen" id="main-content">
      <div className="reveal__stage">
        <CityVisualization scores={scores} archetypeId={archetypeId} onReady={onReady} />
      </div>
      <section className="reveal__bar panel">
        <div>
          <p className="eyebrow"><Icon name="location_city" />{UI_COPY.reveal.owner(nickname)}</p>
          <h1>{cityName}</h1>
          <p className="lede">{title}</p>
        </div>
        <dl className="tradeoff-rows">
          <div>
            <dt>得たもの</dt>
            <dd>{tradeoffs.gained.map((item) => item.label).join('・')}</dd>
          </div>
          <div>
            <dt>課題</dt>
            <dd className="is-cost">{tradeoffs.released.map((item) => item.label).join('・')}</dd>
          </div>
        </dl>
        <button className="button button--primary" onClick={onContinue}>
          <span>理由を見る</span>
          <Icon name="arrow_forward" />
        </button>
      </section>
    </main>
  )
}

export function WhyPanel({
  choices,
  scores,
  archetype,
  onContinue,
}: {
  choices: Choices
  scores: Scores
  archetype: Archetype
  onContinue: () => void
}) {
  const tradeoffs = getTradeoffs(scores)
  const why = buildStaticWhy(choices, archetype)
  const ref = useEnter<HTMLElement>('why')
  return (
    <main className="screen why-screen" id="main-content" ref={ref}>
      <header className="section-heading">
        <p className="eyebrow" data-enter><Icon name="link" />制度から暮らしへの因果</p>
        <h1 data-enter>なぜ、この都市になったのでしょうか。</h1>
      </header>
      <section className="causal-grid">
        {why.policyLines.map((line, index) => (
          <article className="panel panel--quiet" key={line.category} data-enter>
            <span><Icon name={categoryIcons[POLICY_CATEGORIES[index]?.id ?? ''] ?? 'balance'} />{line.category}</span>
            <h2>{line.title}</h2>
            <p>{line.consequence}</p>
          </article>
        ))}
      </section>
      <section className="tradeoffs">
        <article className="panel panel--quiet" data-enter><span>伸びた価値</span><strong>{tradeoffs.gained.map((item) => item.label).join('・')}</strong></article>
        <article className="panel panel--quiet" data-enter><span>残された課題</span><strong>{tradeoffs.released.map((item) => item.label).join('・')}</strong></article>
      </section>
      <div className="center-action">
        <button className="button button--primary" onClick={onContinue} data-enter>
          <span>都市カードをつくる</span>
          <Icon name="arrow_forward" />
        </button>
      </div>
    </main>
  )
}

export function CollectiveBoard({
  scores,
  choices,
  archetypeId,
}: {
  scores: Scores
  choices: Choices
  archetypeId: string
}) {
  const [submissions, setSubmissions] = useState(() => getCollectiveSubmissions())
  useEffect(() => subscribeToCollective(() => setSubmissions([...getCollectiveSubmissions()])), [])
  const average = collectiveAverage(submissions)
  const total = submissions.length
  const aggregates = aggregateChoices(submissions)
  const sameType = countSameArchetype(archetypeId as ArchetypeId, submissions)
  const typeCounts = new Map<string, number>()
  submissions.forEach((item) => typeCounts.set(item.archetypeId, (typeCounts.get(item.archetypeId) ?? 0) + 1))

  return (
    <section className="collective" aria-labelledby="collective-title">
      <div>
        <p className="eyebrow">みんなの未来都市</p>
        <h2 id="collective-title">未来を設計した人数：{total}人</h2>
        <p className="same-type">あなたと同じ種類の未来：<strong>{sameType}人</strong></p>
        <div className="type-dots" aria-label="十六種類の未来都市の分布">
          {[...typeCounts.values(), ...Array(Math.max(0, 16 - typeCounts.size)).fill(0)].slice(0, 16).map((count, index) => (
            <i key={index} style={{ opacity: count ? Math.min(1, .35 + count / total) : .16 }} />
          ))}
        </div>
      </div>
      <div className="collective__charts">
        <div><span>あなたの都市</span><RadarChart scores={scores} compact label="あなたの都市指標" /></div>
        <div><span>みんなの平均</span><RadarChart scores={average} compact label="みんなの都市指標の平均" /></div>
      </div>
      <div className="policy-percentages">
        {POLICY_CATEGORIES.map((category) => {
          const selected = choices[category.id] ?? ''
          const count = aggregates[category.id][selected] ?? 0
          const percent = Math.round((count / Math.max(1, total)) * 100)
          return (
            <div key={category.id}>
              <span>{category.label}「{findPolicy(category.id, selected)?.title}」</span>
              <strong>{percent}%</strong>
              <i><b style={{ width: `${percent}%` }} /></i>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function Souvenir({
  cityName,
  setCityName,
  title,
  typeName,
  archetypeId,
  choices,
  scores,
  onRestart,
}: {
  cityName: string
  setCityName: (name: string) => void
  title: string
  typeName: string
  archetypeId: string
  choices: Choices
  scores: Scores
  onRestart: () => void
}) {
  const [back, setBack] = useState(false)
  const [message, setMessage] = useState('')
  const ref = useEnter<HTMLElement>('souvenir')
  const dioramaRef = useRef<DioramaStageHandle>(null)
  const citizenNumber = deriveCitizenNumber(cityName.trim() || '余白市', archetypeId)
  const numberParts = citizenNumber.split('-')
  const passNumber = `NO. ${numberParts[0]}-${numberParts[numberParts.length - 1]}`
  const issueDate = `2127年${new Date().getMonth() + 1}月${new Date().getDate()}日`
  const tradeoffs = getTradeoffs(scores)
  useEffect(() => {
    dioramaRef.current?.setPaused(true)
    return () => dioramaRef.current?.setPaused(false)
  }, [])
  const share = async () => {
    const url = createShareUrl({ cityName, choices })
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${cityName}｜2127 未来都市デザイナー`,
          text: '私が設計した2127年の都市です。',
          url,
        })
        setMessage('未来都市を共有しました。')
      } else {
        await navigator.clipboard.writeText(url)
        setMessage('共有用のURLをコピーしました。')
      }
    } catch {
      setMessage('URLをコピーできませんでした。アドレス欄からコピーしてください。')
    }
  }
  const save = async () => {
    try {
      const cityAccent = accentForArchetype(archetypeId).primary
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760"><defs><linearGradient id="sky" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f3f3f4"/><stop offset="1" stop-color="#e2e2e4"/></linearGradient></defs><rect width="1200" height="760" fill="url(#sky)"/><path d="M0 650Q250 500 500 620T1200 520V760H0Z" fill="#d8d8da"/><circle cx="930" cy="140" r="80" fill="${cityAccent}" opacity="0.5"/><g fill="#ffffff">${METRIC_KEYS.map((key, index) => `<rect x="${110 + index * 200}" y="${650 - scores[key] * 4}" width="120" height="${scores[key] * 4}" rx="12"/>`).join('')}</g></svg>`
      const snapshot = dioramaRef.current?.snapshot() ?? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
      await downloadReport({
        cityName,
        typeTitle: title,
        archetypeId,
        choices,
        scores,
        dioramaSnapshot: snapshot,
      })
      setMessage('画像の保存を開始しました。')
    } catch {
      setMessage('画像を作成できませんでした。もう一度お試しください。')
    }
  }

  return (
    <main className="screen souvenir-screen" id="main-content" ref={ref}>
      <header className="section-heading">
        <p className="eyebrow" data-enter><Icon name="badge" />未来市民証</p>
      </header>
      <div className="souvenir-layout">
        <article className="city-card panel" aria-label={back ? '都市設計カードの裏面' : '都市設計カードの表面'} data-enter>
          {/* both faces stay mounted: unmounting the front would tear down the
              city model, and the saved image is rendered from its canvas */}
          <div className={`city-card__face city-card__face--front ${back ? 'is-hidden' : ''}`}>
            <div className="city-card__head"><span>2127 CITIZEN PASS</span><span>{passNumber}</span></div>
            <h2>{cityName || '名称未設定の都市'}</h2>
            <p className="lede">{title}／{typeName}</p>
            <div className="city-card__stage">
              <DioramaStage ref={dioramaRef} scores={scores} archetypeId={archetypeId} />
            </div>
            <div className="card-metrics">
              {METRIC_KEYS.map((key) => (
                <i key={key} className={key === lowestMetric(scores) ? 'is-low' : ''}>
                  <small>{metricShort[key]}</small>
                  <strong>{scores[key]}</strong>
                </i>
              ))}
            </div>
            <div className="city-card__foot"><span>市民番号　{citizenNumber}</span><span>{issueDate}</span></div>
          </div>
          <div className={`city-card__face city-card__face--back ${back ? '' : 'is-hidden'}`}>
            <div className="city-card__head"><span>2127 CITIZEN PASS</span><span>裏面</span></div>
            <h2>五つの指標と政策</h2>
            <div className="card-policies">
              {POLICY_CATEGORIES.map((category) => (
                <p key={category.id}>
                  <small>{category.label}</small>
                  <strong>{findPolicy(category.id, choices[category.id] ?? '')?.title}</strong>
                </p>
              ))}
            </div>
            <blockquote>{tradeoffs.gained.map((item) => item.label).join('・')}を得る代わりに、{tradeoffs.released.map((item) => item.label).join('・')}をどう守るかが問われます。</blockquote>
          </div>
        </article>
        <section className="souvenir-side">
          <div className="souvenir-side__toggle" role="tablist" aria-label="カードの面" data-enter>
            <div className="segmented">
              <button role="tab" aria-selected={!back} onClick={() => setBack(false)}>表面</button>
              <button role="tab" aria-selected={back} onClick={() => setBack(true)}>裏面</button>
            </div>
          </div>
          <div className="souvenir-field" data-enter>
            <label className="sr-only" htmlFor="city-name">{UI_COPY.souvenir.cityName}</label>
            <input
              id="city-name"
              name="city-name"
              type="text"
              autoComplete="off"
              maxLength={24}
              placeholder={UI_COPY.souvenir.cityName}
              value={cityName}
              onChange={(event) => setCityName(event.target.value.slice(0, 24))}
            />
          </div>
          <button className="button button--primary" disabled={!cityName.trim()} onClick={save} data-enter>
            <Icon name="download" />
            <span>画像として保存する</span>
          </button>
          <button className="button button--ghost" disabled={!cityName.trim()} onClick={share} data-enter>
            <Icon name="link" />
            <span>共有用URLをコピーする</span>
          </button>
          <p className="status" role="status">{message}</p>
          <div className="souvenir-side__policies panel panel--quiet" data-enter>
            <span>選んだ5つの政策</span>
            {POLICY_CATEGORIES.map((category) => (
              <p key={category.id}>{findPolicy(category.id, choices[category.id] ?? '')?.title}</p>
            ))}
          </div>
        </section>
      </div>
      <div className="center-action">
        <button className="button button--primary button--large" onClick={onRestart} data-enter>
          <span>最初の画面にもどる</span>
        </button>
      </div>
    </main>
  )
}

export function Reflection({ onRestart }: { onRestart: () => void }) {
  const ref = useEnter<HTMLElement>('reflection')
  return (
    <main className="screen reflection" id="main-content" ref={ref}>
      <div className="reflection__content">
        <p className="eyebrow" data-enter>最後の問い</p>
        <h1 data-enter>あなたにとってよい未来は、<br />みんなにとってもよい未来でしょうか。</h1>
        <p data-enter>この問いを、未来のおみやげに。</p>
        <button className="button button--light button--large" onClick={onRestart} data-enter>
          <Icon name="restart_alt" />
          <span>もう一度、別の未来を設計する</span>
        </button>
      </div>
    </main>
  )
}