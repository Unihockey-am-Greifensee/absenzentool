// CORS-Proxy für die iCal-Feeds (Google Calendar liefert selbst keine CORS-Header).
// Nur calendar.google.com wird durchgelassen — kein offener Allzweck-Proxy.
//
// Deployment: Cloudflare-Dashboard → Workers & Pages → Create → "Create Worker"
// → Code hier reinkopieren (ersetzt den Vorschlag) → Deploy.
// Die resultierende *.workers.dev-URL wird in src/config/icalProxy.ts eingetragen.

export default {
  async fetch(request) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS })
    }

    const ziel = url.searchParams.get('url')
    if (!ziel || !ziel.startsWith('https://calendar.google.com/calendar/ical/')) {
      return new Response('Nur calendar.google.com/calendar/ical/… ist erlaubt.', {
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
