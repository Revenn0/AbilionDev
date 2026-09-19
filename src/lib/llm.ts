export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
export const STE_LLM_BASE_URL = OPENROUTER_BASE_URL
export const STE_LLM_MODEL = "google/gemma-4-31b-it:free"
export const STE_LLM_FALLBACK = "deepseek/deepseek-v4-flash-0731:free"

export type SteLlmProvider = "openrouter"

export type SteLlmRoute = {
  provider: SteLlmProvider
  model: string
  baseUrl: string
  label: string
}

export const STE_LLM_MODELS = [
  {
    id: "google/gemma-4-31b-it:free",
    label: "Gemma 4 31B",
    hint: "Padrão da Sté no OpenRouter. Português estável, tom de conversa.",
  },
  {
    id: "deepseek/deepseek-v4-flash-0731:free",
    label: "DeepSeek V4 Flash",
    hint: "Reserva automática se o Gemma devolver 429.",
  },
  {
    id: "z-ai/glm-5.2:free",
    label: "GLM 5.2",
    hint: "Família Z.ai, grátis no OpenRouter.",
  },
  {
    id: "z-ai/glm-5.3-flash",
    label: "GLM 5.3 Flash",
    hint: "Pago no OpenRouter. Melhor para 500–1000 leads/dia.",
  },
] as const

export type SteLlmModelId = (typeof STE_LLM_MODELS)[number]["id"]

export function baseUrlOf(_model?: string) {
  return OPENROUTER_BASE_URL
}

export function normalizeSteModel(value?: string) {
  const next = (value ?? "").trim()
  if (STE_LLM_MODELS.some((item) => item.id === next)) return next
  return STE_LLM_MODEL
}

export function steLlmRoutes(primary?: string, backup?: string): SteLlmRoute[] {
  const first = normalizeSteModel(primary)
  const second = normalizeSteModel(backup || STE_LLM_FALLBACK)
  const ids = first === second ? [first] : [first, second]
  return ids.map((model) => ({
    provider: "openrouter" as const,
    model,
    baseUrl: OPENROUTER_BASE_URL,
    label: STE_LLM_MODELS.find((item) => item.id === model)?.label ?? model,
  }))
}

export function steModelChain(primary?: string, backup?: string) {
  return steLlmRoutes(primary, backup).map((item) => item.model)
}

export function openRouterHeaders(apiKey: string, origin = "https://www.abilion.lol") {
  return {
    authorization: `Bearer ${apiKey}`,
    "content-type": "application/json",
    "http-referer": origin,
    "x-title": "Abilion",
  }
}

export function llmHeaders(apiKey: string, _provider: SteLlmProvider = "openrouter") {
  return openRouterHeaders(apiKey)
}

export function steLlmAttempts(opts?: {
  primary?: string
  fallback?: string
  opencodeKey?: string
  openrouterKey?: string
  apiKey?: string
}) {
  const apiKey = (opts?.openrouterKey || opts?.apiKey || "").trim()
  if (!apiKey) return []
  return steLlmRoutes(opts?.primary, opts?.fallback).map((route) => ({ ...route, apiKey }))
}
