import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import gsap from 'gsap'
import App from './App'
import { AuditCities } from './AuditCities'
import { CaptureCities } from './CaptureCities'
import './styles.css'

gsap.config({ force3D: true, nullTargetWarn: false })
gsap.ticker.lagSmoothing(1000, 33)

const root = document.getElementById('root')

if (!root) {
  throw new Error('画面を表示する場所が見つかりませんでした。')
}

const params = new URLSearchParams(window.location.search)
const capture = params.has('capture')
const audit = params.has('audit')

createRoot(root).render(
  <StrictMode>
    {audit ? <AuditCities /> : capture ? <CaptureCities /> : <App />}
  </StrictMode>,
)
