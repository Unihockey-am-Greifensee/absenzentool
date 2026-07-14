import type { AppState, Funktion, Person } from '../types'
import { neueId } from '../types'

// Parser für den kOOL-Excel-Export (Blatt «kOOL»).
// Erwartete Spalten: Vorname, Nachname, Adresse, Postleitzahl, Ort, Land,
// AHV-Nummer, E-Mail, Geschlecht, Geburtsdatum, J+S-Nummer, Teams
// Pure Funktion über bereits ausgelesenen Zeilen-Objekten → in Node testbar.

export interface KoolZeile {
  [key: string]: unknown
}

export interface ImportErgebnis {
  neuePersonen: number
  aktualisiertePersonen: number
  neueGruppen: number
  mitgliedschaften: number
  warnungen: string[]
}

const LEITER_ROLLEN = ['trainerin', 'trainer', 'co-trainerin', 'co-trainer', 'headcoach', 'coach', 'leiterin', 'leiter']

function feld(zeile: KoolZeile, ...namen: string[]): unknown {
  for (const n of namen) {
    for (const key of Object.keys(zeile)) {
      if (key.trim().toLowerCase() === n.toLowerCase()) return zeile[key]
    }
  }
  return undefined
}

function alsText(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined
  const s = String(v).trim()
  return s === '' ? undefined : s
}

export function isoDatum(v: unknown): string | undefined {
  if (v === null || v === undefined || v === '') return undefined
  if (v instanceof Date) {
    // Lokale Komponenten verwenden — UTC würde bei Mitternachts-Daten den Vortag liefern.
    const m = String(v.getMonth() + 1).padStart(2, '0')
    const t = String(v.getDate()).padStart(2, '0')
    return `${v.getFullYear()}-${m}-${t}`
  }
  const s = String(v).trim()
  let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  return undefined
}

export function adresseTeilen(adresse: string | undefined): { strasse?: string; hausnummer?: string } {
  if (!adresse) return {}
  const m = adresse.match(/^(.*?)[,\s]+(\d+\s*[a-zA-Z]?)$/)
  if (m) return { strasse: m[1].trim(), hausnummer: m[2].replace(/\s+/g, '') }
  return { strasse: adresse }
}

function normAhv(v: string | undefined): string | undefined {
  if (!v) return undefined
  const ziffern = v.replace(/\D/g, '')
  if (ziffern.length !== 13) return v.trim()
  return `${ziffern.slice(0, 3)}.${ziffern.slice(3, 7)}.${ziffern.slice(7, 11)}.${ziffern.slice(11)}`
}

function normLand(v: string | undefined): string | undefined {
  if (!v) return undefined
  const map: Record<string, string> = {
    schweiz: 'CH', suisse: 'CH', ch: 'CH',
    liechtenstein: 'LI', li: 'LI',
    deutschland: 'DE', de: 'DE',
    frankreich: 'FR', fr: 'FR',
    italien: 'IT', it: 'IT',
    oesterreich: 'AT', 'österreich': 'AT', at: 'AT',
  }
  return map[v.trim().toLowerCase()] ?? v.trim().toUpperCase().slice(0, 2)
}

function normGeschlecht(v: string | undefined): 'm' | 'w' | undefined {
  if (!v) return undefined
  const s = v.trim().toLowerCase()
  if (['m', 'männlich', 'maennlich', 'h'].includes(s)) return 'm'
  if (['w', 'weiblich', 'f'].includes(s)) return 'w'
  return undefined
}

function personenSchluessel(p: { ahvNr?: string; vorname: string; nachname: string; geburtsdatum?: string }): string {
  if (p.ahvNr) return 'ahv:' + p.ahvNr.replace(/\D/g, '')
  return 'name:' + `${p.vorname}|${p.nachname}|${p.geburtsdatum ?? ''}`.toLowerCase()
}

/** Importiert kOOL-Zeilen in den bestehenden Zustand (mutiert eine Kopie und gibt sie zurück). */
export function koolImportieren(state: AppState, zeilen: KoolZeile[]): { state: AppState; ergebnis: ImportErgebnis } {
  const neu: AppState = JSON.parse(JSON.stringify(state))
  const ergebnis: ImportErgebnis = { neuePersonen: 0, aktualisiertePersonen: 0, neueGruppen: 0, mitgliedschaften: 0, warnungen: [] }

  const index = new Map<string, Person>()
  for (const p of neu.personen) {
    index.set(personenSchluessel(p), p)
    if (p.ahvNr) index.set('name:' + `${p.vorname}|${p.nachname}|${p.geburtsdatum ?? ''}`.toLowerCase(), p)
  }

  for (const zeile of zeilen) {
    const vorname = alsText(feld(zeile, 'Vorname'))
    const nachname = alsText(feld(zeile, 'Nachname', 'Name'))
    if (!vorname || !nachname) continue

    const { strasse, hausnummer } = adresseTeilen(alsText(feld(zeile, 'Adresse', 'Strasse')))
    const kandidat = {
      vorname,
      nachname,
      strasse,
      hausnummer,
      plz: alsText(feld(zeile, 'Postleitzahl', 'PLZ')),
      ort: alsText(feld(zeile, 'Ort')),
      land: normLand(alsText(feld(zeile, 'Land'))) ?? 'CH',
      ahvNr: normAhv(alsText(feld(zeile, 'AHV-Nummer', 'AHV-Nr', 'AHV'))),
      email: alsText(feld(zeile, 'E-Mail', 'Email')),
      geschlecht: normGeschlecht(alsText(feld(zeile, 'Geschlecht'))),
      geburtsdatum: isoDatum(feld(zeile, 'Geburtsdatum')),
      jsNummer: alsText(feld(zeile, 'J+S-Nummer', 'JS-Nummer', 'Personennummer')),
    }

    let person = index.get(personenSchluessel(kandidat))
      ?? index.get('name:' + `${vorname}|${nachname}|${kandidat.geburtsdatum ?? ''}`.toLowerCase())

    if (person) {
      // kOOL ist führend für Stammdaten; manuell gepflegte Felder nur füllen, wenn leer.
      Object.assign(person, {
        vorname, nachname,
        strasse: kandidat.strasse ?? person.strasse,
        hausnummer: kandidat.hausnummer ?? person.hausnummer,
        plz: kandidat.plz ?? person.plz,
        ort: kandidat.ort ?? person.ort,
        land: kandidat.land ?? person.land,
        ahvNr: kandidat.ahvNr ?? person.ahvNr,
        email: kandidat.email ?? person.email,
        geschlecht: kandidat.geschlecht ?? person.geschlecht,
        geburtsdatum: kandidat.geburtsdatum ?? person.geburtsdatum,
        jsNummer: kandidat.jsNummer ?? person.jsNummer,
        quelle: 'kool',
      })
      ergebnis.aktualisiertePersonen++
    } else {
      person = {
        id: neueId(),
        nationalitaet: 'CH',
        muttersprache: 'DE',
        ...kandidat,
        quelle: 'kool',
      }
      neu.personen.push(person)
      index.set(personenSchluessel(person), person)
      index.set('name:' + `${vorname}|${nachname}|${person.geburtsdatum ?? ''}`.toLowerCase(), person)
      ergebnis.neuePersonen++
    }

    // Teams: "Unihockey U13 SCHWERZI: SpielerIn, Herren GF 26/27: TrainerIn"
    const teamsRoh = alsText(feld(zeile, 'Teams'))
    if (teamsRoh) {
      for (const eintrag of teamsRoh.split(',')) {
        const teil = eintrag.trim()
        if (!teil) continue
        const doppelpunkt = teil.lastIndexOf(':')
        const teamName = (doppelpunkt >= 0 ? teil.slice(0, doppelpunkt) : teil).trim()
        const rolle = doppelpunkt >= 0 ? teil.slice(doppelpunkt + 1).trim() : ''
        if (!teamName) continue

        let gruppe = neu.gruppen.find(g => g.name === teamName)
        if (!gruppe) {
          gruppe = { id: neueId(), name: teamName, mitglieder: [], aktivitaeten: [] }
          neu.gruppen.push(gruppe)
          ergebnis.neueGruppen++
        }
        const funktion: Funktion = LEITER_ROLLEN.includes(rolle.toLowerCase()) ? 'Leiter/in' : 'Teilnehmer/in'
        const vorhanden = gruppe.mitglieder.find(m => m.personId === person!.id)
        if (vorhanden) {
          vorhanden.funktion = funktion
          vorhanden.rolle = rolle || vorhanden.rolle
        } else {
          gruppe.mitglieder.push({ personId: person.id, funktion, rolle: rolle || undefined })
          ergebnis.mitgliedschaften++
        }
      }
    }
  }

  neu.gruppen.sort((a, b) => a.name.localeCompare(b.name, 'de'))
  return { state: neu, ergebnis }
}
