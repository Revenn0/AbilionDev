import type { KvLike } from "./kv.ts"

export const TG_UPDATES = "tg:updates"
const UPDATE_CAP = 400

export type TelegramCallResult = {
  ok: boolean
  status: number
  retryable: boolean
}

export type TelegramUpdateStore = {
  ids: number[]
  owners: Record<string, string>
}

function readUpdateIds(raw: unknown): number[] {
  if (!raw || typeof raw !== "object") return []
  const ids = (raw as { ids?: unknown }).ids
  if (!Array.isArray(ids)) return []
  return ids.filter((item): item is number => typeof item === "number" && item > 0)
}

export function readTelegramUpdates(raw: unknown): TelegramUpdateStore {
  const ids = readUpdateIds(raw)
  const owners: Record<string, string> = {}
  if (raw && typeof raw === "object") {
    const value = (raw as { owners?: unknown }).owners
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const [key, owner] of Object.entries(value as Record<string, unknown>)) {
        if (typeof owner === "string" && owner) owners[key] = owner
      }
    }
  }
  return { ids, owners }
}

export function mergeTelegramClaims(
  left: TelegramUpdateStore,
  right: TelegramUpdateStore,
  cap = UPDATE_CAP
): TelegramUpdateStore {
  const owners: Record<string, string> = { ...left.owners }
  for (const [id, owner] of Object.entries(right.owners)) {
    if (!owners[id]) owners[id] = owner
  }
  const ids: number[] = []
  const seen = new Set<number>()
  for (const id of [...right.ids, ...left.ids]) {
    if (!Number.isFinite(id) || id < 1 || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
    if (ids.length >= cap) break
  }
  const keep = new Set(ids.map(String))
  const clipped: Record<string, string> = {}
  for (const [id, owner] of Object.entries(owners)) {
    if (keep.has(id)) clipped[id] = owner
  }
  return { ids, owners: clipped }
}

export async function claimTelegramUpdate(kv: KvLike, id: number): Promise<boolean> {
  if (!Number.isFinite(id) || id < 1) return true
  const current = readTelegramUpdates(await kv.get(TG_UPDATES, "json"))
  if (current.ids.includes(id) || current.owners[String(id)]) return false
  const owner = crypto.randomUUID()
  const next: TelegramUpdateStore = {
    ids: [id, ...current.ids].slice(0, UPDATE_CAP),
    owners: { ...current.owners, [String(id)]: owner },
  }
  const merged = mergeTelegramClaims(readTelegramUpdates(await kv.get(TG_UPDATES, "json")), next)
  await kv.put(TG_UPDATES, JSON.stringify(merged))
  return readTelegramUpdates(await kv.get(TG_UPDATES, "json")).owners[String(id)] === owner
}

export async function forgetTelegramUpdate(kv: KvLike, id: number) {
  if (!Number.isFinite(id) || id < 1) return
  const current = readTelegramUpdates(await kv.get(TG_UPDATES, "json"))
  const owners = { ...current.owners }
  delete owners[String(id)]
  await kv.put(TG_UPDATES, JSON.stringify({ ids: current.ids.filter((item) => item !== id), owners }))
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export async function telegramCall(
  token: string,
  method: string,
  body: Record<string, unknown>,
  fetchImpl: FetchLike = fetch as FetchLike,
  wait: (ms: number) => Promise<void> = sleep
): Promise<TelegramCallResult> {
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.status === 429 || res.status >= 500) {
        if (attempt === 2) {
          console.error("telegram falhou", method, res.status)
          return { ok: false, status: res.status, retryable: true }
        }
        const retryAfter = Number(res.headers.get("retry-after") ?? "1")
        await wait(Math.min(Math.max(Number.isFinite(retryAfter) ? retryAfter : 1, 1), 8) * 1000)
        continue
      }
      const data = (await res.json().catch(() => null)) as { ok?: boolean } | null
      if (!res.ok || data?.ok === false) {
        console.error("telegram recusou", method, res.status)
        return { ok: false, status: res.status || 400, retryable: false }
      }
      return { ok: true, status: res.status, retryable: false }
    }
    return { ok: false, status: 429, retryable: true }
  } catch {
    console.error("telegram sem rede", method)
    return { ok: false, status: 0, retryable: true }
  }
}
