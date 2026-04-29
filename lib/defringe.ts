'use client'

// ── Premium alpha matting pipeline ────────────────────────────────────────────
//
// Stage 1 — @imgly gives a rough segmentation mask (not a true alpha matte)
// Stage 2 — Guided filter (He et al. 2010) refines alpha using the original
//            image's luminance as structural guide.  It snaps alpha to real
//            image edges, preserving hair/fur while cleaning solid boundaries.
// Stage 3 — Background colour decontamination removes colour spill from the
//            foreground using the correct premultiplied matting formula.
// Stage 4 — Hard cleanup: zero any sub-threshold remnants.
//
// Why the alpha choke was removed:
//   It zeroed pixels neighbouring transparent ones — which is every hair
//   strand and every fur pixel.  The guided filter achieves the same "clean
//   boundary" goal without destroying fine details.

// ── O(N) box blur via summed-area table ──────────────────────────────────────

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

// ── Guided filter — edge-preserving alpha refinement ─────────────────────────
//
// Uses the original image's luminance as structural guidance so the output
// alpha snaps to real image edges.  At a clear fur edge, strong luminance
// gradient → filter preserves the alpha transition precisely.  At a soft
// hair strand, luminance guide has the strand's structure → each strand
// keeps its own alpha.  All box-blur passes are O(N) regardless of radius.
//
// Parameters:
//   guide — luminance of the original image [0,1], n = w*h
//   alpha — rough model alpha [0,1]
//   r     — window radius in pixels (larger = smoother, loses fine detail)
//   eps   — regularisation: 1e-3 = strong edge preservation, 0.1 = smooth

function guidedFilter(
  guide: Float32Array,
  alpha: Float32Array,
  w: number, h: number,
  r: number,
  eps: number
): Float32Array {
  const n   = w * h
  const II  = new Float32Array(n)
  const Ip  = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    II[i] = guide[i] * guide[i]
    Ip[i] = guide[i] * alpha[i]
  }

  const mI  = boxBlur(guide, w, h, r)
  const mp  = boxBlur(alpha, w, h, r)
  const mII = boxBlur(II,    w, h, r)
  const mIp = boxBlur(Ip,    w, h, r)

  const a = new Float32Array(n)
  const b = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const varI  = mII[i] - mI[i] * mI[i]
    const covIp = mIp[i] - mI[i] * mp[i]
    a[i] = covIp / (varI + eps)
    b[i] = mp[i] - a[i] * mI[i]
  }

  const ma = boxBlur(a, w, h, r)
  const mb = boxBlur(b, w, h, r)

  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    out[i] = Math.max(0, Math.min(1, ma[i] * guide[i] + mb[i]))
  }
  return out
}

// ── Background colour map ────────────────────────────────────────────────────
//
// Samples the original image where the model says alpha < 15% — those pixels
// are confidently background.  Box-blur spreads the sample across the whole
// canvas so every edge pixel gets a local background estimate.  Using the
// original (fully opaque) file avoids premultiplied-alpha corruption entirely.

function buildBgMap(
  origPx: Uint8ClampedArray,
  roughAlpha: Float32Array,
  w: number, h: number
): { r: Float32Array; g: Float32Array; b: Float32Array } {
  const n      = w * h
  const radius = Math.max(28, Math.round(Math.min(w, h) * 0.06))

  const bR = new Float32Array(n), bG = new Float32Array(n),
        bB = new Float32Array(n), bW = new Float32Array(n)

  for (let i = 0; i < n; i++) {
    const a = roughAlpha[i]
    if (a < 0.15) {
      const w_ = (1 - a) ** 2          // near-zero alpha = high confidence background
      bR[i] = origPx[i*4]   * w_       // original has true, uncontaminated bg colour
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

// ── Colour decontamination ────────────────────────────────────────────────────
//
// Canvas stores premultiplied RGBA: pm_rgb = straight_rgb · (α/255).
// Matting equation (straight-alpha space):
//   fg = (composite − (1−α)·bg) / α
// In premultiplied space (pm = composite·α, so composite = pm·255/α):
//   pm_fg = fg·(α/255) = composite − (1−α)·bg = pm·(255/α) − (1−α)·bg
//
// This removes white halo (bg = white) and dark fringe (bg = dark) by
// subtracting the exact background contribution from every edge pixel.

function decontaminate(
  d: Uint8ClampedArray,
  bg: { r: Float32Array; g: Float32Array; b: Float32Array },
  n: number
): void {
  for (let i = 0; i < n; i++) {
    const a = d[i*4+3]
    if (a < 8 || a > 248) continue          // skip fully transparent/opaque
    if (bg.r[i] === 0 && bg.g[i] === 0 && bg.b[i] === 0) continue

    const af  = a / 255.0
    const inv = 255.0 / a

    d[i*4]   = Math.max(0, Math.min(255, Math.round(d[i*4]   * inv - (1 - af) * bg.r[i])))
    d[i*4+1] = Math.max(0, Math.min(255, Math.round(d[i*4+1] * inv - (1 - af) * bg.g[i])))
    d[i*4+2] = Math.max(0, Math.min(255, Math.round(d[i*4+2] * inv - (1 - af) * bg.b[i])))
    // alpha stays — colour correction only
  }
}

// ── Apply guided-filter refined alpha to premultiplied pixel data ─────────────
//
// When alpha changes from oldA → newA, the premultiplied RGB must scale
// proportionally because straight RGB (the actual foreground colour) is fixed.
// pm_new = straight · (newA/255) = pm_old · (newA/oldA)

function applyRefinedAlpha(
  d: Uint8ClampedArray,
  refined: Float32Array,
  n: number
): void {
  for (let i = 0; i < n; i++) {
    const newA = Math.round(refined[i] * 255)
    const oldA = d[i*4+3]
    if (newA === oldA) continue

    if (oldA > 0 && newA > 0) {
      const scale = newA / oldA
      d[i*4]   = Math.min(255, Math.round(d[i*4]   * scale))
      d[i*4+1] = Math.min(255, Math.round(d[i*4+1] * scale))
      d[i*4+2] = Math.min(255, Math.round(d[i*4+2] * scale))
    } else if (newA === 0) {
      d[i*4] = 0; d[i*4+1] = 0; d[i*4+2] = 0
    }
    d[i*4+3] = newA
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function defringe(blob: Blob, originalFile?: File): Promise<Blob> {
  const bmp            = await createImageBitmap(blob)
  const { width: w, height: h } = bmp
  const n              = w * h

  const maskCanvas = new OffscreenCanvas(w, h)
  const maskCtx    = maskCanvas.getContext('2d')!
  maskCtx.drawImage(bmp, 0, 0)
  const maskId = maskCtx.getImageData(0, 0, w, h)
  const d      = maskId.data

  // Rough alpha from model output [0,1]
  const roughAlpha = new Float32Array(n)
  for (let i = 0; i < n; i++) roughAlpha[i] = d[i*4+3] / 255.0

  if (originalFile) {
    // ── Decode original image at mask resolution ──────────────────────────────
    const origBmp = await createImageBitmap(originalFile)
    const origC   = new OffscreenCanvas(w, h)
    const origCtx = origC.getContext('2d')!
    origCtx.drawImage(origBmp, 0, 0, w, h)
    const origId  = origCtx.getImageData(0, 0, w, h)
    const origPx  = origId.data

    // ── Luminance guide for guided filter ─────────────────────────────────────
    const lum = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      lum[i] = (0.2126 * origPx[i*4] + 0.7152 * origPx[i*4+1] + 0.0722 * origPx[i*4+2]) / 255.0
    }

    // ── Guided filter — radius ~0.8% of short side, ε=1e-3 ───────────────────
    // Radius of 0.8% of image size = ~8px at 1000px, ~16px at 2000px.
    // This is small enough to resolve individual hair strands yet large enough
    // to smooth jagged segmentation edges.  ε=1e-3 = strong edge preservation.
    const gfR     = Math.max(5, Math.round(Math.min(w, h) * 0.008))
    const refined = guidedFilter(lum, roughAlpha, w, h, gfR, 1e-3)

    // ── Apply refined alpha (rescales premultiplied RGB accordingly) ──────────
    applyRefinedAlpha(d, refined, n)

    // ── Background map + decontamination ─────────────────────────────────────
    const bg = buildBgMap(origPx, roughAlpha, w, h)
    decontaminate(d, bg, n)

  } else {
    // No original file — decontaminate with fallback bg estimation only
    // (less accurate but still removes worst colour spill)
    const radius = Math.max(28, Math.round(Math.min(w, h) * 0.06))
    const bR = new Float32Array(n), bG = new Float32Array(n),
          bB = new Float32Array(n), bW = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const a = d[i*4+3]
      if (a >= 6 && a <= 60) {
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
    decontaminate(d, { r: lR, g: lG, b: lB }, n)
  }

  // ── Final cleanup — zero all sub-threshold remnants ───────────────────────
  for (let i = 0; i < n; i++) {
    if (d[i*4+3] < 8) {
      d[i*4] = 0; d[i*4+1] = 0; d[i*4+2] = 0; d[i*4+3] = 0
    }
  }

  maskCtx.putImageData(maskId, 0, 0)
  return maskCanvas.convertToBlob({ type: 'image/png' })
}
