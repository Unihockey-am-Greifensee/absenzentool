import { useState } from 'react'
import type { AppState } from '../types'
import { neueId } from '../types'
import { Seite, type Update } from '../App'

export function GruppenVerwaltung({ state, update }: { state: AppState; update: Update }) {
  const [neuerName, setNeuerName] = useState('')
  const [bearbeitetId, setBearbeitetId] = useState<string | null>(null)
  const [bearbeiteterName, setBearbeiteterName] = useState('')

  const gruppen = [...state.gruppen].sort((a, b) => a.name.localeCompare(b.name, 'de'))

  const anlegen = () => {
    const name = neuerName.trim()
    if (!name) return
    if (state.gruppen.some(g => g.name.toLowerCase() === name.toLowerCase())) {
      alert('Eine Gruppe mit diesem Namen existiert bereits.')
      return
    }
    update(s => {
      const n = structuredClone(s)
      n.gruppen.push({ id: neueId(), name, mitglieder: [], aktivitaeten: [] })
      return n
    })
    setNeuerName('')
  }

  const umbenennen = (id: string) => {
    const name = bearbeiteterName.trim()
    if (!name) return
    update(s => {
      const n = structuredClone(s)
      n.gruppen.find(g => g.id === id)!.name = name
      return n
    })
    setBearbeitetId(null)
  }

  const loeschen = (id: string) => {
    const g = state.gruppen.find(x => x.id === id)!
    const teile: string[] = []
    if (g.mitglieder.length > 0) teile.push(`${g.mitglieder.length} Mitglieder`)
    if (g.aktivitaeten.length > 0) teile.push(`${g.aktivitaeten.length} Termine (inkl. erfasster Anwesenheiten)`)
    const frage = teile.length > 0
      ? `«${g.name}» endgültig löschen? Dabei gehen verloren: ${teile.join(', ')}. Das kann nicht rückgängig gemacht werden.`
      : `«${g.name}» endgültig löschen?`
    if (!confirm(frage)) return
    update(s => {
      const n = structuredClone(s)
      n.gruppen = n.gruppen.filter(x => x.id !== id)
      return n
    })
  }

  return (
    <Seite titel="Gruppen verwalten" zurueck="export" tab="export">
      <div className="hinweis info">
        Trainingsgruppen werden ausschliesslich hier angelegt — der kOOL-Import legt nie automatisch
        neue Gruppen an, sondern ordnet Team-Namen bestehenden Gruppen zu.
      </div>

      <div className="karte">
        <label className="feld">Neue Gruppe
          <input value={neuerName} onChange={e => setNeuerName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && anlegen()} placeholder="z. B. U13 Schwerzi" />
        </label>
        <button className="breit" disabled={!neuerName.trim()} onClick={anlegen}>Anlegen</button>
      </div>

      <div className="karte" style={{ padding: '0.2rem 1rem' }}>
        {gruppen.length === 0 && <div className="sub" style={{ padding: '0.6rem 0' }}>Noch keine Gruppen angelegt.</div>}
        {gruppen.map(g => (
          <div key={g.id} className="zeile">
            {bearbeitetId === g.id ? (
              <div className="haupt" style={{ display: 'flex', gap: '0.5rem' }}>
                <input value={bearbeiteterName} onChange={e => setBearbeiteterName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && umbenennen(g.id)} autoFocus />
                <button className="leise" onClick={() => umbenennen(g.id)}>Speichern</button>
                <button className="leise" onClick={() => setBearbeitetId(null)}>✕</button>
              </div>
            ) : (
              <>
                <div className="haupt">
                  <div className="titel">{g.name}</div>
                  <div className="sub">
                    {g.mitglieder.length} Mitglieder · {g.aktivitaeten.length} Termine
                    {g.kOOLNamen && g.kOOLNamen.length > 0 && <> · kOOL: {g.kOOLNamen.join(', ')}</>}
                  </div>
                </div>
                <button className="leise" onClick={() => { setBearbeitetId(g.id); setBearbeiteterName(g.name) }}>Umbenennen</button>
                <button className="leise" onClick={() => loeschen(g.id)}>Löschen</button>
              </>
            )}
          </div>
        ))}
      </div>
    </Seite>
  )
}
