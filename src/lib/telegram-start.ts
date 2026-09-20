import { cleanBotUsername } from "./migrate"
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

export function visitorIdFromStart(payload: string) {
  const rest = payload.replace(/^(fb|facebook|meta)[_\-:]?/i, "").trim()
  if (/^[a-f0-9]{6,16}$/i.test(rest)) return rest.toLowerCase()
  return undefined
}

export function campaignFromStart(payload: string) {
  if (!payload) return "Telegram · privado"
  if (isFacebookStart(payload)) {
    const rest = payload.replace(/^(fb|facebook|meta)[_\-:]?/i, "").trim()
    if (!rest || visitorIdFromStart(payload)) return "Facebook · ads"
    return `Facebook · ${rest}`
  }
  return `Telegram · ${payload}`
}

export function adsDeepLink(username: string, payload = "fb") {
  const handle = cleanBotUsername(username).replace(/^@/, "")
  if (!handle) return ""
  return `https://t.me/${handle}?start=${encodeURIComponent(payload)}`
}
