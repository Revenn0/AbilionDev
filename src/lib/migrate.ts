import { normalizeTelegramContact } from "./capture.ts"
import { resolveLeadName } from "./lead-name.ts"
import { defaultSettings, isFlowKind, isMapKind, type Lead, type LeadOrigin, type SalesFunnel, type SalesKind, type SalesSnapshot, type Settings } from "./types.ts"

export function migrateLeadOrigin(value?: string): LeadOrigin {
  if (value === "facebook") return "facebook"
  if (value === "group_join") return "group_join"
  if (value === "private") return "private"
  if (value === "closing") return "closing"
  if (value === "import") return "import"
  if (value === "pagina" || value === "popup") return "popup"
  return "popup"
}

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
    name: resolveLeadName(raw.name, raw.contact),
    contact: normalizeTelegramContact(raw.contact ?? "") || (raw.contact ?? ""),
    channel: raw.channel === "whatsapp" ? "whatsapp" : "telegram",
    campaign: raw.campaign ?? "",
    origin: migrateLeadOrigin(raw.origin),
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

function clipText(value: unknown, max: number) {
  return typeof value === "string" ? value.slice(0, max) : undefined
}

function clipDelayHours(value: unknown) {
  const hours = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(hours) || hours < 0) return 84
  return Math.min(8760, hours)
}

export function cleanHttpUrl(value?: string) {
  const next = (value ?? "").trim()
  if (!next) return ""
  try {
    const url = new URL(next)
    if (url.protocol !== "http:" && url.protocol !== "https:") return ""
    if (url.username || url.password) return ""
    return url.toString().slice(0, 500)
  } catch {
    return ""
  }
}

function sanitizeGraph(nodes: unknown, edges: unknown) {
  return {
    nodes: Array.isArray(nodes) ? nodes.slice(0, 200) : [],
    edges: Array.isArray(edges) ? edges.slice(0, 400) : [],
  }
}

function clipFunnel(funnel: SalesFunnel): SalesFunnel {
  const clipNodes = (nodes: SalesFunnel["nodes"]) =>
    nodes.slice(0, 200).flatMap((node) => {
      if (!node || typeof node !== "object" || typeof node.id !== "string") return []
      const id = node.id.trim().slice(0, 80)
      if (!id) return []
      const data = node.data && typeof node.data === "object" ? node.data : { title: "Bloco" }
      return [
        {
          ...node,
          id,
          data: {
            ...data,
            title: (data.title || "Bloco").slice(0, 80),
            tag: clipText(data.tag, 40),
            url: cleanHttpUrl(data.url) || undefined,
            body: clipText(data.body, 4000),
            cta: clipText(data.cta, 80),
            conditionValue: clipText(data.conditionValue, 80),
            delayHours: data.delayHours === undefined ? undefined : clipDelayHours(data.delayHours),
          },
        },
      ]
    })
  return {
    ...funnel,
    name: funnel.name.slice(0, 80),
    nodes: clipNodes(funnel.nodes),
    edges: funnel.edges.slice(0, 400),
    production: funnel.production
      ? {
          ...funnel.production,
          name: funnel.production.name.slice(0, 80),
          nodes: clipNodes(funnel.production.nodes),
          edges: funnel.production.edges.slice(0, 400),
        }
      : funnel.production,
  }
}

function sanitizeProduction(raw: unknown): SalesSnapshot | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Partial<SalesSnapshot>
  const graph = sanitizeGraph(row.nodes, row.edges)
  return {
    name: String(row.name || "Funil").slice(0, 80) || "Funil",
    publishedAt: typeof row.publishedAt === "string" ? row.publishedAt : new Date().toISOString(),
    nodes: graph.nodes as SalesSnapshot["nodes"],
    edges: graph.edges as SalesSnapshot["edges"],
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
  const graph = sanitizeGraph(row.nodes, row.edges)
  return clipFunnel(
    migrateFunnel({
      id,
      name: String(row.name || "Funil").slice(0, 80) || "Funil",
      mode: row.mode === "messages" ? "messages" : "sales",
      status: row.status === "active" ? "active" : "draft",
      updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : new Date().toISOString(),
      nodes: graph.nodes as SalesFunnel["nodes"],
      edges: graph.edges as SalesFunnel["edges"],
      production: sanitizeProduction(row.production),
    })
  )
}

export function sanitizeIncomingLead(raw: unknown): Lead | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Partial<Lead>
  if (typeof row.id !== "string") return null
  const id = row.id.trim()
  if (!id || id.length > 80) return null
  const lead = migrateLead({ ...row, id })
  lead.name = lead.name.trim().slice(0, 80) || "Lead"
  lead.contact = (normalizeTelegramContact(lead.contact) || lead.contact.trim()).slice(0, 80)
  lead.campaign = lead.campaign.trim().slice(0, 120)
  lead.memory = lead.memory.slice(0, 4000)
  lead.lastMessage = lead.lastMessage ? lead.lastMessage.slice(0, 400) : undefined
  lead.startPayload = lead.startPayload ? lead.startPayload.trim().slice(0, 80) : undefined
  lead.visitorId = lead.visitorId ? lead.visitorId.trim().slice(0, 32) : undefined
  lead.telegramChatId = lead.telegramChatId ? String(lead.telegramChatId).trim().slice(0, 32) : undefined
  lead.funnelId = lead.funnelId ? lead.funnelId.trim().slice(0, 80) : undefined
  lead.nodeId = lead.nodeId ? lead.nodeId.trim().slice(0, 80) : undefined
  if (lead.facts) {
    lead.facts = {
      ...lead.facts,
      heard: lead.facts.heard?.slice(0, 200),
      country: lead.facts.country?.slice(0, 64),
      countryCode: lead.facts.countryCode?.slice(0, 8),
      city: lead.facts.city?.slice(0, 64),
      region: lead.facts.region?.slice(0, 64),
      regionCode: lead.facts.regionCode?.slice(0, 8),
      device: lead.facts.device?.slice(0, 40),
      language: lead.facts.language?.slice(0, 16),
    }
  }
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
    workspaceName: String(merged.workspaceName || defaultSettings.workspaceName).slice(0, 80) || defaultSettings.workspaceName,
    timezone: String(merged.timezone || defaultSettings.timezone).slice(0, 64) || defaultSettings.timezone,
    telegramBotToken: "",
    telegramBotUsername: cleanBotUsername(merged.telegramBotUsername),
    telegramGroupUrl: cleanTelegramGroupUrl(merged.telegramGroupUrl),
    steWelcome: String(merged.steWelcome || defaultSettings.steWelcome).slice(0, 500),
    steWelcomeLines: [
      String(welcomeLines[0] || defaultSettings.steWelcomeLines[0]).slice(0, 400),
      String(welcomeLines[1] || defaultSettings.steWelcomeLines[1]).slice(0, 400),
      String(welcomeLines[2] || defaultSettings.steWelcomeLines[2]).slice(0, 400),
    ],
    steRemarketingLines: (Array.isArray(merged.steRemarketingLines) ? merged.steRemarketingLines.filter(Boolean) : [])
      .map((line) => String(line).slice(0, 400))
      .slice(0, 8),
    esterTelegramChatId: "",
    steDieAfterRemarketing: merged.steDieAfterRemarketing !== false,
  }
}
