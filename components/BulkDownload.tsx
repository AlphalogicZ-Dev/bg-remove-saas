'use client'

import { useState } from 'react'
import JSZip from 'jszip'
import { processedFileName } from '@/lib/utils'
import type { ImageJob } from './ProcessingQueue'

interface Props {
  jobs: ImageJob[]
}

export default function BulkDownload({ jobs }: Props) {
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)

  const downloadZip = async () => {
    if (loading || jobs.length === 0) return
    setLoading(true)
    setProgress(0)

    try {
      const zip = new JSZip()
      const folder = zip.folder('clearcut-images')!

      for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i]
        if (job.processedBlob) {
          folder.file(processedFileName(job.file.name), job.processedBlob)
        }
        setProgress(Math.round(((i + 1) / jobs.length) * 80))
      }

      const blob = await zip.generateAsync(
        { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
        (meta) => setProgress(80 + Math.round(meta.percent * 0.2))
      )

      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `clearcut-images-${Date.now()}.zip`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (err) {
      console.error('[ClearCut] ZIP error:', err)
    } finally {
      setLoading(false)
      setProgress(0)
    }
  }

  return (
    <button
      onClick={downloadZip}
      disabled={loading}
      className="flex items-center gap-2 text-sm bg-white/8 hover:bg-white/15 active:scale-95 transition-all px-4 py-2 rounded-lg font-medium border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <>
          <span className="w-3.5 h-3.5 border border-white/40 border-t-transparent rounded-full animate-spin" />
          Zipping… {progress}%
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Download all ({jobs.length})
        </>
      )}
    </button>
  )
}
