import type { Kurs, KursEintrag } from './apiSync'

// Trainer-Qualifikationsstufen: Co-Coach i.A. → Co-Coach → Coach i.A. → Coach → Headcoach.
// Reine Berechnung aus den vorhandenen Kurs-Einträgen — die Stufe wird nirgends gespeichert.

export type Stufe = 'Co-Coach i.A.' | 'Co-Coach' | 'Coach i.A.' | 'Coach' | 'Headcoach'

export const NOMINATIONEN: { kurs: Kurs; label: string }[] = [
  { kurs: 'anfrage_co_coach_ia', label: 'Anfrage Co-Coach i.A. (Nachwuchs-Verantwortlicher)' },
  { kurs: 'headcoach_bestimmt', label: 'Headcoach bestimmt (Nachwuchs-Verantwortlicher)' },
]

export const KURSE: { kurs: Kurs; label: string }[] = [
  { kurs: 'jungtrainer_besj', label: 'Jungtrainer BESJ' },
  { kurs: '1418coach', label: '1418coach' },
  { kurs: 'leiterkurs1_besj', label: 'Leiterkurs 1 BESJ' },
  { kurs: 'leiterkurs2_besj', label: 'Leiterkurs 2 BESJ' },
  { kurs: 'js_leiterkurs', label: 'J+S Leiterkurs' },
]

export const BEFOERDERUNG: { kurs: Kurs; label: string } = {
  kurs: 'befoerderung_coach',
  label: 'Beförderung zu Coach',
}

/** Höchste erfüllte Stufe zuerst prüfen — wer schon Coach ist, erfüllt nebenbei auch niedrigere Kriterien. */
export function stufeBerechnen(eintraege: KursEintrag[]): Stufe | null {
  const hat = (k: Kurs) => eintraege.some(e => e.kurs === k)
  if (hat('headcoach_bestimmt')) return 'Headcoach'
  const leiterkurs = hat('leiterkurs1_besj') || hat('leiterkurs2_besj')
  if (hat('befoerderung_coach') || (leiterkurs && hat('js_leiterkurs'))) return 'Coach'
  if (leiterkurs) return 'Coach i.A.'
  if (hat('jungtrainer_besj') && hat('1418coach')) return 'Co-Coach'
  if (hat('anfrage_co_coach_ia')) return 'Co-Coach i.A.'
  return null
}
