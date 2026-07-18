import type { AppState } from '../types'
import { Seite, useBenutzer, type Update } from '../App'
import { naechsteSaison } from '../lib/saison'

export function AdminHub({ state, update }: { state: AppState; update: Update }) {
  const benutzer = useBenutzer()
  const naechste = naechsteSaison(state.fotoSaison)

  return (
    <Seite titel="Admin" tab="export">
      <div className="btnreihe" style={{ flexDirection: 'column', marginTop: 0 }}>
        <a className="btn sekundaer breit" href="#/gruppen-verwalten">Gruppen verwalten</a>
        <a className="btn sekundaer breit" href="#/import">kOOL-Export importieren</a>
        {benutzer.rolle === 'master' && (
          <>
            <a className="btn sekundaer breit" href="#/trainer">Trainer-Verwaltung</a>
            <a className="btn sekundaer breit" href="#/familie-zugriffe">Absenzentool-Zugriffe</a>
            <a className="btn sekundaer breit" href="#/aktivitaet-log">Aktivitäts-Log</a>
          </>
        )}
        <a className="btn sekundaer breit" href="#/nds-export">NDS-Export</a>
        <a className="btn sekundaer breit" href="#/halbjahresabschluss">Halbjahresabschluss</a>
        <a className="btn sekundaer breit" href="#/backup">Datensicherung</a>
      </div>

      {benutzer.rolle === 'master' && (
        <>
          <h2 className="abschnitt">Foto-Saison</h2>
          <div className="karte">
            <div className="sub" style={{ marginBottom: '0.6rem' }}>
              Aktuelle Saison für neu hochgeladene Fotos: <b>{state.fotoSaison}</b>
            </div>
            <button className="sekundaer breit" onClick={() => {
              if (!confirm(
                `Zur nächsten Saison (${naechste}) wechseln?\n\n` +
                `Neu hochgeladene Fotos werden ab sofort mit "${naechste}" beschriftet. ` +
                `Bisherige Fotos bleiben erhalten und werden angezeigt, bis für dieselbe ` +
                `Person/Gruppe ein neues Foto hochgeladen wird.`,
              )) return
              update(s => ({ ...s, fotoSaison: naechste }))
            }}>Zur nächsten Saison ({naechste})</button>
          </div>
        </>
      )}
    </Seite>
  )
}
