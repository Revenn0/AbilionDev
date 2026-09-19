import { handleAuth, kvAuthStore, sessionUser } from "./auth.ts"
import { campaignFor } from "../src/lib/labels.ts"
import { advanceSteIfDue, isSteWait, replySte, replySteSmart, steRuntimeFromFunnels, toTelegramHtml, type SteBeat } from "../src/lib/ste.ts"
import { linkFollowUp, voiceClipFor } from "../src/lib/ste-voice.ts"
import { TRACKER_JS } from "../src/lib/tracker-script.ts"
import { campaignFromStart, originFromStart, parseTelegramStart, visitorIdFromStart } from "../src/lib/telegram-start.ts"
import { applyEvent, dueWaits, publishedSnapshot } from "../src/lib/runtime.ts"
import { BANCA_FIXED, type Lead, type LeadEvent, type LeadOrigin, type SalesFunnel, type Settings } from "../src/lib/types.ts"
import { compactGeo, factsFromGeo } from "../src/lib/geo.ts"
import { parseDevice } from "../src/lib/track.ts"
import { emptySettings, publicSettings } from "../src/lib/crm.ts"
import { migrateSettings } from "../src/lib/migrate.ts"
import { resolveClientGeo } from "./geo-lookup.ts"
import { ingestTrack, kvTrackStore, memoryTrackStore, readTrackBody, summaryFromStore, type TrackStore } from "./track-store.ts"
import {
  dueLeadsKv,
  findLeadInKv,
  listLeads,
  loadFunnelsKv,
  loadSettingsKv,
  saveFunnelsKv,
  saveSettingsKv,
  upsertLeadKv,
} from "./crm-store.ts"
import {
  loadSecrets,
  mergeSecrets,
  publicRuntime,
  resolveRuntime,
  saveSecrets,
  setTelegramWebhook,
  type RuntimeSecrets,
} from "./runtime-secrets.ts"
import { ensureVoiceClip, loadVoiceStore, prepareVoiceClips, rememberVoiceFile, sendStoredVoice, voiceClipStatus } from "./ste-voice.ts"
import type { KvLike } from "./kv.ts"

type Fetcher = { fetch(input: Request | URL | string, init?: RequestInit): Promise<Response> }
type KVNamespace = KvLike
type ExecutionContext = {
  waitUntil(promise: Promise<unknown>): void
  passThroughOnException(): void
}
type ScheduledEvent = { cron?: string }

export interface Env {
  ASSETS: Fetcher
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE?: string
  TELEGRAM_BOT_TOKEN?: string
  TELEGRAM_WEBHOOK_SECRET?: string
  CRON_SECRET?: string
  ESTER_CHAT_ID?: string
  APP_URL?: string
  OPENAI_API_KEY?: string
  OPENCODE_API_KEY?: string
  OPENAI_BASE_URL?: string
  OPENCODE_BASE_URL?: string
  ELEVENLABS_API_KEY?: string
  ELEVENLABS_VOICE_ID?: string
  STE_MODEL?: string
  STE_FALLBACK_MODEL?: string
  STE_USE_LLM?: string
  AUTH?: KVNamespace
  ABILION_OPERATOR_PASSWORD?: string
  ABILION_ENV?: string
}

const WORKSPACE = "local"
const memoryTracks = memoryTrackStore()

function trackStore(env: Env): TrackStore {
  return env.AUTH ? kvTrackStore(env.AUTH) : memoryTracks
}

function kvOf(env: Env): KvLike | null {
  return env.AUTH ?? null
}

export function backgroundCtx(): ExecutionContext {
  return {
    waitUntil(promise: Promise<unknown>) {
      void promise
    },
    passThroughOnException() {},
  } as ExecutionContext
}

async function runtimeOf(env: Env, webhookFallback = "") {
  const secrets = kvOf(env) ? await loadSecrets(kvOf(env)!) : {}
  return { secrets, resolved: resolveRuntime(env, secrets, webhookFallback) }
}

async function publishedRuntime(env: Env, resolved: ReturnType<typeof resolveRuntime>) {
  const store = kvOf(env) ? await loadVoiceStore(kvOf(env)!) : {}
  return publicRuntime(resolved, voiceClipStatus(store, resolved.elevenVoiceId))
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return handleRequest(request, env, ctx)
  },
  async scheduled(_event: ScheduledEvent, env: Env) {
    await processWaits(env)
  },
}

export async function handleRequest(request: Request, env: Env, ctx: ExecutionContext) {
  const url = new URL(request.url)
  if (url.pathname === "/t.js") {
    return new Response(TRACKER_JS, {
      headers: {
        "content-type": "text/javascript; charset=utf-8",
        "access-control-allow-origin": "*",
        "cache-control": "public, max-age=300",
      },
    })
  }
  if (url.pathname.startsWith("/api/")) {
    return handleApi(request, env, url, ctx)
  }
  return env.ASSETS.fetch(request)
}

async function handleApi(request: Request, env: Env, url: URL, ctx: ExecutionContext) {
  if (url.pathname === "/api/health") {
    const { resolved } = await runtimeOf(env, webhookUrl(request, env))
    return json({
      ok: true,
      telegram: resolved.telegram,
      supabase: resolved.supabase,
      ste: true,
      llm: resolved.llm,
      model: resolved.model,
      backup: resolved.fallbackModel,
      auth: Boolean(env.AUTH),
      persist: resolved.persist,
      voice: resolved.voice,
    })
  }

  if (url.pathname.startsWith("/api/auth")) {
    if (!env.AUTH) return json({ error: "Auth ainda sem KV." }, 503)
    return handleAuth(request, kvAuthStore(env.AUTH), env)
  }

  if (url.pathname === "/api/track" && request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() })
  }

  if (url.pathname === "/api/track" && request.method === "POST") {
    const body = await readTrackBody(request)
    const geo = await resolveClientGeo(request, typeof body.timezone === "string" ? body.timezone : undefined, {
      country: typeof body.country === "string" ? body.country : undefined,
      countryCode: typeof body.countryCode === "string" ? body.countryCode : undefined,
      city: typeof body.city === "string" ? body.city : undefined,
      region: typeof body.region === "string" ? body.region : undefined,
      regionCode: typeof body.regionCode === "string" ? body.regionCode : undefined,
    })
    const store = trackStore(env)
    const events = ingestTrack(
      await store.load(),
      {
        ...body,
        ...compactGeo(geo),
        visitorId: String(body.visitorId ?? ""),
        device: parseDevice(request.headers.get("user-agent") || ""),
      },
      Date.now()
    )
    await store.save(events)
    const last = events.at(-1)
    if (last && env.SUPABASE_SERVICE_ROLE) {
      await rest(env, "page_events", {
        method: "POST",
        body: JSON.stringify({
          id: last.id,
          workspace_id: WORKSPACE,
          visitor_id: last.visitorId,
          kind: last.kind,
          path: last.path,
          referrer: last.referrer,
          campaign: last.campaign,
          country: last.country,
          city: last.city,
          region: last.region,
          device: last.device,
          language: last.language,
          at: last.at,
        }),
      })
    }
    return new Response(null, { status: 204, headers: corsHeaders() })
  }

  if (url.pathname === "/api/track/summary" && request.method === "GET") {
    if (!env.AUTH) return json({ error: "Auth ainda sem KV." }, 503)
    const user = await sessionUser(request, kvAuthStore(env.AUTH))
    if (!user) return json({ error: "Sessão expirada." }, 401)
    return json({ ok: true, summary: await summaryFromStore(trackStore(env)) })
  }

  if (url.pathname === "/api/runtime" && request.method === "GET") {
    if (!env.AUTH) return json({ error: "Auth ainda sem KV." }, 503)
    const user = await sessionUser(request, kvAuthStore(env.AUTH))
    if (!user) return json({ error: "Sessão expirada." }, 401)
    const hook = webhookUrl(request, env)
    const { resolved } = await runtimeOf(env, hook)
    return json(await publishedRuntime(env, { ...resolved, webhookUrl: resolved.webhookUrl || hook }))
  }

  if (url.pathname === "/api/runtime/voice" && request.method === "POST") {
    if (!env.AUTH) return json({ error: "Auth ainda sem KV." }, 503)
    const user = await sessionUser(request, kvAuthStore(env.AUTH))
    if (!user) return json({ error: "Sessão expirada." }, 401)
    const { resolved } = await runtimeOf(env, webhookUrl(request, env))
    if (!resolved.elevenApiKey || !resolved.elevenVoiceId) {
      return json({ error: "Falta a chave da ElevenLabs e o voice id da Sté." }, 400)
    }
    const clips = await prepareVoiceClips(env.AUTH, resolved.elevenApiKey, resolved.elevenVoiceId)
    if (!clips.some((item) => item.ready)) {
      return json({ error: "A ElevenLabs não gerou os áudios. Confere a chave e o voice id." }, 400)
    }
    return json(await publishedRuntime(env, resolved))
  }

  if (url.pathname === "/api/runtime" && request.method === "POST") {
    if (!env.AUTH) return json({ error: "Auth ainda sem KV." }, 503)
    const user = await sessionUser(request, kvAuthStore(env.AUTH))
    if (!user) return json({ error: "Sessão expirada." }, 401)
    const body = (await request.json().catch(() => ({}))) as RuntimeSecrets
    const current = await loadSecrets(env.AUTH)
    const next = mergeSecrets(current, body)
    const hook = webhookUrl(request, env)
    if (next.telegramBotToken && next.telegramBotToken !== current.telegramBotToken) {
      const hooked = await setTelegramWebhook(next.telegramBotToken, hook, env.TELEGRAM_WEBHOOK_SECRET)
      if (!hooked.ok && /unauthorized/i.test(hooked.description)) {
        return json({ error: "Token do Telegram recusado." }, 400)
      }
      next.webhookUrl = hook
      next.webhookOk = hooked.ok
      if (!hooked.ok) {
        await saveSecrets(env.AUTH, next)
        return json({ error: hooked.description || "Webhook do Telegram falhou.", ...(await publishedRuntime(env, resolveRuntime(env, next, hook))) }, 400)
      }
    } else if (next.telegramBotToken && !next.webhookOk) {
      const hooked = await setTelegramWebhook(next.telegramBotToken, hook, env.TELEGRAM_WEBHOOK_SECRET)
      next.webhookUrl = hook
      next.webhookOk = hooked.ok
    }
    await saveSecrets(env.AUTH, next)
    const settings = await loadSettings(env)
    await persistSettings(env, {
      ...settings,
      telegramBotUsername: next.telegramBotUsername || settings.telegramBotUsername,
      telegramGroupUrl: next.telegramGroupUrl || settings.telegramGroupUrl,
      telegramBotToken: "",
      steLinkedTelegram: settings.steLinkedTelegram !== false,
      plugins: { ...settings.plugins, telegram: Boolean(next.telegramBotToken) },
    })
    return json(await publishedRuntime(env, resolveRuntime(env, next, hook)))
  }

  if (url.pathname === "/api/crm" && request.method === "GET") {
    if (!env.AUTH) return json({ error: "Auth ainda sem KV." }, 503)
    const user = await sessionUser(request, kvAuthStore(env.AUTH))
    if (!user) return json({ error: "Sessão expirada." }, 401)
    return json({
      ok: true,
      funnels: await loadFunnels(env),
      settings: publicSettings(await loadSettings(env)),
    })
  }

  if (url.pathname === "/api/crm" && request.method === "POST") {
    if (!env.AUTH) return json({ error: "Auth ainda sem KV." }, 503)
    const user = await sessionUser(request, kvAuthStore(env.AUTH))
    if (!user) return json({ error: "Sessão expirada." }, 401)
    const body = (await request.json().catch(() => ({}))) as { funnels?: SalesFunnel[]; settings?: Settings }
    if (Array.isArray(body.funnels)) await persistFunnels(env, body.funnels)
    if (body.settings) await persistSettings(env, migrateSettings(body.settings))
    return json({ ok: true })
  }

  if (url.pathname === "/api/inbox" && request.method === "GET") {
    if (!env.AUTH) return json({ error: "Auth ainda sem KV." }, 503)
    const user = await sessionUser(request, kvAuthStore(env.AUTH))
    if (!user) return json({ error: "Sessão expirada." }, 401)
    const rows =
      (await rest<LeadRow[]>(
        env,
        `leads?workspace_id=eq.${WORKSPACE}&channel=eq.telegram&select=*&order=updated_at.desc&limit=80`
      )) ?? []
    const leads = rows.length ? rows.map(rowToLead) : env.AUTH ? await listLeads(env.AUTH) : []
    return json({ ok: true, leads })
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

  if (url.pathname === "/api/cron") {
    const secret = url.searchParams.get("secret") ?? request.headers.get("x-cron-secret")
    if (env.CRON_SECRET && secret !== env.CRON_SECRET) return json({ ok: false }, 401)
    const count = await processWaits(env)
    return json({ ok: true, advanced: count })
  }

  return json({ ok: false, error: "not_found" }, 404)
}

function webhookUrl(request: Request, env: Env) {
  const origin = (env.APP_URL || new URL(request.url).origin).replace(/\/$/, "")
  return `${origin}/api/telegram`
}

async function handleTelegram(env: Env, update: TelegramUpdate) {
  const { resolved } = await runtimeOf(env)
  const token = resolved.telegramBotToken
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
  const visitorId = start.isStart ? visitorIdFromStart(start.payload) : undefined
  let lead: Lead
  if (existing) {
    lead = existing
    if (start.isStart && start.payload) {
      lead.origin = origin
      lead.campaign = campaign
      lead.startPayload = start.payload
      if (visitorId) lead.visitorId = visitorId
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
      visitorId,
      temperature: "novo",
      stage: origin === "group_join" ? "group" : "welcome",
      memory: "",
      facts: {},
      events: [],
      messages: [],
      createdAt: now,
      updatedAt: now,
    }
  }

  lead.telegramChatId = chatId
  if (visitorId && start.isStart) {
    const store = trackStore(env)
    const events = ingestTrack(await store.load(), { kind: "telegram", visitorId, path: "/telegram", utmCampaign: campaign }, Date.now())
    await store.save(events)
    const last = events.at(-1)
    if (last?.country || last?.region || last?.regionCode) {
      lead.facts = {
        ...lead.facts,
        ...factsFromGeo({
          country: last.country,
          countryCode: last.countryCode,
          city: last.city,
          region: last.region,
          regionCode: last.regionCode,
        }),
        device: last.device,
      }
    }
  }

  const incoming = joinUser || start.isStart ? null : (message?.text ?? null)
  const funnels = await loadFunnels(env)
  const settings = await loadSettings(env)
  const ste = steRuntimeFromFunnels(funnels, settings)
  const shouldTalk = ste.talking !== false && !joinUser
  if (shouldTalk) {
    const talked = incoming?.trim()
      ? await replySteSmart(lead, incoming, {
          apiKey: resolved.openaiApiKey || undefined,
          openRouterKey: resolved.openaiApiKey || undefined,
          openCodeKey: resolved.opencodeApiKey || undefined,
          model: resolved.opencodeApiKey ? resolved.fallbackModel : resolved.model,
          fallbackModel: resolved.opencodeApiKey ? undefined : resolved.fallbackModel,
          runtime: ste,
        })
      : replySte(lead, incoming, Date.now(), ste)
    lead = talked.lead
    await sendSteReplies(env, token, chatId, talked.replies, talked.beat)
  }

  await saveLead(env, lead)
}

async function processWaits(env: Env) {
  const now = new Date().toISOString()
  const restRows = (await rest<LeadRow[]>(env, `leads?workspace_id=eq.${WORKSPACE}&wait_until=lte.${now}&select=*`)) ?? []
  const kvDue = env.AUTH ? await dueLeadsKv(env.AUTH, now) : []
  const byId = new Map<string, Lead>()
  for (const row of restRows) byId.set(row.id, rowToLead(row))
  for (const lead of kvDue) byId.set(lead.id, lead)
  if (!byId.size) return 0
  const funnels = await loadFunnels(env)
  const settings = await loadSettings(env)
  const snapshot = publishedSnapshot(funnels)
  const ste = steRuntimeFromFunnels(funnels, settings)
  const { resolved } = await runtimeOf(env)
  const token = resolved.telegramBotToken
  const due = dueWaits([...byId.values()])
  for (const lead of due) {
    if (isSteWait(lead)) {
      const talked = advanceSteIfDue(lead, Date.now(), ste)
      if (token && lead.telegramChatId) await sendSteReplies(env, token, lead.telegramChatId, talked.replies, talked.beat)
      await saveLead(env, talked.lead)
      continue
    }
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

async function persistFunnels(env: Env, funnels: SalesFunnel[]) {
  if (env.AUTH) await saveFunnelsKv(env.AUTH, funnels)
}

async function persistSettings(env: Env, settings: Settings) {
  if (env.AUTH) await saveSettingsKv(env.AUTH, settings)
}

async function loadFunnels(env: Env): Promise<SalesFunnel[]> {
  const rows = (await rest<SalesFunnelRow[]>(env, `funnels?workspace_id=eq.${WORKSPACE}`)) ?? []
  if (rows.length) {
    return rows.map((row) => ({
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
  return env.AUTH ? loadFunnelsKv(env.AUTH) : []
}

async function loadSettings(env: Env): Promise<Settings> {
  const settingsRow = await rest<{ data: Settings }[]>(env, `settings?workspace_id=eq.${WORKSPACE}`)
  if (settingsRow?.[0]?.data) return migrateSettings(settingsRow[0].data)
  if (env.AUTH) return loadSettingsKv(env.AUTH)
  return emptySettings()
}

async function findLead(env: Env, contact: string, telegramId: number, chatId: string): Promise<Lead | null> {
  const filter = [
    `contact.eq.${quote(contact)}`,
    `contact.eq.${quote(`tg:${telegramId}`)}`,
    `telegram_chat_id.eq.${quote(chatId)}`,
  ].join(",")
  const rows = (await rest<LeadRow[]>(env, `leads?workspace_id=eq.${WORKSPACE}&or=(${filter})&select=*&limit=1`)) ?? []
  if (rows[0]) return rowToLead(rows[0])
  return env.AUTH ? findLeadInKv(env.AUTH, contact, telegramId, chatId) : null
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
    visitorId: row.visitor_id ?? undefined,
    temperature: row.temperature,
    stage: row.stage,
    printAt: row.print_at ?? undefined,
    bancaAt: row.banca_at ?? undefined,
    memory: row.memory ?? "",
    facts: row.facts ?? {},
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
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  }
}

async function saveLead(env: Env, lead: Lead) {
  if (env.AUTH) await upsertLeadKv(env.AUTH, lead)
  if (!env.SUPABASE_SERVICE_ROLE) return
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
    await rest(env, "lead_events", {
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

async function sendSteReplies(env: Env, token: string, chatId: string, replies: string[], beat?: SteBeat) {
  const clip = beat ? voiceClipFor(beat.kind) : null
  const kv = kvOf(env)
  if (clip && kv) {
    const { resolved } = await runtimeOf(env)
    if (resolved.voice) {
      try {
        const stored = await ensureVoiceClip(kv, clip, resolved.elevenApiKey, resolved.elevenVoiceId)
        const fileId = await sendStoredVoice(token, chatId, stored)
        if (fileId) {
          if (fileId !== stored.fileId) await rememberVoiceFile(kv, clip.id, fileId)
          const links = linkFollowUp(replies)
          if (links) {
            await telegram(token, "sendMessage", {
              chat_id: chatId,
              text: toTelegramHtml(links),
              parse_mode: "HTML",
              disable_web_page_preview: true,
            })
          }
          return
        }
      } catch {
        /* cai no texto */
      }
    }
  }
  for (const [index, text] of replies.entries()) {
    await telegram(token, "sendMessage", {
      chat_id: chatId,
      text: toTelegramHtml(text),
      parse_mode: "HTML",
      disable_web_page_preview: true,
    })
    if (index < replies.length - 1) await sleep(280)
  }
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

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders() },
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
  visitor_id?: string | null
  temperature: Lead["temperature"]
  stage: Lead["stage"]
  print_at?: string | null
  banca_at?: string | null
  memory?: string
  facts?: Lead["facts"]
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
