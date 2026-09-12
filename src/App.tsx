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
import { getArchetype, inkOf } from './core-city'
import { findPolicy } from './data/policies'
import { scoreArchetype } from './lib/archetypeScoring'
import { calculateScores, isCompleteChoices } from './lib/scoring'
import { addCollectiveSubmission } from './services/collectiveStore'
import { CATEGORY_KEYS, type CategoryKey, type Choices } from './types'

type Phase = 'intro' | 'policies' | 'jump' | 'reveal' | 'why' | 'souvenir' | 'reflection'
const DEFAULT_ARCHETYPE_ID = 'OFEC'
const DEFAULT_CITY_NAME = '余白市'

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
  const [step, setStep] = useState(0)
  const [choices, setChoices] = useState<Choices>(shared.choices)
  const [cityName, setCityName] = useState(shared.cityName)
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

  const goToReveal = useCallback(() => setPhase('reveal'), [])

  const choosePolicy = (category: CategoryKey, policy: string) => {
    setChoices((current) => ({ ...current, [category]: policy }))
  }

  const completePolicies = (category: CategoryKey, policy: string) => {
    const completedChoices = { ...choices, [category]: policy }
    if (!isCompleteChoices(completedChoices)) return
    setChoices(completedChoices)
    if (!submitted.current) {
      submitted.current = true
      addCollectiveSubmission(completedChoices)
    }
    setPhase('jump')
  }

  const restart = () => {
    window.history.replaceState({}, '', window.location.pathname)
    setChoices({})
    setStep(0)
    setCityName(DEFAULT_CITY_NAME)
    submitted.current = false
    setPhase('intro')
  }

  const accent = archetype.visual.palette.accent
  const commonStyle = {
    '--accent': accent,
    '--accent-ink': inkOf(accent, '#ebebec'),
  } as React.CSSProperties

  return (
    <div className={`app phase-${phase}`} style={commonStyle}>
      <a className="skip-link" href="#main-content">本文へ移動する</a>
      <Background phase={phase} />
      {phase === 'intro' && <Intro onStart={() => setPhase('policies')} />}
      {phase === 'policies' && (
        <PolicyFlow
          choices={choices}
          step={step}
          onStepChange={setStep}
          onChoose={choosePolicy}
          onComplete={completePolicies}
        />
      )}
      {phase === 'jump' && <TimeJump onArrive={goToReveal} />}
      {phase === 'reveal' && (
        <CityReveal
          cityName={archetype.cityName}
          title={archetype.title}
          scores={scores}
          archetypeId={archetype.id}
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
