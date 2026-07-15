import { useState } from 'react'
import type { AppState } from '../types'
import { Seite, type Update } from '../App'
import { heute } from '../lib/datum'
import { terminArchivierenBisStichtag, zaehleZuArchivierendeTermine } from '../lib/termine'

export function Halbjahresabschluss({ state, update }: { state: AppState; update: Update }) {
  const [stichtag, setStichtag] = useState(heute())
  const [ergebnis, setErgebnis] = useState<number | null>(null)

  const anzahl = zaehleZuArchivierendeTermine(state, stichtag)

  const archivieren = () => {
    if (!confirm(
      `${anzahl} Termine bis und mit ${chDatum(stichtag)} archivieren? ` +
      'Die Anwesenheit lässt sich dort danach nicht mehr bearbeiten — nur der Admin kann das über den ' +
      'einzelnen Termin wieder aufheben, Trainer können es nicht selbst rückgängig machen.'
    )) return
    const { state: neu, anzahl: n } = terminArchivierenBisStichtag(state, stichtag)
    update(() => neu)
    setErgebnis(n)
  }

  return (
    <Seite titel="Halbjahresabschluss" zurueck="export" tab="export">
      <div className="hinweis info">
        Archiviert auf einen Schlag alle Termine bis zu einem Stichtag, über alle Gruppen gleichzeitig —
        unabhängig davon, ob ein Trainer sie schon selbst «abgeschlossen» hat. Archivierte Termine lassen
        sich nicht mehr bearbeiten und erscheinen in jeder Gruppe unter «Archivierte Termine»; nur der
        Admin kann die Archivierung pro Termin wieder aufheben. Exportiere die Daten am besten vorher
        unter <a href="#/nds-export">NDS-Export</a>.
      </div>

      <div className="karte">
        <label className="feld">Stichtag (Termine bis und mit diesem Datum werden archiviert)
          <input type="date" value={stichtag} onChange={e => setStichtag(e.target.value)} />
        </label>
        <div className="hinweis warnung" style={{ marginBottom: 0 }}>
          {anzahl === 0
            ? 'Keine unarchivierten Termine bis zu diesem Datum — nichts zu tun.'
            : `${anzahl} Termine über alle Gruppen sind noch nicht archiviert und wären betroffen.`}
        </div>
      </div>

      <div className="btnreihe">
        <button className="breit" disabled={anzahl === 0} onClick={archivieren}>
          {anzahl} Termine archivieren
        </button>
      </div>

      {ergebnis !== null && (
        <div className="hinweis info">{ergebnis} Termine wurden archiviert.</div>
      )}
    </Seite>
  )
}

function chDatum(iso: string): string {
  const [j, m, t] = iso.split('-')
  return `${t}.${m}.${j}`
}
