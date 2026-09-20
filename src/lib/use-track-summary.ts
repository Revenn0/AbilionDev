import { useEffect, useState } from "react"
import { emptySummary, type TrackSummary } from "@/lib/track"
import { fetchTrackSummary } from "@/lib/track-api"

export function useTrackSummary(ms = 5000) {
  const [summary, setSummary] = useState<TrackSummary>(emptySummary)
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading")
  const [hasData, setHasData] = useState(false)

  useEffect(() => {
    let cancelled = false
    const pull = () => {
      fetchTrackSummary()
        .then((next) => {
          if (cancelled) return
          setSummary(next)
          setStatus("ok")
          setHasData(true)
        })
        .catch(() => {
          if (!cancelled) setStatus("error")
        })
    }
    pull()
    const timer = window.setInterval(pull, ms)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [ms])

  return { summary, status, hasData }
}
