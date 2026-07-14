import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { trainerLoeschen, trainerSpeichern, type TrainerInfo } from '../lib/firestoreSync'
import { Seite } from '../App'

export function TrainerAdmin({ eigeneEmail }: { eigeneEmail: string }) {
  const [liste, setListe] = useState<TrainerInfo[]>([])
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [rolle, setRolle] = useState<'trainer' | 'master'>('trainer')

  useEffect(() => {
    if (!db) return
    return onSnapshot(collection(db, 'trainer'), snap => {
      const t: TrainerInfo[] = []
      snap.forEach(d => t.push({ email: d.id, ...(d.data() as Omit<TrainerInfo, 'email'>) }))
      setListe(t.sort((a, b) => a.email.localeCompare(b.email)))
    })
  }, [])

  return (
    <Seite titel="Trainer-Verwaltung" zurueck="" tab="gruppen">
      <div className="hinweis info">
        Freigeschaltete Google-Konten. Die Zuteilung zu den Gruppen machst du in der
        jeweiligen Gruppe unter «Trainer-Zuteilung».
      </div>
      <div className="karte" style={{ padding: '0.2rem 1rem' }}>
        {liste.map(t => (
          <div key={t.email} className="zeile">
            <div className="haupt">
              <div className="titel">{t.name || t.email}</div>
              <div className="sub">{t.email}</div>
            </div>
            {t.rolle === 'master' && <span className="pill leiter">Master</span>}
            {t.email !== eigeneEmail.toLowerCase() && (
              <button className="leise" onClick={() => {
                if (confirm(`${t.email} den Zugriff entziehen?`)) trainerLoeschen(t.email)
              }}>✕</button>
            )}
          </div>
        ))}
        {liste.length === 0 && <div className="sub" style={{ padding: '0.6rem 0' }}>Noch niemand freigeschaltet.</div>}
      </div>

      <h2 className="abschnitt">Konto freischalten</h2>
      <div className="karte">
        <label className="feld">Google-Mailadresse
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="name@gmail.com" />
        </label>
        <div className="felder2">
          <label className="feld">Anzeigename (optional)
            <input value={name} onChange={e => setName(e.target.value)} />
          </label>
          <label className="feld">Rolle
            <select value={rolle} onChange={e => setRolle(e.target.value as 'trainer' | 'master')}>
              <option value="trainer">Trainer</option>
              <option value="master">Master</option>
            </select>
          </label>
        </div>
        <button className="breit" disabled={!/^\S+@\S+\.\S+$/.test(email.trim())} onClick={async () => {
          await trainerSpeichern(email.trim(), { rolle, name: name.trim() || undefined })
          setEmail(''); setName(''); setRolle('trainer')
        }}>Freischalten</button>
      </div>
    </Seite>
  )
}
