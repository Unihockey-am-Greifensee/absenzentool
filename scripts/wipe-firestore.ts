// EINMALIGES Aufräum-Skript: löscht alle Vereinsdaten aus Firestore, damit nach
// dem Formularwechsel (neue Kontaktfelder) komplett frisch importiert werden kann.
// Läuft ausschliesslich manuell über workflow_dispatch — wird nach Gebrauch wieder
// aus dem Repo entfernt.
//
// Gelöscht werden: personen, personenVertraulich, fotos, gruppen (inkl. der
// aktivitaeten-Subcollections). Die trainer-Collection bleibt bewusst stehen —
// sonst würde sich der Admin selbst aussperren.

import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

async function main() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT fehlt (GitHub-Secret nicht gesetzt?)')
  if (process.env.WIPE_CONFIRM !== 'JA_ALLES_LOESCHEN') {
    throw new Error('Sicherheitsabfrage: Input "confirm" muss exakt JA_ALLES_LOESCHEN lauten.')
  }

  const app = initializeApp({ credential: cert(JSON.parse(raw)) })
  const db = getFirestore(app)

  let geloescht = 0

  // Subcollections zuerst (recursiveDelete räumt gruppen/{id}/aktivitaeten mit ab).
  const gruppen = await db.collection('gruppen').get()
  for (const g of gruppen.docs) {
    await db.recursiveDelete(g.ref)
    geloescht++
  }
  console.log(`gruppen (inkl. aktivitaeten): ${gruppen.size} Dokumente`)

  for (const name of ['personen', 'personenVertraulich', 'fotos']) {
    const snap = await db.collection(name).get()
    let batch = db.batch()
    let imBatch = 0
    for (const d of snap.docs) {
      batch.delete(d.ref)
      geloescht++
      if (++imBatch === 450) { await batch.commit(); batch = db.batch(); imBatch = 0 }
    }
    if (imBatch > 0) await batch.commit()
    console.log(`${name}: ${snap.size} Dokumente`)
  }

  // Kontrolle: alles leer? (trainer bleibt absichtlich unangetastet)
  for (const name of ['personen', 'personenVertraulich', 'fotos', 'gruppen']) {
    const rest = await db.collection(name).count().get()
    console.log(`Kontrolle ${name}: ${rest.data().count} verbleibend`)
    if (rest.data().count > 0) throw new Error(`${name} ist nicht leer!`)
  }
  const trainer = await db.collection('trainer').count().get()
  console.log(`trainer (unangetastet): ${trainer.data().count} Konten`)

  console.log(`Fertig — ${geloescht} Dokumente gelöscht.`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
