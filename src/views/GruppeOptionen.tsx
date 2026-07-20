import { useState } from 'react'
import type { AppState, FristTraining, FristWettkampf, StandardStatus } from '../types'
import { Seite, useBenutzer, type Update } from '../App'
import { KalenderSektion } from './IcalSync'
import { useTrainerListe } from '../lib/useTrainerListe'

/**
 * "Allgemeine Team-Optionen" — eigene Seite statt einzelner Aufklapp-Boxen in GruppeDetail.tsx,
 * fasst iCal-Kalender, Trainer-Zuteilung, Abmelde-Frist und Rückmeldung-Standard zusammen.
 */
export function GruppeOptionen({ state, update, gruppeId }: { state: AppState; update: Update; gruppeId: string }) {
  const gruppe = state.gruppen.find(g => g.id === gruppeId)
  if (!gruppe) return <Seite titel="Gruppe nicht gefunden" zurueck="" tab="gruppen"><div className="leer">Diese Gruppe existiert nicht (mehr).</div></Seite>

  return (
    <Seite titel="Allgemeine Team-Optionen" zurueck={`gruppe/${gruppeId}`} tab="gruppen">
      <KalenderSektion state={state} update={update} gruppeId={gruppeId} />
      <TrainerZuteilung state={state} update={update} gruppeId={gruppeId} />
      <AbmeldeFrist state={state} update={update} gruppeId={gruppeId} />
      <RueckmeldungStandard state={state} update={update} gruppeId={gruppeId} />
    </Seite>
  )
}

function TrainerZuteilung({ state, update, gruppeId }: { state: AppState; update: Update; gruppeId: string }) {
  const benutzer = useBenutzer()
  const gruppe = state.gruppen.find(g => g.id === gruppeId)!
  const trainerListe = useTrainerListe()
  const [auswahl, setAuswahl] = useState('')
  if (benutzer.rolle !== 'master') return null
  const emails = gruppe.trainerEmails ?? []
  const registriert = new Map(trainerListe.map(t => [t.email, t]))
  const verfuegbar = trainerListe.filter(t => t.rolle === 'trainer' && !emails.includes(t.email))

  const setzen = (liste: string[]) =>
    update(s => {
      const n = structuredClone(s)
      const gr = n.gruppen.find(g => g.id === gruppeId)!
      gr.trainerEmails = liste
      // Wird der Hauptverantwortliche selbst entfernt, verliert die Gruppe die Erinnerung —
      // muss dann neu gesetzt werden statt eine ungültige E-Mail stehen zu lassen.
      if (gr.hauptverantwortlicherEmail && !liste.includes(gr.hauptverantwortlicherEmail)) {
        gr.hauptverantwortlicherEmail = undefined
      }
      return n
    })

  const hauptverantwortlichenSetzen = (email: string | undefined) =>
    update(s => {
      const n = structuredClone(s)
      n.gruppen.find(g => g.id === gruppeId)!.hauptverantwortlicherEmail = email
      return n
    })

  return (
    <>
      <h2 className="abschnitt">Trainer-Zuteilung ({emails.length})</h2>
      <div className="karte">
        {emails.length > 0 && (
          <div className="sub" style={{ padding: '0.5rem 0 0' }}>
            Hauptverantwortlich für die Absenzen (erhält die Erinnerung bei fehlenden Einträgen):
          </div>
        )}
        {emails.map(e => {
          const t = registriert.get(e)
          const istHauptverantwortlich = gruppe.hauptverantwortlicherEmail === e
          return (
            <div key={e} className="zeile">
              <button type="button" className="leise" title="Als hauptverantwortlich markieren"
                style={{ fontSize: '1.1rem', padding: '0.2rem 0.5rem', flexShrink: 0 }}
                onClick={() => hauptverantwortlichenSetzen(istHauptverantwortlich ? undefined : e)}>
                {istHauptverantwortlich ? '★' : '☆'}
              </button>
              <div className="haupt">
                <div className="titel" style={{ fontSize: '0.85rem' }}>{t?.name || e}</div>
                {t?.name && <div className="sub">{e}</div>}
              </div>
              <button className="leise" onClick={() => setzen(emails.filter(x => x !== e))}>✕</button>
            </div>
          )
        })}
        {emails.length === 0 && <div className="sub">Noch keinem Trainer-Konto zugeteilt.</div>}

        {verfuegbar.length > 0 ? (
          <>
            <label className="feld">Trainer zuteilen
              <select value={auswahl} onChange={e => setAuswahl(e.target.value)}>
                <option value="">— auswählen —</option>
                {verfuegbar.map(t => (
                  <option key={t.email} value={t.email}>{t.name ? `${t.name} (${t.email})` : t.email}</option>
                ))}
              </select>
            </label>
            <button className="sekundaer breit" disabled={!auswahl} onClick={() => {
              setzen([...emails, auswahl])
              setAuswahl('')
            }}>Zuteilen</button>
          </>
        ) : (
          <div className="sub">
            {trainerListe.filter(t => t.rolle === 'trainer').length === 0
              ? 'Noch keine Trainer registriert.'
              : 'Alle registrierten Trainer sind bereits zugeteilt.'}
            {' '}Neue Konten schaltest du in der <a href="#/trainer">User-Verwaltung</a> frei.
          </div>
        )}
      </div>
    </>
  )
}

/**
 * Für die An-/Abmeldefunktion (Eltern/Spieler:innen): pro Team wählbare Frist, getrennt nach
 * Training und Wettkampf. Einzelne Termine können das zusätzlich mit einer exakten Zeit
 * überschreiben (siehe TerminDetail.tsx).
 */
function AbmeldeFrist({ state, update, gruppeId }: { state: AppState; update: Update; gruppeId: string }) {
  const benutzer = useBenutzer()
  const gruppe = state.gruppen.find(g => g.id === gruppeId)!
  if (benutzer.rolle !== 'master') return null

  const setzen = (feld: 'fristTraining' | 'fristWettkampf', wert: string) =>
    update(s => {
      const n = structuredClone(s)
      const g = n.gruppen.find(g => g.id === gruppeId)!
      if (feld === 'fristTraining') g.fristTraining = (wert || undefined) as FristTraining | undefined
      else g.fristWettkampf = (wert || undefined) as FristWettkampf | undefined
      return n
    })

  return (
    <>
      <h2 className="abschnitt">Abmelde-Frist (An-/Abmeldefunktion)</h2>
      <div className="karte">
        <div className="sub" style={{ padding: '0.5rem 0 0.6rem' }}>
          Bis wann sich Eltern/Spieler:innen für Termine dieser Gruppe noch ab-/anmelden können.
        </div>
        <label className="feld">Training/Trainingstag/Lagertag
          <select value={gruppe.fristTraining ?? '1h_vorher'} onChange={e => setzen('fristTraining', e.target.value)}>
            <option value="1h_vorher">1 Stunde vor Beginn</option>
            <option value="13uhr">Bis 13:00 Uhr (am Trainingstag)</option>
          </select>
        </label>
        <label className="feld">Wettkampf
          <select value={gruppe.fristWettkampf ?? '1woche_vorher'} onChange={e => setzen('fristWettkampf', e.target.value)}>
            <option value="1woche_vorher">1 Woche vor dem Spieltag</option>
            <option value="1tag_vorher">1 Tag vor dem Spieltag</option>
          </select>
        </label>
      </div>
    </>
  )
}

/**
 * Was gilt, wenn niemand aus der Familie vor einem Termin ab- oder anmeldet: die bisherige
 * stillschweigende Zusage ("angemeldet") oder eine offene Rückmeldung ("Rückmeldung fehlt"),
 * die eine aktive Bestätigung ("Ich komme") verlangt — siehe MeineKinder.tsx/TerminDetail.tsx.
 */
function RueckmeldungStandard({ state, update, gruppeId }: { state: AppState; update: Update; gruppeId: string }) {
  const benutzer = useBenutzer()
  const gruppe = state.gruppen.find(g => g.id === gruppeId)!
  if (benutzer.rolle !== 'master') return null

  const setzen = (feld: 'standardTraining' | 'standardWettkampf', wert: string) =>
    update(s => {
      const n = structuredClone(s)
      const g = n.gruppen.find(g => g.id === gruppeId)!
      if (feld === 'standardTraining') g.standardTraining = (wert || undefined) as StandardStatus | undefined
      else g.standardWettkampf = (wert || undefined) as StandardStatus | undefined
      return n
    })

  return (
    <>
      <h2 className="abschnitt">Rückmeldung-Standard</h2>
      <div className="karte">
        <div className="sub" style={{ padding: '0.5rem 0 0.6rem' }}>
          Was gilt, solange niemand aus der Familie sich vor einem Termin ab- oder anmeldet.
        </div>
        <label className="feld">Training/Trainingstag/Lagertag
          <select value={gruppe.standardTraining ?? 'angemeldet'} onChange={e => setzen('standardTraining', e.target.value)}>
            <option value="angemeldet">Grundsätzlich angemeldet</option>
            <option value="rueckmeldung_fehlt">Grundsätzlich Rückmeldung fehlt</option>
          </select>
        </label>
        <label className="feld">Wettkampf
          <select value={gruppe.standardWettkampf ?? 'angemeldet'} onChange={e => setzen('standardWettkampf', e.target.value)}>
            <option value="angemeldet">Grundsätzlich angemeldet</option>
            <option value="rueckmeldung_fehlt">Grundsätzlich Rückmeldung fehlt</option>
          </select>
        </label>
      </div>
    </>
  )
}
