#!/usr/bin/env npx tsx
/**
 * Proxy stdio → HTTP JSON-RPC da Abilion.
 * Claude Code / outros agentes: ABILION_URL + ABILION_TOKEN (abn_…).
 */
const encoder = new TextEncoder()
const decoder = new TextDecoder()

const base = (process.env.ABILION_URL || "https://www.abilion.lol").replace(/\/$/, "")
const token = (process.env.ABILION_TOKEN || "").trim()

if (!token) {
  console.error("Falta ABILION_TOKEN. Cria um token em Utilizadores e exporta ABILION_TOKEN=abn_…")
  process.exit(1)
}

async function post(body: unknown) {
  const response = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  if (!text.trim()) {
    return { jsonrpc: "2.0", id: null, error: { code: -32000, message: `HTTP ${response.status}` } }
  }
  try {
    return JSON.parse(text) as unknown
  } catch {
    return { jsonrpc: "2.0", id: null, error: { code: -32700, message: `HTTP ${response.status}` } }
  }
}

function write(message: unknown) {
  const payload = encoder.encode(`${JSON.stringify(message)}`)
  process.stdout.write(`Content-Length: ${payload.byteLength}\r\n\r\n`)
  process.stdout.write(payload)
}

async function reply(message: unknown) {
  if (message && typeof message === "object" && !Array.isArray(message)) {
    const row = message as { id?: unknown; method?: string }
    if (row.id === undefined && typeof row.method === "string" && row.method.startsWith("notifications/")) {
      await post(message)
      return
    }
  }
  const result = await post(message)
  if (Array.isArray(result)) {
    for (const item of result) write(item)
    return
  }
  write(result)
}

let buffer = Buffer.alloc(0)

function consume() {
  const jobs: unknown[] = []
  while (buffer.length) {
    const headerEnd = buffer.indexOf("\r\n\r\n")
    if (headerEnd >= 0) {
      const header = decoder.decode(buffer.subarray(0, headerEnd))
      const length = Number(/Content-Length:\s*(\d+)/i.exec(header)?.[1] || 0)
      const start = headerEnd + 4
      if (!length || buffer.length < start + length) break
      const body = decoder.decode(buffer.subarray(start, start + length))
      buffer = buffer.subarray(start + length)
      try {
        jobs.push(JSON.parse(body) as unknown)
      } catch {
        write({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON inválido." } })
      }
      continue
    }
    const text = decoder.decode(buffer)
    const nl = text.indexOf("\n")
    if (nl < 0) break
    const line = text.slice(0, nl).trim()
    buffer = Buffer.from(text.slice(nl + 1))
    if (!line) continue
    try {
      jobs.push(JSON.parse(line) as unknown)
    } catch {
      write({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON inválido." } })
    }
  }
  return jobs
}

process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, typeof chunk === "string" ? Buffer.from(chunk) : chunk])
  const jobs = consume()
  for (const job of jobs) void reply(job).catch((error) => {
    write({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32000, message: error instanceof Error ? error.message : "Falha no proxy MCP." },
    })
  })
})

process.stdin.on("end", () => process.exit(0))
process.stdin.resume()
