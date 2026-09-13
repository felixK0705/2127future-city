import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Background } from './components/Background'
import {
  CityReveal,
  Intro,
  PolicyFlow,
  Reflection,
  Souvenir,
  TimeJump,
  WhyPanel,
} from './components/Experience'
import { accentForArchetype, getArchetype, inkOf, rgba } from './core-city'
import { findPolicy } from './data/policies'
import { scoreArchetype } from './lib/archetypeScoring'
import { calculateScores, isCompleteChoices } from './lib/scoring'
import { addCollectiveSubmission } from './services/collectiveStore'
import { CATEGORY_KEYS, type CategoryKey, type Choices } from './types'

type Phase = 'intro' | 'policies' | 'jump' | 'reveal' | 'why' | 'souvenir' | 'reflection'
const DEFAULT_ARCHETYPE_ID = 'OFEC'
const DEFAULT_CITY_NAME = '余白市'
const BRAND_ACCENT = '#555860'

function readSharedDesign() {
  const params = new URLSearchParams(window.location.search)
  const choices: Choices = {}
  for (const key of CATEGORY_KEYS) {
    const value = params.get(key)
    if (value && findPolicy(key, value)) choices[key] = value
  }
  const complete = isCompleteChoices(choices)
  return {
    choices,
    complete,
    cityName: complete ? (params.get('city')?.slice(0, 24).trim() || DEFAULT_CITY_NAME) : DEFAULT_CITY_NAME,
  }
}

export default function App() {
  const shared = useMemo(readSharedDesign, [])
  const [phase, setPhase] = useState<Phase>(shared.complete ? 'souvenir' : 'intro')
  const [jumpCover, setJumpCover] = useState(false)
  const [cityReady, setCityReady] = useState(false)
  const [step, setStep] = useState(0)
  const [choices, setChoices] = useState<Choices>(shared.choices)
  const [cityName, setCityName] = useState(shared.cityName)
  const [nickname, setNickname] = useState('')
  const submitted = useRef(shared.complete)
  const scores = useMemo(() => calculateScores(choices), [choices])
  const archetype = useMemo(
    () => getArchetype(isCompleteChoices(choices) ? scoreArchetype(choices).archetypeId : DEFAULT_ARCHETYPE_ID),
    [choices],
  )

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
    document.title = `${cityName}｜2127 未来都市デザイナー`
  }, [phase, cityName])

  const goToReveal = useCallback(() => {
    setPhase('reveal')
    setJumpCover(true)
  }, [])
  const dismissJump = useCallback(() => setJumpCover(false), [])
  const markCityReady = useCallback(() => setCityReady(true), [])

  const choosePolicy = (category: CategoryKey, policy: string) => {
    setChoices((current) => ({ ...current, [category]: policy }))
  }

  const completePolicies = (category: CategoryKey, policy: string) => {
    const completedChoices = { ...choices, [category]: policy }
    if (!isCompleteChoices(completedChoices)) return
    setChoices(completedChoices)
    if (!submitted.current) {
      submitted.current = true
      window.setTimeout(() => addCollectiveSubmission(completedChoices), 0)
    }
    setCityReady(false)
    setPhase('jump')
  }

  const restart = () => {
    window.history.replaceState({}, '', window.location.pathname)
    setChoices({})
    setStep(0)
    setCityName(DEFAULT_CITY_NAME)
    setNickname('')
    submitted.current = false
    setJumpCover(false)
    setCityReady(false)
    setPhase('intro')
  }

  // 都市色は幕が完全に開いてから。跳躍中に差し替えるとスタイル再計算で詰まる。
  const accent =
    isCompleteChoices(choices) && phase === 'reveal' && !jumpCover
      ? accentForArchetype(archetype.id).primary
      : BRAND_ACCENT
  const commonStyle = {
    '--accent': accent,
    '--accent-ink': inkOf(accent, '#ebebec'),
    '--red': accent,
    '--red-soft': rgba(accent, 0.12),
  } as React.CSSProperties

  return (
    <div className={`app phase-${phase}${jumpCover ? ' is-jump-cover' : ''}`} style={commonStyle}>
      <a className="skip-link" href="#main-content">本文へ移動する</a>
      <Background phase={phase} />
      {phase === 'intro' && (
        <Intro nickname={nickname} setNickname={setNickname} onStart={() => setPhase('policies')} />
      )}
      {(phase === 'policies' || phase === 'jump') && (
        <div
          className={phase === 'jump' ? 'is-beneath-jump' : undefined}
          inert={phase === 'jump' || undefined}
          aria-hidden={phase === 'jump' || undefined}
        >
          <PolicyFlow
            choices={choices}
            step={step}
            onStepChange={setStep}
            onChoose={choosePolicy}
            onComplete={completePolicies}
          />
        </div>
      )}
      {(phase === 'jump' || jumpCover) && (
        <TimeJump onArrive={goToReveal} onDismiss={dismissJump} cityReady={cityReady} />
      )}
      {(phase === 'reveal' || jumpCover) && isCompleteChoices(choices) && (
        <CityReveal
          cityName={archetype.cityName}
          title={archetype.title}
          nickname={nickname}
          scores={scores}
          archetypeId={archetype.id}
          onReady={markCityReady}
          onContinue={() => setPhase('why')}
        />
      )}
      {phase === 'why' && (
        <WhyPanel
          choices={choices}
          scores={scores}
          archetype={archetype}
          onContinue={() => setPhase('souvenir')}
        />
      )}
      {phase === 'souvenir' && (
        <Souvenir
          cityName={cityName}
          setCityName={setCityName}
          title={archetype.title}
          typeName={archetype.cityName}
          archetypeId={archetype.id}
          choices={choices}
          scores={scores}
          onContinue={() => setPhase('reflection')}
        />
      )}
      {phase === 'reflection' && <Reflection onRestart={restart} />}
    </div>
  )
}
