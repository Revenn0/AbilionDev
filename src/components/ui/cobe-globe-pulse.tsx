import { useCallback, useEffect, useRef, useState } from "react"
import createGlobe, { type Globe } from "cobe"
import { cn } from "@/lib/utils"

export interface PulseMarker {
  id: string
  location: [number, number]
  delay: number
  label?: string
  count?: number
}

interface GlobePulseProps {
  markers?: PulseMarker[]
  className?: string
  speed?: number
}

function phiFromLng(lng: number) {
  return ((270 - lng) * Math.PI) / 180
}

function thetaFromLat(lat: number) {
  return (lat * Math.PI) / 180 * 0.62
}

const BRAZIL_PHI = phiFromLng(-47.9)
const BRAZIL_THETA = thetaFromLat(-15.8)

function markerSize(count = 1) {
  return Math.min(0.07, 0.028 + Math.log2(count + 1) * 0.01)
}

function toCobeMarkers(markers: PulseMarker[]) {
  return markers.map((item) => ({
    location: item.location,
    size: markerSize(item.count),
    id: item.id,
  }))
}

function toCobeArcs(markers: PulseMarker[]) {
  const hub = markers[0]
  if (!hub || markers.length < 2) return []
  return markers.slice(1, 8).map((item) => ({
    from: hub.location,
    to: item.location,
    id: `arc-${item.id}`,
  }))
}

export function GlobePulse({ markers = [], className = "", speed = 0.003 }: GlobePulseProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const globeRef = useRef<Globe | null>(null)
  const pointerInteracting = useRef<{ x: number; y: number } | null>(null)
  const dragOffset = useRef({ phi: 0, theta: 0 })
  const phiOffsetRef = useRef(0)
  const thetaOffsetRef = useRef(0)
  const pausedRef = useRef(false)
  const markersRef = useRef(markers)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  markersRef.current = markers

  const handlePointerDown = useCallback((event: React.PointerEvent) => {
    pointerInteracting.current = { x: event.clientX, y: event.clientY }
    pausedRef.current = true
    if (hostRef.current) hostRef.current.style.cursor = "grabbing"
  }, [])

  const handlePointerUp = useCallback(() => {
    if (pointerInteracting.current !== null) {
      phiOffsetRef.current += dragOffset.current.phi
      thetaOffsetRef.current += dragOffset.current.theta
      dragOffset.current = { phi: 0, theta: 0 }
    }
    pointerInteracting.current = null
    pausedRef.current = false
    if (hostRef.current) hostRef.current.style.cursor = "grab"
  }, [])

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!pointerInteracting.current) return
      dragOffset.current = {
        phi: (event.clientX - pointerInteracting.current.x) / 300,
        theta: (event.clientY - pointerInteracting.current.y) / 1000,
      }
    }
    window.addEventListener("pointermove", onMove, { passive: true })
    window.addEventListener("pointerup", handlePointerUp, { passive: true })
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", handlePointerUp)
    }
  }, [handlePointerUp])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let globe: Globe | null = null
    let frame = 0
    const hub = markersRef.current[0]
    let phi = hub ? phiFromLng(hub.location[1]) : BRAZIL_PHI
    const baseTheta = hub ? thetaFromLat(hub.location[0]) : BRAZIL_THETA
    let canvas: HTMLCanvasElement | null = null
    let cancelled = false

    const syncPins = () => {
      const overlay = overlayRef.current
      if (!overlay || !host) return
      const pins = host.querySelectorAll<HTMLElement>("[style*='anchor-name']")
      const used = new Set<string>()
      pins.forEach((pin) => {
        const raw = pin.style.getPropertyValue("anchor-name") || (pin.style as CSSStyleDeclaration & { anchorName?: string }).anchorName || ""
        const id = raw.replace(/^--cobe-/, "").trim()
        if (!id || id.startsWith("arc-")) return
        used.add(id)
        const node = overlay.querySelector<HTMLElement>(`[data-pin="${id}"]`)
        if (!node) return
        node.style.left = pin.style.left
        node.style.top = pin.style.top
        const visible = getComputedStyle(document.documentElement).getPropertyValue(`--cobe-visible-${id}`).trim()
        node.dataset.visible = visible ? "1" : "0"
      })
      overlay.querySelectorAll<HTMLElement>("[data-pin]").forEach((node) => {
        if (!used.has(node.dataset.pin ?? "")) node.dataset.visible = "0"
      })
    }

    const start = () => {
      if (cancelled || globe || !host.offsetWidth) return
      canvas = document.createElement("canvas")
      canvas.style.cssText = "display:block;width:100%;height:100%;opacity:0;transition:opacity .45s ease"
      host.appendChild(canvas)
      const width = host.offsetWidth
      try {
        globe = createGlobe(canvas, {
          devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
          width,
          height: width,
          phi,
          theta: baseTheta,
          dark: 1,
          diffuse: 1.5,
          mapSamples: 18000,
          mapBrightness: 8,
          baseColor: [0.42, 0.42, 0.42],
          markerColor: [0.2, 0.8, 0.9],
          glowColor: [0.06, 0.08, 0.1],
          markerElevation: 0,
          markers: toCobeMarkers(markersRef.current),
          arcs: toCobeArcs(markersRef.current),
          arcColor: [0.3, 0.85, 0.95],
          arcWidth: 0.45,
          arcHeight: 0.22,
          opacity: 0.82,
          scale: 1.18,
          offset: [0, 18],
        })
      } catch {
        setFailed(true)
        return
      }
      globeRef.current = globe
      const tick = () => {
        if (!globe) return
        if (!pausedRef.current) phi += speed
        globe.update({
          phi: phi + phiOffsetRef.current + dragOffset.current.phi,
          theta: baseTheta + thetaOffsetRef.current + dragOffset.current.theta,
          markers: toCobeMarkers(markersRef.current),
          arcs: toCobeArcs(markersRef.current),
          scale: 1.18,
          offset: [0, 18],
        })
        syncPins()
        frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
      window.setTimeout(() => {
        if (canvas) canvas.style.opacity = "1"
        if (!cancelled) setReady(true)
      }, 40)
    }

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0
      if (width > 0 && !globe) start()
      else if (globe && width > 0) {
        globe.update({ width, height: width })
      }
    })
    observer.observe(host)
    if (host.offsetWidth > 0) start()

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      globe?.destroy()
      globe = null
      globeRef.current = null
      host.replaceChildren()
    }
  }, [speed])

  return (
    <div className={cn("relative aspect-square w-full select-none", className)}>
      <div
        ref={hostRef}
        className="absolute inset-0 cursor-grab overflow-hidden rounded-full"
        onPointerDown={handlePointerDown}
        style={{ touchAction: "none" }}
      />
      <div ref={overlayRef} className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
        {markers.map((marker) => (
          <div
            key={marker.id}
            data-pin={marker.id}
            data-visible="0"
            className="globe-pin absolute"
            style={{ animationDelay: `${marker.delay}s` }}
          >
            <span className="globe-ring" style={{ animationDelay: `${marker.delay}s` }} />
            <span className="globe-ring" style={{ animationDelay: `${marker.delay + 0.45}s` }} />
            <span className="globe-ring" style={{ animationDelay: `${marker.delay + 0.9}s` }} />
          </div>
        ))}
      </div>
      {!ready && !failed ? <div className="absolute inset-0 rounded-full bg-black/40" /> : null}
      {failed ? (
        <p className="absolute inset-0 grid place-items-center px-6 text-center text-[13px] text-zinc-400">
          O globo precisa de WebGL neste browser.
        </p>
      ) : null}
    </div>
  )
}
