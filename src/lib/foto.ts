const ZIELGROESSE = 480 // px, quadratisch (Spielerfoto)
const TEAMFOTO_BREITE = 960 // px, 16:9 (Teamfoto)
const TEAMFOTO_HOEHE = 540

function komprimiert(datei: File, zielBreite: number, zielHoehe: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const bild = new Image()
    bild.onload = () => {
      // Mittig auf das Zielverhältnis zuschneiden, dann auf die Zielgrösse skalieren.
      const zielVerhaeltnis = zielBreite / zielHoehe
      const bildVerhaeltnis = bild.width / bild.height
      let sw = bild.width, sh = bild.height
      if (bildVerhaeltnis > zielVerhaeltnis) sw = bild.height * zielVerhaeltnis
      else sh = bild.width / zielVerhaeltnis
      const sx = (bild.width - sw) / 2
      const sy = (bild.height - sh) / 2

      const canvas = document.createElement('canvas')
      canvas.width = zielBreite
      canvas.height = zielHoehe
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas nicht verfügbar')); return }
      ctx.drawImage(bild, sx, sy, sw, sh, 0, 0, zielBreite, zielHoehe)
      resolve(canvas.toDataURL('image/jpeg', 0.72))
      URL.revokeObjectURL(bild.src)
    }
    bild.onerror = () => reject(new Error('Bild konnte nicht geladen werden'))
    bild.src = URL.createObjectURL(datei)
  })
}

/** Lädt eine Bilddatei, schneidet sie mittig quadratisch zu und komprimiert sie als JPEG. */
export function komprimiertesFoto(datei: File): Promise<string> {
  return komprimiert(datei, ZIELGROESSE, ZIELGROESSE)
}

/** Lädt eine Bilddatei, schneidet sie mittig auf 16:9 zu und komprimiert sie als JPEG. */
export function komprimiertesTeamfoto(datei: File): Promise<string> {
  return komprimiert(datei, TEAMFOTO_BREITE, TEAMFOTO_HOEHE)
}
