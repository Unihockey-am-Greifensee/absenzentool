import type { Aktivitaet, Gruppe } from '../types'

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
