import type { AppState } from '../types'
import { Seite, useBenutzer, type Update } from '../App'
import { VorlagenKnopf } from './IcalSync'
import { heute } from '../lib/datum'

export function GruppenListe({ state, update }: { state: AppState; update: Update }) {
  const benutzer = useBenutzer()
  const istMaster = benutzer.rolle !== 'trainer'

  let gruppen = state.gruppen
  if (benutzer.rolle === 'trainer') {
    const eigene = gruppen.filter(g => g.trainerEmails?.includes(benutzer.email!.toLowerCase()))
    if (eigene.length > 0) gruppen = eigene
  }

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
              {g.mitglieder.length} Mitglieder · {erfasst} Trainings erfasst
              {offen > 0 && <> · <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{offen} offen</span></>}
            </div>
          </a>
        )
      })}
      {istMaster && state.gruppen.length > 0 && (
        <div className="btnreihe" style={{ flexDirection: 'column' }}>
          <a className="btn sekundaer breit" href="#/import">kOOL-Export importieren</a>
          <VorlagenKnopf update={update} />
          {benutzer.rolle === 'master' && <a className="btn leise breit" href="#/trainer">Trainer-Verwaltung</a>}
          <a className="btn leise breit" href="#/backup">Datensicherung</a>
        </div>
      )}
    </Seite>
  )
}
