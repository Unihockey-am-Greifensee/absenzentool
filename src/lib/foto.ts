const ZIELGROESSE = 480 // px, quadratisch

/** Lädt eine Bilddatei, schneidet sie mittig quadratisch zu und komprimiert sie als JPEG. */
export function komprimiertesFoto(datei: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const bild = new Image()
    bild.onload = () => {
      const seite = Math.min(bild.width, bild.height)
      const sx = (bild.width - seite) / 2
      const sy = (bild.height - seite) / 2
      const canvas = document.createElement('canvas')
      canvas.width = ZIELGROESSE
      canvas.height = ZIELGROESSE
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas nicht verfügbar')); return }
      ctx.drawImage(bild, sx, sy, seite, seite, 0, 0, ZIELGROESSE, ZIELGROESSE)
      resolve(canvas.toDataURL('image/jpeg', 0.72))
      URL.revokeObjectURL(bild.src)
    }
    bild.onerror = () => reject(new Error('Bild konnte nicht geladen werden'))
    bild.src = URL.createObjectURL(datei)
  })
}
