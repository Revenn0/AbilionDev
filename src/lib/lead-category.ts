import { normalizeTelegramContact } from "./capture.ts"
import { uid } from "./format.ts"
import { isEmailName, isPhoneLikeName, resolveLeadName, resolvePersonName } from "./lead-name.ts"
import { LEGACY_BOT_ID, LEGACY_INTEGRATION_ID } from "./platform.ts"
import type { Lead, LeadGroup } from "./types.ts"

export const LEAD_CATEGORY_CAP = 20
export const LEAD_CATEGORY_LEN = 40
export const LEAD_IMPORT_CAP = 200
export const GROUP_CATEGORY = "Grupo"

export function sanitizeLeadCategory(raw: unknown) {
  if (typeof raw !== "string") return ""
  return raw.replace(/\s+/g, " ").trim().slice(0, LEAD_CATEGORY_LEN)
}

export function migrateLeadCategories(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const next = sanitizeLeadCategory(item)
    const key = next.toLocaleLowerCase("pt-BR")
    if (!next || seen.has(key)) continue
    seen.add(key)
    out.push(next)
    if (out.length >= LEAD_CATEGORY_CAP) break
  }
  return out
}

export function mergeLeadCategories(...lists: Array<string[] | undefined>) {
  return migrateLeadCategories(lists.flatMap((list) => list ?? []))
}

function cleanGroupInvite(raw?: string) {
  const next = (raw ?? "").trim()
  if (!next) return ""
  try {
    const url = new URL(next)
    if (url.protocol !== "https:") return ""
    const host = url.hostname.toLowerCase()
    if (host !== "t.me" && host !== "www.t.me" && host !== "telegram.me") return ""
    return url.toString()
  } catch {
    return ""
  }
}

export function migrateLeadGroups(raw: unknown): LeadGroup[] {
  if (!Array.isArray(raw)) return []
  const out: LeadGroup[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const row = item as { id?: unknown; name?: unknown; url?: unknown }
    const name = sanitizeLeadCategory(row.name)
    const key = name.toLocaleLowerCase("pt-BR")
    if (!name || seen.has(key)) continue
    seen.add(key)
    const id = typeof row.id === "string" && row.id.trim() ? row.id.trim().slice(0, 64) : `group:${key}`
    out.push({ id, name, url: cleanGroupInvite(typeof row.url === "string" ? row.url : "") })
    if (out.length >= LEAD_CATEGORY_CAP) break
  }
  return out
}

export function mergeLeadGroups(...lists: Array<LeadGroup[] | undefined>) {
  return migrateLeadGroups(lists.flatMap((list) => list ?? []))
}

export function seedLeadGroups(groups: LeadGroup[] | undefined, telegramGroupUrl?: string): LeadGroup[] {
  const live = migrateLeadGroups(groups)
  const url = cleanGroupInvite(telegramGroupUrl)
  if (!url || live.some((item) => item.url === url)) return live
  if (live.some((item) => item.name.toLocaleLowerCase("pt-BR") === GROUP_CATEGORY.toLocaleLowerCase("pt-BR"))) return live
  if (live.length >= LEAD_CATEGORY_CAP) return live
  return [...live, { id: "telegram-group", name: GROUP_CATEGORY, url }]
}

export function listImportGroups(groups: LeadGroup[] | undefined, categories?: string[], telegramGroupUrl?: string): LeadGroup[] {
  const live = seedLeadGroups(groups, telegramGroupUrl)
  const extra = migrateLeadCategories(categories).filter(
    (name) => !live.some((item) => item.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"))
  )
  return [...live, ...extra.map((name) => ({ id: `cat:${name.toLocaleLowerCase("pt-BR")}`, name, url: "" }))]
}

export function addLeadGroup(
  current: LeadGroup[],
  input: { name: string; url?: string }
): { ok: true; groups: LeadGroup[]; group: LeadGroup } | { ok: false; error: string } {
  const name = sanitizeLeadCategory(input.name)
  if (!name) return { ok: false, error: "Dá um nome ao grupo." }
  const rawUrl = (input.url ?? "").trim()
  const url = cleanGroupInvite(rawUrl)
  if (rawUrl && !url) return { ok: false, error: "O convite tem de ser um link https://t.me/…" }
  const live = migrateLeadGroups(current)
  const match = live.find((item) => item.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"))
  if (match) {
    const group = url && !match.url ? { ...match, url } : match
    return { ok: true, groups: live.map((item) => (item.id === match.id ? group : item)), group }
  }
  if (live.length >= LEAD_CATEGORY_CAP) return { ok: false, error: `O estúdio aceita no máximo ${LEAD_CATEGORY_CAP} grupos.` }
  const group = { id: uid(), name, url }
  return { ok: true, groups: [...live, group], group }
}

/** Criar grupo: leftover oco não inventa o primeiro. Com grupos ou categorias no KV, o select segue. */
export function leadGroupsWriteBlocked(unread: boolean, groups?: LeadGroup[], categories?: string[]) {
  return unread && !migrateLeadGroups(groups).length && !migrateLeadCategories(categories).length
}

export function leadGroupsMutationBlocked(unread: boolean, stored?: LeadGroup[], incoming?: LeadGroup[]) {
  if (!unread) return false
  const known = new Set(migrateLeadGroups(stored).map((item) => item.name.toLocaleLowerCase("pt-BR")))
  return migrateLeadGroups(incoming).some((item) => !known.has(item.name.toLocaleLowerCase("pt-BR")))
}

export function leadImportSubmitBlocked(persistBlocked: boolean, groupId?: string) {
  return persistBlocked || !String(groupId || "").trim()
}

export function addLeadCategory(
  current: string[],
  name: string
): { ok: true; categories: string[]; category: string } | { ok: false; error: string } {
  const next = sanitizeLeadCategory(name)
  if (!next) return { ok: false, error: "Dá um nome à categoria." }
  const live = migrateLeadCategories(current)
  const match = live.find((item) => item.toLocaleLowerCase("pt-BR") === next.toLocaleLowerCase("pt-BR"))
  if (match) return { ok: true, categories: live, category: match }
  if (live.length >= LEAD_CATEGORY_CAP) return { ok: false, error: `O estúdio aceita no máximo ${LEAD_CATEGORY_CAP} categorias.` }
  return { ok: true, categories: [...live, next], category: next }
}

function looksLikeContact(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (/^tg:\d+$/i.test(trimmed)) return true
  if (/^@?[A-Za-z][A-Za-z0-9_]{2,31}$/.test(trimmed)) return true
  if (isEmailName(trimmed)) return true
  const digits = trimmed.replace(/\D/g, "")
  return digits.length >= 8 && (isPhoneLikeName(trimmed) || /^[\d+\s().-]+$/.test(trimmed))
}

function normalizeImportContact(value: string) {
  const telegram = normalizeTelegramContact(value)
  if (telegram && (/^@/.test(telegram) || /^tg:/i.test(telegram))) return telegram.slice(0, 80)
  const digits = value.replace(/\D/g, "")
  if (digits.length >= 8) return digits.slice(0, 80)
  return value.trim().slice(0, 80)
}

export function parseLeadImportLine(line: string): { name: string; contact: string } | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  if (/^(nome|name|contato|contacto|contact)\b/i.test(trimmed) && /[,;\t]/.test(trimmed)) return null
  const parts = trimmed.split(/[,;\t]/).map((item) => item.trim()).filter(Boolean)
  if (parts.length >= 2) {
    const left = parts[0] ?? ""
    const right = parts[1] ?? ""
    const leftContact = looksLikeContact(left)
    const rightContact = looksLikeContact(right)
    if (rightContact && !leftContact) {
      return { name: resolvePersonName(left) || left, contact: normalizeImportContact(right) }
    }
    if (leftContact && !rightContact) {
      return { name: resolvePersonName(right) || right, contact: normalizeImportContact(left) }
    }
    return { name: resolvePersonName(left) || left, contact: normalizeImportContact(right) }
  }
  const phoneTail = trimmed.match(/^(.*?)([+\d][\d\s().-]{8,})$/)
  if (phoneTail?.[2] && looksLikeContact(phoneTail[2])) {
    const name = resolvePersonName(phoneTail[1] || "")
    const contact = normalizeImportContact(phoneTail[2])
    return { name: name || resolveLeadName(contact, contact), contact }
  }
  if (looksLikeContact(trimmed)) {
    const contact = normalizeImportContact(trimmed)
    return { name: resolveLeadName(trimmed, contact), contact }
  }
  return { name: resolvePersonName(trimmed) || trimmed, contact: trimmed.slice(0, 80) }
}

export function parseLeadImportText(raw: string): { rows: Array<{ name: string; contact: string }>; error?: string } {
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (!lines.length) return { rows: [], error: "Cola pelo menos um contacto." }
  const rows: Array<{ name: string; contact: string }> = []
  const seen = new Set<string>()
  for (const line of lines) {
    const parsed = parseLeadImportLine(line)
    if (!parsed?.contact) continue
    const key = parsed.contact.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    rows.push(parsed)
    if (rows.length >= LEAD_IMPORT_CAP) break
  }
  if (!rows.length) return { rows: [], error: "Não li nenhum contacto nesta lista." }
  return { rows }
}

/** Sem URL e definições por confirmar: não marcar grupo. Settings ok sem URL continua a importar o passo grupo. */
export function leadImportGroupBlocked(settingsSync: "idle" | "ok" | "error", groupUrl?: string) {
  return !String(groupUrl || "").trim() && settingsSync !== "ok"
}

/** Lista unread e oca: não fingir que ainda não há categorias. Se o KV já tem alguma, o select segue — criar é `leadCategoriesWriteBlocked`. */
export function leadCategoriesListBlocked(unread: boolean, categories?: string[]) {
  return unread && !migrateLeadCategories(categories).length
}

/** Criar categoria: leftover no cache não confirma o catálogo. */
export function leadCategoriesWriteBlocked(unread: boolean) {
  return unread
}

/** POST do CRM: username ainda grava; categoria nova espera o GET. */
export function leadCategoriesMutationBlocked(
  unread: boolean,
  stored?: string[],
  incoming?: string[]
) {
  if (!unread) return false
  const known = new Set(migrateLeadCategories(stored).map((item) => item.toLocaleLowerCase("pt-BR")))
  return migrateLeadCategories(incoming).some((item) => !known.has(item.toLocaleLowerCase("pt-BR")))
}

export function leadFromImport(
  row: { name: string; contact: string },
  input: { category?: string; toGroup?: boolean; groupUrl?: string; group?: { name?: string; url?: string } } = {}
): Lead {
  const now = new Date().toISOString()
  const contact = row.contact.trim().slice(0, 80)
  const digits = contact.replace(/\D/g, "")
  const channel = digits.length >= 8 && !/^@|^tg:/i.test(contact) ? "whatsapp" : "telegram"
  const groupName = sanitizeLeadCategory(input.group?.name)
  const groupUrl = cleanGroupInvite(input.group?.url) || (input.groupUrl || "").trim()
  const toGroup = Boolean(input.toGroup || groupName)
  const category = sanitizeLeadCategory(input.category) || groupName || (input.toGroup ? GROUP_CATEGORY : "")
  return {
    id: uid(),
    botId: LEGACY_BOT_ID,
    integrationId: channel === "telegram" ? LEGACY_INTEGRATION_ID : undefined,
    name: resolveLeadName(row.name, contact),
    contact,
    channel,
    campaign: toGroup ? category || "Grupo Telegram" : "Lista importada",
    origin: "import",
    temperature: "novo",
    stage: toGroup ? "group" : "capture",
    category: category || undefined,
    memory: toGroup && groupUrl ? `Grupo: ${groupUrl}`.slice(0, 4000) : "",
    facts: {},
    events: [],
    messages: [],
    createdAt: now,
    updatedAt: now,
  }
}
