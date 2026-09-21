import { useEffect, useRef, useState } from "react"
import { trackSyncAfterRead } from "@/lib/ops"
import { emptySummary, type TrackSummary } from "@/lib/track"
import { fetchTrackSummary } from "@/lib/track-api"

export function useTrackSummary(ms = 5000) {
  const [summary, setSummary] = useState<TrackSummary>(emptySummary)
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading")
  const [hasData, setHasData] = useState(false)
  const pullRef = useRef(() => {})

  useEffect(() => {
    let cancelled = false
    const pull = () => {
      fetchTrackSummary()
        .then((next) => {
          if (cancelled) return
          setSummary(next.summary)
          setStatus(trackSyncAfterRead(next.unread))
          setHasData(true)
        })
        .catch(() => {
          if (!cancelled) setStatus("error")
        })
    }
    pullRef.current = pull
    pull()
    const timer = window.setInterval(pull, ms)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [ms])

  return { summary, status, hasData, retry: () => pullRef.current() }
}
