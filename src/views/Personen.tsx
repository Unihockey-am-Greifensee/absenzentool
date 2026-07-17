import { useEffect, useRef, useState } from 'react'
import type { AppState, Person } from '../types'
import { neueId } from '../types'
import { Seite, useBenutzer, type Update } from '../App'
import { statusVon } from '../lib/mitglieder'
import { istAnwesend } from '../lib/anwesenheit'
import { aktuelleSaison, fotosVonPerson } from '../lib/saison'
import { komprimiertesFoto } from '../lib/foto'

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
      {istAdmin && (
        <div className="btnreihe" style={{ marginTop: 0 }}>
          <a className="btn sekundaer" href="#/person/neu">+ Neue Person</a>
          {archivAnzahl > 0 && <a className="btn leise" href="#/personen-archiv">Archiv ({archivAnzahl})</a>}
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

export function PersonEdit({ state, update, personId }: { state: AppState; update: Update; personId: string }) {
  const benutzer = useBenutzer()
  const istTrainer = benutzer.rolle === 'trainer'
  const istNeu = personId === 'neu'
  const vorhanden = state.personen.find(p => p.id === personId)
  const [p, setP] = useState<Person>(
    vorhanden ?? { id: neueId(), vorname: '', nachname: '', quelle: 'manuell', land: 'CH', nationalitaet: 'CH', muttersprache: 'DE' }
  )
  const [tab, setTab] = useState<'angaben' | 'gruppen' | 'fotos'>('angaben')

  if (!istNeu && !vorhanden) {
    return <Seite titel="Person nicht gefunden" zurueck="personen" tab="personen"><div className="leer">Diese Person existiert nicht (mehr).</div></Seite>
  }
  if (istNeu && istTrainer) {
    return <Seite titel="Neue Person" zurueck="personen" tab="personen">
      <div className="leer">Neue Personen erfasst nur der Admin — wende dich an die Absenzen-Verantwortung.</div>
    </Seite>
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
      const idx = n.personen.findIndex(x => x.id === p.id)
      if (idx >= 0) n.personen[idx] = p
      else n.personen.push(p)
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
  const F = ({ label, anzeige, children }: { label: string; anzeige: string; children: React.ReactNode }) => (
    <label className="feld">{label}
      {istTrainer ? <span className="feld-anzeige">{anzeige || '—'}</span> : children}
    </label>
  )

  return (
    <Seite titel={istNeu ? 'Neue Person' : `${p.vorname} ${p.nachname}`} zurueck="personen" tab="personen">
      {!istNeu && (
        <div className="btnreihe" style={{ marginTop: 0 }}>
          <button className={tab === 'angaben' ? '' : 'sekundaer'} onClick={() => setTab('angaben')}>Angaben</button>
          <button className={tab === 'gruppen' ? '' : 'sekundaer'} onClick={() => setTab('gruppen')}>Gruppen</button>
          <button className={tab === 'fotos' ? '' : 'sekundaer'} onClick={() => setTab('fotos')}>Fotos</button>
        </div>
      )}

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
              <F label="Vorname" anzeige={p.vorname}><input {...feld('vorname')} /></F>
              <F label="Nachname" anzeige={p.nachname}><input {...feld('nachname')} /></F>
              <F label="Geburtsdatum" anzeige={p.geburtsdatum ?? ''}><input type="date" {...feld('geburtsdatum')} /></F>
              <F label="Geschlecht" anzeige={geschlechtAnzeige}>
                <select {...feld('geschlecht')}>
                  <option value="">—</option><option value="m">männlich</option><option value="w">weiblich</option>
                </select>
              </F>
            </div>
            <h2 className="abschnitt">Jugend+Sport</h2>
            <div className="felder2">
              <F label="J+S-Personennummer" anzeige={p.jsNummer ?? ''}><input {...feld('jsNummer')} placeholder="z. B. 2837521" /></F>
              {!istTrainer && <>
                <label className="feld">AHV-Nummer<input {...feld('ahvNr')} placeholder="756.…" /></label>
                <label className="feld">PEID (nur FL)<input {...feld('peid')} /></label>
              </>}
              <F label="Nationalität" anzeige={p.nationalitaet ?? ''}>
                <select {...feld('nationalitaet')}>
                  <option value="CH">CH</option><option value="FL">FL</option><option value="Andere">Andere</option>
                </select>
              </F>
              <F label="Muttersprache" anzeige={p.muttersprache ?? ''}>
                <select {...feld('muttersprache')}>
                  <option value="DE">DE</option><option value="FR">FR</option><option value="IT">IT</option><option value="Andere">Andere</option>
                </select>
              </F>
            </div>
            <h2 className="abschnitt">Adresse</h2>
            <div className="felder2">
              <F label="Strasse" anzeige={p.strasse ?? ''}><input {...feld('strasse')} /></F>
              <F label="Hausnummer" anzeige={p.hausnummer ?? ''}><input {...feld('hausnummer')} /></F>
              <F label="PLZ" anzeige={p.plz ?? ''}><input {...feld('plz')} /></F>
              <F label="Ort" anzeige={p.ort ?? ''}><input {...feld('ort')} /></F>
              <F label="Land (ISO)" anzeige={p.land ?? ''}><input {...feld('land')} placeholder="CH" /></F>
            </div>
            <h2 className="abschnitt">Kontakt</h2>
            <div className="felder2">
              <F label="E-Mail" anzeige={p.email ?? ''}><input {...feld('email')} /></F>
              <F label="Mobiltelefon" anzeige={p.mobil ?? ''}><input {...feld('mobil')} /></F>
              <F label="E-Mail Mutter" anzeige={p.emailMutter ?? ''}><input {...feld('emailMutter')} /></F>
              <F label="Handy Mutter" anzeige={p.mobilMutter ?? ''}><input {...feld('mobilMutter')} /></F>
              <F label="E-Mail Vater" anzeige={p.emailVater ?? ''}><input {...feld('emailVater')} /></F>
              <F label="Handy Vater" anzeige={p.mobilVater ?? ''}><input {...feld('mobilVater')} /></F>
            </div>
            {!istTrainer && <button className="breit" onClick={speichern}>Speichern</button>}
          </div>
          {!istTrainer && !istNeu && !p.archiviert && (
            <div className="btnreihe">
              <button className="leise breit" onClick={archivieren}>Person archivieren</button>
            </div>
          )}
        </>
      )}

      {tab === 'gruppen' && !istNeu && <PersonGruppen state={state} update={update} person={p} />}
      {tab === 'fotos' && !istNeu && <PersonFotos state={state} update={update} person={p} />}
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
  const fotos = fotosVonPerson(state.fotos, person.id)
  const saison = aktuelleSaison()

  const hochladen = async (datei: File) => {
    setLädt(true)
    try {
      const datenUrl = await komprimiertesFoto(datei)
      update(s => {
        const n = structuredClone(s)
        n.fotos = n.fotos.filter(f => !(f.personId === person.id && f.saison === saison))
        n.fotos.push({ id: neueId(), personId: person.id, saison, datenUrl, hochgeladenAm: new Date().toISOString() })
        return n
      })
    } catch {
      alert('Foto konnte nicht verarbeitet werden.')
    } finally {
      setLädt(false)
    }
  }

  // Bild aus der Zwischenablage per Cmd/Strg+V (bzw. Rechtsklick → Einfügen) übernehmen —
  // das paste-Event ist plattformunabhängig. Landet im selben hochladen() wie der Datei-Upload.
  const hochladenRef = useRef(hochladen)
  hochladenRef.current = hochladen

  useEffect(() => {
    if (!darfBearbeiten) return
    const beiPaste = (e: ClipboardEvent) => {
      const datei = [...(e.clipboardData?.items ?? [])]
        .find(i => i.type.startsWith('image/'))?.getAsFile()
      if (datei) { e.preventDefault(); void hochladenRef.current(datei) }
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
          <label className="feld">Neues Foto für Saison {saison}
            <input type="file" accept="image/*" disabled={lädt}
              onChange={e => { const f = e.target.files?.[0]; if (f) void hochladen(f); e.target.value = '' }} />
          </label>
          <div className="sub" style={{ marginTop: '0.4rem' }}>
            … oder ein kopiertes Bild mit Cmd/Strg+V einfügen.
          </div>
          {lädt && <div className="sub">Wird verarbeitet …</div>}
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
