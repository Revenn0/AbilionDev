import { useCallback, useEffect, useRef } from "react"
import createGlobe from "cobe"
import { cn } from "@/lib/utils"

export interface PulseMarker {
  id: string
  location: [number, number]
  delay: number
  label?: string
}

interface GlobePulseProps {
  markers?: PulseMarker[]
  className?: string
  speed?: number
  dark?: number
}

const defaultMarkers: PulseMarker[] = [
  { id: "pulse-1", location: [51.51, -0.13], delay: 0 },
  { id: "pulse-2", location: [40.71, -74.01], delay: 0.5 },
  { id: "pulse-3", location: [35.68, 139.65], delay: 1 },
  { id: "pulse-4", location: [-33.87, 151.21], delay: 1.5 },
]

export function GlobePulse({
  markers = defaultMarkers,
  className = "",
  speed = 0.003,
  dark = 1,
}: GlobePulseProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointerInteracting = useRef<{ x: number; y: number } | null>(null)
  const dragOffset = useRef({ phi: 0, theta: 0 })
  const phiOffsetRef = useRef(0)
  const thetaOffsetRef = useRef(0)
  const isPausedRef = useRef(false)

  const handlePointerDown = useCallback((event: React.PointerEvent) => {
    pointerInteracting.current = { x: event.clientX, y: event.clientY }
    if (canvasRef.current) canvasRef.current.style.cursor = "grabbing"
    isPausedRef.current = true
  }, [])

  const handlePointerUp = useCallback(() => {
    if (pointerInteracting.current !== null) {
      phiOffsetRef.current += dragOffset.current.phi
      thetaOffsetRef.current += dragOffset.current.theta
      dragOffset.current = { phi: 0, theta: 0 }
    }
    pointerInteracting.current = null
    if (canvasRef.current) canvasRef.current.style.cursor = "grab"
    isPausedRef.current = false
  }, [])

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (pointerInteracting.current !== null) {
        dragOffset.current = {
          phi: (event.clientX - pointerInteracting.current.x) / 300,
          theta: (event.clientY - pointerInteracting.current.y) / 1000,
        }
      }
    }
    window.addEventListener("pointermove", handlePointerMove, { passive: true })
    window.addEventListener("pointerup", handlePointerUp, { passive: true })
    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
    }
  }, [handlePointerUp])

  const markerKey = markers.map((item) => `${item.id}:${item.location[0]}:${item.location[1]}`).join("|")

  useEffect(() => {
    const node = canvasRef.current
    if (!node) return
    const surface: HTMLCanvasElement = node
    let globe: ReturnType<typeof createGlobe> | null = null
    let animationId = 0
    let phi = 0
    let resize: ResizeObserver | null = null
    let lastWidth = 0

    function init() {
      const width = Math.round(surface.offsetWidth)
      if (width === 0 || width === lastWidth) return
      lastWidth = width
      globe?.destroy()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      globe = createGlobe(surface, {
        devicePixelRatio: dpr,
        width: width * dpr,
        height: width * dpr,
        phi: 0,
        theta: 0.2,
        dark,
        diffuse: 1.5,
        mapSamples: 16000,
        mapBrightness: dark ? 10 : 8,
        baseColor: dark ? [0.5, 0.5, 0.5] : [0.92, 0.93, 0.96],
        markerColor: [0.2, 0.8, 0.9],
        glowColor: dark ? [0.05, 0.05, 0.05] : [0.94, 0.95, 0.97],
        markerElevation: 0,
        markers: markers.map((item) => ({ location: item.location, size: 0.025, id: item.id })),
        arcs: markers.slice(1, 6).map((item, index) => ({
          id: `arc-${index}`,
          from: markers[0]!.location,
          to: item.location,
        })),
        arcColor: [0.3, 0.85, 0.95],
        arcWidth: 0.45,
        arcHeight: 0.22,
        opacity: 0.75,
      })
      cancelAnimationFrame(animationId)
      const animate = () => {
        if (!isPausedRef.current) phi += speed
        globe?.update({
          phi: phi + phiOffsetRef.current + dragOffset.current.phi,
          theta: 0.2 + thetaOffsetRef.current + dragOffset.current.theta,
        })
        animationId = requestAnimationFrame(animate)
      }
      animate()
      surface.style.opacity = "1"
    }

    lastWidth = 0
    if (surface.offsetWidth > 0) init()
    resize = new ResizeObserver(() => {
      lastWidth = 0
      if (surface.offsetWidth > 0) init()
    })
    resize.observe(surface)

    return () => {
      resize?.disconnect()
      cancelAnimationFrame(animationId)
      globe?.destroy()
    }
  }, [markerKey, speed, dark])

  return (
    <div className={cn("relative aspect-square select-none", className)}>
      <style>{`
        @keyframes pulse-expand {
          0% { transform: scaleX(0.3) scaleY(0.3); opacity: 0.8; }
          100% { transform: scaleX(1.5) scaleY(1.5); opacity: 0; }
        }
      `}</style>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        style={{
          width: "100%",
          height: "100%",
          cursor: "grab",
          opacity: 0,
          transition: "opacity 1.2s ease",
          borderRadius: "50%",
          touchAction: "none",
        }}
      />
      {markers.map((item) => (
        <div
          key={item.id}
          style={{
            position: "absolute",
            positionAnchor: `--cobe-${item.id}`,
            bottom: "anchor(center)",
            left: "anchor(center)",
            translate: "-50% 50%",
            width: 40,
            height: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            opacity: `var(--cobe-visible-${item.id}, 0)`,
            filter: `blur(calc((1 - var(--cobe-visible-${item.id}, 0)) * 8px))`,
            transition: "opacity 0.4s, filter 0.4s",
          }}
        >
          <span
            style={{
              position: "absolute",
              inset: 0,
              border: "2px solid #33ccdd",
              borderRadius: "50%",
              opacity: 0,
              animation: `pulse-expand 2s ease-out infinite ${item.delay}s`,
            }}
          />
          <span
            style={{
              position: "absolute",
              inset: 0,
              border: "2px solid #33ccdd",
              borderRadius: "50%",
              opacity: 0,
              animation: `pulse-expand 2s ease-out infinite ${item.delay + 0.5}s`,
            }}
          />
          <span
            style={{
              width: 10,
              height: 10,
              background: "#33ccdd",
              borderRadius: "50%",
              boxShadow: "0 0 0 3px #111, 0 0 0 5px #33ccdd",
            }}
          />
        </div>
      ))}
    </div>
  )
}
