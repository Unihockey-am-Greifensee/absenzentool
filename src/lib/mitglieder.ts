import type { Gruppe, Mitglied, MitgliedStatus } from '../types'
import { istAnwesend } from './anwesenheit'

export function statusVon(m: Mitglied): MitgliedStatus {
  return m.status ?? 'aktiv'
}

/**
 * Mitglieder, die aktuell am Trainingsbetrieb teilnehmen (Coach, Team, Schnuppernde).
 * Archivierte werden hier bewusst ausgeschlossen — für Anwesenheitserfassung und
 * Mitgliederzahlen. Der NDS-Export dagegen iteriert weiterhin über ALLE
 * gruppe.mitglieder (auch Archivierte), damit frühere Anwesenheiten nicht verloren gehen.
 */
export function aktiveMitglieder(gruppe: Gruppe): Mitglied[] {
  return gruppe.mitglieder.filter(m => statusVon(m) !== 'archiviert')
}

export function hatAnwesenheit(gruppe: Gruppe, personId: string): boolean {
  return gruppe.aktivitaeten.some(a => istAnwesend(a.anwesenheit[personId]))
}
