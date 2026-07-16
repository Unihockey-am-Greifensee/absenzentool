// EINMALIGES Skript: liest historische Termine (ab 1. August 2025, bis gestern)
// aus den bereits konfigurierten iCal-Feeds und trägt sie in die Gruppen ein,
// damit die Anwesenheit rückwirkend über die bisherige Google-Absenzenliste
// nachgetragen werden kann. Nutzt dieselbe Merge-Logik wie der nächtliche Sync
// (icsMergen/parseIcs) — bereits angefasste Termine bleiben unberührt, Duplikate
// per iCal-UID ausgeschlossen. KEINE Dauerfunktion: Skript + Workflow werden nach
// dem einmaligen Lauf wieder aus dem Repo entfernt.

import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { icsMergen, parseIcs } from '../src/lib/icsImport'
import type { Aktivitaet, AppState, IcalQuelle } from '../src/types'
import { heute } from '../src/lib/datum'

const AB_DATUM = '2025-08-01'

function ohneUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T
}

async function main() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT fehlt')

  const app = initializeApp({ credential: cert(JSON.parse(raw)) })
  const db = getFirestore(app)
  const bisDatum = heute() // exklusiv — Heute/Zukunft übernimmt der reguläre Sync

  const gruppenSnap = await db.collection('gruppen').get()
  let gesamtNeu = 0, gesamtAktualisiert = 0, fehlerCount = 0

  for (const gDoc of gruppenSnap.docs) {
    const gruppeDaten = gDoc.data() as { name: string; icalQuellen?: IcalQuelle[] }
    const quellen = gruppeDaten.icalQuellen ?? []
    if (quellen.length === 0) continue

    const aktSnap = await gDoc.ref.collection('aktivitaeten').get()
    const aktivitaetenAlt: Aktivitaet[] = aktSnap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Aktivitaet, 'id'>) }))

    let arbeitsState: AppState = {
      personen: [],
      fotos: [],
      gruppen: [{ id: gDoc.id, name: gruppeDaten.name, mitglieder: [], aktivitaeten: aktivitaetenAlt, icalQuellen: quellen }],
    }

    for (const q of quellen) {
      try {
        const res = await fetch(q.url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const events = parseIcs(await res.text())
        const historisch = events.filter(ev => ev.datum >= AB_DATUM && ev.datum < bisDatum)
        if (historisch.length === 0) continue
        const { state: neu, ergebnis } = icsMergen(arbeitsState, gDoc.id, historisch, q.typ)
        arbeitsState = neu
        gesamtNeu += ergebnis.neu
        gesamtAktualisiert += ergebnis.aktualisiert
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
      if (batchGroesse >= 450) { await batch.commit(); batch = db.batch(); batchGroesse = 0 }
    }
    if (batchGroesse > 0) await batch.commit()
    if (geaendertProGruppe > 0) console.log(`«${gruppeDaten.name}»: ${geaendertProGruppe} historische Termin(e) geschrieben.`)
  }

  console.log(`Fertig — ${gesamtNeu} neu, ${gesamtAktualisiert} aktualisiert, ${fehlerCount} Fehler (Zeitraum ${AB_DATUM} bis ${bisDatum}, exklusiv).`)
  if (fehlerCount > 0) process.exitCode = 1
}

main().catch(e => { console.error(e); process.exit(1) })
