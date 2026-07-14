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
      <div className="btnreihe" style={{ marginTop: 0 }}>
        <a className="btn sekundaer" href="#/person/neu">+ Neue Person</a>
      </div>
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
  const istNeu = personId === 'neu'
  const vorhanden = state.personen.find(p => p.id === personId)
  const [p, setP] = useState<Person>(
    vorhanden ?? { id: neueId(), vorname: '', nachname: '', quelle: 'manuell', land: 'CH', nationalitaet: 'CH', muttersprache: 'DE' }
  )
  if (!istNeu && !vorhanden) {
    return <Seite titel="Person nicht gefunden" zurueck="personen" tab="personen"><div className="leer">Diese Person existiert nicht (mehr).</div></Seite>
  }
  const feld = (k: keyof Person) => ({
    value: (p[k] as string | undefined) ?? '',
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
      {p.quelle === 'kool' && (
        <div className="hinweis info">Diese Person stammt aus dem kOOL-Import. Änderungen werden beim nächsten Import durch kOOL-Werte ergänzt, nicht überschrieben.</div>
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
          {benutzer.rolle !== 'trainer' && <>
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
        <button className="breit" onClick={speichern}>Speichern</button>
      </div>
    </Seite>
  )
}
