// EINMALIGES Skript: hängt den nachgelieferten U17-GF-Kalenderlink an die
// bestehende Gruppe "U17 GF" (exakte ID, keine Namenssuche — siehe die
// Namensabweichungen aus den vorherigen Patch-Skripten) und zieht direkt auch
// die historischen Termine (1.8.2025 bis gestern) sowie alle aktuellen/
// zukünftigen Termine nach, damit die Gruppe mit den übrigen 13 gleichzieht.
// Wird nach Gebrauch wieder entfernt.

import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { icsMergen, parseIcs } from '../src/lib/icsImport'
import type { Aktivitaet, AppState, Gruppe, IcalQuelle } from '../src/types'

const GRUPPE_ID = 'x56wsbjqmrmi0urq' // "U17 GF"
const URL = 'https://calendar.google.com/calendar/ical/mmrb3lrn8gpoi8q3n8hquio9hl7sk47r%40import.calendar.google.com/public/basic.ics'
const AB_DATUM = '2025-08-01'

function ohneUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T
}

async function main() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT fehlt')
  const app = initializeApp({ credential: cert(JSON.parse(raw)) })
  const db = getFirestore(app)

  const ref = db.collection('gruppen').doc(GRUPPE_ID)
  const snap = await ref.get()
  if (!snap.exists) throw new Error(`Gruppe ${GRUPPE_ID} nicht gefunden`)
  const data = snap.data() as Gruppe
  console.log(`Gruppe: "${data.name}"`)

  const quelle: IcalQuelle = { url: URL, typ: 'Training' }
  const vorhandene = new Set((data.icalQuellen ?? []).map(q => q.url))
  if (!vorhandene.has(quelle.url)) {
    const icalQuellen = [...(data.icalQuellen ?? []), quelle]
    await ref.set(ohneUndefined({ icalQuellen }), { merge: true })
    console.log('Kalender angehängt.')
  } else {
    console.log('Kalender war schon hinterlegt — nichts zu tun.')
  }

  const aktSnap = await ref.collection('aktivitaeten').get()
  const aktivitaetenAlt: Aktivitaet[] = aktSnap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Aktivitaet, 'id'>) }))
  let arbeitsState: AppState = {
    personen: [], fotos: [],
    gruppen: [{ id: GRUPPE_ID, name: data.name, mitglieder: [], aktivitaeten: aktivitaetenAlt, icalQuellen: [quelle] }],
  }

  const res = await fetch(URL)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const events = parseIcs(await res.text())
  console.log(`${events.length} Termine im Feed gefunden.`)
  // Alles ab AB_DATUM (historisch + aktuell/zukünftig) — anders als bei den
  // übrigen Gruppen gibt es hier noch keine Vorgeschichte, die Grenze zwischen
  // Backfill und regulärem Sync spielt also für diesen einmaligen Lauf keine Rolle.
  const relevante = events.filter(ev => ev.datum >= AB_DATUM)
  const { state: neu, ergebnis } = icsMergen(arbeitsState, GRUPPE_ID, relevante, quelle.typ)
  arbeitsState = neu

  const altNachId = new Map(aktivitaetenAlt.map(a => [a.id, a]))
  let batch = db.batch()
  let batchGroesse = 0
  let geschrieben = 0
  for (const a of arbeitsState.gruppen[0].aktivitaeten) {
    const alt = altNachId.get(a.id)
    if (alt && JSON.stringify(alt) === JSON.stringify(a)) continue
    batch.set(ref.collection('aktivitaeten').doc(a.id), ohneUndefined({ ...a }))
    geschrieben++
    batchGroesse++
    if (batchGroesse >= 450) { await batch.commit(); batch = db.batch(); batchGroesse = 0 }
  }
  if (batchGroesse > 0) await batch.commit()

  console.log(`Fertig — ${ergebnis.neu} neu, ${ergebnis.aktualisiert} aktualisiert, ${geschrieben} Dokumente geschrieben.`)
}

main().catch(e => { console.error(e); process.exit(1) })
