import {
  collection, collectionGroup, deleteDoc, doc, onSnapshot, setDoc, writeBatch,
  type DocumentData, type QuerySnapshot,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Aktivitaet, AppState, Foto, Gruppe, Person } from '../types'
import { aktuelleSaison } from './saison'

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
  rolle: 'master' | 'trainer' | 'familie'
  name?: string
  fotoRecht?: boolean // Trainer darf Personen-Fotos hochladen/löschen
  kursRecht?: boolean // Ausbildungsverantwortlicher: darf Kurse markieren
  nachwuchsVerantwortlich?: boolean // darf die Coach-Nominationen markieren
}

/** Ein freigeschaltetes Trainer-Konto (trainer-Tabelle) — nie 'familie', im Unterschied zu TrainerInfo. */
export interface TrainerKonto {
  email: string
  rolle: 'master' | 'trainer'
  name?: string
  fotoRecht?: boolean
  kursRecht?: boolean
  nachwuchsVerantwortlich?: boolean
  // Letzter erfolgreicher Google-Login — nur im API-Modus befüllt (rudelcheck-server), nie
  // im Firebase-Modus geschrieben.
  letzterLogin?: string
  // Die Person, deren eigene E-Mail zu diesem Trainer-Konto passt (für den "Zur Person"-Link) —
  // nur im API-Modus befüllt.
  personId?: string
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
  const firestore = db
  const personen = new Map<string, Person>()
  const vertraulich = new Map<string, Vertraulich>()
  const gruppen = new Map<string, Gruppe & GruppeMeta>()
  const aktivitaeten = new Map<string, Map<string, Aktivitaet>>() // gruppeId -> id -> Aktivitaet
  const fotos = new Map<string, Foto>()

  const bereit = { personen: false, gruppen: false, akt: false, vertraulich: !istMaster, fotos: false }

  const melden = () => {
    if (!bereit.personen || !bereit.gruppen || !bereit.akt || !bereit.vertraulich || !bereit.fotos) return
    const staat: AppState = {
      personen: [...personen.values()].map(p => ({ ...p, ...(vertraulich.get(p.id) ?? {}) })),
      gruppen: [...gruppen.values()]
        .map(g => ({
          ...g,
          aktivitaeten: [...(aktivitaeten.get(g.id)?.values() ?? [])],
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'de')),
      fotos: [...fotos.values()],
      teamFotos: [], // Teamfotos gibt es nur im RudelCheck-Backend, nicht im Firebase-Modus.
      // Die manuell steuerbare Foto-Saison gibt es nur im RudelCheck-Backend — im Firebase-Modus
      // bleibt es bei der automatischen Berechnung aus dem Kalenderdatum.
      fotoSaison: aktuelleSaison(),
    }
    aufState(staat)
  }

  // Direkt nach dem Login kann das Auth-Token die Firestore-Regeln (die bei
  // personenVertraulich zusätzlich das Trainer-Dokument nachschlagen) einen
  // Sekundenbruchteil zu spät erreichen — der erste Verbindungsversuch schlägt
  // dann mit permission-denied fehl, obwohl der Zugriff eigentlich erlaubt ist.
  // Solche Fehler ein paar Mal mit Verzögerung automatisch wiederholen, statt
  // sofort einen fatalen Verbindungsfehler zu zeigen.
  function mitWiederholung(
    starten: (auf: (snap: QuerySnapshot<DocumentData>) => void, fehler: (e: unknown) => void) => () => void,
    auf: (snap: QuerySnapshot<DocumentData>) => void,
    wo: string,
  ): () => void {
    let versuche = 0
    let gestoppt = false
    let aktuelleUnsub = () => {}
    const starteListener = () => {
      aktuelleUnsub = starten(auf, (e: unknown) => {
        const code = (e as { code?: string } | null)?.code
        if (code === 'permission-denied' && versuche < 3 && !gestoppt) {
          versuche++
          setTimeout(() => { if (!gestoppt) starteListener() }, 600 * versuche)
          return
        }
        aufFehler(`${wo}: ${String(e)}`)
      })
    }
    starteListener()
    return () => { gestoppt = true; aktuelleUnsub() }
  }

  const unsubs = [
    mitWiederholung(
      (auf, fehlerFn) => onSnapshot(collection(firestore, 'personen'), auf, fehlerFn),
      snap => {
        personen.clear()
        snap.forEach(d => personen.set(d.id, { ...(d.data() as Person), id: d.id }))
        bereit.personen = true
        melden()
      },
      'personen',
    ),

    mitWiederholung(
      (auf, fehlerFn) => onSnapshot(collection(firestore, 'gruppen'), auf, fehlerFn),
      snap => {
        gruppen.clear()
        snap.forEach(d => gruppen.set(d.id, { ...(d.data() as Gruppe & GruppeMeta), id: d.id, aktivitaeten: [] }))
        bereit.gruppen = true
        melden()
      },
      'gruppen',
    ),

    mitWiederholung(
      (auf, fehlerFn) => onSnapshot(collectionGroup(firestore, 'aktivitaeten'), auf, fehlerFn),
      snap => {
        aktivitaeten.clear()
        snap.forEach(d => {
          const gruppeId = d.ref.parent.parent?.id
          if (!gruppeId) return
          if (!aktivitaeten.has(gruppeId)) aktivitaeten.set(gruppeId, new Map())
          aktivitaeten.get(gruppeId)!.set(d.id, { ...(d.data() as Aktivitaet), id: d.id })
        })
        bereit.akt = true
        melden()
      },
      'aktivitaeten',
    ),

    mitWiederholung(
      (auf, fehlerFn) => onSnapshot(collection(firestore, 'fotos'), auf, fehlerFn),
      snap => {
        fotos.clear()
        snap.forEach(d => fotos.set(d.id, { ...(d.data() as Foto), id: d.id }))
        bereit.fotos = true
        melden()
      },
      'fotos',
    ),
  ]

  if (istMaster) {
    unsubs.push(mitWiederholung(
      (auf, fehlerFn) => onSnapshot(collection(firestore, 'personenVertraulich'), auf, fehlerFn),
      snap => {
        vertraulich.clear()
        snap.forEach(d => vertraulich.set(d.id, d.data() as Vertraulich))
        bereit.vertraulich = true
        melden()
      },
      'personenVertraulich',
    ))
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

  // --- Fotos ---
  const altF = new Map(alt.fotos.map(f => [f.id, f]))
  const neuF = new Map(neu.fotos.map(f => [f.id, f]))
  for (const [id, f] of neuF) {
    const vorher = altF.get(id)
    if (vorher && JSON.stringify(vorher) === JSON.stringify(f)) continue
    batch.set.push({ pfad: ['fotos', id], daten: ohneUndefined({ ...f }) })
  }
  for (const id of altF.keys()) {
    if (!neuF.has(id)) batch.del.push(['fotos', id])
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

export async function trainerSpeichern(email: string, daten: { rolle: 'master' | 'trainer'; name?: string; fotoRecht?: boolean; kursRecht?: boolean; nachwuchsVerantwortlich?: boolean }): Promise<void> {
  if (!db) return
  await setDoc(doc(db, 'trainer', email.toLowerCase()), ohneUndefined(daten))
}

export async function trainerLoeschen(email: string): Promise<void> {
  if (!db) return
  await deleteDoc(doc(db, 'trainer', email.toLowerCase()))
}
