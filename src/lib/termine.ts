import type { AppState, Aktivitaet, Gruppe } from '../types'

export interface TerminGruppe {
  haupt: Aktivitaet // repräsentativer Eintrag — dient als Link-Ziel
  alle: Aktivitaet[] // alle zusammengehörigen Einträge (>= 1)
}

/**
 * Fasst Wettkampf-Einträge desselben Tages (z. B. zwei Spiele an einem Turniertag)
 * zu einer Anzeige-/Erfassungseinheit zusammen — Training/Trainingstag/Lagertag
 * bleiben immer einzeln. Der NDS-Export ist davon nicht betroffen: er iteriert
 * weiterhin über jede einzelne Aktivität (siehe ndsExport.ts).
 */
export function terminGruppen(gruppe: Gruppe): TerminGruppe[] {
  const gesehen = new Set<string>()
  const ergebnis: TerminGruppe[] = []
  for (const a of gruppe.aktivitaeten) {
    if (gesehen.has(a.id)) continue
    if (a.typ === 'Wettkampf') {
      const geschwister = gruppe.aktivitaeten.filter(x => x.typ === 'Wettkampf' && x.datum === a.datum)
      geschwister.forEach(x => gesehen.add(x.id))
      ergebnis.push({ haupt: geschwister[0], alle: geschwister })
    } else {
      gesehen.add(a.id)
      ergebnis.push({ haupt: a, alle: [a] })
    }
  }
  return ergebnis
}

/** Alle Wettkampf-Geschwister desselben Tages einer gegebenen Aktivität (inkl. ihr selbst). */
export function terminGeschwister(gruppe: Gruppe, termin: Aktivitaet): Aktivitaet[] {
  if (termin.typ !== 'Wettkampf') return [termin]
  return gruppe.aktivitaeten.filter(x => x.typ === 'Wettkampf' && x.datum === termin.datum)
}

/** Wie viele noch offene Termine (Datum <= Stichtag) ein Halbjahresabschluss betreffen würde. */
export function zaehleAbzuschliessendeTermine(state: AppState, stichtag: string): number {
  let n = 0
  for (const g of state.gruppen) {
    for (const a of g.aktivitaeten) {
      if (a.datum <= stichtag && !a.abgeschlossen) n++
    }
  }
  return n
}

/**
 * Schliesst alle Termine bis (und mit) dem Stichtag ab — dieselbe Sperre wie beim
 * einzelnen «Abschliessen» (TerminDetail): keine Anwesenheit mehr bearbeitbar, und
 * die Termine wandern in der Gruppenübersicht automatisch von «Aktuell» zu «Abgeschlossen».
 */
export function terminAbschliessenBisStichtag(state: AppState, stichtag: string): { state: AppState; anzahl: number } {
  const neu: AppState = structuredClone(state)
  let anzahl = 0
  for (const g of neu.gruppen) {
    for (const a of g.aktivitaeten) {
      if (a.datum <= stichtag && !a.abgeschlossen) {
        a.abgeschlossen = true
        anzahl++
      }
    }
  }
  return { state: neu, anzahl }
}
