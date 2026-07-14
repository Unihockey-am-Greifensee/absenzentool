// Zentrales Datenmodell — bewusst nah an den NDS-Exportfeldern gehalten.

export type Funktion = 'Teilnehmer/in' | 'Leiter/in'
export type Aktivitaetstyp = 'Training' | 'Trainingstag' | 'Wettkampf' | 'Lagertag'
export type AktivitaetsStatus = 'geplant' | 'durchgefuehrt' | 'abgesagt'

export interface Person {
  id: string
  vorname: string
  nachname: string
  strasse?: string
  hausnummer?: string
  plz?: string
  ort?: string
  land?: string // ISO alpha-2, Default CH
  geschlecht?: 'm' | 'w'
  geburtsdatum?: string // ISO yyyy-mm-dd
  ahvNr?: string
  peid?: string
  jsNummer?: string // NDS-PERSONENNUMMER
  nationalitaet?: string // CH | FL | Andere
  muttersprache?: string // DE | FR | IT | Andere
  email?: string
  quelle: 'kool' | 'manuell'
}

export interface Mitglied {
  personId: string
  funktion: Funktion
  rolle?: string // Original-Rolle aus kOOL (SpielerIn, Headcoach, …)
}

export interface Aktivitaet {
  id: string
  typ: Aktivitaetstyp
  datum: string // ISO yyyy-mm-dd
  zeit?: string // HH:MM, nur bei Training
  dauer?: number // Minuten, gemäss NDS-Werteliste
  ort?: string // nur bei Training
  fokus?: string // nur bei Training/Trainingstag
  titel?: string // Anzeige, z. B. aus iCal-SUMMARY
  status: AktivitaetsStatus
  anwesenheit: Record<string, boolean> // personId -> anwesend
  icalUid?: string // gesetzt, wenn der Termin aus einem iCal-Feed stammt
}

export interface IcalQuelle {
  url: string
  typ: Aktivitaetstyp // Standard-Typ, falls der Titel nichts anderes verrät
}

export interface Gruppe {
  id: string
  name: string
  mitglieder: Mitglied[]
  aktivitaeten: Aktivitaet[]
  icalQuellen?: IcalQuelle[]
  trainerEmails?: string[] // Google-Konten mit Schreibrecht auf diese Gruppe
  standardZeit?: string
  standardDauer?: number
  standardOrt?: string
}

export interface AppState {
  personen: Person[]
  gruppen: Gruppe[]
}

export const LEER: AppState = { personen: [], gruppen: [] }

export function neueId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}
