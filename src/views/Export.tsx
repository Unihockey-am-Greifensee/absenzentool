import { useState } from 'react'
import type { AppState } from '../types'
import { Seite, useBenutzer } from '../App'
import { ndsExport, type ExportResultat } from '../lib/ndsExport'

function saisonStart(): string {
  const jetzt = new Date()
  const jahr = jetzt.getMonth() + 1 >= 8 ? jetzt.getFullYear() : jetzt.getFullYear() - 1
  return `${jahr}-08-01`
}
function saisonEnde(): string {
  const [j] = saisonStart().split('-')
  return `${Number(j) + 1}-07-31`
}

export function ExportView({ state }: { state: AppState }) {
  const benutzer = useBenutzer()
  const [von, setVon] = useState(saisonStart())
  const [bis, setBis] = useState(saisonEnde())
  const [gewaehlt, setGewaehlt] = useState<string[]>(state.gruppen.map(g => g.id))
  const [resultat, setResultat] = useState<ExportResultat | null>(null)

  const toggle = (id: string) =>
    setGewaehlt(g => (g.includes(id) ? g.filter(x => x !== id) : [...g, id]))

  const erzeugen = () => setResultat(ndsExport(state, { gruppenIds: gewaehlt, von, bis }))

  const herunterladen = (name: string, inhalt: string) => {
    const blob = new Blob([inhalt], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }

  const fehler = resultat?.befunde.filter(b => b.stufe === 'fehler') ?? []
  const warnungen = resultat?.befunde.filter(b => b.stufe === 'warnung') ?? []

  return (
    <Seite titel="Admin" tab="export">
      {benutzer.rolle === 'master' && (
        <div className="btnreihe" style={{ marginTop: 0 }}>
          <a className="btn sekundaer breit" href="#/trainer">Trainer-Verwaltung</a>
        </div>
      )}

      <h2 className="abschnitt" style={{ marginTop: 0 }}>NDS-Export</h2>
      <div className="karte">
        <div className="felder2">
          <label className="feld">Von<input type="date" value={von} onChange={e => { setVon(e.target.value); setResultat(null) }} /></label>
          <label className="feld">Bis<input type="date" value={bis} onChange={e => { setBis(e.target.value); setResultat(null) }} /></label>
        </div>
        <h2 className="abschnitt" style={{ marginTop: '0.25rem' }}>Gruppen</h2>
        {state.gruppen.map(g => (
          <div key={g.id} className="zeile" style={{ cursor: 'pointer' }} onClick={() => { toggle(g.id); setResultat(null) }}>
            <span className={'check' + (gewaehlt.includes(g.id) ? ' an' : '')}>✓</span>
            <div className="haupt"><div className="titel">{g.name}</div></div>
            <span className="sub">{g.aktivitaeten.filter(a => a.status === 'durchgefuehrt').length} erfasst</span>
          </div>
        ))}
        <div className="btnreihe" style={{ marginBottom: 0 }}>
          <button className="breit" onClick={erzeugen} disabled={gewaehlt.length === 0}>Prüfen und erzeugen</button>
        </div>
      </div>

      {resultat && (
        <>
          <div className="statzeile">
            <div className="stat"><b>{resultat.statistik.personen}</b><span>Personen</span></div>
            <div className="stat"><b>{resultat.statistik.aktivitaeten}</b><span>Aktivitäten</span></div>
            <div className="stat"><b>{resultat.statistik.anwesenheiten}</b><span>Anwesenheiten</span></div>
          </div>

          {fehler.length > 0 && (
            <div className="hinweis fehler">
              <b>{fehler.length} Fehler — der NDS-Import würde scheitern:</b>
              <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.2rem' }}>
                {fehler.slice(0, 15).map((b, i) => <li key={i}>{b.text}</li>)}
                {fehler.length > 15 && <li>… und {fehler.length - 15} weitere</li>}
              </ul>
            </div>
          )}
          {warnungen.length > 0 && (
            <details className="aufklapp">
              <summary>{warnungen.length} Warnungen anzeigen</summary>
              <div className="hinweis warnung">
                <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                  {warnungen.slice(0, 30).map((b, i) => <li key={i}>{b.text}</li>)}
                  {warnungen.length > 30 && <li>… und {warnungen.length - 30} weitere</li>}
                </ul>
              </div>
            </details>
          )}
          {fehler.length === 0 && warnungen.length === 0 && (
            <div className="hinweis info">Keine Beanstandungen — bereit für den NDS-Import.</div>
          )}

          <h2 className="abschnitt">Dateien (Import-Reihenfolge: Personen → Aktivitäten → AWK)</h2>
          <div className="karte" style={{ padding: '0.2rem 1rem' }}>
            {resultat.dateien.map(d => (
              <div key={d.name} className="zeile">
                <div className="haupt"><div className="titel" style={{ fontSize: '0.85rem', fontFamily: 'ui-monospace, monospace' }}>{d.name}</div>
                  <div className="sub">{d.inhalt.split('\r\n').length - 2} Zeilen</div></div>
                <button className="sekundaer" onClick={() => herunterladen(d.name, d.inhalt)}>⬇ CSV</button>
              </div>
            ))}
          </div>
          <div className="hinweis warnung">
            <b>Achtung beim NDS-Import:</b> Der Aktivitäten-Import löscht im NDS-Kurs bereits erfasste
            Aktivitäten samt Anwesenheiten. Export darum einmal pro Abrechnungsperiode, komplett.
          </div>
        </>
      )}
    </Seite>
  )
}
