import { adoptFunnelStores, emptySettings, publicSettings } from "../src/lib/crm.ts"
import { sanitizeLeadCategory } from "../src/lib/lead-category.ts"
import { migrateSettings, sanitizeIncomingFunnel } from "../src/lib/migrate.ts"
import type { Lead, LeadEvent, SalesFunnel, Settings } from "../src/lib/types.ts"
import { isLeadPageCursor, loadAdoptedSettings, loadFunnelsKv, loadRemovedFunnelIds, persistFunnelsMerge, persistSettingsMerge } from "./crm-store.ts"
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

async function fetchRemoteSettings(env: SettingsEnv): Promise<Settings | undefined | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE) return undefined
  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/settings?workspace_id=eq.${WORKSPACE}&select=data`, {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
      },
    })
    if (!res.ok) return null
    const rows = (await res.json()) as { data?: Settings }[]
    return rows[0]?.data ? migrateSettings(rows[0].data) : undefined
  } catch {
    return null
  }
}

/** Painel e MCP: KV oco não esconde username, scripts e categorias do Postgres. */
export async function loadWorkspaceSettings(env: SettingsEnv): Promise<Settings> {
  const remote = await fetchRemoteSettings(env)
  if (remote === null) {
    if (env.AUTH) return loadAdoptedSettings(env.AUTH)
    return emptySettings()
  }
  if (env.AUTH) return loadAdoptedSettings(env.AUTH, remote)
  return remote ?? emptySettings()
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
    if (!res.ok) {
      console.error("supabase falhou", path.split("?")[0], res.status)
      return null
    }
    const text = await res.text()
    if (!text) return true as T
    return JSON.parse(text) as T
  } catch {
    console.error("supabase sem rede", path.split("?")[0])
    return null
  }
}

/** Painel e MCP: o KV continua a ser a fonte; o Postgres fica com a mesma cópia. */
export async function persistRemoteFunnels(env: SettingsEnv, funnels: SalesFunnel[]) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE) return
  if (funnels.length) {
    await restWorkspace(env, "funnels", {
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
  }
  const rows = (await restWorkspace<{ id: string }[]>(env, `funnels?workspace_id=eq.${WORKSPACE}&select=id`)) ?? []
  const keep = new Set(funnels.map((item) => item.id))
  for (const row of rows.filter((item) => item.id && !keep.has(item.id)).slice(0, 40)) {
    await restWorkspace(env, `funnels?id=eq.${encodeURIComponent(row.id)}&workspace_id=eq.${WORKSPACE}`, { method: "DELETE" })
  }
}

export async function persistRemoteSettings(env: SettingsEnv, settings: Settings) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE) return
  await restWorkspace(env, "settings", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ workspace_id: WORKSPACE, data: publicSettings(settings) }),
  })
}

export async function persistRemoteLead(env: SettingsEnv, lead: Lead) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE) return
  await restWorkspace(env, "leads", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
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
    }),
  })
  if (lead.events.length) {
    await restWorkspace(env, "lead_events", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(
        lead.events.map((event: LeadEvent) => ({
          id: event.id,
          lead_id: lead.id,
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
