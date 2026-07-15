export type AnwesenheitStatus = 'anwesend' | 'abgemeldet' | 'unabgemeldet'

/**
 * Liest einen Anwesenheits-Eintrag robust — ältere Termine kennen nur den
 * booleschen Wert `true` (= anwesend). Neue Einträge sind ein Status-String.
 */
export function anwesenheitStatus(wert: unknown): AnwesenheitStatus | undefined {
  if (wert === true) return 'anwesend'
  if (wert === 'anwesend' || wert === 'abgemeldet' || wert === 'unabgemeldet') return wert
  return undefined
}

export function istAnwesend(wert: unknown): boolean {
  return anwesenheitStatus(wert) === 'anwesend'
}

export interface AnwesenheitZaehlung {
  anwesend: number
  abgemeldet: number
  unabgemeldet: number
  offen: number
}

export function zaehleStatus(anwesenheit: Record<string, unknown>, personIds: string[]): AnwesenheitZaehlung {
  const z: AnwesenheitZaehlung = { anwesend: 0, abgemeldet: 0, unabgemeldet: 0, offen: 0 }
  for (const id of personIds) {
    const s = anwesenheitStatus(anwesenheit[id])
    if (s) z[s]++
    else z.offen++
  }
  return z
}
