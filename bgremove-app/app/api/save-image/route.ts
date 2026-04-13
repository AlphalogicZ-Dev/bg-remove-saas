import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()

    // Get current user (optional — guests can still use the app, just can't save)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Sign in to save images to the cloud.' },
        { status: 401 }
      )
    }

    // Parse multipart form data
    const formData = await req.formData()
    const original = formData.get('original') as File | null
    const processed = formData.get('processed') as File | null

    if (!original || !processed) {
      return NextResponse.json({ error: 'Missing files' }, { status: 400 })
    }

    // Validate file types
    if (!['image/jpeg', 'image/png'].includes(original.type)) {
      return NextResponse.json({ error: 'Original must be JPG or PNG' }, { status: 400 })
    }

    // Validate file sizes
    if (original.size > MAX_FILE_SIZE || processed.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File exceeds 20MB limit' }, { status: 400 })
    }

    const timestamp = Date.now()
    const safeName = original.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const originalPath = `${user.id}/${timestamp}_original_${safeName}`
    const processedPath = `${user.id}/${timestamp}_processed_${safeName.replace(/\.[^.]+$/, '.png')}`

    // Upload both files in parallel
    const [origUpload, procUpload] = await Promise.all([
      supabase.storage.from('originals').upload(originalPath, original, {
        contentType: original.type,
        upsert: false,
      }),
      supabase.storage.from('processed').upload(processedPath, processed, {
        contentType: 'image/png',
        upsert: false,
      }),
    ])

    if (origUpload.error) {
      console.error('[API/save-image] Original upload error:', origUpload.error)
      return NextResponse.json({ error: 'Failed to upload original image' }, { status: 500 })
    }

    if (procUpload.error) {
      console.error('[API/save-image] Processed upload error:', procUpload.error)
      // Clean up original if processed failed
      await supabase.storage.from('originals').remove([originalPath])
      return NextResponse.json({ error: 'Failed to upload processed image' }, { status: 500 })
    }

    // Save metadata record
    const { data: record, error: dbError } = await supabase
      .from('images')
      .insert({
        user_id: user.id,
        original_path: originalPath,
        processed_path: processedPath,
        file_name: original.name,
        file_size: original.size,
        status: 'done',
      })
      .select('id')
      .single()

    if (dbError) {
      console.error('[API/save-image] DB error:', dbError)
      return NextResponse.json({ error: 'Failed to save metadata' }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: record.id })
  } catch (err) {
    console.error('[API/save-image] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
