// EINMALIGES Skript: legt die 12 Grizzlys-Gruppen samt iCal-Kalendern neu an,
// nachdem die Datenbank geleert wurde — dieselbe Zuordnungslogik wie der
// "Grizzlys-Kalender zuordnen"-Knopf in der App (src/views/IcalSync.tsx,
// Funktion vorlagenZuordnen), hier bewusst dupliziert statt importiert, damit
// das Skript nicht den ganzen App-Modulbaum (inkl. Firebase-Web-Init) mitzieht.
// Läuft nur manuell, wird nach Gebrauch wieder entfernt.

import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { ICAL_VORLAGEN } from '../src/config/icalVorlagen'
import type { Gruppe } from '../src/types'
import { neueId } from '../src/types'

function ohneUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T
}

async function main() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT fehlt')

  const app = initializeApp({ credential: cert(JSON.parse(raw)) })
  const db = getFirestore(app)

  const bestehendSnap = await db.collection('gruppen').get()
  const gruppen: Gruppe[] = bestehendSnap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Gruppe, 'id'>) }))
  console.log(`Bestehende Gruppen in Firestore: ${gruppen.length}`)

  let neueGruppen = 0, zugeordnet = 0
  const geaendert = new Set<string>()

  for (const v of ICAL_VORLAGEN) {
    let gruppe = gruppen.find(g => g.name === v.gruppe)
    if (!gruppe) {
      gruppe = { id: neueId(), name: v.gruppe, mitglieder: [], aktivitaeten: [] }
      gruppen.push(gruppe)
      neueGruppen++
    }
    const vorhandene = new Set((gruppe.icalQuellen ?? []).map(q => q.url))
    for (const q of v.quellen) {
      if (!vorhandene.has(q.url)) {
        gruppe.icalQuellen = [...(gruppe.icalQuellen ?? []), q]
        zugeordnet++
        geaendert.add(gruppe.id)
      }
    }
  }

  console.log(`Neu anzulegen: ${neueGruppen} Gruppen, ${zugeordnet} Kalenderzuordnungen.`)

  for (const g of gruppen) {
    if (!geaendert.has(g.id) && bestehendSnap.docs.some(d => d.id === g.id)) continue // unverändert, nicht neu schreiben
    const { aktivitaeten, ...doc } = g
    void aktivitaeten
    await db.collection('gruppen').doc(g.id).set(ohneUndefined(doc))
    console.log(`geschrieben: ${g.name} (${g.icalQuellen?.length ?? 0} Kalender)`)
  }

  console.log(`Fertig — ${gruppen.length} Gruppen total.`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
