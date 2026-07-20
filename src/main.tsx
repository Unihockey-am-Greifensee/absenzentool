import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Temporäre Debug-Hilfe für die Capacitor-App: zeigt jeden unbehandelten Fehler direkt auf dem
// Bildschirm an (kein Absturz in ein leeres Weiss mehr), da der Safari-Web-Inspector im
// Simulator nicht immer zuverlässig erreichbar ist. Vor dem echten Release wieder entfernen.
function fehlerAnzeigen(text: string) {
  const el = document.createElement('div')
  el.style.cssText = 'position:fixed;inset:0;background:#fff0f0;color:#900;font:14px monospace;padding:1rem;overflow:auto;z-index:99999;white-space:pre-wrap;'
  el.textContent = text + '\n\n(zum Schliessen tippen)'
  el.addEventListener('click', () => el.remove())
  document.body.appendChild(el)
}
window.addEventListener('error', e => {
  // "Script error." ohne Details ist die generische Browser-Meldung bei Fehlern aus
  // Fremd-Skripten ohne crossorigin-Attribut (hier: Googles Login-Skript) — dafür gibt es
  // bereits eine eigene, sauber abgefangene Anzeige (siehe views/Auth.tsx), kein Absturz.
  if (e.message === 'Script error.' && !e.filename) return
  fehlerAnzeigen(`Fehler: ${e.message}\n${e.error?.stack ?? ''}`)
})
window.addEventListener('unhandledrejection', e => fehlerAnzeigen(`Unbehandelte Promise-Ablehnung: ${e.reason?.message ?? e.reason}\n${e.reason?.stack ?? ''}`))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
