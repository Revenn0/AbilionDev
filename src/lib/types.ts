export type User = {
  id: string
  name: string
  email: string
}

export type SalesKind =
  | "traffic"
  | "trigger"
  | "whatsapp"
  | "telegram"
  | "email"
  | "delay"
  | "split"
  | "sales_page"

export type SalesChannel = "youtube" | "google" | "meta" | "organic" | "instagram"

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
  fromEmail?: string
  subject?: string
  delayHours?: number
  delayWindow?: string
  triggerType?: "incoming_whatsapp" | "capture" | "any"
  triggerLabel?: string
  splits?: SalesSplit[]
}

export type FlowEdge = {
  id: string
  source: string
  target: string
  sourceHandle?: string
}

export type SalesSnapshot = {
  name: string
  publishedAt: string
  nodes: Array<{
    id: string
    type: SalesKind
    position: { x: number; y: number }
    data: SalesNodeData
  }>
  edges: FlowEdge[]
}

export type SalesFunnel = {
  id: string
  name: string
  mode: "sales" | "messages"
  status: "draft" | "active"
  updatedAt: string
  nodes: SalesSnapshot["nodes"]
  edges: FlowEdge[]
  production?: SalesSnapshot | null
}

export type LeadTemp = "novo" | "morno" | "quente"
export type LeadChannel = "whatsapp" | "telegram"
export type LeadOrigin = "popup" | "group_join" | "private" | "closing"
export type LeadStage = "capture" | "group" | "welcome" | "attendance" | "print" | "banca" | "offer"

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
}

export type AppState = {
  user: User | null
  funnels: SalesFunnel[]
  leads: Lead[]
  settings: Settings
}
