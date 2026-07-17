import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { alleTrainer } from './apiSync'
import { apiAktiv } from '../config/apiConfig'
import type { TrainerKonto } from './firestoreSync'

const POLL_INTERVALL_MS = 20_000

function sortiert(t: TrainerKonto[]): TrainerKonto[] {
  return [...t].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, 'de'))
}

/** Liste aller freigeschalteten Trainer-Konten — Firestore-Live-Sync oder API-Polling. */
export function useTrainerListe(): TrainerKonto[] {
  const [liste, setListe] = useState<TrainerKonto[]>([])

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
      const t: TrainerKonto[] = []
      snap.forEach(d => t.push({ email: d.id, ...(d.data() as Omit<TrainerKonto, 'email'>) }))
      setListe(sortiert(t))
    })
  }, [])

  return liste
}
