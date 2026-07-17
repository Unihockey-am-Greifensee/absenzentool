import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/apiClient'
import { Seite } from '../App'

// An-/Abmeldefunktion für Eltern/Spieler:innen — läuft im normalen App-Shell (Seite), nicht
// als separater Bereich. Die Rolle 'familie' (siehe App.tsx/BenutzerContext) landet direkt
// hier statt im Trainer-Router; kein Zugriff auf AppState/apiSync (andere, viel schmalere
// Rechte, eigene schlanke Endpunkte unter /api/familie/*). Bewusst an den kompakten
// Termin-Zeilen der Coaches-Ansicht (terminZeile in GruppeDetail.tsx) angelehnt.

const ANZAHL_STANDARD = 10

interface Kind {
  id: string
  vorname: string
  nachname: string
  rolle: 'selbst' | 'mutter' | 'vater'
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
  fristBis: string
  kannBearbeiten: boolean
}

function chDatum(iso: string): string {
  const [j, m, t] = iso.split('-')
  return `${t}.${m}.${j}`
}

function chFrist(iso: string): string {
  return new Date(iso).toLocaleString('de-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

/** "Meine An-/Abwesenheiten" bei eigenem Login, sonst "Unsere …" (Eltern-Login). */
function seitentitel(kinder: Kind[]): string {
  return kinder.length > 0 && kinder.every(k => k.rolle === 'selbst') ? 'Meine An- / Abwesenheiten' : 'Unsere An- / Abwesenheiten'
}

/** Überschrift pro Kind — bei Eltern-Login mit "Im Namen von …"-Präfix, sonst schlicht der Name. */
function kindUeberschrift(kind: Kind, gesamtAnzahl: number): string | null {
  if (kind.rolle === 'selbst' && gesamtAnzahl === 1) return null
  if (kind.rolle === 'selbst') return `${kind.vorname} ${kind.nachname}`
  return `Im Namen von ${kind.vorname} ${kind.nachname}`
}

function useFamilieDaten() {
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
  return { kinder, termine, fehler, laden }
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

/** Kompakte Zeile im Stil von terminZeile (GruppeDetail.tsx) — klickbar zum Auf-/Zuklappen der Aktion. */
function TerminZeile({ termin, aktualisieren }: { termin: Termin; aktualisieren: () => void }) {
  const [aufgeklappt, setAufgeklappt] = useState(false)

  const wiederAnmelden = async () => {
    await apiFetch('/api/familie/anwesenheit', {
      method: 'PUT',
      body: JSON.stringify({ personId: termin.personId, aktivitaetId: termin.aktivitaetId, status: null }),
    })
    aktualisieren()
  }

  return (
    <div className="zeile" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', cursor: termin.kannBearbeiten ? 'pointer' : 'default' }}
        onClick={() => termin.kannBearbeiten && setAufgeklappt(v => !v)}
      >
        <div className="haupt">
          <div className="titel">{chDatum(termin.datum)} · {termin.typ}{termin.zeit ? ` · ${termin.zeit}` : ''}</div>
          <div className="sub">
            {termin.gruppeName}
            {termin.kannBearbeiten && ` · Anmeldefrist: ${chFrist(termin.fristBis)}`}
          </div>
          {termin.status === 'abgemeldet' && termin.grund && <div className="sub">Grund: {termin.grund}</div>}
        </div>
        {termin.status === 'abgemeldet' ? (
          <span className="pill abgesagt">abgemeldet</span>
        ) : (
          <span className="pill ok">angemeldet</span>
        )}
      </div>
      {aufgeklappt && termin.kannBearbeiten && (
        termin.status === 'abgemeldet' ? (
          <div className="btnreihe" style={{ marginTop: '0.4rem' }}>
            <button className="sekundaer" onClick={() => void wiederAnmelden()}>Wieder anmelden</button>
          </div>
        ) : (
          <AbmeldenForm termin={termin} aufFertig={() => { setAufgeklappt(false); aktualisieren() }} />
        )
      )}
    </div>
  )
}

function KindSektion({ kind, termine, gesamtAnzahl, aktualisieren }: {
  kind: Kind; termine: Termin[]; gesamtAnzahl: number; aktualisieren: () => void
}) {
  const eigeneTermine = termine.filter(t => t.personId === kind.id)
  const ueberschrift = kindUeberschrift(kind, gesamtAnzahl)
  const gezeigt = eigeneTermine.slice(0, ANZAHL_STANDARD)
  const rest = eigeneTermine.length - gezeigt.length

  return (
    <div>
      {ueberschrift && <h2 className="abschnitt">{ueberschrift}</h2>}
      <div className="karte" style={{ padding: '0.2rem 1rem' }}>
        {gezeigt.length === 0 && <div className="sub" style={{ padding: '0.5rem 0' }}>Keine anstehenden Termine.</div>}
        {gezeigt.map(t => (
          <TerminZeile key={t.aktivitaetId} termin={t} aktualisieren={aktualisieren} />
        ))}
      </div>
      {rest > 0 && (
        <a className="btn sekundaer breit" href={`#/meine-kinder/termine/${kind.id}`} style={{ marginTop: '0.5rem' }}>
          Weitere Termine ({rest}) ›
        </a>
      )}
    </div>
  )
}

export function MeineKinder() {
  const { kinder, termine, fehler, laden } = useFamilieDaten()

  if (fehler) return <div className="hinweis fehler" style={{ margin: '1rem' }}>Fehler beim Laden: {fehler}</div>
  if (!kinder || !termine) return <div className="app" style={{ paddingTop: '25vh', textAlign: 'center', color: 'var(--muted)' }}>Lädt …</div>

  return (
    <Seite titel={seitentitel(kinder)} tab="meine-kinder">
      {kinder.length === 0 && (
        <div className="leer">Keine Person mit dieser E-Mail-Adresse gefunden. Ist die richtige Adresse beim Verein hinterlegt?</div>
      )}
      {kinder.map(kind => (
        <KindSektion key={kind.id} kind={kind} termine={termine} gesamtAnzahl={kinder.length} aktualisieren={laden} />
      ))}
    </Seite>
  )
}

/** "Weitere Termine"-Seite für ein einzelnes Kind — analog zu TermineListe.tsx (Coaches-Ansicht). */
export function MeineKinderTermine({ personId }: { personId: string }) {
  const { kinder, termine, fehler, laden } = useFamilieDaten()

  if (fehler) return <div className="hinweis fehler" style={{ margin: '1rem' }}>Fehler beim Laden: {fehler}</div>
  if (!kinder || !termine) return <div className="app" style={{ paddingTop: '25vh', textAlign: 'center', color: 'var(--muted)' }}>Lädt …</div>

  const kind = kinder.find(k => k.id === personId)
  if (!kind) {
    return <Seite titel="Nicht gefunden" zurueck="meine-kinder" tab="meine-kinder">
      <div className="leer">Diese Person gehört nicht (mehr) zu deinem Konto.</div>
    </Seite>
  }

  const eigeneTermine = termine.filter(t => t.personId === kind.id)

  return (
    <Seite titel={`${kind.vorname} ${kind.nachname}`} zurueck="meine-kinder" tab="meine-kinder">
      <div className="sub" style={{ margin: '-0.5rem 0 0.75rem', color: 'var(--muted)' }}>
        {eigeneTermine.length} {eigeneTermine.length === 1 ? 'Termin' : 'Termine'}
      </div>
      <div className="karte" style={{ padding: '0.2rem 1rem' }}>
        {eigeneTermine.length === 0 && <div className="sub" style={{ padding: '0.5rem 0' }}>Keine anstehenden Termine.</div>}
        {eigeneTermine.map(t => (
          <TerminZeile key={t.aktivitaetId} termin={t} aktualisieren={laden} />
        ))}
      </div>
    </Seite>
  )
}
