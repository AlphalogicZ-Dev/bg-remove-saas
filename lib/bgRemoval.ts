import { defringe } from './defringe'

export type ProgressCallback = (stage: string, current: number, total: number) => void

/**
 * Remove the background from `file` using the BiRefNet model via Replicate
 * (server-side API route), then apply the existing defringe refinement pass
 * client-side for clean alpha edges and colour decontamination.
 *
 * Progress stages:
 *   0–10%   uploading to API route
 *  10–85%   waiting for Replicate (BiRefNet inference)
 *  85–100%  defringe — guided-filter alpha refinement + decontamination
 */
export async function removeBackground(
  file: File,
  onProgress?: ProgressCallback
): Promise<Blob> {
  // ── 1. Upload image to our API route → Replicate BiRefNet ───────────────
  onProgress?.('Uploading', 5, 100)

  const fd = new FormData()
  fd.append('image', file)

  // Fake a smooth progress tick while we wait for the server (can take 20–60 s)
  let fakeProgress = 10
  const ticker = setInterval(() => {
    if (fakeProgress < 82) {
      fakeProgress += fakeProgress < 40 ? 3 : fakeProgress < 65 ? 2 : 1
      onProgress?.('Removing background (BiRefNet)', fakeProgress, 100)
    }
  }, 1_200)

  let maskBlob: Blob
  try {
    const res = await fetch('/api/remove-bg', { method: 'POST', body: fd })

    clearInterval(ticker)
    onProgress?.('Removing background (BiRefNet)', 85, 100)

    if (!res.ok) {
      let msg = `Server error ${res.status}`
      try { const d = await res.json(); msg = d.error ?? msg } catch {}
      throw new Error(msg)
    }

    maskBlob = await res.blob()
  } catch (err) {
    clearInterval(ticker)
    throw err
  }

  // ── 2. Defringe — guided-filter alpha refinement + colour decontamination
  // Identical to the previous pipeline: uses the original file's colours as
  // the guided-filter guide and background estimation source.
  onProgress?.('Cleaning edges', 88, 100)
  const clean = await defringe(maskBlob, file)
  onProgress?.('Done', 100, 100)

  return clean
}
