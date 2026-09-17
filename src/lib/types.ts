export type User = {
  id: string
  name: string
  email: string
}

export type MapKind = "traffic" | "landing" | "split"
export type FlowKind = "entry" | "message" | "wait" | "condition" | "handoff" | "notify" | "tag" | "offer"
export type SalesKind = MapKind | FlowKind

export const MAP_KINDS: readonly MapKind[] = ["traffic", "landing", "split"]
export const FLOW_KINDS: readonly FlowKind[] = [
  "entry",
  "message",
  "wait",
  "condition",
  "handoff",
  "notify",
  "tag",
  "offer",
]

export function isMapKind(kind: string): kind is MapKind {
  return (MAP_KINDS as readonly string[]).includes(kind)
}

export function isFlowKind(kind: string): kind is FlowKind {
  return (FLOW_KINDS as readonly string[]).includes(kind)
}

export type SalesChannel = "youtube" | "google" | "meta" | "organic" | "instagram"
export type EntryTrigger = "popup" | "group_join" | "start" | "any"
export type ConditionKind = "print" | "banca" | "temperature" | "campaign"
export type NotifyKind = "ester" | "banca"
export type TagKind = "temperature" | "campaign"

export type SalesSplit = {
  id: string
  label: string
  percent: number
}

export type SalesNodeData = {
  title: string
  tag?: string
  channel?: SalesChannel
  url?: string
  body?: string
  cta?: string
  delayHours?: number
  delayWindow?: string
  splits?: SalesSplit[]
  entryTrigger?: EntryTrigger
  conditionKind?: ConditionKind
  conditionValue?: string
  notifyKind?: NotifyKind
  notifyBody?: string
  tagKind?: TagKind
  temperature?: LeadTemp
  campaignLock?: LeadChannel
  handoffAgent?: "ste"
}

export type FlowEdge = {
  id: string
  source: string
  target: string
  sourceHandle?: string
}

export type FlowNode = {
  id: string
  type: SalesKind
  position: { x: number; y: number }
  data: SalesNodeData
}

export type SalesSnapshot = {
  name: string
  publishedAt: string
  nodes: FlowNode[]
  edges: FlowEdge[]
}

export type SalesFunnel = {
  id: string
  name: string
  mode: "sales" | "messages"
  status: "draft" | "active"
  updatedAt: string
  nodes: FlowNode[]
  edges: FlowEdge[]
  production?: SalesSnapshot | null
}

export type LeadTemp = "novo" | "morno" | "quente"
export type LeadChannel = "whatsapp" | "telegram"
export type LeadOrigin = "popup" | "group_join" | "private" | "closing"
export type LeadStage = "capture" | "group" | "welcome" | "attendance" | "print" | "banca" | "offer"

export type LeadEventKind =
  | "entered"
  | "message"
  | "wait"
  | "handoff"
  | "notify_ester"
  | "tag"
  | "offer"
  | "print"
  | "banca"
  | "advance"
  | "blocked"

export type LeadEvent = {
  id: string
  at: string
  kind: LeadEventKind
  nodeId?: string
  title?: string
  body?: string
  effect?: string
}

export type Lead = {
  id: string
  name: string
  contact: string
  channel: LeadChannel
  campaign: string
  origin: LeadOrigin
  temperature: LeadTemp
  stage: LeadStage
  printAt?: string
  bancaAt?: string
  memory: string
  lastMessage?: string
  funnelId?: string
  nodeId?: string
  waitUntil?: string
  paused?: boolean
  events: LeadEvent[]
  updatedAt: string
  createdAt: string
}

export type PluginId = "whatsapp" | "telegram" | "webhooks" | "forms" | "reports" | "calendar"

export type Settings = {
  workspaceName: string
  timezone: string
  notifyNewLead: boolean
  notifyConversation: boolean
  notifyChannelFail: boolean
  notifyPrint: boolean
  plugins: Record<PluginId, boolean>
  telegramBotUsername: string
  telegramBotToken: string
  telegramGroupUrl: string
  steLinkedTelegram: boolean
  steLinkedWhatsapp: boolean
  steWelcome: string
  esterNotify: boolean
  esterTelegramChatId: string
}

export const defaultSettings: Settings = {
  workspaceName: "Abilion",
  timezone: "America/Sao_Paulo",
  notifyNewLead: true,
  notifyConversation: true,
  notifyChannelFail: true,
  notifyPrint: true,
  plugins: {
    whatsapp: false,
    telegram: false,
    webhooks: false,
    forms: false,
    reports: false,
    calendar: false,
  },
  telegramBotUsername: "@vjungerfkaaiii_bot",
  telegramBotToken: "",
  telegramGroupUrl: "",
  steLinkedTelegram: false,
  steLinkedWhatsapp: false,
  steWelcome:
    "Oi, eu sou a Sté. Vi que você chegou pelo mini curso — vou te acompanhar daqui. Qualquer dúvida, é só me chamar.",
  esterNotify: true,
  esterTelegramChatId: "",
}

export type AppState = {
  user: User | null
  funnels: SalesFunnel[]
  leads: Lead[]
  settings: Settings
}

export const BANCA_FIXED =
  "Print do cadastro recebido. Enviar a banca. A Sté e o fluxo não inventam este conteúdo."
