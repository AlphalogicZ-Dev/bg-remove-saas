'use client'

// Removes the white matting halo from @imgly background-removal output.
//
// The model outputs semi-transparent edge pixels whose RGB channels still
// contain the original background colour (e.g. white carpet). On any
// non-white canvas those pixels appear as a bright ghost outline.
//
// Fix: solve the matting equation per edge pixel —
//   composite = α·fg + (1−α)·bg  →  fg = (composite − (1−α)·bg) / α
//
// Background colour is estimated locally by box-blurring the colour of
// fully-transparent pixels. All operations are O(N) — no loops per pixel.

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

export async function defringe(blob: Blob): Promise<Blob> {
  const bmp    = await createImageBitmap(blob)
  const { width: w, height: h } = bmp
  const canvas = new OffscreenCanvas(w, h)
  const ctx    = canvas.getContext('2d')!
  ctx.drawImage(bmp, 0, 0)
  const id = ctx.getImageData(0, 0, w, h)
  const d  = id.data
  const n  = w * h

  // Collect background colour signal from fully-transparent pixels only
  const radius = Math.max(20, Math.round(Math.min(w, h) * 0.04))
  const bR = new Float32Array(n), bG = new Float32Array(n),
        bB = new Float32Array(n), bW = new Float32Array(n)

  for (let i = 0; i < n; i++) {
    if (d[i*4+3] < 13) {                         // alpha < 5% = definite background
      bR[i] = d[i*4]; bG[i] = d[i*4+1]; bB[i] = d[i*4+2]; bW[i] = 1
    }
  }

  const sR = boxBlur(bR, w, h, radius), sG = boxBlur(bG, w, h, radius),
        sB = boxBlur(bB, w, h, radius), sW = boxBlur(bW, w, h, radius)

  // Decontaminate each semi-transparent edge pixel
  for (let i = 0; i < n; i++) {
    const a = d[i*4+3]
    if (a === 0 || a === 255) continue            // fully transparent / opaque — skip
    if (sW[i] < 1e-4)        continue            // no nearby background sample — skip

    const af = a / 255
    const bgR = sR[i] / sW[i], bgG = sG[i] / sW[i], bgB = sB[i] / sW[i]

    d[i*4]   = Math.max(0, Math.min(255, Math.round((d[i*4]   - (1 - af) * bgR) / Math.max(af, 0.01))))
    d[i*4+1] = Math.max(0, Math.min(255, Math.round((d[i*4+1] - (1 - af) * bgG) / Math.max(af, 0.01))))
    d[i*4+2] = Math.max(0, Math.min(255, Math.round((d[i*4+2] - (1 - af) * bgB) / Math.max(af, 0.01))))
  }

  ctx.putImageData(id, 0, 0)
  return canvas.convertToBlob({ type: 'image/png' })
}
