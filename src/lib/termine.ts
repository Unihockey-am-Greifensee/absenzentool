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

/** Wie viele noch nicht archivierte Termine (Datum <= Stichtag) ein Halbjahresabschluss betreffen würde. */
export function zaehleZuArchivierendeTermine(state: AppState, stichtag: string): number {
  let n = 0
  for (const g of state.gruppen) {
    for (const a of g.aktivitaeten) {
      if (a.datum <= stichtag && !a.archiviert) n++
    }
  }
  return n
}

/**
 * Archiviert alle Termine bis (und mit) dem Stichtag — unabhängig vom Trainer-Status
 * `abgeschlossen`. Das ist eine eigene, stärkere Sperre: nur der Admin kann sie über
 * TerminDetail wieder aufheben, Trainer können mit «Wieder öffnen» daran nichts ändern.
 */
export function terminArchivierenBisStichtag(state: AppState, stichtag: string): { state: AppState; anzahl: number } {
  const neu: AppState = structuredClone(state)
  let anzahl = 0
  for (const g of neu.gruppen) {
    for (const a of g.aktivitaeten) {
      if (a.datum <= stichtag && !a.archiviert) {
        a.archiviert = true
        anzahl++
      }
    }
  }
  return { state: neu, anzahl }
}
