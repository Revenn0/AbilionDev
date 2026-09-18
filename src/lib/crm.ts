import { defaultSettings, type Lead, type Settings } from "./types"

const CAP = 400

export function publicSettings(settings: Settings): Settings {
  return { ...settings, telegramBotToken: "" }
}

export function mergeLeads(current: Lead[], incoming: Lead[]): Lead[] {
  if (!incoming.length) return current
  const map = new Map(current.map((lead) => [lead.id, lead]))
  let changed = false
  for (const lead of incoming) {
    const prev = map.get(lead.id)
    if (!prev) {
      map.set(lead.id, lead)
      changed = true
      continue
    }
    if (prev.updatedAt < lead.updatedAt) {
      map.set(lead.id, lead)
      changed = true
    }
  }
  if (!changed) return current
  return [...map.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, CAP)
}

export function emptySettings(): Settings {
  return { ...defaultSettings, plugins: { ...defaultSettings.plugins } }
}
