// Schalter für den Umstieg von Firebase auf das RudelCheck-Backend (siehe Migrationsplan).
// Wird über die Build-Variable VITE_API_AKTIV gesetzt (siehe package.json: "build" = Firebase/
// GitHub Pages, "build:rudelcheck" = RudelCheck/Novatrend) statt fest im Code, damit nie versehentlich
// der falsche Modus in den falschen Build gerät. Frontend und Backend laufen auf Novatrend auf
// derselben Domain, daher bleibt API_BASE_URL_PROD normalerweise leer (relative Pfade, kein CORS
// nötig) — ausser VITE_API_BASE_URL ist gesetzt (siehe "build:app" in package.json): die native
// Capacitor-App läuft aus einem eigenen Schema (capacitor://localhost), nicht same-origin, und
// braucht deshalb eine absolute URL zum Server.
const API_AKTIV_PROD = import.meta.env.VITE_API_AKTIV === 'true'
const API_BASE_URL_PROD = import.meta.env.VITE_API_BASE_URL ?? ''

// Dev-Server: mit ?api=<url> gegen ein lokales/entferntes Backend testen, ohne diese
// Datei anzufassen (gleiches Muster wie ?lokal in firebase.ts).
const apiUeberschreibung = import.meta.env?.DEV ? new URLSearchParams(location.search).get('api') : null

export const API_BASE_URL = apiUeberschreibung ?? API_BASE_URL_PROD
export const apiAktiv = apiUeberschreibung !== null || API_AKTIV_PROD

// Google-OAuth-Client-ID — dieselbe "Web SDK"-Client-ID, die auch das bisherige
// Firebase-Projekt für den Google-Login verwendet (siehe src/firebase.ts). Client-IDs
// sind öffentlich und dürfen im Frontend-Code stehen (kein Secret).
export const GOOGLE_CLIENT_ID = '260146342129-lsq0rilrgs4ehj40isjrcq5qshrkgbrm.apps.googleusercontent.com'
