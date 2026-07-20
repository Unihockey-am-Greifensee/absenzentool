// Zentrales Datenmodell — bewusst nah an den NDS-Exportfeldern gehalten.

import type { AnwesenheitStatus } from './lib/anwesenheit'

export type Funktion = 'Teilnehmer/in' | 'Leiter/in'
export type Aktivitaetstyp = 'Training' | 'Trainingstag' | 'Wettkampf' | 'Lagertag'
export type AktivitaetsStatus = 'geplant' | 'durchgefuehrt' | 'abgesagt'
export type FristTraining = '1h_vorher' | '13uhr'
export type FristWettkampf = '1woche_vorher' | '1tag_vorher'
export type StandardStatus = 'angemeldet' | 'rueckmeldung_fehlt'

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
  mobil?: string // eigenes Mobiltelefon
  emailMutter?: string
  emailVater?: string
  mobilMutter?: string
  mobilVater?: string
  quelle: 'kool' | 'manuell'
  archiviert?: boolean // Admin hat die Person global archiviert — ausgeblendet, aber noch nicht endgültig gelöscht
  // Wann eine der E-Mail-Adressen (eigene/Mutter/Vater) zuletzt ins Absenzentool eingeloggt hat —
  // nur vom Server berechnet (familie_zugriff), nie vom Client geschrieben.
  letzterLogin?: string
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
  // personId -> Grund, aber nur für Einträge, die eine Familie selbst gemeldet hat (An-/
  // Abmeldefunktion) — steuert die Kennzeichnung im Trainer-Termin (TerminDetail.tsx).
  // Verschwindet serverseitig automatisch, sobald ein Trainer den Status aktiv ändert.
  anwesenheitMeta?: Record<string, { grund?: string; gemeldetVon: 'familie' }>
  icalUid?: string // gesetzt, wenn der Termin aus einem iCal-Feed stammt
  abgeschlossen?: boolean // Trainer schliesst den Termin selbst ab — sperrt die Anwesenheit,
  // bis er ihn wieder öffnet. Steuert nur die Übersichts-Einteilung, unabhängig von status/NDS-Export.
  archiviert?: boolean // Nur der Admin setzt dies, ausschliesslich über den Halbjahresabschluss.
  // Sperrt die Anwesenheit endgültiger als abgeschlossen — Trainer können das nicht selbst aufheben.
  // Überschreibt für diesen einen Termin die Team-Regel (Gruppe.fristTraining/fristWettkampf)
  // mit einer exakten Frist "YYYY-MM-DDTHH:mm" (lokale Zeit, kein datetime-local-Zeitzonen-Handling).
  fristOverride?: string
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

export interface TeamFoto {
  id: string
  gruppeId: string
  saison: string // z. B. "2025/26" — Saison Mai bis April, siehe lib/saison.ts
  datenUrl: string // Base64 data: URL (Upload) oder API-URL (nach dem Laden)
  hochgeladenAm: string // ISO-Zeitstempel
}

export interface Gruppe {
  id: string
  name: string
  mitglieder: Mitglied[]
  aktivitaeten: Aktivitaet[]
  icalQuellen?: IcalQuelle[]
  trainerEmails?: string[] // Google-Konten mit Schreibrecht auf diese Gruppe
  hauptverantwortlicherEmail?: string // erhält die 36h-Erinnerung bei fehlenden Absenzen
  kOOLNamen?: string[] // Team-Namen aus dem kOOL-Import, die dieser Gruppe zugeordnet wurden (Aliase)
  standardZeit?: string
  standardDauer?: number
  standardOrt?: string
  // Team-Regel für die An-/Abmeldefunktion, getrennt nach Training und Wettkampf — siehe
  // rudelcheck-server/src/lib/familie.ts (fristBerechnen). undefined = jeweiliger Standard
  // (fristTraining: '1h_vorher', fristWettkampf: '1woche_vorher'). Einzelne Termine können
  // das zusätzlich mit Aktivitaet.fristOverride überschreiben.
  fristTraining?: FristTraining
  fristWettkampf?: FristWettkampf
  // Standard-Rückmeldestatus für Termine ohne expliziten Familie-Eintrag, getrennt nach
  // Training und Wettkampf — siehe rudelcheck-server/src/lib/familie.ts (standardStatus).
  // undefined = 'angemeldet' (bisheriges Verhalten).
  standardTraining?: StandardStatus
  standardWettkampf?: StandardStatus
}

export interface AppState {
  personen: Person[]
  gruppen: Gruppe[]
  fotos: Foto[]
  teamFotos: TeamFoto[]
  fotoSaison: string // z.B. "2025/26" — manuell gesteuert (Admin: "Zur nächsten Saison"),
  // Neuuploads erhalten diese Beschriftung. Im Firebase-Modus (kein Backend dafür) automatisch berechnet.
}

// fotoSaison hier nur ein Platzhalter — wird sofort durch echte Daten (API/localStorage) ersetzt.
export const LEER: AppState = { personen: [], gruppen: [], fotos: [], teamFotos: [], fotoSaison: '2025/26' }

export function neueId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}
