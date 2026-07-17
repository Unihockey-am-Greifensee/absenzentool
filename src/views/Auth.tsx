import { useEffect, useRef, useState } from 'react'
import { abmelden, googleAnmelden } from '../firebase'
import { abmelden as apiAbmelden, codeAnfordern, codeBestaetigen, googleButtonRendern, type AnmeldeErgebnis } from '../lib/apiAuth'
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

/**
 * Login-Ansicht für den API-Modus (RudelCheck-Backend statt Firebase) — GIS-Button statt Popup.
 * Dient sowohl Trainern (Google, @grizzlys.club) als auch Eltern/Spieler:innen der
 * An-/Abmeldefunktion (beliebiges Google-Konto oder E-Mail-Code) — derselbe Login-Bildschirm,
 * die Rolle wird serverseitig anhand der E-Mail bestimmt (routes/auth.ts).
 */
export function ApiLoginView({ auf }: { auf: (ergebnis: AnmeldeErgebnis) => void }) {
  const container = useRef<HTMLDivElement>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [schritt, setSchritt] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [lädt, setLädt] = useState(false)

  useEffect(() => {
    if (!container.current) return
    googleButtonRendern(container.current, ergebnis => {
      if (ergebnis.status === 'fehler') setFehler(ergebnis.meldung)
      else auf(ergebnis)
    }).catch(e => setFehler(String(e)))
  }, [auf])

  const codeAnfordernKlick = async () => {
    setLädt(true)
    setFehler(null)
    const ergebnis = await codeAnfordern(email.trim())
    setLädt(false)
    if (!ergebnis.ok) { setFehler(ergebnis.meldung); return }
    setSchritt('code')
  }

  const codeBestaetigenKlick = async () => {
    setLädt(true)
    setFehler(null)
    const ergebnis = await codeBestaetigen(email.trim(), code.trim())
    setLädt(false)
    if (!ergebnis.ok) { setFehler(ergebnis.meldung); return }
    auf({ status: 'ok', info: ergebnis.info })
  }

  return (
    <div className="app" style={{ paddingTop: '14vh', textAlign: 'center' }}>
      <img src={logo} alt="Grizzlys – Unihockey am Greifensee" style={{ width: '7rem', height: '7rem', margin: '0 auto' }} />
      <h1 style={{ margin: '0.75rem 0 0.25rem' }}>RudelCheck</h1>
      <p style={{ color: 'var(--muted)', maxWidth: '32ch', margin: '0 auto 1.5rem' }}>
        Anwesenheitskontrolle und J+S-Export für die Grizzlys. Eltern und Spieler:innen können
        sich hier ebenfalls an-/abmelden.
      </p>
      <div ref={container} style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.2rem' }} />

      <div className="sub" style={{ margin: '0.5rem 0' }}>oder mit E-Mail-Code (für Eltern/Spieler:innen)</div>
      <div className="karte" style={{ maxWidth: '320px', margin: '0 auto', textAlign: 'left' }}>
        {schritt === 'email' ? (
          <>
            <label className="feld">E-Mail-Adresse
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@beispiel.ch" />
            </label>
            <button className="breit" disabled={lädt || !/^\S+@\S+\.\S+$/.test(email.trim())} onClick={() => void codeAnfordernKlick()}>
              Code anfordern
            </button>
          </>
        ) : (
          <>
            <div className="sub" style={{ marginBottom: '0.5rem' }}>Code wurde an {email} geschickt.</div>
            <label className="feld">Code
              <input value={code} onChange={e => setCode(e.target.value)} placeholder="123456" />
            </label>
            <button className="breit" disabled={lädt || code.trim().length < 6} onClick={() => void codeBestaetigenKlick()}>
              Bestätigen
            </button>
            <button className="leise breit" style={{ marginTop: '0.4rem' }} onClick={() => { setSchritt('email'); setCode('') }}>
              Andere E-Mail-Adresse
            </button>
          </>
        )}
      </div>
      {fehler && <div className="hinweis fehler" style={{ marginTop: '1rem', maxWidth: '320px', marginInline: 'auto' }}>{fehler}</div>}
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
