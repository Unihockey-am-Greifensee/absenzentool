import { useEffect, useRef, useState } from 'react'
import { abmelden, googleAnmelden } from '../firebase'
import { abmelden as apiAbmelden, googleButtonRendern, type AnmeldeErgebnis } from '../lib/apiAuth'
import logo from '../assets/grizzlys-logo.png'

export function LoginView() {
  return (
    <div className="app" style={{ paddingTop: '14vh', textAlign: 'center' }}>
      <img src={logo} alt="Grizzlys – Unihockey am Greifensee" style={{ width: '7rem', height: '7rem', margin: '0 auto' }} />
      <h1 style={{ margin: '0.75rem 0 0.25rem' }}>RudelCheck</h1>
      <p style={{ color: 'var(--muted)', maxWidth: '32ch', margin: '0 auto 1.5rem' }}>
        Anwesenheitskontrolle und J+S-Export für die Grizzlys.
      </p>
      <button onClick={() => googleAnmelden().catch(e => alert('Anmeldung fehlgeschlagen: ' + e))}>
        Mit Google anmelden
      </button>
    </div>
  )
}

export function NichtFreigeschaltet({ email }: { email: string }) {
  return (
    <div className="app" style={{ paddingTop: '18vh', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem' }}>🔒</div>
      <h1 style={{ margin: '0.5rem 0 0.25rem', fontSize: '1.3rem' }}>Noch nicht freigeschaltet</h1>
      <p style={{ color: 'var(--muted)', maxWidth: '38ch', margin: '0 auto 1.5rem' }}>
        Das Konto <b>{email}</b> ist noch keinem Trainer zugeordnet.
        Melde dich bei der Absenzen-Verantwortung des Vereins, damit sie dich freischaltet.
      </p>
      <button className="leise" onClick={() => abmelden()}>Anderes Konto verwenden</button>
    </div>
  )
}

/** Login-Ansicht für den API-Modus (RudelCheck-Backend statt Firebase) — GIS-Button statt Popup. */
export function ApiLoginView({ auf }: { auf: (ergebnis: AnmeldeErgebnis) => void }) {
  const container = useRef<HTMLDivElement>(null)
  const [fehler, setFehler] = useState<string | null>(null)

  useEffect(() => {
    if (!container.current) return
    googleButtonRendern(container.current, ergebnis => {
      if (ergebnis.status === 'fehler') setFehler(ergebnis.meldung)
      else auf(ergebnis)
    }).catch(e => setFehler(String(e)))
  }, [auf])

  return (
    <div className="app" style={{ paddingTop: '14vh', textAlign: 'center' }}>
      <img src={logo} alt="Grizzlys – Unihockey am Greifensee" style={{ width: '7rem', height: '7rem', margin: '0 auto' }} />
      <h1 style={{ margin: '0.75rem 0 0.25rem' }}>RudelCheck</h1>
      <p style={{ color: 'var(--muted)', maxWidth: '32ch', margin: '0 auto 1.5rem' }}>
        Anwesenheitskontrolle und J+S-Export für die Grizzlys.
      </p>
      <div ref={container} style={{ display: 'flex', justifyContent: 'center' }} />
      {fehler && <div className="hinweis fehler" style={{ marginTop: '1rem' }}>{fehler}</div>}
    </div>
  )
}

export function ApiNichtFreigeschaltet() {
  return (
    <div className="app" style={{ paddingTop: '18vh', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem' }}>🔒</div>
      <h1 style={{ margin: '0.5rem 0 0.25rem', fontSize: '1.3rem' }}>Noch nicht freigeschaltet</h1>
      <p style={{ color: 'var(--muted)', maxWidth: '38ch', margin: '0 auto 1.5rem' }}>
        Dieses Konto ist noch keinem Trainer zugeordnet. Melde dich bei der
        Absenzen-Verantwortung des Vereins, damit sie dich freischaltet.
      </p>
      <button className="leise" onClick={() => { apiAbmelden(); window.location.reload() }}>Anderes Konto verwenden</button>
    </div>
  )
}

export function LadeAnzeige({ text }: { text: string }) {
  return (
    <div className="app" style={{ paddingTop: '25vh', textAlign: 'center', color: 'var(--muted)' }}>
      {text}
    </div>
  )
}
