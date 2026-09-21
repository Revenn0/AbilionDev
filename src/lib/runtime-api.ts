import { collectLeadPages, LEAD_LIST_PAGES, type LeadListPage } from "./crm"
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
  settingsUnread?: boolean
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
  const data = (await res.json()) as {
    leads?: Lead[]
    nextCursor?: string
    stale?: boolean
    clipped?: boolean
    removed?: string[]
  }
  if (!Array.isArray(data.leads)) return { failed: true }
  return {
    leads: data.leads,
    nextCursor: typeof data.nextCursor === "string" ? data.nextCursor.trim() : undefined,
    stale: data.stale === true,
    clipped: data.clipped === true,
    removed: Array.isArray(data.removed)
      ? data.removed.filter((id): id is string => typeof id === "string" && Boolean(id.trim())).map((id) => id.trim())
      : undefined,
  }
}

export async function fetchLeads() {
  try {
    const pull = async () => {
      const pages: LeadListPage[] = []
      let cursor = ""
      let removed: string[] = []
      for (let page = 0; page < LEAD_LIST_PAGES; page++) {
        const next = await readLeadPage(cursor)
        if ("failed" in next) {
          return page === 0
            ? { ok: false as const, leads: [] as Lead[], retry: false, complete: false, removed: [] as string[] }
            : { ...collectLeadPages([...pages, { leads: [], stale: true }]), removed }
        }
        if (next.removed?.length) removed = next.removed
        pages.push(next)
        if (next.stale || !next.nextCursor) return { ...collectLeadPages(pages), removed }
        cursor = next.nextCursor
      }
      return { ...collectLeadPages(pages, "window"), removed }
    }
    const first = await pull()
    if (first.ok || !first.retry) {
      return { ok: first.ok as boolean, leads: first.leads, complete: first.complete, removed: first.removed }
    }
    const second = await pull()
    return { ok: second.ok, leads: second.leads, complete: second.complete, removed: second.removed }
  } catch {
    return { ok: false as const, leads: [] as Lead[], complete: false, removed: [] as string[] }
  }
}

export async function fetchLeadQuery(query: string) {
  const needle = query.trim().slice(0, 80)
  if (needle.length < 3) return { ok: true as const, leads: [] as Lead[] }
  try {
    const res = await fetchWithTimeout(`/api/leads?q=${encodeURIComponent(needle)}`, {
      credentials: "include",
      cache: "no-store",
    })
    noteUnauthorized(res)
    if (!res.ok) return { ok: false as const, leads: [] as Lead[] }
    const data = (await res.json()) as { leads?: Lead[] }
    if (!Array.isArray(data.leads)) return { ok: false as const, leads: [] as Lead[] }
    return { ok: true as const, leads: data.leads }
  } catch {
    return { ok: false as const, leads: [] as Lead[] }
  }
}

async function readInboxPage(cursor: string): Promise<LeadListPage | { failed: true }> {
  const res = await fetchWithTimeout(cursor ? `/api/inbox?cursor=${encodeURIComponent(cursor)}` : "/api/inbox", {
    credentials: "include",
    cache: "no-store",
  })
  noteUnauthorized(res)
  if (!res.ok) return { failed: true }
  const data = (await res.json()) as {
    leads?: Lead[]
    nextCursor?: string
    stale?: boolean
    clipped?: boolean
    removed?: string[]
  }
  if (!Array.isArray(data.leads)) return { failed: true }
  return {
    leads: data.leads,
    nextCursor: typeof data.nextCursor === "string" ? data.nextCursor.trim() : undefined,
    stale: data.stale === true,
    clipped: data.clipped === true,
    removed: Array.isArray(data.removed)
      ? data.removed.filter((id): id is string => typeof id === "string" && Boolean(id.trim())).map((id) => id.trim())
      : undefined,
  }
}

export async function fetchInbox(pages = 1) {
  try {
    const limit = Math.max(1, pages)
    const pulled: LeadListPage[] = []
    let cursor = ""
    let removed: string[] = []
    for (let page = 0; page < limit; page++) {
      const next = await readInboxPage(cursor)
      if ("failed" in next) {
        return page === 0
          ? { ok: false as const, leads: [] as Lead[], complete: false, removed: [] as string[] }
          : { ...collectLeadPages([...pulled, { leads: [], stale: true }]), removed }
      }
      if (next.removed?.length) removed = next.removed
      pulled.push(next)
      if (next.stale || !next.nextCursor) return { ...collectLeadPages(pulled), removed }
      cursor = next.nextCursor
    }
    return { ...collectLeadPages(pulled, "window"), removed }
  } catch {
    return { ok: false as const, leads: [] as Lead[], complete: false, removed: [] as string[] }
  }
}

export async function fetchCrm() {
  try {
    const res = await fetchWithTimeout("/api/crm", { credentials: "include", cache: "no-store" })
    noteUnauthorized(res)
    if (!res.ok) {
      return {
        ok: false as const,
        funnels: [] as SalesFunnel[],
        settings: undefined as Settings | undefined,
        settingsUnread: false,
        funnelsUnread: false,
      }
    }
    const data = (await res.json()) as { funnels?: SalesFunnel[]; settings?: Settings; settingsUnread?: boolean; funnelsUnread?: boolean }
    if (!Array.isArray(data.funnels)) {
      return {
        ok: false as const,
        funnels: [] as SalesFunnel[],
        settings: undefined as Settings | undefined,
        settingsUnread: false,
        funnelsUnread: false,
      }
    }
    return {
      ok: true as const,
      funnels: data.funnels,
      settings: data.settings,
      settingsUnread: data.settingsUnread === true,
      funnelsUnread: data.funnelsUnread === true,
    }
  } catch {
    return {
      ok: false as const,
      funnels: [] as SalesFunnel[],
      settings: undefined as Settings | undefined,
      settingsUnread: false,
      funnelsUnread: false,
    }
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

export function leadWriteAdopted(data: unknown): Record<string, string> {
  if (!data || typeof data !== "object") return {}
  const raw = (data as { adopted?: unknown }).adopted
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const out: Record<string, string> = {}
  for (const [from, to] of Object.entries(raw as Record<string, unknown>)) {
    if (!from || typeof to !== "string" || !to || from === to) continue
    out[from] = to
  }
  return out
}

/** Só tira da fila o que o Worker gravou. Sem `ids`, só um `saved` igual ao lote inteiro conta. */
export function leadWriteIds(data: unknown, chunk: Lead[]): string[] {
  const allowed = new Set(chunk.map((lead) => lead.id))
  if (!data || typeof data !== "object") return []
  const raw = data as { saved?: unknown; ids?: unknown }
  const adopted = leadWriteAdopted(data)
  const clientOf = new Map(Object.entries(adopted).map(([from, to]) => [to, from]))
  if (Array.isArray(raw.ids)) {
    const out: string[] = []
    const seen = new Set<string>()
    const pushClient = (id: string) => {
      if (!allowed.has(id) || seen.has(id)) return
      seen.add(id)
      out.push(id)
    }
    for (const id of raw.ids) {
      if (typeof id !== "string") continue
      if (allowed.has(id)) pushClient(id)
      else {
        const client = clientOf.get(id)
        if (client) pushClient(client)
      }
    }
    return out
  }
  if (raw.saved === chunk.length) return chunk.map((lead) => lead.id)
  return []
}

export async function persistLeads(leads: Lead[], opts?: { keepalive?: boolean }) {
  if (!leads.length) return { ok: true, saved: 0, ids: [] as string[], adopted: {} as Record<string, string> }
  const ids: string[] = []
  const adopted: Record<string, string> = {}
  for (const chunk of leadWriteChunks(leads, Boolean(opts?.keepalive))) {
    try {
      const res = await fetchWrite(
        "/api/leads",
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ leads: chunk }),
        },
        opts
      )
      noteUnauthorized(res)
      if (!res.ok) return { ok: false, saved: ids.length, ids, adopted }
      const data = (await res.json().catch(() => ({}))) as unknown
      ids.push(...leadWriteIds(data, chunk))
      Object.assign(adopted, leadWriteAdopted(data))
    } catch {
      return { ok: false, saved: ids.length, ids, adopted }
    }
  }
  return { ok: true, saved: ids.length, ids, adopted }
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
