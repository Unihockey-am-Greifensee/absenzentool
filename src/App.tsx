import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import type { AppState } from './types'
import { loadState, saveState } from './storage'
import { abmelden as firebaseAbmelden, auth, firebaseAktiv } from './firebase'
import { abonnieren, diffSchreiben, trainerAbonnieren, type TrainerInfo } from './lib/firestoreSync'
import * as apiSync from './lib/apiSync'
import { abmelden as apiAbmelden, meAbrufen } from './lib/apiAuth'
import { apiAktiv } from './config/apiConfig'
import { GruppenListe } from './views/Gruppen'
import { GruppeDetail } from './views/GruppeDetail'
import { TerminDetail } from './views/TerminDetail'
import { TermineListe } from './views/TermineListe'
import { PersonenListe, PersonEdit, PersonenArchiv } from './views/Personen'
import { ImportView } from './views/Import'
import { ExportView } from './views/Export'
import { ApiLoginView, ApiNichtFreigeschaltet, LadeAnzeige, LoginView, NichtFreigeschaltet } from './views/Auth'
import { TrainerAdmin } from './views/TrainerAdmin'
import { BackupView } from './views/Backup'
import { AdminHub } from './views/Admin'
import { GruppenVerwaltung } from './views/GruppenVerwaltung'
import { Halbjahresabschluss } from './views/Halbjahresabschluss'
import { MeineKinder, MeineKinderTermine } from './views/MeineKinder'
import { PersonenFamilie } from './views/PersonenFamilie'
import { FamilieZugriffe } from './views/FamilieZugriffe'

export type Update = (fn: (s: AppState) => AppState) => void

export interface Benutzer {
  rolle: 'master' | 'trainer' | 'familie' | 'lokal'
  email?: string
  name?: string
  fotoRecht?: boolean // Trainer darf Personen-Fotos hochladen/löschen (Admin darf immer)
  kursRecht?: boolean // Ausbildungsverantwortlicher: darf Kurse (Trainer-Qualifikationsstufen) markieren
  nachwuchsVerantwortlich?: boolean // darf die Coach-Nominationen markieren
}

export const BenutzerContext = createContext<Benutzer>({ rolle: 'lokal' })
export const useBenutzer = () => useContext(BenutzerContext)

export function useHashRoute(): string[] {
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

/**
 * Eigene, kleine Weiche für die Familie-Routen — wird sowohl vom normalen Router (Trainer/Master
 * navigieren zum Absenzentool-Tab) als auch direkt für reine Familie-Konten verwendet (die sonst
 * keinen Zugriff auf SyncApp/Router haben, siehe ApiApp).
 */
function FamilieRouter() {
  const seg = useHashRoute()
  if (seg[0] === 'meine-kinder' && seg[1] === 'termine' && seg[2]) return <MeineKinderTermine personId={seg[2]} />
  if (seg[0] === 'personen') return <PersonenFamilie />
  return <MeineKinder />
}

function Router({ state, update }: { state: AppState; update: Update }) {
  const seg = useHashRoute()
  const benutzer = useBenutzer()
  const istMaster = benutzer.rolle !== 'trainer'

  if (seg[0] === 'gruppe' && seg[1] && seg[2] === 'termin' && seg[3]) {
    return <TerminDetail state={state} update={update} gruppeId={seg[1]} terminId={seg[3]} />
  }
  if (seg[0] === 'gruppe' && seg[1] && seg[2] === 'kommend') return <TermineListe state={state} gruppeId={seg[1]} modus="kommend" />
  if (seg[0] === 'gruppe' && seg[1] && seg[2] === 'archiv') return <TermineListe state={state} gruppeId={seg[1]} modus="archiviert" />
  if (seg[0] === 'gruppe' && seg[1]) return <GruppeDetail state={state} update={update} gruppeId={seg[1]} />
  if (seg[0] === 'meine-kinder') return <FamilieRouter />
  if (seg[0] === 'personen') return <PersonenListe state={state} />
  if (seg[0] === 'personen-archiv' && istMaster) return <PersonenArchiv state={state} update={update} />
  if (seg[0] === 'person' && seg[1]) return <PersonEdit state={state} update={update} personId={seg[1]} />
  if (seg[0] === 'import' && istMaster) return <ImportView state={state} update={update} />
  if (seg[0] === 'export' && istMaster) return <AdminHub state={state} update={update} />
  if (seg[0] === 'nds-export' && istMaster) return <ExportView state={state} />
  if (seg[0] === 'trainer' && benutzer.rolle === 'master') return <TrainerAdmin eigeneEmail={benutzer.email!} />
  if (seg[0] === 'familie-zugriffe' && benutzer.rolle === 'master') return <FamilieZugriffe />
  if (seg[0] === 'backup' && istMaster) return <BackupView state={state} update={update} />
  if (seg[0] === 'gruppen-verwalten' && istMaster) return <GruppenVerwaltung state={state} update={update} />
  if (seg[0] === 'halbjahresabschluss' && istMaster) return <Halbjahresabschluss state={state} update={update} />
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

interface Synchronisierung {
  abonnieren: typeof abonnieren
  diffSchreiben: typeof diffSchreiben
}

/** Login/Freischaltung erledigt der Aufrufer (Firebase oder API) — hier nur noch Live-Sync/Anzeige. */
function SyncApp({ info, sync }: { info: TrainerInfo; sync: Synchronisierung }) {
  const istMaster = info.rolle === 'master'
  const [state, setState] = useState<AppState | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const aktuell = useRef<AppState | null>(null)

  useEffect(() => {
    return sync.abonnieren(istMaster, s => {
      aktuell.current = s
      setState(s)
    }, f => setFehler(f))
    // sync.abonnieren ist über die Modul-Laufzeit stabil (nur istMaster steuert Neustarts).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [istMaster, sync.abonnieren])

  const update: Update = fn => {
    const alt = aktuell.current
    if (!alt) return
    const neu = fn(alt)
    aktuell.current = neu
    setState(neu) // optimistisch — Sync bestätigt/korrigiert danach
    sync.diffSchreiben(alt, neu, istMaster).catch(e => setFehler('Speichern fehlgeschlagen: ' + String(e)))
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
    <BenutzerContext.Provider value={{
      rolle: info.rolle, email: info.email, name: info.name, fotoRecht: info.fotoRecht,
      kursRecht: info.kursRecht, nachwuchsVerantwortlich: info.nachwuchsVerantwortlich,
    }}>
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
  return <SyncApp info={info} sync={{ abonnieren, diffSchreiben }} />
}

/** RudelCheck-Backend-Modus: Google-Login per Identity Services, REST+Polling statt Firestore. */
function ApiApp() {
  const [status, setStatus] = useState<'lädt' | 'ausgeloggt' | 'nicht-freigeschaltet' | 'bereit'>('lädt')
  const [info, setInfo] = useState<TrainerInfo | null>(null)

  useEffect(() => {
    meAbrufen().then(i => {
      if (i) { setInfo(i); setStatus('bereit') } else setStatus('ausgeloggt')
    })
  }, [])

  if (status === 'lädt') return <LadeAnzeige text="Prüfe Anmeldung …" />
  if (status === 'ausgeloggt') {
    return <ApiLoginView auf={ergebnis => {
      if (ergebnis.status === 'ok') { setInfo(ergebnis.info); setStatus('bereit') }
      else if (ergebnis.status === 'nicht-freigeschaltet') setStatus('nicht-freigeschaltet')
    }} />
  }
  if (status === 'nicht-freigeschaltet') return <ApiNichtFreigeschaltet />
  // Familie-Konten (Eltern/Spieler:innen, An-/Abmeldefunktion) haben keinen Zugriff auf den
  // vollen Trainer-AppState — eigene, schlanke Ansicht statt SyncApp/Router.
  if (info!.rolle === 'familie') {
    return (
      <BenutzerContext.Provider value={{ rolle: 'familie', email: info!.email }}>
        <FamilieRouter />
      </BenutzerContext.Provider>
    )
  }
  return <SyncApp info={info!} sync={{ abonnieren: apiSync.abonnieren, diffSchreiben: apiSync.diffSchreiben }} />
}

export default function App() {
  if (apiAktiv) return <ApiApp />
  return firebaseAktiv ? <FirebaseApp /> : <LokalApp />
}

export function Seite(props: {
  titel: string
  zurueck?: string
  tab?: 'gruppen' | 'meine-kinder' | 'personen' | 'export'
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
          <>
            <span className="konto" title={`Angemeldet als ${benutzer.email}`}>
              {(benutzer.name || benutzer.email || '?').slice(0, 1).toUpperCase()}
            </span>
            <button
              className="abmelden"
              title="Abmelden"
              aria-label="Abmelden"
              onClick={async () => {
                if (!confirm('Abmelden?')) return
                if (apiAktiv) { await apiAbmelden(); window.location.reload() } else await firebaseAbmelden()
              }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 4v6" />
                <path d="M6.5 6.5a7 7 0 1 0 11 0" />
              </svg>
            </button>
          </>
        )}
      </div>
      {props.children}
      <nav className="bottomnav">
        {benutzer.rolle === 'familie' ? (
          <>
            <a href="#/meine-kinder" className={props.tab !== 'personen' ? 'aktiv' : ''}>
              <span className="icon">👪</span>Absenzentool
            </a>
            <a href="#/personen" className={props.tab === 'personen' ? 'aktiv' : ''}>
              <span className="icon">👥</span>Personen
            </a>
          </>
        ) : (
          <>
            <a href="#/" className={props.tab === 'gruppen' ? 'aktiv' : ''}>
              <span className="icon">🏑</span>Absenzen für Coaches
            </a>
            {apiAktiv && (
              <a href="#/meine-kinder" className={props.tab === 'meine-kinder' ? 'aktiv' : ''}>
                <span className="icon">👪</span>Absenzentool
              </a>
            )}
            <a href="#/personen" className={props.tab === 'personen' ? 'aktiv' : ''}>
              <span className="icon">👥</span>Personen
            </a>
            {benutzer.rolle !== 'trainer' && (
              <a href="#/export" className={props.tab === 'export' ? 'aktiv' : ''}>
                <span className="icon">⚙️</span>Admin
              </a>
            )}
          </>
        )}
      </nav>
    </div>
  )
}
