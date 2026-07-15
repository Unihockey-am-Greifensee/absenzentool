import type { Aktivitaet, AppState } from '../types'
import { Seite, type Update } from '../App'
import { chDatumKurz } from './GruppeDetail'
import { aktiveMitglieder, statusVon } from '../lib/mitglieder'

export function TerminDetail({ state, update, gruppeId, terminId }: {
  state: AppState; update: Update; gruppeId: string; terminId: string
}) {
  const gruppe = state.gruppen.find(g => g.id === gruppeId)
  const termin = gruppe?.aktivitaeten.find(a => a.id === terminId)
  if (!gruppe || !termin) {
    return <Seite titel="Termin nicht gefunden" zurueck="" tab="gruppen"><div className="leer">Dieser Termin existiert nicht (mehr).</div></Seite>
  }
  const personById = new Map(state.personen.map(p => [p.id, p]))
  const mitglieder = aktiveMitglieder(gruppe).sort((a, b) => {
    if (a.funktion !== b.funktion) return a.funktion === 'Leiter/in' ? -1 : 1
    const pa = personById.get(a.personId), pb = personById.get(b.personId)
    return (pa?.nachname ?? '').localeCompare(pb?.nachname ?? '', 'de')
  })
  const anwesend = Object.values(termin.anwesenheit).filter(Boolean).length

  const mutiere = (fn: (a: Aktivitaet) => void) =>
    update(s => {
      const n = structuredClone(s)
      const a = n.gruppen.find(g => g.id === gruppeId)!.aktivitaeten.find(x => x.id === terminId)!
      fn(a)
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

      {termin.status === 'abgesagt' ? (
        <div className="hinweis warnung">
          Dieser Termin ist als <b>abgesagt</b> markiert und erscheint nicht im Export.
          <div className="btnreihe" style={{ marginBottom: 0 }}>
            <button className="sekundaer" onClick={() => mutiere(a => { a.status = anwesend > 0 ? 'durchgefuehrt' : 'geplant' })}>Absage rückgängig</button>
          </div>
        </div>
      ) : (
        <>
          <div className="btnreihe">
            <button className="sekundaer" onClick={() => mutiere(a => {
              for (const m of mitglieder) a.anwesenheit[m.personId] = true
              a.status = 'durchgefuehrt'
            })}>Alle anwesend</button>
            <button className="leise" onClick={() => mutiere(a => { a.anwesenheit = {}; a.status = 'geplant' })}>Zurücksetzen</button>
            <button className="leise" onClick={() => {
              if (confirm('Termin als abgesagt markieren? Er erscheint dann nicht im Export.')) mutiere(a => { a.status = 'abgesagt' })
            }}>Training abgesagt</button>
          </div>
          <div className="hinweis info">{anwesend} von {mitglieder.length} anwesend — Antippen zum Abhaken.</div>
        </>
      )}

      <div className="karte" style={{ padding: '0.2rem 1rem' }}>
        {mitglieder.map(m => {
          const p = personById.get(m.personId)
          if (!p) return null
          const an = !!termin.anwesenheit[m.personId]
          return (
            <div key={m.personId} className="zeile" style={{ cursor: 'pointer' }}
              onClick={() => termin.status !== 'abgesagt' && toggle(m.personId)}>
              <span className={'check' + (an ? ' an' : '')}>✓</span>
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

      <div className="btnreihe">
        <button className="leise breit" onClick={() => {
          if (!confirm('Diesen Termin endgültig löschen?')) return
          update(s => {
            const n = structuredClone(s)
            const g = n.gruppen.find(g => g.id === gruppeId)!
            g.aktivitaeten = g.aktivitaeten.filter(a => a.id !== terminId)
            return n
          })
          window.location.hash = '#/gruppe/' + gruppeId
        }}>Termin löschen</button>
      </div>
    </Seite>
  )
}
