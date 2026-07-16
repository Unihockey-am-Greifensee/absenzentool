// EINMALIGES Aufräum-Skript: löscht genau die 13 leeren Duplikat-Gruppen, die
// seed-gruppen.ts versehentlich angelegt hat (Namensabweichung von den
// bestehenden, mitgliederhaltigen Gruppen). Nur diese exakten IDs, sonst
// nichts. Wird nach Gebrauch wieder entfernt.
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const DUPLIKAT_IDS = [
  '1hexu2z4mrn0rlii', '23zxj9qnmrn0rlii', '4l833s4gmrn0rlii', '6hp0vbs2mrn0rlii',
  '8r94x6yzmrn0rlii', 'a91a6dx0mrn0rlii', 'c5iva20imrn0rlii', 'dwc1qqa8mrn0rlii',
  'h6xwl045mrn0rlii', 'm4rhgpabmrn0rlii', 'qj8kv0yzmrn0rlii', 'rxxghpmnmrn0rlii',
  'uo3g76m0mrn0rlii',
]

async function main() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT fehlt')
  const app = initializeApp({ credential: cert(JSON.parse(raw)) })
  const db = getFirestore(app)

  for (const id of DUPLIKAT_IDS) {
    const ref = db.collection('gruppen').doc(id)
    const snap = await ref.get()
    if (!snap.exists) { console.log(`${id}: existiert nicht mehr, übersprungen`); continue }
    const data = snap.data() as { name: string; mitglieder?: unknown[] }
    if ((data.mitglieder?.length ?? 0) > 0) {
      throw new Error(`SICHERHEITSABBRUCH: ${id} ("${data.name}") hat Mitglieder — kein Duplikat, wird nicht gelöscht.`)
    }
    await db.recursiveDelete(ref)
    console.log(`gelöscht: "${data.name}" (${id})`)
  }
  console.log('Fertig.')
}

main().catch(e => { console.error(e); process.exit(1) })
