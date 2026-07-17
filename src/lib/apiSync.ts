import type { Aktivitaet, AppState, Foto, Gruppe, Person, TeamFoto } from '../types'
import { API_BASE_URL } from '../config/apiConfig'
import { apiFetch } from './apiClient'

export type { TrainerInfo, TrainerKonto } from './firestoreSync'
import type { TrainerKonto } from './firestoreSync'

// REST-Spiegel des AppState — Ersatz für firestoreSync.ts (siehe Migrationsplan).
// Lesen: initiales Laden + Polling (kein Live-Push wie Firestore-Snapshots).
// Schreiben: Diff zwischen altem und neuem AppState, ein REST-Call pro Änderung.

const POLL_INTERVALL_MS = 20_000

interface ApiAktivitaet extends Aktivitaet {
  gruppeId: string
}

interface ApiFotoMeta {
  id: string
  personId: string
  saison: string
  hochgeladenAm: string
}

interface ApiTeamFotoMeta {
  id: string
  gruppeId: string
  saison: string
  hochgeladenAm: string
}

async function pruefen(res: Response): Promise<Response> {
  if (!res.ok) throw new Error(`${res.url} → HTTP ${res.status}`)
  return res
}

async function ladeState(): Promise<AppState> {
  const [personenRes, gruppenRes, aktRes, fotosRes, teamFotosRes, fotoSaisonRes] = await Promise.all([
    apiFetch('/api/personen').then(pruefen),
    apiFetch('/api/gruppen').then(pruefen),
    apiFetch('/api/aktivitaeten').then(pruefen),
    apiFetch('/api/fotos').then(pruefen),
    apiFetch('/api/team-fotos').then(pruefen),
    apiFetch('/api/foto-saison').then(pruefen),
  ])

  const personen: Person[] = await personenRes.json()
  const gruppenRoh: Omit<Gruppe, 'aktivitaeten'>[] = await gruppenRes.json()
  const aktivitaeten: ApiAktivitaet[] = await aktRes.json()
  const fotosRoh: ApiFotoMeta[] = await fotosRes.json()
  const teamFotosRoh: ApiTeamFotoMeta[] = await teamFotosRes.json()
  const { saison: fotoSaison }: { saison: string } = await fotoSaisonRes.json()

  const aktProGruppe = new Map<string, Aktivitaet[]>()
  for (const { gruppeId, ...rest } of aktivitaeten) {
    if (!aktProGruppe.has(gruppeId)) aktProGruppe.set(gruppeId, [])
    aktProGruppe.get(gruppeId)!.push(rest)
  }

  const gruppen: Gruppe[] = gruppenRoh
    .map(g => ({ ...g, aktivitaeten: aktProGruppe.get(g.id) ?? [] }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'))

  // Statt Base64 verweist datenUrl jetzt auf den authentifizierten Auslieferungs-Endpoint —
  // <img src="…"> funktioniert damit identisch wie bisher mit einer data:-URL.
  const fotos: Foto[] = fotosRoh.map(f => ({
    id: f.id,
    personId: f.personId,
    saison: f.saison,
    hochgeladenAm: f.hochgeladenAm,
    datenUrl: `${API_BASE_URL}/api/fotos/${f.id}/datei`,
  }))

  const teamFotos: TeamFoto[] = teamFotosRoh.map(f => ({
    id: f.id,
    gruppeId: f.gruppeId,
    saison: f.saison,
    hochgeladenAm: f.hochgeladenAm,
    datenUrl: `${API_BASE_URL}/api/team-fotos/${f.id}/datei`,
  }))

  return { personen, gruppen, fotos, teamFotos, fotoSaison }
}

export function abonnieren(
  _istMaster: boolean,
  aufState: (state: AppState) => void,
  aufFehler: (fehler: string) => void,
): () => void {
  let gestoppt = false
  const laden = async () => {
    try {
      const staat = await ladeState()
      if (!gestoppt) aufState(staat)
    } catch (e) {
      if (!gestoppt) aufFehler(String(e))
    }
  }
  laden()
  const intervall = setInterval(laden, POLL_INTERVALL_MS)
  return () => { gestoppt = true; clearInterval(intervall) }
}

function dataUrlZuBlob(datenUrl: string): Blob {
  const [kopf, daten] = datenUrl.split(',')
  const mime = /data:(.*?);base64/.exec(kopf)?.[1] ?? 'image/jpeg'
  const bytes = atob(daten)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

function ohneAktivitaeten(g: Gruppe): Omit<Gruppe, 'aktivitaeten' | 'mitglieder' | 'icalQuellen' | 'trainerEmails' | 'hauptverantwortlicherEmail'> {
  const { aktivitaeten: _a, mitglieder: _m, icalQuellen: _i, trainerEmails: _t, hauptverantwortlicherEmail: _h, ...rest } = g
  return rest
}

/** Schreibt die Differenz zwischen altem und neuem Zustand über die REST-API. */
export async function diffSchreiben(alt: AppState, neu: AppState, _istMaster: boolean): Promise<void> {
  // --- Personen ---
  const altP = new Map(alt.personen.map(p => [p.id, p]))
  const neuP = new Map(neu.personen.map(p => [p.id, p]))
  for (const [id, p] of neuP) {
    const vorher = altP.get(id)
    if (vorher && JSON.stringify(vorher) === JSON.stringify(p)) continue
    if (!vorher) await apiFetch('/api/personen', { method: 'POST', body: JSON.stringify(p) }).then(pruefen)
    else await apiFetch(`/api/personen/${id}`, { method: 'PUT', body: JSON.stringify(p) }).then(pruefen)
  }
  for (const id of altP.keys()) {
    if (!neuP.has(id)) await apiFetch(`/api/personen/${id}`, { method: 'DELETE' }).then(pruefen)
  }

  // --- Gruppen (Metadaten, Mitglieder, iCal-Quellen, Trainer-Zuweisung) ---
  const altG = new Map(alt.gruppen.map(g => [g.id, g]))
  const neuG = new Map(neu.gruppen.map(g => [g.id, g]))

  for (const [id, g] of neuG) {
    const vorher = altG.get(id)
    const meta = ohneAktivitaeten(g)
    if (!vorher) {
      await apiFetch('/api/gruppen', { method: 'POST', body: JSON.stringify(meta) }).then(pruefen)
    } else if (JSON.stringify(ohneAktivitaeten(vorher)) !== JSON.stringify(meta)) {
      await apiFetch(`/api/gruppen/${id}`, { method: 'PUT', body: JSON.stringify(meta) }).then(pruefen)
    }

    // Mitglieder
    const altM = new Map((vorher?.mitglieder ?? []).map(m => [m.personId, m]))
    const neuM = new Map(g.mitglieder.map(m => [m.personId, m]))
    for (const [personId, m] of neuM) {
      const vm = altM.get(personId)
      if (vm && JSON.stringify(vm) === JSON.stringify(m)) continue
      await apiFetch(`/api/gruppen/${id}/mitglieder/${personId}`, { method: 'PUT', body: JSON.stringify(m) }).then(pruefen)
    }
    for (const personId of altM.keys()) {
      if (!neuM.has(personId)) await apiFetch(`/api/gruppen/${id}/mitglieder/${personId}`, { method: 'DELETE' }).then(pruefen)
    }

    // iCal-Quellen (keine eigene Id — Abgleich über die URL)
    const altUrls = new Set((vorher?.icalQuellen ?? []).map(q => q.url))
    const neuUrls = new Set((g.icalQuellen ?? []).map(q => q.url))
    for (const q of g.icalQuellen ?? []) {
      if (!altUrls.has(q.url)) await apiFetch(`/api/gruppen/${id}/ical-quellen`, { method: 'POST', body: JSON.stringify(q) }).then(pruefen)
    }
    for (const q of vorher?.icalQuellen ?? []) {
      if (!neuUrls.has(q.url)) await apiFetch(`/api/gruppen/${id}/ical-quellen`, { method: 'DELETE', body: JSON.stringify({ url: q.url }) }).then(pruefen)
    }

    // Trainer-Zuweisung
    const altT = new Set(vorher?.trainerEmails ?? [])
    const neuT = new Set(g.trainerEmails ?? [])
    for (const email of neuT) {
      if (!altT.has(email)) await apiFetch(`/api/gruppen/${id}/trainer`, { method: 'POST', body: JSON.stringify({ email }) }).then(pruefen)
    }
    for (const email of altT) {
      if (!neuT.has(email)) await apiFetch(`/api/gruppen/${id}/trainer`, { method: 'DELETE', body: JSON.stringify({ email }) }).then(pruefen)
    }

    // Hauptverantwortlicher
    if ((vorher?.hauptverantwortlicherEmail ?? null) !== (g.hauptverantwortlicherEmail ?? null)) {
      await apiFetch(`/api/gruppen/${id}/hauptverantwortlicher`, {
        method: 'PUT', body: JSON.stringify({ email: g.hauptverantwortlicherEmail ?? null }),
      }).then(pruefen)
    }

    // Aktivitäten + Anwesenheit
    const altA = new Map((vorher?.aktivitaeten ?? []).map(a => [a.id, a]))
    for (const a of g.aktivitaeten) {
      const va = altA.get(a.id)
      if (va && JSON.stringify(va) === JSON.stringify(a)) continue
      if (!va) await apiFetch('/api/aktivitaeten', { method: 'POST', body: JSON.stringify({ ...a, gruppeId: id }) }).then(pruefen)
      else await apiFetch(`/api/aktivitaeten/${a.id}`, { method: 'PUT', body: JSON.stringify(a) }).then(pruefen)
    }
    const neuAIds = new Set(g.aktivitaeten.map(a => a.id))
    for (const aid of altA.keys()) {
      if (!neuAIds.has(aid)) await apiFetch(`/api/aktivitaeten/${aid}`, { method: 'DELETE' }).then(pruefen)
    }
  }
  for (const id of altG.keys()) {
    if (!neuG.has(id)) await apiFetch(`/api/gruppen/${id}`, { method: 'DELETE' }).then(pruefen)
  }

  // --- Fotos (Multipart-Upload statt Base64-Diff) ---
  const altF = new Map(alt.fotos.map(f => [f.id, f]))
  const neuF = new Map(neu.fotos.map(f => [f.id, f]))
  for (const [id, f] of neuF) {
    const vorher = altF.get(id)
    if (vorher && JSON.stringify(vorher) === JSON.stringify(f)) continue
    if (f.datenUrl.startsWith('data:')) {
      const form = new FormData()
      form.append('foto', dataUrlZuBlob(f.datenUrl), id + '.jpg')
      form.append('personId', f.personId)
      form.append('saison', f.saison)
      await apiFetch('/api/fotos', { method: 'POST', body: form }).then(pruefen)
    }
  }
  for (const id of altF.keys()) {
    if (!neuF.has(id)) await apiFetch(`/api/fotos/${id}`, { method: 'DELETE' }).then(pruefen)
  }

  // --- Teamfotos (analog zu Fotos, aber gruppenbezogen) ---
  const altTF = new Map(alt.teamFotos.map(f => [f.id, f]))
  const neuTF = new Map(neu.teamFotos.map(f => [f.id, f]))
  for (const [id, f] of neuTF) {
    const vorher = altTF.get(id)
    if (vorher && JSON.stringify(vorher) === JSON.stringify(f)) continue
    if (f.datenUrl.startsWith('data:')) {
      const form = new FormData()
      form.append('foto', dataUrlZuBlob(f.datenUrl), id + '.jpg')
      form.append('gruppeId', f.gruppeId)
      form.append('saison', f.saison)
      await apiFetch('/api/team-fotos', { method: 'POST', body: form }).then(pruefen)
    }
  }
  for (const id of altTF.keys()) {
    if (!neuTF.has(id)) await apiFetch(`/api/team-fotos/${id}`, { method: 'DELETE' }).then(pruefen)
  }

  // --- Foto-Saison (manuell gesteuert, Admin-Button "Zur nächsten Saison") ---
  if (alt.fotoSaison !== neu.fotoSaison) {
    await apiFetch('/api/foto-saison', { method: 'PUT', body: JSON.stringify({ saison: neu.fotoSaison }) }).then(pruefen)
  }
}

export async function trainerSpeichern(email: string, daten: { rolle: 'master' | 'trainer'; name?: string; fotoRecht?: boolean }): Promise<void> {
  await apiFetch(`/api/trainer/${encodeURIComponent(email.toLowerCase())}`, { method: 'PUT', body: JSON.stringify(daten) }).then(pruefen)
}

export async function trainerLoeschen(email: string): Promise<void> {
  await apiFetch(`/api/trainer/${encodeURIComponent(email.toLowerCase())}`, { method: 'DELETE' }).then(pruefen)
}

export async function alleTrainer(): Promise<TrainerKonto[]> {
  const res = await apiFetch('/api/trainer').then(pruefen)
  return res.json()
}

// --- Globale Fristen für die An-/Abmeldefunktion (Eltern/Spieler:innen) ---

export interface Fristen {
  fristStundenTraining: number
  fristStundenWettkampf: number
}

export async function fristenLaden(): Promise<Fristen> {
  const res = await apiFetch('/api/einstellungen').then(pruefen)
  return res.json()
}

export async function fristenSpeichern(fristen: Fristen): Promise<void> {
  await apiFetch('/api/einstellungen', { method: 'PUT', body: JSON.stringify(fristen) }).then(pruefen)
}
