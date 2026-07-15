import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import type { TrainerInfo } from './firestoreSync'

/** Live-Liste aller freigeschalteten Trainer-Konten (Collection `trainer`). */
export function useTrainerListe(): TrainerInfo[] {
  const [liste, setListe] = useState<TrainerInfo[]>([])
  useEffect(() => {
    if (!db) return
    return onSnapshot(collection(db, 'trainer'), snap => {
      const t: TrainerInfo[] = []
      snap.forEach(d => t.push({ email: d.id, ...(d.data() as Omit<TrainerInfo, 'email'>) }))
      setListe(t.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, 'de')))
    })
  }, [])
  return liste
}
