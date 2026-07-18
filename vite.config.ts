import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/absenzentool/', // GitHub Pages: unihockey-am-greifensee.github.io/absenzentool/
  server: {
    proxy: {
      // Diese Feed-Anbieter liefern keine CORS-Header — im Dev-Modus umgehen wir das über
      // diese Proxies (siehe fetchUrl() in src/lib/icsImport.ts). In Produktion übernimmt
      // das der Cloudflare Worker aus cloudflare-worker/.
      '/gcal': {
        target: 'https://calendar.google.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/gcal/, ''),
      },
      '/kirche-wigarten-ical': {
        target: 'https://admin.kirche-wigarten.ch',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/kirche-wigarten-ical/, ''),
      },
    },
  },
})
