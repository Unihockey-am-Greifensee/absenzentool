import { useState } from 'react'
import type { AppState, Aktivitaet, Aktivitaetstyp } from '../types'
import { neueId } from '../types'
import type { Update } from '../App'
import { fetchUrl, icsMergen, nurZukuenftig, parseIcs, verwaisteTermine, type IcsSyncErgebnis } from '../lib/icsImport'
import { ICAL_VORLAGEN } from '../config/icalVorlagen'
import { chDatumKurz } from './GruppeDetail'

function summe(a: IcsSyncErgebnis, b: IcsSyncErgebnis): IcsSyncErgebnis {
  return {
    neu: a.neu + b.neu,
    aktualisiert: a.aktualisiert + b.aktualisiert,
    abgesagt: a.abgesagt + b.abgesagt,
    unveraendert: a.unveraendert + b.unveraendert,
    uebersprungen: a.uebersprungen + b.uebersprungen,
  }
}

const LEERES_ERGEBNIS: IcsSyncErgebnis = { neu: 0, aktualisiert: 0, abgesagt: 0, unveraendert: 0, uebersprungen: 0 }

function kurzUrl(url: string): string {
  const m = url.match(/ical\/([a-z0-9]{8})/)
  return m ? `…${m[1]}…` : url.slice(0, 40) + '…'
}

export function KalenderSektion({ state, update, gruppeId }: { state: AppState; update: Update; gruppeId: string }) {
  const gruppe = state.gruppen.find(g => g.id === gruppeId)!
  const quellen = gruppe.icalQuellen ?? []
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<{ art: 'info' | 'fehler'; text: string } | null>(null)
  const [neuUrl, setNeuUrl] = useState('')
  const [neuTyp, setNeuTyp] = useState<Aktivitaetstyp>('Training')
  const [verwaist, setVerwaist] = useState<Aktivitaet[] | null>(null)
  const [ausgewaehlt, setAusgewaehlt] = useState<Set<string>>(new Set())

  const synchronisieren = async () => {
    setLaeuft(true)
    setMeldung(null)
    setVerwaist(null)
    let gesamt = LEERES_ERGEBNIS
    const fehler: string[] = []
    const gesehenUids = new Set<string>()
    // Aktuellen Stand lokal mitführen, damit mehrere Quellen aufeinander aufbauen.
    let aktuell = state
    for (const q of quellen) {
      try {
        const res = await fetch(fetchUrl(q.url))
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const events = parseIcs(await res.text())
        if (events.length === 0) throw new Error('keine Termine im Feed')
        // Nur zukünftige Termine synchronisieren — die Feeds reichen oft ein bis
        // zwei Saisons zurück, Vergangenes brauchen wir für die Erfassung nicht.
        const zukuenftig = nurZukuenftig(events)
        zukuenftig.forEach(e => gesehenUids.add(e.uid))
        const { state: neu, ergebnis } = icsMergen(aktuell, gruppeId, zukuenftig, q.typ)
        aktuell = neu
        gesamt = summe(gesamt, ergebnis)
      } catch (e) {
        fehler.push(`${kurzUrl(q.url)}: ${String(e)}`)
      }
    }
    const fertig = aktuell
    update(() => fertig)
    setLaeuft(false)
    if (fehler.length > 0) {
      setMeldung({
        art: 'fehler',
        text: `Feed(s) nicht ladbar (${fehler.join(' · ')}). Vermutlich blockiert der Browser den Zugriff (CORS) — lade unten die .ics-Datei manuell hoch. ` +
          `Die Prüfung auf gelöschte Termine wurde übersprungen, solange nicht alle Quellen geladen werden konnten.`,
      })
      return
    }
    setMeldung({
      art: 'info',
      text: `Sync fertig: ${gesamt.neu} neu, ${gesamt.aktualisiert} aktualisiert, ${gesamt.abgesagt} abgesagt, ${gesamt.unveraendert} unverändert` +
        (gesamt.uebersprungen ? `, ${gesamt.uebersprungen} geschützt (bereits erfasst)` : '') + '.',
    })
    // Alle Quellen liefen sauber durch — jetzt prüfen, ob im Kalender gelöschte
    // Termine noch im Tool herumliegen (icsMergen sieht nur, was im Feed steht).
    const gruppeNeu = fertig.gruppen.find(g => g.id === gruppeId)!
    const verwaisteListe = verwaisteTermine(gruppeNeu, gesehenUids)
    if (verwaisteListe.length > 0) {
      setVerwaist(verwaisteListe)
      setAusgewaehlt(new Set(
        verwaisteListe.filter(a => a.status === 'geplant').map(a => a.id)
      ))
    }
  }

  const verwaisteLoeschen = () => {
    update(s => {
      const n = structuredClone(s)
      const g = n.gruppen.find(g => g.id === gruppeId)!
      g.aktivitaeten = g.aktivitaeten.filter(a => !ausgewaehlt.has(a.id))
      return n
    })
    setMeldung({ art: 'info', text: `${ausgewaehlt.size} Termin(e) gelöscht, da im Kalender nicht mehr vorhanden.` })
    setVerwaist(null)
  }

  const icsDatei = async (file: File, typ: Aktivitaetstyp) => {
    const events = parseIcs(await file.text())
    if (events.length === 0) { setMeldung({ art: 'fehler', text: 'Keine Termine in der Datei gefunden.' }); return }
    const { state: neu, ergebnis } = icsMergen(state, gruppeId, nurZukuenftig(events), typ)
    update(() => neu)
    setMeldung({ art: 'info', text: `Datei importiert: ${ergebnis.neu} neu, ${ergebnis.aktualisiert} aktualisiert, ${ergebnis.unveraendert} unverändert.` })
  }

  return (
    <details className="aufklapp">
      <summary>iCal-Kalender ({quellen.length})</summary>
      <div className="karte">
        {quellen.map((q, i) => (
          <div key={i} className="zeile">
            <div className="haupt">
              <div className="titel" style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.78rem' }}>{kurzUrl(q.url)}</div>
              <div className="sub">Standard-Typ: {q.typ}</div>
            </div>
            <button className="leise" onClick={() =>
              update(s => {
                const n = structuredClone(s)
                const g = n.gruppen.find(g => g.id === gruppeId)!
                g.icalQuellen = (g.icalQuellen ?? []).filter((_, j) => j !== i)
                return n
              })
            }>✕</button>
          </div>
        ))}
        {quellen.length > 0 && (
          <div className="btnreihe">
            <button className="breit" onClick={synchronisieren} disabled={laeuft}>
              {laeuft ? 'Synchronisiere …' : 'Jetzt synchronisieren'}
            </button>
          </div>
        )}
        {meldung && <div className={`hinweis ${meldung.art}`}>{meldung.text}</div>}

        {verwaist && verwaist.length > 0 && (
          <div className="hinweis warnung">
            <b>{verwaist.length} Termin(e) sind im Kalender nicht mehr vorhanden.</b>
            <p style={{ margin: '0.3rem 0' }}>
              Vermutlich wurden sie dort gelöscht oder verschoben. Sollen sie auch im Tool entfernt werden?
            </p>
            <div className="karte" style={{ padding: '0.2rem 1rem', margin: '0.6rem 0', background: 'var(--surface)' }}>
              {verwaist.map(a => {
                const hatAnwesenheit = Object.values(a.anwesenheit).some(Boolean)
                return (
                  <div key={a.id} className="zeile" style={{ cursor: 'pointer' }} onClick={() =>
                    setAusgewaehlt(s => {
                      const n = new Set(s)
                      n.has(a.id) ? n.delete(a.id) : n.add(a.id)
                      return n
                    })
                  }>
                    <span className={'check' + (ausgewaehlt.has(a.id) ? ' an' : '')}>✓</span>
                    <div className="haupt">
                      <div className="titel">{chDatumKurz(a.datum)} · {a.typ}</div>
                      <div className="sub">{[a.zeit, a.ort, a.titel].filter(Boolean).join(' · ') || '—'}</div>
                    </div>
                    {hatAnwesenheit && <span className="pill offen">Anwesenheit erfasst</span>}
                  </div>
                )
              })}
            </div>
            <div className="btnreihe" style={{ marginBottom: 0 }}>
              <button onClick={verwaisteLoeschen} disabled={ausgewaehlt.size === 0}>
                Ausgewählte löschen ({ausgewaehlt.size})
              </button>
              <button className="leise" onClick={() => setVerwaist(null)}>Keine löschen</button>
            </div>
          </div>
        )}

        <h2 className="abschnitt">Quelle hinzufügen</h2>
        <label className="feld">iCal-Link (.ics)
          <input value={neuUrl} onChange={e => setNeuUrl(e.target.value)} placeholder="https://…/basic.ics" />
        </label>
        <div className="felder2">
          <label className="feld">Standard-Typ
            <select value={neuTyp} onChange={e => setNeuTyp(e.target.value as Aktivitaetstyp)}>
              <option>Training</option><option>Trainingstag</option><option>Wettkampf</option><option>Lagertag</option>
            </select>
          </label>
          <label className="feld">&nbsp;
            <button className="sekundaer breit" disabled={!neuUrl.trim().startsWith('http')} onClick={() => {
              update(s => {
                const n = structuredClone(s)
                const g = n.gruppen.find(g => g.id === gruppeId)!
                g.icalQuellen = [...(g.icalQuellen ?? []), { url: neuUrl.trim(), typ: neuTyp }]
                return n
              })
              setNeuUrl('')
            }}>Hinzufügen</button>
          </label>
        </div>

        <h2 className="abschnitt">Oder .ics-Datei hochladen</h2>
        <input type="file" accept=".ics,text/calendar" onChange={e => e.target.files?.[0] && icsDatei(e.target.files[0], neuTyp)} />
      </div>
    </details>
  )
}

/** Weist die bekannten Vereins-Kalender den gleichnamigen Gruppen zu; fehlende Gruppen werden angelegt. */
export function vorlagenZuordnen(state: AppState): { state: AppState; zugeordnet: number; neueGruppen: number } {
  const neu: AppState = JSON.parse(JSON.stringify(state))
  let zugeordnet = 0
  let neueGruppen = 0
  for (const v of ICAL_VORLAGEN) {
    let gruppe = neu.gruppen.find(g => g.name === v.gruppe)
    if (!gruppe) {
      gruppe = { id: neueId(), name: v.gruppe, mitglieder: [], aktivitaeten: [] }
      neu.gruppen.push(gruppe)
      neueGruppen++
    }
    const vorhandene = new Set((gruppe.icalQuellen ?? []).map(q => q.url))
    for (const q of v.quellen) {
      if (!vorhandene.has(q.url)) {
        gruppe.icalQuellen = [...(gruppe.icalQuellen ?? []), q]
        zugeordnet++
      }
    }
  }
  neu.gruppen.sort((a, b) => a.name.localeCompare(b.name, 'de'))
  return { state: neu, zugeordnet, neueGruppen }
}

export function VorlagenKnopf({ update }: { update: Update }) {
  const [meldung, setMeldung] = useState('')
  return (
    <>
      <button className="sekundaer breit" onClick={() => {
        let text = ''
        update(s => {
          const { state, zugeordnet, neueGruppen } = vorlagenZuordnen(s)
          text = zugeordnet === 0
            ? 'Alle bekannten Kalender sind bereits zugeordnet.'
            : `${zugeordnet} Kalender zugeordnet, ${neueGruppen} Gruppen neu angelegt.`
          return state
        })
        setMeldung(text)
      }}>Grizzlys-Kalender zuordnen</button>
      {meldung && <div className="hinweis info breit">{meldung}</div>}
    </>
  )
}
