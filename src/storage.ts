import type { AppState } from './types'
import { LEER } from './types'
import { aktuelleSaison } from './lib/saison'

// Lokale Persistenz. Wird später durch einen Firestore-Adapter ersetzt —
// die Views kennen nur load/save.

const KEY = 'absenzentool-state-v1'

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return LEER
    const parsed = JSON.parse(raw) as AppState
    if (!Array.isArray(parsed.personen) || !Array.isArray(parsed.gruppen)) return LEER
    if (!Array.isArray(parsed.fotos)) parsed.fotos = []
    if (!Array.isArray(parsed.teamFotos)) parsed.teamFotos = []
    if (typeof parsed.fotoSaison !== 'string') parsed.fotoSaison = aktuelleSaison()
    return parsed
  } catch {
    return LEER
  }
}

export function saveState(state: AppState): void {
  localStorage.setItem(KEY, JSON.stringify(state))
}
