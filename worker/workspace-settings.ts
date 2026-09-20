import { adoptFunnelStores, emptySettings } from "../src/lib/crm.ts"
import { migrateSettings, sanitizeIncomingFunnel } from "../src/lib/migrate.ts"
import type { SalesFunnel, Settings } from "../src/lib/types.ts"
import { loadAdoptedSettings, loadFunnelsKv, loadRemovedFunnelIds } from "./crm-store.ts"
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
