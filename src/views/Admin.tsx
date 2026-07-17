import { useEffect, useState } from 'react'
import type { AppState } from '../types'
import { Seite, useBenutzer, type Update } from '../App'
import { naechsteSaison } from '../lib/saison'
import { fristenLaden, fristenSpeichern, type Fristen } from '../lib/apiSync'
import { apiAktiv } from '../config/apiConfig'

/**
 * Globale Fristen für die An-/Abmeldefunktion (Eltern/Spieler:innen) — Stunden vor Beginn,
 * bis zu denen noch abgemeldet werden darf. Pro Gruppe überschreibbar auf eine feste
 * Tageszeit (siehe GruppeDetail.tsx › "Abmelde-Frist").
 */
function FristenSektion() {
  const [fristen, setFristen] = useState<Fristen | null>(null)
  const [gespeichert, setGespeichert] = useState(false)

  useEffect(() => { if (apiAktiv) fristenLaden().then(setFristen) }, [])

  if (!fristen) return null

  const speichern = () => {
    fristenSpeichern(fristen).then(() => {
      setGespeichert(true)
      setTimeout(() => setGespeichert(false), 2000)
    })
  }

  return (
    <>
      <h2 className="abschnitt">Fristen (An-/Abmeldefunktion)</h2>
      <div className="karte">
        <label className="feld">Training: Stunden vor Beginn
          <input type="number" min={0} value={fristen.fristStundenTraining}
            onChange={e => setFristen({ ...fristen, fristStundenTraining: Number(e.target.value) })} />
        </label>
        <label className="feld">Wettkampf: Stunden vor Beginn
          <input type="number" min={0} value={fristen.fristStundenWettkampf}
            onChange={e => setFristen({ ...fristen, fristStundenWettkampf: Number(e.target.value) })} />
        </label>
        <button className="sekundaer breit" onClick={speichern}>{gespeichert ? 'Gespeichert ✓' : 'Speichern'}</button>
      </div>
    </>
  )
}

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

          <FristenSektion />
        </>
      )}
    </Seite>
  )
}
