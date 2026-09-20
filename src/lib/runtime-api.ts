import { noteUnauthorized } from "./session"
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
  noteUnauthorized(res)
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(data.error || "Não foi possível falar com o Worker.")
  return data
}

export async function fetchRuntime() {
  try {
    const res = await fetch("/api/runtime", { credentials: "include", cache: "no-store" })
    noteUnauthorized(res)
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
  opencodeApiKey?: string
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

export async function fetchLeads() {
  try {
    const res = await fetch("/api/leads", { credentials: "include", cache: "no-store" })
    noteUnauthorized(res)
    if (!res.ok) return { ok: false as const, leads: [] as Lead[] }
    const data = (await res.json()) as { leads?: Lead[] }
    if (!Array.isArray(data.leads)) return { ok: false as const, leads: [] as Lead[] }
    return { ok: true as const, leads: data.leads }
  } catch {
    return { ok: false as const, leads: [] as Lead[] }
  }
}

export async function fetchInbox() {
  try {
    const res = await fetch("/api/inbox", { credentials: "include", cache: "no-store" })
    noteUnauthorized(res)
    if (!res.ok) return { ok: false as const, leads: [] as Lead[] }
    const data = (await res.json()) as { leads?: Lead[] }
    if (!Array.isArray(data.leads)) return { ok: false as const, leads: [] as Lead[] }
    return { ok: true as const, leads: data.leads }
  } catch {
    return { ok: false as const, leads: [] as Lead[] }
  }
}

export async function fetchCrm() {
  try {
    const res = await fetch("/api/crm", { credentials: "include", cache: "no-store" })
    noteUnauthorized(res)
    if (!res.ok) return { ok: false as const, funnels: [] as SalesFunnel[], settings: undefined as Settings | undefined }
    const data = (await res.json()) as { funnels?: SalesFunnel[]; settings?: Settings }
    if (!Array.isArray(data.funnels)) return { ok: false as const, funnels: [] as SalesFunnel[], settings: undefined as Settings | undefined }
    return { ok: true as const, funnels: data.funnels, settings: data.settings }
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
  noteUnauthorized(res)
  return res.ok
}

export async function removeRemoteLead(id: string) {
  const res = await fetch(`/api/leads?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  })
  noteUnauthorized(res)
  return res.ok
}

export async function saveCrm(body: { funnels?: SalesFunnel[]; settings?: Settings; removedFunnelIds?: string[] }) {
  const res = await fetch("/api/crm", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  noteUnauthorized(res)
  return res.ok
}
