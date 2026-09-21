import { adoptFunnelStores, commitStoredLead, commitStoredSettings, emptySettings, publicSettings } from "../src/lib/crm.ts"
import { sanitizeLeadCategory } from "../src/lib/lead-category.ts"
import { leadMatchesQuery } from "../src/lib/lead-name.ts"
import { migrateSettings, sanitizeIncomingFunnel } from "../src/lib/migrate.ts"
import type { Lead, LeadEvent, SalesFunnel, Settings } from "../src/lib/types.ts"
import { filterLiveLeads, isLeadPageCursor, listLeadPage, loadAdoptedSettings, loadFunnelsKv, loadRemovedFunnelIds, lookupLeadsByQuery, persistFunnelsMerge, persistSettingsMerge } from "./crm-store.ts"
import type { KvLike } from "./kv.ts"

const WORKSPACE = "local"

type RemoteFacts = Lead["facts"] & { category?: string }

export type LeadRow = {
  id: string
  name: string
  contact: string
  channel: Lead["channel"]
  campaign: string
  origin: Lead["origin"]
  start_payload?: string | null
  visitor_id?: string | null
  temperature: Lead["temperature"]
  stage: Lead["stage"]
  print_at?: string | null
  banca_at?: string | null
  memory?: string
  facts?: RemoteFacts
  last_message?: string | null
  funnel_id?: string | null
  node_id?: string | null
  wait_until?: string | null
  paused?: boolean
  messages?: Lead["messages"]
  ste_phase?: Lead["stePhase"] | null
  ste_blocked?: boolean
  ste_quiet?: boolean
  telegram_chat_id?: string | null
  updated_at: string
  created_at: string
}

export function leadFactsForRemote(lead: Lead): RemoteFacts {
  const facts: RemoteFacts = { ...(lead.facts ?? {}) }
  if (lead.category) facts.category = lead.category
  return facts
}

export function rowToLead(row: LeadRow): Lead {
  const raw = row.facts ?? {}
  const category = typeof raw.category === "string" ? sanitizeLeadCategory(raw.category) || undefined : undefined
  const { category: _ignored, ...facts } = raw
  return {
    id: row.id,
    name: row.name,
    contact: row.contact,
    channel: row.channel,
    campaign: row.campaign,
    origin: row.origin,
    startPayload: row.start_payload ?? undefined,
    visitorId: row.visitor_id ?? undefined,
    temperature: row.temperature,
    stage: row.stage,
    printAt: row.print_at ?? undefined,
    bancaAt: row.banca_at ?? undefined,
    memory: row.memory ?? "",
    facts,
    lastMessage: row.last_message ?? undefined,
    funnelId: row.funnel_id ?? undefined,
    nodeId: row.node_id ?? undefined,
    waitUntil: row.wait_until ?? undefined,
    paused: row.paused ?? false,
    events: [],
    messages: row.messages ?? [],
    stePhase: row.ste_phase ?? undefined,
    steBlocked: row.ste_blocked ?? false,
    steQuiet: row.ste_quiet ?? false,
    telegramChatId: row.telegram_chat_id ?? undefined,
    category,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  }
}

export function remoteLeadListPath(channel: "telegram" | "all", limit: number, cursor = "") {
  const parts = [
    `workspace_id=eq.${WORKSPACE}`,
    channel === "telegram" ? "channel=eq.telegram" : "",
    "select=*",
    "order=updated_at.desc,id.desc",
    `limit=${Math.max(1, limit)}`,
  ].filter(Boolean)
  const mark = cursor.trim()
  if (mark && isLeadPageCursor(mark)) {
    const split = mark.indexOf("|")
    const updatedAt = mark.slice(0, split)
    const id = mark.slice(split + 1)
    parts.push(`or=(updated_at.lt.${updatedAt},and(updated_at.eq.${updatedAt},id.lt.${id}))`)
  }
  return `leads?${parts.join("&")}`
}

/** Corta `,()*` e afins para o `or=` do PostgREST não virar outro filtro. */
export function sanitizeRemoteSearchNeedle(query: string) {
  return query
    .trim()
    .slice(0, 80)
    .replace(/[^a-zA-ZÀ-ÿ0-9@+_.\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/** KV oco: busca no backup. Sem needle seguro devolve path vazio. */
export function remoteLeadSearchPath(query: string, limit = 50) {
  const exact = query.trim().slice(0, 80)
  const needle = sanitizeRemoteSearchNeedle(exact)
  const digits = exact.replace(/\D/g, "")
  const filters: string[] = []
  if (needle.length >= 3) {
    const like = `*${needle}*`
    filters.push(
      `name.ilike.${like}`,
      `contact.ilike.${like}`,
      `campaign.ilike.${like}`,
      `last_message.ilike.${like}`,
      `telegram_chat_id.ilike.${like}`,
      `facts->>category.ilike.${like}`
    )
  }
  if (digits.length >= 8) filters.push(`contact.ilike.*${digits}*`)
  if (/^[a-z0-9-]{3,80}$/i.test(exact)) filters.push(`id.eq.${exact}`)
  if (!filters.length) return ""
  return `leads?${[
    `workspace_id=eq.${WORKSPACE}`,
    "select=*",
    `or=(${filters.join(",")})`,
    "order=updated_at.desc,id.desc",
    `limit=${Math.max(1, Math.min(50, limit))}`,
  ].join("&")}`
}

/** KV oco: lê o backup pela busca. `null` é falha; `[]` é vazio, sem credenciais ou needle curto. */
export async function fetchRemoteLeadSearch(env: SettingsEnv, query: string): Promise<Lead[] | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE) return []
  const path = remoteLeadSearchPath(query)
  if (!path) return []
  const rows = await restWorkspace<LeadRow[]>(env, path)
  if (rows === null || !Array.isArray(rows)) return null
  return rows.map(rowToLead).filter((lead) => leadMatchesQuery(lead, query))
}

/**
 * Painel e MCP: o KV ganha. Miss no KV cai no Postgres (órfão / fora do índice).
 * `ok: false` só quando o índice está vazio, há credenciais e o backup falha.
 * Índice preenchido + backup em baixo é busca vazia, não 503.
 */
export async function searchWorkspaceLeads(
  env: SettingsEnv,
  query: string
): Promise<{ ok: true; leads: Lead[] } | { ok: false }> {
  if (!env.AUTH) return { ok: true, leads: [] }
  const found = await lookupLeadsByQuery(env.AUTH, query)
  if (found.length) return { ok: true, leads: found }
  const page = await listLeadPage(env.AUTH, 1, "all")
  const remote = await fetchRemoteLeadSearch(env, query)
  if (remote === null) return page.empty ? { ok: false } : { ok: true, leads: [] }
  return { ok: true, leads: remote }
}

function quoteRemoteId(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
}

/** Página mista: lê no backup os ids do índice que o KV não carregou. `null` é falha. */
export async function fetchRemoteLeadsByIds(env: SettingsEnv, ids: string[]): Promise<Lead[] | null> {
  const clean = [...new Set(ids.map((id) => id.trim()).filter((id) => id && id.length <= 80))].slice(0, 400)
  if (!clean.length) return []
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE) return []
  const rows = await restWorkspace<LeadRow[]>(
    env,
    `leads?workspace_id=eq.${WORKSPACE}&id=in.(${clean.map(quoteRemoteId).join(",")})&select=*`
  )
  if (rows === null || !Array.isArray(rows)) return null
  return rows.map(rowToLead)
}

/** Junta no KV os ids órfãos que o Postgres ainda tem. `holesOpen` se algum id ficar por resolver. */
export async function fillLeadHoles(
  env: SettingsEnv,
  leads: Lead[],
  missingIds: string[]
): Promise<{ leads: Lead[]; holesOpen: boolean }> {
  const missing = [...new Set(missingIds.map((id) => id.trim()).filter(Boolean))]
  if (!missing.length) return { leads, holesOpen: false }
  const extras = await fetchRemoteLeadsByIds(env, missing)
  if (extras === null) return { leads, holesOpen: true }
  const liveExtras = env.AUTH ? await filterLiveLeads(env.AUTH, extras) : extras
  const next = [...leads]
  const have = new Set(next.map((lead) => lead.id))
  for (const lead of liveExtras) {
    if (have.has(lead.id)) continue
    next.push(lead)
    have.add(lead.id)
  }
  return { leads: next, holesOpen: missing.some((id) => !have.has(id)) }
}

/** KV oco: lê o backup. `null` é falha; `[]` é vazio ou sem credenciais. */
export async function fetchRemoteLeadPage(
  env: SettingsEnv,
  limit: number,
  channel: "telegram" | "all",
  cursor = ""
): Promise<Lead[] | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE) return []
  const rows = await restWorkspace<LeadRow[]>(env, remoteLeadListPath(channel, limit, cursor))
  if (rows === null) return null
  if (!Array.isArray(rows)) return null
  return rows.map(rowToLead)
}

export type SettingsEnv = {
  AUTH?: KvLike
  SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE?: string
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchRemoteSettings(env: SettingsEnv): Promise<Settings | undefined | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE) return undefined
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`${env.SUPABASE_URL}/rest/v1/settings?workspace_id=eq.${WORKSPACE}&select=data`, {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
        },
      })
      if (res.ok) {
        const rows = (await res.json()) as { data?: Settings }[]
        return rows[0]?.data ? migrateSettings(rows[0].data) : undefined
      }
    } catch {
      return null
    }
    if (attempt < 3) await sleep(40 * (attempt + 1))
  }
  return null
}

/** Painel e MCP: KV oco não esconde username, scripts e categorias do Postgres. */
export async function readWorkspaceSettings(env: SettingsEnv): Promise<{ settings: Settings; unread: boolean }> {
  const remote = await fetchRemoteSettings(env)
  if (remote === null) {
    const settings = env.AUTH ? await loadAdoptedSettings(env.AUTH) : emptySettings()
    return { settings, unread: true }
  }
  if (env.AUTH) return { settings: await loadAdoptedSettings(env.AUTH, remote), unread: false }
  return { settings: remote ?? emptySettings(), unread: false }
}

export async function loadWorkspaceSettings(env: SettingsEnv): Promise<Settings> {
  return (await readWorkspaceSettings(env)).settings
}

type FunnelRow = {
  id: string
  name: string
  mode: SalesFunnel["mode"]
  status: SalesFunnel["status"]
  updated_at: string
  nodes: SalesFunnel["nodes"]
  edges: SalesFunnel["edges"]
  production: SalesFunnel["production"]
}

async function fetchRemoteFunnels(env: SettingsEnv): Promise<SalesFunnel[] | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE) return []
  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/funnels?workspace_id=eq.${WORKSPACE}`, {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
      },
    })
    if (!res.ok) return null
    const rows = (await res.json()) as FunnelRow[]
    return rows
      .map((row) =>
        sanitizeIncomingFunnel({
          id: row.id,
          name: row.name,
          mode: row.mode,
          status: row.status,
          updatedAt: row.updated_at,
          nodes: row.nodes ?? [],
          edges: row.edges ?? [],
          production: row.production,
        })
      )
      .filter((item): item is SalesFunnel => Boolean(item))
  } catch {
    return null
  }
}

/** Painel e MCP: KV sem quadro cai no Postgres; tombstone de funil continua a valer. */
export async function loadWorkspaceFunnels(env: SettingsEnv): Promise<SalesFunnel[]> {
  const kv = env.AUTH ? await loadFunnelsKv(env.AUTH) : []
  const remote = kv.length ? [] : await fetchRemoteFunnels(env)
  if (remote === null) throw new Error("Não li os funis do Postgres.")
  const removed = env.AUTH ? await loadRemovedFunnelIds(env.AUTH) : []
  return adoptFunnelStores(kv, remote, removed)
}

async function restWorkspace<T>(env: SettingsEnv, path: string, init?: RequestInit): Promise<T | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE) return null
  const method = (init?.method || "GET").toUpperCase()
  const tries = method === "GET" || method === "HEAD" ? 1 : 4
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
        ...init,
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        },
      })
      if (res.ok) {
        const text = await res.text()
        if (!text) return true as T
        return JSON.parse(text) as T
      }
      console.error("supabase falhou", path.split("?")[0], res.status)
    } catch {
      console.error("supabase sem rede", path.split("?")[0])
    }
    if (attempt < tries - 1) await sleep(40 * (attempt + 1))
  }
  return null
}

/** Painel e MCP: o KV continua a ser a fonte; o Postgres fica com a mesma cópia. */
export async function persistRemoteFunnels(env: SettingsEnv, funnels: SalesFunnel[]) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE) return
  if (funnels.length) {
    const wrote = await restWorkspace(env, "funnels", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(
        funnels.map((funnel) => ({
          id: funnel.id,
          workspace_id: WORKSPACE,
          name: funnel.name,
          mode: funnel.mode,
          status: funnel.status,
          nodes: funnel.nodes,
          edges: funnel.edges,
          production: funnel.production ?? null,
          updated_at: funnel.updatedAt,
        }))
      ),
    })
    if (wrote === null) return
  }
  const rows = (await restWorkspace<{ id: string }[]>(env, `funnels?workspace_id=eq.${WORKSPACE}&select=id`)) ?? []
  const keep = new Set(funnels.map((item) => item.id))
  for (const row of rows.filter((item) => item.id && !keep.has(item.id)).slice(0, 40)) {
    await restWorkspace(env, `funnels?id=eq.${encodeURIComponent(row.id)}&workspace_id=eq.${WORKSPACE}`, { method: "DELETE" })
  }
}

export async function persistRemoteSettings(env: SettingsEnv, settings: Settings) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE) return
  const remote = await fetchRemoteSettings(env)
  if (remote === null) return
  const merged = remote ? commitStoredSettings(remote, settings, remote) : migrateSettings(settings)
  await restWorkspace(env, "settings", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ workspace_id: WORKSPACE, data: publicSettings(merged) }),
  })
}

function leadRowForRemote(lead: Lead) {
  return {
    id: lead.id,
    workspace_id: WORKSPACE,
    name: lead.name,
    contact: lead.contact,
    channel: lead.channel,
    campaign: lead.campaign,
    origin: lead.origin,
    start_payload: lead.startPayload ?? null,
    visitor_id: lead.visitorId ?? null,
    temperature: lead.temperature,
    stage: lead.stage,
    print_at: lead.printAt ?? null,
    banca_at: lead.bancaAt ?? null,
    memory: lead.memory,
    facts: leadFactsForRemote(lead),
    last_message: lead.lastMessage ?? null,
    funnel_id: lead.funnelId ?? null,
    node_id: lead.nodeId ?? null,
    wait_until: lead.waitUntil ?? null,
    paused: lead.paused ?? false,
    messages: lead.messages ?? [],
    ste_phase: lead.stePhase ?? null,
    ste_blocked: lead.steBlocked ?? false,
    ste_quiet: lead.steQuiet ?? false,
    telegram_chat_id: lead.telegramChatId ?? null,
    updated_at: lead.updatedAt,
    created_at: lead.createdAt,
  }
}

export async function persistRemoteLead(env: SettingsEnv, lead: Lead) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE) return
  const extras = await fetchRemoteLeadsByIds(env, [lead.id])
  if (extras === null) return
  const merged = extras[0] ? commitStoredLead(extras[0], lead, extras[0]) : lead
  await restWorkspace(env, "leads", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(leadRowForRemote(merged)),
  })
  if (merged.events.length) {
    await restWorkspace(env, "lead_events", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(
        merged.events.map((event: LeadEvent) => ({
          id: event.id,
          lead_id: merged.id,
          at: event.at,
          kind: event.kind,
          node_id: event.nodeId ?? null,
          title: event.title ?? null,
          body: event.body ?? null,
          effect: event.effect ?? null,
        }))
      ),
    })
  }
}

export async function persistWorkspaceFunnels(env: SettingsEnv, incoming: SalesFunnel[], incomingRemoved: string[] = []) {
  if (!env.AUTH) throw new Error("Auth ainda sem KV.")
  const clean = await persistFunnelsMerge(env.AUTH, incoming, incomingRemoved)
  await persistRemoteFunnels(env, clean)
  return clean
}

export async function persistWorkspaceSettings(env: SettingsEnv, incoming: Settings) {
  if (!env.AUTH) throw new Error("Auth ainda sem KV.")
  const clean = await persistSettingsMerge(env.AUTH, incoming)
  await persistRemoteSettings(env, clean)
  return clean
}
