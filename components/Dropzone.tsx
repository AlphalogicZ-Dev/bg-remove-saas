'use client'

import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { cn } from '@/lib/utils'

interface Props {
  onFiles: (files: File[]) => void
  disabled?: boolean
}

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

export default function Dropzone({ onFiles, disabled }: Props) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const validFiles = acceptedFiles.filter((f) => {
        if (f.size > MAX_FILE_SIZE) {
          console.warn(`[ClearCut] Skipping ${f.name}: exceeds 20MB limit`)
          return false
        }
        return f.type === 'image/jpeg' || f.type === 'image/png'
      })
      if (validFiles.length > 0) onFiles(validFiles)
    },
    [onFiles]
  )

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
    },
    multiple: true,
    disabled,
    maxSize: MAX_FILE_SIZE,
  })

  return (
    <div
      {...getRootProps()}
      className={cn(
        'relative border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all duration-200 select-none',
        isDragActive && !isDragReject
          ? 'border-violet-400 bg-violet-500/10'
          : isDragReject
          ? 'border-red-400 bg-red-500/10'
          : 'border-white/15 hover:border-white/30 hover:bg-white/[0.02]',
        disabled && 'opacity-40 cursor-not-allowed pointer-events-none'
      )}
    >
      <input {...getInputProps()} />

      <div className="flex flex-col items-center gap-4 pointer-events-none">
        {/* Icon */}
        <div
          className={cn(
            'w-16 h-16 rounded-2xl flex items-center justify-center transition-colors',
            isDragActive ? 'bg-violet-500/20' : 'bg-white/5'
          )}
        >
          {isDragReject ? (
            <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          ) : (
            <svg className="w-7 h-7 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          )}
        </div>

        {/* Text */}
        <div>
          {isDragReject ? (
            <p className="text-red-400 font-medium text-lg">Unsupported file type</p>
          ) : isDragActive ? (
            <p className="text-violet-300 font-medium text-lg">Drop images here</p>
          ) : (
            <>
              <p className="text-white/80 font-medium text-lg">
                Drag & drop images here
              </p>
              <p className="text-white/40 text-sm mt-1.5">
                or{' '}
                <span className="text-violet-400">browse files</span>
                {' '}· JPG, PNG · Multiple supported · Max 20MB each
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
