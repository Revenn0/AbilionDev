import { BR_STATES, countryName, normalizeCountryCode, normalizeRegionCode } from "../src/lib/geo.ts"
import { campaignFromTrack, parseDevice, sanitizeVisitorId, summarizeTrack, type TrackEvent, type TrackKind } from "../src/lib/track.ts"
import { geoFromCloudflare } from "./geo-lookup.ts"

export type TrackStore = {
  load(): Promise<TrackEvent[]>
  save(events: TrackEvent[]): Promise<void>
}

const MAX = 4000

export function memoryTrackStore(initial: TrackEvent[] = []): TrackStore {
  let events = [...initial]
  return {
    async load() {
      return [...events]
    },
    async save(next) {
      events = next.slice(-MAX)
    },
  }
}

export function kvTrackStore(kv: { get(key: string, type: "json"): Promise<unknown>; put(key: string, value: string): Promise<void> }): TrackStore {
  return {
    async load() {
      const raw = await kv.get("track:events", "json")
      return Array.isArray(raw) ? (raw as TrackEvent[]) : []
    },
    async save(events) {
      await kv.put("track:events", JSON.stringify(events.slice(-MAX)))
    },
  }
}

export function mergeTrackEvents(...batches: TrackEvent[][]): TrackEvent[] {
  const byId = new Map<string, TrackEvent>()
  for (const batch of batches) {
    for (const event of batch) {
      if (!event?.id) continue
      const prev = byId.get(event.id)
      if (!prev || event.at >= prev.at) byId.set(event.id, event)
    }
  }
  return [...byId.values()].sort((left, right) => (left.at < right.at ? -1 : left.at > right.at ? 1 : left.id.localeCompare(right.id))).slice(-MAX)
}

export function ingestTrack(
  events: TrackEvent[],
  input: {
    kind?: string
    visitorId?: string
    path?: string
    referrer?: string
    fbclid?: string
    utmSource?: string
    utmCampaign?: string
    language?: string
    country?: string
    countryCode?: string
    city?: string
    region?: string
    regionCode?: string
    device?: string
    href?: string
    id?: string
  },
  now = Date.now()
) {
  const visitorId = sanitizeVisitorId(input.visitorId)
  const kind = (["view", "click", "telegram", "beat"].includes(String(input.kind)) ? input.kind : "") as TrackKind | ""
  if (!visitorId || !kind) return events
  const last = [...events].reverse().find((item) => item.visitorId === visitorId && item.kind === kind)
  if (last && now - new Date(last.at).getTime() < (kind === "beat" ? 20_000 : kind === "view" ? 4000 : 800)) {
    return events
  }
  const prior = [...events].reverse().find((item) => item.visitorId === visitorId && (item.countryCode || item.regionCode || item.region))
  const countryCode = normalizeCountryCode(input.countryCode || input.country || prior?.countryCode || prior?.country)
  const regionCode = normalizeRegionCode(input.regionCode || input.region || prior?.regionCode, countryCode)
  const next: TrackEvent = {
    id: input.id || crypto.randomUUID(),
    visitorId,
    kind,
    path: String(input.path || "/").slice(0, 180),
    referrer: String(input.referrer || "").slice(0, 240),
    campaign: campaignFromTrack({
      referrer: input.referrer,
      fbclid: input.fbclid,
      utmCampaign: input.utmCampaign,
      utmSource: input.utmSource,
    }),
    country: countryName(countryCode, input.country || prior?.country),
    countryCode,
    city: String(input.city || prior?.city || "").slice(0, 64),
    region: String(input.region || prior?.region || (regionCode && BR_STATES[regionCode]) || "").slice(0, 64),
    regionCode,
    device: String(input.device || "Outro").slice(0, 40),
    language: String(input.language || "").slice(0, 16),
    at: new Date(now).toISOString(),
  }
  return [...events, next].slice(-MAX)
}

export async function recordTrack(store: TrackStore, input: Parameters<typeof ingestTrack>[1], now = Date.now()) {
  const id = input.id || crypto.randomUUID()
  const payload = { ...input, id }
  let last: TrackEvent | null = null
  for (let attempt = 0; attempt < 16; attempt++) {
    const loaded = await store.load()
    const events = ingestTrack(loaded, payload, now)
    last = events.find((item) => item.id === id) ?? events.at(-1) ?? null
    const next = mergeTrackEvents(loaded, events)
    await store.save(next)
    await new Promise((resolve) => setTimeout(resolve, 0))
    const latest = await store.load()
    const combined = mergeTrackEvents(next, latest)
    const haveIncoming = !last || combined.some((item) => item.id === last.id)
    const latestHasAll =
      combined.length === latest.length && latest.every((item) => combined.some((other) => other.id === item.id))
    if (haveIncoming && latestHasAll) {
      await new Promise((resolve) => setTimeout(resolve, 0))
      const confirm = await store.load()
      if (last && !confirm.some((item) => item.id === last.id)) {
        await new Promise((resolve) => setTimeout(resolve, 8 * (attempt + 1)))
        continue
      }
      const confirmCombined = mergeTrackEvents(next, confirm)
      if (confirmCombined.length !== confirm.length) {
        await store.save(confirmCombined)
        await new Promise((resolve) => setTimeout(resolve, 8 * (attempt + 1)))
        continue
      }
      return last
    }
    if (haveIncoming && combined.length !== latest.length) await store.save(combined)
    await new Promise((resolve) => setTimeout(resolve, 8 * (attempt + 1)))
  }
  return last
}

export async function summaryFromStore(store: TrackStore, now = Date.now()) {
  return summarizeTrack(await store.load(), now)
}

export function geoFromRequest(request: Request) {
  const geo = geoFromCloudflare(request)
  return {
    country: geo.countryCode || geo.country || request.headers.get("cf-ipcountry") || "",
    countryCode: geo.countryCode,
    city: geo.city,
    region: geo.region,
    regionCode: geo.regionCode,
    device: parseDevice(request.headers.get("user-agent") || ""),
  }
}

export async function readTrackBody(request: Request) {
  const text = await request.text()
  if (!text) return { ok: true as const, value: {} }
  if (text.length > 8192) return { ok: false as const, status: 413 as const }
  try {
    const parsed = JSON.parse(text) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false as const, status: 400 as const }
    }
    return { ok: true as const, value: parsed as Record<string, unknown> }
  } catch {
    return { ok: false as const, status: 400 as const }
  }
}
