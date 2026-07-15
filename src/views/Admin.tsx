import { Seite, useBenutzer } from '../App'

export function AdminHub() {
  const benutzer = useBenutzer()
  return (
    <Seite titel="Admin" tab="export">
      <div className="btnreihe" style={{ flexDirection: 'column', marginTop: 0 }}>
        {benutzer.rolle === 'master' && (
          <a className="btn sekundaer breit" href="#/trainer">Trainer-Verwaltung</a>
        )}
        <a className="btn sekundaer breit" href="#/nds-export">NDS-Export</a>
      </div>
    </Seite>
  )
}
