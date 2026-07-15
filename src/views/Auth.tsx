import { abmelden, googleAnmelden } from '../firebase'

export function LoginView({ fehler }: { fehler?: string | null }) {
  return (
    <div className="app" style={{ paddingTop: '18vh', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem' }}>🏑</div>
      <h1 style={{ margin: '0.5rem 0 0.25rem' }}>Absenzentool</h1>
      <p style={{ color: 'var(--muted)', maxWidth: '32ch', margin: '0 auto 1.5rem' }}>
        Anwesenheitskontrolle und J+S-Export für die Grizzlys.
      </p>
      {fehler && (
        <div className="hinweis fehler" style={{ maxWidth: '34ch', margin: '0 auto 1rem', textAlign: 'left' }}>
          Anmeldung fehlgeschlagen — das ist ein bekanntes, sporadisches Problem
          einzelner Browser. Bitte nochmals versuchen.
        </div>
      )}
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

export function LadeAnzeige({ text }: { text: string }) {
  return (
    <div className="app" style={{ paddingTop: '25vh', textAlign: 'center', color: 'var(--muted)' }}>
      {text}
    </div>
  )
}
