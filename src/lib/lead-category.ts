import { normalizeTelegramContact } from "./capture.ts"
import { uid } from "./format.ts"
import { isEmailName, isPhoneLikeName, resolveLeadName, resolvePersonName } from "./lead-name.ts"
import type { Lead } from "./types.ts"

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

/** Lista unread e oca: não fingir que ainda não há categorias. Se o KV já tem alguma, criar segue. */
export function leadCategoriesListBlocked(unread: boolean, categories?: string[]) {
  return unread && !migrateLeadCategories(categories).length
}

export function leadFromImport(
  row: { name: string; contact: string },
  input: { category?: string; toGroup?: boolean; groupUrl?: string } = {}
): Lead {
  const now = new Date().toISOString()
  const contact = row.contact.trim().slice(0, 80)
  const digits = contact.replace(/\D/g, "")
  const channel = digits.length >= 8 && !/^@|^tg:/i.test(contact) ? "whatsapp" : "telegram"
  const category = sanitizeLeadCategory(input.category) || (input.toGroup ? GROUP_CATEGORY : "")
  const groupUrl = (input.groupUrl || "").trim()
  return {
    id: uid(),
    name: resolveLeadName(row.name, contact),
    contact,
    channel,
    campaign: input.toGroup ? "Grupo Telegram" : "Lista importada",
    origin: "import",
    temperature: "novo",
    stage: input.toGroup ? "group" : "capture",
    category: category || undefined,
    memory: input.toGroup && groupUrl ? `Grupo: ${groupUrl}`.slice(0, 4000) : "",
    facts: {},
    events: [],
    messages: [],
    createdAt: now,
    updatedAt: now,
  }
}
