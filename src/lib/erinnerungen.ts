import { useEffect, useState } from 'react'
import { apiFetch } from './apiClient'
import { apiAktiv } from '../config/apiConfig'

export interface UeberfaelligerTermin {
  id: string
  gruppeId: string
  gruppeName: string
  datum: string
  typ: string
}

const POLL_INTERVALL_MS = 5 * 60_000

/** Überfällige Termine (≥36h, fehlende Absenzen) der eigenen Hauptverantwortung — nur API-Modus. */
export function useErinnerungen(): UeberfaelligerTermin[] {
  const [liste, setListe] = useState<UeberfaelligerTermin[]>([])
  useEffect(() => {
    if (!apiAktiv) return
    let gestoppt = false
    const laden = () => apiFetch('/api/erinnerungen')
      .then(r => r.ok ? r.json() : [])
      .then((l: UeberfaelligerTermin[]) => { if (!gestoppt) setListe(l) })
      .catch(() => {})
    laden()
    const intervall = setInterval(laden, POLL_INTERVALL_MS)
    return () => { gestoppt = true; clearInterval(intervall) }
  }, [])
  return liste
}
