import { useState } from 'react'
import { trainerLoeschen, trainerSpeichern } from '../lib/firestoreSync'
import { useTrainerListe } from '../lib/useTrainerListe'
import { Seite } from '../App'

export function TrainerAdmin({ eigeneEmail }: { eigeneEmail: string }) {
  const liste = useTrainerListe()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [rolle, setRolle] = useState<'trainer' | 'master'>('trainer')

  return (
    <Seite titel="Trainer-Verwaltung" zurueck="export" tab="export">
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
            {t.rolle === 'master' && <span className="pill leiter">Admin</span>}
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
              <option value="master">Admin</option>
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
