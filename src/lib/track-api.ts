import { noteUnauthorized } from "@/lib/session"
import { emptySummary, type TrackSummary } from "@/lib/track"

export async function fetchTrackSummary(): Promise<TrackSummary> {
  const res = await fetch("/api/track/summary", { credentials: "include", cache: "no-store" })
  noteUnauthorized(res)
  if (!res.ok) throw new Error(res.status === 401 ? "Sessão expirada." : "Não foi possível ler o analytics.")
  const data = (await res.json()) as { summary?: TrackSummary }
  return data.summary ?? emptySummary()
}

