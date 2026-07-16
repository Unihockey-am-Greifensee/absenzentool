import { useState } from 'react'
import type { AppState } from '../types'
import { Seite } from '../App'
import { heute } from '../lib/datum'
import { terminGruppen } from '../lib/termine'
import { terminZeile } from './GruppeDetail'

// Eigene Seite für die potenziell sehr langen Listen (Kommende/Archivierte Termine),
// damit sie nicht bei jedem Öffnen der Gruppe mitgerendert werden. Wird nur beim
// Klick auf den jeweiligen Link in der Gruppenübersicht geladen.

export function TermineListe({ state, gruppeId, modus }: {
  state: AppState; gruppeId: string; modus: 'kommend' | 'archiviert'
}) {
  const [anzahl, setAnzahl] = useState(30)
  const gruppe = state.gruppen.find(g => g.id === gruppeId)
  if (!gruppe) {
    return <Seite titel="Gruppe nicht gefunden" zurueck="" tab="gruppen"><div className="leer">Diese Gruppe existiert nicht (mehr).</div></Seite>
  }

  const heuteIso = heute()
  const alle = terminGruppen(gruppe)
  const liste = modus === 'kommend'
    ? alle.filter(t => !t.haupt.abgeschlossen && !t.haupt.archiviert && t.haupt.datum > heuteIso)
        .sort((a, b) => a.haupt.datum.localeCompare(b.haupt.datum) || (a.haupt.zeit ?? '').localeCompare(b.haupt.zeit ?? ''))
    : alle.filter(t => t.haupt.archiviert)
        .sort((a, b) => b.haupt.datum.localeCompare(a.haupt.datum) || (b.haupt.zeit ?? '').localeCompare(a.haupt.zeit ?? ''))

  const titel = modus === 'kommend' ? 'Kommende Termine' : 'Archivierte Termine'

  return (
    <Seite titel={titel} zurueck={`gruppe/${gruppeId}`} tab="gruppen">
      <div className="sub" style={{ margin: '-0.5rem 0 0.75rem', color: 'var(--muted)' }}>
        {gruppe.name} · {liste.length} {liste.length === 1 ? 'Termin' : 'Termine'}
      </div>
      {liste.length === 0 ? (
        <div className="leer">Keine {titel.toLowerCase()}.</div>
      ) : (
        <>
          <div className="karte" style={{ padding: '0.2rem 1rem' }}>
            {liste.slice(0, anzahl).map(t => terminZeile(gruppe, t))}
          </div>
          {anzahl < liste.length && (
            <div className="btnreihe">
              <button className="leise breit" onClick={() => setAnzahl(n => n + 50)}>
                {liste.length - anzahl} weitere anzeigen
              </button>
            </div>
          )}
        </>
      )}
    </Seite>
  )
}
