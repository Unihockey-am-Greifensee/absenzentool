import type { Aktivitaet, Aktivitaetstyp, AppState, Gruppe } from '../types'
import { neueId } from '../types'

// iCal-Import: parst .ics-Feeds (z. B. Google Calendar / kOOL) und gleicht die
// Termine über die iCal-UID mit einer Gruppe ab. Termine, die ein Mensch schon
// angefasst hat (Anwesenheit erfasst, abgesagt), werden nie überschrieben.

export interface IcsEvent {
  uid: string
  summary?: string
  location?: string
  status?: string // CONFIRMED | CANCELLED
  datum: string // ISO, lokale Zeit Europe/Zurich
  zeit?: string // HH:MM, fehlt bei Ganztages-Events
  dauerMin?: number
}

export interface IcsSyncErgebnis {
  neu: number
  aktualisiert: number
  abgesagt: number
  unveraendert: number
  uebersprungen: number // manuell bearbeitete Termine, die geschützt blieben
}

const WETTKAMPF_MUSTER = /spieltag|wettkampf|turnier|match|meisterschaft|cup|final|playoff|spiel\b/i

function unfold(text: string): string[] {
  // RFC 5545: Zeilen, die mit Space/Tab beginnen, gehören zur Vorzeile.
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n')
}

function unescape(v: string): string {
  return v.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim()
}

function zuerichLokal(d: Date): { datum: string; zeit: string } {
  // sv-SE liefert "YYYY-MM-DD HH:MM"
  const s = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d)
  const [datum, zeit] = s.split(' ')
  return { datum, zeit }
}

interface DtWert { datum: string; zeit?: string; ts?: number }

function parseDt(params: string, wert: string): DtWert | undefined {
  if (/VALUE=DATE(?!-)/.test(params) || /^\d{8}$/.test(wert)) {
    const m = wert.match(/^(\d{4})(\d{2})(\d{2})$/)
    return m ? { datum: `${m[1]}-${m[2]}-${m[3]}` } : undefined
  }
  const m = wert.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z?)$/)
  if (!m) return undefined
  if (m[7] === 'Z') {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0)))
    const lokal = zuerichLokal(d)
    return { ...lokal, ts: d.getTime() }
  }
  // Mit TZID oder floating: als Wandzeit (Europe/Zurich) übernehmen.
  const ts = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime()
  return { datum: `${m[1]}-${m[2]}-${m[3]}`, zeit: `${m[4]}:${m[5]}`, ts }
}

export function parseIcs(text: string): IcsEvent[] {
  const events: IcsEvent[] = []
  let cur: Record<string, { params: string; wert: string }> | null = null
  for (const zeile of unfold(text)) {
    if (zeile === 'BEGIN:VEVENT') { cur = {}; continue }
    if (zeile === 'END:VEVENT') {
      if (cur) {
        const uid = cur['UID']?.wert
        const start = cur['DTSTART'] ? parseDt(cur['DTSTART'].params, cur['DTSTART'].wert) : undefined
        if (uid && start) {
          const ende = cur['DTEND'] ? parseDt(cur['DTEND'].params, cur['DTEND'].wert) : undefined
          let dauerMin: number | undefined
          if (start.ts !== undefined && ende?.ts !== undefined) {
            dauerMin = Math.round((ende.ts - start.ts) / 60000)
            if (dauerMin <= 0 || dauerMin > 24 * 60) dauerMin = undefined
          }
          events.push({
            uid: unescape(uid),
            summary: cur['SUMMARY'] ? unescape(cur['SUMMARY'].wert) : undefined,
            location: cur['LOCATION'] ? unescape(cur['LOCATION'].wert) : undefined,
            status: cur['STATUS']?.wert.toUpperCase(),
            datum: start.datum,
            zeit: start.zeit,
            dauerMin,
          })
        }
      }
      cur = null
      continue
    }
    if (cur === null) continue
    const doppelpunkt = zeile.indexOf(':')
    if (doppelpunkt < 0) continue
    const kopf = zeile.slice(0, doppelpunkt)
    const wert = zeile.slice(doppelpunkt + 1)
    const semikolon = kopf.indexOf(';')
    const name = (semikolon < 0 ? kopf : kopf.slice(0, semikolon)).toUpperCase()
    const params = semikolon < 0 ? '' : kopf.slice(semikolon + 1)
    cur[name] = { params, wert }
  }
  return events
}

export function typErkennen(ev: IcsEvent, standard: Aktivitaetstyp): Aktivitaetstyp {
  if (ev.summary && WETTKAMPF_MUSTER.test(ev.summary)) return 'Wettkampf'
  return standard
}

/** Gleicht geparste Events mit den Aktivitäten einer Gruppe ab (Kopie wird zurückgegeben). */
export function icsMergen(
  state: AppState,
  gruppeId: string,
  events: IcsEvent[],
  standardTyp: Aktivitaetstyp,
): { state: AppState; ergebnis: IcsSyncErgebnis } {
  const neu: AppState = JSON.parse(JSON.stringify(state))
  const gruppe = neu.gruppen.find(g => g.id === gruppeId)
  const ergebnis: IcsSyncErgebnis = { neu: 0, aktualisiert: 0, abgesagt: 0, unveraendert: 0, uebersprungen: 0 }
  if (!gruppe) return { state: neu, ergebnis }

  const nachUid = new Map(gruppe.aktivitaeten.filter(a => a.icalUid).map(a => [a.icalUid!, a]))

  for (const ev of events) {
    const typ = typErkennen(ev, standardTyp)
    const istTraining = typ === 'Training'
    const soll: Partial<Aktivitaet> = {
      datum: ev.datum,
      zeit: istTraining ? ev.zeit : undefined,
      dauer: istTraining || typ === 'Trainingstag' ? ev.dauerMin : undefined,
      ort: istTraining ? ev.location : undefined,
      titel: ev.summary,
    }
    const abgesagt = ev.status === 'CANCELLED'
    const vorhanden = nachUid.get(ev.uid)

    if (!vorhanden) {
      if (abgesagt) continue
      gruppe.aktivitaeten.push({
        id: neueId(), typ, status: 'geplant', anwesenheit: {}, icalUid: ev.uid,
        ...soll,
      } as Aktivitaet)
      ergebnis.neu++
      continue
    }

    // Manuell angefasste Termine (Anwesenheit erfasst oder abgesagt) nicht verändern.
    if (vorhanden.status !== 'geplant') { ergebnis.uebersprungen++; continue }

    if (abgesagt) {
      vorhanden.status = 'abgesagt'
      ergebnis.abgesagt++
      continue
    }
    const geaendert =
      vorhanden.datum !== soll.datum || vorhanden.zeit !== soll.zeit ||
      vorhanden.dauer !== soll.dauer || vorhanden.ort !== soll.ort || vorhanden.titel !== soll.titel
    if (geaendert) {
      Object.assign(vorhanden, soll)
      ergebnis.aktualisiert++
    } else {
      ergebnis.unveraendert++
    }
  }
  return { state: neu, ergebnis }
}

/**
 * Termine, die aus einem iCal-Feed stammen, dort aber nicht mehr auftauchen (das
 * VEVENT wurde komplett gelöscht statt auf CANCELLED gesetzt). `icsMergen` allein
 * merkt das nicht — es sieht nur, was im Feed steht. Diese Funktion vergleicht
 * gegen die Menge der beim Sync tatsächlich gesehenen UIDs. Bereits als «abgesagt»
 * markierte Termine werden nicht nochmals gemeldet.
 */
export function verwaisteTermine(gruppe: Gruppe, gesehenUids: Set<string>): Aktivitaet[] {
  return gruppe.aktivitaeten.filter(a => a.icalUid && a.status !== 'abgesagt' && !gesehenUids.has(a.icalUid))
}

/** Google-Calendar-URLs laufen im Dev-Modus über den Vite-Proxy (CORS). */
export function fetchUrl(url: string): string {
  if (import.meta.env?.DEV && url.startsWith('https://calendar.google.com/')) {
    return url.replace('https://calendar.google.com', '/gcal')
  }
  return url
}
