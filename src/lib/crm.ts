import { publishedFunnel } from "./runtime.ts"
import { defaultSettings, type ChatMessage, type Lead, type LeadEvent, type LeadFacts, type SalesFunnel, type Settings } from "./types.ts"

const CAP = 400

export function publicSettings(settings: Settings): Settings {
  return { ...settings, telegramBotToken: "", esterTelegramChatId: "" }
}

export function mergeLeadMessages(left: ChatMessage[] = [], right: ChatMessage[] = [], cap = 80): ChatMessage[] {
  if (!right.length) return left.slice(-cap)
  if (!left.length) return right.slice(-cap)
  const byId = new Map<string, ChatMessage>()
  for (const msg of [...left, ...right]) {
    if (!msg?.id) continue
    const prev = byId.get(msg.id)
    if (!prev || msg.at >= prev.at) byId.set(msg.id, msg)
  }
  return [...byId.values()].sort((a, b) => a.at.localeCompare(b.at)).slice(-cap)
}

function fillFacts(primary?: LeadFacts, fallback?: LeadFacts): LeadFacts {
  const left = fallback ?? {}
  const right = primary ?? {}
  if (!Object.keys(left).length) return right
  if (!Object.keys(right).length) return left
  return { ...left, ...right }
}

export function adoptStoredLead(prev: Lead, incoming: Lead): Lead {
  const incomingOlder = prev.updatedAt > incoming.updatedAt
  const newer = incomingOlder ? prev : incoming
  const older = incomingOlder ? incoming : prev
  const messages = mergeLeadMessages(prev.messages ?? [], incoming.messages ?? [])
  const events = mergeLeadEvents(incoming.events ?? [], prev.events ?? [])
  const memory = newer.memory.trim() ? newer.memory : older.memory
  const facts = fillFacts(newer.facts, older.facts)
  const telegramChatId = newer.telegramChatId || older.telegramChatId
  const visitorId = newer.visitorId || older.visitorId
  if (incomingOlder) {
    const prevMessages = prev.messages ?? []
    const sameMessages = messages.length === prevMessages.length && messages.every((msg, index) => msg.id === prevMessages[index]?.id)
    const sameEvents = events.length === prev.events.length && events.every((event, index) => event.id === prev.events[index]?.id)
    const sameExtra =
      memory === prev.memory &&
      telegramChatId === prev.telegramChatId &&
      visitorId === prev.visitorId &&
      JSON.stringify(facts ?? {}) === JSON.stringify(prev.facts ?? {})
    if (sameMessages && sameEvents && sameExtra) return prev
    return {
      ...prev,
      events,
      messages,
      memory,
      facts,
      telegramChatId,
      visitorId,
      printAt: prev.printAt || incoming.printAt,
      bancaAt: prev.bancaAt || incoming.bancaAt,
    }
  }
  const addedChat = (incoming.messages ?? []).some((msg) => msg.id && !(prev.messages ?? []).some((item) => item.id === msg.id))
  return {
    ...incoming,
    events,
    messages,
    memory,
    facts,
    telegramChatId,
    visitorId,
    printAt: incoming.printAt || prev.printAt,
    bancaAt: incoming.bancaAt || prev.bancaAt,
    temperature: addedChat ? prev.temperature : incoming.temperature,
    name: addedChat ? prev.name : incoming.name,
    contact: addedChat ? prev.contact : incoming.contact,
  }
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
    const next = adoptStoredLead(prev, lead)
    if (next !== prev) {
      map.set(lead.id, next)
      changed = true
    }
  }
  if (!changed) return current
  return [...map.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, CAP)
}

export function clipRemovedIds(ids: unknown, cap = CAP): string[] {
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
  const seen = new Set<string>()
  const next: SalesFunnel[] = []
  for (const funnel of incoming) {
    const prev = server.find((item) => item.id === funnel.id)
    next.push(prev && prev.updatedAt > funnel.updatedAt ? prev : funnel)
    seen.add(funnel.id)
  }
  for (const funnel of server) {
    if (!seen.has(funnel.id)) next.push(funnel)
  }
  return next.slice(0, 20)
}

/** Sem hydrate, um POST do seed local criava um quadro a mais ou, no reconcile antigo, apagava os outros. */
export function canFlushCrm(hydrated: boolean) {
  return hydrated
}

export function pendingSeedFunnelIds(remote: SalesFunnel[], local: SalesFunnel[]): string[] {
  if (remote.length) return []
  return local.map((item) => item.id).filter(Boolean)
}

export function hydrateFunnels(
  local: SalesFunnel[],
  remote: SalesFunnel[],
  pendingIds: Iterable<string>,
  removedIds: Iterable<string>
): SalesFunnel[] {
  const adopted = remote.length ? adoptRemoteFunnels(local, remote, pendingIds) : local
  return applyRemovedFunnels(adopted, [...removedIds])
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
