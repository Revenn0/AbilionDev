import { OPENCODE_GO_BASE_URL, STE_OPENCODE_MODEL, openCodeHeaders } from "../src/lib/llm.ts"

const key = (process.env.OPENCODE_API_KEY || "").trim()

if (!key.startsWith("oc_sk_")) {
  console.error("passa OPENCODE_API_KEY (oc_sk_…) no ambiente — nunca no git")
  process.exit(2)
}

const res = await fetch(`${OPENCODE_GO_BASE_URL}/chat/completions`, {
  method: "POST",
  headers: openCodeHeaders(key, "ste-smoke"),
  body: JSON.stringify({
    model: STE_OPENCODE_MODEL,
    temperature: 0.2,
    max_tokens: 256,
    messages: [
      { role: "system", content: "Você é a Sté. Uma frase curta em português, sem markdown." },
      { role: "user", content: "to começando no Aviator e perdendo." },
    ],
  }),
})

const raw = await res.text()
let preview = ""
try {
  const data = JSON.parse(raw) as {
    model?: string
    choices?: Array<{ message?: { content?: string } }>
    error?: { message?: string }
  }
  preview = (data.choices?.[0]?.message?.content || data.error?.message || "").trim()
  const ok = res.status === 200 && Boolean(data.choices?.[0]?.message?.content?.trim())
  console.log(
    JSON.stringify(
      {
        ok,
        status: res.status,
        model: data.model || STE_OPENCODE_MODEL,
        endpoint: OPENCODE_GO_BASE_URL,
        keyHint: `•••• ${key.slice(-4)}`,
        preview: preview.slice(0, 180),
      },
      null,
      2
    )
  )
  if (!ok) {
    console.error("OpenCode DeepSeek V4.1 Flash nao respondeu com texto")
    process.exit(1)
  }
} catch {
  console.error(raw.slice(0, 240))
  process.exit(1)
}

console.log("opencode-smoke ok")
