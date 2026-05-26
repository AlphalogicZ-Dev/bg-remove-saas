import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 300

const HF_API_TOKEN = process.env.HF_API_TOKEN
const HF_MODEL_URL = 'https://api-inference.huggingface.co/models/ZhengPeng7/BiRefNet'
const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB

export async function POST(req: NextRequest) {
  console.log('[remove-bg] ENV CHECK', {
    HF_API_TOKEN_exists: !!HF_API_TOKEN,
    HF_API_TOKEN_length: HF_API_TOKEN?.length ?? 0,
    NODE_ENV: process.env.NODE_ENV,
  })

  if (!HF_API_TOKEN) {
    console.error('[remove-bg] HF_API_TOKEN is not set')
    return NextResponse.json({ error: 'HF_API_TOKEN is not set' }, { status: 500 })
  }

  // ── Parse uploaded image ──────────────────────────────────────────────────
  let formData: FormData
  try {
    formData = await req.formData()
  } catch (err) {
    console.error('[remove-bg] Failed to parse form data:', err)
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const imageFile = formData.get('image') as File | null
  if (!imageFile) {
    return NextResponse.json({ error: 'Missing "image" field' }, { status: 400 })
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(imageFile.type)) {
    return NextResponse.json({ error: 'Unsupported image type' }, { status: 415 })
  }
  if (imageFile.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'Image exceeds 10 MB limit' }, { status: 413 })
  }

  const imageBuffer = Buffer.from(await imageFile.arrayBuffer())
  console.log('[remove-bg] Sending to HF:', { bytes: imageBuffer.length, type: imageFile.type })

  // ── Call HF Inference API ─────────────────────────────────────────────────
  // Model may be cold — HF returns 503 while loading. Retry up to 3 times
  // with a 10 s wait, which covers typical warm-up time.
  const MAX_RETRIES = 3
  const RETRY_DELAY_MS = 10_000

  let hfRes: Response | null = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      hfRes = await fetch(HF_MODEL_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${HF_API_TOKEN}`,
          'Content-Type': imageFile.type,
          'Accept': 'image/png',
        },
        body: imageBuffer,
      })
    } catch (err) {
      console.error(`[remove-bg] Network error on attempt ${attempt}:`, err)
      if (attempt === MAX_RETRIES) {
        return NextResponse.json({ error: 'Failed to reach Hugging Face API' }, { status: 502 })
      }
      await sleep(RETRY_DELAY_MS)
      continue
    }

    console.log(`[remove-bg] HF response attempt ${attempt}: status=${hfRes.status}`)

    // 503 = model is loading — wait and retry
    if (hfRes.status === 503) {
      const body = await hfRes.text().catch(() => '')
      console.warn(`[remove-bg] Model loading (503), attempt ${attempt}/${MAX_RETRIES}:`, body)
      if (attempt === MAX_RETRIES) {
        return NextResponse.json(
          { error: 'Model is loading on Hugging Face — try again in 30 seconds' },
          { status: 503 }
        )
      }
      await sleep(RETRY_DELAY_MS)
      continue
    }

    // Any other non-2xx is a hard failure
    if (!hfRes.ok) {
      const body = await hfRes.text().catch(() => '')
      console.error('[remove-bg] HF error:', { status: hfRes.status, body })
      return NextResponse.json(
        { error: `Hugging Face API error: ${hfRes.status}`, detail: body },
        { status: 502 }
      )
    }

    // Success — break out of retry loop
    break
  }

  if (!hfRes || !hfRes.ok) {
    return NextResponse.json({ error: 'Hugging Face API failed' }, { status: 502 })
  }

  // ── Proxy the PNG back to the client ─────────────────────────────────────
  const resultBuffer = await hfRes.arrayBuffer()
  console.log('[remove-bg] Success, returning', resultBuffer.byteLength, 'bytes')

  return new NextResponse(resultBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store',
    },
  })
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}
