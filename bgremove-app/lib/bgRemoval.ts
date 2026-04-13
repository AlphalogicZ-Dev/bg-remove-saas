import type { ImageSource } from '@imgly/background-removal'

let modelLoaded = false

export type ProgressCallback = (stage: string, current: number, total: number) => void

/**
 * Removes the background from an image file using @imgly/background-removal.
 * This runs entirely in the browser via WebAssembly — no server calls needed.
 *
 * The first call downloads ~40MB of model weights from the CDN.
 * Subsequent calls use the browser cache — near-instant model load.
 *
 * @param file     - The image File object (JPG or PNG)
 * @param onProgress - Optional progress callback (stage, current, total)
 * @returns        - A Blob of the processed image in PNG format (transparent background)
 */
export async function removeBackground(
  file: File,
  onProgress?: ProgressCallback
): Promise<Blob> {
  // Dynamic import avoids SSR issues — this function only runs in the browser
  const { removeBackground: removeBg } = await import('@imgly/background-removal')

  if (!modelLoaded) {
    console.log('[ClearCut] Loading AI model... (~40MB, cached after first use)')
    modelLoaded = true
  }

  const result = await removeBg(file as ImageSource, {
    model: 'medium', // Options: 'small' (fastest), 'medium' (balanced), 'large' (best quality)
    output: {
      format: 'image/png',
      quality: 0.95,
    },
    progress: (key: string, current: number, total: number) => {
      onProgress?.(key, current, total)
    },
  })

  return result
}
