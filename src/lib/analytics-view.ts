import { hasConversation } from "./ops.ts"
import type { Lead } from "./types.ts"
import { coordsFromGeo } from "./geo-coords.ts"
import { formatGeo, leadGeo } from "./geo.ts"
import { facebookOf, type TrackGeo, type TrackPoint, type TrackSummary } from "./track.ts"

export type FunnelStepId = "ads" | "landing" | "button" | "chat"

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
  const facebook = facebookOf(summary)
  const facebookLeads = leads.filter((lead) => lead.origin === "facebook")
  const extraAds = facebookLeads.filter((lead) => !lead.visitorId).length
  return [
    {
      id: "ads",
      label: "Clique no anúncio",
      hint: "abriu a landing pelo Facebook",
      value: facebook.adClicks + extraAds,
    },
    {
      id: "landing",
      label: "Page views",
      hint: "visualizações da landing do ads",
      value: facebook.pageViews,
    },
    {
      id: "button",
      label: "Clique no Telegram",
      hint: "botão da landing, sem misturar com /start",
      value: facebook.buttonClicks,
    },
    {
      id: "chat",
      label: "Chat iniciado",
      hint: "lead do Facebook respondeu a Sté",
      value: facebookLeads.filter((lead) => hasConversation(lead) && chatStarted(lead)).length,
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
  const sum = (rows: TrackPoint[], key: keyof Pick<TrackPoint, "views" | "clicks" | "telegrams" | "facebookAds" | "facebookViews" | "facebookClicks">) =>
    rows.reduce((total, row) => total + (row[key] ?? 0), 0)
  return {
    views: { current: sum(current, "views"), previous: sum(previous, "views") },
    clicks: { current: sum(current, "clicks"), previous: sum(previous, "clicks") },
    telegrams: { current: sum(current, "telegrams"), previous: sum(previous, "telegrams") },
    facebookAds: { current: sum(current, "facebookAds"), previous: sum(previous, "facebookAds") },
    facebookViews: { current: sum(current, "facebookViews"), previous: sum(previous, "facebookViews") },
    facebookClicks: { current: sum(current, "facebookClicks"), previous: sum(previous, "facebookClicks") },
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
    const label = formatGeo(geo) || [geo.city, geo.region || geo.regionCode, geo.country || geo.countryCode].filter(Boolean).join(" · ")
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

export function geosFromLeads(leads: Lead[]): Record<string, TrackGeo> {
  const geos: Record<string, TrackGeo> = {}
  for (const lead of leads) {
    const geo = leadGeo(lead)
    if (!geo.countryCode && !geo.regionCode) continue
    geos[lead.visitorId || lead.id] = {
      country: geo.country || "",
      countryCode: geo.countryCode || "",
      city: geo.city || "",
      region: geo.region || "",
      regionCode: geo.regionCode || "",
    }
  }
  return geos
}

export function mergeGlobeGeos(track: Record<string, TrackGeo> | undefined, leads: Lead[]) {
  return { ...geosFromLeads(leads), ...(track ?? {}) }
}
