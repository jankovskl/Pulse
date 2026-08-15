import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { RotateCw, X } from 'lucide-react'

const SIZE = 512 // exported image size in px

// Keeps the image covering the square while panning.
function clampOffset(off, img, zoom, rotate) {
  if (!img) return off
  const iw = rotate % 180 ? img.naturalHeight : img.naturalWidth
  const ih = rotate % 180 ? img.naturalWidth : img.naturalHeight
  const cover = Math.max(SIZE / iw, SIZE / ih) * zoom
  const mx = Math.max(0, (iw * cover - SIZE) / 2)
  const my = Math.max(0, (ih * cover - SIZE) / 2)
  return {
    x: Math.min(mx, Math.max(-mx, off.x)),
    y: Math.min(my, Math.max(-my, off.y)),
  }
}

// Square avatar cropper: drag to pan, slider to zoom, rotate in 90° steps.
// Shown inside a circular frame (avatars render round) and exported as a
// 512×512 JPEG blob via onConfirm.
export default function AvatarCropper({ src, onConfirm, onCancel, busy = false }) {
  const canvasRef = useRef(null)
  const imgRef = useRef(null)
  const dragRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [rotate, setRotate] = useState(0)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  // Load the picked image.
  useEffect(() => {
    setReady(false)
    setFailed(false)
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      setReady(true)
    }
    img.onerror = () => setFailed(true)
    img.src = src
    return () => {
      img.onload = null
      img.onerror = null
    }
  }, [src])

  // Re-clamp the pan whenever zoom/rotate shrink the allowed range.
  useEffect(() => {
    setOffset((o) => clampOffset(o, imgRef.current, zoom, rotate))
  }, [zoom, rotate, ready])

  // Redraw the canvas on any transform change.
  useEffect(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img || !ready) return
    const ctx = canvas.getContext('2d')
    const iw = rotate % 180 ? img.naturalHeight : img.naturalWidth
    const ih = rotate % 180 ? img.naturalWidth : img.naturalHeight
    const cover = Math.max(SIZE / iw, SIZE / ih) * zoom
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, SIZE, SIZE)
    ctx.save()
    ctx.translate(SIZE / 2 + offset.x, SIZE / 2 + offset.y)
    ctx.rotate((rotate * Math.PI) / 180)
    ctx.drawImage(
      img,
      (-img.naturalWidth * cover) / 2,
      (-img.naturalHeight * cover) / 2,
      img.naturalWidth * cover,
      img.naturalHeight * cover,
    )
    ctx.restore()
  }, [ready, zoom, rotate, offset])

  function onPointerDown(e) {
    if (!ready) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
  }

  function onPointerMove(e) {
    const d = dragRef.current
    if (!d) return
    const rect = canvasRef.current.getBoundingClientRect()
    const k = SIZE / rect.width // css px -> canvas px
    setOffset(
      clampOffset(
        { x: d.ox + (e.clientX - d.x) * k, y: d.oy + (e.clientY - d.y) * k },
        imgRef.current,
        zoom,
        rotate,
      ),
    )
  }

  function onPointerUp() {
    dragRef.current = null
  }

  function confirm() {
    canvasRef.current?.toBlob((blob) => {
      if (blob) onConfirm(blob)
    }, 'image/jpeg', 0.92)
  }

  // Portal to <body> so the backdrop-blur actually reaches the app behind —
  // an ancestor's blur filter would otherwise trap this overlay in its own
  // flattened layer (e.g. the Auth modal's blurred content).
  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-overlay backdrop-blur-md">
      <div className="flex items-center justify-between p-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-[16px] font-semibold text-soft">Crop photo</span>
          <span className="text-[12px] text-muted">Drag to move · slider to zoom</span>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-tile"
        >
          <X size={16} color="var(--color-sub)" />
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center p-4">
        <div className="flex min-h-[240px] min-w-[240px] items-center justify-center overflow-hidden rounded-full outline outline-2 outline-accent/40 md:min-h-[340px] md:min-w-[340px]" style={{ width: 'min(78vw, 78vh, 420px)', height: 'min(78vw, 78vh, 420px)' }}>
          <canvas
            ref={canvasRef}
            width={SIZE}
            height={SIZE}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
          />
        </div>
      </div>

      {failed && (
        <span className="text-center text-[12px] text-[#FF7A7D]">
          Couldn't read that image — try a different file.
        </span>
      )}

      <div className="mx-auto flex w-full max-w-[440px] flex-col gap-4 p-4 pb-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setRotate((r) => (r + 90) % 360)
              setOffset({ x: 0, y: 0 })
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tile"
            title="Rotate 90°"
          >
            <RotateCw size={15} color="var(--color-sub)" />
          </button>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-[var(--color-accent)]"
            aria-label="Zoom"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-[24px] bg-tile px-5 text-[13px] text-soft"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!ready || busy}
            className="h-10 rounded-[24px] bg-accent px-5 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save photo'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
