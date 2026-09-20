import { emptySettings, publicSettings } from "../src/lib/crm.ts"
import { migrateFunnel, migrateLead, migrateSettings } from "../src/lib/migrate.ts"
import type { Lead, SalesFunnel, Settings } from "../src/lib/types.ts"
import type { KvLike } from "./kv.ts"

export const CRM_INDEX = "crm:index"
export const CRM_FUNNELS = "crm:funnels"
export const CRM_SETTINGS = "crm:settings"

const CAP = 400

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
  const entries = [...index.entries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, CAP)
  await kv.put(CRM_INDEX, JSON.stringify({ entries }))
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
  const index = await loadIndex(kv)
  const aliases = new Set([contact, `tg:${telegramId}`, chatId].filter(Boolean))
  const hit = index.entries.find(
    (item) => aliases.has(item.contact) || (item.chatId && (item.chatId === chatId || aliases.has(item.chatId)))
  )
  return hit ? loadLead(kv, hit.id) : null
}

export async function upsertLeadKv(kv: KvLike, lead: Lead) {
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
  await saveIndex(kv, next)
}

export async function deleteLeadKv(kv: KvLike, id: string) {
  const index = await loadIndex(kv)
  await saveIndex(kv, { entries: index.entries.filter((item) => item.id !== id) })
  await kv.delete?.(leadKey(id))
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
  return raw.map((item) => migrateFunnel(item as SalesFunnel))
}

export async function saveFunnelsKv(kv: KvLike, funnels: SalesFunnel[]) {
  await kv.put(CRM_FUNNELS, JSON.stringify(funnels))
}

export async function loadSettingsKv(kv: KvLike): Promise<Settings> {
  const raw = await kv.get(CRM_SETTINGS, "json")
  if (!raw || typeof raw !== "object") return emptySettings()
  return migrateSettings(raw as Settings)
}

export async function saveSettingsKv(kv: KvLike, settings: Settings) {
  await kv.put(CRM_SETTINGS, JSON.stringify(publicSettings(settings)))
}
