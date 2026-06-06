'use client'

import { useState, useCallback, useRef } from 'react'
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
  const gridRef = useRef<HTMLDivElement>(null)

  const updateJob = useCallback((id: string, patch: Partial<ImageJob>) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)))
  }, [])

  const addFiles = useCallback(async (files: File[]) => {
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

    // Scroll just enough to reveal the grid — 'nearest' won't over-scroll
    setTimeout(() => {
      gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 100)

    for (const job of newJobs) {
      updateJob(job.id, { status: 'processing', progress: 0 })

      // Estimate total processing time from file size (empirically tuned for small model 3-pass)
      // Base 6s + ~5s per MB — gives a linear target duration that scales with image size
      const estimatedMs = 6000 + (job.file.size / (1024 * 1024)) * 5000
      const tickMs = 100
      let fakeProgress = 0
      const startTime = Date.now()

      const ticker = setInterval(() => {
        const elapsed = Date.now() - startTime
        // Pure linear based on elapsed time — consistent rate regardless of where we are
        fakeProgress = Math.min((elapsed / estimatedMs) * 92, 92)
        const display = Math.round(fakeProgress)
        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id && j.status === 'processing'
              ? { ...j, progress: Math.max(j.progress, display) }
              : j
          )
        )
      }, tickMs)

      try {
        const blob = await removeBackground(job.file, (_stage, current, total) => {
          const real = total > 0 ? Math.round((current / total) * 100) : 0
          fakeProgress = Math.max(fakeProgress, real)
          updateJob(job.id, { progress: Math.max(Math.round(fakeProgress), real) })
        })
        clearInterval(ticker)

        // Animate remaining gap → 100 at consistent 2%/30ms (never a jump)
        await new Promise<void>((resolve) => {
          const finish = setInterval(() => {
            setJobs((prev) => {
              const cur = prev.find((j) => j.id === job.id)?.progress ?? 100
              if (cur >= 100) { clearInterval(finish); resolve(); return prev }
              return prev.map((j) =>
                j.id === job.id ? { ...j, progress: Math.min(cur + 2, 100) } : j
              )
            })
          }, 30)
        })

        updateJob(job.id, {
          status: 'done',
          processedBlob: blob,
          processedUrl: URL.createObjectURL(blob),
          progress: 100,
        })
      } catch (err) {
        clearInterval(ticker)
        console.error(err)
        updateJob(job.id, { status: 'error', error: 'Processing failed. Please try again.' })
      }
    }
    setIsProcessing(false)
  }, [updateJob])

  const updateMask = useCallback((id: string, blob: Blob, url: string) => {
    setJobs((prev) => prev.map((j) => {
      if (j.id !== id) return j
      if (j.processedUrl) URL.revokeObjectURL(j.processedUrl)
      return { ...j, processedBlob: blob, processedUrl: url }
    }))
  }, [])

  const removeJob = useCallback((id: string) => {
    setJobs((prev) => {
      const j = prev.find((x) => x.id === id)
      if (j?.originalUrl) URL.revokeObjectURL(j.originalUrl)
      if (j?.processedUrl) URL.revokeObjectURL(j.processedUrl)
      return prev.filter((x) => x.id !== id)
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
    <div className="space-y-5">
      <Dropzone onFiles={addFiles} disabled={isProcessing} />

      {/* First-run model notice */}
      {isProcessing && jobs.some((j) => j.status === 'processing' && j.progress < 5) && (
        <div className="text-center text-sm text-gray-400 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
          First run: downloading AI model (~40 MB) — cached after this for instant processing
        </div>
      )}

      {jobs.length > 0 && (
        <>
          {/* Status bar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span className="font-semibold text-gray-600">
                {jobs.length} image{jobs.length !== 1 ? 's' : ''}
              </span>
              {doneJobs.length > 0 && (
                <span className="text-[#ff0f50] font-semibold flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  {doneJobs.length} done
                </span>
              )}
              {processingJob && (
                <span className="text-[#ff0f50] flex items-center gap-2 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ff0f50] animate-pulse" />
                  Processing… {processingJob.progress}%
                </span>
              )}
              {queuedCount > 0 && !processingJob && (
                <span className="text-gray-300">{queuedCount} queued</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {doneJobs.length > 1 && <BulkDownload jobs={doneJobs} />}
              <button
                onClick={clearAll}
                className="text-sm text-gray-300 hover:text-gray-500 transition-colors font-medium"
              >
                Clear all
              </button>
            </div>
          </div>

          {/* Image grid */}
          <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {jobs.map((job) => (
              <ImageCard key={job.id} job={job} onRemove={removeJob} onMaskUpdate={updateMask} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
