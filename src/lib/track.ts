import { countryName, formatGeo, normalizeCountryCode, stateLabel } from "./geo.ts"

export type TrackKind = "view" | "click" | "telegram" | "beat"

export type TrackEvent = {
  id: string
  visitorId: string
  kind: TrackKind
  path: string
  referrer: string
  campaign: string
  country: string
  countryCode: string
  city: string
  region: string
  regionCode: string
  device: string
  language: string
  at: string
}

export type TrackBucket = { label: string; count: number }

export type TrackPoint = {
  day: string
  views: number
  clicks: number
  telegrams: number
}

export type TrackRecent = {
  visitorId: string
  name?: string
  country: string
  region: string
  at: string
}

export type TrackGeo = {
  country: string
  countryCode: string
  city: string
  region: string
  regionCode: string
}

export type TrackSummary = {
  visitors: number
  clicks: number
  telegrams: number
  conversion: number
  clickRate: number
  bounce: number
  sessionMs: number
  online: number
  series: TrackPoint[]
  recent: TrackRecent[]
  referrers: TrackBucket[]
  countries: TrackBucket[]
  regions: TrackBucket[]
  pages: TrackBucket[]
  devices: TrackBucket[]
  geos: Record<string, TrackGeo>
}

export const emptySummary = (): TrackSummary => ({
  visitors: 0,
  clicks: 0,
  telegrams: 0,
  conversion: 0,
  clickRate: 0,
  bounce: 0,
  sessionMs: 0,
  online: 0,
  series: [],
  recent: [],
  referrers: [],
  countries: [],
  regions: [],
  pages: [],
  devices: [],
  geos: {},
})

export function sanitizeVisitorId(value: unknown) {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-f0-9]/g, "")
  return raw.slice(0, 16)
}

export function parseDevice(ua: string) {
  const value = ua.toLowerCase()
  if (value.includes("instagram")) return "Instagram"
  if (value.includes("fbav") || value.includes("fban")) return "Facebook"
  if (value.includes("edg/")) return "Edge"
  if (value.includes("firefox")) return "Firefox"
  if (value.includes("crios") || value.includes("chrome")) return "Chrome"
  if (value.includes("safari")) return "Safari"
  if (value.includes("samsung")) return "Samsung Internet"
  if (value.includes("opera") || value.includes("opr/")) return "Opera"
  return "Outro"
}

export function campaignFromTrack(input: { referrer?: string; fbclid?: string; utmCampaign?: string; utmSource?: string }) {
  if (input.utmCampaign) return input.utmCampaign
  if (input.fbclid || /facebook|fb\.com|l\.facebook/i.test(input.referrer ?? "")) return "Facebook · ads"
  if (input.utmSource) return input.utmSource
  if (!input.referrer) return "Direto"
  try {
    return new URL(input.referrer).host.replace(/^www\./, "")
  } catch {
    return "Direto"
  }
}

function startOfDay(ms: number) {
  const date = new Date(ms)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function rank(map: Map<string, number>, limit = 10): TrackBucket[] {
  return [...map.entries()]
    .filter(([label]) => label)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }))
}

export function summarizeTrack(events: TrackEvent[], now = Date.now()): TrackSummary {
  const visitors = new Set<string>()
  const clicked = new Set<string>()
  const telegram = new Set<string>()
  const viewed = new Set<string>()
  const first = new Map<string, number>()
  const last = new Map<string, number>()
  const referrers = new Map<string, number>()
  const countries = new Map<string, number>()
  const regions = new Map<string, number>()
  const pages = new Map<string, number>()
  const devices = new Map<string, number>()
  const geos: Record<string, TrackGeo> = {}
  const start = startOfDay(now - 29 * 86_400_000)
  const series = Array.from({ length: 30 }, (_, index) => {
    const day = new Date(start + index * 86_400_000)
    return {
      day: day.toISOString().slice(0, 10),
      views: 0,
      clicks: 0,
      telegrams: 0,
    }
  })
  const recent: TrackRecent[] = []
  let clicks = 0
  let telegrams = 0
  let online = 0

  for (const event of events) {
    const at = new Date(event.at).getTime()
    if (!event.visitorId) continue
    visitors.add(event.visitorId)
    first.set(event.visitorId, Math.min(first.get(event.visitorId) ?? at, at))
    last.set(event.visitorId, Math.max(last.get(event.visitorId) ?? at, at))
    if (now - at <= 120_000 && (event.kind === "beat" || event.kind === "view" || event.kind === "click")) online += 1
    const code = event.countryCode || normalizeCountryCode(event.country)
    if (code || event.region || event.regionCode) {
      geos[event.visitorId] = {
        country: countryName(code, event.country),
        countryCode: code,
        city: event.city,
        region: event.region,
        regionCode: event.regionCode,
      }
    }

    const slot = Math.floor((at - start) / 86_400_000)
    const point = slot >= 0 && slot < 30 ? series[slot] : undefined
    if (event.kind === "view") {
      viewed.add(event.visitorId)
      if (point) point.views += 1
      referrers.set(event.campaign || event.referrer || "Direto", (referrers.get(event.campaign || event.referrer || "Direto") ?? 0) + 1)
      const countryLabel = formatGeo({ country: event.country, countryCode: code }) || countryName(code, event.country) || "Local"
      countries.set(countryLabel, (countries.get(countryLabel) ?? 0) + 1)
      const estado = stateLabel(event.region, event.regionCode, code)
      if (estado) regions.set(estado, (regions.get(estado) ?? 0) + 1)
      if (code || event.region || event.regionCode) {
        geos[event.visitorId] = {
          country: countryName(code, event.country),
          countryCode: code,
          city: event.city,
          region: event.region,
          regionCode: event.regionCode,
        }
      }
      pages.set(event.path || "/", (pages.get(event.path || "/") ?? 0) + 1)
      devices.set(event.device || "Outro", (devices.get(event.device || "Outro") ?? 0) + 1)
    }
    if (event.kind === "click") {
      clicks += 1
      clicked.add(event.visitorId)
      if (point) point.clicks += 1
    }
    if (event.kind === "telegram") {
      telegrams += 1
      telegram.add(event.visitorId)
      if (point) point.telegrams += 1
      recent.push({ visitorId: event.visitorId, country: event.country, region: event.region || event.regionCode, at: event.at })
    }
  }

  const uniqueOnline = new Set(
    events.filter((event) => now - new Date(event.at).getTime() <= 120_000).map((event) => event.visitorId)
  )
  let sessionTotal = 0
  let sessionCount = 0
  for (const id of viewed) {
    const a = first.get(id)
    const b = last.get(id)
    if (a && b && b > a) {
      sessionTotal += Math.min(b - a, 30 * 60_000)
      sessionCount += 1
    }
  }

  return {
    visitors: viewed.size || visitors.size,
    clicks,
    telegrams,
    conversion: viewed.size ? telegrams / viewed.size : 0,
    clickRate: viewed.size ? clicked.size / viewed.size : 0,
    bounce: viewed.size ? (viewed.size - clicked.size) / viewed.size : 0,
    sessionMs: sessionCount ? sessionTotal / sessionCount : 0,
    online: uniqueOnline.size,
    series,
    recent: recent.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 16),
    referrers: rank(referrers),
    countries: rank(countries),
    regions: rank(regions),
    pages: rank(pages),
    devices: rank(devices),
    geos,
  }
}

export function formatSession(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}m${String(seconds).padStart(2, "0")}s`
}

export function formatPercent(value: number) {
  return `${(value * 100).toFixed(value >= 0.1 ? 0 : 2).replace(/\.00$/, "")}%`
}
