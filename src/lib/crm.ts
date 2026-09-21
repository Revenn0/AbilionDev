import { publishedFunnel } from "./runtime.ts"
import { migrateSettings } from "./migrate.ts"
import { mergeLeadCategories } from "./lead-category.ts"
import { isOperatorLockedLead } from "./ops.ts"
import { preferLeadName } from "./lead-name.ts"
import { applyRemovedPageScripts, mergePageScripts, PAGE_SCRIPT_REMOVED_CAP } from "./page-script.ts"
import { defaultSettings, type ChatMessage, type Lead, type LeadEvent, type LeadFacts, type SalesFunnel, type Settings } from "./types.ts"

const CAP = 400
export const LEAD_LIST_CAP = 16_000
export const LEAD_LIST_PAGES = 40
export const LEAD_CACHE_CAP = 2000

/** localStorage: os leads ainda por gravar não saem do recorte dos 2000 mais novos. */
export function cacheLeadsForStorage(leads: Lead[], pendingIds: Iterable<string> = [], cap = LEAD_CACHE_CAP) {
  const pin = new Set([...pendingIds].filter(Boolean))
  const pinned: Lead[] = []
  const rest: Lead[] = []
  const seen = new Set<string>()
  for (const lead of leads) {
    if (!lead?.id || seen.has(lead.id)) continue
    seen.add(lead.id)
    ;(pin.has(lead.id) ? pinned : rest).push(lead)
  }
  rest.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  if (pinned.length >= cap) return pinned
  return [...pinned, ...rest.slice(0, cap - pinned.length)]
}
export const LEAD_REMOVED_CAP = 8000
export const FUNNEL_REMOVED_CAP = 400
export const FUNNEL_CAP = 20
export const INBOX_LIST_PAGES = 5

export type LeadListPage = {
  leads: Lead[]
  nextCursor?: string
  stale?: boolean
  clipped?: boolean
  removed?: string[]
  eventsUnread?: boolean
}

export type LeadPageFold = "strict" | "window"

/** Junta páginas do GET /api/leads. Cursor velho no meio pede retry. Janela cheia (teto do hydrate) conta. */
export function collectLeadPages(
  pages: LeadListPage[],
  fold: LeadPageFold = "strict"
): { ok: boolean; leads: Lead[]; retry: boolean; complete: boolean; eventsUnread: boolean } {
  const leads: Lead[] = []
  let clipped = false
  let eventsUnread = false
  for (let index = 0; index < pages.length; index++) {
    const page = pages[index]
    if (page.stale || (index > 0 && page.leads.length === 0)) {
      return { ok: false, leads: [], retry: true, complete: false, eventsUnread }
    }
    leads.push(...page.leads)
    if (page.clipped) clipped = true
    if (page.eventsUnread) eventsUnread = true
    if (!page.nextCursor) return { ok: true, leads, retry: false, complete: clipped !== true, eventsUnread }
  }
  if (!pages.length) return { ok: true, leads: [], retry: false, complete: true, eventsUnread: false }
  if (fold === "window") return { ok: true, leads, retry: false, complete: false, eventsUnread }
  return { ok: false, leads: [], retry: true, complete: false, eventsUnread }
}

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
  const contact = newer.contact || older.contact
  const category = newer.category ?? older.category
  const extra = { email: facts.email, messages }
  const nextName = preferLeadName(newer.name, older.name, contact, extra)
  if (incomingOlder) {
    const prevMessages = prev.messages ?? []
    const sameMessages = messages.length === prevMessages.length && messages.every((msg, index) => msg.id === prevMessages[index]?.id)
    const sameEvents = events.length === prev.events.length && events.every((event, index) => event.id === prev.events[index]?.id)
    const sameExtra =
      memory === prev.memory &&
      telegramChatId === prev.telegramChatId &&
      visitorId === prev.visitorId &&
      category === prev.category &&
      nextName === prev.name &&
      JSON.stringify(facts ?? {}) === JSON.stringify(prev.facts ?? {})
    if (sameMessages && sameEvents && sameExtra) return prev
    return {
      ...prev,
      name: nextName,
      events,
      messages,
      memory,
      facts,
      telegramChatId,
      visitorId,
      category,
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
    category,
    printAt: incoming.printAt || prev.printAt,
    bancaAt: incoming.bancaAt || prev.bancaAt,
    temperature: addedChat ? prev.temperature : incoming.temperature,
    name: addedChat ? preferLeadName(prev.name, incoming.name, contact, extra) : nextName,
    contact: addedChat ? prev.contact : incoming.contact,
  }
}

/** POST do painel: em chat real ou lista importada só actualiza nota, nome e temperatura. */
export function adoptOperatorLead(prev: Lead | null, incoming: Lead): Lead {
  if (!prev) return incoming
  if (!isOperatorLockedLead(prev) && !isOperatorLockedLead(incoming)) return adoptStoredLead(prev, incoming)
  const patched: Lead = {
    ...prev,
    name: incoming.name || prev.name,
    contact: incoming.contact || prev.contact,
    temperature: incoming.temperature,
    memory: incoming.memory,
    facts: incoming.facts,
    category: incoming.category ?? prev.category,
    updatedAt: incoming.updatedAt > prev.updatedAt ? incoming.updatedAt : prev.updatedAt,
  }
  return adoptStoredLead(prev, patched)
}

/** Persist do lead: une o snapshot lido no início com o KV no instante do upsert. */
export function commitStoredLead(prev: Lead | null, incoming: Lead, latest: Lead | null = prev): Lead {
  const first = prev ? adoptStoredLead(prev, incoming) : incoming
  if (!latest || latest === prev) return first
  return adoptStoredLead(latest, first)
}

/**
 * Cron: o Telegram recusou o envio. Volta a espera/fase de antes do avanço
 * e conserva falas que chegaram a meio (webhook), sem as bolhas da Sté que não saíram.
 */
export function restoreLeadAfterFailedSend(queued: Lead, live: Lead | null): Lead {
  const now = new Date().toISOString()
  if (!live) return { ...queued, updatedAt: now }
  const queuedIds = new Set((queued.messages ?? []).map((item) => item.id).filter(Boolean))
  const extras = (live.messages ?? []).filter((item) => item.id && !queuedIds.has(item.id) && item.role !== "ste")
  const messages = mergeLeadMessages(queued.messages ?? [], extras)
  const last = messages.at(-1)
  return {
    ...live,
    waitUntil: queued.waitUntil,
    nodeId: queued.nodeId,
    stage: queued.stage,
    stePhase: queued.stePhase,
    steBlocked: queued.steBlocked,
    steQuiet: queued.steQuiet,
    memory: queued.memory,
    funnelId: queued.funnelId,
    paused: queued.paused,
    messages,
    lastMessage: last?.text || queued.lastMessage,
    updatedAt: now,
  }
}

/** POST adoptou um id local noutro lead canónico — a ficha fantasma some. */
export function remapAdoptedLeads(leads: Lead[], adopted: Record<string, string>): Lead[] {
  const pairs = Object.entries(adopted).filter(([from, to]) => from && to && from !== to)
  if (!pairs.length) return leads
  const byId = new Map(leads.map((lead) => [lead.id, lead]))
  let changed = false
  for (const [from, to] of pairs) {
    const phantom = byId.get(from)
    if (!phantom) continue
    byId.delete(from)
    const live = byId.get(to)
    const renamed = { ...phantom, id: to }
    byId.set(to, live ? adoptStoredLead(live, renamed) : renamed)
    changed = true
  }
  return changed ? [...byId.values()] : leads
}

export function mergeLeads(current: Lead[], incoming: Lead[], pinIds: Iterable<string> = []): Lead[] {
  const pin = new Set(pinIds)
  if (!incoming.length && !pin.size) return current
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
  if (!changed && !pin.size) return current
  const ranked = [...map.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  if (!pin.size) return ranked.slice(0, LEAD_LIST_CAP)
  const pinned = ranked.filter((lead) => pin.has(lead.id))
  const rest = ranked.filter((lead) => !pin.has(lead.id)).slice(0, Math.max(0, LEAD_LIST_CAP - pinned.length))
  return [...pinned, ...rest].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
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

/** O painel acrescenta tombstones no fim do Set — conserva os mais novos. */
export function clipNewestIds(ids: Iterable<string>, cap: number) {
  return clipRemovedIds([...ids].reverse(), cap).reverse()
}

/** A fila do painel manda na ficha: a inbox não pisa nota, nome ou temperatura a meio do debounce. */
export function overlayPendingLeads(
  leads: Lead[],
  pending: Map<string, Lead> | Iterable<Lead>,
  removedIds: Iterable<string> = []
): Lead[] {
  const queued = pending instanceof Map ? pending : new Map([...pending].map((lead) => [lead.id, lead]))
  for (const id of removedIds) queued.delete(id)
  const base = applyRemovedLeads(leads, removedIds)
  if (!queued.size) return base
  let changed = base !== leads
  const seen = new Set<string>()
  const next = base.map((lead) => {
    const draft = queued.get(lead.id)
    seen.add(lead.id)
    if (!draft) return lead
    const overlaid = adoptOperatorLead(lead, draft)
    if (overlaid !== lead) changed = true
    return overlaid
  })
  for (const draft of queued.values()) {
    if (seen.has(draft.id)) continue
    next.unshift(draft)
    changed = true
  }
  return changed ? next : leads
}

export function reconcileLeads(
  current: Lead[],
  incoming: Lead[],
  pendingIds: Iterable<string> = [],
  complete = true
): Lead[] {
  if (!incoming.length) return current
  const merged = mergeLeads(current, incoming)
  if (!complete) return merged
  const remoteIds = new Set(incoming.map((lead) => lead.id))
  const pending = new Set(pendingIds)
  const next = merged.filter((lead) => remoteIds.has(lead.id) || pending.has(lead.id))
  if (next.length === merged.length) return merged
  return next.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, LEAD_LIST_CAP)
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
  return clipFunnelsKeepBoards(next, pending)
}

/** Hydrate pode recortar rascunhos; quadro publicado e pending não saem para caber um draft. */
export function clipFunnelsKeepBoards(funnels: SalesFunnel[], pinIds: Iterable<string> = []): SalesFunnel[] {
  if (funnels.length <= FUNNEL_CAP) return funnels
  const pin = new Set(pinIds)
  const rank = (funnel: SalesFunnel) => {
    if (pin.has(funnel.id)) return 0
    if (funnel.production) return 1
    return 2
  }
  return funnels
    .slice()
    .sort((left, right) => rank(left) - rank(right) || right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, FUNNEL_CAP)
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

export function leadsStillOnRemote(removedIds: Iterable<string>, remote: Array<{ id: string }>) {
  const drop = new Set(removedIds)
  if (!drop.size) return []
  return remote.filter((item) => drop.has(item.id)).map((item) => item.id)
}

/** DELETE 200/204: Worker apagou. 503: KV já tem tombstone. 401/rede: o Worker não gravou — não persistir o hide. */
export function leadDeleteAck(status: number | null | undefined): { keepTombstone: boolean; ok: boolean } {
  if (status === 200 || status === 204) return { keepTombstone: true, ok: true }
  if (status === 503) return { keepTombstone: true, ok: false }
  return { keepTombstone: false, ok: false }
}

/** POST do CRM só tombstoneia o funil se o Worker aceitou. 503/401/rede deixam o quadro no servidor. */
export function crmDeleteAck(ok: boolean): { keepTombstone: boolean; ok: boolean } {
  return ok ? { keepTombstone: true, ok: true } : { keepTombstone: false, ok: false }
}

export function rememberLocalTombstone(removed: Iterable<string>, id: string, keep: boolean): string[] {
  const next = new Set([...removed].filter(Boolean))
  if (keep) next.add(id)
  else next.delete(id)
  return [...next]
}

export function restoreAfterFailedDelete<T extends { id: string }>(current: T[], doomed: T | undefined): T[] {
  if (!doomed?.id) return current
  if (current.some((item) => item.id === doomed.id)) return current
  return [doomed, ...current]
}

/** GET completo vazio limpa o local; GET incompleto ou inbox vazia conservam. */
export function hydrateLeads(
  local: Lead[],
  remote: { ok: boolean; leads: Lead[]; complete?: boolean },
  inbox: { ok: boolean; leads: Lead[] },
  pending: Map<string, Lead>,
  removed: Iterable<string>
): Lead[] {
  let next = applyRemovedLeads(local, removed)
  if (remote.ok) {
    const incoming = applyRemovedLeads(remote.leads, removed)
    next = remote.leads.length
      ? reconcileLeads(local, incoming, pending.keys(), remote.complete !== false)
      : remote.complete === false
        ? applyRemovedLeads(local, removed)
        : local.filter((lead) => pending.has(lead.id))
  }
  if (inbox.ok && inbox.leads.length) {
    next = mergeLeads(next, applyRemovedLeads(inbox.leads, removed))
  }
  return overlayPendingLeads(next, pending, removed)
}

/** GET/MCP: KV e Postgres juntam-se; tombstone continua a valer. KV oco não esconde o backup. */
export function adoptFunnelStores(kv: SalesFunnel[], remote: SalesFunnel[] = [], removedIds: Iterable<string> = []) {
  const merged = applyRemovedFunnels(reconcileFunnels(remote, kv), [...removedIds])
  if (merged.length <= FUNNEL_CAP) return merged
  return clipFunnelsKeepBoards(merged, kv.map((item) => item.id))
}

/** GET: objecto vazio no KV não esconde username, scripts e categorias que ainda estão no Postgres. */
export function adoptSettingsStores(kv: Settings, remote?: Settings | null): Settings {
  const local = migrateSettings(kv)
  if (!remote) return local
  return commitStoredSettings(remote, local, local)
}

/** POST do CRM: username/grupo do Vincular não somem se o autosave vier vazio. */
export function commitStoredSettings(stored: Settings, incoming: Settings, latest: Settings = stored): Settings {
  const live = migrateSettings(latest)
  const patch = migrateSettings(incoming)
  const prev = migrateSettings(stored)
  return migrateSettings({
    ...live,
    ...patch,
    telegramBotUsername: patch.telegramBotUsername || live.telegramBotUsername || prev.telegramBotUsername,
    telegramGroupUrl: patch.telegramGroupUrl || live.telegramGroupUrl || prev.telegramGroupUrl,
    plugins: {
      ...live.plugins,
      ...patch.plugins,
      telegram: Boolean(patch.plugins.telegram || live.plugins.telegram),
    },
    pageScripts: applyRemovedPageScripts(
      mergePageScripts(prev.pageScripts, live.pageScripts, patch.pageScripts),
      clipNewestIds([...(prev.removedPageScripts ?? []), ...(live.removedPageScripts ?? []), ...(patch.removedPageScripts ?? [])], PAGE_SCRIPT_REMOVED_CAP)
    ),
    removedPageScripts: clipNewestIds(
      [...(prev.removedPageScripts ?? []), ...(live.removedPageScripts ?? []), ...(patch.removedPageScripts ?? [])],
      PAGE_SCRIPT_REMOVED_CAP
    ),
    leadCategories: mergeLeadCategories(prev.leadCategories, live.leadCategories, patch.leadCategories),
    telegramBotToken: "",
    esterTelegramChatId: "",
  })
}

/** GET do CRM não pisa username/grupo/scripts ainda por gravar, nem um GET vazio apaga o local. */
export function adoptHydrateSettings(
  local: Settings,
  remote: Partial<Settings> | undefined,
  dirty: boolean,
  runtime: { telegramBotUsername?: string; telegramGroupUrl?: string; telegram?: boolean; ok?: boolean }
): Settings {
  if (dirty) {
    return {
      ...local,
      telegramBotToken: "",
      telegramBotUsername: local.telegramBotUsername,
      telegramGroupUrl: local.telegramGroupUrl,
      plugins: { ...local.plugins },
    }
  }
  const prev = migrateSettings(local)
  const base = remote ? commitStoredSettings(prev, migrateSettings({ ...prev, ...remote }), prev) : prev
  return {
    ...base,
    telegramBotToken: "",
    telegramBotUsername: runtime.telegramBotUsername || base.telegramBotUsername,
    telegramGroupUrl: runtime.telegramGroupUrl || base.telegramGroupUrl,
    plugins: {
      ...base.plugins,
      telegram: runtime.ok ? Boolean(runtime.telegram) : base.plugins.telegram,
    },
  }
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
  return {
    ...defaultSettings,
    plugins: { ...defaultSettings.plugins },
    pageScripts: [...defaultSettings.pageScripts],
    removedPageScripts: [...defaultSettings.removedPageScripts],
    leadCategories: [...defaultSettings.leadCategories],
  }
}

/** Vincular o bot: se o GET das settings falhou, não grava um objecto oco por cima dos scripts. */
export function linkRuntimeSettings(
  settings: Settings | null,
  next: { telegramBotUsername?: string; telegramGroupUrl?: string; telegramBotToken?: string }
): Settings | null {
  if (!settings) return null
  return {
    ...settings,
    telegramBotUsername: next.telegramBotUsername || settings.telegramBotUsername,
    telegramGroupUrl: next.telegramGroupUrl || settings.telegramGroupUrl,
    telegramBotToken: "",
    steLinkedTelegram: settings.steLinkedTelegram !== false,
    plugins: { ...settings.plugins, telegram: Boolean(next.telegramBotToken) },
  }
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
  return next
}

export function canCreateFunnel(funnels: SalesFunnel[]): { ok: true } | { ok: false; reason: string } {
  if (funnels.length >= FUNNEL_CAP) return { ok: false, reason: `O estúdio aceita no máximo ${FUNNEL_CAP} funis.` }
  return { ok: true }
}

/** Lista unread e oca: não fingir que ainda não há funis. Se o KV já tem algum, criar segue — não usar para gravar lead contra o quadro (aí é `funnelsWriteBlocked`). */
export function funnelsListBlocked(unread: boolean, funnels?: SalesFunnel[]) {
  return unread && !(funnels ?? []).length
}

/** POST do CRM: une o snapshot lido no início com o KV no instante do persist. */
export function commitCrmFunnels(
  stored: SalesFunnel[],
  incoming: SalesFunnel[],
  storedRemoved: string[],
  incomingRemoved: string[],
  latest: SalesFunnel[] = stored,
  latestRemoved: string[] = storedRemoved
): SalesFunnel[] {
  const first = applyRemovedFunnels(
    reconcileFunnels(stored, incoming),
    clipRemovedIds([...storedRemoved, ...incomingRemoved], 400)
  )
  if (latest === stored && latestRemoved === storedRemoved) return first
  return applyRemovedFunnels(
    reconcileFunnels(latest, first),
    clipRemovedIds([...latestRemoved, ...incomingRemoved], 400)
  )
}

/** Funis editados ou criados a meio do POST — o sucesso do snapshot velho não os tira da fila. */
export function leftoverPendingFunnelIds(
  pendingIds: Iterable<string>,
  flushed: SalesFunnel[],
  live: SalesFunnel[]
): string[] {
  const flushedAt = new Map(flushed.map((item) => [item.id, item.updatedAt]))
  const leftover: string[] = []
  const seen = new Set<string>()
  for (const id of pendingIds) {
    if (seen.has(id)) continue
    seen.add(id)
    const local = live.find((item) => item.id === id)
    if (!local) continue
    const remote = flushedAt.get(id)
    if (!remote || local.updatedAt > remote) leftover.push(id)
  }
  return leftover
}

export function settingsWriteFingerprint(settings: Settings): string {
  const { telegramBotToken: _token, esterTelegramChatId: _ester, ...rest } = settings
  return JSON.stringify(rest)
}

/** GET ok não esconde POST pendente; POST ok não esconde GET falhado. */
export function leadPersistSync(opts: {
  readKnown: boolean
  readOk: boolean
  pendingWrites: number
  writeOk?: boolean
}): "idle" | "ok" | "error" {
  if (opts.pendingWrites > 0 || opts.writeOk === false) return "error"
  if (!opts.readKnown) return "idle"
  return opts.readOk ? "ok" : "error"
}

/** Sem hydrate, um POST do seed local criava um quadro a mais ou, no reconcile antigo, apagava os outros. */
export function canFlushCrm(hydrated: boolean) {
  return hydrated
}

export function pendingSeedFunnelIds(remote: SalesFunnel[], local: SalesFunnel[]): string[] {
  if (remote.length) return []
  return local.map((item) => item.id).filter(Boolean)
}

/** Funis que o Worker já tem, mas o painel tem `updatedAt` mais novo — voltam à fila de flush. */
export function recoverPendingFunnelIds(local: SalesFunnel[], remote: SalesFunnel[]): string[] {
  if (!local.length || !remote.length) return []
  const remoteById = new Map(remote.map((item) => [item.id, item]))
  return local.filter((funnel) => {
    const other = remoteById.get(funnel.id)
    return Boolean(other && funnel.updatedAt > other.updatedAt)
  }).map((funnel) => funnel.id)
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

export function revertPublishedFunnels(current: SalesFunnel[], lastGood: SalesFunnel[]): SalesFunnel[] {
  if (!lastGood.length) return current
  let changed = false
  const next = current.map((funnel) => {
    const good = lastGood.find((item) => item.id === funnel.id)
    if (!good) return funnel
    if (funnel.status === good.status && funnel.production?.publishedAt === good.production?.publishedAt) return funnel
    changed = true
    return { ...funnel, status: good.status, production: good.production }
  })
  return changed ? next : current
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
