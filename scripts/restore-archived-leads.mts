import { readFileSync, writeFileSync } from "node:fs"
import { contactLookups } from "../src/lib/capture.ts"
import { migrateLeadOrigin, sanitizeIncomingLead } from "../src/lib/migrate.ts"
import type { ChatMessage, Lead, LeadTemp } from "../src/lib/types.ts"
import { aliasKey, clipCrmIndex, CRM_INDEX, leadKey, type CrmIndexEntry } from "../worker/crm-store.ts"

type Archived = {
  id?: string
  name?: string
  phone?: string
  email?: string
  channel?: string
  origin?: string
  campaign?: string
  category?: string
  temperature?: string
  stage?: string
  funnelId?: string
  createdAt?: string
  lastActivityAt?: string
  lastMessage?: string
}

type ArchivedMessage = {
  id?: string
  at?: string
  role?: "lead" | "ste"
  text?: string
}

const input = process.argv[2]
const output = process.argv[3] || "/tmp/abilion-leads-kv.json"
if (!input) {
  console.error("uso: npx tsx scripts/restore-archived-leads.mts <arquivo.json> [saida.json]")
  process.exit(1)
}

const raw = JSON.parse(readFileSync(input, "utf8")) as {
  contacts?: Archived[]
  messages?: Record<string, ArchivedMessage[]>
}

function temperatureOf(value?: string): LeadTemp {
  const next = (value || "").toLowerCase()
  if (next.includes("quente")) return "quente"
  if (next.includes("morno")) return "morno"
  return "novo"
}

function originOf(value?: string) {
  return migrateLeadOrigin(value)
}

function isQa(item: Archived) {
  const phone = (item.phone || "").replace(/\D/g, "")
  const name = (item.name || "").toLowerCase()
  return name === "lead qa" || phone === "5511999000111"
}

function toLead(item: Archived, messages: ArchivedMessage[] = []): Lead | null {
  if (!item.id) return null
  const created = item.createdAt || item.lastActivityAt || new Date().toISOString()
  const updated = item.lastActivityAt || created
  const telegram = item.channel === "telegram"
  const digits = (item.phone || "").replace(/\D/g, "")
  const chatId = telegram && digits.length >= 5 ? digits : undefined
  const contact = telegram && chatId ? `tg:${chatId}` : (item.phone || item.email || item.name || "").trim()
  if (!contact) return null
  const chat: ChatMessage[] = messages
    .filter((row) => row.text?.trim())
    .map((row) => ({
      id: row.id || crypto.randomUUID(),
      at: row.at || created,
      role: row.role === "ste" ? "ste" : "lead",
      text: String(row.text).slice(0, 400),
    }))
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(-80)
  return sanitizeIncomingLead({
    id: item.id,
    name: (item.name || contact).trim(),
    contact,
    channel: telegram ? "telegram" : "whatsapp",
    campaign: (item.campaign || (item.origin === "import" ? "Importado" : telegram ? "Telegram" : "WhatsApp")).trim(),
    origin: originOf(item.origin),
    temperature: temperatureOf(item.temperature || item.category),
    stage: "capture",
    memory: "",
    facts: {},
    lastMessage: item.lastMessage || chat.at(-1)?.text,
    funnelId: item.funnelId || undefined,
    events: [
      {
        id: `restored-${item.id}`,
        at: created,
        kind: "entered",
        title: "Restaurado",
        body: "Lista anterior da Abilion",
      },
    ],
    messages: chat,
    telegramChatId: chatId,
    createdAt: created,
    updatedAt: updated,
  })
}

const leads = (raw.contacts ?? [])
  .filter((item) => !isQa(item))
  .map((item) => toLead(item, raw.messages?.[item.id || ""] ?? []))
  .filter((lead): lead is Lead => Boolean(lead))

const byId = new Map<string, Lead>()
for (const lead of leads) byId.set(lead.id, lead)
const unique = [...byId.values()]

const entries: CrmIndexEntry[] = unique.map((lead) => ({
  id: lead.id,
  contact: lead.contact,
  chatId: lead.telegramChatId,
  waitUntil: lead.waitUntil,
  updatedAt: lead.updatedAt,
  channel: lead.channel,
}))

const rows: Array<{ key: string; value: string }> = [
  { key: CRM_INDEX, value: JSON.stringify({ entries: clipCrmIndex(entries) }) },
]
const aliases = new Map<string, { id: string; updatedAt: string }>()
for (const lead of unique) {
  rows.push({ key: leadKey(lead.id), value: JSON.stringify(lead) })
  const keys = contactLookups(lead.contact).map((lookup) => aliasKey("contact", lookup)).filter(Boolean)
  if (lead.telegramChatId) {
    const chat = aliasKey("chat", lead.telegramChatId)
    if (chat) keys.push(chat)
  }
  for (const key of keys) {
    const prev = aliases.get(key)
    if (!prev || lead.updatedAt >= prev.updatedAt) aliases.set(key, { id: lead.id, updatedAt: lead.updatedAt })
  }
}
for (const [key, alias] of aliases) {
  rows.push({ key, value: JSON.stringify({ id: alias.id }) })
}

writeFileSync(output, JSON.stringify(rows))
console.log(
  JSON.stringify({
    leads: unique.length,
    telegram: unique.filter((lead) => lead.channel === "telegram").length,
    whatsapp: unique.filter((lead) => lead.channel === "whatsapp").length,
    imported: unique.filter((lead) => lead.origin === "import").length,
    popup: unique.filter((lead) => lead.origin === "popup").length,
    keys: rows.length,
    index: clipCrmIndex(entries).length,
    output,
  })
)
