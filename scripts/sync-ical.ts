// Nächtlicher iCal-Sync, läuft serverseitig (GitHub Action) — kein CORS-Problem,
// da kein Browser beteiligt ist. Nutzt dieselbe Merge-Logik wie die App
// (src/lib/icsImport.ts), schreibt aber direkt per Firebase Admin SDK in Firestore.
//
// Bewusst NUR add/update/abgesagt — keine automatische Löschung «verwaister»
// Termine (aus dem Kalender entfernte Einträge). Das bleibt eine bewusste
// Entscheidung eines Trainers/Masters im Browser («Jetzt synchronisieren» dort
// zeigt die Rückfrage). Ein automatisierter Job soll nie unbeaufsichtigt löschen.
//
// Synchronisiert werden nur zukünftige Termine (ab heute) — die Feeds reichen oft
// ein bis zwei Saisons zurück, Vergangenes braucht die Anwesenheitserfassung nicht.

import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { icsMergen, nurZukuenftig, parseIcs } from '../src/lib/icsImport'
import type { Aktivitaet, AppState, IcalQuelle } from '../src/types'

function ohneUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T
}

async function main() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT fehlt (GitHub-Secret nicht gesetzt?)')

  const app = initializeApp({ credential: cert(JSON.parse(raw)) })
  const db = getFirestore(app)

  const gruppenSnap = await db.collection('gruppen').get()
  let gesamtNeu = 0, gesamtAktualisiert = 0, gesamtAbgesagt = 0, fehlerCount = 0

  for (const gDoc of gruppenSnap.docs) {
    const gruppeDaten = gDoc.data() as { name: string; icalQuellen?: IcalQuelle[] }
    const quellen = gruppeDaten.icalQuellen ?? []
    if (quellen.length === 0) continue

    const aktSnap = await gDoc.ref.collection('aktivitaeten').get()
    const aktivitaetenAlt: Aktivitaet[] = aktSnap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Aktivitaet, 'id'>) }))

    let arbeitsState: AppState = {
      personen: [],
      gruppen: [{ id: gDoc.id, name: gruppeDaten.name, mitglieder: [], aktivitaeten: aktivitaetenAlt, icalQuellen: quellen }],
    }

    for (const q of quellen) {
      try {
        const res = await fetch(q.url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const events = parseIcs(await res.text())
        if (events.length === 0) throw new Error('keine Termine im Feed')
        // Nur zukünftige Termine synchronisieren, wie im Browser-Sync auch.
        const zukuenftig = nurZukuenftig(events)
        const { state: neu, ergebnis } = icsMergen(arbeitsState, gDoc.id, zukuenftig, q.typ)
        arbeitsState = neu
        gesamtNeu += ergebnis.neu
        gesamtAktualisiert += ergebnis.aktualisiert
        gesamtAbgesagt += ergebnis.abgesagt
      } catch (e) {
        fehlerCount++
        console.error(`  Fehler bei «${gruppeDaten.name}» (${q.url}): ${e}`)
      }
    }

    const aktivitaetenNeu = arbeitsState.gruppen[0].aktivitaeten
    const altNachId = new Map(aktivitaetenAlt.map(a => [a.id, a]))
    let batch = db.batch()
    let batchGroesse = 0
    let geaendertProGruppe = 0
    for (const a of aktivitaetenNeu) {
      const alt = altNachId.get(a.id)
      if (alt && JSON.stringify(alt) === JSON.stringify(a)) continue
      batch.set(gDoc.ref.collection('aktivitaeten').doc(a.id), ohneUndefined({ ...a }))
      geaendertProGruppe++
      batchGroesse++
      if (batchGroesse >= 450) {
        await batch.commit()
        batch = db.batch()
        batchGroesse = 0
      }
    }
    if (batchGroesse > 0) await batch.commit()
    if (geaendertProGruppe > 0) console.log(`«${gruppeDaten.name}»: ${geaendertProGruppe} Termin(e) geschrieben.`)
  }

  console.log(`Sync fertig: ${gesamtNeu} neu, ${gesamtAktualisiert} aktualisiert, ${gesamtAbgesagt} abgesagt, ${fehlerCount} Fehler.`)
  if (fehlerCount > 0) process.exitCode = 1
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
