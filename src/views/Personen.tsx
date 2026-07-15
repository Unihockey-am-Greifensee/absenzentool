import { useState } from 'react'
import type { AppState, Person } from '../types'
import { neueId } from '../types'
import { Seite, useBenutzer, type Update } from '../App'

export function PersonenListe({ state }: { state: AppState }) {
  const benutzer = useBenutzer()
  const [suche, setSuche] = useState('')
  const gefiltert = state.personen
    .filter(p => `${p.vorname} ${p.nachname}`.toLowerCase().includes(suche.trim().toLowerCase()))
    .sort((a, b) => a.nachname.localeCompare(b.nachname, 'de') || a.vorname.localeCompare(b.vorname, 'de'))

  return (
    <Seite titel="Personen" tab="personen">
      <input className="suchfeld" placeholder="Suchen …" value={suche} onChange={e => setSuche(e.target.value)} />
      {benutzer.rolle !== 'trainer' && (
        <div className="btnreihe" style={{ marginTop: 0 }}>
          <a className="btn sekundaer" href="#/person/neu">+ Neue Person</a>
        </div>
      )}
      <div className="sub" style={{ marginBottom: '0.5rem', color: 'var(--muted)' }}>
        {gefiltert.length} von {state.personen.length} Personen
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

export function PersonEdit({ state, update, personId }: { state: AppState; update: Update; personId: string }) {
  const benutzer = useBenutzer()
  const istTrainer = benutzer.rolle === 'trainer'
  const istNeu = personId === 'neu'
  const vorhanden = state.personen.find(p => p.id === personId)
  const [p, setP] = useState<Person>(
    vorhanden ?? { id: neueId(), vorname: '', nachname: '', quelle: 'manuell', land: 'CH', nationalitaet: 'CH', muttersprache: 'DE' }
  )
  const [tab, setTab] = useState<'angaben' | 'gruppen'>('angaben')

  if (!istNeu && !vorhanden) {
    return <Seite titel="Person nicht gefunden" zurueck="personen" tab="personen"><div className="leer">Diese Person existiert nicht (mehr).</div></Seite>
  }
  if (istNeu && istTrainer) {
    return <Seite titel="Neue Person" zurueck="personen" tab="personen">
      <div className="leer">Neue Personen erfasst nur der Master — wende dich an die Absenzen-Verantwortung.</div>
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

  return (
    <Seite titel={istNeu ? 'Neue Person' : `${p.vorname} ${p.nachname}`} zurueck="personen" tab="personen">
      {!istNeu && (
        <div className="btnreihe" style={{ marginTop: 0 }}>
          <button className={tab === 'angaben' ? '' : 'sekundaer'} onClick={() => setTab('angaben')}>Angaben</button>
          <button className={tab === 'gruppen' ? '' : 'sekundaer'} onClick={() => setTab('gruppen')}>Gruppen</button>
        </div>
      )}

      {tab === 'angaben' && (
        <>
          {p.quelle === 'kool' && (
            <div className="hinweis info">Diese Person stammt aus dem kOOL-Import. Änderungen werden beim nächsten Import durch kOOL-Werte ergänzt, nicht überschrieben.</div>
          )}
          {istTrainer && (
            <div className="hinweis info">Diese Angaben kann nur der Master ändern.</div>
          )}
          <div className="karte">
            <div className="felder2">
              <label className="feld">Vorname<input {...feld('vorname')} /></label>
              <label className="feld">Nachname<input {...feld('nachname')} /></label>
              <label className="feld">Geburtsdatum<input type="date" {...feld('geburtsdatum')} /></label>
              <label className="feld">Geschlecht
                <select {...feld('geschlecht')}>
                  <option value="">—</option><option value="m">männlich</option><option value="w">weiblich</option>
                </select>
              </label>
            </div>
            <h2 className="abschnitt">Jugend+Sport</h2>
            <div className="felder2">
              <label className="feld">J+S-Personennummer<input {...feld('jsNummer')} placeholder="z. B. 2837521" /></label>
              {!istTrainer && <>
                <label className="feld">AHV-Nummer<input {...feld('ahvNr')} placeholder="756.…" /></label>
                <label className="feld">PEID (nur FL)<input {...feld('peid')} /></label>
              </>}
              <label className="feld">Nationalität
                <select {...feld('nationalitaet')}>
                  <option value="CH">CH</option><option value="FL">FL</option><option value="Andere">Andere</option>
                </select>
              </label>
              <label className="feld">Muttersprache
                <select {...feld('muttersprache')}>
                  <option value="DE">DE</option><option value="FR">FR</option><option value="IT">IT</option><option value="Andere">Andere</option>
                </select>
              </label>
            </div>
            <h2 className="abschnitt">Adresse</h2>
            <div className="felder2">
              <label className="feld">Strasse<input {...feld('strasse')} /></label>
              <label className="feld">Hausnummer<input {...feld('hausnummer')} /></label>
              <label className="feld">PLZ<input {...feld('plz')} /></label>
              <label className="feld">Ort<input {...feld('ort')} /></label>
              <label className="feld">Land (ISO)<input {...feld('land')} placeholder="CH" /></label>
              <label className="feld">E-Mail<input {...feld('email')} /></label>
            </div>
            {!istTrainer && <button className="breit" onClick={speichern}>Speichern</button>}
          </div>
        </>
      )}

      {tab === 'gruppen' && !istNeu && <PersonGruppen state={state} update={update} person={p} />}
    </Seite>
  )
}

function PersonGruppen({ state, update, person }: { state: AppState; update: Update; person: Person }) {
  const benutzer = useBenutzer()
  const gruppen = benutzer.rolle === 'trainer'
    ? state.gruppen.filter(g => g.trainerEmails?.includes(benutzer.email!.toLowerCase()))
    : state.gruppen

  const toggle = (gruppeId: string) =>
    update(s => {
      const n = structuredClone(s)
      const g = n.gruppen.find(x => x.id === gruppeId)!
      const idx = g.mitglieder.findIndex(m => m.personId === person.id)
      if (idx >= 0) g.mitglieder.splice(idx, 1)
      else g.mitglieder.push({ personId: person.id, funktion: 'Teilnehmer/in' })
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
        return (
          <div key={g.id} className="zeile" style={{ cursor: 'pointer' }} onClick={() => toggle(g.id)}>
            <span className={'check' + (mitglied ? ' an' : '')}>✓</span>
            <div className="haupt"><div className="titel">{g.name}</div></div>
            {mitglied?.funktion === 'Leiter/in' && <span className="pill leiter">Leiter/in</span>}
          </div>
        )
      })}
    </div>
  )
}
