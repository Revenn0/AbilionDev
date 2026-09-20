import { clipRemovedIds, emptySettings, publicSettings } from "../src/lib/crm.ts"
import { migrateLead, migrateSettings, sanitizeIncomingFunnel } from "../src/lib/migrate.ts"
import type { Lead, SalesFunnel, Settings } from "../src/lib/types.ts"
import type { KvLike } from "./kv.ts"

export const CRM_INDEX = "crm:index"
export const CRM_FUNNELS = "crm:funnels"
export const CRM_SETTINGS = "crm:settings"
export const CRM_REMOVED = "crm:removed"
export const CRM_REMOVED_FUNNELS = "crm:removed-funnels"
export const CRM_CRON_LOCK = "crm:cron-lock"

const CAP = 400

export function aliasKey(kind: "contact" | "chat", value: string) {
  const next = value.trim().slice(0, 80)
  return next ? `crm:alias:${kind}:${next}` : ""
}

export type CrmIndexEntry = {
  id: string
  contact: string
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

async function saveIndex(kv: KvLike, index: CrmIndex) {
  const byId = new Map(index.entries.map((item) => [item.id, item]))
  const all = [...byId.values()]
  const waiting = all.filter((item) => item.waitUntil)
  const rest = all
    .filter((item) => !item.waitUntil)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, CAP)
  const keep = new Map<string, CrmIndexEntry>()
  for (const item of [...waiting, ...rest]) keep.set(item.id, item)
  const entries = [...keep.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  await kv.put(CRM_INDEX, JSON.stringify({ entries }))
}

async function writeAliases(kv: KvLike, lead: Pick<Lead, "id" | "contact" | "telegramChatId">) {
  const contact = aliasKey("contact", lead.contact)
  if (contact) await kv.put(contact, JSON.stringify({ id: lead.id }))
  const chat = aliasKey("chat", lead.telegramChatId ?? "")
  if (chat) await kv.put(chat, JSON.stringify({ id: lead.id }))
}

async function clearAliases(kv: KvLike, lead: Pick<Lead, "contact" | "telegramChatId"> | null, entry?: CrmIndexEntry) {
  const contact = aliasKey("contact", lead?.contact || entry?.contact || "")
  if (contact) await kv.delete?.(contact)
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

export async function claimLeadAlias(
  kv: KvLike,
  kind: "contact" | "chat",
  value: string,
  id: string
): Promise<string> {
  const key = aliasKey(kind, value)
  if (!key || !id) return id
  const current = await loadAlias(kv, kind, value)
  if (current) return current
  await kv.put(key, JSON.stringify({ id }))
  return (await loadAlias(kv, kind, value)) || id
}

export async function reserveLeadIdentity(
  kv: KvLike,
  contact: string,
  chatId: string,
  proposedId: string
): Promise<string> {
  if (chatId) {
    const id = await claimLeadAlias(kv, "chat", chatId, proposedId)
    if (contact) await claimLeadAlias(kv, "contact", contact, id)
    return id
  }
  if (contact) return claimLeadAlias(kv, "contact", contact, proposedId)
  return proposedId
}

export async function loadLead(kv: KvLike, id: string): Promise<Lead | null> {
  const raw = await kv.get(leadKey(id), "json")
  if (!raw || typeof raw !== "object") return null
  return migrateLead(raw as Lead)
}

export async function listLeads(kv: KvLike, limit = 80, channel: Lead["channel"] | "all" = "telegram"): Promise<Lead[]> {
  const index = await loadIndex(kv)
  const rows = channel === "all" ? index.entries : index.entries.filter((item) => item.channel === channel)
  const ids = rows.slice(0, limit).map((item) => item.id)
  const leads = await Promise.all(ids.map((id) => loadLead(kv, id)))
  return leads.filter((lead): lead is Lead => Boolean(lead))
}

export async function findLeadInKv(kv: KvLike, contact: string, telegramId: number, chatId: string): Promise<Lead | null> {
  const candidates = [contact, `tg:${telegramId}`, chatId].filter(Boolean)
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

export async function loadRemovedLeadIds(kv: KvLike): Promise<string[]> {
  const raw = await kv.get(CRM_REMOVED, "json")
  if (!raw || typeof raw !== "object") return []
  return clipRemovedIds((raw as { ids?: unknown }).ids, CAP)
}

export async function rememberRemovedLead(kv: KvLike, id: string) {
  const next = id.trim()
  if (!next || next.length > 80) return
  const ids = clipRemovedIds([next, ...(await loadRemovedLeadIds(kv))], CAP)
  await kv.put(CRM_REMOVED, JSON.stringify({ ids }))
}

export async function forgetRemovedLead(kv: KvLike, id: string) {
  const ids = (await loadRemovedLeadIds(kv)).filter((item) => item !== id)
  await kv.put(CRM_REMOVED, JSON.stringify({ ids }))
}

export async function upsertLeadKv(kv: KvLike, lead: Lead) {
  await forgetRemovedLead(kv, lead.id)
  const index = await loadIndex(kv)
  const entry: CrmIndexEntry = {
    id: lead.id,
    contact: lead.contact,
    chatId: lead.telegramChatId,
    waitUntil: lead.waitUntil,
    updatedAt: lead.updatedAt,
    channel: lead.channel,
  }
  const next = { entries: [entry, ...index.entries.filter((item) => item.id !== lead.id)] }
  await kv.put(leadKey(lead.id), JSON.stringify(lead))
  await writeAliases(kv, lead)
  await saveIndex(kv, next)
}

export async function deleteLeadKv(kv: KvLike, id: string) {
  const prev = await loadLead(kv, id)
  const index = await loadIndex(kv)
  const entry = index.entries.find((item) => item.id === id)
  await rememberRemovedLead(kv, id)
  await clearAliases(kv, prev, entry)
  await saveIndex(kv, { entries: index.entries.filter((item) => item.id !== id) })
  await kv.delete?.(leadKey(id))
}

export async function loadRemovedFunnelIds(kv: KvLike): Promise<string[]> {
  const raw = await kv.get(CRM_REMOVED_FUNNELS, "json")
  if (!raw || typeof raw !== "object") return []
  return clipRemovedIds((raw as { ids?: unknown }).ids, CAP)
}

export async function rememberRemovedFunnels(kv: KvLike, ids: string[]) {
  const next = clipRemovedIds([...ids, ...(await loadRemovedFunnelIds(kv))], CAP)
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
  const current = readCronLock(await kv.get(CRM_CRON_LOCK, "json"))
  if (current && current.until > new Date(now).toISOString()) return null
  await kv.put(CRM_CRON_LOCK, JSON.stringify({ until: new Date(now + holdMs).toISOString(), owner }))
  const stored = readCronLock(await kv.get(CRM_CRON_LOCK, "json"))
  return stored?.owner === owner ? owner : null
}

export async function renewCronLock(
  kv: KvLike,
  owner: string,
  now = Date.now(),
  holdMs = 90_000
): Promise<boolean> {
  const stored = readCronLock(await kv.get(CRM_CRON_LOCK, "json"))
  if (!stored || stored.owner !== owner) return false
  await kv.put(CRM_CRON_LOCK, JSON.stringify({ until: new Date(now + holdMs).toISOString(), owner }))
  const verify = readCronLock(await kv.get(CRM_CRON_LOCK, "json"))
  return verify?.owner === owner
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
