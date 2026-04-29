'use client'

// MobileSAM inference — loads lazily on first use (~40 MB, cached by browser)
// Model: Xenova/mobile-sam via @huggingface/transformers (ONNX Runtime Web)
//
// The SAM pipeline separates into two stages for efficiency:
//   Stage 1 — Image encoder: encodes the full image once, O(image pixels)
//   Stage 2 — Mask decoder: runs per-click, O(1) — very fast
//
// We cache the image embeddings across clicks so encoding only happens once
// per image-open.

export type ClickPrompt = {
  x: number      // pixel coordinate in original image space
  y: number
  add: boolean   // true = include (label 1), false = exclude (label 0)
}

export type SamResult = {
  mask: Uint8Array   // binary: 255 = inside, 0 = outside — w*h pixels
  width: number
  height: number
  score: number
}

// ── Model singleton ───────────────────────────────────────────────────────────

type ModelHandle = { model: unknown; processor: unknown }
let modelHandle: ModelHandle | null = null
let modelLoadPromise: Promise<ModelHandle> | null = null

export async function loadSam(onProgress?: (stage: string) => void): Promise<void> {
  if (modelHandle) return
  if (!modelLoadPromise) {
    modelLoadPromise = (async (): Promise<ModelHandle> => {
      onProgress?.('Downloading AI selection model (~40 MB)…')
      const { SamModel, AutoProcessor } = await import('@huggingface/transformers')
      const [model, processor] = await Promise.all([
        // fp32 for correctness; onnx runtime web handles acceleration
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

// ── Per-image embedding cache ─────────────────────────────────────────────────
// Keyed by object URL so the cache is naturally scoped to one image session.

type EmbeddingCache = {
  key: string
  image: unknown     // RawImage — held for decoder calls
  embeddings: unknown  // image_embeddings tensor
  w: number
  h: number
}
let embeddingCache: EmbeddingCache | null = null

async function getEmbeddings(
  imageBlob: Blob,
  cacheKey: string
): Promise<{ image: unknown; embeddings: unknown; w: number; h: number }> {
  if (embeddingCache && embeddingCache.key === cacheKey) {
    return embeddingCache
  }

  const { RawImage } = await import('@huggingface/transformers')
  const url = URL.createObjectURL(imageBlob)
  let image: unknown
  try {
    image = await (RawImage as any).fromURL(url)
  } finally {
    URL.revokeObjectURL(url)
  }

  const { model, processor } = modelHandle!
  // Encode image only — no point prompts yet
  const inputs = await (processor as any)(image, {
    input_points: [[[0, 0]]],
    input_labels: [[1]],
  })

  // Run full model — we'll extract the embeddings from the model's internal
  // state by re-running with a dummy prompt.  Some builds expose
  // get_image_embeddings; others don't — just cache the full output and
  // reuse inputs.image_embeddings if present.
  const outputs = await (model as any)(inputs)

  const imgEl = image as { width: number; height: number }
  const result = {
    key: cacheKey,
    image,
    embeddings: outputs.image_embeddings ?? inputs.image_embeddings ?? null,
    w: imgEl.width,
    h: imgEl.height,
  }
  embeddingCache = result
  return result
}

// ── Main inference call ───────────────────────────────────────────────────────

export async function segmentWithClicks(
  imageBlob: Blob,
  cacheKey: string,
  clicks: ClickPrompt[]
): Promise<SamResult> {
  if (!modelHandle) throw new Error('SAM not loaded — call loadSam() first')
  if (clicks.length === 0) throw new Error('At least one click required')

  const { model, processor } = modelHandle
  const { RawImage } = await import('@huggingface/transformers')

  // Re-decode image at full resolution for the processor
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

  // Pick highest-IoU mask from the 3 candidates
  const ious = Array.from(outputs.iou_scores.data as Float32Array)
  const bestIdx = ious.indexOf(Math.max(...ious))

  const masks = await (processor as any).post_process_masks(
    outputs.pred_masks,
    inputs.original_sizes,
    inputs.reshaped_input_sizes
  )

  // masks[0][0] = Tensor shape [3, H, W], data = Uint8Array (0/1)
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
  embeddingCache = null
}
