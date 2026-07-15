import { useState } from 'react'
import * as XLSX from 'xlsx'
import type { AppState } from '../types'
import { Seite, type Update } from '../App'
import {
  berechnePersonenDifferenzen, koolImportieren, sammleTeamNamen, teamZuordnungVorschlagen,
  MERGE_FELD_LABEL, type ImportErgebnis, type ImportOptionen, type KoolZeile, type MergeFeld, type PersonDiff,
} from '../lib/koolImport'

type Schritt = 'datei' | 'zuordnung' | 'differenzen' | 'ergebnis'
type Entscheidungen = Record<number, Partial<Record<MergeFeld, 'kool' | 'bestehend'>>>

export function ImportView({ state, update }: { state: AppState; update: Update }) {
  const [schritt, setSchritt] = useState<Schritt>('datei')
  const [zeilen, setZeilen] = useState<KoolZeile[] | null>(null)
  const [teamNamen, setTeamNamen] = useState<string[]>([])
  const [auswahl, setAuswahl] = useState<Record<string, string>>({})
  const [differenzen, setDifferenzen] = useState<PersonDiff[]>([])
  const [entscheidungen, setEntscheidungen] = useState<Entscheidungen>({})
  const [ueberschreiben, setUeberschreiben] = useState(true)
  const [ergebnis, setErgebnis] = useState<ImportErgebnis | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)

  const zurueckAufAnfang = () => {
    setSchritt('datei'); setZeilen(null); setTeamNamen([]); setAuswahl({})
    setDifferenzen([]); setEntscheidungen({}); setErgebnis(null); setFehler(null)
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
      setDifferenzen(berechnePersonenDifferenzen(state, gelesen))
      setEntscheidungen({})
      setSchritt('zuordnung')
    } catch (e) {
      setFehler('Datei konnte nicht gelesen werden: ' + String(e))
    }
  }

  const jetztImportieren = (entsch: Entscheidungen) => {
    if (!zeilen) return
    const teamZuordnung: Record<string, string | null> = {}
    for (const name of teamNamen) teamZuordnung[name] = auswahl[name] || null
    const optionen: ImportOptionen = { teamZuordnung, ueberschreiben, personEntscheidungen: entsch }
    const res = koolImportieren(state, zeilen, optionen)
    update(() => res.state)
    setErgebnis(res.ergebnis)
    setSchritt('ergebnis')
  }

  const weiterZuDifferenzenOderImport = () => {
    if (differenzen.length > 0) setSchritt('differenzen')
    else jetztImportieren(entscheidungen)
  }

  const setzeEntscheidung = (zeilenIndex: number, f: MergeFeld, wert: 'kool' | 'bestehend') =>
    setEntscheidungen(e => ({ ...e, [zeilenIndex]: { ...e[zeilenIndex], [f]: wert } }))

  const setzeAlleFuer = (diff: PersonDiff, wert: 'kool' | 'bestehend') =>
    setEntscheidungen(e => ({
      ...e,
      [diff.zeilenIndex]: Object.fromEntries(diff.felder.map(f => [f.feld, wert])),
    }))

  if (schritt === 'datei') {
    return (
      <Seite titel="kOOL-Import" zurueck="" tab="gruppen">
        <div className="karte">
          <p style={{ marginTop: 0 }}>
            Lade hier den <b>kOOL-Export</b> hoch (Excel-Datei mit den Spalten Vorname, Nachname, Adresse,
            PLZ, Ort, Land, AHV-Nummer, Mobiltelefon, E-Mail (+ optional E-Mail 2/3 für Mutter/Vater,
            Mobile 2/3 für deren Handynummern), Geschlecht, Geburtsdatum, J+S-Nummer, Teams).
          </p>
          <p className="sub" style={{ color: 'var(--muted)' }}>
            Der Import gleicht über AHV-Nummer bzw. Name + Geburtsdatum ab: Bestehende Personen werden
            aktualisiert, neue angelegt. Team-Namen aus kOOL ordnest du im nächsten Schritt bestehenden
            Gruppen zu — es werden dabei nie automatisch neue Gruppen angelegt (das machst du unter
            Admin → Gruppen verwalten). Abweichende Angaben bei bestehenden Personen zeigt dir der Import
            danach einzeln zur Entscheidung.
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
          <p className="sub" style={{ margin: '0.5rem 0 0' }}>
            Gilt nur, wo du im nächsten Schritt keine Einzelentscheidung triffst.
          </p>
        </div>

        {!alleZugeordnet && (
          <div className="hinweis warnung">
            {teamNamen.filter(n => !auswahl[n]).length} Team(s) sind auf «Ignorieren» gesetzt — dafür werden keine Mitgliedschaften importiert.
          </div>
        )}
        {differenzen.length > 0 && (
          <div className="hinweis info">
            Bei {differenzen.length} bestehenden Personen weichen einzelne Angaben vom kOOL-Export ab —
            die prüfst du im nächsten Schritt einzeln.
          </div>
        )}

        <div className="btnreihe">
          <button className="leise" onClick={zurueckAufAnfang}>Abbrechen</button>
          <button className="breit" onClick={weiterZuDifferenzenOderImport}>
            {differenzen.length > 0 ? `Weiter zu Differenzen (${differenzen.length})` : 'Import durchführen'}
          </button>
        </div>
      </Seite>
    )
  }

  if (schritt === 'differenzen') {
    return (
      <Seite titel="Personen-Differenzen" zurueck="" tab="gruppen">
        <div className="hinweis info">
          {differenzen.length} Personen haben abweichende Angaben. Wähle pro Feld, was gelten soll —
          unentschiedene Felder folgen der Vorauswahl von Schritt 2 ({ueberschreiben ? 'kOOL gewinnt' : 'Bestehendes bleibt'}).
        </div>

        {differenzen.map(diff => (
          <div key={diff.zeilenIndex} className="karte">
            <div className="btnreihe" style={{ marginTop: 0, justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>{diff.name}</h3>
              <div className="btnreihe" style={{ margin: 0 }}>
                <button className="leise" onClick={() => setzeAlleFuer(diff, 'bestehend')}>Alle behalten</button>
                <button className="leise" onClick={() => setzeAlleFuer(diff, 'kool')}>Alle von kOOL</button>
              </div>
            </div>
            {diff.felder.map(f => {
              const wahl = entscheidungen[diff.zeilenIndex]?.[f.feld] ?? (ueberschreiben ? 'kool' : 'bestehend')
              return (
                <div key={f.feld} className="zeile">
                  <div className="haupt">
                    <div className="titel" style={{ fontSize: '0.85rem' }}>{MERGE_FELD_LABEL[f.feld]}</div>
                  </div>
                  <div className="btnreihe" style={{ margin: 0 }}>
                    <button className={wahl === 'bestehend' ? '' : 'sekundaer'}
                      onClick={() => setzeEntscheidung(diff.zeilenIndex, f.feld, 'bestehend')}>
                      Bisher: {f.bestehend}
                    </button>
                    <button className={wahl === 'kool' ? '' : 'sekundaer'}
                      onClick={() => setzeEntscheidung(diff.zeilenIndex, f.feld, 'kool')}>
                      kOOL: {f.kool}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ))}

        <div className="btnreihe">
          <button className="leise" onClick={() => setSchritt('zuordnung')}>Zurück</button>
          <button className="breit" onClick={() => jetztImportieren(entscheidungen)}>Import durchführen</button>
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
