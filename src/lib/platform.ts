export const LEGACY_BOT_ID = "bot-ste-production"
export const LEGACY_INTEGRATION_ID = "integration-ste-telegram"
export const LEGACY_BRAIN_ID = "brain-ste-v1"

export type BotStatus = "draft" | "active" | "paused" | "error" | "archived"
export type IntegrationStatus = "disconnected" | "pending" | "connected" | "error" | "retired"
export type VersionStatus = "draft" | "testing" | "published" | "archived"
export type PlatformEnvironment = "development" | "staging" | "production"
export type RunStatus = "running" | "waiting" | "completed" | "blocked" | "failed" | "human"
export type RunMode = "automation" | "ai" | "human"

export type BotDefinition = {
  id: string
  name: string
  description: string
  status: BotStatus
  locale: string
  ownerId?: string
  integrationId?: string
  activeBrainVersionId?: string
  defaultFunnelId?: string
  voiceProfileId?: string
  createdAt: string
  createdBy?: string
  updatedAt: string
  updatedBy?: string
  archivedAt?: string
}

export type BotIntegration = {
  id: string
  botId: string
  channel: "telegram"
  environment: PlatformEnvironment
  status: IntegrationStatus
  externalBotId?: string
  externalUsername?: string
  project?: string
  workspace?: string
  tokenHint?: string
  credentialVersionId?: string
  webhookUrl?: string
  webhookOk: boolean
  allowedUpdates: string[]
  lastVerifiedAt?: string
  lastError?: string
  cleanupPending?: boolean
  createdAt: string
  updatedAt: string
}

export type BrainMemoryPolicy = {
  readLead: boolean
  writeLead: boolean
  proposeGlobal: boolean
}

export type BrainVersion = {
  id: string
  botId: string
  version: number
  status: VersionStatus
  name: string
  identity: string
  systemPrompt: string
  behavior: string
  globalMemory: string
  language: string
  tone: string
  tools: string[]
  memoryPolicy: BrainMemoryPolicy
  voiceProfileId?: string
  notes?: string
  createdAt: string
  createdBy?: string
  publishedAt?: string
  publishedBy?: string
  restoredFromId?: string
}

export type BotNodeMode = "respond" | "classify" | "extract" | "decide" | "remember"

export type FlowBranchRule = {
  match: string
  branch: string
}

export type BotNodePolicy = {
  botId: string
  brainVersionId: string
  instruction: string
  mode: BotNodeMode
  runWhen: "enter" | "message"
  language: string
  contextFields: string[]
  allowedActions: string[]
  outputBranches: string[]
  branchRules?: FlowBranchRule[]
  readLeadMemory: boolean
  writeLeadMemory: boolean
  timeoutSeconds: number
  retries: number
  errorTarget?: string
}

export type FlowRunStep = {
  id: string
  nodeId: string
  mode: RunMode
  status: "entered" | "completed" | "blocked" | "failed"
  at: string
  durationMs?: number
  summary?: string
  nextNodeId?: string
  errorCode?: string
}

export type FlowRun = {
  id: string
  botId: string
  integrationId?: string
  leadId?: string
  funnelId: string
  flowVersionId: string
  brainVersionId?: string
  status: RunStatus
  startedAt: string
  updatedAt: string
  completedAt?: string
  steps: FlowRunStep[]
  blockedReason?: string
  shadow?: boolean
}

export type AuditEvent = {
  id: string
  at: string
  environment: PlatformEnvironment
  actorId: string
  actorType: "user" | "bot" | "system"
  action: string
  entityType: string
  entityId: string
  correlationId?: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  result: "success" | "failure"
  message?: string
}

export type DiagnosticEvent = {
  id: string
  at: string
  environment: PlatformEnvironment
  level: "info" | "warning" | "error"
  area: "bot" | "integration" | "flow" | "audio" | "crm" | "creative"
  code: string
  message: string
  recommendation?: string
  botId?: string
  integrationId?: string
  runId?: string
  correlationId?: string
  details?: Record<string, unknown>
}

export type AudioStatus = "waiting" | "uploading" | "processing" | "completed" | "error" | "cancelled"

export type AudioAsset = {
  id: string
  botId: string
  brainVersionId?: string
  flowVersionId?: string
  nodeId?: string
  voiceProfileId: string
  language: string
  textHash: string
  text: string
  mime?: string
  durationMs?: number
  size?: number
  createdAt: string
  updatedAt: string
}

export type AudioRemoteFile = {
  integrationId: string
  externalBotId?: string
  fileId: string
  updatedAt: string
}

export type AudioJob = {
  id: string
  assetId: string
  botId: string
  integrationId?: string
  status: AudioStatus
  progress: number
  attempts: number
  errorCode?: string
  errorMessage?: string
  recommendation?: string
  remoteMessageId?: string
  createdAt: string
  updatedAt: string
}

export type CreativeStatus = "draft" | "review" | "testing" | "approved" | "paused" | "winner"
export type CreativeLanguage = "pt-BR" | "es"

export type CreativeVariant = {
  id: string
  conceptId: string
  sourceVariantId?: string
  name: string
  language: CreativeLanguage
  market: string
  operation: string
  theme: string
  title: string
  body: string
  cta: string
  description: string
  script: string
  status: CreativeStatus
  botId?: string
  funnelId?: string
  flowVersionId?: string
  pageScriptId?: string
  trackingId: string
  responsibleId?: string
  version: number
  createdAt: string
  updatedAt: string
  reviewedAt?: string
  reviewedBy?: string
}

export type CreativeConcept = {
  id: string
  name: string
  theme: string
  createdAt: string
  updatedAt: string
}

export type ExperimentMetric = {
  variantId: string
  impressions: number
  clicks: number
  leads: number
  conversions: number
  revenue?: number
}

export type CreativeExperiment = {
  id: string
  name: string
  hypothesis: string
  status: "draft" | "running" | "paused" | "completed"
  variantIds: string[]
  traffic: Record<string, number>
  audience: string
  operation: string
  primaryMetric: "ctr" | "leads" | "conversion" | "revenue"
  minimumSample: number
  startAt?: string
  endAt?: string
  metrics: ExperimentMetric[]
  suggestedWinnerId?: string
  approvedWinnerId?: string
  createdAt: string
  updatedAt: string
}

export type Permission =
  | "bots.read"
  | "bots.write"
  | "brains.write"
  | "flows.write"
  | "flows.publish"
  | "audio.write"
  | "crm.write"
  | "crm.export"
  | "crm.purge"
  | "creatives.write"
  | "creatives.publish"
  | "integrations.write"
  | "users.write"
  | "audit.read"

export type AccessProfile =
  | "administrator"
  | "bot_editor"
  | "crm_editor"
  | "creative_manager"
  | "viewer"
  | "publisher"

export const ACCESS_PROFILES: readonly AccessProfile[] = [
  "administrator",
  "bot_editor",
  "crm_editor",
  "creative_manager",
  "viewer",
  "publisher",
]

export function isAccessProfile(value: unknown): value is AccessProfile {
  return typeof value === "string" && (ACCESS_PROFILES as readonly string[]).includes(value)
}

export function sanitizeAccessProfiles(raw: unknown): AccessProfile[] {
  if (!Array.isArray(raw)) return []
  return [...new Set(raw.filter(isAccessProfile))]
}

export const PROFILE_PERMISSIONS: Record<AccessProfile, Permission[]> = {
  administrator: [
    "bots.read",
    "bots.write",
    "brains.write",
    "flows.write",
    "flows.publish",
    "audio.write",
    "crm.write",
    "crm.export",
    "crm.purge",
    "creatives.write",
    "creatives.publish",
    "integrations.write",
    "users.write",
    "audit.read",
  ],
  bot_editor: ["bots.read", "bots.write", "brains.write", "flows.write", "audio.write", "audit.read"],
  crm_editor: ["bots.read", "crm.write", "crm.export"],
  creative_manager: ["bots.read", "creatives.write"],
  viewer: ["bots.read"],
  publisher: ["bots.read", "flows.publish", "creatives.publish", "audit.read"],
}

export function tokenHintOf(value?: string) {
  const token = (value || "").trim()
  return token ? `•••• ${token.slice(-4)}` : ""
}

export function botIsRecent(bot: Pick<BotDefinition, "createdAt">, now = Date.now(), days = 7) {
  const created = new Date(bot.createdAt).getTime()
  return Number.isFinite(created) && now - created < days * 86_400_000
}

export function nextBrainVersion(versions: BrainVersion[], botId: string) {
  return Math.max(0, ...versions.filter((item) => item.botId === botId).map((item) => item.version)) + 1
}

export function permissionsFor(profiles: AccessProfile[]) {
  return [...new Set(profiles.flatMap((profile) => PROFILE_PERMISSIONS[profile] ?? []))]
}

export function canAccess(profiles: AccessProfile[], permission: Permission) {
  return permissionsFor(profiles).includes(permission)
}

export function experimentHasEnoughData(experiment: CreativeExperiment) {
  return experiment.metrics.every((item) => item.impressions >= experiment.minimumSample)
}

export function maskAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskAuditValue)
  if (!value || typeof value !== "object") return value
  const next: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    next[key] = /token|secret|password|api.?key/i.test(key) ? "[mascarado]" : maskAuditValue(item)
  }
  return next
}
