import { llmHeaders, steLlmAttempts } from "../src/lib/llm.ts"
import type {
  CreativeConcept,
  CreativeExperiment,
  CreativeVariant,
  ExperimentMetric,
} from "../src/lib/platform.ts"
import type { KvLike } from "./kv.ts"

export const CREATIVE_CONCEPTS = "platform:creative-concepts"
export const CREATIVE_VARIANTS = "platform:creative-variants"
export const CREATIVE_EXPERIMENTS = "platform:creative-experiments"
const CAP = 2000

async function loadArray<T>(kv: KvLike, key: string): Promise<T[]> {
  const raw = await kv.get(key, "json")
  return Array.isArray(raw) ? (raw as T[]) : []
}

async function saveById<T extends { id: string; updatedAt: string }>(
  kv: KvLike,
  key: string,
  incoming: T[]
) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const current = await loadArray<T>(kv, key)
    const byId = new Map(current.map((item) => [item.id, item]))
    for (const item of incoming) {
      const prev = byId.get(item.id)
      byId.set(item.id, !prev || item.updatedAt >= prev.updatedAt ? { ...prev, ...item } : { ...item, ...prev })
    }
    const next = [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, CAP)
    await kv.put(key, JSON.stringify(next))
    const stored = await loadArray<T>(kv, key)
    if (incoming.every((item) => stored.some((row) => row.id === item.id))) return stored
    await new Promise((resolve) => setTimeout(resolve, 4 * (attempt + 1)))
  }
  throw new Error(`Não confirmei ${key}.`)
}

export async function loadCreativeCatalog(kv: KvLike) {
  const [concepts, variants] = await Promise.all([
    loadArray<CreativeConcept>(kv, CREATIVE_CONCEPTS),
    loadArray<CreativeVariant>(kv, CREATIVE_VARIANTS),
  ])
  return { concepts, variants }
}

export function loadCreativeExperiments(kv: KvLike) {
  return loadArray<CreativeExperiment>(kv, CREATIVE_EXPERIMENTS)
}

export function saveCreativeConcepts(kv: KvLike, rows: CreativeConcept[]) {
  return saveById(kv, CREATIVE_CONCEPTS, rows)
}

export function saveCreativeVariants(kv: KvLike, rows: CreativeVariant[]) {
  return saveById(kv, CREATIVE_VARIANTS, rows)
}

export function saveCreativeExperiments(kv: KvLike, rows: CreativeExperiment[]) {
  return saveById(kv, CREATIVE_EXPERIMENTS, rows)
}

function choiceText(data: {
  choices?: Array<{ message?: { content?: string | Array<{ text?: string; content?: string }> } }>
}) {
  const content = data.choices?.[0]?.message?.content
  if (typeof content === "string") return content
  if (Array.isArray(content)) return content.map((item) => (typeof item === "string" ? item : item.text || item.content || "")).join("")
  return ""
}

export async function translateVariantToSpanish(
  variant: CreativeVariant,
  runtime: {
    apiKey?: string
    openCodeKey?: string
    openRouterKey?: string
    model?: string
    fallbackModel?: string
  }
) {
  const attempts = steLlmAttempts({
    primary: runtime.model,
    fallback: runtime.fallbackModel,
    opencodeKey: runtime.openCodeKey,
    openrouterKey: runtime.openRouterKey,
    apiKey: runtime.apiKey,
  })
  if (!attempts.length) throw new Error("Liga uma chave de IA para traduzir este criativo.")
  const prompt = `Traduz este criativo comercial de português do Brasil para espanhol neutro.
Preserva intenção, promessa permitida, tom e chamada para ação. Não acrescentes afirmações.
Responde SOMENTE JSON com title, body, cta, description e script.

${JSON.stringify({
  title: variant.title,
  body: variant.body,
  cta: variant.cta,
  description: variant.description,
  script: variant.script,
})}`
  for (const attempt of attempts) {
    try {
      const response = await fetch(`${attempt.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: llmHeaders(attempt.apiKey, attempt.provider, variant.id),
        body: JSON.stringify({
          model: attempt.model,
          temperature: 0.2,
          max_tokens: attempt.provider === "opencode" ? 1200 : 900,
          messages: [{ role: "system", content: prompt }],
        }),
        signal: AbortSignal.timeout(30_000),
      })
      if (!response.ok) continue
      const raw = choiceText((await response.json()) as Parameters<typeof choiceText>[0])
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const take = (key: string, max: number) =>
        typeof parsed[key] === "string" ? String(parsed[key]).trim().slice(0, max) : ""
      const translated = {
        title: take("title", 240),
        body: take("body", 8_000),
        cta: take("cta", 240),
        description: take("description", 2_000),
        script: take("script", 16_000),
      }
      if (translated.title && translated.body && translated.cta) return translated
    } catch {
      /* tenta o próximo modelo */
    }
  }
  throw new Error("A IA não devolveu uma tradução válida. Tenta novamente.")
}

function metricValue(metric: ExperimentMetric, kind: CreativeExperiment["primaryMetric"]) {
  if (kind === "ctr") return metric.impressions ? metric.clicks / metric.impressions : 0
  if (kind === "leads") return metric.leads
  if (kind === "conversion") return metric.impressions ? metric.conversions / metric.impressions : 0
  return metric.revenue ?? 0
}

export function suggestedWinner(experiment: CreativeExperiment) {
  const byVariant = new Map(experiment.metrics.map((item) => [item.variantId, item]))
  if (
    experiment.variantIds.length < 2 ||
    experiment.variantIds.some((id) => (byVariant.get(id)?.impressions ?? 0) < experiment.minimumSample)
  ) {
    return undefined
  }
  return experiment.variantIds
    .slice()
    .sort(
      (left, right) =>
        metricValue(byVariant.get(right)!, experiment.primaryMetric) -
        metricValue(byVariant.get(left)!, experiment.primaryMetric)
    )[0]
}
