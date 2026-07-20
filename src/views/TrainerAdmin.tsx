import { useState } from 'react'
import { trainerLoeschen as fsLoeschen, trainerSpeichern as fsSpeichern, type TrainerKonto } from '../lib/firestoreSync'
import { trainerLoeschen as apiLoeschen, trainerSpeichern as apiSpeichern } from '../lib/apiSync'
import { apiAktiv } from '../config/apiConfig'
import { useTrainerListe } from '../lib/useTrainerListe'
import { Seite } from '../App'

const trainerSpeichern = apiAktiv ? apiSpeichern : fsSpeichern
const trainerLoeschen = apiAktiv ? apiLoeschen : fsLoeschen

function chDatumZeit(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

type Recht = 'fotoRecht' | 'kursRecht' | 'nachwuchsVerantwortlich'

/** Eine Box pro Recht statt pro Trainer — so lässt sich das Recht für mehrere Trainer auf
 * einen Blick vergleichen und in einem Schritt anpassen (Mehrfachauswahl möglich). */
function RechteBox({ titel, trainer, feld, aktualisieren }: {
  titel: string
  trainer: TrainerKonto[]
  feld: Recht
  aktualisieren: (t: TrainerKonto, feld: Recht, wert: boolean) => void
}) {
  return (
    <>
      <h2 className="abschnitt">{titel}</h2>
      <div className="karte" style={{ padding: '0.2rem 1rem' }}>
        {trainer.map(t => (
          <label key={t.email} className="zeile" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={!!t[feld]} onChange={e => aktualisieren(t, feld, e.target.checked)} />
            <div className="haupt">
              <div className="titel">{t.name || t.email}</div>
            </div>
          </label>
        ))}
        {trainer.length === 0 && <div className="sub" style={{ padding: '0.6rem 0' }}>Keine Trainer vorhanden.</div>}
      </div>
    </>
  )
}

export function TrainerAdmin({ eigeneEmail }: { eigeneEmail: string }) {
  const liste = useTrainerListe()
  // Master hat immer volle Rechte, unabhängig von den Flags — taucht deshalb in den
  // Rechte-Boxen nicht auf (siehe middleware/auth.ts requireFotoRecht etc.).
  const trainerOhneMaster = liste.filter(t => t.rolle === 'trainer')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [rolle, setRolle] = useState<'trainer' | 'master'>('trainer')

  const rechtAktualisieren = (t: TrainerKonto, feld: Recht, wert: boolean) =>
    trainerSpeichern(t.email, {
      rolle: t.rolle,
      name: t.name,
      fotoRecht: feld === 'fotoRecht' ? wert : t.fotoRecht,
      kursRecht: feld === 'kursRecht' ? wert : t.kursRecht,
      nachwuchsVerantwortlich: feld === 'nachwuchsVerantwortlich' ? wert : t.nachwuchsVerantwortlich,
    })

  return (
    <Seite titel="User-Verwaltung" zurueck="export" tab="export">
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
              <div className="sub">{t.letzterLogin ? `Letzter Login: ${chDatumZeit(t.letzterLogin)}` : 'Noch nie eingeloggt'}</div>
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

      <RechteBox titel="Foto-Recht" trainer={trainerOhneMaster} feld="fotoRecht" aktualisieren={rechtAktualisieren} />
      <RechteBox titel="Ausbildungsverantwortlicher (Kurse verwalten)" trainer={trainerOhneMaster} feld="kursRecht" aktualisieren={rechtAktualisieren} />
      <RechteBox titel="Nachwuchs-Verantwortlicher" trainer={trainerOhneMaster} feld="nachwuchsVerantwortlich" aktualisieren={rechtAktualisieren} />

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
