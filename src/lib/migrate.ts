import { defaultSettings, isFlowKind, isMapKind, type Lead, type SalesFunnel, type SalesKind, type Settings } from "@/lib/types"

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
    origin: raw.origin ?? "popup",
    temperature: raw.temperature ?? "novo",
    stage: raw.stage ?? "capture",
    printAt: raw.printAt,
    bancaAt: raw.bancaAt,
    memory: raw.memory ?? "",
    lastMessage: raw.lastMessage,
    funnelId: raw.funnelId,
    nodeId: raw.nodeId,
    waitUntil: raw.waitUntil,
    paused: raw.paused ?? false,
    events: Array.isArray(raw.events) ? raw.events : [],
    updatedAt: raw.updatedAt ?? now,
    createdAt: raw.createdAt ?? now,
  }
}

export function migrateSettings(raw: Partial<Settings> | undefined): Settings {
  return {
    ...defaultSettings,
    ...(raw ?? {}),
    plugins: { ...defaultSettings.plugins, ...(raw?.plugins ?? {}) },
  }
}
