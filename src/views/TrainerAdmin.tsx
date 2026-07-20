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

/** Zeigt nur, wer das Recht aktuell hat (als Chip, per ✕ entfernbar) — plus ein Dropdown,
 * um weitere Trainer hinzuzufügen. Deutlich kompakter als eine Zeile pro Trainer mit Checkbox. */
function RechteBox({ titel, trainer, feld, aktualisieren }: {
  titel: string
  trainer: TrainerKonto[]
  feld: Recht
  aktualisieren: (t: TrainerKonto, feld: Recht, wert: boolean) => void
}) {
  const ausgewaehlt = trainer.filter(t => !!t[feld])
  const verfuegbar = trainer.filter(t => !t[feld])

  return (
    <>
      <h2 className="abschnitt">{titel}</h2>
      <div className="karte">
        {ausgewaehlt.length === 0
          ? <div className="sub">Noch niemand zugeteilt.</div>
          : (
            <div className="chip-liste">
              {ausgewaehlt.map(t => (
                <span key={t.email} className="chip">
                  {t.name || t.email}
                  <button type="button" title="Entfernen" onClick={() => aktualisieren(t, feld, false)}>✕</button>
                </span>
              ))}
            </div>
          )}
        {verfuegbar.length > 0 && (
          <select value="" style={{ marginTop: '0.4rem' }} onChange={e => {
            const t = trainer.find(x => x.email === e.target.value)
            if (t) aktualisieren(t, feld, true)
          }}>
            <option value="" disabled>+ Trainer hinzufügen …</option>
            {verfuegbar.map(t => <option key={t.email} value={t.email}>{t.name || t.email}</option>)}
          </select>
        )}
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
          <div key={t.email} className="zeile kompakt">
            <div className="haupt">
              <div className="titel">
                {t.name || t.email}
                {t.personId && <a className="person-link" href={`#/person/${t.personId}`} title="Zur Person">↗</a>}
              </div>
              <div className="sub">
                {t.email} · {t.letzterLogin ? `Login: ${chDatumZeit(t.letzterLogin)}` : 'noch nie eingeloggt'}
              </div>
            </div>
            {t.rolle === 'master' && <span className="pill leiter">Admin</span>}
            {t.email !== eigeneEmail.toLowerCase() && (
              <button className="icon-btn" title="Zugriff entziehen" onClick={() => {
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
