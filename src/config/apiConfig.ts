// Basis-URL des neuen RudelCheck-Node/MySQL-Backends (Ersatz für Firebase, siehe
// Migrationsplan). Leer = weiterhin Firebase-Modus. Sobald das Backend produktiv auf
// Novatrend läuft, hier die Produktions-URL eintragen, um den Umstieg für alle zu vollziehen.
const API_BASE_URL_PROD = ''

// Dev-Server: mit ?api=<url> gegen ein lokales/entferntes Backend testen, ohne diese
// Datei anzufassen (gleiches Muster wie ?lokal in firebase.ts).
const apiUeberschreibung = import.meta.env?.DEV ? new URLSearchParams(location.search).get('api') : null

export const API_BASE_URL = apiUeberschreibung ?? API_BASE_URL_PROD
export const apiAktiv = API_BASE_URL !== ''

// Google-OAuth-Client-ID — dieselbe "Web SDK"-Client-ID, die auch das bisherige
// Firebase-Projekt für den Google-Login verwendet (siehe src/firebase.ts). Client-IDs
// sind öffentlich und dürfen im Frontend-Code stehen (kein Secret).
export const GOOGLE_CLIENT_ID = '260146342129-lsq0rilrgs4ehj40isjrcq5qshrkgbrm.apps.googleusercontent.com'
