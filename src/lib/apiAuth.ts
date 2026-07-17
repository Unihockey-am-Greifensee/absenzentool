import { GOOGLE_CLIENT_ID } from '../config/apiConfig'
import { apiFetch } from './apiClient'
import type { TrainerInfo } from './firestoreSync'

// Google-Login ohne Firebase Auth: Google Identity Services liefert ein ID-Token,
// das der eigene Server verifiziert (siehe rudelcheck-server/src/auth/google.ts).

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: { client_id: string; callback: (resp: { credential: string }) => void }): void
          renderButton(parent: HTMLElement, optionen: Record<string, unknown>): void
          disableAutoSelect(): void
        }
      }
    }
  }
}

let ladenPromise: Promise<void> | null = null
function gisLaden(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (!ladenPromise) {
    ladenPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Google Identity Services konnte nicht geladen werden'))
      document.head.appendChild(script)
    })
  }
  return ladenPromise
}

export type AnmeldeErgebnis =
  | { status: 'ok'; info: TrainerInfo }
  | { status: 'nicht-freigeschaltet' }
  | { status: 'fehler'; meldung: string }

/** Rendert den offiziellen Google-Button in `container`; meldet das Ergebnis über `auf`. */
export async function googleButtonRendern(container: HTMLElement, auf: (ergebnis: AnmeldeErgebnis) => void): Promise<void> {
  await gisLaden()
  window.google!.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: async resp => {
      try {
        const res = await apiFetch('/auth/google', { method: 'POST', body: JSON.stringify({ idToken: resp.credential }) })
        if (res.status === 403) { auf({ status: 'nicht-freigeschaltet' }); return }
        if (!res.ok) { auf({ status: 'fehler', meldung: `Anmeldung fehlgeschlagen (HTTP ${res.status})` }); return }
        auf({ status: 'ok', info: await res.json() })
      } catch (e) {
        auf({ status: 'fehler', meldung: String(e) })
      }
    },
  })
  window.google!.accounts.id.renderButton(container, { theme: 'outline', size: 'large', text: 'signin_with' })
}

export async function meAbrufen(): Promise<TrainerInfo | null> {
  const res = await apiFetch('/auth/me')
  if (!res.ok) return null
  return res.json()
}

export async function abmelden(): Promise<void> {
  await apiFetch('/auth/logout', { method: 'POST' }).catch(() => {})
  window.google?.accounts.id.disableAutoSelect()
}

// Alternative zum Google-Login für Eltern/Spieler:innen ohne Google-Konto: Code per Mail
// (An-/Abmeldefunktion). Nutzt dieselbe Session wie der Trainer-Login.

export async function codeAnfordern(email: string): Promise<{ ok: true } | { ok: false; meldung: string }> {
  const res = await apiFetch('/auth/code-anfordern', { method: 'POST', body: JSON.stringify({ email }) })
  if (!res.ok) {
    const daten = await res.json().catch(() => ({}))
    return { ok: false, meldung: daten.fehler ?? `Fehler (HTTP ${res.status})` }
  }
  return { ok: true }
}

export async function codeBestaetigen(email: string, code: string): Promise<{ ok: true; info: TrainerInfo } | { ok: false; meldung: string }> {
  const res = await apiFetch('/auth/code-bestaetigen', { method: 'POST', body: JSON.stringify({ email, code }) })
  if (!res.ok) {
    const daten = await res.json().catch(() => ({}))
    return { ok: false, meldung: daten.fehler ?? `Fehler (HTTP ${res.status})` }
  }
  return { ok: true, info: await res.json() }
}
