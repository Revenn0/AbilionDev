import { emptySummary, type TrackSummary } from "@/lib/track"

export async function fetchTrackSummary(): Promise<TrackSummary> {
  const res = await fetch("/api/track/summary", { credentials: "include", cache: "no-store" })
  if (res.status === 401) return emptySummary()
  if (!res.ok) throw new Error("Não foi possível ler o analytics.")
  const data = (await res.json()) as { summary?: TrackSummary }
  return data.summary ?? emptySummary()
}

