import { useCallback, useEffect, useRef } from "react"
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

const BRAZIL_PHI = 0.82
const BRAZIL_THETA = -0.08

const LAND: [number, number][] = [
  [-23.55, -46.63], [-22.91, -43.17], [-15.78, -47.93], [-12.97, -38.5], [-3.72, -38.54],
  [-3.12, -60.02], [-8.05, -34.9], [-19.92, -43.94], [-25.43, -49.27], [-30.03, -51.23],
  [-1.46, -48.5], [0.03, -51.05], [-16.68, -49.25], [-20.46, -54.61], [-27.59, -48.55],
  [-9.97, -67.81], [-8.76, -63.9], [-5.09, -42.8], [-7.12, -34.86], [-10.91, -37.07],
  [-2.53, -44.3], [-20.32, -40.34], [-10.18, -48.33], [2.82, -60.67], [-15.6, -56.1],
  [-34.6, -58.38], [-31.4, -64.18], [-32.95, -60.64], [-33.45, -70.67], [-23.65, -70.4],
  [-12.05, -77.04], [-16.5, -68.15], [-17.8, -63.18], [-25.3, -57.64], [4.71, -74.07],
  [-0.18, -78.47], [-2.17, -79.9], [10.48, -66.9], [10.65, -71.61], [8.98, -79.52],
  [19.43, -99.13], [20.67, -103.35], [25.67, -100.31], [21.16, -86.85], [23.11, -82.37],
  [18.47, -69.9], [18.47, -66.12], [25.76, -80.19], [29.76, -95.37], [32.78, -96.8],
  [34.05, -118.24], [37.77, -122.42], [47.61, -122.33], [41.88, -87.63], [40.71, -74.01],
  [42.36, -71.06], [38.91, -77.04], [39.95, -75.17], [33.75, -84.39], [45.5, -73.57],
  [43.65, -79.38], [49.28, -123.12], [53.55, -113.49], [45.42, -75.7], [51.51, -0.13],
  [53.48, -2.24], [55.86, -4.25], [53.35, -6.26], [48.86, 2.35], [45.76, 4.84],
  [43.3, 5.37], [41.39, 2.16], [40.42, -3.7], [38.72, -9.14], [41.15, -8.61],
  [41.9, 12.5], [45.46, 9.19], [43.77, 11.25], [38.12, 13.36], [52.52, 13.4],
  [48.21, 16.37], [50.08, 14.44], [52.23, 21.01], [47.5, 19.04], [44.43, 26.1],
  [52.37, 4.9], [50.85, 4.35], [55.68, 12.57], [59.33, 18.07], [60.17, 24.94],
  [59.91, 10.75], [55.76, 37.62], [59.93, 30.32], [50.45, 30.52], [46.48, 30.73],
  [30.04, 31.24], [36.75, 3.06], [33.57, -7.59], [36.81, 10.18], [32.89, 13.19],
  [6.52, 3.38], [5.6, -0.19], [14.72, -17.47], [12.64, -8.0], [5.36, -4.01],
  [-1.29, 36.82], [-4.32, 15.31], [-8.84, 13.23], [-26.2, 28.05], [-33.92, 18.42],
  [-29.86, 31.03], [9.03, 38.74], [-15.42, 28.28], [-17.83, 31.05], [15.5, 32.53],
  [35.68, 139.65], [34.69, 135.5], [35.18, 136.91], [31.23, 121.47], [39.9, 116.4],
  [22.32, 114.17], [23.13, 113.26], [30.57, 104.07], [1.35, 103.82], [3.14, 101.69],
  [13.76, 100.5], [14.6, 120.98], [10.76, 106.7], [21.03, 105.85], [16.84, 96.17],
  [28.61, 77.21], [19.08, 72.88], [13.08, 80.27], [22.57, 88.36], [17.39, 78.49],
  [12.97, 77.59], [37.57, 126.98], [35.18, 129.08], [25.2, 55.27], [24.45, 54.38],
  [24.71, 46.68], [21.49, 39.19], [41.01, 28.98], [35.69, 51.39], [33.32, 44.37],
  [-33.87, 151.21], [-37.81, 144.96], [-27.47, 153.03], [-31.95, 115.86], [-34.93, 138.6],
  [-41.29, 174.78], [-36.85, 174.76], [-43.53, 172.64],
]

function project(lat: number, lng: number, phi: number, theta: number) {
  const lambda = (lng * Math.PI) / 180 + phi
  const phiLat = (lat * Math.PI) / 180
  const cosLat = Math.cos(phiLat)
  const x = cosLat * Math.sin(lambda)
  const y = Math.sin(phiLat)
  const z = cosLat * Math.cos(lambda)
  const cosT = Math.cos(theta)
  const sinT = Math.sin(theta)
  return { x, y: y * cosT - z * sinT, z: y * sinT + z * cosT }
}

function drawGlobe(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  phi: number,
  theta: number,
  dark: number,
  markers: PulseMarker[],
  time: number
) {
  const cx = width / 2
  const cy = height / 2
  const radius = Math.min(width, height) * 0.42
  ctx.clearRect(0, 0, width, height)

  const glow = ctx.createRadialGradient(cx, cy, radius * 0.72, cx, cy, radius * 1.16)
  glow.addColorStop(0, dark ? "rgba(255,255,255,0.16)" : "rgba(17,17,19,0.08)")
  glow.addColorStop(1, "rgba(0,0,0,0)")
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(cx, cy, radius * 1.16, 0, Math.PI * 2)
  ctx.fill()

  const ocean = ctx.createRadialGradient(cx - radius * 0.32, cy - radius * 0.38, radius * 0.12, cx, cy, radius)
  if (dark) {
    ocean.addColorStop(0, "#3f3f46")
    ocean.addColorStop(0.7, "#1c1c20")
    ocean.addColorStop(1, "#121214")
  } else {
    ocean.addColorStop(0, "#ffffff")
    ocean.addColorStop(1, "#d4d4d8")
  }
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.fillStyle = ocean
  ctx.fill()

  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, radius - 0.5, 0, Math.PI * 2)
  ctx.clip()

  ctx.strokeStyle = dark ? "rgba(255,255,255,0.07)" : "rgba(17,17,19,0.08)"
  ctx.lineWidth = 1
  const strokePath = (points: Array<[number, number]>) => {
    ctx.beginPath()
    let started = false
    for (const [lat, lng] of points) {
      const point = project(lat, lng, phi, theta)
      if (point.z <= 0) {
        started = false
        continue
      }
      const x = cx + point.x * radius
      const y = cy - point.y * radius
      if (!started) {
        ctx.moveTo(x, y)
        started = true
      } else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  for (let mer = -180; mer < 180; mer += 30) {
    const points: Array<[number, number]> = []
    for (let lat = -84; lat <= 84; lat += 4) points.push([lat, mer])
    strokePath(points)
  }
  for (let par = -60; par <= 60; par += 30) {
    const points: Array<[number, number]> = []
    for (let lng = -180; lng <= 180; lng += 6) points.push([par, lng])
    strokePath(points)
  }

  ctx.fillStyle = dark ? "rgba(244,244,245,0.62)" : "rgba(17,17,19,0.4)"
  for (const [lat, lng] of LAND) {
    const point = project(lat, lng, phi, theta)
    if (point.z <= 0.04) continue
    ctx.beginPath()
    ctx.arc(cx + point.x * radius, cy - point.y * radius, 1.2 + point.z * 0.8, 0, Math.PI * 2)
    ctx.fill()
  }

  for (const marker of markers) {
    const point = project(marker.location[0], marker.location[1], phi, theta)
    if (point.z <= 0.08) continue
    const x = cx + point.x * radius
    const y = cy - point.y * radius
    const pulse = (Math.sin(time * 3 + marker.delay * 4) + 1) / 2
    ctx.beginPath()
    ctx.arc(x, y, 9 + pulse * 7, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(91,140,255,${0.2 + pulse * 0.28})`
    ctx.lineWidth = 1.4
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x, y, 3.1, 0, Math.PI * 2)
    ctx.fillStyle = "#5b8cff"
    ctx.fill()
  }
  ctx.restore()

  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.strokeStyle = dark ? "rgba(255,255,255,0.18)" : "rgba(17,17,19,0.12)"
  ctx.lineWidth = 1
  ctx.stroke()
}

export function GlobePulse({
  markers = [],
  className = "",
  speed = 0.004,
  dark = 1,
}: GlobePulseProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointerInteracting = useRef<{ x: number; y: number } | null>(null)
  const dragOffset = useRef({ phi: 0, theta: 0 })
  const phiOffsetRef = useRef(0)
  const thetaOffsetRef = useRef(0)
  const pausedRef = useRef(false)
  const markersRef = useRef(markers)
  const darkRef = useRef(dark)
  markersRef.current = markers
  darkRef.current = dark

  const handlePointerDown = useCallback((event: React.PointerEvent) => {
    pointerInteracting.current = { x: event.clientX, y: event.clientY }
    if (canvasRef.current) canvasRef.current.style.cursor = "grabbing"
    pausedRef.current = true
  }, [])

  const handlePointerUp = useCallback(() => {
    if (pointerInteracting.current !== null) {
      phiOffsetRef.current += dragOffset.current.phi
      thetaOffsetRef.current += dragOffset.current.theta
      dragOffset.current = { phi: 0, theta: 0 }
    }
    pointerInteracting.current = null
    if (canvasRef.current) canvasRef.current.style.cursor = "grab"
    pausedRef.current = false
  }, [])

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!pointerInteracting.current) return
      dragOffset.current = {
        phi: (event.clientX - pointerInteracting.current.x) / 280,
        theta: (event.clientY - pointerInteracting.current.y) / 900,
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
    const surface = canvasRef.current
    if (!surface) return
    const ctx = surface.getContext("2d")
    if (!ctx) return
    let frame = 0
    let phi = BRAZIL_PHI
    let lastCss = 0

    const resize = () => {
      const css = Math.round(surface.clientWidth || surface.offsetWidth || 0)
      if (css <= 0) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      if (css !== lastCss || surface.width !== css * dpr) {
        lastCss = css
        surface.width = css * dpr
        surface.height = css * dpr
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      }
      return css
    }

    const tick = () => {
      const css = resize()
      if (css) {
        if (!pausedRef.current) phi += speed
        drawGlobe(
          ctx,
          css,
          css,
          phi + phiOffsetRef.current + dragOffset.current.phi,
          BRAZIL_THETA + thetaOffsetRef.current + dragOffset.current.theta,
          darkRef.current,
          markersRef.current,
          phi * 36
        )
        surface.style.opacity = "1"
      }
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    const observer = new ResizeObserver(() => {
      lastCss = 0
    })
    observer.observe(surface)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [speed])

  return (
    <div className={cn("relative aspect-square w-full select-none", className)}>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        className="block h-full w-full"
        style={{ cursor: "grab", opacity: 0, transition: "opacity 0.5s ease", borderRadius: "50%", touchAction: "none" }}
      />
    </div>
  )
}
