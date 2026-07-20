import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/apiClient'
import { Seite } from '../App'

// Kontaktliste für Familie-Konten (Eltern/Spieler:innen) — ganzer Verein, aber bewusst nur
// Name, E-Mail(s), Ort und Team-Zugehörigkeit, keine Adresse/AHV/Telefon (Datenschutz). Analog
// zu PersonenListe.tsx, aber gegen die eigene, schmale /api/familie/personen-Route statt AppState.

interface PersonEmail {
  id: string
  vorname: string
  nachname: string
  ort?: string
  gruppen: string[]
  email?: string
  emailMutter?: string
  emailVater?: string
}

export function PersonenFamilie() {
  const [personen, setPersonen] = useState<PersonEmail[] | null>(null)
  const [suche, setSuche] = useState('')

  useEffect(() => {
    apiFetch('/api/familie/personen').then(r => r.ok ? r.json() : Promise.reject(r.status)).then(setPersonen)
  }, [])

  if (!personen) return <div className="app" style={{ paddingTop: '25vh', textAlign: 'center', color: 'var(--muted)' }}>Lädt …</div>

  const gefiltert = personen.filter(p => `${p.vorname} ${p.nachname}`.toLowerCase().includes(suche.trim().toLowerCase()))

  return (
    <Seite titel="Personen" tab="personen">
      <input className="suchfeld" placeholder="Suchen …" value={suche} onChange={e => setSuche(e.target.value)} />
      <div className="sub" style={{ marginBottom: '0.5rem', color: 'var(--muted)' }}>
        {gefiltert.length} von {personen.length} Personen
      </div>
      <div className="karte" style={{ padding: '0.2rem 1rem' }}>
        {gefiltert.slice(0, 100).map(p => (
          <div key={p.id} className="zeile">
            <div className="haupt">
              <div className="titel">{p.vorname} {p.nachname}</div>
              <div className="sub">
                {[p.gruppen.join(', ') || null, p.ort].filter(Boolean).join(' · ') || 'Keinem Team zugeteilt'}
              </div>
              <div className="sub">
                {[p.email, p.emailMutter, p.emailVater].filter(Boolean).join(' · ') || 'Keine E-Mail hinterlegt'}
              </div>
            </div>
          </div>
        ))}
        {gefiltert.length === 0 && <div className="sub" style={{ padding: '0.6rem 0' }}>Keine Treffer.</div>}
        {gefiltert.length > 100 && <div className="sub" style={{ padding: '0.5rem 0' }}>… {gefiltert.length - 100} weitere — Suche verfeinern.</div>}
      </div>
    </Seite>
  )
}
