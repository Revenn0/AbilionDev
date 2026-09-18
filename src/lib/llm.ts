export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
export const STE_LLM_BASE_URL = OPENROUTER_BASE_URL
export const STE_LLM_MODEL = "google/gemma-4-31b-it:free"

export const STE_LLM_MODELS = [
  {
    id: "google/gemma-4-31b-it:free",
    label: "Gemma 4 31B",
    hint: "O melhor desta lista para a Sté. Português estável, tom de conversa.",
  },
  {
    id: "z-ai/glm-5.2:free",
    label: "GLM 5.2",
    hint: "Família Z.ai, grátis. Mais fraco que o 5.3 Flash que já usávamos.",
  },
  {
    id: "deepseek/deepseek-v4-flash-0731:free",
    label: "DeepSeek V4 Flash",
    hint: "Mais raciocínio. Pode atrasar o Telegram e sair técnico demais.",
  },
  {
    id: "z-ai/glm-5.3-flash",
    label: "GLM 5.3 Flash",
    hint: "Pago no OpenRouter. O que aguenta 500–1000 leads/dia.",
  },
] as const

export type SteLlmModelId = (typeof STE_LLM_MODELS)[number]["id"]

export function normalizeSteModel(value?: string) {
  const next = (value ?? "").trim()
  if (STE_LLM_MODELS.some((item) => item.id === next)) return next
  return STE_LLM_MODEL
}

export function openRouterHeaders(apiKey: string, origin = "https://www.abilion.lol") {
  return {
    authorization: `Bearer ${apiKey}`,
    "content-type": "application/json",
    "http-referer": origin,
    "x-title": "Abilion",
  }
}
