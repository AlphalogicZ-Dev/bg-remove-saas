'use client'

// ─── Why the previous approach failed ────────────────────────────────────────
//
// Bug 1 — premultiplied alpha zeroes transparent RGB
//   Canvas getImageData returns PREMULTIPLIED values.  When alpha = 0, the
//   browser stores rgba(0,0,0,0) regardless of the original colour.  Reading
//   "background colour" from transparent pixels always returned black, so
//   decontamination was subtracting black = doing nothing, or making things worse.
//
// Bug 2 — wrong matting formula for premultiplied data
//   The correct formula in STRAIGHT-alpha space is:
//     fg = (composite − (1−α)·bg) / α
//   But canvas stores PREMULTIPLIED composite (pm = composite · α).
//   The correct formula for premultiplied canvas data is:
//     pm_fg = pm · 255/α  −  (1−α) · bg
//   Using the straight-alpha formula on premultiplied data amplifies the
//   contamination instead of removing it.
//
// Fix — read background from the ORIGINAL FILE
//   The original photo is fully opaque everywhere (alpha=255 for every pixel),
//   so premultiplication has zero effect.  We use @imgly's alpha channel as a
//   mask: wherever alpha < threshold the pixel WAS background in the original —
//   so we sample the original file at those positions to get the true bg colour.
//   This gives a perfect local background estimate with no premul artefacts.

// ─── Utilities ────────────────────────────────────────────────────────────────

async function toImageData(src: Blob | File, w: number, h: number): Promise<ImageData> {
  const bmp    = await createImageBitmap(src)
  const canvas = new OffscreenCanvas(w, h)
  const ctx    = canvas.getContext('2d')!
  ctx.drawImage(bmp, 0, 0, w, h)
  return ctx.getImageData(0, 0, w, h)
}

// O(N) box blur via summed-area table — radius has zero effect on performance
function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const sw  = w + 1
  const sat = new Float64Array(sw * (h + 1))
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      sat[(y+1)*sw+(x+1)] = src[y*w+x] + sat[y*sw+(x+1)] + sat[(y+1)*sw+x] - sat[y*sw+x]
  const out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    const y1 = Math.max(0, y-r), y2 = Math.min(h-1, y+r)
    for (let x = 0; x < w; x++) {
      const x1 = Math.max(0, x-r), x2 = Math.min(w-1, x+r)
      out[y*w+x] = (
        sat[(y2+1)*sw+(x2+1)] - sat[y1*sw+(x2+1)] -
        sat[(y2+1)*sw+x1]     + sat[y1*sw+x1]
      ) / ((x2-x1+1) * (y2-y1+1))
    }
  }
  return out
}

// ─── Background colour map ────────────────────────────────────────────────────
//
// Samples the ORIGINAL image at positions where @imgly says the pixel is
// transparent (alpha < threshold).  Because the original is fully opaque,
// canvas premultiplication doesn't alter those RGB values (pm = r · 255/255 = r).
// Box-blur the samples to get a smooth per-pixel background colour everywhere.

function buildBgMap(
  origPx: Uint8ClampedArray,     // original image pixels (fully opaque — no premul issue)
  maskPx: Uint8ClampedArray,     // @imgly output (premultiplied, alpha is the mask)
  w: number, h: number
): { r: Float32Array; g: Float32Array; b: Float32Array } {
  const n      = w * h
  const radius = Math.max(24, Math.round(Math.min(w, h) * 0.05))

  const bR = new Float32Array(n), bG = new Float32Array(n),
        bB = new Float32Array(n), bW = new Float32Array(n)

  for (let i = 0; i < n; i++) {
    const a = maskPx[i*4+3]
    if (a < 26) {                             // @imgly says ≤10% alpha = background
      const w_ = 1 - a / 255                 // near-zero alpha = high confidence bg
      bR[i] = origPx[i*4]   * w_             // original file has true bg colour
      bG[i] = origPx[i*4+1] * w_
      bB[i] = origPx[i*4+2] * w_
      bW[i] = w_
    }
  }

  const sR = boxBlur(bR, w, h, radius), sG = boxBlur(bG, w, h, radius),
        sB = boxBlur(bB, w, h, radius), sW = boxBlur(bW, w, h, radius)

  const lR = new Float32Array(n), lG = new Float32Array(n), lB = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    if (sW[i] > 1e-4) {
      lR[i] = sR[i] / sW[i]
      lG[i] = sG[i] / sW[i]
      lB[i] = sB[i] / sW[i]
    }
  }
  return { r: lR, g: lG, b: lB }
}

// ─── Foreground decontamination — correct premultiplied formula ───────────────
//
// Canvas stores premultiplied composite:  pm = composite · α/255
// Matting equation in straight-alpha space:  fg = (composite − (1−α)·bg) / α
// Substituting composite = pm · 255/α:
//   pm_fg = fg · α/255 = composite − (1−α)·bg = pm·255/α − (1−α)·bg
//
// This is stored back as the new premultiplied foreground value.

function decontaminatePx(
  d: Uint8ClampedArray,
  bg: { r: Float32Array; g: Float32Array; b: Float32Array },
  n: number
): void {
  for (let i = 0; i < n; i++) {
    const a = d[i*4+3]
    if (a < 6 || a > 250) continue           // skip fully transparent / opaque
    if (bg.r[i] === 0 && bg.g[i] === 0 && bg.b[i] === 0) continue  // no bg sample

    const inv = 255.0 / a                    // 255/alpha — converts pm → straight
    const af  = a / 255.0                    // alpha fraction

    // Correct premultiplied decontamination:  pm_fg = pm·255/α − (1−α)·bg
    d[i*4]   = Math.max(0, Math.min(255, Math.round(d[i*4]   * inv - (1-af) * bg.r[i])))
    d[i*4+1] = Math.max(0, Math.min(255, Math.round(d[i*4+1] * inv - (1-af) * bg.g[i])))
    d[i*4+2] = Math.max(0, Math.min(255, Math.round(d[i*4+2] * inv - (1-af) * bg.b[i])))
    // alpha unchanged — we only fix the colour, not the mask
  }
}

// ─── Alpha choke — removes the outermost contaminated fringe ─────────────────
//
// The very outermost semi-transparent pixels are so heavily mixed with
// background that even correct decontamination leaves a faint cast.
// A 1-pixel choke zeros any pixel that borders a near-transparent pixel,
// cleanly removing this layer.  Interior soft-alpha (hair strands, fur)
// is untouched because all its neighbours are opaque.

function alphaChoke(d: Uint8ClampedArray, w: number, h: number): void {
  const alpha = new Uint8Array(w * h)
  for (let i = 0; i < w*h; i++) alpha[i] = d[i*4+3]

  for (let y = 1; y < h-1; y++) {
    for (let x = 1; x < w-1; x++) {
      const i = y*w+x
      if (alpha[i] === 0) continue
      const minN = Math.min(
        alpha[(y-1)*w+x], alpha[(y+1)*w+x],
        alpha[y*w+(x-1)], alpha[y*w+(x+1)]
      )
      if (minN < 26) {
        d[i*4] = 0; d[i*4+1] = 0; d[i*4+2] = 0; d[i*4+3] = 0
      }
    }
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function defringe(blob: Blob, originalFile?: File): Promise<Blob> {
  const bmp            = await createImageBitmap(blob)
  const { width: w, height: h } = bmp
  const n              = w * h

  // @imgly output — premultiplied alpha in canvas
  const maskCanvas = new OffscreenCanvas(w, h)
  const maskCtx    = maskCanvas.getContext('2d')!
  maskCtx.drawImage(bmp, 0, 0)
  const maskId = maskCtx.getImageData(0, 0, w, h)
  const d      = maskId.data

  // Background colour map — from original file when available, else fall back
  // to near-transparent pixel estimation (less accurate but still better than before)
  let bg: { r: Float32Array; g: Float32Array; b: Float32Array }

  if (originalFile) {
    // PREFERRED PATH: read bg from original (fully opaque — no premul corruption)
    const origId = await toImageData(originalFile, w, h)
    bg = buildBgMap(origId.data, d, w, h)
  } else {
    // FALLBACK PATH: estimate bg from near-transparent pixels using unmultiplied approx
    // pm = composite·α, so composite ≈ bg for small α → bg ≈ pm·255/α
    const radius = Math.max(24, Math.round(Math.min(w, h) * 0.05))
    const bR = new Float32Array(n), bG = new Float32Array(n),
          bB = new Float32Array(n), bW = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const a = d[i*4+3]
      if (a >= 6 && a <= 64) {               // 2–25% alpha: dominated by background
        const inv = 255.0 / a
        const w_  = (1 - a/255) ** 2
        bR[i] = Math.min(255, d[i*4]   * inv) * w_
        bG[i] = Math.min(255, d[i*4+1] * inv) * w_
        bB[i] = Math.min(255, d[i*4+2] * inv) * w_
        bW[i] = w_
      }
    }
    const sR = boxBlur(bR, w, h, radius), sG = boxBlur(bG, w, h, radius),
          sB = boxBlur(bB, w, h, radius), sW = boxBlur(bW, w, h, radius)
    const lR = new Float32Array(n), lG = new Float32Array(n), lB = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      if (sW[i] > 1e-4) { lR[i] = sR[i]/sW[i]; lG[i] = sG[i]/sW[i]; lB[i] = sB[i]/sW[i] }
    }
    bg = { r: lR, g: lG, b: lB }
  }

  // 1. Decontaminate edge pixels using correct premultiplied formula
  decontaminatePx(d, bg, n)

  // 2. Choke: zero the outermost fringe that can't be cleanly recovered
  alphaChoke(d, w, h)

  // 3. Zero all near-transparent remnants — no traces left anywhere
  for (let i = 0; i < n; i++)
    if (d[i*4+3] < 10) { d[i*4] = 0; d[i*4+1] = 0; d[i*4+2] = 0; d[i*4+3] = 0 }

  maskCtx.putImageData(maskId, 0, 0)
  return maskCanvas.convertToBlob({ type: 'image/png' })
}
