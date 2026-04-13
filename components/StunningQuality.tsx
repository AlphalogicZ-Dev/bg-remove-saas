'use client'

import { useRef, useEffect, useState, useCallback } from 'react'

// Sample image pairs — before (original) / after (simulated removed bg using same img with overlay)
const SAMPLES = [
  {
    id: 1,
    label: 'Portrait',
    thumb: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=80&h=80&fit=crop&crop=face',
    before: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=700&h=525&fit=crop&crop=face',
    after: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=700&h=525&fit=crop&crop=face',
  },
  {
    id: 2,
    label: 'Animal',
    thumb: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=80&h=80&fit=crop',
    before: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=700&h=525&fit=crop',
    after: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=700&h=525&fit=crop',
  },
  {
    id: 3,
    label: 'Product',
    thumb: 'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=80&h=80&fit=crop',
    before: 'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=700&h=525&fit=crop',
    after: 'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=700&h=525&fit=crop',
  },
  {
    id: 4,
    label: 'Pet',
    thumb: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=80&h=80&fit=crop',
    before: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=700&h=525&fit=crop',
    after: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=700&h=525&fit=crop',
  },
  {
    id: 5,
    label: 'E-commerce',
    thumb: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=80&h=80&fit=crop',
    before: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=700&h=525&fit=crop',
    after: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=700&h=525&fit=crop',
  },
]

function ComparisonSlider({ before, after }: { before: string; after: string }) {
  const [pos, setPos] = useState(50)
  const boxRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const animDir = useRef(-1)
  const animPos = useRef(50)
  const userInteracted = useRef(false)

  const clamp = (v: number) => Math.max(2, Math.min(98, v))

  const applyPos = useCallback((clientX: number) => {
    if (!boxRef.current) return
    const rect = boxRef.current.getBoundingClientRect()
    setPos(clamp(((clientX - rect.left) / rect.width) * 100))
  }, [])

  // Auto-animate on mount
  useEffect(() => {
    animRef.current = setInterval(() => {
      if (userInteracted.current) return
      animPos.current += animDir.current * 0.5
      if (animPos.current <= 25) animDir.current = 1
      if (animPos.current >= 75) animDir.current = -1
      setPos(clamp(animPos.current))
    }, 16)
    // Stop after 6 seconds
    const stop = setTimeout(() => {
      if (animRef.current) clearInterval(animRef.current)
      setPos(50)
    }, 6000)
    return () => {
      if (animRef.current) clearInterval(animRef.current)
      clearTimeout(stop)
    }
  }, [before]) // re-run when image changes

  useEffect(() => {
    const onMove = (e: MouseEvent) => { if (dragging.current) applyPos(e.clientX) }
    const onTouch = (e: TouchEvent) => { if (dragging.current) applyPos(e.touches[0].clientX) }
    const onUp = () => { dragging.current = false }
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
  }, [applyPos])

  return (
    <div
      ref={boxRef}
      className="relative w-full rounded-2xl overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.5)] cursor-ew-resize select-none"
      style={{ aspectRatio: '4/3' }}
      onMouseDown={(e) => {
        dragging.current = true
        userInteracted.current = true
        if (animRef.current) clearInterval(animRef.current)
        applyPos(e.clientX)
      }}
      onTouchStart={(e) => {
        dragging.current = true
        userInteracted.current = true
        if (animRef.current) clearInterval(animRef.current)
        applyPos(e.touches[0].clientX)
      }}
    >
      {/* After (left — processed, dark checkerboard bg) */}
      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        {/* Checkerboard background for the "removed" side */}
        <div className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(45deg,#444 25%,transparent 25%),linear-gradient(-45deg,#444 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#444 75%),linear-gradient(-45deg,transparent 75%,#444 75%)`,
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0,0 10px,10px -10px,-10px 0',
            backgroundColor: '#333',
          }}
        />
        <img src={after} alt="Background removed" className="absolute inset-0 w-full h-full object-cover mix-blend-normal" draggable={false} />
      </div>

      {/* Before (right — original) */}
      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 0 0 ${pos}%)` }}
      >
        <img src={before} alt="Original" className="w-full h-full object-cover" draggable={false} />
      </div>

      {/* Divider line */}
      <div
        className="absolute top-0 bottom-0 w-[2px] bg-white/90 pointer-events-none"
        style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}
      />

      {/* Handle */}
      <div
        className="absolute top-1/2 pointer-events-none"
        style={{ left: `${pos}%`, transform: 'translate(-50%, -50%)' }}
      >
        <div className="w-11 h-11 rounded-full bg-white shadow-[0_4px_24px_rgba(0,0,0,0.4)] flex items-center justify-center transition-transform hover:scale-110">
          <svg className="w-5 h-5 text-gray-600" viewBox="0 0 20 20" fill="none">
            <path d="M6 4L2 10l4 6M14 4l4 6-4 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {/* Labels */}
      <span className="absolute bottom-3 left-3 text-[11px] font-bold tracking-wider uppercase bg-[rgba(0,194,122,0.8)] text-white px-3 py-1.5 rounded-full pointer-events-none backdrop-blur-sm">
        Removed
      </span>
      <span className="absolute bottom-3 right-3 text-[11px] font-bold tracking-wider uppercase bg-black/55 text-white px-3 py-1.5 rounded-full pointer-events-none backdrop-blur-sm">
        Original
      </span>
    </div>
  )
}

export default function StunningQuality() {
  const [activeId, setActiveId] = useState(1)
  const active = SAMPLES.find((s) => s.id === activeId)!

  return (
    <section className="bg-[#0f1117] py-20 px-5 overflow-hidden">
      <div className="max-w-5xl mx-auto">

        {/* Section label */}
        <div className="text-center mb-14">
          <span className="inline-block text-xs font-bold tracking-[2px] uppercase text-[#34d399] mb-3">
            Stunning Quality
          </span>
          <h2
            className="text-3xl sm:text-4xl font-black text-white mb-4"
            style={{ letterSpacing: '-1px' }}
          >
            Precision you can see.
          </h2>
          <p className="text-gray-400 text-lg max-w-md mx-auto leading-relaxed">
            Drag the slider to compare. Our AI handles hair, fur, and complex edges
            with sub-pixel accuracy — every time.
          </p>
        </div>

        {/* Main 2-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">

          {/* Left — feature list */}
          <div className="space-y-6">
            {[
              {
                color: 'rgba(52,211,153,0.15)',
                iconColor: '#34d399',
                title: 'Hair & Fine Detail',
                desc: 'Every strand, every whisker — preserved with surgical precision even on the most complex edges.',
                icon: (
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                    <polyline points="16 5 7 14 3 10" />
                  </svg>
                ),
              },
              {
                color: 'rgba(99,179,237,0.15)',
                iconColor: '#63b3ed',
                title: 'Transparent & Glass Objects',
                desc: 'Semi-transparent edges handled with genuine depth awareness and optical accuracy.',
                icon: (
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-5 h-5">
                    <circle cx="10" cy="10" r="8" />
                    <path d="M2 10h16M10 2a12 12 0 010 16M10 2a12 12 0 000 16" />
                  </svg>
                ),
              },
              {
                color: 'rgba(167,139,250,0.15)',
                iconColor: '#a78bfa',
                title: 'Instant AI Processing',
                desc: 'State-of-the-art WebAssembly segmentation running entirely in your browser — zero upload needed.',
                icon: (
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-5 h-5">
                    <path d="M11 2L3 11h7l-1 7 8-10h-7l1-6z" />
                  </svg>
                ),
              },
              {
                color: 'rgba(251,191,36,0.12)',
                iconColor: '#fbbf24',
                title: 'No Upload Required',
                desc: 'Everything runs in your browser via WebAssembly. Your images never leave your device.',
                icon: (
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-5 h-5">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
                    <path d="M8 12l2 2 4-4" />
                  </svg>
                ),
              },
            ].map((f) => (
              <div key={f.title} className="flex items-start gap-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: f.color, color: f.iconColor }}
                >
                  {f.icon}
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm mb-1">{f.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Right — slider + thumbnails */}
          <div className="flex flex-col gap-4">
            <ComparisonSlider key={activeId} before={active.before} after={active.after} />

            {/* Thumbnails */}
            <div className="flex gap-2.5 justify-center">
              {SAMPLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActiveId(s.id)}
                  className={`
                    w-14 h-14 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0
                    ${activeId === s.id
                      ? 'border-[#34d399] scale-105 shadow-[0_0_0_3px_rgba(52,211,153,0.25)]'
                      : 'border-transparent hover:border-[rgba(52,211,153,0.4)] hover:scale-105 opacity-60 hover:opacity-100'
                    }
                  `}
                >
                  <img src={s.thumb} alt={s.label} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>

            {/* Hint */}
            <p className="text-center text-xs text-gray-600 font-medium">
              ← Drag slider to compare · Click thumbnails to switch
            </p>
          </div>
        </div>

      </div>
    </section>
  )
}
