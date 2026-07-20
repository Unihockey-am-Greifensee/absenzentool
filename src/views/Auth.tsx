import { useEffect, useRef, useState } from 'react'
import { abmelden, googleAnmelden } from '../firebase'
import {
  abmelden as apiAbmelden, codeAnfordern, codeBestaetigen, googleButtonRendern,
  meAbrufen, passwortAnmelden, passwortSetzen, type AnmeldeErgebnis,
} from '../lib/apiAuth'
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
  // 'erstellen': E-Mail -> Code (Datenbank-Abgleich mit einem Kind, siehe routes/auth.ts
  // code-anfordern) -> Passwort festlegen. 'anmelden': direkt E-Mail + Passwort.
  const [modus, setModus] = useState<'erstellen' | 'anmelden'>('erstellen')
  const [schritt, setSchritt] = useState<'email' | 'code' | 'passwort'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [passwort, setPasswort] = useState('')
  const [wiederholung, setWiederholung] = useState('')
  const [lädt, setLädt] = useState(false)

  useEffect(() => {
    if (!container.current) return
    googleButtonRendern(container.current, ergebnis => {
      if (ergebnis.status === 'fehler') setFehler(ergebnis.meldung)
      else auf(ergebnis)
    }).catch(e => setFehler(String(e)))
  }, [auf])

  const modusWechseln = (neu: 'erstellen' | 'anmelden') => {
    setModus(neu); setSchritt('email'); setFehler(null)
    setCode(''); setPasswort(''); setWiederholung('')
  }

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
    // Setzt bereits eine gültige Session (siehe /auth/code-bestaetigen) — der letzte Schritt
    // (Passwort festlegen) läuft deshalb schon authentifiziert über /auth/familie/passwort-setzen.
    const ergebnis = await codeBestaetigen(email.trim(), code.trim())
    setLädt(false)
    if (!ergebnis.ok) { setFehler(ergebnis.meldung); return }
    setSchritt('passwort')
  }

  const passwortFestlegenKlick = async () => {
    setFehler(null)
    if (passwort.length < 8) { setFehler('Das Passwort muss mindestens 8 Zeichen haben.'); return }
    if (passwort !== wiederholung) { setFehler('Die beiden Passwörter stimmen nicht überein.'); return }
    setLädt(true)
    const ergebnis = await passwortSetzen(passwort)
    setLädt(false)
    if (!ergebnis.ok) { setFehler(ergebnis.meldung); return }
    const info = await meAbrufen()
    if (info) auf({ status: 'ok', info })
  }

  const passwortAnmeldenKlick = async () => {
    setLädt(true)
    setFehler(null)
    const ergebnis = await passwortAnmelden(email.trim(), passwort)
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

      <div className="sub" style={{ margin: '0.5rem 0' }}>oder mit einem Konto für Eltern/Spieler:innen</div>
      <div className="btnreihe" style={{ justifyContent: 'center', marginTop: 0 }}>
        <button className={modus === 'erstellen' ? '' : 'sekundaer'} onClick={() => modusWechseln('erstellen')}>Konto erstellen</button>
        <button className={modus === 'anmelden' ? '' : 'sekundaer'} onClick={() => modusWechseln('anmelden')}>Anmelden</button>
      </div>
      <div className="karte" style={{ maxWidth: '320px', margin: '0.75rem auto 0', textAlign: 'left' }}>
        {modus === 'erstellen' && schritt === 'email' && (
          <>
            <div className="sub" style={{ marginBottom: '0.5rem' }}>
              Wir gleichen die E-Mail-Adresse mit den beim Verein hinterlegten Kindern ab und
              schicken dir zur Bestätigung einen Code.
            </div>
            <label className="feld">E-Mail-Adresse
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@beispiel.ch" />
            </label>
            <button className="breit" disabled={lädt || !/^\S+@\S+\.\S+$/.test(email.trim())} onClick={() => void codeAnfordernKlick()}>
              Code anfordern
            </button>
          </>
        )}
        {modus === 'erstellen' && schritt === 'code' && (
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
        {modus === 'erstellen' && schritt === 'passwort' && (
          <>
            <div className="sub" style={{ marginBottom: '0.5rem' }}>
              E-Mail bestätigt. Jetzt noch ein Passwort für künftige Logins festlegen.
            </div>
            <label className="feld">Passwort (mind. 8 Zeichen)
              <input type="password" value={passwort} onChange={e => setPasswort(e.target.value)} />
            </label>
            <label className="feld">Passwort wiederholen
              <input type="password" value={wiederholung} onChange={e => setWiederholung(e.target.value)} />
            </label>
            <button className="breit" disabled={lädt || !passwort || !wiederholung} onClick={() => void passwortFestlegenKlick()}>
              Konto erstellen
            </button>
          </>
        )}
        {modus === 'anmelden' && (
          <>
            <label className="feld">E-Mail-Adresse
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@beispiel.ch" />
            </label>
            <label className="feld">Passwort
              <input type="password" value={passwort} onChange={e => setPasswort(e.target.value)} />
            </label>
            <button className="breit" disabled={lädt || !passwort || !/^\S+@\S+\.\S+$/.test(email.trim())} onClick={() => void passwortAnmeldenKlick()}>
              Anmelden
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
