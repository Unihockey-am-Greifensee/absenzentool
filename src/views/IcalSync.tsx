import { useState } from 'react'
import type { AppState, Aktivitaetstyp } from '../types'
import { neueId } from '../types'
import type { Update } from '../App'
import { fetchUrl, icsMergen, parseIcs, type IcsSyncErgebnis } from '../lib/icsImport'
import { ICAL_VORLAGEN } from '../config/icalVorlagen'

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

  const synchronisieren = async () => {
    setLaeuft(true)
    setMeldung(null)
    let gesamt = LEERES_ERGEBNIS
    const fehler: string[] = []
    // Aktuellen Stand lokal mitführen, damit mehrere Quellen aufeinander aufbauen.
    let aktuell = state
    for (const q of quellen) {
      try {
        const res = await fetch(fetchUrl(q.url))
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const events = parseIcs(await res.text())
        if (events.length === 0) throw new Error('keine Termine im Feed')
        const { state: neu, ergebnis } = icsMergen(aktuell, gruppeId, events, q.typ)
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
        text: `Feed(s) nicht ladbar (${fehler.join(' · ')}). Vermutlich blockiert der Browser den Zugriff (CORS) — lade unten die .ics-Datei manuell hoch.`,
      })
    } else {
      setMeldung({
        art: 'info',
        text: `Sync fertig: ${gesamt.neu} neu, ${gesamt.aktualisiert} aktualisiert, ${gesamt.abgesagt} abgesagt, ${gesamt.unveraendert} unverändert` +
          (gesamt.uebersprungen ? `, ${gesamt.uebersprungen} geschützt (bereits erfasst)` : '') + '.',
      })
    }
  }

  const icsDatei = async (file: File, typ: Aktivitaetstyp) => {
    const events = parseIcs(await file.text())
    if (events.length === 0) { setMeldung({ art: 'fehler', text: 'Keine Termine in der Datei gefunden.' }); return }
    const { state: neu, ergebnis } = icsMergen(state, gruppeId, events, typ)
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
