import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

try {
  if (window.self !== window.top) document.documentElement.setAttribute('data-framed', '')
} catch {
  document.documentElement.setAttribute('data-framed', '')
}

try {
  const t = JSON.parse(localStorage.getItem('aoi.settings') || '{}').theme
  const dark = t === 'dark' || ((t ?? 'system') === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
} catch {}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
