import { collectLeadPages, type LeadListPage } from "./crm"
import { fetchWithTimeout, fetchWrite } from "./http"
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
  warning?: string
}

async function parse<T>(res: Response): Promise<T> {
  noteUnauthorized(res)
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(data.error || "Não foi possível falar com o Worker.")
  return data
}

export async function fetchRuntime() {
  try {
    const res = await fetchWithTimeout("/api/runtime", { credentials: "include", cache: "no-store" })
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
    await fetchWithTimeout("/api/runtime", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  )
}

export async function prepareVoice() {
  return parse<RuntimeStatus>(
    await fetchWithTimeout("/api/runtime/voice", {
      method: "POST",
      credentials: "include",
    })
  )
}

async function readLeadPage(cursor: string): Promise<LeadListPage | { failed: true }> {
  const res = await fetchWithTimeout(cursor ? `/api/leads?cursor=${encodeURIComponent(cursor)}` : "/api/leads", {
    credentials: "include",
    cache: "no-store",
  })
  noteUnauthorized(res)
  if (!res.ok) return { failed: true }
  const data = (await res.json()) as { leads?: Lead[]; nextCursor?: string; stale?: boolean }
  if (!Array.isArray(data.leads)) return { failed: true }
  return {
    leads: data.leads,
    nextCursor: typeof data.nextCursor === "string" ? data.nextCursor.trim() : undefined,
    stale: data.stale === true,
  }
}

export async function fetchLeads() {
  try {
    const pull = async () => {
      const pages: LeadListPage[] = []
      let cursor = ""
      for (let page = 0; page < 5; page++) {
        const next = await readLeadPage(cursor)
        if ("failed" in next) {
          return page === 0 ? { ok: false as const, leads: [] as Lead[], retry: false } : collectLeadPages([...pages, { leads: [], stale: true }])
        }
        pages.push(next)
        const folded = collectLeadPages(pages)
        if (folded.retry || !next.nextCursor) return folded
        cursor = next.nextCursor
      }
      return collectLeadPages(pages)
    }
    const first = await pull()
    if (first.ok || !first.retry) return { ok: first.ok as boolean, leads: first.leads }
    const second = await pull()
    return { ok: second.ok, leads: second.leads }
  } catch {
    return { ok: false as const, leads: [] as Lead[] }
  }
}

export async function fetchInbox() {
  try {
    const res = await fetchWithTimeout("/api/inbox", { credentials: "include", cache: "no-store" })
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
    const res = await fetchWithTimeout("/api/crm", { credentials: "include", cache: "no-store" })
    noteUnauthorized(res)
    if (!res.ok) return { ok: false as const, funnels: [] as SalesFunnel[], settings: undefined as Settings | undefined }
    const data = (await res.json()) as { funnels?: SalesFunnel[]; settings?: Settings }
    if (!Array.isArray(data.funnels)) return { ok: false as const, funnels: [] as SalesFunnel[], settings: undefined as Settings | undefined }
    return { ok: true as const, funnels: data.funnels, settings: data.settings }
  } catch {
    return { ok: false as const, funnels: [] as SalesFunnel[], settings: undefined as Settings | undefined }
  }
}

export type WriteResult = { ok: boolean; error?: string }

async function writeOk(run: () => Promise<Response>) {
  const result = await writeResult(run)
  return result.ok
}

async function writeResult(run: () => Promise<Response>): Promise<WriteResult> {
  try {
    const res = await run()
    noteUnauthorized(res)
    if (res.ok) return { ok: true }
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    return { ok: false, error: typeof data.error === "string" && data.error ? data.error : "Não foi possível gravar." }
  } catch {
    return { ok: false, error: "Sem rede. Tenta outra vez." }
  }
}

export const LEAD_WRITE_BATCH = 120

export function leadWriteChunks(leads: Lead[], keepalive = false) {
  const work = keepalive ? leads.slice(0, LEAD_WRITE_BATCH) : leads
  const chunks: Lead[][] = []
  for (let i = 0; i < work.length; i += LEAD_WRITE_BATCH) chunks.push(work.slice(i, i + LEAD_WRITE_BATCH))
  return chunks
}

export async function persistLeads(leads: Lead[], opts?: { keepalive?: boolean }) {
  if (!leads.length) return { ok: true, saved: 0 }
  let saved = 0
  for (const chunk of leadWriteChunks(leads, Boolean(opts?.keepalive))) {
    const ok = await writeOk(() =>
      fetchWrite(
        "/api/leads",
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ leads: chunk }),
        },
        opts
      )
    )
    if (!ok) return { ok: false, saved }
    saved += chunk.length
  }
  return { ok: true, saved }
}

export async function removeRemoteLead(id: string, opts?: { keepalive?: boolean }) {
  return writeOk(() =>
    fetchWrite(
      `/api/leads?id=${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        credentials: "include",
      },
      opts
    )
  )
}

export async function saveCrm(
  body: { funnels?: SalesFunnel[]; settings?: Settings; removedFunnelIds?: string[] },
  opts?: { keepalive?: boolean }
) {
  return writeResult(() =>
    fetchWrite(
      "/api/crm",
      {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
      opts
    )
  )
}
