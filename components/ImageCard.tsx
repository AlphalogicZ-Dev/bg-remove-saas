'use client'

import { useState } from 'react'
import BeforeAfterSlider from './BeforeAfterSlider'
import { formatFileSize, processedFileName } from '@/lib/utils'
import type { ImageJob } from './ProcessingQueue'

interface Props {
  job: ImageJob
  onRemove: (id: string) => void
}

export default function ImageCard({ job, onRemove }: Props) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState(false)

  const downloadImage = () => {
    if (!job.processedUrl) return
    const a = document.createElement('a')
    a.href = job.processedUrl
    a.download = processedFileName(job.file.name)
    a.click()
  }

  const saveToCloud = async () => {
    if (!job.processedBlob || saving || saved) return
    setSaving(true)
    setSaveError(false)

    try {
      const formData = new FormData()
      formData.append('original', job.file)
      formData.append(
        'processed',
        job.processedBlob,
        processedFileName(job.file.name)
      )

      const res = await fetch('/api/save-image', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Save failed')
      }

      setSaved(true)
    } catch (err) {
      console.error('[ClearCut] Save error:', err)
      setSaveError(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white/[0.04] border border-white/10 rounded-2xl overflow-hidden flex flex-col group">
      {/* Image area */}
      <div className="relative aspect-square bg-[#111]">
        {/* Queued state */}
        {job.status === 'queued' && (
          <div className="absolute inset-0">
            <img
              src={job.originalUrl}
              alt="Queued"
              className="w-full h-full object-cover opacity-40"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs text-white/40 bg-black/60 rounded-full px-3 py-1">
                Queued
              </span>
            </div>
          </div>
        )}

        {/* Processing state */}
        {job.status === 'processing' && (
          <div className="absolute inset-0">
            <img
              src={job.originalUrl}
              alt="Processing"
              className="w-full h-full object-cover opacity-25"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6">
              {/* Spinner */}
              <div className="w-9 h-9 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              {/* Progress bar */}
              <div className="w-full bg-white/10 rounded-full h-1">
                <div
                  className="bg-violet-500 h-1 rounded-full transition-all duration-300"
                  style={{ width: `${job.progress}%` }}
                />
              </div>
              <span className="text-xs text-white/50">
                Removing background… {job.progress}%
              </span>
            </div>
          </div>
        )}

        {/* Error state */}
        {job.status === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-950/20">
            <div className="text-center px-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <p className="text-red-400 text-sm font-medium">Processing failed</p>
              <p className="text-white/30 text-xs mt-1">{job.error}</p>
            </div>
          </div>
        )}

        {/* Done state — before/after slider */}
        {job.status === 'done' && job.processedUrl && (
          <BeforeAfterSlider
            originalUrl={job.originalUrl}
            processedUrl={job.processedUrl}
          />
        )}
      </div>

      {/* Card footer */}
      <div className="p-3 border-t border-white/[0.06]">
        <div className="flex items-center justify-between gap-2">
          {/* File info */}
          <div className="min-w-0">
            <p className="text-xs text-white/50 truncate">{job.file.name}</p>
            <p className="text-xs text-white/25 mt-0.5">{formatFileSize(job.file.size)}</p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {job.status === 'done' && (
              <>
                {/* Download PNG */}
                <button
                  onClick={downloadImage}
                  title="Download PNG"
                  className="flex items-center gap-1.5 text-xs bg-violet-600 hover:bg-violet-500 active:scale-95 transition-all px-3 py-1.5 rounded-lg font-medium"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  PNG
                </button>

                {/* Save to cloud */}
                <button
                  onClick={saveToCloud}
                  disabled={saving || saved}
                  title={saved ? 'Saved!' : saveError ? 'Save failed — retry' : 'Save to your account'}
                  className={`text-xs px-2 py-1.5 rounded-lg transition-all ${
                    saved
                      ? 'text-emerald-400'
                      : saveError
                      ? 'text-red-400 hover:text-red-300'
                      : 'text-white/30 hover:text-white/60'
                  }`}
                >
                  {saving ? (
                    <span className="w-3 h-3 border border-white/40 border-t-transparent rounded-full animate-spin inline-block" />
                  ) : saved ? (
                    '✓'
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
                    </svg>
                  )}
                </button>
              </>
            )}

            {/* Remove card */}
            <button
              onClick={() => onRemove(job.id)}
              title="Remove"
              className="text-xs text-white/20 hover:text-red-400 transition-colors px-2 py-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
