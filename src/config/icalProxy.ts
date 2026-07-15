// URL des Cloudflare Workers, der die iCal-Feeds CORS-fähig durchreicht
// (siehe cloudflare-worker/README.md). Leer = kein Proxy in Produktion konfiguriert,
// dann funktioniert der Sync nur lokal (Dev-Proxy) oder per manuellem .ics-Upload.
export const ICAL_PROXY_URL = 'https://absenzentool-ical-proxy.raphael-15b.workers.dev'
