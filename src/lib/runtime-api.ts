import type { Lead, SalesFunnel, Settings } from "./types"

export type RuntimeStatus = {
  ok: boolean
  telegram?: boolean
  llm?: boolean
  supabase?: boolean
  persist?: "supabase" | "kv" | "memory"
  telegramBotUsername?: string
  telegramGroupUrl?: string
  tokenHint?: string
  webhook?: string
  webhookOk?: boolean
  model?: string
  fallbackModel?: string
  error?: string
}

async function parse<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(data.error || "Não foi possível falar com o Worker.")
  return data
}

export async function fetchRuntime() {
  try {
    const res = await fetch("/api/runtime", { credentials: "include", cache: "no-store" })
    if (!res.ok) return { ok: false } as RuntimeStatus
    return (await res.json()) as RuntimeStatus
  } catch {
    return { ok: false } as RuntimeStatus
  }
}

export async function saveRuntime(body: {
  telegramBotToken?: string
  telegramBotUsername?: string
  telegramGroupUrl?: string
  openaiApiKey?: string
  steModel?: string
  steFallbackModel?: string
}) {
  return parse<RuntimeStatus>(
    await fetch("/api/runtime", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  )
}

export async function fetchInbox() {
  const res = await fetch("/api/inbox", { credentials: "include", cache: "no-store" })
  if (!res.ok) return [] as Lead[]
  const data = (await res.json()) as { leads?: Lead[] }
  return data.leads ?? []
}

export async function saveCrm(body: { funnels?: SalesFunnel[]; settings?: Settings }) {
  const res = await fetch("/api/crm", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  return res.ok
}
