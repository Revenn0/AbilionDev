import { OPENCODE_BASE_URL, OPENROUTER_BASE_URL, STE_LLM_FALLBACK, STE_LLM_MODEL, STE_LLM_RESERVE, llmHeaders } from "../src/lib/llm.ts"

const oc = (process.env.OPENCODE_API_KEY || "").trim()
const or = (process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || "").trim()

async function probe(baseUrl: string, model: string, key: string, provider: "opencode" | "openrouter") {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: llmHeaders(key, provider),
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
      error?: { message?: string; type?: string }
    }
    preview = (data.choices?.[0]?.message?.content || data.error?.message || preview).slice(0, 160)
  } catch {
    /* raw */
  }
  return { model, provider, status: res.status, preview }
}

const probes = []
if (oc) probes.push(await probe(OPENCODE_BASE_URL, STE_LLM_MODEL, oc, "opencode"))
if (or.startsWith("sk-or-")) {
  probes.push(await probe(OPENROUTER_BASE_URL, STE_LLM_FALLBACK, or, "openrouter"))
  probes.push(await probe(OPENROUTER_BASE_URL, STE_LLM_RESERVE, or, "openrouter"))
}

const report = {
  opencodeHint: oc ? `•••• ${oc.slice(-4)}` : "",
  openrouterHint: or ? `•••• ${or.slice(-4)}` : "",
  chain: [STE_LLM_MODEL, STE_LLM_FALLBACK, STE_LLM_RESERVE],
  probes,
}

console.log(JSON.stringify(report, null, 2))
if (!oc && !or) {
  console.error("sem chave OpenCode nem OpenRouter no ambiente")
  process.exit(2)
}
const ocOk = probes.some((item) => item.provider === "opencode" && item.status === 200)
const orOk = probes.some((item) => item.provider === "openrouter" && item.status === 200)
if (!ocOk && !orOk) {
  console.error("nenhum provedor respondeu 200 — a Sté cai na voz do quadro")
  process.exit(1)
}
console.log(ocOk ? "llm-smoke ok (MiMo)" : "llm-smoke ok (OpenRouter reserva)")
