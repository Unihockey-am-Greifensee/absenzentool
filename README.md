# Absenzentool

Anwesenheitskontrolle und J+S-Export (BASPO/NDS) für Unihockey am Greifensee (Grizzlys).

**Live:** https://unihockey-am-greifensee.github.io/absenzentool/

## Was es kann

- **kOOL-Import:** Personen, Teams und Rollen aus dem kOOL-Excel-Export (inkl. J+S-Nummer, AHV-Nr.)
- **iCal-Sync:** Trainings und Spieltage aus den Vereinskalendern, mit automatischer Typ-Erkennung (Training/Wettkampf)
- **Anwesenheitserfassung:** mobil-optimiert, offlinefähig (Firestore-Cache), Termine einzeln oder als Wochenserie
- **NDS-Export:** die drei Import-CSVs (Personen, Aktivitäten, Anwesenheitskontrolle) exakt nach den offiziellen
  BASPO-Anleitungen, mit Format- und Vollständigkeits-Check vor dem Download
- **Rollen:** Admin (alles) und Trainer (nur zugeteilte Gruppen); Google-Login mit Freischaltliste

## Technik

- React + TypeScript + Vite, Deployment auf GitHub Pages (`gh-pages`-Branch)
- Firebase: Authentication (Google) + Firestore (Region Zürich), Regeln in [`firestore.rules`](firestore.rules)
- AHV-Nr./PEID liegen in einer separaten Collection und sind nur für Admin-Konten lesbar

## Entwicklung

```bash
npm install
npm run dev      # http://localhost:5199 — lokal läuft ein CORS-Proxy für die iCal-Feeds
npm run build    # Produktions-Build nach dist/
```

Ohne Firebase-Konfiguration (leerer `apiKey` in `src/firebase.ts`) läuft die App im Lokal-Modus
(localStorage, kein Login) — praktisch zum Entwickeln.
