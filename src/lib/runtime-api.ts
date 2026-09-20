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
  voice?: boolean
  voiceHint?: string
  voiceClips?: Array<{ id: string; label: string; ready: boolean }>
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
  elevenApiKey?: string
  elevenVoiceId?: string
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

export async function prepareVoice() {
  return parse<RuntimeStatus>(
    await fetch("/api/runtime/voice", {
      method: "POST",
      credentials: "include",
    })
  )
}

export async function fetchInbox() {
  const res = await fetch("/api/inbox", { credentials: "include", cache: "no-store" })
  if (!res.ok) return [] as Lead[]
  const data = (await res.json()) as { leads?: Lead[] }
  return data.leads ?? []
}

export async function fetchCrm() {
  try {
    const res = await fetch("/api/crm", { credentials: "include", cache: "no-store" })
    if (!res.ok) return { ok: false as const, funnels: [] as SalesFunnel[], settings: undefined as Settings | undefined }
    return (await res.json()) as { ok: true; funnels: SalesFunnel[]; settings?: Settings }
  } catch {
    return { ok: false as const, funnels: [] as SalesFunnel[], settings: undefined as Settings | undefined }
  }
}

export async function persistLeads(leads: Lead[]) {
  if (!leads.length) return true
  const res = await fetch("/api/leads", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ leads: leads.slice(0, 120) }),
  })
  return res.ok
}

export async function removeRemoteLead(id: string) {
  const res = await fetch(`/api/leads?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  })
  return res.ok
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
