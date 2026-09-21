import { adoptFunnelStores, adoptSearchLeads, applyRemovedFunnels, commitStoredLead, commitStoredSettings, emptySettings, factsWithoutRemoteKeys, mergeLeadEvents, publicSettings, resolveLeadLookup, sanitizeLeadEvents } from "../src/lib/crm.ts"
import { sanitizeLeadCategory } from "../src/lib/lead-category.ts"
import { leadMatchesQuery } from "../src/lib/lead-name.ts"
import { countryName, normalizeCountryCode, normalizeRegionCode } from "../src/lib/geo.ts"
import { migrateSettings, sanitizeIncomingFunnel } from "../src/lib/migrate.ts"
import { sanitizeVisitorId, summarizeTrack, type TrackEvent, type TrackKind, type TrackSummary } from "../src/lib/track.ts"
import type { Lead, LeadEvent, SalesFunnel, Settings } from "../src/lib/types.ts"
import { mergeTrackEvents } from "./track-store.ts"
import { filterLiveLeads, findLeadInKv, isLeadPageCursor, isLeadRemoved, leadRemovedForRead, listLeadPage, loadAdoptedSettings, loadFunnelsKv, loadLead, loadRemovedFunnelIds, loadRemovedLeadIds, lookupLeadsByQuery, persistFunnelsMerge, persistSettingsMerge, removedIdsForRead, resolveLeadWrite } from "./crm-store.ts"
import type { KvLike } from "./kv.ts"

const WORKSPACE = "local"

type RemoteFacts = Lead["facts"] & { category?: string; timeline?: LeadEvent[] }

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
  const facts: RemoteFacts = { ...factsWithoutRemoteKeys(lead.facts) }
  if (lead.category) facts.category = lead.category
  const timeline = sanitizeLeadEvents(lead.events)
  if (timeline.length) facts.timeline = timeline
  return facts
}

export function rowToLead(row: LeadRow): Lead {
  const raw = row.facts ?? {}
  const category = typeof raw.category === "string" ? sanitizeLeadCategory(raw.category) || undefined : undefined
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
    facts: factsWithoutRemoteKeys(raw),
    lastMessage: row.last_message ?? undefined,
    funnelId: row.funnel_id ?? undefined,
    nodeId: row.node_id ?? undefined,
    waitUntil: row.wait_until ?? undefined,
    paused: row.paused ?? false,
    events: sanitizeLeadEvents(raw.timeline),
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
 * Painel e MCP: KV e backup juntam-se.
 * `ok: false` só quando o índice está vazio, o KV não achou ninguém, há credenciais e o backup falha.
 * Índice preenchido + backup em baixo é busca vazia, não 503.
 * Hit no KV + backup em baixo devolve o KV — não esconde o leftover.
 */
export async function searchWorkspaceLeads(
  env: SettingsEnv,
  query: string
): Promise<{ ok: true; leads: Lead[] } | { ok: false }> {
  if (!env.AUTH) return { ok: true, leads: [] }
  let found: Lead[]
  try {
    found = await lookupLeadsByQuery(env.AUTH, query)
  } catch {
    return { ok: false }
  }
  const remote = await fetchRemoteLeadSearch(env, query)
  if (remote === null) {
    if (found.length) return { ok: true, leads: found }
    try {
      const page = await listLeadPage(env.AUTH, 1, "all")
      return page.empty ? { ok: false } : { ok: true, leads: [] }
    } catch {
      return { ok: false }
    }
  }
  return { ok: true, leads: adoptSearchLeads(found, remote) }
}

function quoteRemoteId(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
}

/** Identidade do webhook. Path vazio = nada para perguntar. */
export function remoteLeadIdentityPath(contact: string, telegramId: number, chatId: string) {
  const filters: string[] = []
  const handle = contact.trim().slice(0, 80)
  const chat = chatId.trim().slice(0, 80)
  if (handle) filters.push(`contact.eq.${quoteRemoteId(handle)}`)
  if (telegramId > 0) filters.push(`contact.eq.${quoteRemoteId(`tg:${telegramId}`)}`)
  if (chat) filters.push(`telegram_chat_id.eq.${quoteRemoteId(chat)}`)
  if (!filters.length) return ""
  return `leads?workspace_id=eq.${WORKSPACE}&or=(${filters.join(",")})&select=*&limit=1`
}

/** Chat do Telegram no backup. `null` é falha; `[]` é miss, sem credenciais ou sem identidade. */
export async function fetchRemoteLeadByIdentity(
  env: SettingsEnv,
  contact: string,
  telegramId: number,
  chatId: string
): Promise<Lead[] | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE) return []
  const path = remoteLeadIdentityPath(contact, telegramId, chatId)
  if (!path) return []
  const rows = await restWorkspace<LeadRow[]>(env, path)
  if (rows === null || !Array.isArray(rows)) return null
  return rows.map(rowToLead)
}

/** Esperas vencidas no backup. Path vazio = stamp inválido. */
export function remoteLeadDuePath(nowIso: string) {
  const stamp = nowIso.trim()
  if (!stamp || stamp.length > 40) return ""
  return `leads?workspace_id=eq.${WORKSPACE}&wait_until=lte.${quoteRemoteId(stamp)}&select=*`
}

/** Esperas no backup. `null` é falha; `[]` é vazio ou sem credenciais. */
export async function fetchRemoteDueLeads(env: SettingsEnv, nowIso: string): Promise<Lead[] | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE) return []
  const path = remoteLeadDuePath(nowIso)
  if (!path) return []
  const rows = await restWorkspace<LeadRow[]>(env, path)
  if (rows === null || !Array.isArray(rows)) return null
  return rows.map(rowToLead)
}

/** KV hit + ficha do backup: une as falas. Sem remoto, fica o KV. */
export function hydrateWorkspaceLead(kv: Lead, remote?: Lead | null): Lead {
  if (!remote) return kv
  return commitStoredLead(remote, kv, remote)
}

/**
 * KV primeiro. Miss cai no Postgres.
 * Falha do backup (credenciais + `null`) lança — o webhook não mint um segundo UUID.
 * Hit no KV + backup em baixo devolve o KV — não lança, não mint UUID.
 */
export async function findWorkspaceLead(
  env: SettingsEnv,
  contact: string,
  telegramId: number,
  chatId: string
): Promise<Lead | null> {
  let kvLead: Lead | null = null
  let kvUnread = false
  if (env.AUTH) {
    try {
      const removed = await removedIdsForRead(env.AUTH)
      kvLead = await findLeadInKv(env.AUTH, contact, telegramId, chatId, removed)
    } catch {
      kvUnread = true
    }
  }
  if (kvLead) {
    const extras = await fetchRemoteLeadsByIds(env, [kvLead.id])
    if (extras === null) return kvLead
    return hydrateWorkspaceLead(kvLead, extras[0])
  }
  if (kvUnread) throw new Error("Não li o lead do Postgres.")
  const remote = await fetchRemoteLeadByIdentity(env, contact, telegramId, chatId)
  if (remote === null) throw new Error("Não li o lead do Postgres.")
  const hydrated = remote[0]
  if (!hydrated) return null
  if (env.AUTH) {
    try {
      if (await isLeadRemoved(env.AUTH, hydrated.id)) return null
      return resolveLeadLookup(null, hydrated, await loadRemovedLeadIds(env.AUTH))
    } catch {
      throw new Error("Não li o lead do Postgres.")
    }
  }
  return resolveLeadLookup(null, hydrated, [])
}

/**
 * MCP get_lead: KV primeiro. Miss cai no Postgres pelo id.
 * Falha do backup (credenciais + `null`) lança — não finge que a ficha não existe.
 * Hit no KV + backup em baixo devolve o KV.
 */
export async function findWorkspaceLeadById(env: SettingsEnv, id: string): Promise<Lead | null> {
  const needle = id.trim()
  if (!needle || needle.length > 80) return null
  if (env.AUTH) {
    try {
      const removed = await removedIdsForRead(env.AUTH)
      if (await leadRemovedForRead(env.AUTH, needle)) return null
      const kvLead = await loadLead(env.AUTH, needle, removed)
      if (kvLead) {
        const extras = await fetchRemoteLeadsByIds(env, [kvLead.id])
        if (extras === null) return kvLead
        return hydrateWorkspaceLead(kvLead, extras[0])
      }
    } catch (error) {
      if (error instanceof Error && error.message === "Não li o lead do Postgres.") throw error
      throw new Error("Não li o lead do Postgres.")
    }
  }
  const extras = await fetchRemoteLeadsByIds(env, [needle])
  if (extras === null) throw new Error("Não li o lead do Postgres.")
  const remote = extras[0]
  if (!remote) return null
  if (env.AUTH) {
    try {
      if (await leadRemovedForRead(env.AUTH, remote.id)) return null
    } catch {
      throw new Error("Não li o lead do Postgres.")
    }
  }
  return remote
}

export function telegramIdFromLead(lead: Pick<Lead, "contact">) {
  const match = /^tg:(\d+)$/.exec((lead.contact || "").trim())
  return match ? Number(match[1]) : 0
}

/**
 * POST/MCP: KV primeiro. Miss cai no Postgres.
 * Falha do backup (credenciais + `null`) recusa — o operador não mint um segundo UUID.
 */
export async function resolveWorkspaceLeadWrite(
  env: SettingsEnv,
  lead: Lead
): Promise<{ ok: true; incoming: Lead; prev: Lead | null } | { ok: false; unread: true }> {
  if (!env.AUTH) return { ok: false, unread: true }
  try {
    const removed = await removedIdsForRead(env.AUTH)
    const existing = lead.id ? await loadLead(env.AUTH, lead.id, removed) : null
    if (existing) {
      const resolved = await resolveLeadWrite(env.AUTH, lead)
      return { ok: true, incoming: resolved.incoming, prev: resolved.prev }
    }
    try {
      const found = await findWorkspaceLead(env, lead.contact, telegramIdFromLead(lead), lead.telegramChatId ?? "")
      if (found) {
        return {
          ok: true,
          incoming: { ...lead, id: found.id, createdAt: found.createdAt },
          prev: found,
        }
      }
    } catch {
      return { ok: false, unread: true }
    }
    const resolved = await resolveLeadWrite(env.AUTH, lead)
    return { ok: true, incoming: resolved.incoming, prev: resolved.prev }
  } catch {
    return { ok: false, unread: true }
  }
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

type LeadEventRow = {
  id: string
  lead_id: string
  at: string
  kind: LeadEvent["kind"]
  node_id?: string | null
  title?: string | null
  body?: string | null
  effect?: string | null
}

/** GET e MCP: junta `lead_events` à ficha. Tabela unread não zera a timeline do jsonb. */
export async function attachWorkspaceLeadEvents(
  env: SettingsEnv,
  leads: Lead[]
): Promise<{ leads: Lead[]; unread: boolean }> {
  if (!leads.length) return { leads, unread: false }
  const canReach = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE)
  const ids = [...new Set(leads.map((lead) => lead.id).filter(Boolean))]
  const rows: LeadEventRow[] = []
  let unread = false
  for (let i = 0; i < ids.length; i += 50) {
    const slice = ids.slice(i, i + 50)
    const batch = await restWorkspace<LeadEventRow[]>(
      env,
      `lead_events?lead_id=in.(${slice.map(quoteRemoteId).join(",")})&select=*&order=at.asc`
    )
    if (batch === null) {
      if (canReach) unread = true
      continue
    }
    if (!Array.isArray(batch)) {
      if (canReach) unread = true
      continue
    }
    rows.push(...batch)
  }
  if (!rows.length) return { leads, unread }
  const byLead = new Map<string, LeadEvent[]>()
  for (const row of rows) {
    const list = byLead.get(row.lead_id) ?? []
    list.push({
      id: row.id,
      at: row.at,
      kind: row.kind,
      nodeId: row.node_id ?? undefined,
      title: row.title ?? undefined,
      body: row.body ?? undefined,
      effect: row.effect ?? undefined,
    })
    byLead.set(row.lead_id, list)
  }
  return {
    leads: leads.map((lead) => {
      const events = byLead.get(lead.id)
      if (!events?.length) return lead
      return { ...lead, events: mergeLeadEvents(lead.events, events) }
    }),
    unread,
  }
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

/** Índice oco + Postgres com credenciais e fetch `null`: não é catálogo vazio. */
export async function leadCatalogUnread(env: SettingsEnv): Promise<boolean> {
  if (!env.AUTH) return false
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE) return false
  let page
  try {
    page = await listLeadPage(env.AUTH, 1, "all")
  } catch {
    return true
  }
  if (!page.empty) return false
  const remote = await fetchRemoteLeadPage(env, 1, "all")
  return remote === null
}

type PageEventRow = {
  id?: string
  visitor_id?: string
  kind?: string
  path?: string
  referrer?: string
  campaign?: string
  country?: string
  city?: string
  region?: string
  device?: string
  language?: string
  at?: string
}

export function rowToTrackEvent(row: PageEventRow): TrackEvent | null {
  const id = typeof row.id === "string" ? row.id.trim() : ""
  const visitorId = sanitizeVisitorId(row.visitor_id)
  const kind = (["view", "click", "telegram", "beat"].includes(String(row.kind)) ? row.kind : "") as TrackKind | ""
  if (!id || !visitorId || !kind) return null
  const countryCode = normalizeCountryCode(row.country)
  const regionCode = normalizeRegionCode(row.region, countryCode)
  return {
    id,
    visitorId,
    kind,
    path: String(row.path || "/").slice(0, 180),
    referrer: String(row.referrer || "").slice(0, 240),
    campaign: String(row.campaign || "").slice(0, 120),
    country: countryName(countryCode, row.country),
    countryCode,
    city: String(row.city || "").slice(0, 64),
    region: String(row.region || "").slice(0, 64),
    regionCode,
    device: String(row.device || "Outro").slice(0, 40),
    language: String(row.language || "").slice(0, 16),
    at: typeof row.at === "string" && row.at ? row.at : new Date().toISOString(),
  }
}

/** Pixel no backup. `null` é falha; `[]` é vazio ou sem credenciais. */
export async function fetchRemotePageEvents(env: SettingsEnv, limit = 4000): Promise<TrackEvent[] | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE) return []
  const cap = Math.min(4000, Math.max(1, Math.floor(limit) || 4000))
  const rows = await restWorkspace<PageEventRow[]>(
    env,
    `page_events?workspace_id=eq.${WORKSPACE}&select=*&order=at.desc&limit=${cap}`
  )
  if (rows === null || !Array.isArray(rows)) return null
  return rows.map(rowToTrackEvent).filter((item): item is TrackEvent => Boolean(item))
}

/**
 * Painel: KV e Postgres juntam-se.
 * KV oco + backup em baixo é erro — zeros do pixel não são “ninguém veio”.
 */
export async function summarizeWorkspaceTrack(
  env: SettingsEnv,
  kvEvents: TrackEvent[],
  now = Date.now()
): Promise<{ ok: true; summary: TrackSummary; unread?: boolean } | { ok: false }> {
  const remote = await fetchRemotePageEvents(env)
  const canReach = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE)
  if (canReach && remote === null) {
    if (!kvEvents.length) return { ok: false }
    return { ok: true, summary: summarizeTrack(kvEvents, now), unread: true }
  }
  return { ok: true, summary: summarizeTrack(mergeTrackEvents(kvEvents, remote ?? []), now) }
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

/** Painel e MCP: KV e Postgres juntam-se. KV oco + backup em baixo é erro; KV com quadro sobrevive unread. */
export async function readWorkspaceFunnels(env: SettingsEnv): Promise<{ funnels: SalesFunnel[]; unread: boolean }> {
  const kv = env.AUTH ? await loadFunnelsKv(env.AUTH) : []
  const remote = await fetchRemoteFunnels(env)
  const removed = env.AUTH ? await loadRemovedFunnelIds(env.AUTH) : []
  if (remote === null) {
    if (!kv.length) throw new Error("Não li os funis do Postgres.")
    return { funnels: applyRemovedFunnels(kv, removed), unread: true }
  }
  return { funnels: adoptFunnelStores(kv, remote, removed), unread: false }
}

export async function loadWorkspaceFunnels(env: SettingsEnv): Promise<SalesFunnel[]> {
  return (await readWorkspaceFunnels(env)).funnels
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

function funnelRowForRemote(funnel: SalesFunnel) {
  return {
    id: funnel.id,
    workspace_id: WORKSPACE,
    name: funnel.name,
    mode: funnel.mode,
    status: funnel.status,
    nodes: funnel.nodes,
    edges: funnel.edges,
    production: funnel.production ?? null,
    updated_at: funnel.updatedAt,
  }
}

/** Painel e MCP: junta o KV com o backup. GET falho não POSTa o leftover — settings e leads já recusam. Só apaga tombstone. */
export async function persistRemoteFunnels(env: SettingsEnv, funnels: SalesFunnel[]) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE) return
  const remote = await fetchRemoteFunnels(env)
  if (remote === null) return
  const removed = env.AUTH ? await loadRemovedFunnelIds(env.AUTH) : []
  const keep = adoptFunnelStores(funnels, remote, removed)
  if (keep.length) {
    const wrote = await restWorkspace(env, "funnels", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(keep.map(funnelRowForRemote)),
    })
    if (wrote === null) return
  }
  const gone = new Set(removed)
  for (const row of remote.filter((item) => item.id && gone.has(item.id)).slice(0, 40)) {
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
  const merged = hydrateWorkspaceLead(lead, extras[0])
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
