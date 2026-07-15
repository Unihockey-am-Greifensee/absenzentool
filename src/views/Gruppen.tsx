import type { AppState } from '../types'
import { Seite, useBenutzer, type Update } from '../App'
import { heute } from '../lib/datum'
import { aktiveMitglieder } from '../lib/mitglieder'

export function GruppenListe({ state }: { state: AppState; update: Update }) {
  const benutzer = useBenutzer()
  const istMaster = benutzer.rolle !== 'trainer'

  // Trainer sehen ausschliesslich ihre zugeteilten Gruppen — auch wenn das null sind
  // (vorher wurden bei fehlender Zuteilung fälschlich ALLE Gruppen gezeigt, was beim
  // Erfassen dann an den Firestore-Regeln scheiterte).
  const gruppen = benutzer.rolle === 'trainer'
    ? state.gruppen.filter(g => g.trainerEmails?.includes(benutzer.email!.toLowerCase()))
    : state.gruppen

  return (
    <Seite titel="Absenzentool" tab="gruppen">
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
        const offen = g.aktivitaeten.filter(a => a.status === 'geplant' && a.datum <= heute()).length
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
