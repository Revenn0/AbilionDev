export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
export const OPENCODE_GO_BASE_URL = "https://opencode.ai/zen/go/v1"
export const STE_LLM_BASE_URL = OPENROUTER_BASE_URL
export const STE_LLM_MODEL = "google/gemma-4-31b-it:free"
export const STE_LLM_FALLBACK = "deepseek/deepseek-v4-flash-0731:free"
export const STE_OPENCODE_MODEL = "deepseek-v4.1-flash"

export type SteLlmProvider = "openrouter" | "opencode"

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
    hint: "Reserva no OpenRouter se o DeepSeek V4.1 Flash do OpenCode falhar.",
  },
  {
    id: "deepseek/deepseek-v4-flash-0731:free",
    label: "DeepSeek V4 Flash",
    hint: "Segunda reserva no OpenRouter.",
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

export function baseUrlOf(model?: string) {
  if ((model ?? "").trim() === STE_OPENCODE_MODEL) return OPENCODE_GO_BASE_URL
  return OPENROUTER_BASE_URL
}

export function normalizeSteModel(value?: string) {
  const next = (value ?? "").trim()
  if (next === STE_OPENCODE_MODEL) return next
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

export function openCodeHeaders(apiKey: string, session = "abilion-ste") {
  return {
    authorization: `Bearer ${apiKey}`,
    "content-type": "application/json",
    "user-agent": "AbilionSte/1.0",
    "x-opencode-session": session,
  }
}

export function llmHeaders(apiKey: string, provider: SteLlmProvider = "openrouter", session?: string) {
  if (provider === "opencode") return openCodeHeaders(apiKey, session)
  return openRouterHeaders(apiKey)
}

export function steLlmAttempts(opts?: {
  primary?: string
  fallback?: string
  opencodeKey?: string
  openrouterKey?: string
  apiKey?: string
}) {
  const opencodeKey = (opts?.opencodeKey || "").trim()
  const openrouterKey = (opts?.openrouterKey || opts?.apiKey || "").trim()
  const attempts: Array<SteLlmRoute & { apiKey: string }> = []
  if (opencodeKey) {
    attempts.push({
      provider: "opencode",
      model: STE_OPENCODE_MODEL,
      baseUrl: OPENCODE_GO_BASE_URL,
      label: "DeepSeek V4.1 Flash",
      apiKey: opencodeKey,
    })
  }
  if (openrouterKey) {
    attempts.push(...steLlmRoutes(opts?.primary, opts?.fallback).map((route) => ({ ...route, apiKey: openrouterKey })))
  }
  return attempts
}
