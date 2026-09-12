import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

const root = document.getElementById('root')

if (!root) {
  throw new Error('画面を表示する場所が見つかりませんでした。')
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
