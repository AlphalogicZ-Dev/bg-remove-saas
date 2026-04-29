'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import BeforeAfterSlider from './BeforeAfterSlider'
import { formatFileSize, processedFileName } from '@/lib/utils'
import type { ImageJob } from './ProcessingQueue'

// Lazy-load MaskEditor so it doesn't pull in @huggingface/transformers on initial page load
const MaskEditor = dynamic(() => import('./MaskEditor'), { ssr: false })

interface Props {
  job: ImageJob
  onRemove: (id: string) => void
  onMaskUpdate: (id: string, blob: Blob, url: string) => void
}

export default function ImageCard({ job, onRemove, onMaskUpdate }: Props) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [editingMask, setEditingMask] = useState(false)

  const downloadImage = () => {
    if (!job.processedUrl) return
    const a = document.createElement('a')
    a.href = job.processedUrl
    a.download = processedFileName(job.file.name)
    a.click()
  }

  const saveToCloud = async () => {
    if (!job.processedBlob || saving || saved) return
    setSaving(true); setSaveError(false)
    try {
      const fd = new FormData()
      fd.append('original', job.file)
      fd.append('processed', job.processedBlob, processedFileName(job.file.name))
      const res = await fetch('/api/save-image', { method: 'POST', body: fd })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? 'Save failed') }
      setSaved(true)
    } catch (err) {
      console.error(err); setSaveError(true)
    } finally { setSaving(false) }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow group">

      {/* Image area */}
      <div className="relative aspect-square bg-gray-50">

        {/* Queued */}
        {job.status === 'queued' && (
          <div className="absolute inset-0">
            <img src={job.originalUrl} alt="Queued" className="w-full h-full object-cover opacity-30" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs text-gray-500 bg-white/80 rounded-full px-3 py-1 font-medium">Queued</span>
            </div>
          </div>
        )}

        {/* Processing */}
        {job.status === 'processing' && (
          <div className="absolute inset-0">
            <img src={job.originalUrl} alt="Processing" className="w-full h-full object-cover opacity-20" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6">
              <div className="w-8 h-8 border-[2.5px] border-[#ff0f50] border-t-transparent rounded-full animate-spin" />
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-[#ff0f50] h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${job.progress}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 font-medium">{job.progress}% complete</span>
            </div>
          </div>
        )}

        {/* Error */}
        {job.status === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-50">
            <div className="text-center px-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <p className="text-red-600 text-sm font-semibold">Processing failed</p>
              <p className="text-gray-400 text-xs mt-1">{job.error}</p>
            </div>
          </div>
        )}

        {/* Done — before/after */}
        {job.status === 'done' && job.processedUrl && (
          <>
            <BeforeAfterSlider originalUrl={job.originalUrl} processedUrl={job.processedUrl} />
            {/* Edit Mask button overlay */}
            <button
              onClick={() => setEditingMask(true)}
              className="absolute bottom-2 right-2 bg-black/60 hover:bg-black/80 text-white text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 opacity-0 group-hover:opacity-100"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
              </svg>
              Edit mask
            </button>
          </>
        )}
      </div>

      {/* Mask editor modal */}
      {editingMask && job.processedBlob && (
        <MaskEditor
          originalFile={job.file}
          processedBlob={job.processedBlob}
          onApply={(blob, url) => {
            onMaskUpdate(job.id, blob, url)
            setEditingMask(false)
          }}
          onClose={() => setEditingMask(false)}
        />
      )}

      {/* Footer */}
      <div className="p-3 border-t border-gray-100">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-gray-600 truncate font-medium">{job.file.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{formatFileSize(job.file.size)}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {job.status === 'done' && (
              <>
                <button
                  onClick={downloadImage}
                  className="flex items-center gap-1.5 text-xs bg-[#ff0f50] hover:bg-[#e0003d] active:scale-95 text-white transition-all px-3 py-1.5 rounded-lg font-semibold shadow-[0_2px_8px_rgba(255,15,80,0.3)]"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  PNG
                </button>
                <button
                  onClick={saveToCloud}
                  disabled={saving || saved}
                  title={saved ? 'Saved!' : saveError ? 'Retry save' : 'Save to account'}
                  className={`text-xs px-2 py-1.5 rounded-lg transition-all ${
                    saved ? 'text-[#ff0f50]' : saveError ? 'text-red-400 hover:text-red-500' : 'text-gray-300 hover:text-gray-500'
                  }`}
                >
                  {saving
                    ? <span className="w-3.5 h-3.5 border border-gray-300 border-t-transparent rounded-full animate-spin inline-block" />
                    : saved ? '✓'
                    : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
                      </svg>
                  }
                </button>
              </>
            )}
            <button
              onClick={() => onRemove(job.id)}
              className="text-gray-200 hover:text-red-400 transition-colors px-1.5 py-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
