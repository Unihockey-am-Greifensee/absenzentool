import { initializeApp } from 'firebase/app'
import { GoogleAuthProvider, getAuth, signInWithPopup, signOut, type Auth } from 'firebase/auth'
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore,
} from 'firebase/firestore'

// Firebase-Konfiguration des Projekts «Grizzlys-Absenzen».
// Solange apiKey leer ist, läuft die App im Lokal-Modus (localStorage, kein Login).
const firebaseConfig = {
  apiKey: 'AIzaSyCmndXO6fFx-rJRFGslzNz0ZF9u0ELvRd0',
  authDomain: 'grizzlys-absenzen.firebaseapp.com',
  projectId: 'grizzlys-absenzen',
  storageBucket: 'grizzlys-absenzen.firebasestorage.app',
  messagingSenderId: '260146342129',
  appId: '1:260146342129:web:ee77e4374024804a92e150',
}

// Dev-Server: mit ?lokal in den localStorage-Modus schalten (zum Testen ohne Login).
// In der Produktion (import.meta.env.DEV === false) wirkungslos.
const lokalErzwingen = import.meta.env?.DEV === true && new URLSearchParams(location.search).has('lokal')

export const firebaseAktiv = firebaseConfig.apiKey !== '' && !lokalErzwingen

let _auth: Auth | null = null
let _db: Firestore | null = null

if (firebaseAktiv) {
  const app = initializeApp(firebaseConfig)
  _auth = getAuth(app)
  // Offline-Cache: Anwesenheit lässt sich auch ohne Empfang in der Halle erfassen.
  _db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  })
}

export const auth = _auth
export const db = _db

export async function googleAnmelden(): Promise<void> {
  if (!auth) return
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  try {
    await signInWithPopup(auth, provider)
  } catch (error) {
    console.error('Popup-Login fehlgeschlagen, versuche Redirect als Fallback …', error)
    // Falls das Popup blockiert wird (z. B. durch aggressive Adblocker/Browser-Einstellungen).
    const { signInWithRedirect } = await import('firebase/auth')
    await signInWithRedirect(auth, provider)
  }
}

export async function abmelden(): Promise<void> {
  if (auth) await signOut(auth)
}
