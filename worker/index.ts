import { campaignFor } from "../src/lib/labels"
import { replySte, replySteSmart } from "../src/lib/ste"
import { campaignFromStart, originFromStart, parseTelegramStart } from "../src/lib/telegram-start"
import { applyEvent, dueWaits, publishedSnapshot } from "../src/lib/runtime"
import { BANCA_FIXED, type Lead, type LeadOrigin, type SalesFunnel, type Settings } from "../src/lib/types"

export interface Env {
  ASSETS: Fetcher
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE?: string
  TELEGRAM_BOT_TOKEN?: string
  TELEGRAM_WEBHOOK_SECRET?: string
  CRON_SECRET?: string
  ESTER_CHAT_ID?: string
  WHATSAPP_TOKEN?: string
  APP_URL?: string
  OPENAI_API_KEY?: string
  OPENAI_BASE_URL?: string
  STE_USE_LLM?: string
}

const WORKSPACE = "local"

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url)
    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env, url, ctx)
    }
    return env.ASSETS.fetch(request)
  },
  async scheduled(_event: ScheduledEvent, env: Env) {
    await processWaits(env)
  },
}

async function handleApi(request: Request, env: Env, url: URL, ctx: ExecutionContext) {
  if (url.pathname === "/api/health") {
    return json({
      ok: true,
      telegram: Boolean(env.TELEGRAM_BOT_TOKEN),
      supabase: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE),
      ste: true,
      llm: env.STE_USE_LLM === "1",
    })
  }

  if (url.pathname === "/api/telegram" && request.method === "POST") {
    if (env.TELEGRAM_WEBHOOK_SECRET) {
      const header = request.headers.get("x-telegram-bot-api-secret-token")
      if (header !== env.TELEGRAM_WEBHOOK_SECRET) return json({ ok: false }, 401)
    }
    const update = (await request.json()) as TelegramUpdate
    ctx.waitUntil(handleTelegram(env, update))
    return json({ ok: true })
  }

  if (url.pathname === "/api/whatsapp" && request.method === "POST") {
    if (!env.WHATSAPP_TOKEN) return json({ ok: true, accepted: false, reason: "plugin" })
    return json({ ok: true, accepted: true, note: "mesmo contrato de evento do Telegram" })
  }

  if (url.pathname === "/api/cron") {
    const secret = url.searchParams.get("secret") ?? request.headers.get("x-cron-secret")
    if (env.CRON_SECRET && secret !== env.CRON_SECRET) return json({ ok: false }, 401)
    const count = await processWaits(env)
    return json({ ok: true, advanced: count })
  }

  return json({ ok: false, error: "not_found" }, 404)
}

async function handleTelegram(env: Env, update: TelegramUpdate) {
  const token = env.TELEGRAM_BOT_TOKEN
  if (!token) return

  const joinUser = update.message?.new_chat_members?.[0] ?? (update.chat_member?.new_chat_member?.status === "member" ? update.chat_member.new_chat_member.user : undefined)
  const message = update.message
  const from = joinUser ?? message?.from
  if (!from) return

  const contact = from.username ? `@${from.username}` : `tg:${from.id}`
  const name = [from.first_name, from.last_name].filter(Boolean).join(" ") || contact
  const chatId = String(message?.chat.id ?? update.chat_member?.chat.id ?? from.id)
  const start = parseTelegramStart(joinUser ? "" : message?.text)
  const origin: LeadOrigin = joinUser ? "group_join" : start.isStart ? originFromStart(start.payload) : "private"
  const campaign = joinUser ? campaignFor("telegram") : start.isStart ? campaignFromStart(start.payload) : campaignFor("telegram", origin)
  const now = new Date().toISOString()

  const existing = await findLead(env, contact, from.id, chatId)
  let lead: Lead
  if (existing) {
    lead = existing
    if (start.isStart && start.payload) {
      lead.origin = origin
      lead.campaign = campaign
      lead.startPayload = start.payload
    }
  } else {
    lead = {
      id: crypto.randomUUID(),
      name,
      contact,
      channel: "telegram",
      campaign,
      origin,
      startPayload: start.payload || undefined,
      temperature: "novo",
      stage: origin === "group_join" ? "group" : "welcome",
      memory: "",
      events: [],
      messages: [],
      createdAt: now,
      updatedAt: now,
    }
  }

  lead.telegramChatId = chatId

  const incoming = joinUser || start.isStart ? null : (message?.text ?? null)
  const settings = await loadSettings(env)
  const shouldTalk = settings.steLinkedTelegram !== false && !joinUser
  if (shouldTalk) {
    const useLlm = env.STE_USE_LLM === "1" && Boolean(incoming?.trim())
    const talked = useLlm
      ? await replySteSmart(lead, incoming, { apiKey: env.OPENAI_API_KEY, baseUrl: env.OPENAI_BASE_URL })
      : replySte(lead, incoming)
    lead = talked.lead
    if (talked.reply) {
      await telegram(token, "sendMessage", { chat_id: chatId, text: talked.reply })
    }
  }

  await saveLead(env, lead)
}

async function processWaits(env: Env) {
  const now = new Date().toISOString()
  const dueRows = (await rest<LeadRow[]>(env, `leads?workspace_id=eq.${WORKSPACE}&wait_until=lte.${now}&paused=eq.false&select=*`)) ?? []
  if (!dueRows.length) return 0
  const funnels = await loadFunnels(env)
  const settings = await loadSettings(env)
  const snapshot = publishedSnapshot(funnels)
  const leads = dueRows.map(rowToLead)
  const due = dueWaits(leads)
  const token = env.TELEGRAM_BOT_TOKEN
  for (const lead of due) {
    const result = applyEvent(snapshot, lead, { type: "timer" }, Date.now())
    await saveLead(env, result.lead)
    for (const effect of result.effects) {
      if (effect.kind === "offer" && token && lead.telegramChatId) {
        await telegram(token, "sendMessage", { chat_id: lead.telegramChatId, text: effect.body || "Oferta do produto" })
      }
      if (effect.kind === "notify_ester" && token) {
        await notifyEster(env, token, effect.body, settings)
      }
    }
  }
  return due.length
}

async function notifyEster(env: Env, token: string, body: string, settings: Settings) {
  const chat = env.ESTER_CHAT_ID || settings.esterTelegramChatId
  if (!chat) return
  await telegram(token, "sendMessage", { chat_id: chat, text: body || BANCA_FIXED })
}

async function loadFunnels(env: Env): Promise<SalesFunnel[]> {
  return ((await rest<SalesFunnelRow[]>(env, `funnels?workspace_id=eq.${WORKSPACE}`)) ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    mode: row.mode,
    status: row.status,
    updatedAt: row.updated_at,
    nodes: row.nodes ?? [],
    edges: row.edges ?? [],
    production: row.production,
  })) as SalesFunnel[]
}

async function loadSettings(env: Env): Promise<Settings> {
  const settingsRow = await rest<{ data: Settings }[]>(env, `settings?workspace_id=eq.${WORKSPACE}`)
  return settingsRow?.[0]?.data ?? ({} as Settings)
}

async function findLead(env: Env, contact: string, telegramId: number, chatId: string): Promise<Lead | null> {
  const filter = [
    `contact.eq.${quote(contact)}`,
    `contact.eq.${quote(`tg:${telegramId}`)}`,
    `telegram_chat_id.eq.${quote(chatId)}`,
  ].join(",")
  const rows = (await rest<LeadRow[]>(env, `leads?workspace_id=eq.${WORKSPACE}&or=(${filter})&select=*&limit=1`)) ?? []
  return rows[0] ? rowToLead(rows[0]) : null
}

function quote(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
}

function rowToLead(row: LeadRow): Lead {
  return {
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
    events: [],
    messages: row.messages ?? [],
    stePhase: row.ste_phase ?? undefined,
    steBlocked: row.ste_blocked ?? false,
    telegramChatId: row.telegram_chat_id ?? undefined,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  }
}

async function saveLead(env: Env, lead: Lead) {
  await rest(env, "leads", {
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
    }),
  })
  if (lead.events.length) {
    await rest(env, "lead_events", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(
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
      ),
    })
  }
}

async function rest<T>(env: Env, path: string, init?: RequestInit): Promise<T | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE) return null
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) return null
  const text = await res.text()
  return text ? (JSON.parse(text) as T) : (true as T)
}

async function telegram(token: string, method: string, body: Record<string, unknown>) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (res.status !== 429) return
    const retryAfter = Number(res.headers.get("retry-after") ?? "1")
    await sleep(Math.min(Math.max(retryAfter, 1), 8) * 1000)
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  })
}

type TelegramUser = { id: number; username?: string; first_name?: string; last_name?: string }
type TelegramUpdate = {
  message?: {
    chat: { id: number }
    text?: string
    from?: TelegramUser
    new_chat_members?: TelegramUser[]
  }
  chat_member?: {
    chat: { id: number }
    new_chat_member: { status: string; user: TelegramUser }
  }
}

type SalesFunnelRow = {
  id: string
  name: string
  mode: SalesFunnel["mode"]
  status: SalesFunnel["status"]
  updated_at: string
  nodes: SalesFunnel["nodes"]
  edges: SalesFunnel["edges"]
  production: SalesFunnel["production"]
}

type LeadRow = {
  id: string
  name: string
  contact: string
  channel: Lead["channel"]
  campaign: string
  origin: Lead["origin"]
  start_payload?: string | null
  temperature: Lead["temperature"]
  stage: Lead["stage"]
  print_at?: string | null
  banca_at?: string | null
  memory?: string
  last_message?: string | null
  funnel_id?: string | null
  node_id?: string | null
  wait_until?: string | null
  paused?: boolean
  messages?: Lead["messages"]
  ste_phase?: Lead["stePhase"] | null
  ste_blocked?: boolean
  telegram_chat_id?: string | null
  updated_at: string
  created_at: string
}
