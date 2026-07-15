import { Seite, useBenutzer, type Update } from '../App'
import { VorlagenKnopf } from './IcalSync'

export function AdminHub({ update }: { update: Update }) {
  const benutzer = useBenutzer()
  return (
    <Seite titel="Admin" tab="export">
      <div className="btnreihe" style={{ flexDirection: 'column', marginTop: 0 }}>
        <a className="btn sekundaer breit" href="#/import">kOOL-Export importieren</a>
        <VorlagenKnopf update={update} />
        {benutzer.rolle === 'master' && (
          <a className="btn sekundaer breit" href="#/trainer">Trainer-Verwaltung</a>
        )}
        <a className="btn sekundaer breit" href="#/nds-export">NDS-Export</a>
        <a className="btn sekundaer breit" href="#/backup">Datensicherung</a>
      </div>
    </Seite>
  )
}
