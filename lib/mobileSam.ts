'use client'

// MobileSAM inference — loads lazily on first use (~40 MB model, cached by browser)
//
// The @huggingface/transformers ESM build is served as a static file from
// /public/lib/transformers.web.min.js and loaded at runtime via a
// /* webpackIgnore: true */ dynamic import so webpack never tries to bundle it
// (it contains WASM references that are incompatible with webpack bundling).

export type ClickPrompt = {
  x: number      // pixel coordinate in original image space
  y: number
  add: boolean   // true = include foreground (label 1), false = exclude (label 0)
}

export type SamResult = {
  mask: Uint8Array   // binary: 255 = inside, 0 = outside, length = w * h
  width: number
  height: number
  score: number
}

// ── Load the Transformers.js browser ESM build ────────────────────────────────
// webpackIgnore keeps this import out of the webpack graph entirely.

async function loadTransformers() {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — webpack does not see this import; types from installed package
  return import(/* webpackIgnore: true */ '/lib/transformers.web.min.js') as Promise<typeof import('@huggingface/transformers')>
}

// ── Model singleton ───────────────────────────────────────────────────────────

type ModelHandle = { model: unknown; processor: unknown }
let modelHandle: ModelHandle | null = null
let modelLoadPromise: Promise<ModelHandle> | null = null

export async function loadSam(onProgress?: (stage: string) => void): Promise<void> {
  if (modelHandle) return
  if (!modelLoadPromise) {
    modelLoadPromise = (async (): Promise<ModelHandle> => {
      onProgress?.('Downloading AI selection model (~40 MB, cached after first use)…')
      const { SamModel, AutoProcessor } = await loadTransformers()
      const [model, processor] = await Promise.all([
        (SamModel as any).from_pretrained('Xenova/mobile-sam', { dtype: 'fp32' }),
        (AutoProcessor as any).from_pretrained('Xenova/mobile-sam'),
      ])
      onProgress?.('Model ready')
      return { model, processor }
    })()
  }
  modelHandle = await modelLoadPromise
}

export function isSamLoaded(): boolean {
  return modelHandle !== null
}

// ── Main inference call ───────────────────────────────────────────────────────

export async function segmentWithClicks(
  imageBlob: Blob,
  cacheKey: string,
  clicks: ClickPrompt[]
): Promise<SamResult> {
  if (!modelHandle) throw new Error('SAM not loaded — call loadSam() first')
  if (clicks.length === 0) throw new Error('At least one click required')

  const { RawImage } = await loadTransformers()
  const { model, processor } = modelHandle

  const url = URL.createObjectURL(imageBlob)
  let image: unknown
  try {
    image = await (RawImage as any).fromURL(url)
  } finally {
    URL.revokeObjectURL(url)
  }

  const points = clicks.map(c => [c.x, c.y])
  const labels = clicks.map(c => (c.add ? 1 : 0))

  const inputs = await (processor as any)(image, {
    input_points: [points],
    input_labels: [labels],
  })

  const outputs = await (model as any)(inputs)

  // Pick highest-IoU mask from the 3 candidates SAM always returns
  const ious = Array.from(outputs.iou_scores.data as Float32Array)
  const bestIdx = ious.indexOf(Math.max(...ious))

  const masks = await (processor as any).post_process_masks(
    outputs.pred_masks,
    inputs.original_sizes,
    inputs.reshaped_input_sizes
  )

  // masks[0][0] = Tensor shape [3, H, W], data = Uint8Array (0 or 1)
  const maskTensor = masks[0][0]
  const H: number = maskTensor.dims[1]
  const W: number = maskTensor.dims[2]
  const rawData = maskTensor.data as Uint8Array

  const result = new Uint8Array(H * W)
  const offset = bestIdx * H * W
  for (let i = 0; i < H * W; i++) {
    result[i] = rawData[offset + i] ? 255 : 0
  }

  return { mask: result, width: W, height: H, score: ious[bestIdx] }
}

export function clearEmbeddingCache(): void {
  // reserved for future embedding-cache optimisation
}
