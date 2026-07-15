import type { AppState, Aktivitaet, Gruppe, Person } from '../types'
import { istAnwesend } from './anwesenheit'

// Erzeugt die drei NDS-Import-Dateien exakt gemäss den offiziellen
// BASPO-Anleitungen (jugendundsport.ch/de/datenimport, Stand 2023/2024):
//  - personen_jugendausbildung.csv
//  - aktivitaeten_jugendausbildung.csv
//  - anwesenheitskontrolle_jugendausbildung.csv

export interface ExportAuswahl {
  gruppenIds: string[]
  von: string // ISO
  bis: string // ISO
}

export interface Befund {
  stufe: 'fehler' | 'warnung'
  text: string
}

export interface ExportResultat {
  dateien: { name: string; inhalt: string }[]
  befunde: Befund[]
  statistik: { personen: number; aktivitaeten: number; anwesenheiten: number }
}

// NDS-Wertelisten (Nutzergruppe 1, Unihockey). Pro Gruppe später konfigurierbar.
export const DAUER_TRAINING = [60, 75, 90]
export const DAUER_TRAININGSTAG = [240, 300]

const MAX_PERSONEN_PRO_DATEI = 200

function chDatum(iso: string | undefined): string {
  if (!iso) return ''
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso
}

function zelle(v: string | number | undefined): string {
  if (v === undefined || v === null) return ''
  // Semikolon ist Trennzeichen — in Werten durch Komma ersetzen statt zu quoten,
  // weil unklar ist, ob der NDS-Import Quoting versteht.
  return String(v).replace(/;/g, ',').trim()
}

function csv(zeilen: string[][]): string {
  return '﻿' + zeilen.map(z => z.join(';')).join('\r\n') + '\r\n'
}

function relevanteAktivitaeten(g: Gruppe, auswahl: ExportAuswahl): Aktivitaet[] {
  return g.aktivitaeten
    .filter(a => a.status === 'durchgefuehrt')
    .filter(a => a.datum >= auswahl.von && a.datum <= auswahl.bis)
    .sort((a, b) => a.datum.localeCompare(b.datum) || (a.zeit ?? '').localeCompare(b.zeit ?? ''))
}

export function ndsExport(state: AppState, auswahl: ExportAuswahl): ExportResultat {
  const befunde: Befund[] = []
  const gruppen = state.gruppen.filter(g => auswahl.gruppenIds.includes(g.id))
  const personenById = new Map(state.personen.map(p => [p.id, p]))

  // ---- Anwesenheitskontrolle + beteiligte Personen sammeln ----
  const awkZeilen: string[][] = [['PERSONENNUMMER', 'FUNKTION', 'DATUM', 'AKTIVITÄTSTYP', 'ZEIT', 'DAUER', 'ORT']]
  const beteiligte = new Map<string, Person>()
  let anwesenheiten = 0
  const aktZeilen: string[][] = [['AKTIVITAETSTYP', 'DATUM', 'ZEIT', 'DAUER', 'ORT', 'FOKUS']]
  let aktCount = 0

  for (const g of gruppen) {
    const akts = relevanteAktivitaeten(g, auswahl)
    if (akts.length === 0) {
      befunde.push({ stufe: 'warnung', text: `Gruppe «${g.name}»: keine durchgeführten Aktivitäten im Zeitraum.` })
    }
    for (const a of akts) {
      aktCount++
      const istTraining = a.typ === 'Training'
      const zeitOK = istTraining ? a.zeit : undefined
      const ortOK = istTraining ? a.ort : undefined
      const fokusOK = a.typ === 'Training' || a.typ === 'Trainingstag' ? a.fokus : undefined
      let dauerOK: number | undefined
      if (a.typ === 'Training' || a.typ === 'Trainingstag') dauerOK = a.dauer
      // Wettkampf (NG 1): keine Dauer nötig; Lagertag: keine Dauer erlaubt.

      // Validierung
      const wann = `${chDatum(a.datum)} (${g.name})`
      if (istTraining && !a.zeit) befunde.push({ stufe: 'fehler', text: `Training ${wann}: ZEIT fehlt (Pflichtfeld).` })
      if (istTraining && !a.ort) befunde.push({ stufe: 'fehler', text: `Training ${wann}: ORT fehlt (Pflichtfeld).` })
      if (!istTraining && a.zeit) befunde.push({ stufe: 'warnung', text: `${a.typ} ${wann}: Zeitangabe wird weggelassen (bei ${a.typ} nicht erlaubt).` })
      if (!istTraining && a.ort) befunde.push({ stufe: 'warnung', text: `${a.typ} ${wann}: Ortsangabe wird weggelassen (bei ${a.typ} nicht erlaubt).` })
      if (istTraining && a.dauer !== undefined && !DAUER_TRAINING.includes(a.dauer))
        befunde.push({ stufe: 'fehler', text: `Training ${wann}: DAUER ${a.dauer} ist nicht in der NDS-Werteliste (${DAUER_TRAINING.join('/')} Min., NG 1).` })
      if (a.typ === 'Trainingstag' && a.dauer !== undefined && !DAUER_TRAININGSTAG.includes(a.dauer))
        befunde.push({ stufe: 'fehler', text: `Trainingstag ${wann}: DAUER ${a.dauer} ist nicht in der NDS-Werteliste (${DAUER_TRAININGSTAG.join('/')} Min.).` })
      if ((a.typ === 'Training' || a.typ === 'Trainingstag') && a.dauer === undefined)
        befunde.push({ stufe: 'fehler', text: `${a.typ} ${wann}: DAUER fehlt (Pflichtfeld).` })

      aktZeilen.push([
        zelle(a.typ), chDatum(a.datum), zelle(zeitOK), zelle(dauerOK), zelle(ortOK), zelle(fokusOK),
      ])

      for (const m of g.mitglieder) {
        if (!istAnwesend(a.anwesenheit[m.personId])) continue
        const p = personenById.get(m.personId)
        if (!p) continue
        beteiligte.set(p.id, p)
        anwesenheiten++
        awkZeilen.push([
          zelle(p.jsNummer), m.funktion, chDatum(a.datum), zelle(a.typ),
          zelle(zeitOK), zelle(dauerOK), zelle(ortOK),
        ])
      }
    }
  }

  // ---- Personen ----
  const personen = [...beteiligte.values()].sort((a, b) =>
    a.nachname.localeCompare(b.nachname, 'de') || a.vorname.localeCompare(b.vorname, 'de'))

  for (const p of personen) {
    const wer = `${p.vorname} ${p.nachname}`
    if (!p.jsNummer && !p.ahvNr && !p.peid)
      befunde.push({ stufe: 'fehler', text: `${wer}: weder Personennummer noch AHV-Nr./PEID vorhanden — Person kann im NDS nicht zugeordnet werden.` })
    else if (!p.ahvNr && !p.peid)
      befunde.push({ stufe: 'warnung', text: `${wer}: keine AHV-Nr./PEID — Pflicht, falls die Person neu zur Organisation stösst.` })
    if (!p.jsNummer)
      befunde.push({ stufe: 'warnung', text: `${wer}: keine J+S-Personennummer — AWK-Zeilen dieser Person können beim Import nicht zugeordnet werden.` })
    if (!p.geburtsdatum) befunde.push({ stufe: 'fehler', text: `${wer}: Geburtsdatum fehlt (Pflichtfeld).` })
    if (!p.geschlecht) befunde.push({ stufe: 'fehler', text: `${wer}: Geschlecht fehlt (Pflichtfeld).` })
    if (!p.plz || !p.ort) befunde.push({ stufe: 'fehler', text: `${wer}: PLZ/Ort fehlt (Pflichtfeld).` })
  }

  const personenKopf = ['PERSONENNUMMER', 'NAME', 'VORNAME', 'GEBURTSDATUM', 'GESCHLECHT', 'AHV_NR', 'PEID',
    'NATIONALITAET', 'MUTTERSPRACHE', 'STRASSE', 'HAUSNUMMER', 'PLZ', 'ORT', 'LAND']
  const personenZeilen = personen.map(p => [
    zelle(p.jsNummer), zelle(p.nachname), zelle(p.vorname), chDatum(p.geburtsdatum),
    zelle(p.geschlecht), zelle(p.ahvNr), zelle(p.peid),
    zelle(p.nationalitaet ?? 'CH'), zelle(p.muttersprache ?? 'DE'),
    zelle(p.strasse), zelle(p.hausnummer), zelle(p.plz), zelle(p.ort), zelle(p.land ?? 'CH'),
  ])

  const dateien: { name: string; inhalt: string }[] = []
  if (personenZeilen.length > MAX_PERSONEN_PRO_DATEI) {
    befunde.push({ stufe: 'warnung', text: `${personenZeilen.length} Personen — die NDS erlaubt max. ${MAX_PERSONEN_PRO_DATEI} pro Datei; der Export wird aufgeteilt.` })
    for (let i = 0; i * MAX_PERSONEN_PRO_DATEI < personenZeilen.length; i++) {
      const teil = personenZeilen.slice(i * MAX_PERSONEN_PRO_DATEI, (i + 1) * MAX_PERSONEN_PRO_DATEI)
      dateien.push({ name: `personen_jugendausbildung_teil${i + 1}.csv`, inhalt: csv([personenKopf, ...teil]) })
    }
  } else {
    dateien.push({ name: 'personen_jugendausbildung.csv', inhalt: csv([personenKopf, ...personenZeilen]) })
  }
  dateien.push({ name: 'aktivitaeten_jugendausbildung.csv', inhalt: csv(aktZeilen) })
  dateien.push({ name: 'anwesenheitskontrolle_jugendausbildung.csv', inhalt: csv(awkZeilen) })

  befunde.sort((a, b) => (a.stufe === b.stufe ? 0 : a.stufe === 'fehler' ? -1 : 1))
  return { dateien, befunde, statistik: { personen: personen.length, aktivitaeten: aktCount, anwesenheiten } }
}
