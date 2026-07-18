import { useEffect, useState } from 'react'
import { aktivitaetLogLaden, type LogEintrag } from '../lib/apiSync'
import { Seite } from '../App'

const AKTION_LABEL: Record<string, string> = {
  login: 'Login',
  anwesenheit_geaendert: 'Anwesenheit geändert',
  person_bearbeitet: 'Person bearbeitet',
  trainer_rechte_geaendert: 'Trainer-Rechte geändert',
  kurs_eingetragen: 'Kurs eingetragen',
  kurs_entfernt: 'Kurs entfernt',
  foto_hochgeladen: 'Foto hochgeladen',
  teamfoto_hochgeladen: 'Teamfoto hochgeladen',
  mitglied_geaendert: 'Mitglied/Funktion geändert',
}

function chDatumZeit(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/**
 * Admin-Übersicht: Logins (Trainer + Familie) und die wichtigsten Änderungen an
 * Personen-Daten. Kein lückenloses Audit-Log — nur an ausgewählten Stellen im Backend
 * protokolliert (siehe rudelcheck-server/src/lib/aktivitaetLog.ts).
 */
export function AktivitaetLog() {
  const [liste, setListe] = useState<LogEintrag[] | null>(null)
  const [suche, setSuche] = useState('')

  useEffect(() => { aktivitaetLogLaden().then(setListe) }, [])

  const gefiltert = (liste ?? []).filter(e => {
    const text = suche.trim().toLowerCase()
    if (!text) return true
    return e.email.toLowerCase().includes(text) || (e.personName?.toLowerCase().includes(text) ?? false)
  })

  return (
    <Seite titel="Aktivitäts-Log" zurueck="export" tab="export">
      <div className="hinweis info">
        Zeigt Logins (Trainer + Familie) und die wichtigsten Änderungen (Anwesenheit, Personen-
        Bearbeitung, Kurse, Fotos, Trainer-Rechte) — kein lückenloses Protokoll aller Klicks.
        Die letzten 500 Einträge, neueste zuerst.
      </div>
      <input className="suchfeld" placeholder="Nach E-Mail oder Person suchen …" value={suche} onChange={e => setSuche(e.target.value)} />
      {liste === null && <div className="sub" style={{ padding: '0.6rem 0' }}>Lädt …</div>}
      {liste?.length === 0 && <div className="leer">Noch keine Einträge vorhanden.</div>}
      <div className="karte" style={{ padding: '0.2rem 1rem' }}>
        {gefiltert.map(e => (
          <div key={e.id} className="zeile">
            <div className="haupt">
              <div className="titel">
                {AKTION_LABEL[e.aktion] ?? e.aktion}
                {e.personName && <> — {e.personName}</>}
              </div>
              <div className="sub">
                {chDatumZeit(e.zeitpunkt)} · {e.email} ({e.typ === 'trainer' ? 'Trainer' : 'Familie'})
              </div>
              {e.beschreibung && <div className="sub">{e.beschreibung}</div>}
            </div>
          </div>
        ))}
        {liste && liste.length > 0 && gefiltert.length === 0 && <div className="sub" style={{ padding: '0.6rem 0' }}>Keine Treffer.</div>}
      </div>
    </Seite>
  )
}
