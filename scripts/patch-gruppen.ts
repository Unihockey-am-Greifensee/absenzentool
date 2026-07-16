// EINMALIGES Skript: hängt die kOOL-/Google-Kalender an die 12 bereits
// bestehenden, mitgliederhaltigen Gruppen (exakte IDs, keine Namenssuche mehr
// — die schlug wegen abweichender Schreibweise fehl, siehe seed-gruppen.ts).
// Legt zusätzlich U13 FÖRDER und U16 FÖRDER als neue, leere Gruppen mit ihren
// Kalendern an. U17 GF bleibt bewusst ohne Kalender (Link folgt später).
// Bereits vorhandene Kalenderquellen werden nie doppelt angehängt (URL-Dedup).
// Wird nach Gebrauch wieder entfernt.

import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import type { Gruppe, IcalQuelle } from '../src/types'
import { neueId } from '../src/types'

function ohneUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T
}

const G = 'https://calendar.google.com/calendar/ical/'
const S = '%40import.calendar.google.com/public/basic.ics'
const q = (hash: string): IcalQuelle => ({ url: `${G}${hash}${S}`, typ: 'Training' })

// gruppeId (exakt aus Firestore) -> Kalenderquellen, die ANGEHÄNGT werden (bestehende bleiben, keine Duplikate).
const ZUORDNUNG: Record<string, IcalQuelle[]> = {
  '0oemlldnmrmhyyne': [q('n8mjjcptfpsl6gihfj2qoq4vir6qkgh7')], // U9 VOLKI
  '6w8lhgp9mrmhzz7q': [q('ptbialg6uksrq813ok81g1n376vk0li4')], // U16 FÄLLANDÄ
  '9jiden9mmrmhzny1': [q('r6mfon1p1bo2m4o02n6u7vodcrjkiojk')], // U13 FÄLLANDÄ
  'h5sdvgnamrmhz3uv': [q('jdvdja0tksef9h2l1d494icqml2mojas')], // U9 SCHWERZI
  'l2p9ais3mrmhzdtd': [q('fqskjl84kp428sn5nni5aku6vfqu6q5j')], // U11 FÄLLANDÄ
  'rbla934emrmhz7zw': [q('ol4u49kp1tcj6inpqqd85qcatmbse55p')], // U9 FÄLLANDÄ
  'sqqi4s8cmrmi02gp': [q('98tjct615ro743rdc7of92f0ihcivs8r')], // U16 SCHWERZI
  'yy1ksx3xmrmhzv7j': [q('dhkvjci8tl3a5mnial3odk2moletsi6m')], // U13 SCHWERZI
  'xn7xk3ibmrmhzi3n': [q('oubqrkavduaefamilo0b9utahrj42pm0')], // U11 SCHWERZI
  't5ro800kmrmi0q5y': [ // U18 GF
    { url: `${G}7jud17j8ppaig7hfdikol2uehb8v4d4u${S}`, typ: 'Wettkampf' },
    q('65vod6vslbp27fd5sllfpkedq04fv4qj'),
  ],
  '97nlvijmmrmi0k1t': [ // HERREN GF — hat schon 1 Kalender; hier beide Vorlagen-Quellen, Dedup übernimmt den Rest.
    { url: `${G}5v4hgsfkusvufmk5vludo1boej94up6k${S}`, typ: 'Wettkampf' },
    q('q7i23rh1s1b1un4ghbsilarg8i6sjjma'),
  ],
}

async function main() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT fehlt')
  const app = initializeApp({ credential: cert(JSON.parse(raw)) })
  const db = getFirestore(app)

  for (const [id, neueQuellen] of Object.entries(ZUORDNUNG)) {
    const ref = db.collection('gruppen').doc(id)
    const snap = await ref.get()
    if (!snap.exists) { console.log(`${id}: NICHT GEFUNDEN — übersprungen`); continue }
    const data = snap.data() as Gruppe
    const vorhandene = new Set((data.icalQuellen ?? []).map(x => x.url))
    const hinzu = neueQuellen.filter(x => !vorhandene.has(x.url))
    if (hinzu.length === 0) { console.log(`${data.name}: keine neuen Kalender nötig`); continue }
    const icalQuellen = [...(data.icalQuellen ?? []), ...hinzu]
    await ref.set(ohneUndefined({ icalQuellen }), { merge: true })
    console.log(`${data.name}: +${hinzu.length} Kalender (total ${icalQuellen.length})`)
  }

  // Neue, leere FÖRDER-Gruppen anlegen.
  const neu: { name: string; quellen: IcalQuelle[] }[] = [
    { name: 'U13 FÖRDER', quellen: [q('g4i004kdr5rvqf7ffs2mmvfauvhj20fv')] },
    { name: 'U16 FÖRDER', quellen: [q('7tsi0361jgg5olquqvj2ujh8a8b7mad4')] },
  ]
  for (const v of neu) {
    const gruppe: Gruppe = { id: neueId(), name: v.name, mitglieder: [], aktivitaeten: [], icalQuellen: v.quellen }
    const { aktivitaeten, ...doc } = gruppe
    void aktivitaeten
    await db.collection('gruppen').doc(gruppe.id).set(ohneUndefined(doc))
    console.log(`angelegt: ${v.name} (${v.quellen.length} Kalender)`)
  }

  console.log('Fertig.')
}

main().catch(e => { console.error(e); process.exit(1) })
