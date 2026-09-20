import { publishedFunnel } from "./runtime.ts"
import { defaultSettings, type Lead, type LeadEvent, type SalesFunnel, type Settings } from "./types.ts"

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
        memory: lead.memory.trim() ? lead.memory : prev.memory,
        facts: lead.facts && Object.keys(lead.facts).length ? lead.facts : prev.facts,
        telegramChatId: lead.telegramChatId || prev.telegramChatId,
        visitorId: lead.visitorId || prev.visitorId,
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

export function applyRemovedLeads(leads: Lead[], removedIds: Iterable<string>): Lead[] {
  const drop = new Set(removedIds)
  if (!drop.size) return leads
  const next = leads.filter((lead) => !drop.has(lead.id))
  return next.length === leads.length ? leads : next
}

export function mergeLeadEvents(local: LeadEvent[], remote: LeadEvent[], cap = 80): LeadEvent[] {
  if (!remote.length) return local
  if (!local.length) return remote.slice(-cap)
  const byId = new Map<string, LeadEvent>()
  for (const event of local) {
    if (event.id) byId.set(event.id, event)
  }
  for (const event of remote) {
    if (!event.id || byId.has(event.id)) continue
    byId.set(event.id, event)
  }
  return [...byId.values()].sort((a, b) => a.at.localeCompare(b.at)).slice(-cap)
}

export function adoptLeadStores(kv: Lead[], remote: Lead[]): Lead[] {
  if (!kv.length) return remote
  if (!remote.length) return kv
  const keep = new Set(kv.map((lead) => lead.id))
  return mergeLeads(kv, remote.filter((lead) => keep.has(lead.id)))
}

export function resolveLeadLookup(
  kvLead: Lead | null | undefined,
  remoteLead: Lead | null | undefined,
  removedIds: Iterable<string> = []
): Lead | null {
  if (kvLead) return kvLead
  if (!remoteLead) return null
  const removed = removedIds instanceof Set ? removedIds : new Set(removedIds)
  return removed.has(remoteLead.id) ? null : remoteLead
}

export function adoptDueLeads(kvLeads: Lead[], remoteLeads: Lead[], removedIds: Iterable<string> = []): Lead[] {
  const removed = new Set(removedIds)
  const byId = new Map<string, Lead>()
  for (const lead of remoteLeads) {
    if (!removed.has(lead.id)) byId.set(lead.id, lead)
  }
  for (const lead of kvLeads) byId.set(lead.id, lead)
  return [...byId.values()]
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

export function activatePublishedFunnels(funnels: SalesFunnel[], id: string): SalesFunnel[] {
  const target = funnels.find((item) => item.id === id)
  if (!target?.production) return funnels
  let changed = false
  const next = funnels.map((item) => {
    if (item.id === id) {
      if (item.status === "active") return item
      changed = true
      return { ...item, status: "active" as const }
    }
    if (item.status === "active" && item.production) {
      changed = true
      return { ...item, status: "draft" as const, updatedAt: target.updatedAt }
    }
    return item
  })
  return changed ? next : funnels
}

export function enforceSinglePublished(funnels: SalesFunnel[]): SalesFunnel[] {
  const winner = publishedFunnel(funnels)
  if (!winner?.production) return funnels
  return activatePublishedFunnels(funnels, winner.id)
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
