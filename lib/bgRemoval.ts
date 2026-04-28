import type { ImageSource } from '@imgly/background-removal'
import { defringe } from './defringe'

let modelLoaded = false

export type ProgressCallback = (stage: string, current: number, total: number) => void

export async function removeBackground(
  file: File,
  onProgress?: ProgressCallback
): Promise<Blob> {
  const { removeBackground: removeBg } = await import('@imgly/background-removal')

  if (!modelLoaded) {
    console.log('[bgremove] Loading AI model… (~40 MB, cached after first use)')
    modelLoaded = true
  }

  // Phase 1 — model inference (0–90%)
  const rough = await removeBg(file as ImageSource, {
    model: 'medium',
    output: { format: 'image/png', quality: 1 },
    progress: (key: string, current: number, total: number) => {
      if (total > 0) onProgress?.(key, Math.round((current / total) * 90), 100)
    },
  })

  // Phase 2 — defringe: removes white halo from semi-transparent edge pixels (90–100%)
  onProgress?.('Cleaning edges', 90, 100)
  const clean = await defringe(rough, file)   // pass original so bg colour is read from true pixels
  onProgress?.('Done', 100, 100)
  return clean
}
