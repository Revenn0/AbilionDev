import { defaultSettings, type Lead, type SalesFunnel, type Settings } from "./types.ts"

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

export function mergeFunnels(current: SalesFunnel[], incoming: SalesFunnel[]): SalesFunnel[] {
  if (!incoming.length) return current
  const incomingIds = new Set(incoming.map((item) => item.id))
  const localOnly = current.filter((item) => !incomingIds.has(item.id))
  const merged = incoming.map((funnel) => {
    const prev = current.find((item) => item.id === funnel.id)
    return prev && prev.updatedAt > funnel.updatedAt ? prev : funnel
  })
  return [...localOnly, ...merged]
}

export function reconcileFunnels(server: SalesFunnel[], incoming: SalesFunnel[]): SalesFunnel[] {
  if (!incoming.length) return server
  const newestIncoming = incoming.reduce((max, item) => (item.updatedAt > max ? item.updatedAt : max), "")
  const seen = new Set<string>()
  const next: SalesFunnel[] = []
  for (const funnel of incoming) {
    const prev = server.find((item) => item.id === funnel.id)
    next.push(prev && prev.updatedAt > funnel.updatedAt ? prev : funnel)
    seen.add(funnel.id)
  }
  for (const funnel of server) {
    if (seen.has(funnel.id)) continue
    if (funnel.updatedAt > newestIncoming) next.push(funnel)
  }
  return next.slice(0, 20)
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
