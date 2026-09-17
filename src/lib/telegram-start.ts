import type { LeadOrigin } from "./types"

export function parseTelegramStart(text?: string | null) {
  const raw = (text ?? "").trim()
  if (!raw.startsWith("/start")) return { isStart: false, payload: "" }
  const payload = raw.replace(/^\/start(?:@\w+)?/i, "").trim()
  return { isStart: true, payload }
}

export function isFacebookStart(payload: string) {
  return /^(fb|facebook|meta)([_\-:].*)?$/i.test(payload.trim())
}

export function originFromStart(payload: string): LeadOrigin {
  return isFacebookStart(payload) ? "facebook" : "private"
}

export function campaignFromStart(payload: string) {
  if (!payload) return "Telegram · privado"
  if (isFacebookStart(payload)) {
    const rest = payload.replace(/^(fb|facebook|meta)[_\-:]?/i, "").trim()
    return rest ? `Facebook · ${rest}` : "Facebook · ads"
  }
  return `Telegram · ${payload}`
}

export function adsDeepLink(username: string, payload = "fb") {
  const handle = username.replace(/^@/, "").trim()
  if (!handle) return ""
  return `https://t.me/${handle}?start=${encodeURIComponent(payload)}`
}
