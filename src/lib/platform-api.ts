import { fetchWithTimeout } from "@/lib/http"
import {
  type AuditEvent,
  type AudioAsset,
  type AudioJob,
  type BotDefinition,
  type BotIntegration,
  type BrainVersion,
  type DiagnosticEvent,
  type FlowRun,
} from "@/lib/platform"
import { noteUnauthorized } from "@/lib/session"

type ApiResource = "platform" | "bots" | "brains" | "audio" | "integrations"
type QueryValue = string | number | boolean | null | undefined
type Query = Record<string, QueryValue>

const API_PATHS: Record<ApiResource, string> = {
  platform: "/api/platform",
  bots: "/api/bots",
  brains: "/api/brains",
  audio: "/api/audio",
  integrations: "/api/integrations",
}

function apiPath(resource: ApiResource, query?: Query) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value))
  }
  const suffix = params.toString()
  return `${API_PATHS[resource]}${suffix ? `?${suffix}` : ""}`
}

function apiMessage(data: unknown, fallback: string) {
  if (!data || typeof data !== "object") return fallback
  const value = data as { error?: unknown; message?: unknown }
  if (typeof value.error === "string" && value.error.trim()) return value.error
  if (typeof value.message === "string" && value.message.trim()) return value.message
  return fallback
}

async function request<T>(
  resource: ApiResource,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  options?: { query?: Query; body?: unknown }
): Promise<T> {
  const response = await fetchWithTimeout(apiPath(resource, options?.query), {
    method,
    credentials: "include",
    cache: method === "GET" ? "no-store" : undefined,
    headers: options?.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: options?.body === undefined ? undefined : JSON.stringify(options.body),
  })
  noteUnauthorized(response)
  if (response.status === 204) {
    if (!response.ok) throw new Error("Não foi possível concluir a operação.")
    return undefined as T
  }
  const data = (await response.json().catch(() => undefined)) as unknown
  if (!response.ok) throw new Error(apiMessage(data, "Não foi possível falar com a plataforma."))
  if (data === undefined) throw new Error("A plataforma devolveu uma resposta vazia.")
  return data as T
}

function resourceClient(resource: ApiResource) {
  return {
    get<T>(query?: Query) {
      return request<T>(resource, "GET", { query })
    },
    post<T>(body?: unknown, query?: Query) {
      return request<T>(resource, "POST", { query, body })
    },
    patch<T>(body?: unknown, query?: Query) {
      return request<T>(resource, "PATCH", { query, body })
    },
    delete<T>(query?: Query, body?: unknown) {
      return request<T>(resource, "DELETE", { query, body })
    },
  }
}

/** Cliente de baixo nível. Mantém todos os verbos disponíveis sem fixar rotas adicionais. */
export const platformApi = {
  platform: resourceClient("platform"),
  bots: resourceClient("bots"),
  brains: resourceClient("brains"),
  audio: resourceClient("audio"),
  integrations: resourceClient("integrations"),
}

export type PlatformOverview = {
  bots: BotDefinition[]
  integrations: BotIntegration[]
  brains: BrainVersion[]
  audit: AuditEvent[]
  diagnostics: DiagnosticEvent[]
  runs: FlowRun[]
}

export type BotsCatalog = {
  bots: BotDefinition[]
  integrations: BotIntegration[]
  diagnostics: DiagnosticEvent[]
}

export type BrainCatalog = {
  versions: BrainVersion[]
  activeVersionId?: string
}

export type AudioCatalog = {
  jobs: AudioJob[]
  assets: AudioAsset[]
}

type MutationResponse = { ok?: boolean }

function requiredArray<T>(data: unknown, field: string, label: string): T[] {
  if (!data || typeof data !== "object" || !Array.isArray((data as Record<string, unknown>)[field])) {
    throw new Error(`A resposta de ${label} está incompleta.`)
  }
  return (data as Record<string, unknown>)[field] as T[]
}

export async function getPlatformOverviewRequest(botId?: string): Promise<PlatformOverview> {
  const data = await platformApi.platform.get<Record<string, unknown>>({ botId })
  return {
    bots: requiredArray<BotDefinition>(data, "bots", "plataforma"),
    integrations: requiredArray<BotIntegration>(data, "integrations", "plataforma"),
    brains: requiredArray<BrainVersion>(data, "brains", "plataforma"),
    audit: requiredArray<AuditEvent>(data, "audit", "plataforma"),
    diagnostics: requiredArray<DiagnosticEvent>(data, "diagnostics", "plataforma"),
    runs: requiredArray<FlowRun>(data, "runs", "plataforma"),
  }
}

export async function listBotsRequest(botId?: string): Promise<BotsCatalog> {
  const data = await platformApi.platform.get<Record<string, unknown>>()
  const bots = requiredArray<BotDefinition>(data, "bots", "bots")
  const integrations = requiredArray<BotIntegration>(data, "integrations", "bots")
  const diagnostics = requiredArray<DiagnosticEvent>(data, "diagnostics", "bots")
  return {
    bots: botId ? bots.filter((bot) => bot.id === botId) : bots,
    integrations: botId ? integrations.filter((integration) => integration.botId === botId) : integrations,
    diagnostics: botId ? diagnostics.filter((diagnostic) => diagnostic.botId === botId) : diagnostics,
  }
}

export type CreateBotInput = {
  name: string
  description: string
  locale: string
}

export function createBotRequest(input: CreateBotInput) {
  return platformApi.bots.post<MutationResponse>(input)
}

export function duplicateBotRequest(sourceBotId: string) {
  return platformApi.bots.post<MutationResponse>({ duplicateFromId: sourceBotId })
}

export function patchBotRequest(input: {
  id: string
  name?: string
  description?: string
  locale?: string
  ownerId?: string
  status?: BotDefinition["status"]
  integrationId?: string
  activeBrainVersionId?: string
  defaultFunnelId?: string
  voiceProfileId?: string
}) {
  return platformApi.bots.patch<MutationResponse>(input)
}

export function archiveBotRequest(id: string) {
  return platformApi.bots.delete<MutationResponse>({ id })
}

export async function deleteBotRequest(id: string) {
  const result = await platformApi.bots.delete<(MutationResponse & { deleted?: boolean }) | undefined>({
    id,
    permanent: true,
  })
  if (result !== undefined && result.deleted !== true) {
    throw new Error("A plataforma não confirmou a exclusão definitiva deste bot.")
  }
  return result
}

export type IntegrationMutationResponse = MutationResponse & {
  integration?: BotIntegration
}

export function reconnectBotRequest(botId: string, integrationId?: string) {
  return platformApi.integrations.post<IntegrationMutationResponse>({
    action: "reconnect",
    botId,
    integrationId,
  })
}

export function switchBotIntegrationRequest(input: {
  botId: string
  integrationId?: string
  token: string
}) {
  return platformApi.integrations.post<IntegrationMutationResponse>({
    action: "switch",
    ...input,
  })
}

export function resetBotIntegrationRequest(botId: string, integrationId?: string) {
  return platformApi.integrations.post<MutationResponse>({
    action: "reset",
    botId,
    integrationId,
  })
}

export async function listBrainVersionsRequest(botId: string): Promise<BrainCatalog> {
  const [data, botsData] = await Promise.all([
    platformApi.brains.get<Record<string, unknown>>({ botId }),
    platformApi.bots.get<Record<string, unknown>>(),
  ])
  const bot = requiredArray<BotDefinition>(botsData, "bots", "bots").find((item) => item.id === botId)
  return {
    versions: requiredArray<BrainVersion>(data, "brains", "versões do cérebro"),
    activeVersionId: bot?.activeBrainVersionId,
  }
}

export type BrainDraftInput = Pick<
  BrainVersion,
  | "name"
  | "identity"
  | "systemPrompt"
  | "behavior"
  | "globalMemory"
  | "language"
  | "tone"
  | "tools"
  | "memoryPolicy"
  | "voiceProfileId"
  | "notes"
>

export function createBrainVersionRequest(botId: string, fromVersionId?: string) {
  return platformApi.brains.post<MutationResponse>({
    botId,
    sourceId: fromVersionId,
  })
}

export function saveBrainVersionRequest(id: string, draft: BrainDraftInput) {
  return platformApi.brains.patch<MutationResponse>({ id, ...draft })
}

export type BrainTestResponse = {
  ok?: boolean
  output?: string
  brain?: BrainVersion
}

export function testBrainVersionRequest(id: string, message: string, draft: BrainDraftInput) {
  return platformApi.brains.patch<BrainTestResponse>({
    action: "test",
    id,
    message,
    ...draft,
  })
}

export function publishBrainVersionRequest(id: string) {
  return platformApi.brains.patch<MutationResponse>({ action: "publish", id })
}

export function restoreBrainVersionRequest(botId: string, id: string) {
  return platformApi.brains.post<MutationResponse>({ botId, sourceId: id })
}

export function deleteBrainVersionRequest(id: string) {
  return platformApi.brains.delete<MutationResponse>({ id })
}

export async function listAudioJobsRequest(botId?: string): Promise<AudioCatalog> {
  const data = await platformApi.audio.get<Record<string, unknown>>({ botId })
  return {
    jobs: requiredArray<AudioJob>(data, "jobs", "áudio"),
    assets: requiredArray<AudioAsset>(data, "assets", "áudio"),
  }
}

export function retryAudioJobRequest(jobId: string) {
  return platformApi.audio.post<MutationResponse>({ action: "retry", jobId })
}

export function patchAudioJobRequest(jobId: string, input: Partial<Pick<AudioJob, "status" | "progress">>) {
  return platformApi.audio.patch<MutationResponse>({ jobId, ...input })
}

export function deleteAudioJobRequest(jobId: string) {
  return platformApi.audio.delete<MutationResponse>({ jobId })
}
