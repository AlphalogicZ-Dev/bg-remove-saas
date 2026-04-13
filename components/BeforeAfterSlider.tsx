'use client'

import { useRef, useEffect, useState } from 'react'

interface Props {
  originalUrl: string
  processedUrl: string
  darkMode?: boolean
}

export default function BeforeAfterSlider({ originalUrl, processedUrl, darkMode = false }: Props) {
  const [sliderPos, setSliderPos] = useState(50)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  const updateSlider = (clientX: number) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const pct = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100))
    setSliderPos(pct)
  }

  useEffect(() => {
    const onMove = (e: MouseEvent) => { if (isDragging.current) updateSlider(e.clientX) }
    const onTouch = (e: TouchEvent) => { if (isDragging.current) updateSlider(e.touches[0].clientX) }
    const onUp = () => { isDragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onTouch, { passive: true })
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onTouch)
      window.removeEventListener('touchend', onUp)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full select-none overflow-hidden cursor-ew-resize"
      onMouseDown={(e) => { isDragging.current = true; updateSlider(e.clientX) }}
      onTouchStart={(e) => { isDragging.current = true; updateSlider(e.touches[0].clientX) }}
    >
      {/* After — processed (left, clipped) */}
      <div
        className={`absolute inset-0 ${darkMode ? 'transparent-bg-dark' : 'transparent-bg'}`}
        style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
      >
        <img src={processedUrl} alt="Background removed" className="w-full h-full object-cover" draggable={false} />
      </div>

      {/* Before — original (right, clipped) */}
      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 0 0 ${sliderPos}%)` }}
      >
        <img src={originalUrl} alt="Original" className="w-full h-full object-cover" draggable={false} />
      </div>

      {/* Divider + handle */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white pointer-events-none"
        style={{ left: `${sliderPos}%`, transform: 'translateX(-50%)' }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white shadow-[0_4px_20px_rgba(0,0,0,0.3)] flex items-center justify-center">
          <svg className="w-4 h-4 text-gray-600" viewBox="0 0 16 16" fill="none">
            <path d="M5 3L1 8l4 5M11 3l4 5-4 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {/* Labels */}
      <span className="absolute top-2.5 left-3 text-[10px] font-bold bg-black/55 text-white backdrop-blur-sm rounded-full px-2.5 py-1 pointer-events-none tracking-wide uppercase">
        Removed
      </span>
      <span className="absolute top-2.5 right-3 text-[10px] font-bold bg-black/55 text-white backdrop-blur-sm rounded-full px-2.5 py-1 pointer-events-none tracking-wide uppercase">
        Original
      </span>
    </div>
  )
}
