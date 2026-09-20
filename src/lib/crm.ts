import { defaultSettings, type Lead, type SalesFunnel, type Settings } from "./types"

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

export function canDeleteFunnel(
  funnels: SalesFunnel[],
  id: string
): { ok: true } | { ok: false; reason: string } {
  if (funnels.length <= 1) return { ok: false, reason: "Mantém pelo menos um funil." }
  const target = funnels.find((item) => item.id === id)
  if (!target) return { ok: false, reason: "Este funil já não está no CRM." }
  const published = funnels.filter((item) => item.status === "active" && item.production)
  if (target.status === "active" && target.production && published.length <= 1) {
    return { ok: false, reason: "Não apagues o último funil publicado. A Sté precisa de um quadro." }
  }
  return { ok: true }
}
