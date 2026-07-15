import { useState } from 'react'
import type { AppState } from '../types'
import { LEER } from '../types'
import { Seite, type Update } from '../App'

interface BackupDatei {
  app: 'absenzentool'
  version: 1
  erstellt: string
  state: AppState
}

function zeitstempelDateiname(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `absenzentool-backup_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.json`
}

export function BackupView({ state, update }: { state: AppState; update: Update }) {
  const [meldung, setMeldung] = useState<{ art: 'info' | 'fehler'; text: string } | null>(null)
  const [loeschBestaetigung, setLoeschBestaetigung] = useState('')

  const anzahlAnwesenheiten = state.gruppen.reduce(
    (s, g) => s + g.aktivitaeten.reduce((t, a) => t + Object.values(a.anwesenheit).filter(Boolean).length, 0), 0)
  const anzahlTermine = state.gruppen.reduce((s, g) => s + g.aktivitaeten.length, 0)

  const herunterladen = () => {
    const inhalt: BackupDatei = { app: 'absenzentool', version: 1, erstellt: new Date().toISOString(), state }
    const blob = new Blob([JSON.stringify(inhalt, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = zeitstempelDateiname()
    a.click()
    URL.revokeObjectURL(url)
    setMeldung({ art: 'info', text: 'Backup heruntergeladen. Bewahre die Datei sicher auf — sie enthält auch AHV-Nummern.' })
  }

  const wiederherstellen = async (file: File) => {
    setMeldung(null)
    let daten: BackupDatei
    try {
      daten = JSON.parse(await file.text())
    } catch {
      setMeldung({ art: 'fehler', text: 'Datei ist kein gültiges JSON.' })
      return
    }
    if (daten.app !== 'absenzentool' || !Array.isArray(daten.state?.personen) || !Array.isArray(daten.state?.gruppen)) {
      setMeldung({ art: 'fehler', text: 'Das ist keine gültige Absenzentool-Backup-Datei.' })
      return
    }
    const p = daten.state.personen.length
    const g = daten.state.gruppen.length
    const stand = daten.erstellt ? new Date(daten.erstellt).toLocaleString('de-CH') : 'unbekannt'
    if (!confirm(
      `Backup vom ${stand} wiederherstellen?\n\n` +
      `${p} Personen, ${g} Gruppen.\n\n` +
      `Der aktuelle Datenbestand wird durch das Backup ERSETZT. Diese Aktion lässt sich nicht rückgängig machen — ` +
      `lade zur Sicherheit vorher ein aktuelles Backup herunter.`
    )) return

    try {
      update(() => daten.state)
      setMeldung({ art: 'info', text: `Wiederhergestellt: ${p} Personen, ${g} Gruppen. Die Änderungen werden mit Firestore synchronisiert.` })
    } catch (e) {
      setMeldung({ art: 'fehler', text: 'Wiederherstellen fehlgeschlagen: ' + String(e) })
    }
  }

  const allesLoeschen = () => {
    if (loeschBestaetigung !== 'LÖSCHEN') return
    if (!confirm(
      `Wirklich ALLE Daten löschen? ${state.personen.length} Personen, ${state.gruppen.length} Gruppen, ` +
      `${anzahlTermine} Termine, ${anzahlAnwesenheiten} Anwesenheiten, ${state.fotos.length} Fotos — unwiderruflich. ` +
      `Lade vorher ein Backup herunter, falls du das nicht schon getan hast.`
    )) return
    update(() => structuredClone(LEER))
    setLoeschBestaetigung('')
    setMeldung({ art: 'info', text: 'Alle Daten wurden gelöscht.' })
  }

  return (
    <Seite titel="Datensicherung" zurueck="" tab="gruppen">
      <div className="statzeile">
        <div className="stat"><b>{state.personen.length}</b><span>Personen</span></div>
        <div className="stat"><b>{anzahlTermine}</b><span>Termine</span></div>
        <div className="stat"><b>{anzahlAnwesenheiten}</b><span>Anwesenheiten</span></div>
      </div>

      <div className="karte">
        <h3 style={{ marginTop: 0 }}>Backup herunterladen</h3>
        <p className="sub" style={{ color: 'var(--muted)' }}>
          Sichert den gesamten Datenbestand (Personen, Gruppen, Termine, Anwesenheiten) in einer JSON-Datei.
          Empfehlung: einmal im Monat und vor jedem grösseren kOOL-Import.
        </p>
        <button className="breit" onClick={herunterladen}>Backup herunterladen</button>
      </div>

      <div className="karte">
        <h3 style={{ marginTop: 0 }}>Backup wiederherstellen</h3>
        <p className="sub" style={{ color: 'var(--muted)' }}>
          Spielt eine zuvor gesicherte Datei zurück. <b>Ersetzt den aktuellen Datenbestand vollständig.</b>
        </p>
        <input type="file" accept="application/json,.json" onChange={e => e.target.files?.[0] && wiederherstellen(e.target.files[0])} />
      </div>

      <div className="karte">
        <h3 style={{ marginTop: 0 }}>Alle Daten löschen</h3>
        <p className="sub" style={{ color: 'var(--muted)' }}>
          Entfernt sämtliche Personen, Gruppen, Termine, Anwesenheiten und Fotos unwiderruflich — z. B. um
          nach einem Formularwechsel komplett neu zu importieren. Lade vorher unbedingt ein Backup herunter.
          Tippe zur Bestätigung <b>LÖSCHEN</b> ein.
        </p>
        <label className="feld">Bestätigung
          <input value={loeschBestaetigung} onChange={e => setLoeschBestaetigung(e.target.value)} placeholder="LÖSCHEN" />
        </label>
        <button className="breit" disabled={loeschBestaetigung !== 'LÖSCHEN'} onClick={allesLoeschen}>
          Alle Daten endgültig löschen
        </button>
      </div>

      {meldung && <div className={`hinweis ${meldung.art}`}>{meldung.text}</div>}

      <div className="hinweis warnung">
        <b>Datenschutz:</b> Die Backup-Datei enthält Personendaten inklusive AHV-Nummern. Bewahre sie nur an
        einem geschützten Ort auf (nicht per Mail versenden, nicht in öffentliche Ordner legen).
      </div>
    </Seite>
  )
}
