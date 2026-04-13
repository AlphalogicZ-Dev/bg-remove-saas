'use client'

import { useState, useCallback } from 'react'
import Dropzone from './Dropzone'
import ImageCard from './ImageCard'
import BulkDownload from './BulkDownload'
import { removeBackground } from '@/lib/bgRemoval'

export type ImageJob = {
  id: string
  file: File
  originalUrl: string
  processedBlob: Blob | null
  processedUrl: string | null
  status: 'queued' | 'processing' | 'done' | 'error'
  progress: number
  error?: string
}

export default function ProcessingQueue() {
  const [jobs, setJobs] = useState<ImageJob[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  const updateJob = useCallback((id: string, patch: Partial<ImageJob>) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)))
  }, [])

  const addFiles = useCallback(
    async (files: File[]) => {
      const newJobs: ImageJob[] = files.map((file) => ({
        id: crypto.randomUUID(),
        file,
        originalUrl: URL.createObjectURL(file),
        processedBlob: null,
        processedUrl: null,
        status: 'queued',
        progress: 0,
      }))

      setJobs((prev) => [...prev, ...newJobs])
      setIsProcessing(true)

      // Process sequentially to avoid WASM memory pressure
      for (const job of newJobs) {
        updateJob(job.id, { status: 'processing', progress: 0 })

        try {
          const blob = await removeBackground(job.file, (stage, current, total) => {
            const pct = total > 0 ? Math.round((current / total) * 100) : 0
            updateJob(job.id, { progress: pct })
          })

          const url = URL.createObjectURL(blob)
          updateJob(job.id, {
            status: 'done',
            processedBlob: blob,
            processedUrl: url,
            progress: 100,
          })
        } catch (err) {
          console.error('[ClearCut] Processing error:', err)
          updateJob(job.id, {
            status: 'error',
            error: 'Processing failed. Please try again.',
          })
        }
      }

      setIsProcessing(false)
    },
    [updateJob]
  )

  const removeJob = useCallback((id: string) => {
    setJobs((prev) => {
      const job = prev.find((j) => j.id === id)
      if (job?.originalUrl) URL.revokeObjectURL(job.originalUrl)
      if (job?.processedUrl) URL.revokeObjectURL(job.processedUrl)
      return prev.filter((j) => j.id !== id)
    })
  }, [])

  const clearAll = useCallback(() => {
    setJobs((prev) => {
      prev.forEach((j) => {
        if (j.originalUrl) URL.revokeObjectURL(j.originalUrl)
        if (j.processedUrl) URL.revokeObjectURL(j.processedUrl)
      })
      return []
    })
  }, [])

  const doneJobs = jobs.filter((j) => j.status === 'done')
  const processingJob = jobs.find((j) => j.status === 'processing')
  const queuedCount = jobs.filter((j) => j.status === 'queued').length

  return (
    <div className="space-y-8">
      {/* Drop zone */}
      <Dropzone onFiles={addFiles} disabled={isProcessing} />

      {/* Model load notice — shown on first use */}
      {isProcessing && jobs.some((j) => j.status === 'processing' && j.progress < 5) && (
        <div className="text-center text-sm text-white/40 bg-white/[0.03] border border-white/8 rounded-xl px-4 py-3">
          First run: downloading AI model (~40MB) — cached after this for instant processing
        </div>
      )}

      {jobs.length > 0 && (
        <>
          {/* Status bar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4 text-sm text-white/50">
              <span>
                {jobs.length} image{jobs.length !== 1 ? 's' : ''}
              </span>

              {doneJobs.length > 0 && (
                <span className="text-emerald-400 font-medium">
                  ✓ {doneJobs.length} done
                </span>
              )}

              {processingJob && (
                <span className="text-violet-400 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                  Processing… {processingJob.progress}%
                </span>
              )}

              {queuedCount > 0 && !processingJob && (
                <span className="text-white/30">{queuedCount} queued</span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {doneJobs.length > 1 && <BulkDownload jobs={doneJobs} />}
              <button
                onClick={clearAll}
                className="text-sm text-white/30 hover:text-white/60 transition-colors"
              >
                Clear all
              </button>
            </div>
          </div>

          {/* Image grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {jobs.map((job) => (
              <ImageCard key={job.id} job={job} onRemove={removeJob} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
