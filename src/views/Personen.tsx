import { useEffect, useRef, useState } from 'react'
import type { AppState, Person } from '../types'
import { neueId } from '../types'
import { Seite, useBenutzer, type Update } from '../App'
import { statusVon } from '../lib/mitglieder'
import { istAnwesend } from '../lib/anwesenheit'
import { fotosVonPerson } from '../lib/saison'
import { komprimiertesFoto } from '../lib/foto'
import { kurseLaden, kursSetzen, kursEntfernen, type Kurs, type KursEintrag } from '../lib/apiSync'
import { NOMINATIONEN, KURSE, BEFOERDERUNG, stufeBerechnen } from '../lib/kurse'

export function PersonenListe({ state }: { state: AppState }) {
  const benutzer = useBenutzer()
  const istAdmin = benutzer.rolle !== 'trainer'
  const [suche, setSuche] = useState('')
  const aktive = state.personen.filter(p => !p.archiviert)
  const gefiltert = aktive
    .filter(p => `${p.vorname} ${p.nachname}`.toLowerCase().includes(suche.trim().toLowerCase()))
    .sort((a, b) => a.nachname.localeCompare(b.nachname, 'de') || a.vorname.localeCompare(b.vorname, 'de'))
  const archivAnzahl = state.personen.length - aktive.length

  return (
    <Seite titel="Personen" tab="personen">
      <input className="suchfeld" placeholder="Suchen …" value={suche} onChange={e => setSuche(e.target.value)} />
      {istAdmin && archivAnzahl > 0 && (
        <div className="btnreihe" style={{ marginTop: 0 }}>
          <a className="btn leise" href="#/personen-archiv">Archiv ({archivAnzahl})</a>
        </div>
      )}
      <div className="sub" style={{ marginBottom: '0.5rem', color: 'var(--muted)' }}>
        {gefiltert.length} von {aktive.length} Personen
      </div>
      <div className="karte" style={{ padding: '0.2rem 1rem' }}>
        {gefiltert.slice(0, 100).map(p => (
          <a key={p.id} className="zeile" href={'#/person/' + p.id} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="haupt">
              <div className="titel">{p.nachname} {p.vorname}</div>
              <div className="sub">
                {[p.geburtsdatum, p.ort].filter(Boolean).join(' · ') || '—'}
                {!p.jsNummer && ' · ⚠ J+S-Nr. fehlt'}
                {benutzer.rolle !== 'trainer' && !p.ahvNr && !p.peid && ' · ⚠ AHV fehlt'}
              </div>
            </div>
            {p.quelle === 'manuell' && <span className="pill offen">manuell</span>}
          </a>
        ))}
        {gefiltert.length > 100 && <div className="sub" style={{ padding: '0.5rem 0' }}>… {gefiltert.length - 100} weitere — Suche verfeinern.</div>}
      </div>
    </Seite>
  )
}

export function PersonenArchiv({ state, update }: { state: AppState; update: Update }) {
  const archivierte = state.personen
    .filter(p => p.archiviert)
    .sort((a, b) => a.nachname.localeCompare(b.nachname, 'de') || a.vorname.localeCompare(b.vorname, 'de'))

  const reaktivieren = (personId: string) =>
    update(s => {
      const n = structuredClone(s)
      delete n.personen.find(p => p.id === personId)!.archiviert
      return n
    })

  const endgueltigLoeschen = (person: Person) => {
    const betroffen = state.gruppen.some(g => g.aktivitaeten.some(a => istAnwesend(a.anwesenheit[person.id])))
    const frage = betroffen
      ? `${person.vorname} ${person.nachname} hat erfasste Anwesenheiten. Beim endgültigen Löschen gehen diese Einträge für den NDS-Export unwiderruflich verloren. Trotzdem endgültig löschen?`
      : `${person.vorname} ${person.nachname} endgültig löschen? Das kann nicht rückgängig gemacht werden.`
    if (!confirm(frage)) return
    update(s => {
      const n = structuredClone(s)
      n.personen = n.personen.filter(x => x.id !== person.id)
      n.fotos = n.fotos.filter(f => f.personId !== person.id)
      for (const g of n.gruppen) {
        g.mitglieder = g.mitglieder.filter(m => m.personId !== person.id)
        for (const a of g.aktivitaeten) delete a.anwesenheit[person.id]
      }
      return n
    })
  }

  return (
    <Seite titel="Personen-Archiv" zurueck="personen" tab="personen">
      <div className="hinweis info">
        Archivierte Personen sind aus der Personen-Liste und allen Gruppen ausgeblendet, aber noch nicht
        gelöscht. Erst «Endgültig löschen» entfernt die Person und alle ihre Anwesenheiten/Fotos ohne Rückstände.
      </div>
      <div className="karte" style={{ padding: '0.2rem 1rem' }}>
        {archivierte.length === 0 && <div className="sub" style={{ padding: '0.6rem 0' }}>Das Archiv ist leer.</div>}
        {archivierte.map(p => (
          <div key={p.id} className="zeile">
            <div className="haupt">
              <div className="titel">{p.vorname} {p.nachname}</div>
              <div className="sub">{[p.geburtsdatum, p.ort].filter(Boolean).join(' · ') || '—'}</div>
            </div>
            <button className="sekundaer" onClick={() => reaktivieren(p.id)}>Reaktivieren</button>
            <button className="leise" onClick={() => endgueltigLoeschen(p)}>Endgültig löschen</button>
          </div>
        ))}
      </div>
    </Seite>
  )
}

// Ausserhalb von PersonEdit definiert — sonst bekäme jedes Feld bei jedem Tastenanschlag einen
// neuen Komponenten-Typ und würde von React neu gemountet, was den Fokus killt (nur 1 Buchstabe
// tippbar).
function F({ label, anzeige, istTrainer, children }: { label: string; anzeige: string; istTrainer: boolean; children: React.ReactNode }) {
  return (
    <label className="feld">{label}
      {istTrainer ? <span className="feld-anzeige">{anzeige || '—'}</span> : children}
    </label>
  )
}

export function PersonEdit({ state, update, personId }: { state: AppState; update: Update; personId: string }) {
  const benutzer = useBenutzer()
  const istTrainer = benutzer.rolle === 'trainer'
  const vorhanden = state.personen.find(p => p.id === personId)
  const [p, setP] = useState<Person | undefined>(vorhanden)
  const [tab, setTab] = useState<'angaben' | 'gruppen' | 'fotos' | 'kurse'>('angaben')
  const istLeiterIn = state.gruppen.some(g => g.mitglieder.some(m => m.personId === personId && m.funktion === 'Leiter/in'))

  if (!vorhanden || !p) {
    return <Seite titel="Person nicht gefunden" zurueck="personen" tab="personen"><div className="leer">Diese Person existiert nicht (mehr).</div></Seite>
  }

  const feld = (k: keyof Person) => ({
    value: (p[k] as string | undefined) ?? '',
    disabled: istTrainer,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setP({ ...p, [k]: e.target.value || undefined }),
  })

  const speichern = () => {
    if (!p.vorname.trim() || !p.nachname.trim()) { alert('Vor- und Nachname sind Pflicht.'); return }
    update(s => {
      const n = structuredClone(s)
      n.personen[n.personen.findIndex(x => x.id === p.id)] = p
      return n
    })
    window.location.hash = '#/personen'
  }

  const archivieren = () => {
    if (!confirm(`${p.vorname} ${p.nachname} ins Archiv verschieben? Sie verschwindet aus der Personen-Liste und allen Gruppen, bleibt aber erhalten und lässt sich im Archiv wiederherstellen.`)) return
    update(s => {
      const n = structuredClone(s)
      n.personen.find(x => x.id === p.id)!.archiviert = true
      return n
    })
    window.location.hash = '#/personen'
  }

  const reaktivieren = () =>
    update(s => {
      const n = structuredClone(s)
      delete n.personen.find(x => x.id === p.id)!.archiviert
      setP({ ...p, archiviert: undefined })
      return n
    })

  const geschlechtAnzeige = p.geschlecht === 'm' ? 'männlich' : p.geschlecht === 'w' ? 'weiblich' : ''

  return (
    <Seite titel={`${p.vorname} ${p.nachname}`} zurueck="personen" tab="personen">
      <div className="btnreihe" style={{ marginTop: 0 }}>
        <button className={tab === 'angaben' ? '' : 'sekundaer'} onClick={() => setTab('angaben')}>Angaben</button>
        <button className={tab === 'gruppen' ? '' : 'sekundaer'} onClick={() => setTab('gruppen')}>Gruppen</button>
        <button className={tab === 'fotos' ? '' : 'sekundaer'} onClick={() => setTab('fotos')}>Fotos</button>
        {istLeiterIn && <button className={tab === 'kurse' ? '' : 'sekundaer'} onClick={() => setTab('kurse')}>Kurse</button>}
      </div>

      {tab === 'angaben' && (
        <>
          {p.quelle === 'kool' && !istTrainer && (
            <div className="hinweis info">Diese Person stammt aus dem kOOL-Import. Änderungen werden beim nächsten Import durch kOOL-Werte ergänzt, nicht überschrieben.</div>
          )}
          {p.archiviert && (
            <div className="hinweis warnung">
              Diese Person ist archiviert — ausgeblendet aus der Personen-Liste und allen Gruppen.
              {!istTrainer && <div className="btnreihe" style={{ marginBottom: 0 }}>
                <button className="sekundaer" onClick={reaktivieren}>Reaktivieren</button>
              </div>}
            </div>
          )}
          <div className="karte">
            <div className="felder2">
              <F label="Vorname" anzeige={p.vorname} istTrainer={istTrainer}><input {...feld('vorname')} /></F>
              <F label="Nachname" anzeige={p.nachname} istTrainer={istTrainer}><input {...feld('nachname')} /></F>
              <F label="Geburtsdatum" anzeige={p.geburtsdatum ?? ''} istTrainer={istTrainer}><input type="date" {...feld('geburtsdatum')} /></F>
              <F label="Geschlecht" anzeige={geschlechtAnzeige} istTrainer={istTrainer}>
                <select {...feld('geschlecht')}>
                  <option value="">—</option><option value="m">männlich</option><option value="w">weiblich</option>
                </select>
              </F>
            </div>
            <h2 className="abschnitt">Jugend+Sport</h2>
            <div className="felder2">
              <F label="J+S-Personennummer" anzeige={p.jsNummer ?? ''} istTrainer={istTrainer}><input {...feld('jsNummer')} placeholder="z. B. 2837521" /></F>
              {!istTrainer && <>
                <label className="feld">AHV-Nummer<input {...feld('ahvNr')} placeholder="756.…" /></label>
                <label className="feld">PEID (nur FL)<input {...feld('peid')} /></label>
              </>}
              <F label="Nationalität" anzeige={p.nationalitaet ?? ''} istTrainer={istTrainer}>
                <select {...feld('nationalitaet')}>
                  <option value="CH">CH</option><option value="FL">FL</option><option value="Andere">Andere</option>
                </select>
              </F>
              <F label="Muttersprache" anzeige={p.muttersprache ?? ''} istTrainer={istTrainer}>
                <select {...feld('muttersprache')}>
                  <option value="DE">DE</option><option value="FR">FR</option><option value="IT">IT</option><option value="Andere">Andere</option>
                </select>
              </F>
            </div>
            <h2 className="abschnitt">Adresse</h2>
            <div className="felder2">
              <F label="Strasse" anzeige={p.strasse ?? ''} istTrainer={istTrainer}><input {...feld('strasse')} /></F>
              <F label="Hausnummer" anzeige={p.hausnummer ?? ''} istTrainer={istTrainer}><input {...feld('hausnummer')} /></F>
              <F label="PLZ" anzeige={p.plz ?? ''} istTrainer={istTrainer}><input {...feld('plz')} /></F>
              <F label="Ort" anzeige={p.ort ?? ''} istTrainer={istTrainer}><input {...feld('ort')} /></F>
              <F label="Land (ISO)" anzeige={p.land ?? ''} istTrainer={istTrainer}><input {...feld('land')} placeholder="CH" /></F>
            </div>
            <h2 className="abschnitt">Kontakt</h2>
            <div className="felder2">
              <F label="E-Mail" anzeige={p.email ?? ''} istTrainer={istTrainer}><input {...feld('email')} /></F>
              <F label="Mobiltelefon" anzeige={p.mobil ?? ''} istTrainer={istTrainer}><input {...feld('mobil')} /></F>
              <F label="E-Mail Mutter" anzeige={p.emailMutter ?? ''} istTrainer={istTrainer}><input {...feld('emailMutter')} /></F>
              <F label="Handy Mutter" anzeige={p.mobilMutter ?? ''} istTrainer={istTrainer}><input {...feld('mobilMutter')} /></F>
              <F label="E-Mail Vater" anzeige={p.emailVater ?? ''} istTrainer={istTrainer}><input {...feld('emailVater')} /></F>
              <F label="Handy Vater" anzeige={p.mobilVater ?? ''} istTrainer={istTrainer}><input {...feld('mobilVater')} /></F>
            </div>
            <div className="sub" style={{ marginBottom: '0.6rem' }}>
              Absenzentool: {p.letzterLogin
                ? `zuletzt eingeloggt am ${new Date(p.letzterLogin).toLocaleString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                : 'noch nie eingeloggt'}
            </div>
            {!istTrainer && <button className="breit" onClick={speichern}>Speichern</button>}
          </div>
          {!istTrainer && !p.archiviert && (
            <div className="btnreihe">
              <button className="leise breit" onClick={archivieren}>Person archivieren</button>
            </div>
          )}
        </>
      )}

      {tab === 'gruppen' && <PersonGruppen state={state} update={update} person={p} />}
      {tab === 'fotos' && <PersonFotos state={state} update={update} person={p} />}
      {tab === 'kurse' && istLeiterIn && <PersonKurse person={p} />}
    </Seite>
  )
}

function PersonGruppen({ state, update, person }: { state: AppState; update: Update; person: Person }) {
  const benutzer = useBenutzer()
  const gruppen = benutzer.rolle === 'trainer'
    ? state.gruppen.filter(g => g.trainerEmails?.includes(benutzer.email!.toLowerCase()))
    : state.gruppen

  // Entfernen archiviert nur (Anwesenheiten bleiben für den NDS-Export erhalten) —
  // endgültig löschen kann nur der Master, direkt in der Gruppe unter «Archiviert».
  const toggle = (gruppeId: string) =>
    update(s => {
      const n = structuredClone(s)
      const g = n.gruppen.find(x => x.id === gruppeId)!
      const m = g.mitglieder.find(x => x.personId === person.id)
      if (m && statusVon(m) !== 'archiviert') m.status = 'archiviert'
      else if (m) m.status = 'aktiv'
      else g.mitglieder.push({ personId: person.id, funktion: 'Teilnehmer/in', status: 'aktiv' })
      return n
    })

  const funktionWechseln = (gruppeId: string, ziel: 'Leiter/in' | 'Teilnehmer/in') =>
    update(s => {
      const n = structuredClone(s)
      const g = n.gruppen.find(x => x.id === gruppeId)!
      g.mitglieder.find(m => m.personId === person.id)!.funktion = ziel
      return n
    })

  return (
    <div className="karte" style={{ padding: '0.2rem 1rem' }}>
      {gruppen.length === 0 && (
        <div className="sub" style={{ padding: '0.6rem 0' }}>
          {benutzer.rolle === 'trainer' ? 'Dir sind keine Gruppen zugeteilt.' : 'Noch keine Gruppen vorhanden.'}
        </div>
      )}
      {[...gruppen].sort((a, b) => a.name.localeCompare(b.name, 'de')).map(g => {
        const mitglied = g.mitglieder.find(m => m.personId === person.id)
        const aktiv = mitglied && statusVon(mitglied) !== 'archiviert'
        return (
          <div key={g.id} className="zeile" style={{ cursor: 'pointer' }} onClick={() => toggle(g.id)}>
            <span className={'check' + (aktiv ? ' an' : '')}>✓</span>
            <div className="haupt">
              <div className="titel">{g.name}</div>
              {mitglied && !aktiv && <div className="sub">archiviert</div>}
            </div>
            {mitglied?.funktion === 'Leiter/in' && <span className="pill leiter">Leiter/in</span>}
            {mitglied && statusVon(mitglied) === 'schnuppernd' && <span className="pill offen">Schnuppern</span>}
            {aktiv && (
              <button className="leise" onClick={e => {
                e.stopPropagation()
                funktionWechseln(g.id, mitglied!.funktion === 'Leiter/in' ? 'Teilnehmer/in' : 'Leiter/in')
              }}>
                {mitglied!.funktion === 'Leiter/in' ? 'Leiter-Status entfernen' : 'Als Coach hinzufügen'}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

function PersonFotos({ state, update, person }: { state: AppState; update: Update; person: Person }) {
  const benutzer = useBenutzer()
  const darfBearbeiten = benutzer.rolle !== 'trainer' || !!benutzer.fotoRecht
  const [lädt, setLädt] = useState(false)
  const [vorschau, setVorschau] = useState<string | null>(null)
  const fotos = fotosVonPerson(state.fotos, person.id)
  const saison = state.fotoSaison

  const speichern = (datenUrl: string) => {
    update(s => {
      const n = structuredClone(s)
      n.fotos = n.fotos.filter(f => !(f.personId === person.id && f.saison === saison))
      n.fotos.push({ id: neueId(), personId: person.id, saison, datenUrl, hochgeladenAm: new Date().toISOString() })
      return n
    })
    setVorschau(null)
  }

  const hochladen = async (datei: File) => {
    setLädt(true)
    try {
      speichern(await komprimiertesFoto(datei))
    } catch {
      alert('Foto konnte nicht verarbeitet werden.')
    } finally {
      setLädt(false)
    }
  }

  // Bild aus der Zwischenablage per Cmd/Strg+V (bzw. Rechtsklick → Einfügen) übernehmen — das
  // paste-Event ist plattformunabhängig. Nur eine Vorschau, damit ein versehentliches Einfügen
  // (z. B. beim Kopieren von Text mit Bild-Anhang) nicht sofort ungewollt speichert.
  const vorschauZeigenRef = useRef<((datei: File) => Promise<void>) | undefined>(undefined)
  vorschauZeigenRef.current = async datei => {
    setLädt(true)
    try {
      setVorschau(await komprimiertesFoto(datei))
    } catch {
      alert('Foto konnte nicht verarbeitet werden.')
    } finally {
      setLädt(false)
    }
  }

  useEffect(() => {
    if (!darfBearbeiten) return
    const beiPaste = (e: ClipboardEvent) => {
      const datei = [...(e.clipboardData?.items ?? [])]
        .find(i => i.type.startsWith('image/'))?.getAsFile()
      if (datei) { e.preventDefault(); void vorschauZeigenRef.current?.(datei) }
    }
    document.addEventListener('paste', beiPaste)
    return () => document.removeEventListener('paste', beiPaste)
  }, [darfBearbeiten])

  const löschen = (fotoId: string) =>
    update(s => ({ ...s, fotos: s.fotos.filter(f => f.id !== fotoId) }))

  return (
    <div>
      {darfBearbeiten && (
        <div className="karte">
          {vorschau ? (
            <>
              <div className="sub" style={{ marginBottom: '0.5rem' }}>Vorschau — für Saison {saison} speichern?</div>
              <img src={vorschau} alt="" className="foto-gross" />
              <div className="btnreihe">
                <button onClick={() => speichern(vorschau)}>Speichern</button>
                <button className="leise" onClick={() => setVorschau(null)}>Verwerfen</button>
              </div>
            </>
          ) : (
            <>
              <label className="feld">Neues Foto für Saison {saison}
                <input type="file" accept="image/*" disabled={lädt}
                  onChange={e => { const f = e.target.files?.[0]; if (f) void hochladen(f); e.target.value = '' }} />
              </label>
              <div className="sub" style={{ marginTop: '0.4rem' }}>
                … oder ein kopiertes Bild mit Cmd/Strg+V einfügen.
              </div>
              {lädt && <div className="sub">Wird verarbeitet …</div>}
            </>
          )}
        </div>
      )}
      {fotos.length === 0 && <div className="leer">Noch keine Fotos erfasst.</div>}
      {fotos.map(f => (
        <div key={f.id} className="karte">
          <div className="sub" style={{ marginBottom: '0.5rem' }}>Saison {f.saison}</div>
          <img src={f.datenUrl} alt="" className="foto-gross" />
          {darfBearbeiten && (
            <button className="leise breit" style={{ marginTop: '0.6rem' }}
              onClick={() => { if (confirm('Dieses Foto löschen?')) löschen(f.id) }}>Löschen</button>
          )}
        </div>
      ))}
    </div>
  )
}

function KursZeile({ label, kurs, eintrag, darfBearbeiten, aktualisieren, personId }: {
  label: string; kurs: Kurs; eintrag?: KursEintrag; darfBearbeiten: boolean; aktualisieren: () => void; personId: string
}) {
  const [datum, setDatum] = useState(() => new Date().toISOString().slice(0, 10))
  const [läuft, setLäuft] = useState(false)

  const setzen = async () => {
    setLäuft(true)
    try { await kursSetzen(personId, kurs, datum); aktualisieren() } finally { setLäuft(false) }
  }
  const entfernen = async () => {
    if (!confirm(`"${label}" wirklich wieder entfernen?`)) return
    setLäuft(true)
    try { await kursEntfernen(personId, kurs); aktualisieren() } finally { setLäuft(false) }
  }

  return (
    <div className="zeile">
      <div className="haupt">
        <div className="titel">{label}</div>
        {eintrag && <div className="sub">absolviert am {new Date(eintrag.datum).toLocaleDateString('de-CH')}</div>}
      </div>
      {eintrag ? (
        darfBearbeiten ? <button className="leise" disabled={läuft} onClick={() => void entfernen()}>Entfernen</button> : <span className="pill ok">✓</span>
      ) : darfBearbeiten ? (
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <input type="date" value={datum} onChange={e => setDatum(e.target.value)} style={{ width: '9.5rem' }} />
          <button className="sekundaer" disabled={läuft} onClick={() => void setzen()}>Markieren</button>
        </div>
      ) : (
        <span className="pill offen">offen</span>
      )}
    </div>
  )
}

function PersonKurse({ person }: { person: Person }) {
  const benutzer = useBenutzer()
  const istMaster = benutzer.rolle === 'master'
  const [eintraege, setEintraege] = useState<KursEintrag[] | null>(null)

  const laden = () => { kurseLaden(person.id).then(setEintraege) }
  useEffect(laden, [person.id])

  if (!eintraege) return <div className="sub" style={{ padding: '1rem 0' }}>Lädt …</div>

  const stufe = stufeBerechnen(eintraege)
  const eintragVon = (kurs: Kurs) => eintraege.find(e => e.kurs === kurs)

  return (
    <div>
      <div className="hinweis info">
        Aktuelle Stufe: <b>{stufe ?? 'noch keine Stufe erreicht'}</b>
      </div>

      <h2 className="abschnitt">Nominationen</h2>
      <div className="karte" style={{ padding: '0.2rem 1rem' }}>
        {NOMINATIONEN.map(({ kurs, label }) => (
          <KursZeile key={kurs} label={label} kurs={kurs} eintrag={eintragVon(kurs)}
            darfBearbeiten={istMaster || !!benutzer.nachwuchsVerantwortlich} aktualisieren={laden} personId={person.id} />
        ))}
      </div>

      <h2 className="abschnitt">Kurse</h2>
      <div className="karte" style={{ padding: '0.2rem 1rem' }}>
        {KURSE.map(({ kurs, label }) => (
          <KursZeile key={kurs} label={label} kurs={kurs} eintrag={eintragVon(kurs)}
            darfBearbeiten={istMaster || !!benutzer.kursRecht} aktualisieren={laden} personId={person.id} />
        ))}
      </div>

      <h2 className="abschnitt">Beförderung</h2>
      <div className="sub" style={{ margin: '-0.3rem 0 0.5rem' }}>
        Normalerweise werden Co-Coaches nach Abschluss der 9. Klasse zum Coach befördert — entschieden
        im Gespräch mit dem Ausbildungsverantwortlichen, kein automatisches Kriterium.
      </div>
      <div className="karte" style={{ padding: '0.2rem 1rem' }}>
        <KursZeile label={BEFOERDERUNG.label} kurs={BEFOERDERUNG.kurs} eintrag={eintragVon(BEFOERDERUNG.kurs)}
          darfBearbeiten={istMaster || !!benutzer.kursRecht} aktualisieren={laden} personId={person.id} />
      </div>
    </div>
  )
}
