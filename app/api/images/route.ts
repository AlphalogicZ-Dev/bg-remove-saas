import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)
    const offset = parseInt(searchParams.get('offset') ?? '0')

    const { data: images, error, count } = await supabase
      .from('images')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ images, count, limit, offset })
  } catch (err) {
    console.error('[API/images] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await req.json()
    if (!id) {
      return NextResponse.json({ error: 'Missing image id' }, { status: 400 })
    }

    // Fetch the record first to get storage paths
    const { data: image, error: fetchError } = await supabase
      .from('images')
      .select('original_path, processed_path')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    // Delete from storage
    const removeOps: Promise<unknown>[] = [
      supabase.storage.from('originals').remove([image.original_path]),
    ]
    if (image.processed_path) {
      removeOps.push(supabase.storage.from('processed').remove([image.processed_path]))
    }
    await Promise.all(removeOps)

    // Delete DB record
    await supabase.from('images').delete().eq('id', id).eq('user_id', user.id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[API/images] DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
