import { defaultSettings, isFlowKind, isMapKind, type Lead, type SalesFunnel, type SalesKind, type Settings } from "./types"

export function migrateKind(raw: string): SalesKind {
  switch (raw) {
    case "trigger":
      return "entry"
    case "whatsapp":
    case "telegram":
    case "email":
      return "message"
    case "delay":
      return "wait"
    case "sales_page":
      return raw.toLowerCase().includes("oferta") ? "offer" : "landing"
    default:
      if (isFlowKind(raw) || isMapKind(raw)) return raw
      return "message"
  }
}

function kindForNode(type: string, title?: string): SalesKind {
  if (type === "sales_page" && (title ?? "").toLowerCase().includes("oferta")) return "offer"
  return migrateKind(type)
}

function migrateNodeData(title?: string, data?: SalesFunnel["nodes"][number]["data"]) {
  const next = { ...(data ?? { title: title || "Bloco" }) }
  if (next.steLine) return next
  if (/boas-vindas/i.test(next.title || title || "")) next.steLine = "welcome"
  else if (/remarketing|7\s*h/i.test(next.title || title || "")) next.steLine = "remarketing"
  return next
}

export function migrateFunnel(raw: SalesFunnel): SalesFunnel {
  const nodes = (raw.nodes ?? []).map((node) => ({
    ...node,
    type: kindForNode(node.type, node.data?.title),
    data: migrateNodeData(node.data?.title, node.data),
  }))
  const production = raw.production
    ? {
        ...raw.production,
        nodes: (raw.production.nodes ?? []).map((node) => ({
          ...node,
          type: kindForNode(node.type, node.data?.title),
          data: migrateNodeData(node.data?.title, node.data),
        })),
      }
    : raw.production
  return { ...raw, nodes, production }
}

export function migrateLead(raw: Partial<Lead> & { id: string }): Lead {
  const now = new Date().toISOString()
  return {
    id: raw.id,
    name: raw.name ?? "Lead",
    contact: raw.contact ?? "",
    channel: raw.channel === "whatsapp" ? "whatsapp" : "telegram",
    campaign: raw.campaign ?? "",
    origin: raw.origin === "facebook" ? "facebook" : (raw.origin ?? "popup"),
    startPayload: raw.startPayload,
    visitorId: raw.visitorId,
    temperature: raw.temperature ?? "novo",
    stage: raw.stage ?? "capture",
    printAt: raw.printAt,
    bancaAt: raw.bancaAt,
    memory: raw.memory ?? "",
    facts: raw.facts && typeof raw.facts === "object" ? raw.facts : {},
    lastMessage: raw.lastMessage,
    funnelId: raw.funnelId,
    nodeId: raw.nodeId,
    waitUntil: raw.waitUntil,
    paused: raw.paused ?? false,
    events: Array.isArray(raw.events) ? raw.events : [],
    messages: Array.isArray(raw.messages) ? raw.messages : [],
    stePhase: raw.stePhase,
    steBlocked: raw.steBlocked ?? false,
    steQuiet: raw.steQuiet ?? false,
    telegramChatId: raw.telegramChatId,
    updatedAt: raw.updatedAt ?? now,
    createdAt: raw.createdAt ?? now,
  }
}

const PLACEHOLDER_BOT = /@vjungerfka/i
const TELEGRAM_USER = /^[A-Za-z][A-Za-z0-9_]{4,31}$/
const TELEGRAM_HOSTS = new Set(["t.me", "www.t.me", "telegram.me", "www.telegram.me"])

export function cleanBotUsername(value?: string) {
  const next = (value ?? "").trim()
  if (!next || PLACEHOLDER_BOT.test(next)) return ""
  const handle = next.replace(/^@/, "")
  if (!TELEGRAM_USER.test(handle)) return ""
  return `@${handle}`
}

export function cleanTelegramGroupUrl(value?: string) {
  const next = (value ?? "").trim()
  if (!next) return ""
  try {
    const url = new URL(next)
    if (url.protocol !== "https:") return ""
    if (!TELEGRAM_HOSTS.has(url.hostname.toLowerCase())) return ""
    if (url.username || url.password) return ""
    return url.toString()
  } catch {
    return ""
  }
}

export function sanitizeIncomingFunnel(raw: unknown): SalesFunnel | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Partial<SalesFunnel>
  if (typeof row.id !== "string") return null
  const id = row.id.trim()
  if (!id || id.length > 80) return null
  if (row.nodes !== undefined && !Array.isArray(row.nodes)) return null
  if (row.edges !== undefined && !Array.isArray(row.edges)) return null
  return migrateFunnel({
    id,
    name: String(row.name || "Funil").slice(0, 80) || "Funil",
    mode: row.mode === "messages" ? "messages" : "sales",
    status: row.status === "active" ? "active" : "draft",
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : new Date().toISOString(),
    nodes: Array.isArray(row.nodes) ? row.nodes.slice(0, 200) : [],
    edges: Array.isArray(row.edges) ? row.edges.slice(0, 400) : [],
    production: row.production && typeof row.production === "object" ? row.production : null,
  })
}

export function sanitizeIncomingLead(raw: unknown): Lead | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Partial<Lead>
  if (typeof row.id !== "string") return null
  const id = row.id.trim()
  if (!id || id.length > 80) return null
  const lead = migrateLead({ ...row, id })
  lead.name = lead.name.trim().slice(0, 80) || "Lead"
  lead.contact = lead.contact.trim().slice(0, 80)
  lead.campaign = lead.campaign.trim().slice(0, 120)
  lead.memory = lead.memory.slice(0, 4000)
  if (lead.messages.length > 80) lead.messages = lead.messages.slice(-80)
  if (lead.events.length > 80) lead.events = lead.events.slice(-80)
  return lead
}

export function migrateSettings(raw: Partial<Settings> | undefined): Settings {
  const merged = {
    ...defaultSettings,
    ...(raw ?? {}),
    plugins: { ...defaultSettings.plugins, ...(raw?.plugins ?? {}) },
  }
  const welcomeLines = Array.isArray(merged.steWelcomeLines)
    ? ([merged.steWelcomeLines[0], merged.steWelcomeLines[1], merged.steWelcomeLines[2]] as [string, string, string])
    : defaultSettings.steWelcomeLines
  return {
    ...merged,
    telegramBotUsername: cleanBotUsername(merged.telegramBotUsername),
    telegramGroupUrl: cleanTelegramGroupUrl(merged.telegramGroupUrl),
    steWelcomeLines: [
      welcomeLines[0] || defaultSettings.steWelcomeLines[0],
      welcomeLines[1] || defaultSettings.steWelcomeLines[1],
      welcomeLines[2] || defaultSettings.steWelcomeLines[2],
    ],
    steRemarketingLines: Array.isArray(merged.steRemarketingLines) ? merged.steRemarketingLines.filter(Boolean) : [],
    steDieAfterRemarketing: merged.steDieAfterRemarketing !== false,
  }
}
