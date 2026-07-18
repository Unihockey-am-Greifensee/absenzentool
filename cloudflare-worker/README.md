# iCal-CORS-Proxy (Cloudflare Worker)

Die Kalender-Quellen (Google Calendar, die Kalender-Verwaltung von admin.kirche-wigarten.ch)
schicken für ihre `.ics`-Feeds keine CORS-Freigabe — ein Browser darf sie also nicht per
`fetch()` laden, nur per direkter Navigation. Damit der «Jetzt synchronisieren»-Knopf auch
auf der Live-Seite funktioniert (nicht nur lokal über den Vite-Dev-Proxy), läuft ein winziger
Cloudflare Worker dazwischen, der nur diese fest erlaubten Feed-Anbieter durchreicht und dabei
die nötigen CORS-Header ergänzt.

## Einmaliges Deployment

1. [dash.cloudflare.com](https://dash.cloudflare.com/) → kostenloses Konto (falls noch keins vorhanden)
2. **Workers & Pages** → **Create** → **Create Worker**
3. Namen vergeben (z. B. `absenzentool-ical-proxy`) → **Deploy** (mit dem Standard-Beispielcode)
4. **Edit code** → Inhalt von [`ical-proxy.js`](ical-proxy.js) komplett einfügen → **Save and deploy**
5. Die resultierende URL (`https://absenzentool-ical-proxy.<dein-konto>.workers.dev`) in
   [`../src/config/icalProxy.ts`](../src/config/icalProxy.ts) eintragen

## Warum kein Sicherheitsrisiko

Der Worker leitet ausschliesslich Anfragen an die in `ERLAUBTE_PREFIXE` (in `ical-proxy.js`)
gelisteten URL-Präfixe weiter — alles andere lehnt er mit HTTP 400 ab. Aktuell:
`calendar.google.com/calendar/ical/…` und `admin.kirche-wigarten.ch/ical/…`. Es werden keine
Zugangsdaten oder Cookies durchgereicht, nur öffentlich abonnierbare Kalenderdaten (dieselben,
die auch die App-Nutzer sonst im Browser direkt aufrufen könnten). Bei einem neuen Feed-
Anbieter dort einfach einen weiteren Prefix ergänzen.
