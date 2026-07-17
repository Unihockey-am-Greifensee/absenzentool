import type { AppState, Gruppe, Person } from '../types'
import { Seite, useBenutzer, type Update } from '../App'
import { heute } from '../lib/datum'
import { aktiveMitglieder } from '../lib/mitglieder'
import { useErinnerungen } from '../lib/erinnerungen'
import { chDatumKurz } from './GruppeDetail'

const GEBURTSTAGE_VORSCHAU_TAGE = 13 // heute + folgende 13 Tage = 2 Wochen

/** Tage bis zum nächsten Geburtstag (0 = heute) — jahreswechsel-sicher, unabhängig vom Alter. */
function tageBisGeburtstag(geburtsdatum: string, heuteDatum: Date): number {
  const [, monat, tag] = geburtsdatum.split('-').map(Number)
  const heuteStart = new Date(heuteDatum.getFullYear(), heuteDatum.getMonth(), heuteDatum.getDate())
  let naechster = new Date(heuteStart.getFullYear(), monat - 1, tag)
  if (naechster < heuteStart) naechster = new Date(heuteStart.getFullYear() + 1, monat - 1, tag)
  return Math.round((naechster.getTime() - heuteStart.getTime()) / 86_400_000)
}

function GeburtstageBanner({ personen }: { personen: Person[] }) {
  const heuteDatum = new Date()
  const anstehend = personen
    .filter(p => p.geburtsdatum && !p.archiviert)
    .map(p => ({ p, tage: tageBisGeburtstag(p.geburtsdatum!, heuteDatum) }))
    .filter(({ tage }) => tage >= 0 && tage <= GEBURTSTAGE_VORSCHAU_TAGE)
    .sort((a, b) => a.tage - b.tage)

  if (anstehend.length === 0) return null

  const tageText = (tage: number) => tage === 0 ? 'heute 🎉' : tage === 1 ? 'morgen' : `in ${tage} Tagen`

  return (
    <div className="hinweis info">
      <b>🎂 Geburtstage:</b>
      <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.2rem' }}>
        {anstehend.map(({ p, tage }) => (
          <li key={p.id}>{p.vorname} {p.nachname} — {tageText(tage)}</li>
        ))}
      </ul>
    </div>
  )
}

// Reihenfolge in der Hauptübersicht: erst nach Alter (U9 vor U11 vor … vor Herren zuunterst),
// dann innerhalb derselben Altersklasse nach Standort — FÄLLANDÄ, dann SCHWERZI, VOLKI/FÖRDER zuletzt.
const ORT_RANG: Record<string, number> = { 'FÄLLANDÄ': 0, 'SCHWERZI': 1 }

function alterRang(name: string): number {
  const treffer = name.match(/^U(\d+)/i)
  return treffer ? Number(treffer[1]) : 999 // Herren & Co. ohne U-Zahl ganz zuunterst
}

function ortRang(name: string): number {
  const ort = name.split(' ').slice(1).join(' ').toUpperCase()
  return ORT_RANG[ort] ?? 2 // VOLKI/FÖRDER/GF/unbekannt ans Ende dieser Altersklasse
}

function gruppenSortierung(a: Gruppe, b: Gruppe): number {
  const alterDiff = alterRang(a.name) - alterRang(b.name)
  if (alterDiff !== 0) return alterDiff
  const ortDiff = ortRang(a.name) - ortRang(b.name)
  if (ortDiff !== 0) return ortDiff
  return a.name.localeCompare(b.name, 'de')
}

function ErinnerungsBanner() {
  const termine = useErinnerungen()
  if (termine.length === 0) return null
  return (
    <div className="hinweis warnung">
      <b>{termine.length === 1 ? 'Ein Termin' : `${termine.length} Termine`}</b> {termine.length === 1 ? 'wartet' : 'warten'} seit über 36h auf vollständige Absenzen — du bist dafür hauptverantwortlich:
      <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.2rem' }}>
        {termine.map(t => (
          <li key={t.id}>
            <a href={`#/gruppe/${t.gruppeId}/termin/${t.id}`}>{t.gruppeName}, {chDatumKurz(t.datum)} ({t.typ})</a>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function GruppenListe({ state }: { state: AppState; update: Update }) {
  const benutzer = useBenutzer()
  const istMaster = benutzer.rolle !== 'trainer'

  // Trainer sehen ausschliesslich ihre zugeteilten Gruppen — auch wenn das null sind
  // (vorher wurden bei fehlender Zuteilung fälschlich ALLE Gruppen gezeigt, was beim
  // Erfassen dann an den Firestore-Regeln scheiterte).
  const gruppen = (benutzer.rolle === 'trainer'
    ? state.gruppen.filter(g => g.trainerEmails?.includes(benutzer.email!.toLowerCase()))
    : state.gruppen
  ).slice().sort(gruppenSortierung)

  const personById = new Map(state.personen.map(p => [p.id, p]))
  const sichtbarePersonen = [...new Map(
    gruppen.flatMap(g => aktiveMitglieder(g)).map(m => [m.personId, personById.get(m.personId)]),
  ).values()].filter((p): p is Person => !!p)

  return (
    <Seite titel="RudelCheck" tab="gruppen">
      <ErinnerungsBanner />
      <GeburtstageBanner personen={sichtbarePersonen} />
      {gruppen.length === 0 && (
        <div className="leer">
          {istMaster ? (
            <>
              <p>Noch keine Trainingsgruppen.</p>
              <a className="btn" href="#/import">kOOL-Export importieren</a>
            </>
          ) : (
            <p>Dir ist noch keine Gruppe zugeteilt — melde dich bei der Absenzen-Verantwortung.</p>
          )}
        </div>
      )}
      {gruppen.map(g => {
        const offen = g.aktivitaeten.filter(a => a.status === 'geplant' && !a.archiviert && a.datum <= heute()).length
        const erfasst = g.aktivitaeten.filter(a => a.status === 'durchgefuehrt').length
        return (
          <a className="karte" key={g.id} href={'#/gruppe/' + g.id}>
            <h3>{g.name}</h3>
            <div className="sub">
              {aktiveMitglieder(g).length} Mitglieder · {erfasst} Trainings erfasst
              {offen > 0 && <> · <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{offen} offen</span></>}
            </div>
          </a>
        )
      })}
    </Seite>
  )
}
