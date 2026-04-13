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
    for (const job of newJobs) {
      updateJob(job.id, { status: 'processing', progress: 0 })
      try {
        const blob = await removeBackground(job.file, (_stage, current, total) => {
          updateJob(job.id, { progress: total > 0 ? Math.round((current / total) * 100) : 0 })
        })
        updateJob(job.id, { status: 'done', processedBlob: blob, processedUrl: URL.createObjectURL(blob), progress: 100 })
      } catch (err) {
        console.error(err)
        updateJob(job.id, { status: 'error', error: 'Processing failed. Please try again.' })
      }
    }
    setIsProcessing(false)
  }, [updateJob])

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
    <div className="space-y-6">
      <Dropzone onFiles={addFiles} disabled={isProcessing} />

      {/* First-run model notice */}
      {isProcessing && jobs.some((j) => j.status === 'processing' && j.progress < 5) && (
        <div className="text-center text-sm text-gray-400 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
          First run: downloading AI model (~40MB) — cached after this for instant processing
        </div>
      )}

      {jobs.length > 0 && (
        <>
          {/* Status bar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span className="font-medium text-gray-600">
                {jobs.length} image{jobs.length !== 1 ? 's' : ''}
              </span>
              {doneJobs.length > 0 && (
                <span className="text-[#00c27a] font-semibold flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  {doneJobs.length} done
                </span>
              )}
              {processingJob && (
                <span className="text-[#00c27a] flex items-center gap-2 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00c27a] animate-pulse" />
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
