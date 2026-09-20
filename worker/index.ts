import { clientIp, consumeKvThrottle, consumeMemoryThrottle, handleAuth, isOwner, kvAuthStore, randomToken, requestHasAuth, sessionUser } from "./auth.ts"
import { handleMcp, handleFunnelImport } from "./mcp.ts"
import { handleTokens, handleUsers } from "./users.ts"
import { campaignFor } from "../src/lib/labels.ts"
import { advanceSteIfDue, isSteWait, replySte, replySteSmart, safeHttpUrl, steRuntimeFromFunnels, toTelegramHtml, type SteBeat } from "../src/lib/ste.ts"
import { linkFollowUp, voiceClipFor } from "../src/lib/ste-voice.ts"
import { TRACKER_JS } from "../src/lib/tracker-script.ts"
import { campaignFromStart, originFromStart, parseTelegramStart, scriptIdFromStart, visitorIdFromStart } from "../src/lib/telegram-start.ts"
import { applyEvent, canAdvanceRemoteWait, dueWaits, pickLiveDueLead, snapshotForLead } from "../src/lib/runtime.ts"
import { pageInstallManual, pageScriptById } from "../src/lib/page-script.ts"
import { firstInvalidPublishUrl, validatePublish } from "../src/lib/validate.ts"
import { BANCA_FIXED, type Lead, type LeadEvent, type LeadOrigin, type SalesFunnel, type Settings } from "../src/lib/types.ts"
import { compactGeo, factsFromGeo } from "../src/lib/geo.ts"
import { parseDevice } from "../src/lib/track.ts"
import {
  adoptDueLeads,
  adoptLeadStores,
  adoptOperatorLead,
  commitStoredLead,
  applyRemovedFunnels,
  applyRemovedLeads,
  clipRemovedIds,
  enforceSinglePublished,
  emptySettings,
  mergeLeadEvents,
  publicSettings,
  FUNNEL_CAP,
  resolveLeadLookup,
} from "../src/lib/crm.ts"
import { cleanBotUsername, migrateSettings, sanitizeIncomingFunnel, sanitizeIncomingLead } from "../src/lib/migrate.ts"
import { isResolvedPersonName, preferLeadName, resolvePersonName } from "../src/lib/lead-name.ts"
import { resolveClientGeo } from "./geo-lookup.ts"
import { kvTrackStore, memoryTrackStore, readTrackBody, recordTrack, summaryFromStore, type TrackStore } from "./track-store.ts"
import {
  deleteLeadKv,
  dueLeadsKv,
  filterLiveLeads,
  findLeadInKv,
  lookupLeadsByQuery,
  isLeadPageCursor,
  listLeadPage,
  loadLead,
  CRM_SETTINGS,
  claimCronLock,
  renewCronLock,
  loadFunnelsKv,
  loadRemovedFunnelIds,
  loadRemovedLeadIds,
  loadSettingsKv,
  releaseCronLock,
  persistFunnelsMerge,
  persistSettingsMerge,
  isLeadRemoved,
  rememberSentLead,
  reserveLeadIdentity,
  resolveLeadWrite,
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
import { readJsonObject, readJsonStrict, type JsonFail } from "./json-body.ts"
import { claimTelegramUpdate, forgetTelegramUpdate, telegramCall } from "./telegram.ts"
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

export type WorkerContext = ExecutionContext & { flush(): Promise<void> }

export function backgroundCtx(): WorkerContext {
  const pending: Promise<unknown>[] = []
  return {
    waitUntil(promise: Promise<unknown>) {
      pending.push(Promise.resolve(promise).catch(() => undefined))
    },
    passThroughOnException() {},
    async flush() {
      await Promise.all(pending.splice(0))
    },
  } as WorkerContext
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
    try {
      await processWaits(env)
    } catch {
      console.error("cron falhou")
    }
  },
}

export async function handleRequest(request: Request, env: Env, ctx: ExecutionContext) {
  try {
    return await routeRequest(request, env, ctx)
  } catch {
    return withSecurityHeaders(
      new Response(JSON.stringify({ error: "Falha interna." }), {
        status: 500,
        headers: { "content-type": "application/json", "cache-control": "no-store" },
      })
    )
  }
}

async function routeRequest(request: Request, env: Env, ctx: ExecutionContext) {
  const url = new URL(request.url)
  if (url.pathname === "/t.js") {
    return withSecurityHeaders(
      new Response(TRACKER_JS, {
        headers: {
          "content-type": "text/javascript; charset=utf-8",
          "access-control-allow-origin": "*",
          "cache-control": "public, max-age=60",
          "x-content-type-options": "nosniff",
        },
      })
    )
  }
  if (url.pathname === "/mcp" || url.pathname === "/api/mcp") {
    return withSecurityHeaders(await handleMcpRoute(request, env))
  }
  if (url.pathname.startsWith("/api/")) {
    return withSecurityHeaders(await handleApi(request, env, url, ctx))
  }
  return withSecurityHeaders(await env.ASSETS.fetch(request))
}

async function handleMcpRoute(request: Request, env: Env) {
  if (request.method === "GET") return handleMcp(request, env, null)
  if (!env.AUTH) return json({ error: "Auth ainda sem KV." }, 503)
  const ip = clientIp(request)
  if (request.method === "POST") {
    if (!(await consumeKvThrottle(env.AUTH, `mcp:ip:${ip}`, 120, 60_000))) {
      return json({ error: "Demasiados pedidos MCP. Espera um pouco." }, 429)
    }
    if (!requestHasAuth(request)) {
      if (!(await consumeKvThrottle(env.AUTH, `mcp:anon:${ip}`, 20, 60_000))) {
        return json({ error: "Demasiados pedidos MCP. Espera um pouco." }, 429)
      }
      return handleMcp(request, env, null)
    }
  }
  const actor = await sessionUser(request, kvAuthStore(env.AUTH))
  if (request.method === "POST" && actor) {
    if (!(await consumeKvThrottle(env.AUTH, `mcp:${actor.id}:${ip}`, 60, 60_000))) {
      return json({ error: "Demasiados pedidos MCP. Espera um pouco." }, 429)
    }
  }
  return handleMcp(request, env, actor)
}

async function handleApi(request: Request, env: Env, url: URL, ctx: ExecutionContext) {
  if (url.pathname === "/api/health") {
    const { resolved } = await runtimeOf(env, webhookUrl(request, env))
    const settings = await loadSettings(env)
    return json({
      ok: true,
      telegramBotUsername: cleanBotUsername(resolved.telegramBotUsername || settings.telegramBotUsername),
    })
  }

  if (url.pathname === "/api/install" && request.method === "GET") {
    const { resolved } = await runtimeOf(env, webhookUrl(request, env))
    const settings = await loadSettings(env)
    const scriptId = (url.searchParams.get("s") || "").trim().toLowerCase()
    const script = pageScriptById(settings.pageScripts, scriptId)
    const funnel = script ? (await loadFunnels(env)).find((item) => item.id === script.funnelId) : undefined
    return json(
      pageInstallManual({
        botUsername: cleanBotUsername(resolved.telegramBotUsername || settings.telegramBotUsername),
        script,
        funnelName: funnel?.name,
      })
    )
  }

  if (url.pathname.startsWith("/api/auth")) {
    if (!env.AUTH) return json({ error: "Auth ainda sem KV." }, 503)
    return handleAuth(request, kvAuthStore(env.AUTH), env)
  }

  if (url.pathname === "/api/users" || url.pathname === "/api/tokens") {
    if (!env.AUTH) return json({ error: "Auth ainda sem KV." }, 503)
    const actor = await sessionUser(request, kvAuthStore(env.AUTH))
    if (!actor) return json({ error: "Sessão expirada." }, 401)
    if (
      request.method !== "GET" &&
      !(await consumeKvThrottle(env.AUTH, `users:${actor.id}:${clientIp(request)}`, 30, 60_000))
    ) {
      return json({ error: "Demasiados pedidos às contas. Espera um pouco." }, 429)
    }
    if (url.pathname === "/api/users") return handleUsers(request, kvAuthStore(env.AUTH), actor)
    return handleTokens(request, kvAuthStore(env.AUTH), actor)
  }

  if (url.pathname === "/api/funnels/import" && request.method === "POST") {
    if (!env.AUTH) return json({ error: "Auth ainda sem KV." }, 503)
    const user = await sessionUser(request, kvAuthStore(env.AUTH))
    if (!user) return json({ error: "Sessão expirada." }, 401)
    if (!(await consumeKvThrottle(env.AUTH, `funnels:${user.id}:${clientIp(request)}`, 20, 60_000))) {
      return json({ error: "Demasiados pedidos de importação. Espera um pouco." }, 429)
    }
    return handleFunnelImport(request, env)
  }

  if (url.pathname === "/api/track" && request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() })
  }

  if (url.pathname === "/api/track" && request.method === "POST") {
    const trackKey = `track:${clientIp(request)}`
    const allowed = env.AUTH
      ? await consumeKvThrottle(env.AUTH, trackKey, 60, 60_000)
      : consumeMemoryThrottle(trackKey, 60, 60_000)
    if (!allowed) {
      return new Response(null, { status: 429, headers: corsHeaders() })
    }
    const parsedTrack = await readTrackBody(request)
    if (!parsedTrack.ok) return new Response(null, { status: parsedTrack.status, headers: corsHeaders() })
    const body = parsedTrack.value
    const geo = await resolveClientGeo(request, typeof body.timezone === "string" ? body.timezone : undefined, {
      country: typeof body.country === "string" ? body.country : undefined,
      countryCode: typeof body.countryCode === "string" ? body.countryCode : undefined,
      city: typeof body.city === "string" ? body.city : undefined,
      region: typeof body.region === "string" ? body.region : undefined,
      regionCode: typeof body.regionCode === "string" ? body.regionCode : undefined,
    })
    const store = trackStore(env)
    const last = await recordTrack(
      store,
      {
        ...body,
        ...compactGeo(geo),
        visitorId: String(body.visitorId ?? ""),
        device: parseDevice(request.headers.get("user-agent") || ""),
      },
      Date.now()
    )
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
    if (!isOwner(user)) return json({ error: "Só o dono gera a voz da Sté." }, 403)
    if (!(await consumeKvThrottle(env.AUTH, `voice:${user.id}:${clientIp(request)}`, 5, 15 * 60_000))) {
      return json({ error: "Demasiados pedidos de voz. Espera um pouco." }, 429)
    }
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
    if (!isOwner(user)) return json({ error: "Só o dono liga o bot e as chaves." }, 403)
    if (!(await consumeKvThrottle(env.AUTH, `runtime:${user.id}:${clientIp(request)}`, 10, 15 * 60_000))) {
      return json({ error: "Demasiados pedidos ao runtime. Espera um pouco." }, 429)
    }
    const parsed = await readJsonObject<RuntimeSecrets>(request, 16_384)
    if (!parsed.ok) return jsonReadError(parsed)
    const body = parsed.value
    const current = await loadSecrets(env.AUTH)
    const next = mergeSecrets(current, body)
    const hook = webhookUrl(request, env)
    const webhookSecret = (env.TELEGRAM_WEBHOOK_SECRET || next.telegramWebhookSecret || randomToken()).trim()
    if (!env.TELEGRAM_WEBHOOK_SECRET) next.telegramWebhookSecret = webhookSecret
    let warning: string | undefined
    if (next.telegramBotToken && next.telegramBotToken !== current.telegramBotToken) {
      const hooked = await setTelegramWebhook(next.telegramBotToken, hook, webhookSecret)
      if (!hooked.ok && /unauthorized/i.test(hooked.description)) {
        return json({ error: "Token do Telegram recusado." }, 400)
      }
      next.webhookUrl = hook
      next.webhookOk = hooked.ok
      if (!hooked.ok) warning = "O token ficou gravado. O webhook ainda não apontou — tenta Vincular outra vez."
    } else if (next.telegramBotToken && !next.webhookOk) {
      const hooked = await setTelegramWebhook(next.telegramBotToken, hook, webhookSecret)
      next.webhookUrl = hook
      next.webhookOk = hooked.ok
      if (!hooked.ok) warning = "O token ficou gravado. O webhook ainda não apontou — tenta Vincular outra vez."
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
    const published = await publishedRuntime(env, resolveRuntime(env, next, hook))
    return json(warning ? { ...published, warning } : published)
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
    if (!(await consumeKvThrottle(env.AUTH, `crm:${user.id}:${clientIp(request)}`, 80, 60_000))) {
      return json({ error: "Demasiados pedidos ao CRM. Espera um pouco." }, 429)
    }
    const parsed = await readJsonObject<{ funnels?: SalesFunnel[]; settings?: Settings; removedFunnelIds?: string[] }>(request, 256_000)
    if (!parsed.ok) return jsonReadError(parsed)
    const body = parsed.value
    if (Array.isArray(body.funnels)) {
      const rawFunnels = body.funnels
      const incoming = rawFunnels.map(sanitizeIncomingFunnel).filter((item): item is NonNullable<typeof item> => Boolean(item))
      const incomingRemoved = clipRemovedIds(body.removedFunnelIds, 400)
      const stored = await loadFunnels(env)
      for (const funnel of incoming) {
        if (funnel.status !== "active" || !funnel.production) continue
        const raw = rawFunnels.find((item) => item && typeof item === "object" && "id" in item && item.id === funnel.id) as
          | { production?: { nodes?: unknown } }
          | undefined
        const issue =
          firstInvalidPublishUrl(raw?.production?.nodes ?? funnel.production.nodes) ??
          validatePublish(funnel.production.nodes, funnel.production.edges)[0]
        if (!issue) continue
        const prev = stored.find((item) => item.id === funnel.id)
        if (prev?.production?.publishedAt && prev.production.publishedAt === funnel.production.publishedAt) {
          funnel.production = prev.production
          continue
        }
        return json({ error: issue.message }, 400)
      }
      try {
        await persistFunnels(env, incoming, incomingRemoved)
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "Não gravei os funis." }, 400)
      }
    }
    if (body.settings) await persistSettings(env, body.settings)
    return json({ ok: true })
  }

  if (url.pathname === "/api/leads" && request.method === "GET") {
    if (!env.AUTH) return json({ error: "Auth ainda sem KV." }, 503)
    const user = await sessionUser(request, kvAuthStore(env.AUTH))
    if (!user) return json({ error: "Sessão expirada." }, 401)
    const query = (url.searchParams.get("q") || "").trim()
    if (query) {
      if (query.length > 80) return json({ error: "Busca inválida." }, 400)
      const found = await lookupLeadsByQuery(env.AUTH, query)
      const leads = await attachLeadEvents(env, await filterLiveLeads(env.AUTH, found))
      return json({ ok: true, leads })
    }
    const cursor = (url.searchParams.get("cursor") || "").trim()
    if (cursor && !isLeadPageCursor(cursor)) return json({ error: "Cursor inválido." }, 400)
    const page = await loadMergedLeads(env, 400, "all", cursor)
    return json({
      ok: true,
      leads: page.leads,
      nextCursor: page.stale ? undefined : page.nextCursor,
      stale: page.stale || undefined,
      clipped: page.clipped || undefined,
      removed: cursor ? undefined : await loadRemovedLeadIds(env.AUTH),
    })
  }

  if (url.pathname === "/api/leads" && request.method === "POST") {
    if (!env.AUTH) return json({ error: "Auth ainda sem KV." }, 503)
    const user = await sessionUser(request, kvAuthStore(env.AUTH))
    if (!user) return json({ error: "Sessão expirada." }, 401)
    if (!(await consumeKvThrottle(env.AUTH, `leads:${user.id}:${clientIp(request)}`, 40, 60_000))) {
      return json({ error: "Demasiados pedidos de leads. Espera um pouco." }, 429)
    }
    const parsed = await readJsonObject<{ lead?: Lead; leads?: Lead[] }>(request, 256_000)
    if (!parsed.ok) return jsonReadError(parsed)
    const body = parsed.value
    const rows = (body.leads?.length ? body.leads : body.lead ? [body.lead] : []).slice(0, 120)
    const ids: string[] = []
    const adopted: Record<string, string> = {}
    for (const row of rows) {
      const lead = sanitizeIncomingLead(row)
      if (!lead) continue
      const { incoming, prev } = await resolveLeadWrite(env.AUTH, lead)
      if ((await isLeadRemoved(env.AUTH, incoming.id)) || (await isLeadRemoved(env.AUTH, lead.id))) continue
      const next = adoptOperatorLead(prev, incoming)
      if (!(await saveLead(env, next))) continue
      ids.push(next.id)
      if (lead.id !== next.id) adopted[lead.id] = next.id
    }
    return json({ ok: true, saved: ids.length, ids, adopted })
  }

  if (url.pathname === "/api/leads" && request.method === "DELETE") {
    if (!env.AUTH) return json({ error: "Auth ainda sem KV." }, 503)
    const user = await sessionUser(request, kvAuthStore(env.AUTH))
    if (!user) return json({ error: "Sessão expirada." }, 401)
    if (!(await consumeKvThrottle(env.AUTH, `leads-del:${user.id}:${clientIp(request)}`, 30, 60_000))) {
      return json({ error: "Demasiados pedidos de exclusão. Espera um pouco." }, 429)
    }
    const id = (url.searchParams.get("id") || "").trim()
    if (!id || id.length > 80) return json({ error: "Falta o id do lead." }, 400)
    await removeLead(env, id)
    return json({ ok: true })
  }

  if (url.pathname === "/api/inbox" && request.method === "GET") {
    if (!env.AUTH) return json({ error: "Auth ainda sem KV." }, 503)
    const user = await sessionUser(request, kvAuthStore(env.AUTH))
    if (!user) return json({ error: "Sessão expirada." }, 401)
    const cursor = (url.searchParams.get("cursor") || "").trim()
    if (cursor && !isLeadPageCursor(cursor)) return json({ error: "Cursor inválido." }, 400)
    const page = await loadMergedLeads(env, 400, "telegram", cursor)
    return json({
      ok: true,
      leads: page.leads,
      nextCursor: page.stale ? undefined : page.nextCursor,
      stale: page.stale || undefined,
      clipped: page.clipped || undefined,
    })
  }

  if (url.pathname === "/api/telegram" && request.method === "POST") {
    const { secrets } = await runtimeOf(env)
    const expected = (env.TELEGRAM_WEBHOOK_SECRET || secrets.telegramWebhookSecret || "").trim()
    const header = request.headers.get("x-telegram-bot-api-secret-token") || ""
    if (!expected || header !== expected) return json({ ok: false }, 401)
    const parsed = await readJsonStrict(request, 65_536)
    if (!parsed.ok) return json({ ok: false }, parsed.status)
    const update = parsed.value as TelegramUpdate
    ctx.waitUntil(handleTelegram(env, update))
    return json({ ok: true })
  }

  if (url.pathname === "/api/cron") {
    const secret = url.searchParams.get("secret") ?? request.headers.get("x-cron-secret")
    if (!env.CRON_SECRET || secret !== env.CRON_SECRET) return json({ ok: false }, 401)
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
  try {
    await runTelegram(env, update)
  } catch {
    console.error("telegram update falhou", typeof update.update_id === "number" ? update.update_id : "")
  }
}

async function runTelegram(env: Env, update: TelegramUpdate) {
  const { resolved } = await runtimeOf(env)
  if (!resolved.telegramBotToken) return
  const updateId = typeof update.update_id === "number" && update.update_id > 0 ? update.update_id : 0
  const kv = kvOf(env)
  if (updateId && kv && !(await claimTelegramUpdate(kv, updateId))) return
  let sent = false
  try {
    sent = (await deliverTelegram(env, update, resolved.telegramBotToken)).sent
  } catch (error) {
    if (updateId && kv && !sent) await forgetTelegramUpdate(kv, updateId)
    throw error
  }
}

async function deliverTelegram(env: Env, update: TelegramUpdate, token: string): Promise<{ sent: boolean }> {
  const { resolved } = await runtimeOf(env)
  const joinUser = update.message?.new_chat_members?.[0] ?? (update.chat_member?.new_chat_member?.status === "member" ? update.chat_member.new_chat_member.user : undefined)
  const message = update.message
  const from = joinUser ?? message?.from
  if (!from) return { sent: false }

  const contact = from.username ? `@${from.username}` : `tg:${from.id}`
  const telegramName = resolvePersonName([from.first_name, from.last_name].filter(Boolean).join(" "))
  const name = isResolvedPersonName(telegramName) ? telegramName : contact
  const chatId = String(message?.chat.id ?? update.chat_member?.chat.id ?? from.id)
  const start = parseTelegramStart(joinUser ? "" : message?.text)
  const origin: LeadOrigin = joinUser ? "group_join" : start.isStart ? originFromStart(start.payload) : "private"
  const campaign = joinUser ? campaignFor("telegram") : start.isStart ? campaignFromStart(start.payload) : campaignFor("telegram", origin)
  const now = new Date().toISOString()

  const reservedId = env.AUTH ? await reserveLeadIdentity(env.AUTH, contact, chatId, crypto.randomUUID()) : crypto.randomUUID()
  const existing = (await findLead(env, contact, from.id, chatId)) ?? (env.AUTH ? await loadLead(env.AUTH, reservedId) : null)
  const visitorId = start.isStart ? visitorIdFromStart(start.payload) : undefined
  let lead: Lead
  if (existing) {
    lead = existing
    if (isResolvedPersonName(telegramName)) {
      lead.name = preferLeadName(lead.name, telegramName, contact, { email: lead.facts?.email, messages: lead.messages })
    }
    if (start.isStart && start.payload) {
      lead.origin = origin
      lead.campaign = campaign
      lead.startPayload = start.payload
      if (visitorId) lead.visitorId = visitorId
    }
  } else {
    lead = {
      id: reservedId,
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
    const last = await recordTrack(trackStore(env), { kind: "telegram", visitorId, path: "/telegram", utmCampaign: campaign }, Date.now())
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
  if (start.isStart && start.payload) {
    const script = pageScriptById(settings.pageScripts, scriptIdFromStart(start.payload))
    if (script) {
      lead.funnelId = script.funnelId
      lead.campaign = `Facebook · ${script.name}`.slice(0, 120)
    }
  }
  const ste = steRuntimeFromFunnels(funnels, settings, lead.funnelId)
  const shouldTalk = ste.talking !== false && !joinUser
  const pending = lead
  let delivered = !shouldTalk
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
    const sent = await sendSteReplies(env, token, chatId, talked.replies, talked.beat)
    if (sent.ok) {
      lead = talked.lead
      delivered = true
    } else {
      lead = pending
    }
  }

  if (delivered) {
    if (!(await persistLeadAfterSend(env, lead))) console.error("telegram lead após envio não gravou")
  } else {
    await saveLead(env, lead)
    const updateId = typeof update.update_id === "number" && update.update_id > 0 ? update.update_id : 0
    if (updateId && env.AUTH) await forgetTelegramUpdate(env.AUTH, updateId)
  }
  return { sent: delivered }
}

async function processWaits(env: Env) {
  const lockOwner = env.AUTH ? await claimCronLock(env.AUTH) : "local"
  if (!lockOwner) return 0
  if (env.AUTH && lockOwner !== "local" && !(await renewCronLock(env.AUTH, lockOwner))) return 0
  try {
    const now = new Date().toISOString()
    const restRows = (await rest<LeadRow[]>(env, `leads?workspace_id=eq.${WORKSPACE}&wait_until=lte.${now}&select=*`)) ?? []
    const kvDue = env.AUTH ? await dueLeadsKv(env.AUTH, now) : []
    const removed = env.AUTH ? await loadRemovedLeadIds(env.AUTH) : []
    const adopted = adoptDueLeads(kvDue, restRows.map(rowToLead), removed)
    const liveDue = env.AUTH ? await filterLiveLeads(env.AUTH, adopted) : adopted
    const byId = new Map(liveDue.map((lead) => [lead.id, lead]))
    if (!byId.size) return 0
    const funnels = await loadFunnels(env)
    const settings = await loadSettings(env)
    const { resolved } = await runtimeOf(env)
    const token = resolved.telegramBotToken
    const due = dueWaits([...byId.values()])
    let advanced = 0
    for (const queued of due) {
      try {
        if (env.AUTH && lockOwner !== "local" && !(await renewCronLock(env.AUTH, lockOwner))) break
        const live = env.AUTH ? await loadLead(env.AUTH, queued.id) : queued
        const lead = pickLiveDueLead(queued, live)
        if (!lead) continue
        if (!canAdvanceRemoteWait(lead, Boolean(token))) continue
        const snapshot = snapshotForLead(funnels, lead)
        const ste = steRuntimeFromFunnels(funnels, settings, lead.funnelId)
        if (isSteWait(lead)) {
          const talked = advanceSteIfDue(lead, Date.now(), ste)
          if (!talked.replies.length && talked.lead.waitUntil === lead.waitUntil) continue
          if (!(await saveLead(env, talked.lead))) continue
          if (token && lead.telegramChatId && talked.replies.length) {
            const sent = await sendSteReplies(env, token, lead.telegramChatId, talked.replies, talked.beat)
            if (!sent.ok) {
              await restoreQueuedLead(env, lead)
              continue
            }
          }
        } else {
          const result = applyEvent(snapshot, lead, { type: "timer" }, Date.now())
          if (!(await saveLead(env, result.lead))) continue
          let telegramNeeded = false
          let telegramOk = false
          for (const effect of result.effects) {
            if ((effect.kind === "offer" || effect.kind === "send_message") && token && lead.telegramChatId) {
              telegramNeeded = true
              const sent = await sendTelegramMarkup(token, lead.telegramChatId, effect.body || "", effect.url)
              if (sent.ok) telegramOk = true
            }
            if (effect.kind === "notify_ester" && token) {
              await notifyEster(env, token, effect.body)
            }
          }
          if (telegramNeeded && !telegramOk) {
            await restoreQueuedLead(env, lead)
            continue
          }
        }
        advanced += 1
      } catch {
        console.error("cron lead falhou")
        continue
      }
    }
    return advanced
  } finally {
    if (env.AUTH) await releaseCronLock(env.AUTH, lockOwner)
  }
}

async function notifyEster(env: Env, token: string, body: string) {
  const chat = env.ESTER_CHAT_ID
  if (!chat) return
  await sendTelegramMarkup(token, chat, body || BANCA_FIXED)
}

async function persistFunnels(env: Env, incoming: SalesFunnel[], incomingRemoved: string[] = []) {
  const clean = env.AUTH
    ? await persistFunnelsMerge(env.AUTH, incoming, incomingRemoved)
    : enforceSinglePublished(
        incoming.map(sanitizeIncomingFunnel).filter((item): item is SalesFunnel => Boolean(item))
      )
  if (!env.AUTH && clean.length > FUNNEL_CAP) throw new Error(`O estúdio aceita no máximo ${FUNNEL_CAP} funis.`)
  if (!env.SUPABASE_SERVICE_ROLE) return
  if (clean.length) {
    await rest(env, "funnels", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(
        clean.map((funnel) => ({
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
  const rows = (await rest<{ id: string }[]>(env, `funnels?workspace_id=eq.${WORKSPACE}&select=id`)) ?? []
  const keep = new Set(clean.map((item) => item.id))
  for (const row of rows.filter((item) => item.id && !keep.has(item.id)).slice(0, 40)) {
    await rest(env, `funnels?id=eq.${encodeURIComponent(row.id)}&workspace_id=eq.${WORKSPACE}`, { method: "DELETE" })
  }
}

async function persistSettings(env: Env, settings: Settings) {
  const incoming = migrateSettings(settings)
  let clean = incoming
  if (env.AUTH) {
    clean = await persistSettingsMerge(env.AUTH, incoming)
  }
  if (!env.SUPABASE_SERVICE_ROLE) return
  await rest(env, "settings", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ workspace_id: WORKSPACE, data: publicSettings(clean) }),
  })
}

async function loadFunnels(env: Env): Promise<SalesFunnel[]> {
  const kv = env.AUTH ? await loadFunnelsKv(env.AUTH) : []
  const rows = kv.length
    ? kv
    : ((await rest<SalesFunnelRow[]>(env, `funnels?workspace_id=eq.${WORKSPACE}`)) ?? [])
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
  if (!env.AUTH) return rows
  return applyRemovedFunnels(rows, await loadRemovedFunnelIds(env.AUTH))
}

async function loadSettings(env: Env): Promise<Settings> {
  const settingsRow = await rest<{ data: Settings }[]>(env, `settings?workspace_id=eq.${WORKSPACE}`)
  const remote = settingsRow?.[0]?.data ? migrateSettings(settingsRow[0].data) : undefined
  if (env.AUTH) {
    const raw = await env.AUTH.get(CRM_SETTINGS, "json")
    if (raw && typeof raw === "object") return loadSettingsKv(env.AUTH)
  }
  if (remote) return remote
  if (env.AUTH) return loadSettingsKv(env.AUTH)
  return emptySettings()
}

async function findLead(env: Env, contact: string, telegramId: number, chatId: string): Promise<Lead | null> {
  const kvLead = env.AUTH ? await findLeadInKv(env.AUTH, contact, telegramId, chatId) : null
  if (kvLead) {
    if (env.AUTH && (await isLeadRemoved(env.AUTH, kvLead.id))) return null
    return kvLead
  }
  const filter = [
    `contact.eq.${quote(contact)}`,
    `contact.eq.${quote(`tg:${telegramId}`)}`,
    `telegram_chat_id.eq.${quote(chatId)}`,
  ].join(",")
  const rows = (await rest<LeadRow[]>(env, `leads?workspace_id=eq.${WORKSPACE}&or=(${filter})&select=*&limit=1`)) ?? []
  if (!rows[0]) return null
  const hydratedId = rows[0].id
  if (env.AUTH && hydratedId && (await isLeadRemoved(env.AUTH, hydratedId))) return null
  const removed = env.AUTH ? await loadRemovedLeadIds(env.AUTH) : []
  const [hydrated] = await attachLeadEvents(env, [rowToLead(rows[0])])
  return resolveLeadLookup(null, hydrated, removed)
}

function quote(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
}

async function attachLeadEvents(env: Env, leads: Lead[]): Promise<Lead[]> {
  if (!leads.length) return leads
  const ids = [...new Set(leads.map((lead) => lead.id).filter(Boolean))]
  const rows: LeadEventRow[] = []
  for (let i = 0; i < ids.length; i += 50) {
    const slice = ids.slice(i, i + 50)
    const batch =
      (await rest<LeadEventRow[]>(
        env,
        `lead_events?lead_id=in.(${slice.map(quote).join(",")})&select=*&order=at.asc`
      )) ?? []
    rows.push(...batch)
  }
  if (!rows.length) return leads
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
  return leads.map((lead) => {
    const events = byLead.get(lead.id)
    if (!events?.length) return lead
    return { ...lead, events: mergeLeadEvents(lead.events, events) }
  })
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

async function loadMergedLeads(env: Env, limit: number, channel: "telegram" | "all", cursor = "") {
  const page = env.AUTH ? await listLeadPage(env.AUTH, limit, channel, cursor) : { leads: [] as Lead[], clipped: false }
  const kv = page.leads
  const filter = channel === "telegram" ? "&channel=eq.telegram" : ""
  const rows =
    (await rest<LeadRow[]>(
      env,
      `leads?workspace_id=eq.${WORKSPACE}${filter}&select=*&order=updated_at.desc&limit=${limit}`
    )) ?? []
  const removed = env.AUTH ? await loadRemovedLeadIds(env.AUTH) : []
  const remote = applyRemovedLeads(rows.map(rowToLead), removed)
  const keep = new Set(kv.map((lead) => lead.id))
  const scoped = kv.length || cursor ? remote.filter((lead) => keep.has(lead.id)) : remote
  const live = env.AUTH ? await filterLiveLeads(env.AUTH, scoped) : scoped
  return {
    leads: adoptLeadStores(kv, await attachLeadEvents(env, live)).slice(0, limit),
    nextCursor: page.stale ? undefined : page.nextCursor,
    stale: page.stale,
    clipped: page.clipped === true,
  }
}

async function removeLead(env: Env, id: string) {
  if (env.AUTH) await deleteLeadKv(env.AUTH, id)
  if (!env.SUPABASE_SERVICE_ROLE) return
  for (let attempt = 0; attempt < 4; attempt++) {
    const leadGone = await rest(env, `leads?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${WORKSPACE}`, { method: "DELETE" })
    const eventsGone = await rest(env, `lead_events?lead_id=eq.${encodeURIComponent(id)}`, { method: "DELETE" })
    if (leadGone !== null && eventsGone !== null) return
    if (attempt < 3) await sleep(40 * (attempt + 1))
  }
  console.error("supabase delete incompleto")
}

async function persistLeadAfterSend(env: Env, lead: Lead) {
  if (env.AUTH) {
    try {
      await rememberSentLead(env.AUTH, lead)
    } catch {
      /* ainda tentamos o crm:lead */
    }
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      if (await saveLead(env, lead)) return true
    } catch {
      /* o Telegram já entregou — o crm:sent segura o estado */
    }
    if (attempt < 3) await sleep(40 * (attempt + 1))
  }
  return false
}

async function restoreQueuedLead(env: Env, lead: Lead) {
  return saveLead(env, { ...lead, updatedAt: new Date().toISOString() }, { replace: true })
}

async function saveLead(env: Env, lead: Lead, opts?: { replace?: boolean }) {
  let bounded = sanitizeIncomingLead(lead)
  if (!bounded) return false
  if (env.AUTH) {
    if (await isLeadRemoved(env.AUTH, bounded.id)) return false
    if (!opts?.replace) {
      const prev = await loadLead(env.AUTH, bounded.id)
      bounded = commitStoredLead(prev, bounded)
      const latest = await loadLead(env.AUTH, bounded.id)
      bounded = commitStoredLead(prev, bounded, latest)
    }
    if (!(await upsertLeadKv(env.AUTH, bounded))) return false
  }
  if (!env.SUPABASE_SERVICE_ROLE) return true
  await rest(env, "leads", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      id: bounded.id,
      workspace_id: WORKSPACE,
      name: bounded.name,
      contact: bounded.contact,
      channel: bounded.channel,
      campaign: bounded.campaign,
      origin: bounded.origin,
      start_payload: bounded.startPayload ?? null,
      visitor_id: bounded.visitorId ?? null,
      temperature: bounded.temperature,
      stage: bounded.stage,
      print_at: bounded.printAt ?? null,
      banca_at: bounded.bancaAt ?? null,
      memory: bounded.memory,
      facts: bounded.facts ?? {},
      last_message: bounded.lastMessage ?? null,
      funnel_id: bounded.funnelId ?? null,
      node_id: bounded.nodeId ?? null,
      wait_until: bounded.waitUntil ?? null,
      paused: bounded.paused ?? false,
      messages: bounded.messages ?? [],
      ste_phase: bounded.stePhase ?? null,
      ste_blocked: bounded.steBlocked ?? false,
      ste_quiet: bounded.steQuiet ?? false,
      telegram_chat_id: bounded.telegramChatId ?? null,
      updated_at: bounded.updatedAt,
      created_at: bounded.createdAt,
    }),
  })
  if (bounded.events.length) {
    await rest(env, "lead_events", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(
        bounded.events.map((event: LeadEvent) => ({
          id: event.id,
          lead_id: bounded.id,
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
  return true
}

async function rest<T>(env: Env, path: string, init?: RequestInit): Promise<T | null> {
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

async function sendSteReplies(env: Env, token: string, chatId: string, replies: string[], beat?: SteBeat) {
  if (!replies.length) return { ok: true }
  let delivered = false
  const clip = beat ? voiceClipFor(beat.kind) : null
  const kv = kvOf(env)
  if (clip && kv) {
    const { resolved } = await runtimeOf(env)
    if (resolved.voice) {
      try {
        const stored = await ensureVoiceClip(kv, clip, resolved.elevenApiKey, resolved.elevenVoiceId)
        const fileId = await sendStoredVoice(token, chatId, stored)
        if (fileId) {
          delivered = true
          if (fileId !== stored.fileId) await rememberVoiceFile(kv, clip.id, fileId)
          const links = linkFollowUp(replies)
          if (links) await sendTelegramMarkup(token, chatId, links)
          return { ok: true }
        }
      } catch {
        /* cai no texto */
      }
    }
  }
  for (const [index, text] of replies.entries()) {
    const sent = await sendTelegramMarkup(token, chatId, text)
    if (sent.ok) delivered = true
    else return { ok: delivered }
    if (index < replies.length - 1) await sleep(280)
  }
  return { ok: true }
}

async function sendTelegramMarkup(token: string, chatId: string, text: string, extraUrl?: string) {
  const href = extraUrl ? safeHttpUrl(extraUrl) : null
  const body = href && !text.includes(href) ? `${text.trim()}\n[abrir](${href})` : text
  return telegram(token, "sendMessage", {
    chat_id: chatId,
    text: toTelegramHtml(body || "Oferta do produto"),
    parse_mode: "HTML",
    disable_web_page_preview: true,
  })
}

async function telegram(token: string, method: string, body: Record<string, unknown>) {
  return telegramCall(token, method, body)
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

function securityHeaders() {
  return {
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-frame-options": "DENY",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
    "content-security-policy":
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    "strict-transport-security": "max-age=31536000; includeSubDomains",
  }
}

function jsonReadError(parsed: JsonFail) {
  return json({ error: parsed.status === 413 ? "Pedido demasiado grande." : "JSON inválido." }, parsed.status)
}

function withSecurityHeaders(response: Response) {
  const next = new Headers(response.headers)
  for (const [key, value] of Object.entries(securityHeaders())) {
    if (!next.has(key)) next.set(key, value)
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: next })
}

function json(data: unknown, status = 200, extra?: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...securityHeaders(), ...extra },
  })
}

type TelegramUser = { id: number; username?: string; first_name?: string; last_name?: string }
type TelegramUpdate = {
  update_id?: number
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
