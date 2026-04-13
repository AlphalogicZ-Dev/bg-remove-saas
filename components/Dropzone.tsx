'use client'

import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { cn } from '@/lib/utils'

interface Props {
  onFiles: (files: File[]) => void
  disabled?: boolean
}

const MAX_FILE_SIZE = 20 * 1024 * 1024

export default function Dropzone({ onFiles, disabled }: Props) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const valid = acceptedFiles.filter(
        (f) => f.size <= MAX_FILE_SIZE && (f.type === 'image/jpeg' || f.type === 'image/png' || f.type === 'image/webp')
      )
      if (valid.length > 0) onFiles(valid)
    },
    [onFiles]
  )

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'], 'image/webp': ['.webp'] },
    multiple: true,
    disabled,
    maxSize: MAX_FILE_SIZE,
  })

  return (
    <div
      {...getRootProps()}
      className={cn(
        'relative border-2 border-dashed rounded-2xl p-14 text-center cursor-pointer transition-all duration-200 select-none bg-white',
        isDragActive && !isDragReject
          ? 'border-[#00c27a] bg-[#e6fff5] shadow-[0_0_0_4px_rgba(0,194,122,0.12)]'
          : isDragReject
          ? 'border-red-400 bg-red-50'
          : 'border-gray-200 hover:border-[#00c27a] hover:shadow-[0_0_0_4px_rgba(0,194,122,0.08)]',
        disabled && 'opacity-40 cursor-not-allowed pointer-events-none'
      )}
    >
      <input {...getInputProps()} />

      <div className="flex flex-col items-center gap-4 pointer-events-none">
        {/* Upload icon */}
        <div className={cn(
          'w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-200',
          isDragActive ? 'bg-[#00c27a]/15 scale-110' : 'bg-[#e6fff5]'
        )}>
          {isDragReject ? (
            <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          ) : (
            <svg className={cn('w-7 h-7 transition-colors', isDragActive ? 'text-[#00c27a]' : 'text-[#00c27a]')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          )}
        </div>

        <div>
          {isDragReject ? (
            <p className="text-red-500 font-semibold text-lg">Unsupported file type</p>
          ) : isDragActive ? (
            <p className="text-[#00c27a] font-semibold text-lg">Drop to remove background</p>
          ) : (
            <>
              <p className="text-gray-800 font-semibold text-lg mb-1">
                Drop image here
              </p>
              <p className="text-gray-400 text-sm">
                or{' '}
                <span className="text-[#00c27a] font-medium">browse files</span>
                {' '}· JPG, PNG, WebP · Max 20MB
              </p>
            </>
          )}
        </div>

        {!isDragActive && !isDragReject && (
          <button
            type="button"
            className="mt-1 bg-[#00c27a] hover:bg-[#00a868] active:scale-95 text-white font-semibold text-sm px-7 py-3 rounded-xl transition-all shadow-[0_4px_14px_rgba(0,194,122,0.35)] pointer-events-none"
          >
            Upload Image
          </button>
        )}
      </div>
    </div>
  )
}
