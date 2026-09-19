export const OPENCODE_BASE_URL = "https://opencode.ai/zen/v1"
export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
export const STE_LLM_BASE_URL = OPENCODE_BASE_URL
export const STE_LLM_MODEL = "mimo-v2.5-free"
export const STE_LLM_FALLBACK = "google/gemma-4-31b-it:free"
export const STE_LLM_RESERVE = "deepseek/deepseek-v4-flash-0731:free"

export type SteLlmProvider = "opencode" | "openrouter"

export type SteLlmRoute = {
  provider: SteLlmProvider
  model: string
  baseUrl: string
  label: string
}

export const STE_LLM_MODELS = [
  {
    id: "mimo-v2.5-free",
    label: "MiMo V2.5 Free",
    provider: "opencode" as const,
    hint: "OpenCode Zen. Principal da Sté. Se o Zen recusar fora do app, cai no OpenRouter.",
  },
  {
    id: "google/gemma-4-31b-it:free",
    label: "Gemma 4 31B",
    provider: "openrouter" as const,
    hint: "Reserva OpenRouter. Português estável.",
  },
  {
    id: "deepseek/deepseek-v4-flash-0731:free",
    label: "DeepSeek V4 Flash",
    provider: "openrouter" as const,
    hint: "Última reserva OpenRouter.",
  },
  {
    id: "z-ai/glm-5.2:free",
    label: "GLM 5.2",
    provider: "openrouter" as const,
    hint: "Família Z.ai, grátis no OpenRouter.",
  },
  {
    id: "z-ai/glm-5.3-flash",
    label: "GLM 5.3 Flash",
    provider: "openrouter" as const,
    hint: "Pago no OpenRouter.",
  },
] as const

export type SteLlmModelId = (typeof STE_LLM_MODELS)[number]["id"]

export function providerOf(model?: string): SteLlmProvider {
  const id = (model ?? "").trim()
  const row = STE_LLM_MODELS.find((item) => item.id === id)
  if (row) return row.provider
  return id.includes("/") ? "openrouter" : "opencode"
}

export function baseUrlOf(model?: string) {
  return providerOf(model) === "opencode" ? OPENCODE_BASE_URL : OPENROUTER_BASE_URL
}

export function normalizeSteModel(value?: string) {
  const next = (value ?? "").trim()
  if (STE_LLM_MODELS.some((item) => item.id === next)) return next
  return STE_LLM_MODEL
}

export function steLlmRoutes(primary?: string, backup?: string): SteLlmRoute[] {
  const first = normalizeSteModel(primary)
  const ids = [first]
  if (providerOf(first) === "opencode") {
    for (const extra of [STE_LLM_FALLBACK, STE_LLM_RESERVE]) {
      if (!ids.includes(extra)) ids.push(extra)
    }
  } else {
    const second = normalizeSteModel(backup || STE_LLM_RESERVE)
    if (!ids.includes(second)) ids.push(second)
    if (!ids.includes(STE_LLM_RESERVE)) ids.push(STE_LLM_RESERVE)
  }
  return ids.map((model) => ({
    provider: providerOf(model),
    model,
    baseUrl: baseUrlOf(model),
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

export function llmHeaders(apiKey: string, provider: SteLlmProvider = providerOf()) {
  if (provider === "openrouter") return openRouterHeaders(apiKey)
  return {
    authorization: `Bearer ${apiKey}`,
    "content-type": "application/json",
  }
}

export function steLlmAttempts(opts?: {
  primary?: string
  fallback?: string
  opencodeKey?: string
  openrouterKey?: string
  apiKey?: string
}) {
  const opencodeKey = (opts?.opencodeKey || "").trim()
  const openrouterKey = (opts?.openrouterKey || "").trim()
  const legacy = (opts?.apiKey || "").trim()
  return steLlmRoutes(opts?.primary, opts?.fallback).flatMap((route) => {
    const apiKey = route.provider === "opencode" ? opencodeKey || legacy : openrouterKey || legacy
    return apiKey ? [{ ...route, apiKey }] : []
  })
}
