import { hasConversation } from "./ops.ts"
import type { Lead } from "./types.ts"
import { coordsFromGeo } from "./geo-coords.ts"
import type { TrackGeo, TrackPoint, TrackSummary } from "./track.ts"

export type FunnelStepId = "ads" | "landing" | "telegram" | "chat"

export type FunnelStep = {
  id: FunnelStepId
  label: string
  hint: string
  value: number
}

export function chatStarted(lead: Lead) {
  return (lead.messages ?? []).some((item) => item.role === "lead")
}

export function funnelFrom(summary: TrackSummary, leads: Lead[]): FunnelStep[] {
  const facebookLeads = leads.filter((lead) => lead.origin === "facebook").length
  const ads = Math.max(summary.ads, facebookLeads)
  const telegram = Math.max(summary.telegrams, summary.clicks, leads.filter((lead) => lead.channel === "telegram").length)
  return [
    { id: "ads", label: "Ads", hint: "Facebook com pixel", value: ads },
    { id: "landing", label: "Landing", hint: "viram a página", value: summary.visitors },
    { id: "telegram", label: "Telegram", hint: "/start com fb_vid", value: telegram },
    {
      id: "chat",
      label: "Chat iniciado",
      hint: "lead respondeu a Sté",
      value: leads.filter((lead) => hasConversation(lead) && chatStarted(lead)).length,
    },
  ]
}

export function stepRate(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 1 : 0
  return current / previous
}

export function stepDrop(current: number, previous: number) {
  if (previous <= 0 || current > previous) return null
  return current / previous
}

export function periodDelta(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 1 : 0
  return (current - previous) / previous
}

export function splitSeries(series: TrackPoint[]) {
  const mid = Math.floor(series.length / 2)
  const previous = series.slice(0, mid)
  const current = series.slice(mid)
  const sum = (rows: TrackPoint[], key: keyof Pick<TrackPoint, "views" | "clicks" | "telegrams">) =>
    rows.reduce((total, row) => total + row[key], 0)
  return {
    views: { current: sum(current, "views"), previous: sum(previous, "views") },
    clicks: { current: sum(current, "clicks"), previous: sum(previous, "clicks") },
    telegrams: { current: sum(current, "telegrams"), previous: sum(previous, "telegrams") },
  }
}

export function formatDelta(value: number) {
  const signed = `${value >= 0 ? "+" : "−"}${Math.abs(value * 100).toFixed(1).replace(/\.0$/, "")}%`
  return signed
}

export type GlobePulseMarker = {
  id: string
  location: [number, number]
  delay: number
  label: string
  count: number
}

export function markersFromGeos(geos: Record<string, TrackGeo>, limit = 18): GlobePulseMarker[] {
  const buckets = new Map<string, { location: [number, number]; label: string; count: number }>()
  for (const geo of Object.values(geos)) {
    const location = coordsFromGeo(geo)
    if (!location) continue
    const key = `${geo.countryCode || ""}:${geo.regionCode || geo.region || ""}`
    const label = [geo.region || geo.regionCode, geo.country || geo.countryCode].filter(Boolean).join(" · ")
    const current = buckets.get(key)
    if (current) current.count += 1
    else buckets.set(key, { location, label: label || "Visitante", count: 1 })
  }
  const regionalCountries = new Set(
    [...buckets.keys()]
      .filter((key) => key.split(":")[1])
      .map((key) => key.split(":")[0] || "")
  )
  return [...buckets.entries()]
    .filter(([key]) => {
      const [country, region] = key.split(":")
      return region || !regionalCountries.has(country || "")
    })
    .map(([, item]) => item)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((item, index) => ({
      id: `pulse-${index + 1}`,
      location: item.location,
      delay: (index % 6) * 0.35,
      label: item.label,
      count: item.count,
    }))
}

export const FALLBACK_MARKERS: GlobePulseMarker[] = [
  { id: "pulse-1", location: [-23.55, -46.63], delay: 0, label: "São Paulo", count: 0 },
  { id: "pulse-2", location: [-22.91, -43.17], delay: 0.4, label: "Rio de Janeiro", count: 0 },
  { id: "pulse-3", location: [-12.97, -38.5], delay: 0.8, label: "Bahia", count: 0 },
  { id: "pulse-4", location: [-3.72, -38.54], delay: 1.2, label: "Ceará", count: 0 },
]
