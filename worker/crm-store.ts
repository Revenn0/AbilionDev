import { contactLookups } from "../src/lib/capture.ts"
import {
  adoptOperatorLead,
  applyRemovedFunnels,
  clipRemovedIds,
  commitCrmFunnels,
  commitStoredLead,
  commitStoredSettings,
  emptySettings,
  enforceSinglePublished,
  FUNNEL_CAP,
  FUNNEL_REMOVED_CAP,
  LEAD_REMOVED_CAP,
  publicSettings,
} from "../src/lib/crm.ts"
import { leadMatchesQuery } from "../src/lib/lead-name.ts"
import { migrateLead, migrateSettings, sanitizeIncomingFunnel } from "../src/lib/migrate.ts"
import type { Lead, SalesFunnel, Settings } from "../src/lib/types.ts"
import type { KvLike } from "./kv.ts"

export const CRM_INDEX = "crm:index"
export const CRM_FUNNELS = "crm:funnels"
export const CRM_SETTINGS = "crm:settings"
export const CRM_REMOVED = "crm:removed"
export const CRM_REMOVED_FUNNELS = "crm:removed-funnels"
export const CRM_NAMES = "crm:names"
export const CRM_CRON_LOCK = "crm:cron-lock"

export { LEAD_REMOVED_CAP, FUNNEL_REMOVED_CAP }
export const LEAD_INDEX_REST_CAP = 4000
export const LEAD_INDEX_PINNED_CAP = 8000

export function aliasKey(kind: "contact" | "chat", value: string) {
  const next = value.trim().slice(0, 80)
  return next ? `crm:alias:${kind}:${next}` : ""
}

export type CrmIndexEntry = {
  id: string
  contact: string
  name?: string
  category?: string
  chatId?: string
  waitUntil?: string
  updatedAt: string
  channel: Lead["channel"]
}

export type CrmIndex = {
  entries: CrmIndexEntry[]
}

export function leadKey(id: string) {
  return `crm:lead:${id}`
}

export async function loadIndex(kv: KvLike): Promise<CrmIndex> {
  const raw = await kv.get(CRM_INDEX, "json")
  if (!raw || typeof raw !== "object") return { entries: [] }
  const value = raw as Partial<CrmIndex>
  return { entries: Array.isArray(value.entries) ? value.entries : [] }
}

export function mergeIndexEntries(left: CrmIndexEntry[], right: CrmIndexEntry[]): CrmIndexEntry[] {
  const byId = new Map(left.map((item) => [item.id, item]))
  for (const item of right) {
    const prev = byId.get(item.id)
    if (!prev || item.updatedAt >= prev.updatedAt) {
      byId.set(item.id, { ...prev, ...item, name: item.name || prev?.name, category: item.category || prev?.category })
    } else {
      byId.set(item.id, { ...item, ...prev, name: prev.name || item.name, category: prev.category || item.category })
    }
  }
  return [...byId.values()]
}

export function clipCrmIndex(entries: CrmIndexEntry[]): CrmIndexEntry[] {
  const byId = new Map(entries.map((item) => [item.id, item]))
  const all = [...byId.values()]
  const waiting = all.filter((item) => item.waitUntil)
  const chats = all
    .filter((item) => item.chatId && !item.waitUntil)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, LEAD_INDEX_PINNED_CAP)
  const rest = all
    .filter((item) => !item.waitUntil && !item.chatId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, LEAD_INDEX_REST_CAP)
  const keep = new Map<string, CrmIndexEntry>()
  for (const item of [...waiting, ...chats, ...rest]) keep.set(item.id, item)
  return [...keep.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

async function saveIndex(kv: KvLike, index: CrmIndex) {
  await kv.put(CRM_INDEX, JSON.stringify({ entries: clipCrmIndex(index.entries) }))
}

async function commitIndex(kv: KvLike, extra: CrmIndexEntry[] = [], removeIds: string[] = []) {
  const drop = new Set(removeIds)
  for (let attempt = 0; attempt < 16; attempt++) {
    if (attempt) await new Promise((resolve) => setTimeout(resolve, attempt * 2))
    const before = await loadIndex(kv)
    const merged = mergeIndexEntries(
      before.entries.filter((item) => !drop.has(item.id)),
      extra.filter((item) => !drop.has(item.id))
    )
    const next = clipCrmIndex(merged)
    await saveIndex(kv, { entries: next })
    const after = await loadIndex(kv)
    const afterIds = new Set(after.entries.map((item) => item.id))
    if (extra.some((item) => !drop.has(item.id) && !afterIds.has(item.id))) continue
    if (removeIds.some((id) => afterIds.has(id))) continue
    if (next.every((item) => afterIds.has(item.id))) return
  }
}

export function leadPageCursor(entry: Pick<CrmIndexEntry, "updatedAt" | "id">) {
  return `${entry.updatedAt}|${entry.id}`
}

export function isLeadPageCursor(value: string) {
  const next = value.trim()
  if (!next || next.length > 160) return false
  const split = next.indexOf("|")
  return split > 0 && split < next.length - 1
}

export async function listLeadPage(
  kv: KvLike,
  limit = 80,
  channel: Lead["channel"] | "all" = "telegram",
  cursor = ""
): Promise<{ leads: Lead[]; nextCursor?: string; stale?: boolean }> {
  const index = await loadIndex(kv)
  const rows = channel === "all" ? index.entries : index.entries.filter((item) => item.channel === channel)
  let start = 0
  const mark = cursor.trim()
  if (mark) {
    const at = rows.findIndex((item) => leadPageCursor(item) === mark)
    if (at < 0) return { leads: [], stale: true }
    start = at + 1
  }
  const slice = rows.slice(start, start + Math.max(1, limit))
  const leads = (await Promise.all(slice.map((item) => loadLead(kv, item.id)))).filter((lead): lead is Lead => Boolean(lead))
  await rememberLeadNames(kv, leads)
  const last = slice.at(-1)
  return {
    leads,
    nextCursor: slice.length === limit && last ? leadPageCursor(last) : undefined,
  }
}

async function writeAliases(kv: KvLike, lead: Pick<Lead, "id" | "contact" | "telegramChatId">) {
  for (const value of contactLookups(lead.contact)) {
    await claimLeadAlias(kv, "contact", value, lead.id)
  }
  if (lead.telegramChatId) await claimLeadAlias(kv, "chat", lead.telegramChatId, lead.id)
}

async function clearAliases(kv: KvLike, lead: Pick<Lead, "contact" | "telegramChatId"> | null, entry?: CrmIndexEntry) {
  for (const value of contactLookups(lead?.contact || entry?.contact || "")) {
    const contact = aliasKey("contact", value)
    if (contact) await kv.delete?.(contact)
  }
  const chat = aliasKey("chat", lead?.telegramChatId || entry?.chatId || "")
  if (chat) await kv.delete?.(chat)
}

async function loadAlias(kv: KvLike, kind: "contact" | "chat", value: string): Promise<string | null> {
  const key = aliasKey(kind, value)
  if (!key) return null
  const raw = await kv.get(key, "json")
  if (!raw || typeof raw !== "object") return null
  const id = (raw as { id?: unknown }).id
  return typeof id === "string" && id ? id : null
}

async function aliasOwnerState(kv: KvLike, id: string): Promise<"live" | "reserved" | "dead"> {
  if (await loadLead(kv, id)) return "live"
  if ((await loadRemovedLeadIds(kv)).includes(id)) return "dead"
  return "reserved"
}

export async function claimLeadAlias(
  kv: KvLike,
  kind: "contact" | "chat",
  value: string,
  id: string
): Promise<string> {
  const key = aliasKey(kind, value)
  if (!key || !id) return id
  const current = await loadAlias(kv, kind, value)
  if (current && current !== id && (await aliasOwnerState(kv, current)) !== "dead") return current
  await kv.put(key, JSON.stringify({ id }))
  return (await loadAlias(kv, kind, value)) || id
}

async function bindContactAliases(kv: KvLike, contact: string, id: string) {
  for (const value of contactLookups(contact)) {
    await claimLeadAlias(kv, "contact", value, id)
  }
}

async function liveAliasId(kv: KvLike, kind: "contact" | "chat", value: string) {
  const current = await loadAlias(kv, kind, value)
  if (!current) return null
  return (await aliasOwnerState(kv, current)) === "dead" ? null : current
}

export async function reserveLeadIdentity(
  kv: KvLike,
  contact: string,
  chatId: string,
  proposedId: string
): Promise<string> {
  if (contact) {
    for (const value of contactLookups(contact)) {
      const current = await liveAliasId(kv, "contact", value)
      if (!current) continue
      if (chatId) await claimLeadAlias(kv, "chat", chatId, current)
      await bindContactAliases(kv, contact, current)
      return current
    }
  }
  if (chatId) {
    const id = await claimLeadAlias(kv, "chat", chatId, proposedId)
    if (contact) await bindContactAliases(kv, contact, id)
    return id
  }
  if (contact) {
    await bindContactAliases(kv, contact, proposedId)
    for (const value of contactLookups(contact)) {
      const current = await loadAlias(kv, "contact", value)
      if (current) return current
    }
    return proposedId
  }
  return proposedId
}

export async function resolveLeadWrite(kv: KvLike, lead: Lead): Promise<{ incoming: Lead; prev: Lead | null }> {
  const existing = await loadLead(kv, lead.id)
  if (existing) return { incoming: lead, prev: existing }
  const reserved = await reserveLeadIdentity(kv, lead.contact, lead.telegramChatId ?? "", lead.id)
  const prev = reserved === lead.id ? null : await loadLead(kv, reserved)
  return {
    incoming: { ...lead, id: reserved, createdAt: prev?.createdAt ?? lead.createdAt },
    prev,
  }
}

export async function importOrAdoptLead(kv: KvLike, lead: Lead): Promise<Lead | null> {
  const { incoming, prev } = await resolveLeadWrite(kv, lead)
  const removed = await loadRemovedLeadIds(kv)
  if (removed.includes(incoming.id)) return null
  const next = adoptOperatorLead(prev, incoming)
  let bounded = commitStoredLead(prev, next)
  const latest = await loadLead(kv, bounded.id)
  bounded = commitStoredLead(prev, bounded, latest)
  await upsertLeadKv(kv, bounded)
  return bounded
}

export function settingsPersistSettled(after: Settings, again: Settings) {
  return (
    after.telegramBotUsername === again.telegramBotUsername &&
    after.telegramGroupUrl === again.telegramGroupUrl &&
    JSON.stringify(after.pageScripts ?? []) === JSON.stringify(again.pageScripts ?? []) &&
    JSON.stringify(after.removedPageScripts ?? []) === JSON.stringify(again.removedPageScripts ?? []) &&
    JSON.stringify(after.leadCategories ?? []) === JSON.stringify(again.leadCategories ?? [])
  )
}

export async function persistSettingsMerge(kv: KvLike, incoming: Settings): Promise<Settings> {
  let clean = incoming
  for (let attempt = 0; attempt < 8; attempt++) {
    const latest = await loadSettingsKv(kv)
    clean = commitStoredSettings(latest, incoming, latest)
    await saveSettingsKv(kv, clean)
    const after = await loadSettingsKv(kv)
    const again = commitStoredSettings(after, incoming, after)
    if (settingsPersistSettled(after, again)) break
  }
  return clean
}

function funnelPersistKey(funnels: SalesFunnel[]) {
  return funnels
    .map((item) => `${item.id}:${item.updatedAt}:${item.status}:${item.production ? "1" : "0"}`)
    .sort()
    .join("|")
}

export async function persistFunnelsMerge(kv: KvLike, incoming: SalesFunnel[], incomingRemoved: string[] = []): Promise<SalesFunnel[]> {
  if (!incoming.length) throw new Error("Mantém pelo menos um funil.")
  let clean = incoming
  for (let attempt = 0; attempt < 8; attempt++) {
    const latestRemoved = await loadRemovedFunnelIds(kv)
    const latest = applyRemovedFunnels(await loadFunnelsKv(kv), latestRemoved)
    clean = enforceSinglePublished(commitCrmFunnels(latest, incoming, latestRemoved, incomingRemoved, latest, latestRemoved))
    if (!clean.length) throw new Error("Mantém pelo menos um funil.")
    if (clean.length > FUNNEL_CAP) throw new Error(`O estúdio aceita no máximo ${FUNNEL_CAP} funis.`)
    await saveFunnelsKv(kv, clean)
    if (incomingRemoved.length) await rememberRemovedFunnels(kv, incomingRemoved)
    const afterRemoved = await loadRemovedFunnelIds(kv)
    const after = applyRemovedFunnels(await loadFunnelsKv(kv), afterRemoved)
    const again = enforceSinglePublished(commitCrmFunnels(after, incoming, afterRemoved, incomingRemoved, after, afterRemoved))
    if (funnelPersistKey(after) === funnelPersistKey(again)) break
  }
  return clean
}

export async function loadLead(kv: KvLike, id: string): Promise<Lead | null> {
  const raw = await kv.get(leadKey(id), "json")
  if (!raw || typeof raw !== "object") return null
  return migrateLead(raw as Lead)
}

export async function listLeads(kv: KvLike, limit = 80, channel: Lead["channel"] | "all" = "telegram"): Promise<Lead[]> {
  return (await listLeadPage(kv, limit, channel)).leads
}

export async function findLeadInKv(kv: KvLike, contact: string, telegramId: number, chatId: string): Promise<Lead | null> {
  const candidates = [...new Set([...contactLookups(contact), `tg:${telegramId}`, chatId].filter(Boolean))]
  for (const value of candidates) {
    const byContact = await loadAlias(kv, "contact", value)
    if (byContact) {
      const lead = await loadLead(kv, byContact)
      if (lead) return lead
    }
    const byChat = await loadAlias(kv, "chat", value)
    if (byChat) {
      const lead = await loadLead(kv, byChat)
      if (lead) return lead
    }
  }
  const index = await loadIndex(kv)
  const aliases = new Set(candidates)
  const hit = index.entries.find(
    (item) => aliases.has(item.contact) || (item.chatId && (item.chatId === chatId || aliases.has(item.chatId)))
  )
  return hit ? loadLead(kv, hit.id) : null
}

function readNameMap(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const out: Record<string, string> = {}
  for (const [id, name] of Object.entries(raw as Record<string, unknown>)) {
    if (!id || typeof name !== "string") continue
    const next = name.trim().slice(0, 80)
    if (next) out[id] = next
  }
  return out
}

export async function loadLeadNames(kv: KvLike): Promise<Record<string, string>> {
  return readNameMap(await kv.get(CRM_NAMES, "json"))
}

export async function rememberLeadNames(kv: KvLike, leads: Array<Pick<Lead, "id" | "name">>) {
  if (!leads.length) return
  const names = await loadLeadNames(kv)
  let changed = false
  for (const lead of leads) {
    const next = lead.name.trim().slice(0, 80)
    if (!lead.id || !next || names[lead.id] === next) continue
    names[lead.id] = next
    changed = true
  }
  if (!changed) return
  const keep = new Set((await loadIndex(kv)).entries.map((item) => item.id))
  const clipped: Record<string, string> = {}
  for (const [id, name] of Object.entries(names)) {
    if (keep.has(id) || leads.some((lead) => lead.id === id)) clipped[id] = name
  }
  await kv.put(CRM_NAMES, JSON.stringify(clipped))
}

export async function lookupLeadsByQuery(kv: KvLike, query: string): Promise<Lead[]> {
  const needle = query.trim().slice(0, 80)
  if (needle.length < 3) return []
  const hits: Lead[] = []
  const seen = new Set<string>()
  const push = (lead: Lead | null) => {
    if (!lead || seen.has(lead.id)) return
    seen.add(lead.id)
    hits.push(lead)
  }
  push(await loadLead(kv, needle))
  push(await findLeadInKv(kv, needle, 0, needle))
  const index = await loadIndex(kv)
  const names = await loadLeadNames(kv)
  const matchIds: string[] = []
  for (const entry of index.entries) {
    const name = entry.name || names[entry.id] || ""
    if (!leadMatchesQuery({ id: entry.id, name, contact: entry.contact, telegramChatId: entry.chatId, category: entry.category }, needle)) continue
    if (!seen.has(entry.id) && !matchIds.includes(entry.id)) matchIds.push(entry.id)
    if (matchIds.length >= 20) break
  }
  if (matchIds.length < 20) {
    for (const [id, name] of Object.entries(names)) {
      if (seen.has(id) || matchIds.includes(id)) continue
      if (!leadMatchesQuery({ id, name, contact: "", telegramChatId: "" }, needle)) continue
      matchIds.push(id)
      if (matchIds.length >= 20) break
    }
  }
  for (const id of matchIds) push(await loadLead(kv, id))
  return hits
}

export async function loadRemovedLeadIds(kv: KvLike): Promise<string[]> {
  const raw = await kv.get(CRM_REMOVED, "json")
  if (!raw || typeof raw !== "object") return []
  return clipRemovedIds((raw as { ids?: unknown }).ids, LEAD_REMOVED_CAP)
}

export async function rememberRemovedLead(kv: KvLike, id: string) {
  const next = id.trim()
  if (!next || next.length > 80) return
  const ids = clipRemovedIds([next, ...(await loadRemovedLeadIds(kv))], LEAD_REMOVED_CAP)
  await kv.put(CRM_REMOVED, JSON.stringify({ ids }))
}

export async function forgetRemovedLead(kv: KvLike, id: string) {
  const ids = (await loadRemovedLeadIds(kv)).filter((item) => item !== id)
  await kv.put(CRM_REMOVED, JSON.stringify({ ids }))
}

export async function upsertLeadKv(kv: KvLike, lead: Lead) {
  await forgetRemovedLead(kv, lead.id)
  const entry: CrmIndexEntry = {
    id: lead.id,
    contact: lead.contact,
    name: lead.name,
    category: lead.category,
    chatId: lead.telegramChatId,
    waitUntil: lead.waitUntil,
    updatedAt: lead.updatedAt,
    channel: lead.channel,
  }
  await kv.put(leadKey(lead.id), JSON.stringify(lead))
  await writeAliases(kv, lead)
  await rememberLeadNames(kv, [lead])
  await commitIndex(kv, [entry])
}

export async function deleteLeadKv(kv: KvLike, id: string) {
  const prev = await loadLead(kv, id)
  const index = await loadIndex(kv)
  const entry = index.entries.find((item) => item.id === id)
  await rememberRemovedLead(kv, id)
  await clearAliases(kv, prev, entry)
  const names = await loadLeadNames(kv)
  if (names[id]) {
    delete names[id]
    await kv.put(CRM_NAMES, JSON.stringify(names))
  }
  await kv.delete?.(leadKey(id))
  await commitIndex(kv, [], [id])
}

export async function loadRemovedFunnelIds(kv: KvLike): Promise<string[]> {
  const raw = await kv.get(CRM_REMOVED_FUNNELS, "json")
  if (!raw || typeof raw !== "object") return []
  return clipRemovedIds((raw as { ids?: unknown }).ids, FUNNEL_REMOVED_CAP)
}

export async function rememberRemovedFunnels(kv: KvLike, ids: string[]) {
  const next = clipRemovedIds([...ids, ...(await loadRemovedFunnelIds(kv))], FUNNEL_REMOVED_CAP)
  await kv.put(CRM_REMOVED_FUNNELS, JSON.stringify({ ids: next }))
}

export async function forgetRemovedFunnels(kv: KvLike, ids: string[]) {
  const drop = new Set(ids)
  const next = (await loadRemovedFunnelIds(kv)).filter((id) => !drop.has(id))
  await kv.put(CRM_REMOVED_FUNNELS, JSON.stringify({ ids: next }))
}

type CronLock = {
  until: string
  owner: string
}

function readCronLock(raw: unknown): CronLock | null {
  if (!raw || typeof raw !== "object") return null
  const until = typeof (raw as { until?: unknown }).until === "string" ? (raw as { until: string }).until : ""
  const owner = typeof (raw as { owner?: unknown }).owner === "string" ? (raw as { owner: string }).owner : ""
  if (!until) return null
  return { until, owner }
}

export async function claimCronLock(
  kv: KvLike,
  now = Date.now(),
  holdMs = 90_000,
  owner = crypto.randomUUID()
): Promise<string | null> {
  const nowIso = new Date(now).toISOString()
  for (let attempt = 0; attempt < 16; attempt++) {
    if (attempt) await new Promise((resolve) => setTimeout(resolve, attempt * 2))
    const current = readCronLock(await kv.get(CRM_CRON_LOCK, "json"))
    if (current && current.until > nowIso) return current.owner === owner ? owner : null
    const until = new Date(now + holdMs).toISOString()
    await kv.put(CRM_CRON_LOCK, JSON.stringify({ until, owner }))
    const stored = readCronLock(await kv.get(CRM_CRON_LOCK, "json"))
    if (stored?.owner === owner) {
      const confirm = readCronLock(await kv.get(CRM_CRON_LOCK, "json"))
      if (confirm?.owner === owner) return owner
      if (confirm && confirm.until > nowIso && confirm.owner !== owner) return null
      continue
    }
    if (stored && stored.until > nowIso && stored.owner !== owner) return null
  }
  return null
}

export async function renewCronLock(
  kv: KvLike,
  owner: string,
  now = Date.now(),
  holdMs = 90_000
): Promise<boolean> {
  for (let attempt = 0; attempt < 16; attempt++) {
    if (attempt) await new Promise((resolve) => setTimeout(resolve, attempt * 2))
    const stored = readCronLock(await kv.get(CRM_CRON_LOCK, "json"))
    if (!stored || stored.owner !== owner) return false
    await kv.put(CRM_CRON_LOCK, JSON.stringify({ until: new Date(now + holdMs).toISOString(), owner }))
    const verify = readCronLock(await kv.get(CRM_CRON_LOCK, "json"))
    if (verify?.owner === owner) return true
    if (verify && verify.owner !== owner) return false
  }
  return false
}

export async function releaseCronLock(kv: KvLike, owner?: string) {
  if (owner) {
    const stored = readCronLock(await kv.get(CRM_CRON_LOCK, "json"))
    if (stored?.owner && stored.owner !== owner) return
  }
  await kv.delete?.(CRM_CRON_LOCK)
}

export async function dueLeadsKv(kv: KvLike, nowIso: string): Promise<Lead[]> {
  const index = await loadIndex(kv)
  const ids = index.entries.filter((item) => item.waitUntil && item.waitUntil <= nowIso).map((item) => item.id)
  const leads = await Promise.all(ids.map((id) => loadLead(kv, id)))
  return leads.filter((lead): lead is Lead => Boolean(lead))
}

export async function loadFunnelsKv(kv: KvLike): Promise<SalesFunnel[]> {
  const raw = await kv.get(CRM_FUNNELS, "json")
  if (!Array.isArray(raw)) return []
  return raw.map(sanitizeIncomingFunnel).filter((item): item is SalesFunnel => Boolean(item))
}

export async function saveFunnelsKv(kv: KvLike, funnels: SalesFunnel[]) {
  const clean = funnels.map(sanitizeIncomingFunnel).filter((item): item is SalesFunnel => Boolean(item)).slice(0, 20)
  await kv.put(CRM_FUNNELS, JSON.stringify(clean))
}

export async function loadSettingsKv(kv: KvLike): Promise<Settings> {
  const raw = await kv.get(CRM_SETTINGS, "json")
  if (!raw || typeof raw !== "object") return emptySettings()
  return migrateSettings(raw as Settings)
}

export async function saveSettingsKv(kv: KvLike, settings: Settings) {
  await kv.put(CRM_SETTINGS, JSON.stringify(publicSettings(settings)))
}
