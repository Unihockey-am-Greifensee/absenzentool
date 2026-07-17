import { useEffect, useState } from 'react'
import { familieZugriffeLaden, type FamilieZugriff } from '../lib/apiSync'
import { Seite } from '../App'

function chDatumZeit(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Admin-Übersicht: wer hat sich über die An-/Abmeldefunktion (Absenzentool) je angemeldet. */
export function FamilieZugriffe() {
  const [liste, setListe] = useState<FamilieZugriff[] | null>(null)

  useEffect(() => { familieZugriffeLaden().then(setListe) }, [])

  return (
    <Seite titel="Absenzentool-Zugriffe" zurueck="export" tab="export">
      <div className="hinweis info">
        Eltern/Spieler:innen haben kein festes Konto — der Zugriff wird bei jedem Login live
        gegen die E-Mail-Felder der Personen abgeglichen. Diese Liste zeigt, welche E-Mail-Adressen
        sich tatsächlich schon mal angemeldet haben (Google oder Code) und zu welchen Kindern sie
        aktuell passen.
      </div>
      {liste === null && <div className="sub" style={{ padding: '0.6rem 0' }}>Lädt …</div>}
      {liste?.length === 0 && <div className="leer">Noch niemand hat sich im Absenzentool angemeldet.</div>}
      <div className="karte" style={{ padding: '0.2rem 1rem' }}>
        {liste?.map(z => (
          <div key={z.email} className="zeile">
            <div className="haupt">
              <div className="titel">{z.email}</div>
              <div className="sub">
                {z.kinder.length === 0
                  ? 'Passt aktuell zu keiner Person mehr'
                  : z.kinder.map(k => `${k.vorname} ${k.nachname}`).join(', ')}
              </div>
              <div className="sub">
                Letzter Login: {chDatumZeit(z.letzterLogin)} · {z.anzahlLogins}× insgesamt seit {chDatumZeit(z.ersterLogin)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Seite>
  )
}
