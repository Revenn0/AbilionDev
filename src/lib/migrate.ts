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

export function migrateFunnel(raw: SalesFunnel): SalesFunnel {
  const nodes = (raw.nodes ?? []).map((node) => ({
    ...node,
    type: kindForNode(node.type, node.data?.title),
    data: { ...node.data },
  }))
  const production = raw.production
    ? {
        ...raw.production,
        nodes: raw.production.nodes.map((node) => ({
          ...node,
          type: kindForNode(node.type, node.data?.title),
          data: { ...node.data },
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

export function cleanBotUsername(value?: string) {
  const next = (value ?? "").trim()
  if (!next || PLACEHOLDER_BOT.test(next)) return ""
  return next.startsWith("@") ? next : `@${next}`
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
    steWelcomeLines: [
      welcomeLines[0] || defaultSettings.steWelcomeLines[0],
      welcomeLines[1] || defaultSettings.steWelcomeLines[1],
      welcomeLines[2] || defaultSettings.steWelcomeLines[2],
    ],
    steRemarketingLines: Array.isArray(merged.steRemarketingLines) ? merged.steRemarketingLines.filter(Boolean) : [],
    steDieAfterRemarketing: merged.steDieAfterRemarketing !== false,
  }
}
