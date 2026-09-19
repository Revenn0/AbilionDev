import { STE_LLM_FALLBACK, STE_LLM_MODEL, openRouterHeaders, steModelChain } from "../src/lib/llm.ts"
import { replySte, replySteSmart } from "../src/lib/ste.ts"
import type { Lead } from "../src/lib/types.ts"

const key = (process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || "").trim()
if (!key.startsWith("sk-or-")) {
  console.error("passa OPENROUTER_API_KEY (sk-or-v1…) no ambiente — nunca no git")
  process.exit(2)
}

function lead(): Lead {
  const now = new Date().toISOString()
  return {
    id: "smoke-1",
    name: "Lead",
    contact: "@smoke",
    channel: "telegram",
    campaign: "facebook",
    origin: "facebook",
    temperature: "novo",
    stage: "welcome",
    memory: "",
    facts: {},
    events: [],
    messages: [],
    createdAt: now,
    updatedAt: now,
  }
}

async function probe(model: string) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: openRouterHeaders(key),
    body: JSON.stringify({
      model,
      temperature: 0.4,
      max_tokens: 80,
      messages: [
        {
          role: "system",
          content:
            "Você é a Sté, Mãe do Aviator. Responda em português, uma frase curta, sem URL crua.",
        },
        { role: "user", content: "e agora o que eu faço pra subir de nível?" },
      ],
    }),
  })
  const raw = await res.text()
  let preview = raw.slice(0, 180).replace(/\s+/g, " ")
  try {
    const data = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: string } }>
      error?: { message?: string }
    }
    preview = (data.choices?.[0]?.message?.content || data.error?.message || preview).slice(0, 160)
  } catch {
    /* raw */
  }
  return { model, status: res.status, preview }
}

const probes = []
for (const model of [STE_LLM_MODEL, STE_LLM_FALLBACK, "z-ai/glm-5.2:free", "z-ai/glm-5.3-flash"]) {
  probes.push(await probe(model))
}

const chain = steModelChain()
const started = replySte(lead(), null)
const offerLead = { ...started.lead, stePhase: "offer" as const }
const smart = await replySteSmart(offerLead, "e agora o que eu faço?", {
  apiKey: key,
  model: chain[0],
  fallbackModel: chain[1],
})

const usedLlm = !smart.replies[0]?.startsWith("Se quiser subir de nível")
const report = {
  keyHint: `•••• ${key.slice(-4)}`,
  chain,
  probes: probes.map((item) => ({ model: item.model, status: item.status, preview: item.preview })),
  smartUsedLlm: usedLlm,
  smartPreview: smart.replies.join(" | ").slice(0, 240),
}

console.log(JSON.stringify(report, null, 2))

const primaryOk = probes[0]?.status === 200
const backupOk = probes[1]?.status === 200
if (!primaryOk && !backupOk) {
  console.error("nem o Gemma nem o DeepSeek responderam")
  process.exit(1)
}
if (!backupOk) {
  console.error("reserva DeepSeek falhou")
  process.exit(1)
}
console.log(primaryOk ? "openrouter-smoke ok (Gemma + DeepSeek)" : "openrouter-smoke ok (DeepSeek reserva)")
