'use client'

import { useRef, useEffect, useState } from 'react'

interface Props {
  originalUrl: string
  processedUrl: string
}

export default function BeforeAfterSlider({ originalUrl, processedUrl }: Props) {
  const [sliderPos, setSliderPos] = useState(50)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  const updateSlider = (clientX: number) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const pct = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100))
    setSliderPos(pct)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true
    updateSlider(e.clientX)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    isDragging.current = true
    updateSlider(e.touches[0].clientX)
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging.current) updateSlider(e.clientX)
    }
    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging.current) updateSlider(e.touches[0].clientX)
    }
    const handleUp = () => {
      isDragging.current = false
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleUp)
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('touchend', handleUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleUp)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleUp)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full select-none overflow-hidden cursor-ew-resize"
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {/* Processed image (left side — transparent background) */}
      <div
        className="absolute inset-0 transparent-bg"
        style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
      >
        <img
          src={processedUrl}
          alt="Processed"
          className="w-full h-full object-cover"
          draggable={false}
        />
      </div>

      {/* Original image (right side) */}
      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 0 0 ${sliderPos}%)` }}
      >
        <img
          src={originalUrl}
          alt="Original"
          className="w-full h-full object-cover"
          draggable={false}
        />
      </div>

      {/* Divider line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white/90 pointer-events-none"
        style={{ left: `${sliderPos}%` }}
      >
        {/* Handle */}
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-gray-700" viewBox="0 0 14 14" fill="none">
            <path
              d="M4.5 2L1 7l3.5 5M9.5 2L13 7l-3.5 5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* Labels */}
      <div className="absolute top-2 left-2 text-xs bg-black/60 backdrop-blur-sm rounded-md px-2 py-1 text-white/80 pointer-events-none">
        After
      </div>
      <div className="absolute top-2 right-2 text-xs bg-black/60 backdrop-blur-sm rounded-md px-2 py-1 text-white/80 pointer-events-none">
        Before
      </div>
    </div>
  )
}
