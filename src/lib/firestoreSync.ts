import {
  collection, collectionGroup, deleteDoc, doc, onSnapshot, setDoc, writeBatch,
  type DocumentData, type QuerySnapshot,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Aktivitaet, AppState, Gruppe, Person } from '../types'

// Firestore-Spiegel des AppState.
//
// Collections:
//   trainer/{email}                       { name?, rolle: 'master'|'trainer' }
//   personen/{id}                         Person OHNE ahvNr/peid
//   personenVertraulich/{id}              { ahvNr?, peid? }  — nur Master (Rules)
//   gruppen/{id}                          Gruppe ohne aktivitaeten
//   gruppen/{id}/aktivitaeten/{id}        Aktivitaet
//
// Lesen: Snapshot-Listener bauen den AppState zusammen (Master inkl. vertraulicher
// Felder). Schreiben: Diff zwischen altem und neuem AppState, Batch-Writes.

export interface TrainerInfo {
  email: string
  rolle: 'master' | 'trainer'
  name?: string
}

export interface GruppeMeta {
  trainerEmails?: string[]
}

type Vertraulich = { ahvNr?: string; peid?: string }

function ohneUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T
}

function personTeilen(p: Person): { doc: Omit<Person, 'ahvNr' | 'peid'>; vertraulich: Vertraulich } {
  const { ahvNr, peid, ...rest } = p
  return { doc: ohneUndefined(rest), vertraulich: ohneUndefined({ ahvNr, peid }) }
}

function gruppeTeilen(g: Gruppe): { doc: Omit<Gruppe, 'aktivitaeten'>; aktivitaeten: Aktivitaet[] } {
  const { aktivitaeten, ...rest } = g
  // ohneUndefined() räumt nur oberflächliche Felder auf — Firestore lehnt aber auch
  // undefined-Werte INNERHALB von Arrays ab (z. B. Mitglied.status), daher hier
  // zusätzlich jedes Mitglied einzeln bereinigen.
  const bereinigt = { ...rest, mitglieder: rest.mitglieder.map(m => ohneUndefined({ ...m })) }
  return { doc: ohneUndefined(bereinigt), aktivitaeten }
}

/** Baut aus den Snapshots einen AppState zusammen und meldet jede Änderung. */
export function abonnieren(
  istMaster: boolean,
  aufState: (state: AppState) => void,
  aufFehler: (fehler: string) => void,
): () => void {
  if (!db) return () => {}
  const personen = new Map<string, Person>()
  const vertraulich = new Map<string, Vertraulich>()
  const gruppen = new Map<string, Gruppe & GruppeMeta>()
  const aktivitaeten = new Map<string, Map<string, Aktivitaet>>() // gruppeId -> id -> Aktivitaet

  const bereit = { personen: false, gruppen: false, akt: false, vertraulich: !istMaster }

  const melden = () => {
    if (!bereit.personen || !bereit.gruppen || !bereit.akt || !bereit.vertraulich) return
    const staat: AppState = {
      personen: [...personen.values()].map(p => ({ ...p, ...(vertraulich.get(p.id) ?? {}) })),
      gruppen: [...gruppen.values()]
        .map(g => ({
          ...g,
          aktivitaeten: [...(aktivitaeten.get(g.id)?.values() ?? [])],
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'de')),
    }
    aufState(staat)
  }

  const fehler = (wo: string) => (e: unknown) => aufFehler(`${wo}: ${String(e)}`)

  const unsubs = [
    onSnapshot(collection(db, 'personen'), (snap: QuerySnapshot<DocumentData>) => {
      personen.clear()
      snap.forEach(d => personen.set(d.id, { ...(d.data() as Person), id: d.id }))
      bereit.personen = true
      melden()
    }, fehler('personen')),

    onSnapshot(collection(db, 'gruppen'), snap => {
      gruppen.clear()
      snap.forEach(d => gruppen.set(d.id, { ...(d.data() as Gruppe & GruppeMeta), id: d.id, aktivitaeten: [] }))
      bereit.gruppen = true
      melden()
    }, fehler('gruppen')),

    onSnapshot(collectionGroup(db, 'aktivitaeten'), snap => {
      aktivitaeten.clear()
      snap.forEach(d => {
        const gruppeId = d.ref.parent.parent?.id
        if (!gruppeId) return
        if (!aktivitaeten.has(gruppeId)) aktivitaeten.set(gruppeId, new Map())
        aktivitaeten.get(gruppeId)!.set(d.id, { ...(d.data() as Aktivitaet), id: d.id })
      })
      bereit.akt = true
      melden()
    }, fehler('aktivitaeten')),
  ]

  if (istMaster) {
    unsubs.push(onSnapshot(collection(db, 'personenVertraulich'), snap => {
      vertraulich.clear()
      snap.forEach(d => vertraulich.set(d.id, d.data() as Vertraulich))
      bereit.vertraulich = true
      melden()
    }, fehler('personenVertraulich')))
  }

  return () => unsubs.forEach(u => u())
}

/** Schreibt die Differenz zwischen altem und neuem Zustand nach Firestore. */
export async function diffSchreiben(alt: AppState, neu: AppState, istMaster: boolean): Promise<void> {
  if (!db) return
  const batch: { set: { pfad: string[]; daten: DocumentData }[]; del: string[][] } = { set: [], del: [] }

  // --- Personen ---
  const altP = new Map(alt.personen.map(p => [p.id, p]))
  const neuP = new Map(neu.personen.map(p => [p.id, p]))
  for (const [id, p] of neuP) {
    const vorher = altP.get(id)
    if (vorher && JSON.stringify(vorher) === JSON.stringify(p)) continue
    const { doc: pd, vertraulich } = personTeilen(p)
    batch.set.push({ pfad: ['personen', id], daten: pd })
    if (istMaster) {
      const vorherV = vorher ? personTeilen(vorher).vertraulich : undefined
      if (!vorher || JSON.stringify(vorherV) !== JSON.stringify(vertraulich)) {
        batch.set.push({ pfad: ['personenVertraulich', id], daten: vertraulich })
      }
    }
  }
  for (const id of altP.keys()) {
    if (!neuP.has(id)) {
      batch.del.push(['personen', id])
      if (istMaster) batch.del.push(['personenVertraulich', id])
    }
  }

  // --- Gruppen + Aktivitäten ---
  const altG = new Map(alt.gruppen.map(g => [g.id, g]))
  const neuG = new Map(neu.gruppen.map(g => [g.id, g]))
  for (const [id, g] of neuG) {
    const vorher = altG.get(id)
    const { doc: gd, aktivitaeten } = gruppeTeilen(g)
    if (!vorher || JSON.stringify(gruppeTeilen(vorher).doc) !== JSON.stringify(gd)) {
      batch.set.push({ pfad: ['gruppen', id], daten: gd })
    }
    const altA = new Map((vorher?.aktivitaeten ?? []).map(a => [a.id, a]))
    for (const a of aktivitaeten) {
      const av = altA.get(a.id)
      if (!av || JSON.stringify(av) !== JSON.stringify(a)) {
        batch.set.push({ pfad: ['gruppen', id, 'aktivitaeten', a.id], daten: ohneUndefined({ ...a }) })
      }
    }
    const neuAIds = new Set(aktivitaeten.map(a => a.id))
    for (const aid of altA.keys()) {
      if (!neuAIds.has(aid)) batch.del.push(['gruppen', id, 'aktivitaeten', aid])
    }
  }
  for (const [id, g] of altG) {
    if (!neuG.has(id)) {
      for (const a of g.aktivitaeten) batch.del.push(['gruppen', id, 'aktivitaeten', a.id])
      batch.del.push(['gruppen', id])
    }
  }

  // In 450er-Blöcken schreiben (Firestore-Limit: 500 Operationen pro Batch).
  const ops = [
    ...batch.set.map(s => ({ art: 'set' as const, ...s })),
    ...batch.del.map(pfad => ({ art: 'del' as const, pfad, daten: {} })),
  ]
  for (let i = 0; i < ops.length; i += 450) {
    const b = writeBatch(db)
    for (const op of ops.slice(i, i + 450)) {
      const ref = doc(db, op.pfad.join('/'))
      if (op.art === 'set') b.set(ref, op.daten)
      else b.delete(ref)
    }
    await b.commit()
  }
}

/** Liest das Trainer-Dokument der angemeldeten Person (einmalig, via Listener). */
export function trainerAbonnieren(
  email: string,
  auf: (info: TrainerInfo | null) => void,
): () => void {
  if (!db) return () => {}
  return onSnapshot(doc(db, 'trainer', email.toLowerCase()),
    d => auf(d.exists() ? { email, ...(d.data() as Omit<TrainerInfo, 'email'>) } : null),
    () => auf(null))
}

export async function trainerSpeichern(email: string, daten: { rolle: 'master' | 'trainer'; name?: string }): Promise<void> {
  if (!db) return
  await setDoc(doc(db, 'trainer', email.toLowerCase()), ohneUndefined(daten))
}

export async function trainerLoeschen(email: string): Promise<void> {
  if (!db) return
  await deleteDoc(doc(db, 'trainer', email.toLowerCase()))
}
