import type { ImageSource } from '@imgly/background-removal'
import { defringe } from './defringe'

let modelLoaded = false

export type ProgressCallback = (stage: string, current: number, total: number) => void

// ── Saturation boost ─────────────────────────────────────────────────────────
// Amplifies subtle colour differences (e.g. cream fur vs white bed) so the
// model gets a clearer signal.  Applied to inference only; output uses original.
async function enhanceForSegmentation(file: File | Blob): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const { width: w, height: h } = bmp
  const canvas = new OffscreenCanvas(w, h)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bmp, 0, 0)
  const id = ctx.getImageData(0, 0, w, h)
  const d = id.data
  const n = w * h

  for (let i = 0; i < n; i++) {
    const r = d[i*4] / 255, g = d[i*4+1] / 255, b = d[i*4+2] / 255
    const cmax = Math.max(r, g, b), cmin = Math.min(r, g, b), delta = cmax - cmin
    if (delta < 1e-6) continue
    const l = (cmax + cmin) / 2
    const s = delta / (1 - Math.abs(2 * l - 1))
    let hue = 0
    if      (cmax === r) hue = ((g - b) / delta % 6 + 6) % 6
    else if (cmax === g) hue = (b - r) / delta + 2
    else                 hue = (r - g) / delta + 4
    const newS = Math.min(1, s * 3)
    const C = (1 - Math.abs(2 * l - 1)) * newS
    const X = C * (1 - Math.abs(hue % 2 - 1))
    const m = l - C / 2
    let r1 = 0, g1 = 0, b1 = 0
    if      (hue < 1) { r1=C; g1=X; b1=0 }
    else if (hue < 2) { r1=X; g1=C; b1=0 }
    else if (hue < 3) { r1=0; g1=C; b1=X }
    else if (hue < 4) { r1=0; g1=X; b1=C }
    else if (hue < 5) { r1=X; g1=0; b1=C }
    else              { r1=C; g1=0; b1=X }
    d[i*4]   = Math.round((r1 + m) * 255)
    d[i*4+1] = Math.round((g1 + m) * 255)
    d[i*4+2] = Math.round((b1 + m) * 255)
  }

  ctx.putImageData(id, 0, 0)
  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.95 })
}

// ── Background painting ───────────────────────────────────────────────────────
// Replaces background pixels (where rough mask alpha ≈ 0) with neutral gray.
// Pass-2 model then sees clear contrast between subject and background,
// resolving white-on-white failures where legs/fur blends into the surface.
async function paintBackground(originalFile: File, roughMask: Blob): Promise<Blob> {
  const [origBmp, maskBmp] = await Promise.all([
    createImageBitmap(originalFile),
    createImageBitmap(roughMask),
  ])
  const { width: w, height: h } = origBmp
  const n = w * h

  const origC = new OffscreenCanvas(w, h)
  const origCtx = origC.getContext('2d')!
  origCtx.drawImage(origBmp, 0, 0)
  const origPx = origCtx.getImageData(0, 0, w, h).data

  const maskC = new OffscreenCanvas(w, h)
  const maskCtx = maskC.getContext('2d')!
  maskCtx.drawImage(maskBmp, 0, 0, w, h)
  const maskPx = maskCtx.getImageData(0, 0, w, h).data

  const out = new OffscreenCanvas(w, h)
  const outCtx = out.getContext('2d')!
  const outId = outCtx.createImageData(w, h)
  const d = outId.data

  const BG = 120  // neutral gray — maximally distant from both white fur and coloured backgrounds

  for (let i = 0; i < n; i++) {
    const a = maskPx[i*4+3] / 255
    // Pixels with some alpha: blend toward gray so the model sees a soft
    // transition at the boundary rather than a hard paint line.
    const blend = Math.min(1, a * 2)   // fully original at alpha≥0.5, fully gray at alpha=0
    d[i*4]   = Math.round(origPx[i*4]   * blend + BG * (1 - blend))
    d[i*4+1] = Math.round(origPx[i*4+1] * blend + BG * (1 - blend))
    d[i*4+2] = Math.round(origPx[i*4+2] * blend + BG * (1 - blend))
    d[i*4+3] = 255
  }

  outCtx.putImageData(outId, 0, 0)
  return out.convertToBlob({ type: 'image/jpeg', quality: 0.95 })
}

export async function removeBackground(
  file: File,
  onProgress?: ProgressCallback
): Promise<Blob> {
  const { removeBackground: removeBg } = await import('@imgly/background-removal')

  if (!modelLoaded) {
    console.log('[bgremove] Loading AI model… (~40 MB, cached after first use)')
    modelLoaded = true
  }

  const makeOpts = (lo: number, hi: number) => ({
    model: 'medium' as const,
    output: { format: 'image/png' as const, quality: 1 },
    progress: (key: string, cur: number, tot: number) => {
      if (tot > 0) onProgress?.(key, lo + Math.round((cur / tot) * (hi - lo)), 100)
    },
  })

  // Pass 1 — rough mask on saturation-enhanced image (0–40%)
  // Saturation boost amplifies the subtle colour difference between cream fur
  // and white background so the model gets some signal in low-contrast areas.
  const enhanced = await enhanceForSegmentation(file)
  const rough1 = await removeBg(enhanced as ImageSource, makeOpts(0, 40))

  // Pass 2 — re-segment with background painted gray (40–85%)
  // Replaces the detected background with neutral gray, giving the model a
  // hard contrast edge.  Resolves white-on-white leg failures completely.
  const painted = await paintBackground(file, rough1)
  const rough2 = await removeBg(painted as ImageSource, makeOpts(40, 85))

  // Phase 3 — defringe: refine alpha + decontaminate (85–100%)
  // Enhanced image used as guided-filter guide for sharper colour edges.
  onProgress?.('Cleaning edges', 85, 100)
  const clean = await defringe(rough2, file, enhanced)
  onProgress?.('Done', 100, 100)
  return clean
}
