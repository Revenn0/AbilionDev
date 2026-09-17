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

export type JourneyKind =
  | "trigger"
  | "message"
  | "ask"
  | "wait"
  | "condition"
  | "action"
  | "whatsapp"
  | "telegram"

export type JourneyNodeData = {
  label: string
  template?: string
  buttons?: string
  delayValue?: number
  delayUnit?: "seconds" | "minutes" | "hours"
  conditionField?: string
  conditionOp?: "contains" | "equals"
}

export type JourneySnapshot = {
  name: string
  publishedAt: string
  nodes: Array<{
    id: string
    type: JourneyKind
    position: { x: number; y: number }
    data: JourneyNodeData
  }>
  edges: FlowEdge[]
}

export type Journey = {
  id: string
  name: string
  description?: string
  status: "draft" | "active" | "template"
  production?: boolean
  updatedAt: string
  nodes: JourneySnapshot["nodes"]
  edges: FlowEdge[]
}

export type CampaignPlatform = "whatsapp" | "telegram"
export type CampaignOrigin = "pagina" | "fechamento"

export type Campaign = {
  id: string
  name: string
  platform: CampaignPlatform
  origin: CampaignOrigin
  journeyId?: string
  groupInviteUrl?: string
  status: "draft" | "active"
}

export type AppState = {
  user: User | null
  funnels: SalesFunnel[]
  journeys: Journey[]
  campaigns: Campaign[]
}
