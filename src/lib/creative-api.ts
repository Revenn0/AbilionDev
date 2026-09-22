import { fetchWithTimeout } from "@/lib/http"
import type {
  CreativeConcept,
  CreativeExperiment,
  CreativeLanguage,
  CreativeStatus,
  CreativeVariant,
  ExperimentMetric,
} from "@/lib/platform"
import { noteUnauthorized } from "@/lib/session"

export const CREATIVES_API_PATH = "/api/creatives"
export const EXPERIMENTS_API_PATH = "/api/experiments"

export type CreativeCatalog = {
  concepts: CreativeConcept[]
  variants: CreativeVariant[]
}

export type CreativeConceptInput = Pick<CreativeConcept, "name" | "theme">

export type CreativeVariantInput = Omit<
  CreativeVariant,
  "id" | "version" | "createdAt" | "updatedAt" | "reviewedAt" | "reviewedBy"
>

export type CreativeExperimentInput = Omit<
  CreativeExperiment,
  "id" | "metrics" | "suggestedWinnerId" | "approvedWinnerId" | "createdAt" | "updatedAt"
>

export type ExperimentSampleState = {
  enough: boolean
  missingVariantIds: string[]
  belowMinimumVariantIds: string[]
}

export class CreativeApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null) {
    super(message)
    this.name = "CreativeApiError"
    this.status = status
  }
}

const CREATIVE_STATUSES = new Set<CreativeStatus>(["draft", "review", "testing", "approved", "paused", "winner"])
const CREATIVE_LANGUAGES = new Set<CreativeLanguage>(["pt-BR", "es"])
const EXPERIMENT_STATUSES = new Set<CreativeExperiment["status"]>(["draft", "running", "paused", "completed"])
const PRIMARY_METRICS = new Set<CreativeExperiment["primaryMetric"]>(["ctr", "leads", "conversion", "revenue"])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === "string"
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function isNonNegativeInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= 0
}

function isOptionalString(value: unknown) {
  return value === undefined || isString(value)
}

function isCreativeConcept(value: unknown): value is CreativeConcept {
  if (!isRecord(value)) return false
  return ["id", "name", "theme", "createdAt", "updatedAt"].every((key) => isString(value[key]))
}

function isCreativeVariant(value: unknown): value is CreativeVariant {
  if (!isRecord(value)) return false
  const requiredStrings = [
    "id",
    "conceptId",
    "name",
    "market",
    "operation",
    "theme",
    "title",
    "body",
    "cta",
    "description",
    "script",
    "trackingId",
    "createdAt",
    "updatedAt",
  ]
  if (!requiredStrings.every((key) => isString(value[key]))) return false
  if (!CREATIVE_LANGUAGES.has(value.language as CreativeLanguage)) return false
  if (!CREATIVE_STATUSES.has(value.status as CreativeStatus)) return false
  if (!isFiniteNumber(value.version)) return false
  return [
    "sourceVariantId",
    "botId",
    "funnelId",
    "flowVersionId",
    "pageScriptId",
    "responsibleId",
    "reviewedAt",
    "reviewedBy",
  ].every((key) => isOptionalString(value[key]))
}

function isExperimentMetric(value: unknown): value is ExperimentMetric {
  if (!isRecord(value) || !isString(value.variantId)) return false
  if (!["impressions", "clicks", "leads", "conversions"].every((key) => isNonNegativeInteger(value[key]))) return false
  return value.revenue === undefined || isFiniteNumber(value.revenue)
}

function isCreativeExperiment(value: unknown): value is CreativeExperiment {
  if (!isRecord(value)) return false
  if (!["id", "name", "hypothesis", "audience", "operation", "createdAt", "updatedAt"].every((key) => isString(value[key]))) {
    return false
  }
  if (!EXPERIMENT_STATUSES.has(value.status as CreativeExperiment["status"])) return false
  if (!PRIMARY_METRICS.has(value.primaryMetric as CreativeExperiment["primaryMetric"])) return false
  if (!Array.isArray(value.variantIds) || !value.variantIds.every(isString)) return false
  if (value.variantIds.length < 2 || new Set(value.variantIds).size !== value.variantIds.length) return false
  if (!isRecord(value.traffic) || !Object.values(value.traffic).every((item) => isFiniteNumber(item) && item >= 0)) return false
  if (!isNonNegativeInteger(value.minimumSample) || value.minimumSample === 0 || !Array.isArray(value.metrics) || !value.metrics.every(isExperimentMetric)) {
    return false
  }
  return ["startAt", "endAt", "suggestedWinnerId", "approvedWinnerId"].every((key) => isOptionalString(value[key]))
}

function responseMessage(value: unknown, fallback: string) {
  return isRecord(value) && isString(value.error) && value.error.trim() ? value.error : fallback
}

async function request<T>(path: string, init: RequestInit, read: (data: unknown) => T): Promise<T> {
  let response: Response
  try {
    response = await fetchWithTimeout(path, init)
  } catch {
    throw new CreativeApiError("Sem rede. Tenta outra vez.", null)
  }

  noteUnauthorized(response)
  const data: unknown = await response.json().catch(() => ({}))
  if (!response.ok) {
    const fallback =
      response.status === 404
        ? "A API de Criativos ainda não está disponível."
        : "Não foi possível falar com o Worker."
    throw new CreativeApiError(responseMessage(data, fallback), response.status)
  }

  try {
    return read(data)
  } catch {
    throw new CreativeApiError("O Worker devolveu dados de Criativos inválidos.", response.status)
  }
}

function readCatalog(data: unknown): CreativeCatalog {
  if (!isRecord(data) || !Array.isArray(data.concepts) || !Array.isArray(data.variants)) throw new Error("invalid catalog")
  if (!data.concepts.every(isCreativeConcept) || !data.variants.every(isCreativeVariant)) throw new Error("invalid catalog")
  return { concepts: data.concepts, variants: data.variants }
}

function readConcept(data: unknown) {
  if (!isRecord(data) || !isCreativeConcept(data.concept)) throw new Error("invalid concept")
  return data.concept
}

function readVariant(data: unknown) {
  if (!isRecord(data) || !isCreativeVariant(data.variant)) throw new Error("invalid variant")
  return data.variant
}

function readExperiments(data: unknown) {
  if (!isRecord(data) || !Array.isArray(data.experiments) || !data.experiments.every(isCreativeExperiment)) {
    throw new Error("invalid experiments")
  }
  return data.experiments
}

function readExperiment(data: unknown) {
  if (!isRecord(data) || !isCreativeExperiment(data.experiment)) throw new Error("invalid experiment")
  return data.experiment
}

const jsonHeaders = { "Content-Type": "application/json" }

export function listCreativesRequest() {
  return request(
    CREATIVES_API_PATH,
    { credentials: "include", cache: "no-store" },
    readCatalog
  )
}

export function createCreativeConceptRequest(concept: CreativeConceptInput) {
  return request(
    CREATIVES_API_PATH,
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify({ action: "create-concept", concept }),
    },
    readConcept
  )
}

export function updateCreativeConceptRequest(concept: CreativeConcept) {
  return request(
    CREATIVES_API_PATH,
    {
      method: "PATCH",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify({ action: "update-concept", concept }),
    },
    readConcept
  )
}

export function createCreativeVariantRequest(variant: CreativeVariantInput) {
  return request(
    CREATIVES_API_PATH,
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify({ action: "create-variant", variant }),
    },
    readVariant
  )
}

export function updateCreativeVariantRequest(variant: CreativeVariant) {
  return request(
    CREATIVES_API_PATH,
    {
      method: "PATCH",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify({ action: "update-variant", variant }),
    },
    readVariant
  )
}

export async function duplicateCreativeVariantRequest(variantId: string) {
  const variant = await request(
    CREATIVES_API_PATH,
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify({ action: "duplicate-variant", variantId, status: "draft" }),
    },
    readVariant
  )
  if (variant.id === variantId || variant.status !== "draft") {
    throw new CreativeApiError("A cópia não voltou como um novo rascunho.", 200)
  }
  return variant
}

export async function translateCreativeVariantRequest(variantId: string) {
  const variant = await request(
    CREATIVES_API_PATH,
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify({
        action: "translate-variant",
        variantId,
        from: "pt-BR",
        to: "es",
        status: "review",
      }),
    },
    readVariant
  )
  if (variant.language !== "es" || variant.status !== "review" || variant.sourceVariantId !== variantId) {
    throw new CreativeApiError("A tradução não voltou como variação ES em revisão.", 200)
  }
  return variant
}

export function listCreativeExperimentsRequest() {
  return request(
    EXPERIMENTS_API_PATH,
    { credentials: "include", cache: "no-store" },
    readExperiments
  )
}

export function createCreativeExperimentRequest(experiment: CreativeExperimentInput) {
  return request(
    EXPERIMENTS_API_PATH,
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify({ experiment }),
    },
    readExperiment
  )
}

export function updateCreativeExperimentRequest(experimentId: string, experiment: CreativeExperimentInput) {
  return request(
    EXPERIMENTS_API_PATH,
    {
      method: "PATCH",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify({ experimentId, experiment }),
    },
    readExperiment
  )
}

export function experimentSampleState(experiment: CreativeExperiment): ExperimentSampleState {
  const metricsByVariant = new Map(experiment.metrics.map((metric) => [metric.variantId, metric]))
  const missingVariantIds: string[] = []
  const belowMinimumVariantIds: string[] = []

  for (const variantId of experiment.variantIds) {
    const metric = metricsByVariant.get(variantId)
    if (!metric) missingVariantIds.push(variantId)
    else if (metric.impressions < experiment.minimumSample) belowMinimumVariantIds.push(variantId)
  }

  const uniqueVariantCount = new Set(experiment.variantIds).size
  return {
    enough:
      missingVariantIds.length === 0 &&
      belowMinimumVariantIds.length === 0 &&
      uniqueVariantCount === experiment.variantIds.length &&
      uniqueVariantCount >= 2,
    missingVariantIds,
    belowMinimumVariantIds,
  }
}

export function experimentMetricFor(experiment: CreativeExperiment, variantId: string) {
  return experiment.metrics.find((metric) => metric.variantId === variantId)
}

const VARIANT_CSV_COLUMNS = [
  "id",
  "conceptId",
  "conceptName",
  "sourceVariantId",
  "name",
  "language",
  "market",
  "operation",
  "theme",
  "title",
  "body",
  "cta",
  "description",
  "script",
  "status",
  "botId",
  "funnelId",
  "flowVersionId",
  "pageScriptId",
  "trackingId",
  "responsibleId",
  "version",
  "createdAt",
  "updatedAt",
  "reviewedAt",
  "reviewedBy",
] as const

export function creativeCsvCell(value: string) {
  const protectedValue = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  const escaped = protectedValue.replace(/"/g, '""')
  return /[",\n\r]/.test(protectedValue) ? `"${escaped}"` : protectedValue
}

export function creativeVariantsToCsv(concepts: CreativeConcept[], variants: CreativeVariant[]) {
  const conceptNames = new Map(concepts.map((concept) => [concept.id, concept.name]))
  const lines = [VARIANT_CSV_COLUMNS.join(",")]
  for (const variant of variants) {
    const row: Record<string, string | number | undefined> = {
      ...variant,
      conceptName: conceptNames.get(variant.conceptId),
    }
    lines.push(VARIANT_CSV_COLUMNS.map((key) => creativeCsvCell(String(row[key] ?? ""))).join(","))
  }
  return `${lines.join("\n")}\n`
}

export function creativesToJson(concepts: CreativeConcept[], variants: CreativeVariant[]) {
  return `${JSON.stringify({ concepts, variants }, null, 2)}\n`
}

function downloadText(contents: string, mime: string, extension: string) {
  const blob = new Blob([contents], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `abilion-criativos-${new Date().toISOString().slice(0, 10)}.${extension}`
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function downloadCreativesJson(concepts: CreativeConcept[], variants: CreativeVariant[]) {
  if (!concepts.length && !variants.length) return false
  downloadText(creativesToJson(concepts, variants), "application/json;charset=utf-8", "json")
  return true
}

export function downloadCreativesCsv(concepts: CreativeConcept[], variants: CreativeVariant[]) {
  if (!variants.length) return false
  downloadText(creativeVariantsToCsv(concepts, variants), "text/csv;charset=utf-8", "csv")
  return true
}
