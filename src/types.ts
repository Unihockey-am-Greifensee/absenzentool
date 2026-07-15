// Zentrales Datenmodell — bewusst nah an den NDS-Exportfeldern gehalten.

import type { AnwesenheitStatus } from './lib/anwesenheit'

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

export type MitgliedStatus = 'aktiv' | 'schnuppernd' | 'archiviert'

export interface Mitglied {
  personId: string
  funktion: Funktion // bleibt die NDS-relevante Rolle (Teilnehmer/in/Leiter/in) — unabhängig vom Status
  rolle?: string // Original-Rolle aus kOOL (SpielerIn, Headcoach, …)
  status?: MitgliedStatus // fehlt = 'aktiv' (Altbestand vor Einführung des Feldes)
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
  // personId -> Status. Ältere Termine enthalten noch `true` (= anwesend) statt
  // eines Status-Strings — siehe lib/anwesenheit.ts für den robusten Zugriff.
  anwesenheit: Record<string, AnwesenheitStatus | boolean>
  icalUid?: string // gesetzt, wenn der Termin aus einem iCal-Feed stammt
  abgeschlossen?: boolean // Trainer hat den Termin bewusst abgeschlossen — steuert nur die
  // Übersichts-Einteilung (Aktuell/Abgeschlossen), unabhängig von status/NDS-Export
}

export interface Foto {
  id: string
  personId: string
  saison: string // z. B. "2025/26" — Saison Mai bis April, siehe lib/saison.ts
  datenUrl: string // Base64 data: URL, clientseitig komprimiert
  hochgeladenAm: string // ISO-Zeitstempel
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
  kOOLNamen?: string[] // Team-Namen aus dem kOOL-Import, die dieser Gruppe zugeordnet wurden (Aliase)
  standardZeit?: string
  standardDauer?: number
  standardOrt?: string
}

export interface AppState {
  personen: Person[]
  gruppen: Gruppe[]
  fotos: Foto[]
}

export const LEER: AppState = { personen: [], gruppen: [], fotos: [] }

export function neueId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}
