import { emptySettings } from "../src/lib/crm.ts"
import { migrateSettings } from "../src/lib/migrate.ts"
import type { Settings } from "../src/lib/types.ts"
import { loadAdoptedSettings } from "./crm-store.ts"
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
