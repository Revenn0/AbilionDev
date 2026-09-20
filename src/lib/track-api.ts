import { fetchWithTimeout } from "@/lib/http"
import { emptySummary, type TrackSummary } from "@/lib/track"

export async function fetchTrackSummary(): Promise<TrackSummary> {
  const res = await fetchWithTimeout("/api/track/summary", { credentials: "include", cache: "no-store" })
  if (!res.ok) throw new Error("Não foi possível ler o analytics.")
  const data = (await res.json()) as { summary?: TrackSummary }
  return data.summary ?? emptySummary()
}

