import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { alleTrainer } from './apiSync'
import { apiAktiv } from '../config/apiConfig'
import type { TrainerInfo } from './firestoreSync'

const POLL_INTERVALL_MS = 20_000

function sortiert(t: TrainerInfo[]): TrainerInfo[] {
  return [...t].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, 'de'))
}

/** Liste aller freigeschalteten Trainer-Konten — Firestore-Live-Sync oder API-Polling. */
export function useTrainerListe(): TrainerInfo[] {
  const [liste, setListe] = useState<TrainerInfo[]>([])

  useEffect(() => {
    if (!apiAktiv) return
    let gestoppt = false
    const laden = () => alleTrainer().then(t => { if (!gestoppt) setListe(sortiert(t)) })
    laden()
    const intervall = setInterval(laden, POLL_INTERVALL_MS)
    return () => { gestoppt = true; clearInterval(intervall) }
  }, [])

  useEffect(() => {
    if (apiAktiv || !db) return
    return onSnapshot(collection(db, 'trainer'), snap => {
      const t: TrainerInfo[] = []
      snap.forEach(d => t.push({ email: d.id, ...(d.data() as Omit<TrainerInfo, 'email'>) }))
      setListe(sortiert(t))
    })
  }, [])

  return liste
}
