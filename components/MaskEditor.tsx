'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { loadSam, segmentWithClicks, isSamLoaded, clearEmbeddingCache } from '@/lib/mobileSam'
import { defringeWithMask } from '@/lib/defringe'
import type { ClickPrompt } from '@/lib/mobileSam'

// ── Types ─────────────────────────────────────────────────────────────────────

type Mode = 'sam-add' | 'sam-remove' | 'brush' | 'erase'

interface Props {
  originalFile: File
  processedBlob: Blob
  onApply: (blob: Blob, url: string) => void
  onClose: () => void
}

// ── Checkerboard background ───────────────────────────────────────────────────

function drawCheckerboard(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  w: number, h: number
): void {
  const tile = Math.max(8, Math.round(Math.min(w, h) * 0.018))
  for (let ty = 0; ty * tile < h; ty++) {
    for (let tx = 0; tx * tile < w; tx++) {
      ctx.fillStyle = (tx + ty) % 2 === 0 ? '#d8d8d8' : '#aaaaaa'
      ctx.fillRect(tx * tile, ty * tile, tile, tile)
    }
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MaskEditor({ originalFile, processedBlob, onApply, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Image state — all full-resolution data
  type ImgState = {
    w: number
    h: number
    orig: Uint8ClampedArray   // original RGB pixels
    mask: Uint8Array          // editable alpha mask [0,255], one per pixel
  }
  const imgRef = useRef<ImgState | null>(null)
  const cacheKeyRef = useRef<string>(crypto.randomUUID())

  // Interaction state
  const [mode, setMode] = useState<Mode>('sam-add')
  const brushSizeRef = useRef(24)
  const [brushSize, setBrushSize] = useState(24)
  const [samReady, setSamReady] = useState(isSamLoaded())
  const [samStatus, setSamStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [applying, setApplying] = useState(false)
  const isPainting = useRef(false)
  const lastPaint = useRef<{ x: number; y: number } | null>(null)
  const modeRef = useRef<Mode>('sam-add')

  // SAM click accumulation
  const clicksRef = useRef<ClickPrompt[]>([])

  // ── Keep modeRef in sync ────────────────────────────────────────────────────
  useEffect(() => { modeRef.current = mode }, [mode])
  useEffect(() => { brushSizeRef.current = brushSize }, [brushSize])

  // ── Initialize from blobs ───────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [procBmp, origBmp] = await Promise.all([
        createImageBitmap(processedBlob),
        createImageBitmap(originalFile),
      ])
      const { width: w, height: h } = procBmp

      const offC   = new OffscreenCanvas(w, h)
      const offCtx = offC.getContext('2d')!

      // Extract alpha from processed blob
      offCtx.drawImage(procBmp, 0, 0)
      const procData = offCtx.getImageData(0, 0, w, h)
      const mask = new Uint8Array(w * h)
      for (let i = 0; i < w * h; i++) mask[i] = procData.data[i * 4 + 3]

      // Extract original colours
      offCtx.clearRect(0, 0, w, h)
      offCtx.drawImage(origBmp, 0, 0)
      const origData = offCtx.getImageData(0, 0, w, h)

      if (!cancelled) {
        imgRef.current = { w, h, orig: origData.data, mask }
        render()
      }
    })()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render canvas ───────────────────────────────────────────────────────────
  const render = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return

    const { w, h, orig, mask } = img
    canvas.width  = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!

    // 1. Checkerboard (transparent indicator)
    drawCheckerboard(ctx, w, h)

    // 2. Composite: original colours masked by current alpha
    const offC   = new OffscreenCanvas(w, h)
    const offCtx = offC.getContext('2d')!
    const id     = offCtx.createImageData(w, h)
    const d      = id.data
    for (let i = 0; i < w * h; i++) {
      d[i * 4]     = orig[i * 4]
      d[i * 4 + 1] = orig[i * 4 + 1]
      d[i * 4 + 2] = orig[i * 4 + 2]
      d[i * 4 + 3] = mask[i]
    }
    offCtx.putImageData(id, 0, 0)
    ctx.drawImage(offC, 0, 0)

    // 3. Dim excluded areas slightly so the boundary is obvious
    // (draw original at 20% opacity everywhere, then multiply by mask — done above)
    // Actually the alpha already handles this — excluded pixels are checkerboard.
  }, [])

  // ── Load SAM model on mount ─────────────────────────────────────────────────
  useEffect(() => {
    if (isSamLoaded()) { setSamReady(true); return }
    loadSam((stage) => setSamStatus(stage))
      .then(() => { setSamReady(true); setSamStatus('') })
      .catch((e) => {
        console.error('[SAM] load error', e)
        setSamStatus('Smart selection unavailable — use brush tools')
      })
  }, [])

  // ── Image→canvas coord mapping ──────────────────────────────────────────────
  function toImageCoords(e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } {
    const rect  = e.currentTarget.getBoundingClientRect()
    const scaleX = (imgRef.current?.w ?? 1) / rect.width
    const scaleY = (imgRef.current?.h ?? 1) / rect.height
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top)  * scaleY),
    }
  }

  // ── Brush paint / erase ─────────────────────────────────────────────────────
  function paintAt(x: number, y: number, erase: boolean) {
    const img = imgRef.current
    if (!img) return
    const { w, h, mask } = img
    const r = Math.round(brushSizeRef.current / 2)

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > r) continue
        const nx = x + dx, ny = y + dy
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        // Soft falloff from center
        const strength = Math.max(0, 1 - dist / r)
        const i = ny * w + nx
        if (erase) {
          mask[i] = Math.max(0, mask[i] - Math.round(strength * 255))
        } else {
          mask[i] = Math.min(255, mask[i] + Math.round(strength * 255))
        }
      }
    }
    render()
  }

  // ── Interpolate between two paint points (smooth stroke) ───────────────────
  function paintStroke(from: { x: number; y: number }, to: { x: number; y: number }, erase: boolean) {
    const dx = to.x - from.x, dy = to.y - from.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const steps = Math.max(1, Math.ceil(dist / (brushSizeRef.current * 0.3)))
    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      paintAt(Math.round(from.x + dx * t), Math.round(from.y + dy * t), erase)
    }
  }

  // ── Mouse handlers ──────────────────────────────────────────────────────────
  const handleMouseDown = useCallback(async (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (busy || applying) return
    const { x, y } = toImageCoords(e)
    const m = modeRef.current

    if (m === 'brush' || m === 'erase') {
      isPainting.current = true
      lastPaint.current  = { x, y }
      paintAt(x, y, m === 'erase')
      return
    }

    // SAM click
    if (!samReady) {
      setSamStatus('Model still loading…')
      return
    }
    if (!imgRef.current) return

    setBusy(true)
    setSamStatus('Selecting…')

    const newClick: ClickPrompt = { x, y, add: m === 'sam-add' }
    clicksRef.current = [...clicksRef.current, newClick]

    try {
      const result = await segmentWithClicks(originalFile, cacheKeyRef.current, clicksRef.current)
      const img = imgRef.current
      if (!img) return

      // Merge SAM binary mask into current alpha
      const { mask, width: mw, height: mh } = result
      // Scale mask if dimensions differ (shouldn't, but guard anyway)
      if (mw === img.w && mh === img.h) {
        for (let i = 0; i < img.w * img.h; i++) {
          if (newClick.add) {
            img.mask[i] = mask[i] === 255 ? 255 : img.mask[i]
          } else {
            img.mask[i] = mask[i] === 255 ? 0   : img.mask[i]
          }
        }
      }
      render()
      setSamStatus(`Score: ${(result.score * 100).toFixed(0)}% — click again to refine`)
    } catch (err) {
      console.error('[SAM]', err)
      setSamStatus('Selection failed — try again or use brush')
      clicksRef.current = clicksRef.current.slice(0, -1) // rollback
    } finally {
      setBusy(false)
    }
  }, [samReady, busy, applying, originalFile]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPainting.current) return
    const { x, y } = toImageCoords(e)
    const m = modeRef.current
    if (m !== 'brush' && m !== 'erase') return
    if (lastPaint.current) {
      paintStroke(lastPaint.current, { x, y }, m === 'erase')
    } else {
      paintAt(x, y, m === 'erase')
    }
    lastPaint.current = { x, y }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleMouseUp = useCallback(() => {
    isPainting.current = false
    lastPaint.current  = null
  }, [])

  // ── Reset SAM clicks when switching to/from SAM mode ───────────────────────
  const setModeAndReset = (m: Mode) => {
    if (m !== modeRef.current) {
      if ((m === 'sam-add' || m === 'sam-remove') &&
          (modeRef.current === 'sam-add' || modeRef.current === 'sam-remove')) {
        // Switching between add/remove keeps existing clicks — accumulation continues
      } else {
        // Switching to/from brush clears SAM click history for cleanliness
        clicksRef.current = []
        setSamStatus('')
      }
    }
    setMode(m)
  }

  // ── Apply ─────────────────────────────────────────────────────────────────
  const handleApply = useCallback(async () => {
    const img = imgRef.current
    if (!img || applying) return
    setApplying(true)
    try {
      const blob = await defringeWithMask(img.mask, img.w, img.h, originalFile)
      const url  = URL.createObjectURL(blob)
      onApply(blob, url)
    } catch (err) {
      console.error('[Apply]', err)
    } finally {
      setApplying(false)
    }
  }, [applying, originalFile, onApply])

  // ── Fill all / Clear all helpers ────────────────────────────────────────────
  const fillAll = () => {
    const img = imgRef.current
    if (!img) return
    img.mask.fill(255)
    clicksRef.current = []
    render()
  }
  const clearAll = () => {
    const img = imgRef.current
    if (!img) return
    img.mask.fill(0)
    clicksRef.current = []
    render()
  }

  // ── Cursor style ────────────────────────────────────────────────────────────
  const cursor = (mode === 'brush' || mode === 'erase')
    ? 'crosshair'
    : busy ? 'wait' : 'cell'

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-5xl max-h-[95vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
          <h2 className="font-semibold text-gray-800 text-sm">Edit Mask</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={applying || busy}
              className="text-xs bg-[#ff0f50] hover:bg-[#e0003d] disabled:opacity-50 text-white px-4 py-1.5 rounded-lg font-semibold transition-colors shadow-sm"
            >
              {applying ? 'Applying…' : 'Apply'}
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* Sidebar */}
          <div className="w-44 shrink-0 border-r border-gray-100 flex flex-col gap-4 p-4 bg-gray-50">

            {/* Tool group: SAM */}
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                AI Selection
              </p>
              <div className="flex flex-col gap-1">
                <ToolButton
                  active={mode === 'sam-add'}
                  onClick={() => setModeAndReset('sam-add')}
                  icon={<WandIcon />}
                  label="Add region"
                  disabled={!samReady}
                />
                <ToolButton
                  active={mode === 'sam-remove'}
                  onClick={() => setModeAndReset('sam-remove')}
                  icon={<WandMinusIcon />}
                  label="Remove region"
                  disabled={!samReady}
                />
              </div>
              {!samReady && (
                <p className="text-[10px] text-gray-400 mt-1.5 leading-snug">{samStatus || 'Loading…'}</p>
              )}
              {samReady && samStatus && (
                <p className="text-[10px] text-gray-500 mt-1.5 leading-snug">{samStatus}</p>
              )}
            </div>

            {/* Tool group: Manual */}
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                Manual
              </p>
              <div className="flex flex-col gap-1">
                <ToolButton
                  active={mode === 'brush'}
                  onClick={() => setModeAndReset('brush')}
                  icon={<BrushIcon />}
                  label="Paint keep"
                />
                <ToolButton
                  active={mode === 'erase'}
                  onClick={() => setModeAndReset('erase')}
                  icon={<EraserIcon />}
                  label="Erase"
                />
              </div>
            </div>

            {/* Brush size */}
            {(mode === 'brush' || mode === 'erase') && (
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Brush size
                </p>
                <input
                  type="range" min={4} max={120} value={brushSize}
                  onChange={e => setBrushSize(Number(e.target.value))}
                  className="w-full accent-[#ff0f50]"
                />
                <p className="text-[10px] text-gray-400 mt-0.5 text-right">{brushSize}px</p>
              </div>
            )}

            {/* Quick fills */}
            <div className="mt-auto flex flex-col gap-1">
              <button onClick={fillAll} className="text-[11px] text-gray-500 hover:text-gray-800 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                Keep all
              </button>
              <button onClick={clearAll} className="text-[11px] text-gray-500 hover:text-gray-800 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                Clear all
              </button>
            </div>
          </div>

          {/* Canvas area */}
          <div className="flex-1 overflow-auto bg-[#1a1a1a] flex items-center justify-center p-2">
            <canvas
              ref={canvasRef}
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', cursor }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              draggable={false}
            />
            {busy && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-black/60 rounded-full px-4 py-2 text-white text-xs font-medium flex items-center gap-2">
                  <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                  Selecting…
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer hint */}
        <div className="px-5 py-2 border-t border-gray-100 shrink-0 text-[11px] text-gray-400 text-center">
          {(mode === 'sam-add' || mode === 'sam-remove')
            ? 'Click on image to select regions with AI — click multiple times to refine'
            : 'Drag to paint. Hold Shift for straight lines.'}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ToolButton({
  active, onClick, icon, label, disabled,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 text-left text-xs px-2.5 py-2 rounded-lg w-full transition-colors font-medium
        ${active
          ? 'bg-[#ff0f50] text-white shadow-sm'
          : disabled
            ? 'text-gray-300 cursor-not-allowed'
            : 'text-gray-600 hover:bg-gray-200'
        }`}
    >
      <span className="w-4 h-4 shrink-0 flex items-center justify-center">{icon}</span>
      {label}
    </button>
  )
}

function WandIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
    </svg>
  )
}

function WandMinusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 12h4" />
    </svg>
  )
}

function BrushIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
    </svg>
  )
}

function EraserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12l-8 8M9 3l12 12-5 5H5l-2-2V9l6-6z" />
    </svg>
  )
}
