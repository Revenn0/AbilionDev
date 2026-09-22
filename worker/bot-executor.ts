import { llmHeaders, steLlmAttempts } from "../src/lib/llm.ts"
import type { BotNodePolicy, BrainVersion } from "../src/lib/platform.ts"
import type { Lead } from "../src/lib/types.ts"

export type BotNodeExecution = {
  ok: boolean
  text: string
  branch: string
  memory?: string
  errorCode?: string
  error?: string
}

function choiceText(data: {
  choices?: Array<{ message?: { content?: string | Array<{ text?: string; content?: string }> } }>
}) {
  const content = data.choices?.[0]?.message?.content
  if (typeof content === "string") return content
  if (Array.isArray(content)) {
    return content.map((part) => (typeof part === "string" ? part : part.text || part.content || "")).join("\n")
  }
  return ""
}

function parseOutput(raw: string, policy: BotNodePolicy): BotNodeExecution {
  const clean = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  let data: { text?: unknown; branch?: unknown; memory?: unknown } | null = null
  try {
    const parsed = JSON.parse(clean) as unknown
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      data = parsed as { text?: unknown; branch?: unknown; memory?: unknown }
    }
  } catch {
    if (policy.mode === "respond") {
      return { ok: Boolean(clean), text: clean.slice(0, 4_000), branch: "next" }
    }
  }
  if (!data || typeof data !== "object") {
    return { ok: false, text: "", branch: "", errorCode: "invalid_output", error: "A IA não devolveu a estrutura pedida." }
  }
  const allowed = policy.outputBranches.length ? policy.outputBranches : ["next"]
  const requested = typeof data.branch === "string" ? data.branch.trim() : "next"
  const branch = allowed.includes(requested) ? requested : allowed.includes("next") ? "next" : allowed[0] || ""
  const text = typeof data.text === "string" ? data.text.trim().slice(0, 4_000) : ""
  const memory =
    policy.writeLeadMemory && typeof data.memory === "string" ? data.memory.trim().slice(0, 4_000) : undefined
  if (policy.mode === "respond" && !text) {
    return { ok: false, text: "", branch, errorCode: "empty_reply", error: "A IA devolveu uma resposta vazia." }
  }
  return { ok: true, text, branch, memory }
}

function systemPrompt(brain: BrainVersion, policy: BotNodePolicy, lead: Lead, incoming: string) {
  const context: Record<string, unknown> = {}
  for (const field of policy.contextFields) {
    if (field === "name") context.name = lead.name
    else if (field === "campaign") context.campaign = lead.campaign
    else if (field === "temperature") context.temperature = lead.temperature
    else if (field === "lastMessage") context.lastMessage = lead.lastMessage
    else if (field === "facts") context.facts = lead.facts
    else if (field === "stage") context.stage = lead.stage
  }
  if (policy.readLeadMemory) context.leadMemory = lead.memory
  return `${brain.systemPrompt}

# CÉREBRO PUBLICADO
Identidade: ${brain.identity}
Comportamento: ${brain.behavior}
Memória global: ${brain.globalMemory || "(vazia)"}
Idioma: ${policy.language || brain.language}
Tom: ${brain.tone}

# PASSO ACTUAL DO FLUXO
Modo: ${policy.mode}
Instrução: ${policy.instruction}
Acções permitidas: ${policy.allowedActions.join(", ") || "nenhuma"}
Saídas permitidas: ${policy.outputBranches.join(", ") || "next"}
Contexto autorizado: ${JSON.stringify(context)}
Mensagem recebida: ${incoming || "(sem texto)"}

Responde SOMENTE JSON:
{"text":"texto a enviar ou vazio","branch":"uma saída permitida","memory":"memória individual ou vazio"}

Não executes acções. Não inventes outra saída. Não uses contexto fora do fornecido.
${policy.writeLeadMemory ? "Podes propor memória individual." : "O campo memory deve ficar vazio."}`
}

export async function executeBotNode(
  brain: BrainVersion,
  policy: BotNodePolicy,
  lead: Lead,
  incoming: string,
  runtime: {
    apiKey?: string
    openCodeKey?: string
    openRouterKey?: string
    model?: string
    fallbackModel?: string
  }
): Promise<BotNodeExecution> {
  if (brain.status !== "published" && brain.status !== "testing") {
    return { ok: false, text: "", branch: "", errorCode: "brain_not_published", error: "O Cérebro não está publicado." }
  }
  const attempts = steLlmAttempts({
    primary: runtime.model,
    fallback: runtime.fallbackModel,
    opencodeKey: runtime.openCodeKey,
    openrouterKey: runtime.openRouterKey,
    apiKey: runtime.apiKey,
  })
  if (!attempts.length) {
    return { ok: false, text: "", branch: "", errorCode: "brain_unavailable", error: "O bot não tem uma chave de IA activa." }
  }
  const prompt = systemPrompt(brain, policy, lead, incoming)
  let lastError = "A IA não respondeu."
  const tries = Math.max(1, Math.min(3, policy.retries + 1))
  for (const attempt of attempts) {
    for (let run = 0; run < tries; run++) {
      try {
        const res = await fetch(`${attempt.baseUrl.replace(/\/$/, "")}/chat/completions`, {
          method: "POST",
          headers: llmHeaders(attempt.apiKey, attempt.provider, lead.id),
          body: JSON.stringify({
            model: attempt.model,
            temperature: 0.35,
            max_tokens: attempt.provider === "opencode" ? 768 : 512,
            messages: [{ role: "system", content: prompt }],
          }),
          signal: AbortSignal.timeout(Math.max(5, Math.min(60, policy.timeoutSeconds)) * 1000),
        })
        if (!res.ok) {
          lastError = `A IA recusou o pedido (${res.status}).`
          continue
        }
        const output = parseOutput(
          choiceText((await res.json()) as Parameters<typeof choiceText>[0]),
          policy
        )
        if (output.ok) return output
        lastError = output.error || lastError
      } catch {
        lastError = "A IA não respondeu dentro do tempo."
      }
    }
  }
  return { ok: false, text: "", branch: "", errorCode: "brain_failed", error: lastError }
}
