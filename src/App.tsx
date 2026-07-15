import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import type { AppState } from './types'
import { loadState, saveState } from './storage'
import { abmelden, auth, firebaseAktiv } from './firebase'
import { abonnieren, diffSchreiben, trainerAbonnieren, type TrainerInfo } from './lib/firestoreSync'
import { GruppenListe } from './views/Gruppen'
import { GruppeDetail } from './views/GruppeDetail'
import { TerminDetail } from './views/TerminDetail'
import { PersonenListe, PersonEdit } from './views/Personen'
import { ImportView } from './views/Import'
import { ExportView } from './views/Export'
import { LadeAnzeige, LoginView, NichtFreigeschaltet } from './views/Auth'
import { TrainerAdmin } from './views/TrainerAdmin'
import { BackupView } from './views/Backup'

export type Update = (fn: (s: AppState) => AppState) => void

export interface Benutzer {
  rolle: 'master' | 'trainer' | 'lokal'
  email?: string
  name?: string
}

export const BenutzerContext = createContext<Benutzer>({ rolle: 'lokal' })
export const useBenutzer = () => useContext(BenutzerContext)

function useHashRoute(): string[] {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const h = () => {
      setHash(window.location.hash)
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [])
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean)
}

function Router({ state, update }: { state: AppState; update: Update }) {
  const seg = useHashRoute()
  const benutzer = useBenutzer()
  const istMaster = benutzer.rolle !== 'trainer'

  if (seg[0] === 'gruppe' && seg[1] && seg[2] === 'termin' && seg[3]) {
    return <TerminDetail state={state} update={update} gruppeId={seg[1]} terminId={seg[3]} />
  }
  if (seg[0] === 'gruppe' && seg[1]) return <GruppeDetail state={state} update={update} gruppeId={seg[1]} />
  if (seg[0] === 'personen') return <PersonenListe state={state} />
  if (seg[0] === 'person' && seg[1]) return <PersonEdit state={state} update={update} personId={seg[1]} />
  if (seg[0] === 'import' && istMaster) return <ImportView state={state} update={update} />
  if (seg[0] === 'export' && istMaster) return <ExportView state={state} />
  if (seg[0] === 'trainer' && benutzer.rolle === 'master') return <TrainerAdmin eigeneEmail={benutzer.email!} />
  if (seg[0] === 'backup' && istMaster) return <BackupView state={state} update={update} />
  return <GruppenListe state={state} update={update} />
}

/** Lokal-Modus: alles im localStorage, kein Login (bis firebaseConfig gesetzt ist). */
function LokalApp() {
  const [state, setState] = useState<AppState>(loadState)
  const update: Update = fn =>
    setState(s => {
      const n = fn(s)
      saveState(n)
      return n
    })
  return (
    <BenutzerContext.Provider value={{ rolle: 'lokal' }}>
      <Router state={state} update={update} />
    </BenutzerContext.Provider>
  )
}

/** Firestore-Modus: Login, Freischaltung, Live-Sync. */
function SyncApp({ info }: { info: TrainerInfo }) {
  const istMaster = info.rolle === 'master'
  const [state, setState] = useState<AppState | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const aktuell = useRef<AppState | null>(null)

  useEffect(() => {
    return abonnieren(istMaster, s => {
      aktuell.current = s
      setState(s)
    }, f => setFehler(f))
  }, [istMaster])

  const update: Update = fn => {
    const alt = aktuell.current
    if (!alt) return
    const neu = fn(alt)
    aktuell.current = neu
    setState(neu) // optimistisch — Firestore-Snapshot bestätigt danach
    diffSchreiben(alt, neu, istMaster).catch(e => setFehler('Speichern fehlgeschlagen: ' + String(e)))
  }

  if (fehler) {
    return (
      <div className="app" style={{ paddingTop: '20vh' }}>
        <div className="hinweis fehler"><b>Verbindungsproblem:</b> {fehler}</div>
        <button className="leise" onClick={() => window.location.reload()}>Neu laden</button>
      </div>
    )
  }
  if (!state) return <LadeAnzeige text="Lade Daten …" />
  return (
    <BenutzerContext.Provider value={{ rolle: info.rolle, email: info.email, name: info.name }}>
      <Router state={state} update={update} />
    </BenutzerContext.Provider>
  )
}

function FirebaseApp() {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [info, setInfo] = useState<TrainerInfo | null | undefined>(undefined)

  useEffect(() => onAuthStateChanged(auth!, u => {
    setUser(u)
    setInfo(undefined)
  }), [])

  useEffect(() => {
    if (!user?.email) return
    return trainerAbonnieren(user.email, setInfo)
  }, [user])

  if (user === undefined) return <LadeAnzeige text="Prüfe Anmeldung …" />
  if (user === null) return <LoginView />
  if (info === undefined) return <LadeAnzeige text="Prüfe Freischaltung …" />
  if (info === null) return <NichtFreigeschaltet email={user.email ?? '?'} />
  return <SyncApp info={info} />
}

export default function App() {
  return firebaseAktiv ? <FirebaseApp /> : <LokalApp />
}

export function Seite(props: {
  titel: string
  zurueck?: string
  tab?: 'gruppen' | 'personen' | 'export'
  children: React.ReactNode
}) {
  const benutzer = useBenutzer()
  return (
    <div className="app">
      <div className="topbar">
        {props.zurueck !== undefined && (
          <a className="zurueck" href={'#/' + props.zurueck} aria-label="Zurück">‹</a>
        )}
        <h1>{props.titel}</h1>
        {benutzer.rolle !== 'lokal' && (
          <button
            onClick={() => { if (confirm('Abmelden?')) abmelden() }}
            title={`Angemeldet als ${benutzer.email}`}
            style={{ background: 'rgba(255,255,255,0.15)', padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
          >
            {(benutzer.name || benutzer.email || '?').slice(0, 1).toUpperCase()}
          </button>
        )}
      </div>
      {props.children}
      <nav className="bottomnav">
        <a href="#/" className={props.tab === 'gruppen' ? 'aktiv' : ''}>
          <span className="icon">🏑</span>Gruppen
        </a>
        <a href="#/personen" className={props.tab === 'personen' ? 'aktiv' : ''}>
          <span className="icon">👥</span>Personen
        </a>
        {benutzer.rolle !== 'trainer' && (
          <a href="#/export" className={props.tab === 'export' ? 'aktiv' : ''}>
            <span className="icon">📤</span>Export
          </a>
        )}
      </nav>
    </div>
  )
}
