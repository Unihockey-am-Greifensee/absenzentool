import { useEffect, useRef, useState } from 'react'
import type { AppState, Aktivitaet, Aktivitaetstyp, FristTraining, FristWettkampf, Funktion, Gruppe, Mitglied, MitgliedStatus, Person } from '../types'
import { neueId } from '../types'
import { Seite, useBenutzer, type Update } from '../App'
import { heute } from '../lib/datum'
import { DAUER_TRAINING, DAUER_TRAININGSTAG } from '../lib/ndsExport'
import { KalenderSektion } from './IcalSync'
import { useTrainerListe } from '../lib/useTrainerListe'
import { aktiveMitglieder, hatAnwesenheit, statusVon } from '../lib/mitglieder'
import { terminGruppen, type TerminGruppe } from '../lib/termine'
import { istAnwesend } from '../lib/anwesenheit'
import { neuestesFoto, neuestesTeamfoto } from '../lib/saison'
import { komprimiertesTeamfoto } from '../lib/foto'
import { kurseLaden } from '../lib/apiSync'
import { stufeBerechnen } from '../lib/kurse'

const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

export function chDatumKurz(iso: string): string {
  const [j, m, t] = iso.split('-')
  const wt = WOCHENTAGE[new Date(Number(j), Number(m) - 1, Number(t)).getDay()]
  return `${wt} ${t}.${m}.${j.slice(2)}`
}

export function GruppeDetail({ state, update, gruppeId }: { state: AppState; update: Update; gruppeId: string }) {
  const benutzer = useBenutzer()
  const gruppe = state.gruppen.find(g => g.id === gruppeId)
  const [zeigeNeu, setZeigeNeu] = useState(false)
  if (!gruppe) return <Seite titel="Gruppe nicht gefunden" zurueck="" tab="gruppen"><div className="leer">Diese Gruppe existiert nicht (mehr).</div></Seite>
  // Nur der Hauptverantwortliche der Gruppe soll Termine anlegen — Admin behält wie überall sonst vollen Zugriff.
  const darfTermineAnlegen = benutzer.rolle === 'master' || benutzer.email === gruppe.hauptverantwortlicherEmail

  return (
    <Seite titel={gruppe.name} zurueck="" tab="gruppen">
      <TeamFotoSektion state={state} update={update} gruppeId={gruppe.id} />

      <KalenderSektion state={state} update={update} gruppeId={gruppe.id} />
      <TrainerZuteilung state={state} update={update} gruppeId={gruppe.id} />
      <AbmeldeFrist state={state} update={update} gruppeId={gruppe.id} />

      <TermineSektionen gruppe={gruppe} />

      <MitgliederSektionen state={state} update={update} gruppeId={gruppe.id} />

      {darfTermineAnlegen && (
        <>
          <div className="btnreihe">
            <button className="breit" onClick={() => setZeigeNeu(v => !v)}>{zeigeNeu ? 'Formular schliessen' : '+ Termine hinzufügen'}</button>
          </div>
          {zeigeNeu && <NeueTermine gruppe={gruppe.id} state={state} update={update} fertig={() => setZeigeNeu(false)} />}
        </>
      )}
    </Seite>
  )
}

function TeamFotoSektion({ state, update, gruppeId }: { state: AppState; update: Update; gruppeId: string }) {
  const benutzer = useBenutzer()
  const darfBearbeiten = benutzer.rolle !== 'trainer' || !!benutzer.fotoRecht
  const [lädt, setLädt] = useState(false)
  const [vorschau, setVorschau] = useState<string | null>(null)
  const saison = state.fotoSaison
  const foto = neuestesTeamfoto(state.teamFotos, gruppeId)

  const speichern = (datenUrl: string) => {
    update(s => {
      const n = structuredClone(s)
      n.teamFotos = n.teamFotos.filter(f => !(f.gruppeId === gruppeId && f.saison === saison))
      n.teamFotos.push({ id: neueId(), gruppeId, saison, datenUrl, hochgeladenAm: new Date().toISOString() })
      return n
    })
    setVorschau(null)
  }

  const hochladen = async (datei: File) => {
    setLädt(true)
    try {
      speichern(await komprimiertesTeamfoto(datei))
    } catch {
      alert('Foto konnte nicht verarbeitet werden.')
    } finally {
      setLädt(false)
    }
  }

  const löschen = (fotoId: string) => {
    if (!confirm('Dieses Teamfoto endgültig löschen?')) return
    update(s => {
      const n = structuredClone(s)
      n.teamFotos = n.teamFotos.filter(f => f.id !== fotoId)
      return n
    })
  }

  // Bild aus der Zwischenablage per Cmd/Strg+V übernehmen (plattformunabhängig) — nur eine
  // Vorschau, damit ein versehentliches Einfügen nicht sofort ungewollt speichert.
  const vorschauZeigenRef = useRef<((datei: File) => Promise<void>) | undefined>(undefined)
  vorschauZeigenRef.current = async datei => {
    setLädt(true)
    try {
      setVorschau(await komprimiertesTeamfoto(datei))
    } catch {
      alert('Foto konnte nicht verarbeitet werden.')
    } finally {
      setLädt(false)
    }
  }
  useEffect(() => {
    if (!darfBearbeiten) return
    const beiPaste = (e: ClipboardEvent) => {
      const datei = [...(e.clipboardData?.items ?? [])].find(i => i.type.startsWith('image/'))?.getAsFile()
      if (datei) { e.preventDefault(); void vorschauZeigenRef.current?.(datei) }
    }
    document.addEventListener('paste', beiPaste)
    return () => document.removeEventListener('paste', beiPaste)
  }, [darfBearbeiten])

  // Frühere Saisons bleiben erhalten, verschwinden aber aus der Hauptansicht, sobald ein
  // neues Foto für die aktuelle Saison hochgeladen wurde — hier als Archiv einsehbar.
  const frühere = state.teamFotos
    .filter(f => f.gruppeId === gruppeId && f.id !== foto?.id)
    .sort((a, b) => b.saison.localeCompare(a.saison))

  if (!foto && !darfBearbeiten) return null

  return (
    <div style={{ marginBottom: '1rem' }}>
      {foto && (
        <img src={foto.datenUrl} alt="" style={{
          width: '100%', aspectRatio: '16 / 9', objectFit: 'cover',
          borderRadius: 'var(--radius-lg)', border: '2px solid var(--ink)', display: 'block',
        }} />
      )}
      {darfBearbeiten && (
        vorschau ? (
          <>
            <div className="sub" style={{ margin: '0.5rem 0' }}>Vorschau — für Saison {saison} speichern?</div>
            <img src={vorschau} alt="" style={{
              width: '100%', aspectRatio: '16 / 9', objectFit: 'cover',
              borderRadius: 'var(--radius-lg)', border: '2px solid var(--ink)', display: 'block',
            }} />
            <div className="btnreihe">
              <button onClick={() => speichern(vorschau)}>Speichern</button>
              <button className="leise" onClick={() => setVorschau(null)}>Verwerfen</button>
            </div>
          </>
        ) : (
          <>
            <label className="feld" style={{ marginTop: foto ? '0.5rem' : 0 }}>
              {foto ? `Teamfoto für Saison ${saison} ersetzen` : `Teamfoto für Saison ${saison} hochladen (16:9)`}
              <input type="file" accept="image/*" disabled={lädt}
                onChange={e => { const f = e.target.files?.[0]; if (f) void hochladen(f); e.target.value = '' }} />
            </label>
            <div className="sub" style={{ marginTop: '-0.4rem' }}>… oder ein kopiertes Bild mit Cmd/Strg+V einfügen.</div>
            {lädt && <div className="sub">Wird verarbeitet …</div>}
            {foto && <button className="leise breit" style={{ marginTop: '0.4rem' }} onClick={() => löschen(foto.id)}>Teamfoto löschen</button>}
          </>
        )
      )}
      {frühere.length > 0 && (
        <details className="aufklapp" style={{ marginTop: '0.5rem' }}>
          <summary>Frühere Teamfotos ({frühere.length})</summary>
          {frühere.map(f => (
            <div key={f.id} style={{ marginTop: '0.5rem' }}>
              <div className="sub" style={{ marginBottom: '0.3rem' }}>Saison {f.saison}</div>
              <img src={f.datenUrl} alt="" style={{
                width: '100%', aspectRatio: '16 / 9', objectFit: 'cover',
                borderRadius: 'var(--radius-lg)', border: '1.5px solid var(--line)', display: 'block',
              }} />
              {darfBearbeiten && <button className="leise breit" style={{ marginTop: '0.4rem' }} onClick={() => löschen(f.id)}>Löschen</button>}
            </div>
          ))}
        </details>
      )}
    </div>
  )
}

export function terminZeile(gruppe: Gruppe, t: TerminGruppe) {
  const a = t.haupt
  const anwesend = Object.values(a.anwesenheit).filter(istAnwesend).length
  return (
    <a key={a.id} className="zeile" href={`#/gruppe/${gruppe.id}/termin/${a.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="haupt">
        <div className="titel">{chDatumKurz(a.datum)} · {a.typ}{t.alle.length > 1 && ` (${t.alle.length} Spiele)`}</div>
        <div className="sub">{[a.zeit, a.dauer && a.dauer + ' Min.', a.ort, a.titel].filter(Boolean).join(' · ') || '—'}</div>
      </div>
      {a.status === 'abgesagt' && <span className="pill abgesagt">abgesagt</span>}
      {a.status !== 'abgesagt' && a.status === 'durchgefuehrt' && <span className="pill ok">{anwesend}/{aktiveMitglieder(gruppe).length} ✓</span>}
      {a.status === 'geplant' && <span className="pill offen">offen</span>}
    </a>
  )
}

function TermineSektionen({ gruppe }: { gruppe: Gruppe }) {
  const [alleAktuelle, setAlleAktuelle] = useState(false)
  const [alleAbgeschlossene, setAlleAbgeschlossene] = useState(false)

  const gruppen = terminGruppen(gruppe)
  if (gruppen.length === 0) {
    return (
      <>
        <h2 className="abschnitt">Termine</h2>
        <div className="leer">Noch keine Termine. Lege oben Trainings an — einzeln oder als Wochenserie.</div>
      </>
    )
  }

  const heuteIso = heute()
  const offen = (t: TerminGruppe) => !t.haupt.abgeschlossen && !t.haupt.archiviert
  // Aktuell = offen UND heute oder abgelaufen: genau die, für die jetzt Anwesenheit
  // erfasst werden muss. Zukünftige offene Termine kommen separat unter «Kommende».
  const aktuelle = gruppen.filter(t => offen(t) && t.haupt.datum <= heuteIso)
    .sort((a, b) => a.haupt.datum.localeCompare(b.haupt.datum) || (a.haupt.zeit ?? '').localeCompare(b.haupt.zeit ?? ''))
  const abgeschlossene = gruppen.filter(t => t.haupt.abgeschlossen && !t.haupt.archiviert)
    .sort((a, b) => b.haupt.datum.localeCompare(a.haupt.datum) || (b.haupt.zeit ?? '').localeCompare(a.haupt.zeit ?? ''))
  // Kommende (offen, zukünftig) und Archivierte (per Halbjahresabschluss) können durch den
  // iCal-Sync sehr viele werden — daher nur zählen und auf eine eigene Seite verlinken, statt
  // hier hunderte Zeilen zu rendern.
  const kommendeAnzahl = gruppen.filter(t => offen(t) && t.haupt.datum > heuteIso).length
  const archivierteAnzahl = gruppen.filter(t => t.haupt.archiviert).length

  return (
    <>
      <h2 className="abschnitt">Aktuelle Termine</h2>
      {aktuelle.length === 0 && <div className="sub" style={{ padding: '0 0.25rem 0.5rem' }}>Keine offenen Termine bis heute.</div>}
      {aktuelle.length > 0 && (
        <div className="karte" style={{ padding: '0.2rem 1rem' }}>
          {(alleAktuelle ? aktuelle : aktuelle.slice(0, 5)).map(t => terminZeile(gruppe, t))}
        </div>
      )}
      {!alleAktuelle && aktuelle.length > 5 && (
        <div className="btnreihe"><button className="leise breit" onClick={() => setAlleAktuelle(true)}>{aktuelle.length - 5} weitere anzeigen</button></div>
      )}

      {kommendeAnzahl > 0 && (
        <a className="btn sekundaer breit" href={`#/gruppe/${gruppe.id}/kommend`} style={{ marginTop: '0.9rem' }}>
          Kommende Termine ({kommendeAnzahl}) ›
        </a>
      )}

      <h2 className="abschnitt">Abgeschlossene Termine</h2>
      {abgeschlossene.length === 0 && <div className="sub" style={{ padding: '0 0.25rem 0.5rem' }}>Noch keine abgeschlossenen Termine.</div>}
      {abgeschlossene.length > 0 && (
        <div className="karte" style={{ padding: '0.2rem 1rem' }}>
          {(alleAbgeschlossene ? abgeschlossene : abgeschlossene.slice(0, 5)).map(t => terminZeile(gruppe, t))}
        </div>
      )}
      {!alleAbgeschlossene && abgeschlossene.length > 5 && (
        <div className="btnreihe"><button className="leise breit" onClick={() => setAlleAbgeschlossene(true)}>{abgeschlossene.length - 5} weitere anzeigen</button></div>
      )}

      {archivierteAnzahl > 0 && (
        <a className="btn sekundaer breit" href={`#/gruppe/${gruppe.id}/archiv`} style={{ marginTop: '0.9rem' }}>
          Archivierte Termine ({archivierteAnzahl}) ›
        </a>
      )}
    </>
  )
}

function nameVon(personById: Map<string, Person>, personId: string): string {
  const p = personById.get(personId)
  return p ? `${p.vorname} ${p.nachname}` : '(unbekannte Person)'
}

function MitgliederSektionen({ state, update, gruppeId }: { state: AppState; update: Update; gruppeId: string }) {
  const benutzer = useBenutzer()
  const istMaster = benutzer.rolle !== 'trainer'
  const gruppe = state.gruppen.find(g => g.id === gruppeId)!
  const personById = new Map(state.personen.map(p => [p.id, p]))
  const nachName = (a: Mitglied, b: Mitglied) =>
    nameVon(personById, a.personId).localeCompare(nameVon(personById, b.personId), 'de')
  // Global archivierte Personen (Personen-Archiv) verschwinden aus allen Gruppen — sie haben
  // dort keine eigene Sichtbarkeit mehr, unabhängig vom Mitglied-Status in dieser Gruppe.
  const nichtGlobalArchiviert = (m: Mitglied) => !personById.get(m.personId)?.archiviert

  const coach = gruppe.mitglieder.filter(m => statusVon(m) === 'aktiv' && m.funktion === 'Leiter/in' && nichtGlobalArchiviert(m)).sort(nachName)
  const team = gruppe.mitglieder.filter(m => statusVon(m) === 'aktiv' && m.funktion === 'Teilnehmer/in' && nichtGlobalArchiviert(m)).sort(nachName)
  const schnuppernde = gruppe.mitglieder.filter(m => statusVon(m) === 'schnuppernd' && nichtGlobalArchiviert(m)).sort(nachName)
  const archiviert = gruppe.mitglieder.filter(m => statusVon(m) === 'archiviert' && nichtGlobalArchiviert(m)).sort(nachName)

  const archivieren = (personId: string) =>
    update(s => {
      const n = structuredClone(s)
      const g = n.gruppen.find(g => g.id === gruppeId)!
      g.mitglieder.find(m => m.personId === personId)!.status = 'archiviert'
      return n
    })

  const reaktivieren = (personId: string) =>
    update(s => {
      const n = structuredClone(s)
      const g = n.gruppen.find(g => g.id === gruppeId)!
      g.mitglieder.find(m => m.personId === personId)!.status = 'aktiv'
      return n
    })

  const endgueltigLoeschen = (personId: string) => {
    const name = nameVon(personById, personId)
    const frage = hatAnwesenheit(gruppe, personId)
      ? `${name} hat mindestens eine erfasste Anwesenheit in dieser Gruppe. Beim endgültigen Löschen geht dieser Eintrag beim NDS-Export verloren. Trotzdem endgültig löschen?`
      : `${name} endgültig aus der Gruppe löschen? Das kann nicht rückgängig gemacht werden.`
    if (!confirm(frage)) return
    update(s => {
      const n = structuredClone(s)
      const g = n.gruppen.find(g => g.id === gruppeId)!
      g.mitglieder = g.mitglieder.filter(x => x.personId !== personId)
      return n
    })
  }

  const zeile = (m: Mitglied, pillText?: string) => {
    const p = personById.get(m.personId)
    if (!p) return null
    const foto = neuestesFoto(state.fotos, m.personId)
    return (
      <MitgliedZeile key={m.personId} person={p} mitglied={m} foto={foto?.datenUrl} pillText={pillText}
        onArchivieren={() => {
          if (confirm(`${p.vorname} ${p.nachname} ins Archiv verschieben? Anwesenheiten bleiben für den NDS-Export erhalten.`)) archivieren(m.personId)
        }}
      />
    )
  }

  return (
    <>
      <h2 className="abschnitt">Coach ({coach.length})</h2>
      <div className="karte" style={{ padding: '0.2rem 1rem' }}>
        {coach.length === 0 && <div className="sub" style={{ padding: '0.5rem 0' }}>Noch kein Coach erfasst.</div>}
        {coach.map(m => zeile(m))}
      </div>

      <h2 className="abschnitt">Team ({team.length})</h2>
      <div className="karte" style={{ padding: '0.2rem 1rem' }}>
        {team.length === 0 && <div className="sub" style={{ padding: '0.5rem 0' }}>Noch keine Spieler/-innen erfasst.</div>}
        {team.map(m => zeile(m))}
      </div>

      <h2 className="abschnitt">Schnuppernde ({schnuppernde.length})</h2>
      <div className="karte" style={{ padding: '0.2rem 1rem' }}>
        {schnuppernde.length === 0 && <div className="sub" style={{ padding: '0.5rem 0' }}>Niemand am Schnuppern.</div>}
        {schnuppernde.map(m => zeile(m, 'Schnuppern'))}
      </div>

      <MitgliederVerwaltung state={state} update={update} gruppeId={gruppeId} />

      <h2 className="abschnitt">Archiviert ({archiviert.length})</h2>
      {archiviert.length === 0 && <div className="sub" style={{ padding: '0 0.25rem 0.5rem' }}>Noch niemand archiviert.</div>}
      {archiviert.length > 0 && (
        <div className="karte" style={{ padding: '0.2rem 1rem' }}>
          {archiviert.map(m => {
            const p = personById.get(m.personId)
            if (!p) return null
            return (
              <div key={m.personId} className="zeile">
                <div className="haupt">
                  <div className="titel">{p.vorname} {p.nachname}</div>
                  <div className="sub">{m.rolle ?? m.funktion}</div>
                </div>
                <button className="sekundaer" onClick={() => reaktivieren(m.personId)}>Reaktivieren</button>
                {istMaster && (
                  <button className="leise" onClick={() => endgueltigLoeschen(m.personId)}>Endgültig löschen</button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

/**
 * Ausserhalb von MitgliederSektionen definiert — braucht eigene Hooks (Kurs-Stufe pro Coach
 * nachladen), und ein inline definierter Komponenten-Typ würde bei jedem Render neu gemountet
 * (siehe gleiches Problem bei der F-Komponente in Personen.tsx).
 */
function MitgliedZeile({ person, mitglied, foto, pillText, onArchivieren }: {
  person: Person; mitglied: Mitglied; foto?: string; pillText?: string
  onArchivieren: () => void
}) {
  const istCoach = mitglied.funktion === 'Leiter/in'
  const [stufe, setStufe] = useState<string | null | undefined>(undefined) // undefined = lädt noch

  useEffect(() => {
    if (!istCoach) return
    kurseLaden(person.id).then(eintraege => setStufe(stufeBerechnen(eintraege)))
  }, [istCoach, person.id])

  const unterzeile = istCoach
    ? (stufe === undefined ? 'Lädt Stufe …' : (stufe ?? 'Leiter/in — noch keine Stufe erreicht'))
    : (mitglied.rolle ?? mitglied.funktion)

  return (
    <div className="zeile">
      {foto ? <img src={foto} alt="" className="foto-icon" /> : <div className="foto-icon platzhalter" />}
      <div className="haupt">
        <div className="titel">{person.vorname} {person.nachname}</div>
        <div className="sub">{unterzeile}{!person.jsNummer && ' · ⚠ keine J+S-Nr.'}</div>
      </div>
      {pillText && <span className="pill leiter">{pillText}</span>}
      <button className="leise" onClick={onArchivieren}>Archivieren</button>
    </div>
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
    <details className="aufklapp">
      <summary>Trainer-Zuteilung ({emails.length})</summary>
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
    </details>
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
    <details className="aufklapp">
      <summary>Abmelde-Frist (An-/Abmeldefunktion)</summary>
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
    </details>
  )
}

function MitgliederVerwaltung({ state, update, gruppeId }: { state: AppState; update: Update; gruppeId: string }) {
  const gruppe = state.gruppen.find(g => g.id === gruppeId)!
  const [suche, setSuche] = useState('')
  const kandidaten = suche.trim().length < 2 ? [] : state.personen
    .filter(p => !gruppe.mitglieder.some(m => m.personId === p.id))
    .filter(p => `${p.vorname} ${p.nachname}`.toLowerCase().includes(suche.trim().toLowerCase()))
    .slice(0, 6)

  const hinzufuegen = (personId: string, funktion: Funktion, status: MitgliedStatus) =>
    update(s => {
      const n = structuredClone(s)
      n.gruppen.find(g => g.id === gruppeId)!.mitglieder.push({ personId, funktion, status })
      return n
    })

  return (
    <details className="aufklapp">
      <summary>+ Schnuppernde/-r hinzufügen</summary>
      <div className="karte">
        <input className="suchfeld" placeholder="Name suchen …" value={suche} onChange={e => setSuche(e.target.value)} />
        {kandidaten.map(p => (
          <div key={p.id} className="zeile">
            <div className="haupt">
              <div className="titel">{p.vorname} {p.nachname}</div>
              <div className="sub">{p.geburtsdatum ?? 'ohne Geburtsdatum'}</div>
            </div>
            <div className="btnreihe" style={{ margin: 0 }}>
              <button className="sekundaer" onClick={() => { hinzufuegen(p.id, 'Teilnehmer/in', 'aktiv'); setSuche('') }}>+ Team</button>
              <button className="sekundaer" onClick={() => { hinzufuegen(p.id, 'Leiter/in', 'aktiv'); setSuche('') }}>+ Coach</button>
              <button className="leise" onClick={() => { hinzufuegen(p.id, 'Teilnehmer/in', 'schnuppernd'); setSuche('') }}>+ Schnuppern</button>
            </div>
          </div>
        ))}
        {suche.trim().length >= 2 && kandidaten.length === 0 && (
          <div className="sub" style={{ padding: '0.4rem 0' }}>
            Niemand gefunden. Neue Personen erfasst du unter <a href="#/personen">Personen</a>.
          </div>
        )}
      </div>
    </details>
  )
}

function NeueTermine({ gruppe, state, update, fertig }: { gruppe: string; state: AppState; update: Update; fertig: () => void }) {
  const g = state.gruppen.find(x => x.id === gruppe)!
  const [typ, setTyp] = useState<Aktivitaetstyp>('Training')
  const [datum, setDatum] = useState(heute())
  const [bis, setBis] = useState('')
  const [zeit, setZeit] = useState(g.standardZeit ?? '18:30')
  const [dauer, setDauer] = useState<number>(g.standardDauer ?? 90)
  const [ort, setOrt] = useState(g.standardOrt ?? '')
  const istTraining = typ === 'Training'
  const brauchtDauer = typ === 'Training' || typ === 'Trainingstag'
  const dauerListe = typ === 'Training' ? DAUER_TRAINING : DAUER_TRAININGSTAG

  const speichern = () => {
    const daten: string[] = []
    if (bis && bis > datum) {
      for (let d = new Date(datum + 'T12:00:00'); ; d.setDate(d.getDate() + 7)) {
        const iso = d.toISOString().slice(0, 10)
        if (iso > bis) break
        daten.push(iso)
      }
    } else {
      daten.push(datum)
    }
    update(s => {
      const n = structuredClone(s)
      const zg = n.gruppen.find(x => x.id === gruppe)!
      for (const iso of daten) {
        const a: Aktivitaet = {
          id: neueId(), typ, datum: iso, status: 'geplant', anwesenheit: {},
          zeit: istTraining ? zeit : undefined,
          dauer: brauchtDauer ? dauer : undefined,
          ort: istTraining ? ort || undefined : undefined,
        }
        zg.aktivitaeten.push(a)
      }
      zg.standardZeit = istTraining ? zeit : zg.standardZeit
      zg.standardDauer = brauchtDauer ? dauer : zg.standardDauer
      zg.standardOrt = istTraining ? ort || zg.standardOrt : zg.standardOrt
      return n
    })
    fertig()
  }

  return (
    <div className="karte">
      <label className="feld">Aktivitätstyp
        <select value={typ} onChange={e => setTyp(e.target.value as Aktivitaetstyp)}>
          <option>Training</option><option>Trainingstag</option><option>Wettkampf</option><option>Lagertag</option>
        </select>
      </label>
      <div className="felder2">
        <label className="feld">Datum (erster Termin)
          <input type="date" value={datum} onChange={e => setDatum(e.target.value)} />
        </label>
        <label className="feld">Wöchentlich wiederholen bis (optional)
          <input type="date" value={bis} onChange={e => setBis(e.target.value)} />
        </label>
      </div>
      {istTraining && (
        <div className="felder2">
          <label className="feld">Zeit
            <input type="time" value={zeit} onChange={e => setZeit(e.target.value)} />
          </label>
          <label className="feld">Ort (Halle)
            <input value={ort} onChange={e => setOrt(e.target.value)} placeholder="z. B. Halle Schwerzenbach" />
          </label>
        </div>
      )}
      {brauchtDauer && (
        <label className="feld">Dauer (NDS-Werteliste)
          <select value={dauer} onChange={e => setDauer(Number(e.target.value))}>
            {dauerListe.map(d => <option key={d} value={d}>{d} Minuten</option>)}
          </select>
        </label>
      )}
      <button className="breit" onClick={speichern}>
        {bis && bis > datum ? 'Serie anlegen' : 'Termin anlegen'}
      </button>
    </div>
  )
}
