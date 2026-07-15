import type { Foto } from '../types'

// Saison Mai–April: Monate 0-3 (Jan–Apr) gehören noch zur Saison des Vorjahres.
export function saisonVon(datum: Date | string): string {
  const d = typeof datum === 'string' ? new Date(datum) : datum
  const start = d.getMonth() < 4 ? d.getFullYear() - 1 : d.getFullYear()
  return `${start}/${String((start + 1) % 100).padStart(2, '0')}`
}

export function aktuelleSaison(): string {
  return saisonVon(new Date())
}

/** Neuestes Foto einer Person — nach Saison, dann Hochladedatum. */
export function neuestesFoto(fotos: Foto[], personId: string): Foto | undefined {
  return fotos
    .filter(f => f.personId === personId)
    .sort((a, b) => b.saison.localeCompare(a.saison) || b.hochgeladenAm.localeCompare(a.hochgeladenAm))[0]
}

export function fotosVonPerson(fotos: Foto[], personId: string): Foto[] {
  return fotos
    .filter(f => f.personId === personId)
    .sort((a, b) => b.saison.localeCompare(a.saison) || b.hochgeladenAm.localeCompare(a.hochgeladenAm))
}
