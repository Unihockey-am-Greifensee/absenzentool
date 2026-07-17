import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/apiClient'
import { Seite } from '../App'

// An-/Abmeldefunktion für Eltern/Spieler:innen — läuft im normalen App-Shell (Seite), nicht
// als separater Bereich. Die Rolle 'familie' (siehe App.tsx/BenutzerContext) landet direkt
// hier statt im Trainer-Router; kein Zugriff auf AppState/apiSync (andere, viel schmalere
// Rechte, eigene schlanke Endpunkte unter /api/familie/*).

interface Kind {
  id: string
  vorname: string
  nachname: string
  gruppen: { id: string; name: string }[]
}

interface Termin {
  personId: string
  personName: string
  gruppeId: string
  gruppeName: string
  aktivitaetId: string
  datum: string
  zeit?: string
  typ: string
  status?: 'abgemeldet'
  grund?: string
  kannBearbeiten: boolean
}

function chDatum(iso: string): string {
  const [j, m, t] = iso.split('-')
  return `${t}.${m}.${j}`
}

function AbmeldenForm({ termin, aufFertig }: { termin: Termin; aufFertig: () => void }) {
  const [grund, setGrund] = useState('')
  const [lädt, setLädt] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  const abschicken = async () => {
    if (!grund.trim()) { setFehler('Bitte einen Grund angeben.'); return }
    setLädt(true)
    const res = await apiFetch('/api/familie/anwesenheit', {
      method: 'PUT',
      body: JSON.stringify({ personId: termin.personId, aktivitaetId: termin.aktivitaetId, status: 'abgemeldet', grund: grund.trim() }),
    })
    setLädt(false)
    if (!res.ok) { setFehler((await res.json().catch(() => ({})))?.fehler ?? 'Fehler beim Abmelden'); return }
    aufFertig()
  }

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <label className="feld">Grund der Abmeldung
        <input value={grund} onChange={e => setGrund(e.target.value)} placeholder="z.B. krank, in den Ferien …" />
      </label>
      <div className="btnreihe" style={{ marginTop: 0 }}>
        <button className="sekundaer" disabled={lädt} onClick={() => void abschicken()}>Abmelden bestätigen</button>
        <button className="leise" disabled={lädt} onClick={aufFertig}>Abbrechen</button>
      </div>
      {fehler && <div className="hinweis fehler">{fehler}</div>}
    </div>
  )
}

function TerminZeile({ termin, aktualisieren }: { termin: Termin; aktualisieren: () => void }) {
  const [zeigeAbmeldeform, setZeigeAbmeldeform] = useState(false)

  const wiederAnmelden = async () => {
    await apiFetch('/api/familie/anwesenheit', {
      method: 'PUT',
      body: JSON.stringify({ personId: termin.personId, aktivitaetId: termin.aktivitaetId, status: null }),
    })
    aktualisieren()
  }

  return (
    <div className="zeile" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
        <div className="haupt">
          <div className="titel">{chDatum(termin.datum)} · {termin.typ}{termin.zeit ? ` · ${termin.zeit}` : ''}</div>
          <div className="sub">{termin.gruppeName}</div>
        </div>
        {termin.status === 'abgemeldet' ? (
          <span className="pill abgesagt">abgemeldet</span>
        ) : (
          <span className="pill ok">angemeldet</span>
        )}
      </div>
      {termin.status === 'abgemeldet' && termin.grund && (
        <div className="sub" style={{ marginTop: '0.3rem' }}>Grund: {termin.grund}</div>
      )}
      {!termin.kannBearbeiten ? (
        <div className="sub" style={{ marginTop: '0.4rem' }}>Frist für Änderungen ist abgelaufen.</div>
      ) : zeigeAbmeldeform ? (
        <AbmeldenForm termin={termin} aufFertig={() => { setZeigeAbmeldeform(false); aktualisieren() }} />
      ) : (
        <div className="btnreihe" style={{ marginTop: '0.4rem' }}>
          {termin.status === 'abgemeldet' ? (
            <button className="sekundaer" onClick={() => void wiederAnmelden()}>Wieder anmelden</button>
          ) : (
            <button className="sekundaer" onClick={() => setZeigeAbmeldeform(true)}>Abmelden</button>
          )}
        </div>
      )}
    </div>
  )
}

export function MeineKinder() {
  const [kinder, setKinder] = useState<Kind[] | null>(null)
  const [termine, setTermine] = useState<Termin[] | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)

  const laden = () => {
    Promise.all([
      apiFetch('/api/familie/kinder').then(r => r.ok ? r.json() : Promise.reject(r.status)),
      apiFetch('/api/familie/termine').then(r => r.ok ? r.json() : Promise.reject(r.status)),
    ]).then(([k, t]) => { setKinder(k); setTermine(t) })
      .catch(e => setFehler(String(e)))
  }

  useEffect(laden, [])

  if (fehler) return <div className="hinweis fehler" style={{ margin: '1rem' }}>Fehler beim Laden: {fehler}</div>
  if (!kinder || !termine) return <div className="app" style={{ paddingTop: '25vh', textAlign: 'center', color: 'var(--muted)' }}>Lädt …</div>

  return (
    <Seite titel="Meine Kinder" tab="meine-kinder">
      {kinder.length === 0 && (
        <div className="leer">Keine Person mit dieser E-Mail-Adresse gefunden. Ist die richtige Adresse beim Verein hinterlegt?</div>
      )}
      {kinder.map(kind => {
        const eigeneTermine = termine.filter(t => t.personId === kind.id)
        return (
          <div key={kind.id}>
            <h2 className="abschnitt">{kind.vorname} {kind.nachname}</h2>
            <div className="karte" style={{ padding: '0.2rem 1rem' }}>
              {eigeneTermine.length === 0 && <div className="sub" style={{ padding: '0.5rem 0' }}>Keine anstehenden Termine.</div>}
              {eigeneTermine.map(t => (
                <TerminZeile key={t.aktivitaetId} termin={t} aktualisieren={laden} />
              ))}
            </div>
          </div>
        )
      })}
    </Seite>
  )
}
