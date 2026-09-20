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
      map.set(lead.id, {
        ...lead,
        events: lead.events.length ? lead.events : prev.events,
        messages: lead.messages?.length ? lead.messages : prev.messages,
      })
      changed = true
    }
  }
  if (!changed) return current
  return [...map.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, CAP)
}

export function clipRemovedIds(ids: unknown, cap = 20): string[] {
  if (!Array.isArray(ids)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const id of ids) {
    if (typeof id !== "string") continue
    const next = id.trim()
    if (!next || next.length > 80 || seen.has(next)) continue
    seen.add(next)
    out.push(next)
    if (out.length >= cap) break
  }
  return out
}

export function reconcileLeads(current: Lead[], incoming: Lead[], pendingIds: Iterable<string> = []): Lead[] {
  if (!incoming.length) return current
  const merged = mergeLeads(current, incoming)
  const remoteIds = new Set(incoming.map((lead) => lead.id))
  const pending = new Set(pendingIds)
  const next = merged.filter((lead) => remoteIds.has(lead.id) || pending.has(lead.id))
  if (next.length === merged.length) return merged
  return next.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, CAP)
}

export function adoptRemoteFunnels(
  current: SalesFunnel[],
  incoming: SalesFunnel[],
  pendingIds: Iterable<string> = []
): SalesFunnel[] {
  if (!incoming.length) return current
  const incomingIds = new Set(incoming.map((item) => item.id))
  const pending = new Set(pendingIds)
  const next = incoming.map((funnel) => {
    const prev = current.find((item) => item.id === funnel.id)
    return prev && prev.updatedAt > funnel.updatedAt ? prev : funnel
  })
  for (const funnel of current) {
    if (!incomingIds.has(funnel.id) && pending.has(funnel.id)) next.push(funnel)
  }
  return next.slice(0, 20)
}

export function applyRemovedFunnels(funnels: SalesFunnel[], removedIds: string[]): SalesFunnel[] {
  if (!removedIds.length) return funnels
  const drop = new Set(removedIds)
  return funnels.filter((item) => !drop.has(item.id))
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
