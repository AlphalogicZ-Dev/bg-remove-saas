'use client'

import { useRef, useEffect, useState, useCallback } from 'react'

/*
 * The "after" image is produced by running @imgly/background-removal WASM
 * on the exact same "before" image URL — no different photos, no CSS tricks.
 * Results are cached in a module-level Map so the model only runs once per image.
 */

const SAMPLES = [
  {
    id: 1,
    label: 'Portrait',
    thumb: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=80&h=80&fit=crop&crop=face',
    src: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&h=600&fit=crop&crop=face',
  },
  {
    id: 2,
    label: 'Animal',
    thumb: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=80&h=80&fit=crop',
    src: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=800&h=600&fit=crop',
  },
  {
    id: 3,
    label: 'Product',
    thumb: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=80&h=80&fit=crop',
    src: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&h=600&fit=crop',
  },
  {
    id: 4,
    label: 'Pet',
    thumb: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=80&h=80&fit=crop',
    src: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800&h=600&fit=crop',
  },
  {
    id: 5,
    label: 'E-commerce',
    thumb: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=80&h=80&fit=crop',
    src: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&h=600&fit=crop',
  },
]

// Module-level cache — persists across re-renders
const resultCache = new Map<string, string>()

async function getProcessed(src: string, onProgress?: (pct: number) => void): Promise<string> {
  if (resultCache.has(src)) return resultCache.get(src)!

  // Fetch the image via the browser (Unsplash serves CORS-safe responses)
  const res = await fetch(src)
  const blob = await res.blob()

  const { removeBackground } = await import('@imgly/background-removal')
  const resultBlob = await removeBackground(blob, {
    model: 'medium',
    output: { format: 'image/png', quality: 1.0 },
    progress: (_key: string, current: number, total: number) => {
      if (total > 0) onProgress?.(Math.round((current / total) * 100))
    },
  })

  const url = URL.createObjectURL(resultBlob)
  resultCache.set(src, url)
  return url
}

// Classic transparency checkerboard — light variant
const CHECKER_STYLE: React.CSSProperties = {
  backgroundColor: '#f8f8f8',
  backgroundImage: [
    'linear-gradient(45deg, #e0e0e0 25%, transparent 25%)',
    'linear-gradient(-45deg, #e0e0e0 25%, transparent 25%)',
    'linear-gradient(45deg, transparent 75%, #e0e0e0 75%)',
    'linear-gradient(-45deg, transparent 75%, #e0e0e0 75%)',
  ].join(','),
  backgroundSize: '20px 20px',
  backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0',
}

// ─────────────────────────────────────────────────────────
// Comparison slider — before (left) / after (right)
// ─────────────────────────────────────────────────────────
function ComparisonSlider({
  before,
  after,
  processing,
  progress,
}: {
  before: string
  after: string | null
  processing: boolean
  progress: number
}) {
  const [pos, setPos] = useState(50)
  const boxRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const animPos = useRef(50)
  const animDir = useRef<1 | -1>(-1)
  const interacted = useRef(false)

  const clamp = (v: number) => Math.max(2, Math.min(98, v))

  const applyPos = useCallback((clientX: number) => {
    if (!boxRef.current) return
    const rect = boxRef.current.getBoundingClientRect()
    setPos(clamp(((clientX - rect.left) / rect.width) * 100))
  }, [])

  // Restart animation whenever a new "after" result arrives
  useEffect(() => {
    if (!after) return
    interacted.current = false
    animPos.current = 50
    animDir.current = -1
    setPos(50)

    animRef.current = setInterval(() => {
      if (interacted.current) return
      animPos.current += animDir.current * 0.35
      if (animPos.current <= 15) animDir.current = 1
      if (animPos.current >= 85) animDir.current = -1
      setPos(clamp(animPos.current))
    }, 16)

    const stop = setTimeout(() => {
      if (animRef.current) clearInterval(animRef.current)
      setPos(50)
    }, 7000)

    return () => {
      if (animRef.current) clearInterval(animRef.current)
      clearTimeout(stop)
    }
  }, [after])

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
      className="relative w-full rounded-2xl overflow-hidden select-none"
      style={{
        aspectRatio: '4/3',
        boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)',
        cursor: after ? 'ew-resize' : 'default',
      }}
      onMouseDown={(e) => {
        if (!after) return
        dragging.current = true
        interacted.current = true
        if (animRef.current) clearInterval(animRef.current)
        applyPos(e.clientX)
      }}
      onTouchStart={(e) => {
        if (!after) return
        dragging.current = true
        interacted.current = true
        if (animRef.current) clearInterval(animRef.current)
        applyPos(e.touches[0].clientX)
      }}
    >
      {/* ── AFTER SIDE (left — real transparent PNG on checkerboard) ── */}
      <div
        className="absolute inset-0"
        style={{ clipPath: after ? `inset(0 ${100 - pos}% 0 0)` : 'inset(0 100% 0 0)' }}
      >
        <div className="absolute inset-0" style={CHECKER_STYLE} />
        {after && (
          <img
            src={after}
            alt="Background removed"
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
          />
        )}
      </div>

      {/* ── BEFORE SIDE (right — original) ── */}
      <div
        className="absolute inset-0"
        style={{ clipPath: after ? `inset(0 0 0 ${pos}%)` : 'inset(0)' }}
      >
        <img
          src={before}
          alt="Original"
          className="w-full h-full object-cover"
          draggable={false}
        />
      </div>

      {/* ── Processing overlay ── */}
      {processing && (
        <div className="absolute inset-0 bg-[#0f1117]/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-10">
          <div className="w-10 h-10 rounded-full border-[2.5px] border-[#ff0f50] border-t-transparent animate-spin" />
          <div className="text-center">
            <p className="text-white text-sm font-semibold mb-2">Removing background…</p>
            {progress > 0 && (
              <div className="w-48 bg-white/10 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full bg-[#ff0f50] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
            {progress === 0 && (
              <p className="text-gray-500 text-xs">Loading AI model…</p>
            )}
          </div>
        </div>
      )}

      {/* ── Divider + Handle (only when result is ready) ── */}
      {after && (
        <>
          <div
            className="absolute top-0 bottom-0 w-[2px] bg-white pointer-events-none"
            style={{
              left: `${pos}%`,
              transform: 'translateX(-50%)',
              boxShadow: '0 0 12px rgba(0,0,0,0.5)',
            }}
          />
          <div
            className="absolute top-1/2 pointer-events-none"
            style={{ left: `${pos}%`, transform: 'translate(-50%, -50%)' }}
          >
            <div className="w-11 h-11 rounded-full bg-white flex items-center justify-center shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
              <svg className="w-5 h-5 text-gray-500" viewBox="0 0 20 20" fill="none">
                <path d="M6 4L2 10l4 6M14 4l4 6-4 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </>
      )}

      {/* ── Labels ── */}
      {after && (
        <>
          <span className="absolute bottom-3 left-3 text-[11px] font-bold tracking-widest uppercase bg-[#ff0f50] text-white px-3 py-1.5 rounded-full pointer-events-none shadow-lg">
            Removed
          </span>
          <span className="absolute bottom-3 right-3 text-[11px] font-bold tracking-widest uppercase bg-black/60 text-white px-3 py-1.5 rounded-full pointer-events-none backdrop-blur-sm">
            Original
          </span>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Main Section
// ─────────────────────────────────────────────────────────
export default function StunningQuality() {
  const [activeId, setActiveId] = useState(1)
  // afterUrl: null = not processed yet, '' = processing, string = done
  const [afterMap, setAfterMap] = useState<Record<number, string | null>>({})
  const [progressMap, setProgressMap] = useState<Record<number, number>>({})
  const processingRef = useRef<Set<number>>(new Set())

  const active = SAMPLES.find((s) => s.id === activeId)!
  const afterUrl = afterMap[activeId] ?? null
  const isProcessing = processingRef.current.has(activeId)
  const progress = progressMap[activeId] ?? 0

  const processActive = useCallback(async (id: number, src: string) => {
    if (processingRef.current.has(id) || resultCache.has(src)) return
    processingRef.current.add(id)
    setAfterMap((m) => ({ ...m, [id]: null })) // trigger processing state
    try {
      const url = await getProcessed(src, (pct) => {
        setProgressMap((m) => ({ ...m, [id]: pct }))
      })
      setAfterMap((m) => ({ ...m, [id]: url }))
    } catch (err) {
      console.error('[BgErase demo]', err)
    } finally {
      processingRef.current.delete(id)
    }
  }, [])

  // Start processing active sample on mount + on switch
  useEffect(() => {
    if (!afterMap[activeId] && !processingRef.current.has(activeId)) {
      processActive(activeId, active.src)
    }
    // Pre-fetch next sample quietly
    const next = SAMPLES.find((s) => s.id > activeId)
    if (next && !afterMap[next.id] && !processingRef.current.has(next.id)) {
      processActive(next.id, next.src)
    }
  }, [activeId, active.src, afterMap, processActive])

  return (
    <section className="bg-[#0f1117] py-24 px-5 overflow-hidden">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-[3px] uppercase text-[#FFD60A] mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FFD60A]" />
            Stunning Quality
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4" style={{ letterSpacing: '-1px' }}>
            Precision you can see.
          </h2>
          <p className="text-gray-400 text-lg max-w-md mx-auto leading-relaxed">
            Drag the slider to compare. The AI runs live in your browser — no servers, no uploads, no tricks.
          </p>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">

          {/* Left — features */}
          <div className="space-y-7 lg:pt-2">
            {[
              {
                color: 'rgba(255,15,80,0.12)',
                iconColor: '#ff0f50',
                title: 'Hair & Fine Detail',
                desc: 'Every strand, every whisker — preserved with surgical precision even on the most complex edges.',
                icon: <path d="M3 10l4 4 10-10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
                vb: '0 0 20 20',
              },
              {
                color: 'rgba(255,214,10,0.10)',
                iconColor: '#FFD60A',
                title: 'Transparent & Glass Objects',
                desc: 'Semi-transparent edges handled with genuine depth awareness and optical accuracy.',
                icon: <><circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.8" /><path d="M2 10h16M10 2a12 12 0 010 16M10 2a12 12 0 000 16" stroke="currentColor" strokeWidth="1.8" /></>,
                vb: '0 0 20 20',
              },
              {
                color: 'rgba(167,139,250,0.12)',
                iconColor: '#a78bfa',
                title: 'Runs Entirely In Your Browser',
                desc: 'State-of-the-art WebAssembly segmentation — zero upload, zero server, 100% private.',
                icon: <path d="M11 2L3 11h7l-1 7 8-10h-7l1-6z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />,
                vb: '0 0 20 20',
              },
              {
                color: 'rgba(255,255,255,0.05)',
                iconColor: '#ffffff',
                title: 'HD PNG Output',
                desc: 'Download crisp, full-resolution transparent PNGs — no compression artifacts, no watermarks.',
                icon: <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
                vb: '0 0 24 24',
              },
            ].map((f) => (
              <div key={f.title} className="flex items-start gap-4 group">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 transition-transform group-hover:scale-110"
                  style={{ background: f.color, color: f.iconColor }}
                >
                  <svg viewBox={f.vb} fill="none" className="w-5 h-5">
                    {f.icon}
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm mb-1">{f.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Right — slider + thumbnails */}
          <div className="flex flex-col gap-5">
            <ComparisonSlider
              key={activeId}
              before={active.src}
              after={afterMap[activeId] ?? null}
              processing={isProcessing || (afterMap[activeId] === null && processingRef.current.has(activeId))}
              progress={progress}
            />

            {/* Thumbnails */}
            <div className="flex gap-2.5 justify-center">
              {SAMPLES.map((s) => {
                const done = !!afterMap[s.id]
                const pending = processingRef.current.has(s.id)
                return (
                  <button
                    key={s.id}
                    onClick={() => setActiveId(s.id)}
                    className={`
                      relative w-14 h-14 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0
                      ${activeId === s.id
                        ? 'border-[#ff0f50] scale-105 shadow-[0_0_0_3px_rgba(255,15,80,0.25)]'
                        : 'border-transparent hover:border-[rgba(255,15,80,0.4)] hover:scale-105 opacity-55 hover:opacity-100'
                      }
                    `}
                    aria-label={s.label}
                  >
                    <img src={s.thumb} alt={s.label} className="w-full h-full object-cover" />
                    {/* Tiny processing dot */}
                    {pending && !done && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#FFD60A] animate-pulse" />
                    )}
                    {done && activeId !== s.id && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#ff0f50]" />
                    )}
                  </button>
                )
              })}
            </div>

            <p className="text-center text-xs text-gray-600 font-medium tracking-wide">
              ← Drag slider to compare · Click thumbnails to switch
            </p>
          </div>
        </div>

      </div>
    </section>
  )
}
