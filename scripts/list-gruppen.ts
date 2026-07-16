// EINMALIGES Lese-Skript: listet nur die Namen aller Gruppen in Firestore auf
// (keine Personendaten), zur Kontrolle nach dem Wipe/Seed. Wird danach entfernt.
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

async function main() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT fehlt')
  const app = initializeApp({ credential: cert(JSON.parse(raw)) })
  const db = getFirestore(app)
  const snap = await db.collection('gruppen').get()
  console.log(`Total: ${snap.size} Gruppen`)
  for (const d of snap.docs) {
    const data = d.data() as { name: string; mitglieder?: unknown[]; icalQuellen?: unknown[] }
    console.log(`- [${d.id}] "${data.name}" · Mitglieder: ${data.mitglieder?.length ?? 0} · Kalender: ${data.icalQuellen?.length ?? 0}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
