import type { Aktivitaet, AppState } from '../types'
import { Seite, useBenutzer, type Update } from '../App'
import { chDatumKurz } from './GruppeDetail'
import { aktiveMitglieder, statusVon } from '../lib/mitglieder'
import { terminGeschwister } from '../lib/termine'
import { neuestesFoto } from '../lib/saison'

export function TerminDetail({ state, update, gruppeId, terminId }: {
  state: AppState; update: Update; gruppeId: string; terminId: string
}) {
  const benutzer = useBenutzer()
  const istAdmin = benutzer.rolle !== 'trainer'
  const gruppe = state.gruppen.find(g => g.id === gruppeId)
  const termin = gruppe?.aktivitaeten.find(a => a.id === terminId)
  if (!gruppe || !termin) {
    return <Seite titel="Termin nicht gefunden" zurueck="" tab="gruppen"><div className="leer">Dieser Termin existiert nicht (mehr).</div></Seite>
  }
  const geschwister = terminGeschwister(gruppe, termin)
  const geschwisterIds = geschwister.map(a => a.id)
  const mehrereSpiele = geschwister.length > 1

  const personById = new Map(state.personen.map(p => [p.id, p]))
  const mitglieder = aktiveMitglieder(gruppe).sort((a, b) => {
    if (a.funktion !== b.funktion) return a.funktion === 'Leiter/in' ? -1 : 1
    const pa = personById.get(a.personId), pb = personById.get(b.personId)
    return (pa?.nachname ?? '').localeCompare(pb?.nachname ?? '', 'de')
  })
  const anwesend = Object.values(termin.anwesenheit).filter(Boolean).length

  // Wirkt auf alle Geschwister eines Wettkampf-Tages gleichzeitig (siehe lib/termine.ts) —
  // dadurch reicht EINE Anwesenheitserfassung für z. B. zwei Spiele am selben Tag.
  const mutiere = (fn: (a: Aktivitaet) => void) =>
    update(s => {
      const n = structuredClone(s)
      const g = n.gruppen.find(g => g.id === gruppeId)!
      for (const id of geschwisterIds) {
        const a = g.aktivitaeten.find(x => x.id === id)
        if (a) fn(a)
      }
      return n
    })

  const toggle = (personId: string) =>
    mutiere(a => {
      a.anwesenheit[personId] = !a.anwesenheit[personId]
      if (a.status === 'geplant') a.status = 'durchgefuehrt'
    })

  return (
    <Seite titel={`${chDatumKurz(termin.datum)} · ${termin.typ}`} zurueck={`gruppe/${gruppeId}`} tab="gruppen">
      <div className="sub" style={{ margin: '-0.5rem 0 0.75rem', color: 'var(--muted)' }}>
        {gruppe.name} · {[termin.zeit, termin.dauer && termin.dauer + ' Min.', termin.ort, termin.titel].filter(Boolean).join(' · ') || 'ohne Details'}
      </div>
      {mehrereSpiele && (
        <div className="hinweis info">
          {geschwister.length} Spiele am {chDatumKurz(termin.datum)} — die Anwesenheit gilt für beide gemeinsam.
        </div>
      )}

      {termin.status === 'abgesagt' ? (
        <div className="hinweis warnung">
          Dieser Termin ist als <b>abgesagt</b> markiert und erscheint nicht im Export.
          <div className="btnreihe" style={{ marginBottom: 0 }}>
            <button className="sekundaer" onClick={() => mutiere(a => {
              a.status = anwesend > 0 ? 'durchgefuehrt' : 'geplant'
              a.abgeschlossen = false
            })}>Absage rückgängig</button>
          </div>
        </div>
      ) : (
        <>
          <div className="btnreihe">
            <button className="sekundaer" disabled={termin.abgeschlossen} onClick={() => mutiere(a => {
              for (const m of mitglieder) a.anwesenheit[m.personId] = true
              a.status = 'durchgefuehrt'
            })}>Alle anwesend</button>
            <button className="leise" disabled={termin.abgeschlossen} onClick={() => mutiere(a => { a.anwesenheit = {}; a.status = 'geplant' })}>Zurücksetzen</button>
            <button className="leise" disabled={termin.abgeschlossen} onClick={() => {
              if (confirm('Termin als abgesagt markieren? Er erscheint dann nicht im Export.')) {
                mutiere(a => { a.status = 'abgesagt'; a.abgeschlossen = true })
              }
            }}>Training abgesagt</button>
          </div>
          <div className="hinweis info">
            {anwesend} von {mitglieder.length} anwesend
            {termin.abgeschlossen ? ' — abgeschlossen, «Wieder öffnen» zum Bearbeiten.' : ' — Antippen zum Abhaken.'}
          </div>
        </>
      )}

      <div className="karte" style={{ padding: '0.2rem 1rem' }}>
        {mitglieder.map(m => {
          const p = personById.get(m.personId)
          if (!p) return null
          const an = !!termin.anwesenheit[m.personId]
          const gesperrt = termin.status === 'abgesagt' || !!termin.abgeschlossen
          const foto = neuestesFoto(state.fotos, m.personId)
          return (
            <div key={m.personId} className="zeile" style={{ cursor: gesperrt ? 'default' : 'pointer', opacity: termin.abgeschlossen ? 0.6 : 1 }}
              onClick={() => !gesperrt && toggle(m.personId)}>
              <span className={'check' + (an ? ' an' : '')}>✓</span>
              {foto && <img src={foto.datenUrl} alt="" className="foto-icon" />}
              <div className="haupt">
                <div className="titel">{p.vorname} {p.nachname}</div>
                {m.funktion === 'Leiter/in' && <div className="sub">{m.rolle ?? 'Leiter/in'}</div>}
              </div>
              {m.funktion === 'Leiter/in' && <span className="pill leiter">Leiter/in</span>}
              {statusVon(m) === 'schnuppernd' && <span className="pill offen">Schnuppern</span>}
            </div>
          )
        })}
      </div>

      {termin.status !== 'abgesagt' && (
        <div className="btnreihe">
          {termin.abgeschlossen ? (
            <button className="sekundaer breit" onClick={() => mutiere(a => { a.abgeschlossen = false })}>Wieder öffnen</button>
          ) : (
            <button className="breit" onClick={() => mutiere(a => { a.abgeschlossen = true })}>Abschliessen</button>
          )}
        </div>
      )}

      {istAdmin && (
        <div className="btnreihe">
          <button className="leise breit" onClick={() => {
            const frage = mehrereSpiele
              ? `Alle ${geschwister.length} Spiele dieses Tages endgültig löschen?`
              : 'Diesen Termin endgültig löschen?'
            if (!confirm(frage)) return
            update(s => {
              const n = structuredClone(s)
              const g = n.gruppen.find(g => g.id === gruppeId)!
              g.aktivitaeten = g.aktivitaeten.filter(a => !geschwisterIds.includes(a.id))
              return n
            })
            window.location.hash = '#/gruppe/' + gruppeId
          }}>{mehrereSpiele ? 'Beide Spiele löschen' : 'Termin löschen'}</button>
        </div>
      )}
    </Seite>
  )
}
