import { useState } from 'react'
import * as XLSX from 'xlsx'
import type { AppState } from '../types'
import { Seite, type Update } from '../App'
import {
  koolImportieren, sammleTeamNamen, teamZuordnungVorschlagen,
  type ImportErgebnis, type KoolZeile,
} from '../lib/koolImport'

type Schritt = 'datei' | 'zuordnung' | 'ergebnis'

export function ImportView({ state, update }: { state: AppState; update: Update }) {
  const [schritt, setSchritt] = useState<Schritt>('datei')
  const [zeilen, setZeilen] = useState<KoolZeile[] | null>(null)
  const [teamNamen, setTeamNamen] = useState<string[]>([])
  const [auswahl, setAuswahl] = useState<Record<string, string>>({})
  const [ueberschreiben, setUeberschreiben] = useState(true)
  const [ergebnis, setErgebnis] = useState<ImportErgebnis | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)

  const zurueckAufAnfang = () => {
    setSchritt('datei'); setZeilen(null); setTeamNamen([]); setAuswahl({}); setErgebnis(null); setFehler(null)
  }

  const dateiWaehlen = async (file: File) => {
    setFehler(null)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { cellDates: true })
      const blatt = wb.Sheets['kOOL'] ?? wb.Sheets[wb.SheetNames[0]]
      const gelesen = XLSX.utils.sheet_to_json<KoolZeile>(blatt, { defval: null })
      if (gelesen.length === 0) { setFehler('Die Datei enthält keine Datenzeilen.'); return }

      const namen = sammleTeamNamen(gelesen)
      const vorschlaege = teamZuordnungVorschlagen(state.gruppen, namen)
      const start: Record<string, string> = {}
      for (const v of vorschlaege) start[v.teamName] = v.gruppeId ?? ''

      setZeilen(gelesen)
      setTeamNamen(namen)
      setAuswahl(start)
      setSchritt('zuordnung')
    } catch (e) {
      setFehler('Datei konnte nicht gelesen werden: ' + String(e))
    }
  }

  const importieren = () => {
    if (!zeilen) return
    const teamZuordnung: Record<string, string | null> = {}
    for (const name of teamNamen) teamZuordnung[name] = auswahl[name] || null
    const res = koolImportieren(state, zeilen, { teamZuordnung, ueberschreiben })
    update(() => res.state)
    setErgebnis(res.ergebnis)
    setSchritt('ergebnis')
  }

  if (schritt === 'datei') {
    return (
      <Seite titel="kOOL-Import" zurueck="" tab="gruppen">
        <div className="karte">
          <p style={{ marginTop: 0 }}>
            Lade hier den <b>kOOL-Export</b> hoch (Excel-Datei mit den Spalten Vorname, Nachname, Adresse,
            PLZ, Ort, Land, AHV-Nummer, E-Mail, Geschlecht, Geburtsdatum, J+S-Nummer, Teams).
          </p>
          <p className="sub" style={{ color: 'var(--muted)' }}>
            Der Import gleicht über AHV-Nummer bzw. Name + Geburtsdatum ab: Bestehende Personen werden
            aktualisiert, neue angelegt. Team-Namen aus kOOL ordnest du im nächsten Schritt bestehenden
            Gruppen zu — es werden dabei nie automatisch neue Gruppen angelegt (das machst du unter
            Admin → Gruppen verwalten).
          </p>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={e => e.target.files?.[0] && dateiWaehlen(e.target.files[0])}
          />
        </div>
        {fehler && <div className="hinweis fehler">{fehler}</div>}
      </Seite>
    )
  }

  if (schritt === 'zuordnung') {
    const alleZugeordnet = teamNamen.every(n => auswahl[n])
    return (
      <Seite titel="Team-Zuordnung" zurueck="" tab="gruppen">
        <div className="hinweis info">
          {teamNamen.length} Team-Namen in der Datei gefunden. Ordne jeden Namen einer bestehenden Gruppe zu,
          oder wähle «Ignorieren» — fehlt eine Gruppe, lege sie zuerst unter Admin → Gruppen verwalten an.
        </div>
        <div className="karte" style={{ padding: '0.2rem 1rem' }}>
          {teamNamen.map(name => (
            <div key={name} className="zeile">
              <div className="haupt">
                <div className="titel" style={{ fontSize: '0.9rem' }}>{name}</div>
              </div>
              <select value={auswahl[name] ?? ''} onChange={e => setAuswahl(a => ({ ...a, [name]: e.target.value }))}
                style={{ width: 'auto', maxWidth: '55%' }}>
                <option value="">Ignorieren</option>
                {[...state.gruppen].sort((a, b) => a.name.localeCompare(b.name, 'de')).map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <h2 className="abschnitt">Bestehende Personendaten</h2>
        <div className="karte">
          <label className="feld" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexDirection: 'row' }}>
            <input type="radio" checked={ueberschreiben} onChange={() => setUeberschreiben(true)} style={{ width: 'auto' }} />
            kOOL überschreibt bestehende Angaben (Lücken werden trotzdem ergänzt)
          </label>
          <label className="feld" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexDirection: 'row' }}>
            <input type="radio" checked={!ueberschreiben} onChange={() => setUeberschreiben(false)} style={{ width: 'auto' }} />
            Bestehende Angaben behalten, nur Lücken mit kOOL-Werten füllen
          </label>
        </div>

        {!alleZugeordnet && (
          <div className="hinweis warnung">
            {teamNamen.filter(n => !auswahl[n]).length} Team(s) sind auf «Ignorieren» gesetzt — dafür werden keine Mitgliedschaften importiert.
          </div>
        )}

        <div className="btnreihe">
          <button className="leise" onClick={zurueckAufAnfang}>Abbrechen</button>
          <button className="breit" onClick={importieren}>Import durchführen</button>
        </div>
      </Seite>
    )
  }

  return (
    <Seite titel="kOOL-Import" zurueck="" tab="gruppen">
      {ergebnis && (
        <div className="hinweis info">
          <b>Import abgeschlossen.</b><br />
          {ergebnis.neuePersonen} neue Personen, {ergebnis.aktualisiertePersonen} aktualisiert,{' '}
          {ergebnis.mitgliedschaften} neue Mitgliedschaften.
          {ergebnis.uebersprungeneTeams > 0 && <> {ergebnis.uebersprungeneTeams} Team(s) übersprungen.</>}
          <div className="btnreihe" style={{ marginBottom: 0 }}>
            <a className="btn" href="#/">Zu den Gruppen</a>
            <button className="leise" onClick={zurueckAufAnfang}>Weitere Datei importieren</button>
          </div>
        </div>
      )}
      {ergebnis && ergebnis.warnungen.length > 0 && (
        <div className="hinweis warnung">
          {ergebnis.warnungen.map((w, i) => <div key={i}>{w}</div>)}
        </div>
      )}
    </Seite>
  )
}
