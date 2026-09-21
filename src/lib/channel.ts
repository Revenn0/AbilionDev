import { fetchWithTimeout } from "./http"

export function workerUrl() {
  if (typeof window !== "undefined") return window.location.origin
  return ((import.meta.env.VITE_APP_URL as string | undefined) ?? "").replace(/\/$/, "")
}

export async function fetchHealth() {
  try {
    const res = await fetchWithTimeout(`${workerUrl()}/api/health`)
    if (!res.ok) return { ok: false as const, unreachable: true }
    return (await res.json()) as {
      ok: boolean
      unreachable?: boolean
      telegramBotUsername?: string
      telegramBotUnread?: boolean
    }
  } catch {
    return { ok: false as const, unreachable: true }
  }
}
