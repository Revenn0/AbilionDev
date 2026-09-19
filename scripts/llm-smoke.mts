import { OPENROUTER_BASE_URL, STE_LLM_FALLBACK, STE_LLM_MODEL, llmHeaders } from "../src/lib/llm.ts"

const or = (process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || "").trim()

async function probe(model: string) {
  const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: llmHeaders(or, "openrouter"),
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 64,
      messages: [
        { role: "system", content: "Você é a Sté. Uma frase curta em português." },
        { role: "user", content: "to começando no Aviator e perdendo." },
      ],
    }),
  })
  const raw = await res.text()
  let preview = raw.slice(0, 160).replace(/\s+/g, " ")
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

if (!or.startsWith("sk-or-")) {
  console.error("passa OPENROUTER_API_KEY (sk-or-v1…) no ambiente — nunca no git")
  process.exit(2)
}

const probes = [await probe(STE_LLM_MODEL), await probe(STE_LLM_FALLBACK)]
const report = {
  openrouterHint: `•••• ${or.slice(-4)}`,
  chain: [STE_LLM_MODEL, STE_LLM_FALLBACK],
  probes,
}
console.log(JSON.stringify(report, null, 2))
if (!probes.some((item) => item.status === 200)) {
  console.error("OpenRouter nao respondeu")
  process.exit(1)
}
console.log(probes[0]?.status === 200 ? "llm-smoke ok (Gemma)" : "llm-smoke ok (DeepSeek reserva)")
