import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/absenzentool/', // GitHub Pages: unihockey-am-greifensee.github.io/absenzentool/
  server: {
    proxy: {
      // Google Calendar liefert keine CORS-Header — im Dev-Modus umgehen wir
      // das über diesen Proxy. Im späteren Betrieb übernimmt eine GitHub
      // Action (bzw. der Firestore-Sync) das Laden der Feeds.
      '/gcal': {
        target: 'https://calendar.google.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/gcal/, ''),
      },
    },
  },
})
