import { useEffect } from "react"
import { useLocation } from "react-router-dom"

/** SPA: Link /telegram#pixel não faz scroll sozinho. */
export function useHashScroll(id: string, ready = true) {
  const { hash } = useLocation()
  useEffect(() => {
    if (!ready || hash !== `#${id}`) return
    let cancelled = false
    const go = () => {
      if (cancelled) return
      document.getElementById(id)?.scrollIntoView({ block: "start" })
    }
    go()
    const frame = window.requestAnimationFrame(() => window.requestAnimationFrame(go))
    const timer = window.setTimeout(go, 80)
    return () => {
      cancelled = true
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [hash, id, ready])
}
