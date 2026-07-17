import type { Aktivitaet, AppState, Mitglied } from '../types'
import { Seite, useBenutzer, type Update } from '../App'
import { chDatumKurz } from './GruppeDetail'
import { aktiveMitglieder, statusVon } from '../lib/mitglieder'
import { terminGeschwister } from '../lib/termine'
import { neuestesFoto } from '../lib/saison'
import { anwesenheitStatus, zaehleStatus, type AnwesenheitStatus } from '../lib/anwesenheit'

const STATUS_OPTIONEN: { status: AnwesenheitStatus; label: string; titel: string }[] = [
  { status: 'anwesend', label: 'AN', titel: 'Anwesend' },
  { status: 'abgemeldet', label: 'AB', titel: 'Abgemeldet' },
  { status: 'unabgemeldet', label: 'UN', titel: 'Unabgemeldet' },
]

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
  const nachName = (a: Mitglied, b: Mitglied) =>
    (personById.get(a.personId)?.nachname ?? '').localeCompare(personById.get(b.personId)?.nachname ?? '', 'de')
  // Global archivierte Personen (Personen-Archiv) tauchen in keiner Gruppe/Absenzenliste mehr auf.
  const aktive = aktiveMitglieder(gruppe).filter(m => !personById.get(m.personId)?.archiviert)
  const coach = aktive.filter(m => statusVon(m) === 'aktiv' && m.funktion === 'Leiter/in').sort(nachName)
  const team = aktive.filter(m => statusVon(m) === 'aktiv' && m.funktion === 'Teilnehmer/in').sort(nachName)
  const schnuppernde = aktive.filter(m => statusVon(m) === 'schnuppernd').sort(nachName)
  // Archivierte (Mitglied oder global archivierte Person), die bei DIESEM Termin eine
  // Anwesenheit haben — z. B. historische Importe. Tauchen sonst in keiner Liste mehr auf.
  const archivierteTeilnehmer = gruppe.mitglieder
    .filter(m => (statusVon(m) === 'archiviert' || !!personById.get(m.personId)?.archiviert) && termin.anwesenheit[m.personId] !== undefined)
    .sort(nachName)
  const zaehlung = zaehleStatus(termin.anwesenheit, aktive.map(m => m.personId))

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

  const setzeStatus = (personId: string, status: AnwesenheitStatus) =>
    mutiere(a => {
      const aktuell = anwesenheitStatus(a.anwesenheit[personId])
      if (aktuell === status) delete a.anwesenheit[personId]
      else a.anwesenheit[personId] = status
      if (a.status === 'geplant') a.status = 'durchgefuehrt'
    })

  const gesperrt = termin.status === 'abgesagt' || !!termin.abgeschlossen || !!termin.archiviert

  const gruppenBox = (titel: string, liste: Mitglied[], leerText: string) => (
    <>
      <h2 className="abschnitt">{titel} ({liste.length})</h2>
      <div className="karte" style={{ padding: '0.2rem 1rem' }}>
        {liste.length === 0 && <div className="sub" style={{ padding: '0.5rem 0' }}>{leerText}</div>}
        {liste.map(m => {
          const p = personById.get(m.personId)
          if (!p) return null
          const foto = neuestesFoto(state.fotos, m.personId)
          const aktuell = anwesenheitStatus(termin.anwesenheit[m.personId])
          const familienMeldung = termin.anwesenheitMeta?.[m.personId]
          return (
            <div key={m.personId} className="zeile">
              {foto && <img src={foto.datenUrl} alt="" className="foto-icon" />}
              <div className="haupt">
                <div className="titel">{p.vorname} {p.nachname}</div>
                <div className="sub">{m.rolle ?? m.funktion}</div>
                {familienMeldung && (
                  <div className="sub" style={{ color: 'var(--accent-ink)', fontWeight: 600 }}
                    title={familienMeldung.grund ? `Grund: ${familienMeldung.grund}` : undefined}>
                    👪 von Familie gemeldet{familienMeldung.grund ? ` · ${familienMeldung.grund}` : ''}
                  </div>
                )}
              </div>
              <div className="statusreihe">
                {STATUS_OPTIONEN.map(o => (
                  <button key={o.status} type="button" title={o.titel} disabled={gesperrt}
                    className={'statusbtn ' + o.status + (aktuell === o.status ? ' aktiv' : '')}
                    onClick={() => setzeStatus(m.personId, o.status)}>{o.label}</button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )

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
              a.status = zaehlung.anwesend > 0 ? 'durchgefuehrt' : 'geplant'
              a.abgeschlossen = false
            })}>Absage rückgängig</button>
          </div>
        </div>
      ) : (
        <>
          <div className="btnreihe">
            <button className="sekundaer" disabled={gesperrt} onClick={() => mutiere(a => {
              for (const m of aktive) a.anwesenheit[m.personId] = 'anwesend'
              a.status = 'durchgefuehrt'
            })}>Alle anwesend</button>
            <button className="leise" disabled={gesperrt} onClick={() => mutiere(a => { a.anwesenheit = {}; a.status = 'geplant' })}>Zurücksetzen</button>
            <button className="leise" disabled={gesperrt} onClick={() => {
              if (confirm('Termin als abgesagt markieren? Er erscheint dann nicht im Export.')) {
                mutiere(a => { a.status = 'abgesagt'; a.abgeschlossen = true })
              }
            }}>Training abgesagt</button>
          </div>
          <div className="hinweis info">
            {zaehlung.anwesend} anwesend · {zaehlung.abgemeldet} abgemeldet · {zaehlung.unabgemeldet} unabgemeldet
            {zaehlung.offen > 0 && ` · ${zaehlung.offen} offen`}
            {termin.archiviert ? ' — archiviert, nur der Admin kann das aufheben.'
              : termin.abgeschlossen ? ' — abgeschlossen, «Wieder öffnen» zum Bearbeiten.' : ''}
          </div>
        </>
      )}

      {gruppenBox('Coach', coach, 'Kein Coach in dieser Gruppe.')}
      {gruppenBox('Team', team, 'Keine Spieler/innen in dieser Gruppe.')}
      {gruppenBox('Schnuppernde', schnuppernde, 'Niemand am Schnuppern.')}
      {archivierteTeilnehmer.length > 0 && gruppenBox('Archivierte Teilnehmer/innen', archivierteTeilnehmer, '')}

      {termin.archiviert ? (
        <div className="hinweis warnung">
          Dieser Termin wurde im Halbjahresabschluss archiviert und ist für Trainer nicht mehr bearbeitbar.
          {istAdmin && (
            <div className="btnreihe" style={{ marginBottom: 0 }}>
              <button className="sekundaer" onClick={() => mutiere(a => { a.archiviert = false })}>Archivierung aufheben</button>
            </div>
          )}
        </div>
      ) : termin.status !== 'abgesagt' && (
        <>
          <div className="btnreihe">
            {termin.abgeschlossen ? (
              <button className="sekundaer breit" onClick={() => mutiere(a => { a.abgeschlossen = false })}>Wieder öffnen</button>
            ) : (
              <button className="breit" disabled={zaehlung.offen > 0}
                onClick={() => mutiere(a => { a.abgeschlossen = true })}>Abschliessen</button>
            )}
          </div>
          {!termin.abgeschlossen && zaehlung.offen > 0 && (
            <div className="sub" style={{ marginTop: '-0.6rem' }}>
              Erst möglich, wenn bei allen {zaehlung.offen === 1 ? 'noch 1 Person eine' : `noch ${zaehlung.offen} Personen eine`} Option ausgewählt wurde.
            </div>
          )}
        </>
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
