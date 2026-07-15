import type { AppState, Funktion, Gruppe, Person } from '../types'
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
  mitgliedschaften: number
  uebersprungeneTeams: number
  warnungen: string[]
}

/** Team-Namen ("Unihockey U13 SCHWERZI: SpielerIn, …") aus der Teams-Spalte extrahieren, ohne Rollen-Suffix. */
function teamNameVon(eintrag: string): string {
  const doppelpunkt = eintrag.lastIndexOf(':')
  return (doppelpunkt >= 0 ? eintrag.slice(0, doppelpunkt) : eintrag).trim()
}

/** Alle in der Datei vorkommenden kOOL-Team-Namen, dedupliziert (erste Schreibweise gewinnt). */
export function sammleTeamNamen(zeilen: KoolZeile[]): string[] {
  const gesehen = new Map<string, string>() // normalisiert -> Original-Schreibweise
  for (const zeile of zeilen) {
    const teamsRoh = alsText(feld(zeile, 'Teams'))
    if (!teamsRoh) continue
    for (const eintrag of teamsRoh.split(',')) {
      const teamName = teamNameVon(eintrag.trim())
      if (!teamName) continue
      const key = teamName.toLowerCase()
      if (!gesehen.has(key)) gesehen.set(key, teamName)
    }
  }
  return [...gesehen.values()].sort((a, b) => a.localeCompare(b, 'de'))
}

export interface TeamZuordnungsVorschlag {
  teamName: string
  gruppeId: string | null // bereits bekannt (Name- oder Alias-Treffer) oder null = noch zu wählen
}

/** Versucht jeden Team-Namen automatisch einer bestehenden Gruppe zuzuordnen (Name- oder Alias-Treffer). */
export function teamZuordnungVorschlagen(gruppen: Gruppe[], teamNamen: string[]): TeamZuordnungsVorschlag[] {
  return teamNamen.map(teamName => {
    const key = teamName.toLowerCase()
    const treffer = gruppen.find(g =>
      g.name.toLowerCase() === key || (g.kOOLNamen ?? []).some(a => a.toLowerCase() === key))
    return { teamName, gruppeId: treffer?.id ?? null }
  })
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

export interface ImportOptionen {
  teamZuordnung: Record<string, string | null> // teamName (Original-Schreibweise) -> gruppeId, null = ignorieren
  ueberschreiben: boolean // true: kOOL-Werte gewinnen (bisheriges Verhalten). false: bestehende Werte bleiben, nur Lücken werden gefüllt.
}

/**
 * Importiert kOOL-Zeilen in den bestehenden Zustand (mutiert eine Kopie und gibt sie zurück).
 * Legt NIE neue Gruppen an — Team-Namen ohne Zuordnung in `optionen.teamZuordnung` werden
 * übersprungen (siehe sammleTeamNamen/teamZuordnungVorschlagen für den vorgelagerten Abgleich-Schritt).
 */
export function koolImportieren(
  state: AppState, zeilen: KoolZeile[], optionen: ImportOptionen,
): { state: AppState; ergebnis: ImportErgebnis } {
  const neu: AppState = JSON.parse(JSON.stringify(state))
  const ergebnis: ImportErgebnis = { neuePersonen: 0, aktualisiertePersonen: 0, mitgliedschaften: 0, uebersprungeneTeams: 0, warnungen: [] }
  const uebersprungen = new Set<string>()

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
      // Bei "überschreiben" ist kOOL führend (Lücken werden trotzdem vom bestehenden
      // Wert gefüllt); sonst bleiben bestehende Werte stehen und nur Lücken werden ergänzt.
      const wert = <K extends 'strasse' | 'hausnummer' | 'plz' | 'ort' | 'land' | 'ahvNr' | 'email' | 'geschlecht' | 'geburtsdatum' | 'jsNummer'>(feldname: K) =>
        optionen.ueberschreiben ? (kandidat[feldname] ?? person![feldname]) : (person![feldname] ?? kandidat[feldname])
      Object.assign(person, {
        vorname, nachname,
        strasse: wert('strasse'),
        hausnummer: wert('hausnummer'),
        plz: wert('plz'),
        ort: wert('ort'),
        land: wert('land'),
        ahvNr: wert('ahvNr'),
        email: wert('email'),
        geschlecht: wert('geschlecht'),
        geburtsdatum: wert('geburtsdatum'),
        jsNummer: wert('jsNummer'),
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
        const teamName = teamNameVon(teil)
        const rolle = doppelpunkt >= 0 ? teil.slice(doppelpunkt + 1).trim() : ''
        if (!teamName) continue

        const gruppeId = optionen.teamZuordnung[teamName]
        const gruppe = gruppeId ? neu.gruppen.find(g => g.id === gruppeId) : undefined
        if (!gruppe) {
          if (!uebersprungen.has(teamName)) {
            uebersprungen.add(teamName)
            ergebnis.uebersprungeneTeams++
            ergebnis.warnungen.push(`Team «${teamName}» wurde keiner Gruppe zugeordnet — Mitgliedschaften dafür übersprungen.`)
          }
          continue
        }
        // Alias für künftige Importe merken, damit dieser Team-Name automatisch erkannt wird.
        if (gruppe.name.toLowerCase() !== teamName.toLowerCase() && !(gruppe.kOOLNamen ?? []).some(a => a.toLowerCase() === teamName.toLowerCase())) {
          gruppe.kOOLNamen = [...(gruppe.kOOLNamen ?? []), teamName]
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
