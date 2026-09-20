import { cleanBotUsername } from "./migrate.ts"
import type { LeadOrigin } from "./types.ts"

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

export function scriptIdFromStart(payload: string) {
  const match = payload.trim().match(/^(?:fb|facebook|meta)[_:\-]s([a-f0-9]{8})(?:[_:\-][a-f0-9]{6,16})?$/i)
  return match?.[1]?.toLowerCase()
}

export function visitorIdFromStart(payload: string) {
  const scripted = payload.trim().match(/^(?:fb|facebook|meta)[_:\-]s[a-f0-9]{8}[_:\-]([a-f0-9]{6,16})$/i)
  if (scripted?.[1]) return scripted[1].toLowerCase()
  const rest = payload.replace(/^(fb|facebook|meta)[_\-:]?/i, "").trim()
  if (/^s[a-f0-9]{8}$/i.test(rest)) return undefined
  if (/^[a-f0-9]{6,16}$/i.test(rest)) return rest.toLowerCase()
  return undefined
}

export function campaignFromStart(payload: string) {
  if (!payload) return "Telegram · privado"
  const scriptId = scriptIdFromStart(payload)
  if (scriptId) return `Facebook · ${scriptId}`
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
