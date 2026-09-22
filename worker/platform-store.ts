import { STE_SYSTEM_PROMPT } from "../src/lib/ste.ts"
import {
  LEGACY_BOT_ID,
  LEGACY_BRAIN_ID,
  LEGACY_INTEGRATION_ID,
  maskAuditValue,
  tokenHintOf,
  type AuditEvent,
  type BotDefinition,
  type BotIntegration,
  type BrainVersion,
  type DiagnosticEvent,
  type FlowRun,
  type PlatformEnvironment,
} from "../src/lib/platform.ts"
import type { KvLike } from "./kv.ts"

export const PLATFORM_BOTS = "platform:bots"
export const PLATFORM_INTEGRATIONS = "platform:integrations"
export const PLATFORM_BRAINS = "platform:brains"
export const PLATFORM_AUDIT = "platform:audit"
export const PLATFORM_DIAGNOSTICS = "platform:diagnostics"
export const PLATFORM_RUNS = "platform:runs"

const AUDIT_CAP = 4000
const DIAGNOSTIC_CAP = 4000
const RUN_CAP = 2000

export type StoredBotIntegration = BotIntegration & {
  telegramBotToken?: string
  webhookSecret?: string
}

export type PlatformState = {
  bots: BotDefinition[]
  integrations: StoredBotIntegration[]
  brains: BrainVersion[]
  audit: AuditEvent[]
  diagnostics: DiagnosticEvent[]
  runs: FlowRun[]
}

export type LegacyPlatformInput = {
  environment: PlatformEnvironment
  actorId?: string
  telegramBotToken?: string
  telegramBotUsername?: string
  telegramGroupUrl?: string
  webhookUrl?: string
  webhookOk?: boolean
  webhookSecret?: string
  model?: string
  fallbackModel?: string
  defaultFunnelId?: string
  now?: string
}

async function loadArray<T>(kv: KvLike, key: string): Promise<T[]> {
  const raw = await kv.get(key, "json")
  return Array.isArray(raw) ? (raw as T[]) : []
}

async function putArray<T>(kv: KvLike, key: string, rows: T[]) {
  await kv.put(key, JSON.stringify(rows))
}

function newer<T extends { id: string; updatedAt?: string; createdAt?: string }>(left: T, right: T) {
  const leftAt = left.updatedAt || left.createdAt || ""
  const rightAt = right.updatedAt || right.createdAt || ""
  return rightAt >= leftAt ? { ...left, ...right } : { ...right, ...left }
}

async function mergeCollection<T extends { id: string; updatedAt?: string; createdAt?: string }>(
  kv: KvLike,
  key: string,
  incoming: T[],
  cap = 1000
) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const current = await loadArray<T>(kv, key)
    const byId = new Map(current.map((item) => [item.id, item]))
    for (const item of incoming) {
      const prev = byId.get(item.id)
      byId.set(item.id, prev ? newer(prev, item) : item)
    }
    const next = [...byId.values()]
      .sort((a, b) => (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || ""))
      .slice(0, cap)
    await putArray(kv, key, next)
    const settled = await loadArray<T>(kv, key)
    const ids = new Set(settled.map((item) => item.id))
    if (incoming.every((item) => ids.has(item.id))) return settled
    await new Promise((resolve) => setTimeout(resolve, 4 * (attempt + 1)))
  }
  throw new Error(`Não confirmei ${key}.`)
}

export function publicIntegration(value: StoredBotIntegration): BotIntegration {
  const { telegramBotToken: _token, webhookSecret: _secret, ...safe } = value
  return {
    ...safe,
    tokenHint: safe.tokenHint || tokenHintOf(value.telegramBotToken),
  }
}

export async function loadPlatformState(kv: KvLike): Promise<PlatformState> {
  const [bots, integrations, brains, audit, diagnostics, runs] = await Promise.all([
    loadArray<BotDefinition>(kv, PLATFORM_BOTS),
    loadArray<StoredBotIntegration>(kv, PLATFORM_INTEGRATIONS),
    loadArray<BrainVersion>(kv, PLATFORM_BRAINS),
    loadArray<AuditEvent>(kv, PLATFORM_AUDIT),
    loadArray<DiagnosticEvent>(kv, PLATFORM_DIAGNOSTICS),
    loadArray<FlowRun>(kv, PLATFORM_RUNS),
  ])
  return { bots, integrations, brains, audit, diagnostics, runs }
}

export async function saveBots(kv: KvLike, bots: BotDefinition[]) {
  return mergeCollection(kv, PLATFORM_BOTS, bots, 200)
}

export async function saveIntegrations(kv: KvLike, integrations: StoredBotIntegration[]) {
  return mergeCollection(kv, PLATFORM_INTEGRATIONS, integrations, 200)
}

export async function saveBrains(kv: KvLike, brains: BrainVersion[]) {
  return mergeCollection(kv, PLATFORM_BRAINS, brains, 1000)
}

export async function appendAudit(kv: KvLike, event: AuditEvent) {
  const safe: AuditEvent = {
    ...event,
    before: event.before ? (maskAuditValue(event.before) as Record<string, unknown>) : undefined,
    after: event.after ? (maskAuditValue(event.after) as Record<string, unknown>) : undefined,
  }
  return mergeCollection(kv, PLATFORM_AUDIT, [safe], AUDIT_CAP)
}

export async function appendDiagnostic(kv: KvLike, event: DiagnosticEvent) {
  return mergeCollection(kv, PLATFORM_DIAGNOSTICS, [event], DIAGNOSTIC_CAP)
}

export async function saveFlowRun(kv: KvLike, run: FlowRun) {
  return mergeCollection(kv, PLATFORM_RUNS, [run], RUN_CAP)
}

export async function ensureLegacyPlatform(kv: KvLike, input: LegacyPlatformInput): Promise<PlatformState> {
  const current = await loadPlatformState(kv)
  const now = input.now || new Date().toISOString()
  const actor = input.actorId || "system:migration"
  let changed = false

  if (!current.brains.some((item) => item.id === LEGACY_BRAIN_ID)) {
    const brain: BrainVersion = {
      id: LEGACY_BRAIN_ID,
      botId: LEGACY_BOT_ID,
      version: 1,
      status: "published",
      name: "Cérebro da Sté · compatibilidade",
      identity: "Sté, conhecida como a Mãe do Aviator.",
      systemPrompt: STE_SYSTEM_PROMPT,
      behavior: "Segue integralmente a versão publicada do Fluxo. Não escolhe fases, links ou ofertas fora do quadro.",
      globalMemory: "",
      language: "pt-BR",
      tone: "receptivo, profissional, firme e acolhedor",
      tools: [],
      memoryPolicy: { readLead: true, writeLead: true, proposeGlobal: false },
      createdAt: now,
      createdBy: actor,
      publishedAt: now,
      publishedBy: actor,
    }
    current.brains = await saveBrains(kv, [brain])
    changed = true
  }

  if (!current.integrations.some((item) => item.id === LEGACY_INTEGRATION_ID)) {
    const integration: StoredBotIntegration = {
      id: LEGACY_INTEGRATION_ID,
      botId: LEGACY_BOT_ID,
      channel: "telegram",
      environment: input.environment,
      status: input.telegramBotToken ? (input.webhookOk ? "connected" : "pending") : "disconnected",
      externalUsername: input.telegramBotUsername,
      project: "Abilion",
      workspace: "Abilion",
      telegramBotToken: input.telegramBotToken,
      webhookSecret: input.webhookSecret,
      tokenHint: tokenHintOf(input.telegramBotToken),
      credentialVersionId: input.telegramBotToken ? "credential-ste-v1" : undefined,
      webhookUrl: input.webhookUrl,
      webhookOk: Boolean(input.webhookOk),
      allowedUpdates: ["message", "chat_member", "my_chat_member", "chat_join_request"],
      lastVerifiedAt: input.webhookOk ? now : undefined,
      createdAt: now,
      updatedAt: now,
    }
    current.integrations = await saveIntegrations(kv, [integration])
    changed = true
  }

  if (!current.bots.some((item) => item.id === LEGACY_BOT_ID)) {
    const bot: BotDefinition = {
      id: LEGACY_BOT_ID,
      name: "Sté Produção",
      description: "Bot migrado da operação Telegram existente.",
      status: input.telegramBotToken ? "active" : "draft",
      locale: "pt-BR",
      ownerId: input.actorId,
      integrationId: LEGACY_INTEGRATION_ID,
      activeBrainVersionId: LEGACY_BRAIN_ID,
      defaultFunnelId: input.defaultFunnelId,
      createdAt: now,
      createdBy: actor,
      updatedAt: now,
      updatedBy: actor,
    }
    current.bots = await saveBots(kv, [bot])
    changed = true
  }

  if (changed) {
    await appendAudit(kv, {
      id: crypto.randomUUID(),
      at: now,
      environment: input.environment,
      actorId: actor,
      actorType: "system",
      action: "platform.legacy_migrated",
      entityType: "bot",
      entityId: LEGACY_BOT_ID,
      result: "success",
      after: {
        botId: LEGACY_BOT_ID,
        integrationId: LEGACY_INTEGRATION_ID,
        brainVersionId: LEGACY_BRAIN_ID,
        token: input.telegramBotToken,
      },
    })
  }

  return loadPlatformState(kv)
}
