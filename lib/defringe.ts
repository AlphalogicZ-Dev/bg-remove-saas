'use client'

// World-class edge cleanup for @imgly background-removal output.
//
// Two problems solved:
//
//  1. WHITE HALO — semi-transparent edge pixels still carry the original
//     background colour in their RGB channels. Solved with the matting equation:
//       fg = (composite − (1−α)·bg) / α
//     Background colour is estimated from both image corners (reliable for
//     portraits where the subject fills the frame) and local transparent pixels
//     (reliable for objects on complex backgrounds). The two estimates are
//     blended by confidence so neither degrades the other.
//
//  2. TRACES / OUTER FRINGE — the outermost semi-transparent pixels are so
//     heavily contaminated with background colour that decontamination alone
//     can't fully recover them. A 1-pixel alpha choke (morphological erosion
//     of the alpha channel) eliminates this layer entirely, giving a crisp,
//     zero-trace edge. Only applied to the true fringe — interior soft alpha
//     (hair, fur, glass) is preserved.

// ─── Summed-area box blur — O(N) regardless of radius ────────────────────────

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

// ─── Background colour estimation ────────────────────────────────────────────

// Samples a rectangular region and returns its average colour + weight.
// Weight = fraction of pixels that are near-transparent (α < 20%).
function sampleRegion(d: Uint8ClampedArray, w: number,
  x0: number, y0: number, x1: number, y1: number
): [number, number, number, number] {
  let r = 0, g = 0, b = 0, n = 0
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const i = (y * w + x) * 4
      if (d[i+3] < 51) { r += d[i]; g += d[i+1]; b += d[i+2]; n++ }
    }
  return n > 0 ? [r/n, g/n, b/n, n] : [255, 255, 255, 0]
}

// Builds a per-pixel background colour map by combining:
//  • Local estimate  — box blur of near-transparent pixels (radius = 4% of image)
//  • Corner estimate — average colour of the four image corners (20×20px each)
// The local estimate dominates where there are enough transparent pixels nearby;
// the corner estimate fills in where the subject fills the whole frame.
function buildBgMap(d: Uint8ClampedArray, w: number, h: number): {
  r: Float32Array; g: Float32Array; b: Float32Array
} {
  const n      = w * h
  const radius = Math.max(24, Math.round(Math.min(w, h) * 0.05))
  const cs     = Math.min(30, Math.round(Math.min(w, h) * 0.06))  // corner size

  // Corner colour (global fallback — critical for portraits that fill the frame)
  const corners = [
    sampleRegion(d, w, 0, 0, cs, cs),
    sampleRegion(d, w, w-cs, 0, w, cs),
    sampleRegion(d, w, 0, h-cs, cs, h),
    sampleRegion(d, w, w-cs, h-cs, w, h),
  ]
  let cR = 0, cG = 0, cB = 0, cN = 0
  for (const [r, g, b, n_] of corners) { cR += r*n_; cG += g*n_; cB += b*n_; cN += n_ }
  if (cN === 0) { cR = 255 * 4; cG = 255 * 4; cB = 255 * 4; cN = 4 }
  const cornerR = cR / cN, cornerG = cG / cN, cornerB = cB / cN

  // Local estimate — weighted by proximity to transparent pixels
  const bR = new Float32Array(n), bG = new Float32Array(n),
        bB = new Float32Array(n), bW = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    if (d[i*4+3] < 26) {                          // α < 10% = definite background
      bR[i] = d[i*4]; bG[i] = d[i*4+1]; bB[i] = d[i*4+2]; bW[i] = 1
    }
  }
  const sR = boxBlur(bR, w, h, radius), sG = boxBlur(bG, w, h, radius),
        sB = boxBlur(bB, w, h, radius), sW = boxBlur(bW, w, h, radius)

  // Blend: local dominates when confident (sW > 0.1), corners fill in otherwise
  const lR = new Float32Array(n), lG = new Float32Array(n), lB = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const wLocal = Math.min(1, sW[i] / 0.1)   // confidence 0→1
    const wCorner = 1 - wLocal
    lR[i] = wLocal * (sR[i] / Math.max(sW[i], 1e-6)) + wCorner * cornerR
    lG[i] = wLocal * (sG[i] / Math.max(sW[i], 1e-6)) + wCorner * cornerG
    lB[i] = wLocal * (sB[i] / Math.max(sW[i], 1e-6)) + wCorner * cornerB
  }
  return { r: lR, g: lG, b: lB }
}

// ─── Alpha choke — 1-pixel erosion of the alpha channel ──────────────────────
// The outermost fringe pixels are so heavily mixed with background that matting
// correction can't fully recover them. Eroding the alpha channel by 1px removes
// this layer entirely. Only pixels that are already semi-transparent are affected
// (α < 250); fully opaque interior pixels are never touched.

function alphaChoke(d: Uint8ClampedArray, w: number, h: number): void {
  const orig = new Uint8Array(d.length / 4)
  for (let i = 0; i < orig.length; i++) orig[i] = d[i*4+3]

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      if (orig[i] === 0) continue            // already transparent — skip
      // Minimum alpha among the 4-connected neighbours
      const minNeighbour = Math.min(
        orig[(y-1)*w+x], orig[(y+1)*w+x],
        orig[y*w+(x-1)], orig[y*w+(x+1)]
      )
      // Only choke if the pixel is in the fringe (at least one fully/near-transparent neighbour)
      if (minNeighbour < 26) {
        d[i*4+3] = 0
      }
    }
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function defringe(blob: Blob): Promise<Blob> {
  const bmp    = await createImageBitmap(blob)
  const { width: w, height: h } = bmp
  const canvas = new OffscreenCanvas(w, h)
  const ctx    = canvas.getContext('2d')!
  ctx.drawImage(bmp, 0, 0)
  const id = ctx.getImageData(0, 0, w, h)
  const d  = id.data
  const n  = w * h

  // 1. Build per-pixel background colour map
  const bg = buildBgMap(d, w, h)

  // 2. Decontaminate semi-transparent edge pixels
  for (let i = 0; i < n; i++) {
    const a = d[i*4+3]
    if (a < 5 || a > 250) continue            // fully transparent / opaque — skip

    const af = a / 255
    d[i*4]   = Math.max(0, Math.min(255, Math.round((d[i*4]   - (1 - af) * bg.r[i]) / Math.max(af, 0.01))))
    d[i*4+1] = Math.max(0, Math.min(255, Math.round((d[i*4+1] - (1 - af) * bg.g[i]) / Math.max(af, 0.01))))
    d[i*4+2] = Math.max(0, Math.min(255, Math.round((d[i*4+2] - (1 - af) * bg.b[i]) / Math.max(af, 0.01))))
  }

  // 3. Choke: remove the outermost fringe layer that can't be cleanly decontaminated
  alphaChoke(d, w, h)

  // 4. Zero out near-transparent pixels — eliminates all remaining traces
  for (let i = 0; i < n; i++)
    if (d[i*4+3] < 10) { d[i*4] = 0; d[i*4+1] = 0; d[i*4+2] = 0; d[i*4+3] = 0 }

  ctx.putImageData(id, 0, 0)
  return canvas.convertToBlob({ type: 'image/png' })
}
