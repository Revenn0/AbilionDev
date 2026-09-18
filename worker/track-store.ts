import { campaignFromTrack, parseDevice, sanitizeVisitorId, summarizeTrack, type TrackEvent, type TrackKind } from "../src/lib/track.ts"

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
    city?: string
    region?: string
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
    country: String(input.country || "").slice(0, 48),
    city: String(input.city || "").slice(0, 64),
    region: String(input.region || "").slice(0, 64),
    device: String(input.device || "Outro").slice(0, 40),
    language: String(input.language || "").slice(0, 16),
    at: new Date(now).toISOString(),
  }
  return [...events, next].slice(-MAX)
}

export async function recordTrack(store: TrackStore, input: Parameters<typeof ingestTrack>[1], now = Date.now()) {
  const events = ingestTrack(await store.load(), input, now)
  await store.save(events)
  return events.at(-1) ?? null
}

export async function summaryFromStore(store: TrackStore, now = Date.now()) {
  return summarizeTrack(await store.load(), now)
}

export function geoFromRequest(request: Request) {
  const cf = (request as Request & { cf?: { country?: string; city?: string; region?: string } }).cf
  return {
    country: cf?.country || request.headers.get("cf-ipcountry") || "",
    city: cf?.city || "",
    region: cf?.region || "",
    device: parseDevice(request.headers.get("user-agent") || ""),
  }
}

export async function readTrackBody(request: Request) {
  const text = await request.text()
  if (!text) return {}
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return {}
  }
}
