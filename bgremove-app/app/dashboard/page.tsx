import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatFileSize } from '@/lib/utils'

export const revalidate = 0 // Always fresh

type ImageRow = {
  id: string
  file_name: string
  file_size: number | null
  status: string
  created_at: string
  original_path: string
  processed_path: string | null
  originalUrl?: string
  processedUrl?: string
}

export default async function DashboardPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  // Fetch image metadata
  const { data: images, error } = await supabase
    .from('images')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('[Dashboard] DB error:', error)
  }

  // Generate signed URLs (1 hour expiry)
  const imagesWithUrls: ImageRow[] = await Promise.all(
    (images ?? []).map(async (img: ImageRow) => {
      const [origResult, procResult] = await Promise.all([
        supabase.storage.from('originals').createSignedUrl(img.original_path, 3600),
        img.processed_path
          ? supabase.storage.from('processed').createSignedUrl(img.processed_path, 3600)
          : Promise.resolve({ data: null }),
      ])
      return {
        ...img,
        originalUrl: origResult.data?.signedUrl,
        processedUrl: procResult.data?.signedUrl,
      }
    })
  )

  const totalImages = imagesWithUrls.length
  const totalSize = imagesWithUrls.reduce((acc, img) => acc + (img.file_size ?? 0), 0)

  return (
    <main className="max-w-5xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="flex items-start justify-between mb-10 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold">My images</h1>
          <p className="text-white/40 text-sm mt-1">{user.email}</p>
        </div>
        <Link
          href="/"
          className="flex items-center gap-2 text-sm bg-violet-600 hover:bg-violet-500 transition-colors px-4 py-2.5 rounded-xl font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Process more images
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-10">
        {[
          { label: 'Total images', value: totalImages.toString() },
          { label: 'Storage used', value: formatFileSize(totalSize) },
          { label: 'Account', value: 'Free plan' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white/[0.04] border border-white/8 rounded-xl px-5 py-4"
          >
            <p className="text-white/40 text-xs mb-1">{stat.label}</p>
            <p className="text-lg font-semibold">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Image grid */}
      {imagesWithUrls.length === 0 ? (
        <div className="text-center py-24 border border-dashed border-white/10 rounded-2xl">
          <p className="text-white/30 mb-3">No saved images yet</p>
          <Link href="/" className="text-violet-400 hover:text-violet-300 text-sm transition-colors">
            Process and save your first image →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {imagesWithUrls.map((img) => (
            <div
              key={img.id}
              className="bg-white/[0.04] border border-white/10 rounded-xl overflow-hidden group"
            >
              {/* Thumbnail */}
              <div className="aspect-square relative transparent-bg">
                {img.processedUrl ? (
                  <img
                    src={img.processedUrl}
                    alt={img.file_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-white/20 text-xs">
                    No preview
                  </div>
                )}
              </div>

              {/* Meta + actions */}
              <div className="p-3">
                <p className="text-xs text-white/50 truncate mb-0.5">{img.file_name}</p>
                <p className="text-xs text-white/25 mb-2">
                  {img.file_size ? formatFileSize(img.file_size) : '—'} ·{' '}
                  {new Date(img.created_at).toLocaleDateString()}
                </p>
                {img.processedUrl && (
                  <a
                    href={img.processedUrl}
                    download={img.file_name.replace(/\.[^.]+$/, '_removed.png')}
                    className="text-xs text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download PNG
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
