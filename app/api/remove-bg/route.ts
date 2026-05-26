import { NextRequest, NextResponse } from 'next/server'

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN
const MODEL = 'extrapolate/birefnet'
const PREDICTIONS_URL = `https://api.replicate.com/v1/models/${MODEL}/predictions`

// Replicate free-tier cold starts can take 30–60 s; paid is faster.
// We poll for up to 3 minutes total.
const POLL_INTERVAL_MS = 1_500
const POLL_TIMEOUT_MS  = 180_000
const MAX_FILE_BYTES   = 10 * 1024 * 1024   // 10 MB safety cap

export async function POST(req: NextRequest) {
  if (!REPLICATE_API_TOKEN) {
    return NextResponse.json(
      { error: 'REPLICATE_API_TOKEN is not set' },
      { status: 500 }
    )
  }

  // ── 1. Parse the uploaded image ──────────────────────────────────────────
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const imageFile = formData.get('image') as File | null
  if (!imageFile) {
    return NextResponse.json({ error: 'Missing "image" field' }, { status: 400 })
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(imageFile.type)) {
    return NextResponse.json({ error: 'Unsupported image type' }, { status: 400 })
  }
  if (imageFile.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'Image exceeds 10 MB limit' }, { status: 413 })
  }

  // Convert to base64 data URI — Replicate accepts data URIs directly
  const arrayBuf = await imageFile.arrayBuffer()
  const base64   = Buffer.from(arrayBuf).toString('base64')
  const dataUri  = `data:${imageFile.type};base64,${base64}`

  // ── 2. Create prediction ─────────────────────────────────────────────────
  let predictionId: string
  try {
    const createRes = await fetch(PREDICTIONS_URL, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
        // Ask Replicate to wait up to 60 s before returning a URL to poll
        Prefer: 'wait=60',
      },
      body: JSON.stringify({
        input: { image: dataUri },
      }),
    })

    if (!createRes.ok) {
      const errBody = await createRes.text().catch(() => '')
      console.error('[remove-bg] Replicate create error', createRes.status, errBody)
      return NextResponse.json(
        { error: `Replicate error: ${createRes.status}` },
        { status: 502 }
      )
    }

    const prediction = await createRes.json()

    // If Prefer:wait resolved synchronously, output may already be ready
    if (prediction.status === 'succeeded' && prediction.output) {
      return streamReplicateImage(prediction.output, REPLICATE_API_TOKEN)
    }

    predictionId = prediction.id
    if (!predictionId) {
      return NextResponse.json({ error: 'No prediction ID returned' }, { status: 502 })
    }
  } catch (err) {
    console.error('[remove-bg] Network error creating prediction:', err)
    return NextResponse.json({ error: 'Failed to reach Replicate' }, { status: 502 })
  }

  // ── 3. Poll until succeeded / failed / timeout ───────────────────────────
  const pollUrl  = `https://api.replicate.com/v1/predictions/${predictionId}`
  const deadline = Date.now() + POLL_TIMEOUT_MS

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS)

    let poll: Response
    try {
      poll = await fetch(pollUrl, {
        headers: { Authorization: `Bearer ${REPLICATE_API_TOKEN}` },
      })
    } catch (err) {
      console.error('[remove-bg] Poll network error:', err)
      continue
    }

    if (!poll.ok) {
      console.error('[remove-bg] Poll HTTP error', poll.status)
      continue
    }

    const result = await poll.json()

    if (result.status === 'succeeded') {
      return streamReplicateImage(result.output, REPLICATE_API_TOKEN)
    }

    if (result.status === 'failed' || result.status === 'canceled') {
      console.error('[remove-bg] Prediction failed:', result.error)
      return NextResponse.json(
        { error: result.error ?? 'Replicate prediction failed' },
        { status: 502 }
      )
    }

    // 'starting' | 'processing' — keep polling
  }

  return NextResponse.json({ error: 'Replicate timed out after 3 minutes' }, { status: 504 })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

/**
 * BiRefNet returns either:
 *   - a single URL string, or
 *   - an array with one URL string
 *
 * We fetch that URL (auth header required — file is on replicate.delivery)
 * and proxy it back as image/png so the client never needs the token.
 */
async function streamReplicateImage(
  output: string | string[],
  token: string
): Promise<NextResponse> {
  const url = Array.isArray(output) ? output[0] : output

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'Unexpected output shape from Replicate' }, { status: 502 })
  }

  let imgRes: Response
  try {
    imgRes = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch (err) {
    console.error('[remove-bg] Failed to fetch result image:', err)
    return NextResponse.json({ error: 'Failed to download result from Replicate' }, { status: 502 })
  }

  if (!imgRes.ok) {
    return NextResponse.json(
      { error: `Result download failed: ${imgRes.status}` },
      { status: 502 }
    )
  }

  const imageBuffer = await imgRes.arrayBuffer()

  return new NextResponse(imageBuffer, {
    status: 200,
    headers: {
      'Content-Type':  'image/png',
      'Cache-Control': 'no-store',
    },
  })
}
