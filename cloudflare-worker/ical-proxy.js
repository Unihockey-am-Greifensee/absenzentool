// CORS-Proxy für die iCal-Feeds (die Quell-Server liefern selbst keine CORS-Header).
// Nur explizit erlaubte Feed-Anbieter werden durchgelassen — kein offener Allzweck-Proxy.
//
// Deployment: Cloudflare-Dashboard → Workers & Pages → Create → "Create Worker"
// → Code hier reinkopieren (ersetzt den Vorschlag) → Deploy.
// Die resultierende *.workers.dev-URL wird in src/config/icalProxy.ts eingetragen.

// Nur diese Prefixe werden weitergeleitet — bei einem neuen Feed-Anbieter hier ergänzen.
const ERLAUBTE_PREFIXE = [
  'https://calendar.google.com/calendar/ical/',
  'https://admin.kirche-wigarten.ch/ical/', // Kalender-Verwaltung, auch für die Grizzlys-Trainingszeiten genutzt
]

export default {
  async fetch(request) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS })
    }

    const ziel = url.searchParams.get('url')
    if (!ziel || !ERLAUBTE_PREFIXE.some(prefix => ziel.startsWith(prefix))) {
      return new Response(`Nur folgende Feed-Anbieter sind erlaubt: ${ERLAUBTE_PREFIXE.join(', ')}`, {
        status: 400,
        headers: CORS_HEADERS,
      })
    }

    const antwort = await fetch(ziel, { headers: { 'User-Agent': 'absenzentool-ical-proxy' } })
    const text = await antwort.text()
    return new Response(text, {
      status: antwort.status,
      headers: { ...CORS_HEADERS, 'content-type': 'text/calendar; charset=utf-8' },
    })
  },
}

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
}
