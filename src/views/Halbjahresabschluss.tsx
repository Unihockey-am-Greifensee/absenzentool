import { useState } from 'react'
import type { AppState } from '../types'
import { Seite, type Update } from '../App'
import { heute } from '../lib/datum'
import { terminAbschliessenBisStichtag, zaehleAbzuschliessendeTermine } from '../lib/termine'

export function Halbjahresabschluss({ state, update }: { state: AppState; update: Update }) {
  const [stichtag, setStichtag] = useState(heute())
  const [ergebnis, setErgebnis] = useState<number | null>(null)

  const anzahl = zaehleAbzuschliessendeTermine(state, stichtag)

  const abschliessen = () => {
    if (!confirm(
      `${anzahl} Termine bis und mit ${chDatum(stichtag)} endgültig abschliessen? ` +
      'Danach lässt sich die Anwesenheit dort nur noch einzeln pro Termin über «Wieder öffnen» bearbeiten.'
    )) return
    const { state: neu, anzahl: n } = terminAbschliessenBisStichtag(state, stichtag)
    update(() => neu)
    setErgebnis(n)
  }

  return (
    <Seite titel="Halbjahresabschluss" zurueck="export" tab="export">
      <div className="hinweis info">
        Schliesst auf einen Schlag alle Termine bis zu einem Stichtag ab — wie der «Abschliessen»-Knopf
        bei einem einzelnen Termin, nur für alle Gruppen gleichzeitig. Danach lässt sich die Anwesenheit
        nicht mehr versehentlich ändern, und die Termine erscheinen in jeder Gruppe unter «Abgeschlossene
        Termine» statt bei den aktuellen. Exportiere die Daten am besten vorher unter{' '}
        <a href="#/nds-export">NDS-Export</a>.
      </div>

      <div className="karte">
        <label className="feld">Stichtag (Termine bis und mit diesem Datum werden abgeschlossen)
          <input type="date" value={stichtag} onChange={e => setStichtag(e.target.value)} />
        </label>
        <div className="hinweis warnung" style={{ marginBottom: 0 }}>
          {anzahl === 0
            ? 'Keine offenen Termine bis zu diesem Datum — nichts zu tun.'
            : `${anzahl} Termine über alle Gruppen sind noch offen und würden abgeschlossen.`}
        </div>
      </div>

      <div className="btnreihe">
        <button className="breit" disabled={anzahl === 0} onClick={abschliessen}>
          {anzahl} Termine abschliessen
        </button>
      </div>

      {ergebnis !== null && (
        <div className="hinweis info">{ergebnis} Termine wurden abgeschlossen.</div>
      )}
    </Seite>
  )
}

function chDatum(iso: string): string {
  const [j, m, t] = iso.split('-')
  return `${t}.${m}.${j}`
}
