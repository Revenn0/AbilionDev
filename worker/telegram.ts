import type { KvLike } from "./kv.ts"

export const TG_UPDATES = "tg:updates"
const UPDATE_CAP = 400

export type TelegramCallResult = {
  ok: boolean
  status: number
  retryable: boolean
}

function readUpdateIds(raw: unknown): number[] {
  if (!raw || typeof raw !== "object") return []
  const ids = (raw as { ids?: unknown }).ids
  if (!Array.isArray(ids)) return []
  return ids.filter((item): item is number => typeof item === "number" && item > 0)
}

export async function claimTelegramUpdate(kv: KvLike, id: number): Promise<boolean> {
  if (!Number.isFinite(id) || id < 1) return true
  const ids = readUpdateIds(await kv.get(TG_UPDATES, "json"))
  if (ids.includes(id)) return false
  await kv.put(TG_UPDATES, JSON.stringify({ ids: [id, ...ids].slice(0, UPDATE_CAP) }))
  return readUpdateIds(await kv.get(TG_UPDATES, "json")).includes(id)
}

export async function forgetTelegramUpdate(kv: KvLike, id: number) {
  if (!Number.isFinite(id) || id < 1) return
  const ids = readUpdateIds(await kv.get(TG_UPDATES, "json")).filter((item) => item !== id)
  await kv.put(TG_UPDATES, JSON.stringify({ ids }))
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
