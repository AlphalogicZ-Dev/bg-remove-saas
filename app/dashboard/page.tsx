import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatFileSize } from '@/lib/utils'

export const revalidate = 0

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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: images, error } = await supabase
    .from('images')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) console.error('[Dashboard] DB error:', error)

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
    <main className="max-w-5xl mx-auto px-5 py-12">

      {/* Header */}
      <div className="flex items-start justify-between mb-10 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900" style={{ letterSpacing: '-0.5px' }}>My Images</h1>
          <p className="text-gray-400 text-sm mt-1">{user.email}</p>
        </div>
        <Link
          href="/"
          className="flex items-center gap-2 text-sm bg-[#ff0f50] hover:bg-[#e0003d] transition-colors px-4 py-2.5 rounded-xl font-semibold text-white active:scale-95"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.5v15m7.5-7.5h-15" />
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
          <div key={stat.label} className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-4">
            <p className="text-gray-400 text-xs mb-1 font-medium">{stat.label}</p>
            <p className="text-lg font-bold text-gray-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Image grid */}
      {imagesWithUrls.length === 0 ? (
        <div className="text-center py-24 border-2 border-dashed border-gray-200 rounded-2xl">
          <div className="w-14 h-14 rounded-2xl bg-[#fff0f3] flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-[#ff0f50]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </div>
          <p className="text-gray-400 font-medium mb-3">No saved images yet</p>
          <Link href="/" className="text-[#ff0f50] hover:text-[#e0003d] text-sm font-semibold transition-colors">
            Process and save your first image →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {imagesWithUrls.map((img) => (
            <div key={img.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md hover:border-gray-300 transition-all group">
              {/* Thumbnail */}
              <div className="aspect-square relative transparent-bg">
                {img.processedUrl ? (
                  <img src={img.processedUrl} alt={img.file_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-300 text-xs">No preview</div>
                )}
              </div>
              {/* Meta + actions */}
              <div className="p-3">
                <p className="text-xs text-gray-600 truncate font-medium mb-0.5">{img.file_name}</p>
                <p className="text-xs text-gray-400 mb-2.5">
                  {img.file_size ? formatFileSize(img.file_size) : '—'} · {new Date(img.created_at).toLocaleDateString()}
                </p>
                {img.processedUrl && (
                  <a
                    href={img.processedUrl}
                    download={img.file_name.replace(/\.[^.]+$/, '_removed.png')}
                    className="inline-flex items-center gap-1.5 text-xs text-[#ff0f50] hover:text-[#e0003d] transition-colors font-semibold"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
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
