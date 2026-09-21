import { fetchWithTimeout } from "./http"
import { emptySummary, type TrackSummary } from "./track"

export function parseTrackSummary(data: unknown): { summary: TrackSummary; unread: boolean } | null {
  if (!data || typeof data !== "object") return null
  const raw = data as { summary?: TrackSummary; trackUnread?: unknown }
  if (!raw.summary || typeof raw.summary !== "object" || Array.isArray(raw.summary)) return null
  return {
    summary: { ...emptySummary(), ...raw.summary },
    unread: raw.trackUnread === true,
  }
}

export async function fetchTrackSummary(): Promise<{ summary: TrackSummary; unread: boolean }> {
  const res = await fetchWithTimeout("/api/track/summary", { credentials: "include", cache: "no-store" })
  if (!res.ok) throw new Error("Não foi possível ler o analytics.")
  const parsed = parseTrackSummary(await res.json())
  if (!parsed) throw new Error("Não foi possível ler o analytics.")
  return parsed
}
