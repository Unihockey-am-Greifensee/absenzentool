// Einmaliges Skript: Umstellung auf neue Kalenderquelle (admin.kirche-wigarten.ch)
// für ausgewählte Gruppen. Löscht die bestehenden Termine dieser Gruppen komplett
// und lädt sie ab 1.8.2025 neu aus der neuen iCal-Quelle. Wird nach Gebrauch wieder
// entfernt (siehe git log).

import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { icsMergen, nurZukuenftig, parseIcs } from '../src/lib/icsImport'
import type { Aktivitaet, AppState } from '../src/types'

const AB_DATUM = '2025-08-01'

const GRUPPEN: { id: string; name: string; url: string }[] = [
  { id: 'x56wsbjqmrmi0urq', name: 'U17 GF', url: 'https://admin.kirche-wigarten.ch/ical/?user=315f40bd82d57d1e2ddae5a5279c6b33&egs=p14566' },
  { id: 'l2p9ais3mrmhzdtd', name: 'U11 FÄLLANDÄ', url: 'https://admin.kirche-wigarten.ch/ical/?user=315f40bd82d57d1e2ddae5a5279c6b33&egs=p12983' },
  { id: 'xn7xk3ibmrmhzi3n', name: 'U11 SCHWERZI', url: 'https://admin.kirche-wigarten.ch/ical/?user=315f40bd82d57d1e2ddae5a5279c6b33&egs=p12855' },
  { id: 't5ro800kmrmi0q5y', name: 'U18 GF', url: 'https://admin.kirche-wigarten.ch/ical/?user=315f40bd82d57d1e2ddae5a5279c6b33&egs=p14564' },
  { id: '97nlvijmmrmi0k1t', name: 'HERREN GF', url: 'https://admin.kirche-wigarten.ch/ical/?user=315f40bd82d57d1e2ddae5a5279c6b33&egs=p14565' },
  { id: 'fjavum1vmrncnt3e', name: 'U13 FÖRDER', url: 'https://admin.kirche-wigarten.ch/ical/?user=315f40bd82d57d1e2ddae5a5279c6b33&egs=45' },
  { id: '9jiden9mmrmhzny1', name: 'U13 FÄLLANDÄ', url: 'https://admin.kirche-wigarten.ch/ical/?user=315f40bd82d57d1e2ddae5a5279c6b33&egs=p14334' },
  { id: 'yy1ksx3xmrmhzv7j', name: 'U13 SCHWERZI', url: 'https://admin.kirche-wigarten.ch/ical/?user=315f40bd82d57d1e2ddae5a5279c6b33&egs=p12984' },
  { id: '6w8lhgp9mrmhzz7q', name: 'U16 FÄLLANDÄ', url: 'https://admin.kirche-wigarten.ch/ical/?user=315f40bd82d57d1e2ddae5a5279c6b33&egs=p14335' },
  { id: 'jdtkhpq1mrncnxeo', name: 'U16 FÖRDER', url: 'https://admin.kirche-wigarten.ch/ical/?user=315f40bd82d57d1e2ddae5a5279c6b33&egs=62' },
  { id: 'sqqi4s8cmrmi02gp', name: 'U16 SCHWERZI', url: 'https://admin.kirche-wigarten.ch/ical/?user=315f40bd82d57d1e2ddae5a5279c6b33&egs=p13594' },
  { id: 'rbla934emrmhz7zw', name: 'U9 FÄLLANDÄ', url: 'https://admin.kirche-wigarten.ch/ical/?user=315f40bd82d57d1e2ddae5a5279c6b33&egs=p14343' },
  { id: '0oemlldnmrmhyyne', name: 'U9 VOLKI', url: 'https://admin.kirche-wigarten.ch/ical/?user=315f40bd82d57d1e2ddae5a5279c6b33&egs=p14797' },
]

function ohneUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T
}

async function main() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT fehlt (GitHub-Secret nicht gesetzt?)')
  const app = initializeApp({ credential: cert(JSON.parse(raw)) })
  const db = getFirestore(app)

  for (const g of GRUPPEN) {
    const gRef = db.collection('gruppen').doc(g.id)
    const gSnap = await gRef.get()
    if (!gSnap.exists) { console.error(`«${g.name}»: Gruppe ${g.id} nicht gefunden — übersprungen.`); continue }

    // 1) Bestehende Termine komplett löschen
    const alt = await gRef.collection('aktivitaeten').get()
    let delBatch = db.batch()
    let delCount = 0
    for (const doc of alt.docs) {
      delBatch.delete(doc.ref)
      delCount++
      if (delCount % 450 === 0) { await delBatch.commit(); delBatch = db.batch() }
    }
    if (delCount % 450 !== 0 || delCount === 0) await delBatch.commit()

    // 2) Neue Kalenderquelle setzen (ersetzt alle bisherigen Quellen dieser Gruppe)
    await gRef.update({ icalQuellen: [{ url: g.url, typ: 'Training' }] })

    // 3) Neu laden ab AB_DATUM
    try {
      const res = await fetch(g.url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const events = parseIcs(await res.text())
      const gefiltert = nurZukuenftig(events, AB_DATUM)
      const leererState: AppState = {
        personen: [],
        gruppen: [{ id: g.id, name: g.name, mitglieder: [], aktivitaeten: [], icalQuellen: [{ url: g.url, typ: 'Training' }] }],
      }
      const { state: neu, ergebnis } = icsMergen(leererState, g.id, gefiltert, 'Training')
      const aktivitaetenNeu: Aktivitaet[] = neu.gruppen[0].aktivitaeten
      let batch = db.batch()
      let n = 0
      for (const a of aktivitaetenNeu) {
        batch.set(gRef.collection('aktivitaeten').doc(a.id), ohneUndefined({ ...a }))
        n++
        if (n % 450 === 0) { await batch.commit(); batch = db.batch() }
      }
      if (n % 450 !== 0 || n === 0) await batch.commit()
      console.log(`«${g.name}»: ${delCount} alte Termine gelöscht, ${ergebnis.neu} neu geladen (ab ${AB_DATUM}).`)
    } catch (e) {
      console.error(`«${g.name}»: Fehler beim Neuladen: ${e}`)
    }
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
