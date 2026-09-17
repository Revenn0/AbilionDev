import { getSupabase, supabaseEnabled, WORKSPACE } from "@/lib/supabase"
import { migrateFunnel, migrateLead, migrateSettings } from "@/lib/migrate"
import type { AppState, Lead, LeadEvent, SalesFunnel, Settings } from "@/lib/types"

type RemoteBundle = {
  funnels: SalesFunnel[]
  leads: Lead[]
  settings: Settings
}

export async function pullRemote(): Promise<RemoteBundle | null> {
  const db = getSupabase()
  if (!db) return null
  try {
    const [funnelsRes, leadsRes, waitingRes, settingsRes] = await Promise.all([
      db.from("funnels").select("*").eq("workspace_id", WORKSPACE),
      db.from("leads").select("*").eq("workspace_id", WORKSPACE).order("updated_at", { ascending: false }).limit(400),
      db.from("leads").select("*").eq("workspace_id", WORKSPACE).not("wait_until", "is", null).limit(80),
      db.from("settings").select("data").eq("workspace_id", WORKSPACE).maybeSingle(),
    ])
    if (funnelsRes.error || leadsRes.error) return null

    const leadRows = new Map<string, (typeof leadsRes.data)[number]>()
    for (const row of [...(leadsRes.data ?? []), ...(waitingRes.data ?? [])]) {
      leadRows.set(row.id, row)
    }
    const ids = [...leadRows.keys()]
    const eventsRes = ids.length ? await db.from("lead_events").select("*").in("lead_id", ids) : { data: [] }

    const eventsByLead = new Map<string, LeadEvent[]>()
    for (const row of eventsRes.data ?? []) {
      const list = eventsByLead.get(row.lead_id) ?? []
      list.push({
        id: row.id,
        at: row.at,
        kind: row.kind,
        nodeId: row.node_id ?? undefined,
        title: row.title ?? undefined,
        body: row.body ?? undefined,
        effect: row.effect ?? undefined,
      })
      eventsByLead.set(row.lead_id, list)
    }

    const funnels = (funnelsRes.data ?? []).map((row) =>
      migrateFunnel({
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

    const leads = [...leadRows.values()].map((row) =>
      migrateLead({
        id: row.id,
        name: row.name,
        contact: row.contact,
        channel: row.channel,
        campaign: row.campaign,
        origin: row.origin,
        startPayload: row.start_payload ?? undefined,
        temperature: row.temperature,
        stage: row.stage,
        printAt: row.print_at ?? undefined,
        bancaAt: row.banca_at ?? undefined,
        memory: row.memory ?? "",
        lastMessage: row.last_message ?? undefined,
        funnelId: row.funnel_id ?? undefined,
        nodeId: row.node_id ?? undefined,
        waitUntil: row.wait_until ?? undefined,
        paused: row.paused ?? false,
        events: eventsByLead.get(row.id) ?? [],
        messages: row.messages ?? [],
        stePhase: row.ste_phase ?? undefined,
        steBlocked: row.ste_blocked ?? false,
        telegramChatId: row.telegram_chat_id ?? undefined,
        updatedAt: row.updated_at,
        createdAt: row.created_at,
      })
    )

    return {
      funnels,
      leads,
      settings: migrateSettings(settingsRes.data?.data),
    }
  } catch {
    return null
  }
}

export async function pushRemote(state: AppState): Promise<boolean> {
  const db = getSupabase()
  if (!db) return false
  try {
    const funnels = state.funnels.map((funnel) => ({
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
    const leads = state.leads.map((lead) => ({
      id: lead.id,
      workspace_id: WORKSPACE,
      name: lead.name,
      contact: lead.contact,
      channel: lead.channel,
      campaign: lead.campaign,
      origin: lead.origin,
      start_payload: lead.startPayload ?? null,
      temperature: lead.temperature,
      stage: lead.stage,
      print_at: lead.printAt ?? null,
      banca_at: lead.bancaAt ?? null,
      memory: lead.memory,
      last_message: lead.lastMessage ?? null,
      funnel_id: lead.funnelId ?? null,
      node_id: lead.nodeId ?? null,
      wait_until: lead.waitUntil ?? null,
      paused: lead.paused ?? false,
      messages: lead.messages ?? [],
      ste_phase: lead.stePhase ?? null,
      ste_blocked: lead.steBlocked ?? false,
      telegram_chat_id: lead.telegramChatId ?? null,
      updated_at: lead.updatedAt,
      created_at: lead.createdAt,
    }))
    const events = state.leads.flatMap((lead) =>
      lead.events.map((event) => ({
        id: event.id,
        lead_id: lead.id,
        at: event.at,
        kind: event.kind,
        node_id: event.nodeId ?? null,
        title: event.title ?? null,
        body: event.body ?? null,
        effect: event.effect ?? null,
      }))
    )

    if (funnels.length) {
      const { error } = await db.from("funnels").upsert(funnels)
      if (error) return false
    }
    if (leads.length) {
      const { error } = await db.from("leads").upsert(leads)
      if (error) return false
    }
    if (events.length) {
      const { error } = await db.from("lead_events").upsert(events)
      if (error) return false
    }
    const { error } = await db.from("settings").upsert({ workspace_id: WORKSPACE, data: state.settings })
    return !error
  } catch {
    return false
  }
}

export { supabaseEnabled }
