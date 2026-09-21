import { adoptFunnelStores, emptySettings, publicSettings } from "../src/lib/crm.ts"
import { migrateSettings, sanitizeIncomingFunnel } from "../src/lib/migrate.ts"
import type { Lead, LeadEvent, SalesFunnel, Settings } from "../src/lib/types.ts"
import { loadAdoptedSettings, loadFunnelsKv, loadRemovedFunnelIds, persistFunnelsMerge, persistSettingsMerge } from "./crm-store.ts"
import type { KvLike } from "./kv.ts"

const WORKSPACE = "local"

export type SettingsEnv = {
  AUTH?: KvLike
  SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE?: string
}

async function fetchRemoteSettings(env: SettingsEnv): Promise<Settings | undefined> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE) return undefined
  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/settings?workspace_id=eq.${WORKSPACE}&select=data`, {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
      },
    })
    if (!res.ok) return undefined
    const rows = (await res.json()) as { data?: Settings }[]
    return rows[0]?.data ? migrateSettings(rows[0].data) : undefined
  } catch {
    return undefined
  }
}

/** Painel e MCP: KV oco não esconde username, scripts e categorias do Postgres. */
export async function loadWorkspaceSettings(env: SettingsEnv): Promise<Settings> {
  const remote = await fetchRemoteSettings(env)
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

async function fetchRemoteFunnels(env: SettingsEnv): Promise<SalesFunnel[]> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE) return []
  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/funnels?workspace_id=eq.${WORKSPACE}`, {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
      },
    })
    if (!res.ok) return []
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
    return []
  }
}

/** Painel e MCP: KV sem quadro cai no Postgres; tombstone de funil continua a valer. */
export async function loadWorkspaceFunnels(env: SettingsEnv): Promise<SalesFunnel[]> {
  const kv = env.AUTH ? await loadFunnelsKv(env.AUTH) : []
  const remote = kv.length ? [] : await fetchRemoteFunnels(env)
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
      facts: lead.facts ?? {},
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
