import { useState } from 'react'
import * as XLSX from 'xlsx'
import type { AppState } from '../types'
import { Seite, type Update } from '../App'
import { koolImportieren, type ImportErgebnis, type KoolZeile } from '../lib/koolImport'

export function ImportView({ state, update }: { state: AppState; update: Update }) {
  const [ergebnis, setErgebnis] = useState<ImportErgebnis | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)

  const importieren = async (file: File) => {
    setFehler(null)
    setErgebnis(null)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { cellDates: true })
      const blatt = wb.Sheets['kOOL'] ?? wb.Sheets[wb.SheetNames[0]]
      const zeilen = XLSX.utils.sheet_to_json<KoolZeile>(blatt, { defval: null })
      if (zeilen.length === 0) { setFehler('Die Datei enthält keine Datenzeilen.'); return }
      const res = koolImportieren(state, zeilen)
      update(() => res.state)
      setErgebnis(res.ergebnis)
    } catch (e) {
      setFehler('Datei konnte nicht gelesen werden: ' + String(e))
    }
  }

  return (
    <Seite titel="kOOL-Import" zurueck="" tab="gruppen">
      <div className="karte">
        <p style={{ marginTop: 0 }}>
          Lade hier den <b>kOOL-Export</b> hoch (Excel-Datei mit den Spalten Vorname, Nachname, Adresse,
          PLZ, Ort, Land, AHV-Nummer, E-Mail, Geschlecht, Geburtsdatum, J+S-Nummer, Teams).
        </p>
        <p className="sub" style={{ color: 'var(--muted)' }}>
          Der Import gleicht über AHV-Nummer bzw. Name + Geburtsdatum ab: Bestehende Personen werden
          aktualisiert, neue angelegt, Teams werden zu Trainingsgruppen. Manuell erfasste Daten bleiben erhalten.
        </p>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={e => e.target.files?.[0] && importieren(e.target.files[0])}
        />
      </div>

      {fehler && <div className="hinweis fehler">{fehler}</div>}
      {ergebnis && (
        <div className="hinweis info">
          <b>Import abgeschlossen.</b><br />
          {ergebnis.neuePersonen} neue Personen, {ergebnis.aktualisiertePersonen} aktualisiert,{' '}
          {ergebnis.neueGruppen} neue Gruppen, {ergebnis.mitgliedschaften} neue Mitgliedschaften.
          <div className="btnreihe" style={{ marginBottom: 0 }}>
            <a className="btn" href="#/">Zu den Gruppen</a>
          </div>
        </div>
      )}
    </Seite>
  )
}
