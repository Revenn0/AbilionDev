import { clientIp, confirmKvThrottle, consumeKvThrottle, consumeMemoryThrottle, gateActor, handleAuth, isOwner, kvAuthStore, randomToken, requestHasAuth, sessionUser } from "./auth.ts"
import { handleMcp, handleFunnelImport } from "./mcp.ts"
import { handleTokens, handleUsers } from "./users.ts"
import { campaignFor } from "../src/lib/labels.ts"
import { advanceSteIfDue, isSteWait, rememberLeadTalk, replySte, replySteSmart, safeHttpUrl, steRuntimeFromFunnels, toTelegramHtml, type SteBeat } from "../src/lib/ste.ts"
import { linkFollowUp, voiceClipFor } from "../src/lib/ste-voice.ts"
import { TRACKER_JS } from "../src/lib/tracker-script.ts"
import { campaignFromStart, originFromStart, parseTelegramStart, scriptIdFromStart, visitorIdFromStart } from "../src/lib/telegram-start.ts"
import { applyEvent, canAdvanceRemoteWait, dueWaits, leadFunnelUnread, pickLiveDueLead, snapshotForLead } from "../src/lib/runtime.ts"
import { leadCategoriesMutationBlocked } from "../src/lib/lead-category.ts"
import { adsLandingDocument, installSettingsBlocked, pageInstallManual, pageScriptById, pageScriptsMutationBlocked } from "../src/lib/page-script.ts"
import { authForgotDocument, authLoginDocument, authPrivacyDocument, authResetDocument } from "../src/lib/auth-pages.ts"
import { foldPublicPath, foldStudioPath, safeAppPath } from "../src/lib/safe-path.ts"
import { firstInvalidPublishUrl, validatePublish } from "../src/lib/validate.ts"
import { BANCA_FIXED, type Lead, type LeadOrigin, type SalesFunnel, type Settings } from "../src/lib/types.ts"
import { compactGeo, factsFromGeo } from "../src/lib/geo.ts"
import { parseDevice, summarizeTrack } from "../src/lib/track.ts"
import {
  adoptDueLeads,
  adoptLeadStores,
  adoptOperatorLead,
  commitStoredLead,
  restoreLeadAfterFailedSend,
  applyRemovedLeads,
  clipRemovedIds,
  enforceSinglePublished,
  emptySettings,
  linkRuntimeSettings,
  publicSettings,
  FUNNEL_CAP,
} from "../src/lib/crm.ts"
import { cleanBotUsername, migrateSettings, sanitizeIncomingFunnel, sanitizeIncomingLead } from "../src/lib/migrate.ts"
import { isResolvedPersonName, preferLeadName, resolvePersonName } from "../src/lib/lead-name.ts"
import { resolveClientGeo } from "./geo-lookup.ts"
import { kvTrackStore, memoryTrackStore, readTrackBody, recordTrack, type TrackStore } from "./track-store.ts"
import {
  deleteLeadKv,
  dueLeadsKv,
  filterLiveLeads,
  isLeadPageCursor,
  leadPageFromRemote,
  listLeadPage,
  loadLead,
  claimCronLock,
  renewCronLock,
  loadRemovedLeadIds,
  releaseCronLock,
  persistFunnelsMerge,
  persistSettingsMerge,
  isLeadRemoved,
  leadRemovedForRead,
  removedIdsForRead,
  rememberSentLead,
  reserveLeadIdentity,
  upsertLeadKv,
} from "./crm-store.ts"
import {
  emptySecrets,
  loadSecrets,
  mergeSecrets,
  publicRuntime,
  resolveRuntime,
  saveSecrets,
  setTelegramWebhook,
  type ResolvedRuntime,
  type RuntimeSecrets,
} from "./runtime-secrets.ts"
import { ensureVoiceClip, loadVoiceStore, prepareVoiceClips, rememberVoiceFile, sendStoredVoice, voiceClipStatus } from "./ste-voice.ts"
import { readJsonObject, readJsonStrict, type JsonFail } from "./json-body.ts"
import { claimTelegramUpdate, forgetTelegramUpdate, telegramCall, telegramJoinActor, telegramUpdateActor } from "./telegram.ts"
import { attachWorkspaceLeadEvents, fetchRemoteDueLeads, fetchRemoteLeadPage, fetchRemoteLeadsByIds, fetchRemotePageEvents, fillLeadHoles, findWorkspaceLead, hydrateWorkspaceLead, leadCatalogUnread, loadWorkspaceSettings, persistRemoteFunnels, persistRemoteLead, persistRemoteSettings, readWorkspaceFunnels, readWorkspaceSettings, resolveWorkspaceLeadWrite, rowToLead, searchWorkspaceLeads, summarizeWorkspaceTrack, type LeadRow } from "./workspace-settings.ts"
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

/** Público: secrets unread não apagam username/scripts leftover das settings. */
async function publicWorkspaceBot(env: Env, webhookFallback = "") {
  let resolved = resolveRuntime(env, emptySecrets(), webhookFallback)
  try {
    resolved = (await runtimeOf(env, webhookFallback)).resolved
  } catch {
    /* secrets unread — leftover settings ainda contam */
  }
  let settings = emptySettings()
  let settingsUnread = true
  try {
    const loaded = await readWorkspaceSettings(env)
    settings = loaded.settings
    settingsUnread = loaded.unread
  } catch {
    /* settings unread */
  }
  const telegramBotUsername = cleanBotUsername(resolved.telegramBotUsername || settings.telegramBotUsername)
  return { resolved, settings, telegramBotUsername, settingsUnread }
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
  const path = foldPublicPath(url.pathname)
  if (path === "/t.js") {
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
  if (path === "/l" && (request.method === "GET" || request.method === "HEAD")) {
    const scriptId = url.searchParams.get("s") || ""
    let html = adsLandingDocument({ scriptId })
    try {
      const { telegramBotUsername, settingsUnread } = await publicWorkspaceBot(env, webhookUrl(request, env))
      html = adsLandingDocument({
        botUsername: telegramBotUsername,
        scriptId,
        unread: settingsUnread && !telegramBotUsername,
      })
    } catch {
      html = adsLandingDocument({ scriptId, unread: true })
    }
    return withSecurityHeaders(
      new Response(request.method === "HEAD" ? null : html, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "public, max-age=30",
        },
      })
    )
  }
  if (path === "/login" && (request.method === "GET" || request.method === "HEAD")) {
    const next = url.searchParams.get("next")
    if (env.AUTH) {
      const user = await sessionUser(request, kvAuthStore(env.AUTH))
      if (user) {
        return withSecurityHeaders(new Response(null, { status: 303, headers: { location: safeAppPath(next), "cache-control": "no-store" } }))
      }
    }
    return withSecurityHeaders(
      new Response(request.method === "HEAD" ? null : authLoginDocument({ next }), {
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
      })
    )
  }
  if (path === "/forgot" && (request.method === "GET" || request.method === "HEAD")) {
    return withSecurityHeaders(
      new Response(request.method === "HEAD" ? null : authForgotDocument({ next: url.searchParams.get("next") }), {
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
      })
    )
  }
  if (path === "/reset" && (request.method === "GET" || request.method === "HEAD")) {
    return withSecurityHeaders(
      new Response(
        request.method === "HEAD"
          ? null
          : authResetDocument({ token: url.searchParams.get("token"), next: url.searchParams.get("next") }),
        {
          headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
        }
      )
    )
  }
  if (path === "/privacidade" && (request.method === "GET" || request.method === "HEAD")) {
    return withSecurityHeaders(
      new Response(request.method === "HEAD" ? null : authPrivacyDocument(), {
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" },
      })
    )
  }
  if (path === "/mcp" || path === "/api/mcp") {
    return withSecurityHeaders(await handleMcpRoute(request, env))
  }
  if (path.startsWith("/api/")) {
    const apiUrl = new URL(request.url)
    apiUrl.pathname = path
    return withSecurityHeaders(await handleApi(request, env, apiUrl, ctx))
  }
  if (request.method === "GET" || request.method === "HEAD") {
    const dest = foldStudioPath(url.pathname)
    if (dest) {
      return withSecurityHeaders(
        new Response(null, {
          status: 303,
          headers: { location: `${dest}${url.search}`, "cache-control": "no-store" },
        })
      )
    }
  }
  return withSecurityHeaders(await env.ASSETS.fetch(request))
}

const THROTTLE_UNREAD = "Não confirmei o limite de pedidos."

async function gateKvThrottle(
  kv: NonNullable<Env["AUTH"]>,
  key: string,
  limit: number,
  windowMs: number,
  denied: string
) {
  const hit = await confirmKvThrottle(kv, key, limit, windowMs)
  if (hit.unread) return json({ error: THROTTLE_UNREAD }, 503)
  if (!hit.allowed) return json({ error: denied }, 429)
  return null
}

async function handleMcpRoute(request: Request, env: Env) {
  if (request.method === "GET") return handleMcp(request, env, null)
  if (!env.AUTH) return json({ error: "Auth ainda sem KV." }, 503)
  const ip = clientIp(request)
  if (request.method === "POST") {
    const ipLimit = await gateKvThrottle(env.AUTH, `mcp:ip:${ip}`, 120, 60_000, "Demasiados pedidos MCP. Espera um pouco.")
    if (ipLimit) return ipLimit
    if (!requestHasAuth(request)) {
      const anonLimit = await gateKvThrottle(env.AUTH, `mcp:anon:${ip}`, 20, 60_000, "Demasiados pedidos MCP. Espera um pouco.")
      if (anonLimit) return anonLimit
      return handleMcp(request, env, null)
    }
  }
  const gate = await gateActor(request, kvAuthStore(env.AUTH))
  if (!gate.ok) return gate.response
  if (request.method === "POST") {
    const userLimit = await gateKvThrottle(
      env.AUTH,
      `mcp:${gate.user.id}:${ip}`,
      60,
      60_000,
      "Demasiados pedidos MCP. Espera um pouco."
    )
    if (userLimit) return userLimit
  }
  return handleMcp(request, env, gate.user)
}

async function handleApi(request: Request, env: Env, url: URL, ctx: ExecutionContext) {
  if (url.pathname === "/api/health") {
    try {
      const { telegramBotUsername, settingsUnread } = await publicWorkspaceBot(env, webhookUrl(request, env))
      return json({
        ok: true,
        telegramBotUsername,
        telegramBotUnread: settingsUnread && !telegramBotUsername ? true : undefined,
      })
    } catch {
      return json({ ok: true, telegramBotUsername: "", telegramBotUnread: true })
    }
  }

  if (url.pathname === "/api/install" && request.method === "GET") {
    const scriptId = (url.searchParams.get("s") || "").trim().toLowerCase()
    try {
      const { settings, telegramBotUsername, settingsUnread } = await publicWorkspaceBot(env, webhookUrl(request, env))
      const script = pageScriptById(settings.pageScripts, scriptId)
      if (installSettingsBlocked(settingsUnread, scriptId, script)) {
        return json({ error: "Não confirmei o script desta página." }, 503)
      }
      let funnelName: string | undefined
      if (script) {
        try {
          const boards = await readWorkspaceFunnels(env)
          const named = boards.funnels.find((item) => item.id === script.funnelId)
          if (!named && boards.unread) return json({ error: "Não confirmei o funil deste script." }, 503)
          funnelName = named?.name
        } catch {
          return json({ error: "Não confirmei o funil deste script." }, 503)
        }
      }
      return json(
        pageInstallManual({
          botUsername: telegramBotUsername,
          script,
          funnelName,
        })
      )
    } catch {
      if (installSettingsBlocked(true, scriptId, undefined)) {
        return json({ error: "Não confirmei o script desta página." }, 503)
      }
      return json(pageInstallManual({ botUsername: "" }))
    }
  }

  if (url.pathname.startsWith("/api/auth")) {
    if (!env.AUTH) return json({ error: "Auth ainda sem KV." }, 503)
    return handleAuth(request, kvAuthStore(env.AUTH), env)
  }

  if (url.pathname === "/api/users" || url.pathname === "/api/tokens") {
    const gated = await requireStudioUser(request, env)
    if (!gated.ok) return gated.response
    if (!env.AUTH) return json({ error: "Auth ainda sem KV." }, 503)
    const actor = gated.user
    if (request.method !== "GET") {
      const limited = await gateKvThrottle(
        env.AUTH,
        `users:${actor.id}:${clientIp(request)}`,
        30,
        60_000,
        "Demasiados pedidos às contas. Espera um pouco."
      )
      if (limited) return limited
    }
    if (url.pathname === "/api/users") return handleUsers(request, kvAuthStore(env.AUTH), actor)
    return handleTokens(request, kvAuthStore(env.AUTH), actor)
  }

  if (url.pathname === "/api/funnels/import" && request.method === "POST") {
    const gate = await requireStudioUser(request, env)
    if (!gate.ok) return gate.response
    if (!env.AUTH) return json({ error: "Auth ainda sem KV." }, 503)
    const user = gate.user
    const limited = await gateKvThrottle(
      env.AUTH,
      `funnels:${user.id}:${clientIp(request)}`,
      20,
      60_000,
      "Demasiados pedidos de importação. Espera um pouco."
    )
    if (limited) return limited
    return handleFunnelImport(request, env)
  }

  if (url.pathname === "/api/track" && request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() })
  }

  if (url.pathname === "/api/track" && request.method === "POST") {
    const trackKey = `track:${clientIp(request)}`
    if (env.AUTH) {
      const hit = await confirmKvThrottle(env.AUTH, trackKey, 60, 60_000)
      if (hit.unread) return new Response(null, { status: 503, headers: corsHeaders() })
      if (!hit.allowed) return new Response(null, { status: 429, headers: corsHeaders() })
    } else if (!consumeMemoryThrottle(trackKey, 60, 60_000)) {
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
    let last
    try {
      last = await recordTrack(
        store,
        {
          ...body,
          ...compactGeo(geo),
          visitorId: String(body.visitorId ?? ""),
          device: parseDevice(request.headers.get("user-agent") || ""),
        },
        Date.now()
      )
    } catch {
      return new Response(null, { status: 503, headers: corsHeaders() })
    }
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
    const gate = await requireStudioUser(request, env)
    if (!gate.ok) return gate.response
    if (!env.AUTH) return json({ error: "Auth ainda sem KV." }, 503)
    let kvEvents
    try {
      kvEvents = await trackStore(env).load()
    } catch {
      const remote = await fetchRemotePageEvents(env)
      if (!remote?.length) return json({ error: "Não confirmei os eventos do pixel." }, 503)
      return json({ ok: true, summary: summarizeTrack(remote), trackUnread: true })
    }
    const result = await summarizeWorkspaceTrack(env, kvEvents)
    if (!result.ok) return json({ error: "Não li os eventos do Postgres." }, 503)
    return json({ ok: true, summary: result.summary, trackUnread: result.unread || undefined })
  }

  if (url.pathname === "/api/runtime" && request.method === "GET") {
    const gate = await requireStudioUser(request, env)
    if (!gate.ok) return gate.response
    if (!env.AUTH) return json({ error: "Auth ainda sem KV." }, 503)
    const hook = webhookUrl(request, env)
    const { resolved, settings, telegramBotUsername, settingsUnread } = await publicWorkspaceBot(env, hook)
    const wired = { ...resolved, webhookUrl: resolved.webhookUrl || hook }
    let published
    try {
      published = await publishedRuntime(env, wired)
    } catch {
      published = publicRuntime(wired)
    }
    return json({
      ...published,
      telegramBotUsername,
      telegramGroupUrl: resolved.telegramGroupUrl || settings.telegramGroupUrl,
      settingsUnread: settingsUnread || undefined,
    })
  }

  if (url.pathname === "/api/runtime/voice" && request.method === "POST") {
    const gate = await requireStudioUser(request, env)
    if (!gate.ok) return gate.response
    if (!env.AUTH) return json({ error: "Auth ainda sem KV." }, 503)
    const user = gate.user
    if (!isOwner(user)) return json({ error: "Só o dono gera a voz da Sté." }, 403)
    let allowed: boolean
    try {
      allowed = await consumeKvThrottle(env.AUTH, `voice:${user.id}:${clientIp(request)}`, 5, 15 * 60_000)
    } catch {
      return json({ error: "Não confirmei as chaves do Worker." }, 503)
    }
    if (!allowed) {
      return json({ error: "Demasiados pedidos de voz. Espera um pouco." }, 429)
    }
    let resolved
    try {
      resolved = (await runtimeOf(env, webhookUrl(request, env))).resolved
    } catch {
      return json({ error: "Não confirmei as chaves do Worker." }, 503)
    }
    if (!resolved.elevenApiKey || !resolved.elevenVoiceId) {
      return json({ error: "Falta a chave da ElevenLabs e o voice id da Sté." }, 400)
    }
    try {
      await loadVoiceStore(env.AUTH)
    } catch {
      return json({ error: "Não confirmei a voz do Worker." }, 503)
    }
    const clips = await prepareVoiceClips(env.AUTH, resolved.elevenApiKey, resolved.elevenVoiceId)
    if (!clips.some((item) => item.ready)) {
      return json({ error: "A ElevenLabs não gerou os áudios. Confere a chave e o voice id." }, 400)
    }
    return json(publicRuntime(resolved, clips))
  }

  if (url.pathname === "/api/runtime" && request.method === "POST") {
    const gate = await requireStudioUser(request, env)
    if (!gate.ok) return gate.response
    if (!env.AUTH) return json({ error: "Auth ainda sem KV." }, 503)
    const user = gate.user
    if (!isOwner(user)) return json({ error: "Só o dono liga o bot e as chaves." }, 403)
    let allowed: boolean
    try {
      allowed = await consumeKvThrottle(env.AUTH, `runtime:${user.id}:${clientIp(request)}`, 10, 15 * 60_000)
    } catch {
      return json({ error: "Não confirmei as chaves do Worker." }, 503)
    }
    if (!allowed) {
      return json({ error: "Demasiados pedidos ao runtime. Espera um pouco." }, 429)
    }
    const parsed = await readJsonObject<RuntimeSecrets>(request, 16_384)
    if (!parsed.ok) return jsonReadError(parsed)
    const body = parsed.value
    let current: RuntimeSecrets
    try {
      current = await loadSecrets(env.AUTH)
    } catch {
      return json({ error: "Não confirmei as chaves do Worker." }, 503)
    }
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
    try {
      await saveSecrets(env.AUTH, next)
    } catch {
      return json({ error: "Não confirmei as chaves do Worker." }, 503)
    }
    const settings = await loadSettings(env).then(
      (item) => item,
      () => null
    )
    const linked = linkRuntimeSettings(settings, next)
    if (linked) {
      try {
        await persistSettings(env, linked)
      } catch {
        /* chaves já gravadas — settings unread não vira 500 */
      }
    }
    const resolved = resolveRuntime(env, next, hook)
    let published
    try {
      published = await publishedRuntime(env, resolved)
    } catch {
      published = publicRuntime(resolved)
    }
    return json(warning ? { ...published, warning } : published)
  }

  if (url.pathname === "/api/crm" && request.method === "GET") {
    const gate = await requireStudioUser(request, env)
    if (!gate.ok) return gate.response
    if (!env.AUTH) return json({ error: "Auth ainda sem KV." }, 503)
    let boards: { funnels: SalesFunnel[]; unread: boolean } | null = null
    let loaded: { settings: Settings; unread: boolean } | null = null
    try {
      boards = await readWorkspaceFunnels(env)
    } catch {
      boards = null
    }
    try {
      loaded = await readWorkspaceSettings(env)
    } catch {
      loaded = null
    }
    if (!boards) return json({ error: "Não li o CRM do Worker." }, 503)
    return json({
      ok: true,
      funnels: boards.funnels,
      ...(loaded ? { settings: publicSettings(loaded.settings) } : {}),
      settingsUnread: !loaded || loaded.unread || undefined,
      funnelsUnread: boards.unread || undefined,
    })
  }

  if (url.pathname === "/api/crm" && request.method === "POST") {
    const gate = await requireStudioUser(request, env)
    if (!gate.ok) return gate.response
    if (!env.AUTH) return json({ error: "Auth ainda sem KV." }, 503)
    const user = gate.user
    const limited = await gateKvThrottle(
      env.AUTH,
      `crm:${user.id}:${clientIp(request)}`,
      80,
      60_000,
      "Demasiados pedidos ao CRM. Espera um pouco."
    )
    if (limited) return limited
    const parsed = await readJsonObject<{ funnels?: SalesFunnel[]; settings?: Settings; removedFunnelIds?: string[] }>(request, 256_000)
    if (!parsed.ok) return jsonReadError(parsed)
    const body = parsed.value
    const rawFunnels = Array.isArray(body.funnels) ? body.funnels : null
    const incoming = rawFunnels
      ? rawFunnels.map(sanitizeIncomingFunnel).filter((item): item is NonNullable<typeof item> => Boolean(item))
      : null
    const incomingRemoved = rawFunnels ? clipRemovedIds(body.removedFunnelIds, 400) : []
    let stored: SalesFunnel[] = []
    if (incoming) {
      try {
        const boards = await readWorkspaceFunnels(env)
        if (
          boards.unread &&
          (incomingRemoved.length || incoming.some((item) => !boards.funnels.some((row) => row.id === item.id)))
        ) {
          return json({ error: "Não confirmei os funis." }, 503)
        }
        stored = boards.funnels
      } catch {
        return json({ error: "Não confirmei os funis." }, 503)
      }
    }
    if (body.settings) {
      let loaded
      try {
        loaded = await readWorkspaceSettings(env)
      } catch {
        return json({ error: "Não confirmei as definições no Postgres." }, 503)
      }
      if (
        pageScriptsMutationBlocked(
          loaded.unread,
          loaded.settings.pageScripts,
          body.settings.pageScripts,
          loaded.settings.removedPageScripts,
          body.settings.removedPageScripts
        )
      ) {
        return json({ error: "Não confirmei os scripts desta página." }, 503)
      }
      if (leadCategoriesMutationBlocked(loaded.unread, loaded.settings.leadCategories, body.settings.leadCategories)) {
        return json({ error: "Não confirmei as categorias." }, 503)
      }
    }
    if (incoming && rawFunnels) {
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
        const message = error instanceof Error ? error.message : ""
        if (message === "Mantém pelo menos um funil." || message.startsWith("O estúdio aceita no máximo")) {
          return json({ error: message }, 400)
        }
        return json({ error: "Não confirmei os funis." }, 503)
      }
    }
    if (body.settings) {
      try {
        await persistSettings(env, body.settings)
      } catch {
        return json({ error: "Não confirmei as definições no Postgres." }, 503)
      }
    }
    return json({ ok: true })
  }

  if (url.pathname === "/api/leads" && request.method === "GET") {
    const gate = await requireStudioUser(request, env)
    if (!gate.ok) return gate.response
    if (!env.AUTH) return json({ error: "Auth ainda sem KV." }, 503)
    const query = (url.searchParams.get("q") || "").trim()
    if (query) {
      if (query.length > 80) return json({ error: "Busca inválida." }, 400)
      const found = await searchWorkspaceLeads(env, query)
      if (!found.ok) return json({ error: "Não li os leads do Postgres." }, 503)
      const attached = await attachLeadEvents(env, await filterLiveLeads(env.AUTH, found.leads))
      return json({ ok: true, leads: attached.leads, eventsUnread: attached.unread || undefined })
    }
    const cursor = (url.searchParams.get("cursor") || "").trim()
    if (cursor && !isLeadPageCursor(cursor)) return json({ error: "Cursor inválido." }, 400)
    const page = await loadMergedLeads(env, 400, "all", cursor)
    if (page.failed) return json({ error: "Não li os leads do Postgres." }, 503)
    return json({
      ok: true,
      leads: page.leads,
      nextCursor: page.stale ? undefined : page.nextCursor,
      stale: page.stale || undefined,
      clipped: page.clipped || undefined,
      eventsUnread: page.eventsUnread || undefined,
      removed: cursor ? undefined : await removedLeadIdsOf(env.AUTH),
    })
  }

  if (url.pathname === "/api/leads" && request.method === "POST") {
    const gate = await requireStudioUser(request, env)
    if (!gate.ok) return gate.response
    if (!env.AUTH) return json({ error: "Auth ainda sem KV." }, 503)
    const user = gate.user
    const limited = await gateKvThrottle(
      env.AUTH,
      `leads:${user.id}:${clientIp(request)}`,
      40,
      60_000,
      "Demasiados pedidos de leads. Espera um pouco."
    )
    if (limited) return limited
    const parsed = await readJsonObject<{ lead?: Lead; leads?: Lead[] }>(request, 256_000)
    if (!parsed.ok) return jsonReadError(parsed)
    if (await leadCatalogUnread(env)) return json({ error: "Não li os leads do Postgres." }, 503)
    const body = parsed.value
    const rows = (body.leads?.length ? body.leads : body.lead ? [body.lead] : []).slice(0, 120)
    const ids: string[] = []
    const adopted: Record<string, string> = {}
    for (const row of rows) {
      const lead = sanitizeIncomingLead(row)
      if (!lead) continue
      const resolved = await resolveWorkspaceLeadWrite(env, lead)
      if (!resolved.ok) return json({ error: "Não li o lead do Postgres." }, 503)
      const { incoming, prev } = resolved
      let gone
      try {
        gone = (await leadRemovedForRead(env.AUTH, incoming.id)) || (await leadRemovedForRead(env.AUTH, lead.id))
      } catch {
        return json({ error: "Não li o lead do Postgres." }, 503)
      }
      if (gone) continue
      const next = adoptOperatorLead(prev, incoming)
      if (!(await saveLead(env, next))) continue
      ids.push(next.id)
      if (lead.id !== next.id) adopted[lead.id] = next.id
    }
    return json({ ok: true, saved: ids.length, ids, adopted })
  }

  if (url.pathname === "/api/leads" && request.method === "DELETE") {
    const gate = await requireStudioUser(request, env)
    if (!gate.ok) return gate.response
    if (!env.AUTH) return json({ error: "Auth ainda sem KV." }, 503)
    const user = gate.user
    const limited = await gateKvThrottle(
      env.AUTH,
      `leads-del:${user.id}:${clientIp(request)}`,
      30,
      60_000,
      "Demasiados pedidos de exclusão. Espera um pouco."
    )
    if (limited) return limited
    const id = (url.searchParams.get("id") || "").trim()
    if (!id || id.length > 80) return json({ error: "Falta o id do lead." }, 400)
    const removed = await removeLead(env, id)
    if (removed === "unread") return json({ error: "Não confirmei a exclusão do lead." }, 409)
    if (!removed) return json({ error: "Não apaguei o lead do Postgres." }, 503)
    return json({ ok: true })
  }

  if (url.pathname === "/api/inbox" && request.method === "GET") {
    const gate = await requireStudioUser(request, env)
    if (!gate.ok) return gate.response
    if (!env.AUTH) return json({ error: "Auth ainda sem KV." }, 503)
    const cursor = (url.searchParams.get("cursor") || "").trim()
    if (cursor && !isLeadPageCursor(cursor)) return json({ error: "Cursor inválido." }, 400)
    const page = await loadMergedLeads(env, 400, "telegram", cursor)
    if (page.failed) return json({ error: "Não li os leads do Postgres." }, 503)
    return json({
      ok: true,
      leads: page.leads,
      nextCursor: page.stale ? undefined : page.nextCursor,
      stale: page.stale || undefined,
      clipped: page.clipped || undefined,
      eventsUnread: page.eventsUnread || undefined,
      removed: cursor ? undefined : await removedLeadIdsOf(env.AUTH),
    })
  }

  if (url.pathname === "/api/telegram" && request.method === "POST") {
    let secrets
    try {
      secrets = (await runtimeOf(env)).secrets
    } catch {
      return json({ ok: false, error: "Não confirmei as chaves do Worker." }, 503)
    }
    const expected = (env.TELEGRAM_WEBHOOK_SECRET || secrets.telegramWebhookSecret || "").trim()
    const header = request.headers.get("x-telegram-bot-api-secret-token") || ""
    if (!expected || header !== expected) return json({ ok: false }, 401)
    const parsed = await readJsonStrict(request, 65_536)
    if (!parsed.ok) return json({ ok: false }, parsed.status)
    const update = parsed.value as TelegramUpdate
    ctx.waitUntil(handleTelegram(env, update, secrets))
    return json({ ok: true })
  }

  if (url.pathname === "/api/cron") {
    const secret = url.searchParams.get("secret") ?? request.headers.get("x-cron-secret")
    if (!env.CRON_SECRET || secret !== env.CRON_SECRET) return json({ ok: false }, 401)
    try {
      const result = await processWaits(env)
      return json({
        ok: true,
        advanced: result.advanced,
        remoteUnread: result.remoteUnread || undefined,
        funnelsUnread: result.funnelsUnread || undefined,
      })
    } catch {
      return json({ ok: true, advanced: 0, remoteUnread: true })
    }
  }

  return json({ ok: false, error: "not_found" }, 404)
}

function webhookUrl(request: Request, env: Env) {
  const origin = (env.APP_URL || new URL(request.url).origin).replace(/\/$/, "")
  return `${origin}/api/telegram`
}

async function handleTelegram(env: Env, update: TelegramUpdate, secrets?: RuntimeSecrets) {
  try {
    await runTelegram(env, update, secrets)
  } catch {
    console.error("telegram update falhou", typeof update.update_id === "number" ? update.update_id : "")
  }
}

async function runTelegram(env: Env, update: TelegramUpdate, secrets?: RuntimeSecrets) {
  const resolved = secrets ? resolveRuntime(env, secrets) : (await runtimeOf(env)).resolved
  if (!resolved.telegramBotToken) return
  if (!telegramUpdateActor(update)) return
  const updateId = typeof update.update_id === "number" && update.update_id > 0 ? update.update_id : 0
  const kv = kvOf(env)
  if (updateId && kv) {
    try {
      if (!(await claimTelegramUpdate(kv, updateId))) return
    } catch {
      /* claim unread — o 200 já saiu; leftover não é “já visto” */
    }
  }
  let sent = false
  try {
    sent = (await deliverTelegram(env, update, resolved.telegramBotToken, resolved)).sent
  } catch (error) {
    if (updateId && kv && !sent) {
      try {
        await forgetTelegramUpdate(kv, updateId)
      } catch {
        /* claim unread */
      }
    }
    throw error
  }
  if (updateId && kv && !sent) {
    try {
      await forgetTelegramUpdate(kv, updateId)
    } catch {
      /* claim unread */
    }
  }
}

async function deliverTelegram(
  env: Env,
  update: TelegramUpdate,
  token: string,
  resolved?: ResolvedRuntime
): Promise<{ sent: boolean }> {
  const live = resolved ?? (await runtimeOf(env)).resolved
  const joinUser = telegramJoinActor(update)
  const message = update.message
  const from = telegramUpdateActor(update)
  if (!from) return { sent: false }

  const contact = from.username ? `@${from.username}` : `tg:${from.id}`
  const telegramName = resolvePersonName([from.first_name, from.last_name].filter(Boolean).join(" "))
  const name = isResolvedPersonName(telegramName) ? telegramName : contact
  const chatId = String(message?.chat.id ?? update.chat_member?.chat.id ?? from.id)
  const start = parseTelegramStart(joinUser ? "" : message?.text)
  const origin: LeadOrigin = joinUser ? "group_join" : start.isStart ? originFromStart(start.payload) : "private"
  const campaign = joinUser ? campaignFor("telegram") : start.isStart ? campaignFromStart(start.payload) : campaignFor("telegram", origin)
  const now = new Date().toISOString()

  const existing = await findLead(env, contact, from.id, chatId)
  let reservedId = ""
  if (!existing) {
    reservedId = env.AUTH ? await reserveLeadIdentity(env.AUTH, contact, chatId, crypto.randomUUID()) : crypto.randomUUID()
  }
  const raced =
    !existing && env.AUTH && reservedId ? await loadLead(env.AUTH, reservedId, await removedIdsForRead(env.AUTH)) : null
  const found = existing ?? raced
  const visitorId = start.isStart ? visitorIdFromStart(start.payload) : undefined
  let lead: Lead
  if (found) {
    lead = found
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
      id: reservedId || crypto.randomUUID(),
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
  let boards: { funnels: SalesFunnel[]; unread: boolean }
  try {
    boards = await readWorkspaceFunnels(env)
  } catch {
    boards = { funnels: [], unread: true }
  }
  const funnels = boards.funnels
  let loaded: { settings: Settings; unread: boolean }
  try {
    loaded = await readWorkspaceSettings(env)
  } catch {
    loaded = { settings: emptySettings(), unread: true }
  }
  const settings = loaded.settings
  const startPayload = start.isStart && start.payload ? start.payload : lead.startPayload
  const scriptId = scriptIdFromStart(startPayload || "")
  const script = pageScriptById(settings.pageScripts, scriptId)
  if (start.isStart && start.payload && script) {
    lead.funnelId = script.funnelId
    lead.campaign = `Facebook · ${script.name}`.slice(0, 120)
  }
  if (
    installSettingsBlocked(loaded.unread, scriptId, script) ||
    (!joinUser && (leadFunnelUnread(boards.unread, lead.funnelId, funnels) || (boards.unread && !funnels.length)))
  ) {
    if (found) {
      lead = rememberLeadTalk(lead, incoming)
      if (!(await persistLeadAfterSend(env, lead))) console.error("telegram lead após recusa não gravou")
    }
    return { sent: true }
  }
  const ste = steRuntimeFromFunnels(funnels, settings, lead.funnelId)
  const shouldTalk = ste.talking !== false && !joinUser
  const pending = lead
  let delivered = !shouldTalk
  if (shouldTalk) {
    const talked = incoming?.trim()
      ? await replySteSmart(lead, incoming, {
          apiKey: live.openaiApiKey || undefined,
          openRouterKey: live.openaiApiKey || undefined,
          openCodeKey: live.opencodeApiKey || undefined,
          model: live.opencodeApiKey ? live.fallbackModel : live.model,
          fallbackModel: live.opencodeApiKey ? undefined : live.fallbackModel,
          runtime: ste,
        })
      : replySte(lead, incoming, Date.now(), ste)
    const sent = await sendSteReplies(env, token, chatId, talked.replies, talked.beat, live)
    if (sent.ok) {
      lead = talked.lead
      delivered = true
    } else {
      lead = rememberLeadTalk(pending, incoming)
    }
  }

  if (delivered) {
    if (!(await persistLeadAfterSend(env, lead))) console.error("telegram lead após envio não gravou")
  } else {
    if (!(await persistLeadAfterSend(env, lead))) console.error("telegram lead após recusa não gravou")
    const updateId = typeof update.update_id === "number" && update.update_id > 0 ? update.update_id : 0
    if (updateId && env.AUTH) await forgetTelegramUpdate(env.AUTH, updateId)
  }
  return { sent: delivered }
}

async function processWaits(env: Env): Promise<{ advanced: number; remoteUnread: boolean; funnelsUnread: boolean }> {
  const empty = { advanced: 0, remoteUnread: false, funnelsUnread: false }
  let lockOwner: string | null = "local"
  try {
    lockOwner = env.AUTH ? await claimCronLock(env.AUTH) : "local"
  } catch {
    return { ...empty, remoteUnread: true }
  }
  if (!lockOwner) return empty
  try {
    if (env.AUTH && lockOwner !== "local" && !(await renewCronLock(env.AUTH, lockOwner))) return empty
  } catch {
    return { ...empty, remoteUnread: true }
  }
  try {
    const now = new Date().toISOString()
    const remoteDue = await fetchRemoteDueLeads(env, now)
    let kvPage = { leads: [] as Lead[], missingIds: [] as string[], unread: false }
    let kvDueUnread = false
    if (env.AUTH) {
      try {
        kvPage = await dueLeadsKv(env.AUTH, now)
        if (kvPage.unread) kvDueUnread = true
      } catch {
        kvDueUnread = true
      }
    }
    const filled = await fillLeadHoles(env, kvPage.leads, kvPage.missingIds)
    let removed: string[] = []
    if (env.AUTH) {
      try {
        removed = await loadRemovedLeadIds(env.AUTH)
      } catch {
        kvDueUnread = true
      }
    }
    const adopted = adoptDueLeads(filled.leads, remoteDue ?? [], removed)
    let liveDue = applyRemovedLeads(adopted, removed)
    if (env.AUTH && !kvDueUnread) {
      try {
        liveDue = await filterLiveLeads(env.AUTH, liveDue)
      } catch {
        kvDueUnread = true
      }
    }
    const remoteUnread = Boolean((env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE && remoteDue === null) || kvDueUnread)
    const byId = new Map(liveDue.map((lead) => [lead.id, lead]))
    if (!byId.size) return { advanced: 0, remoteUnread, funnelsUnread: false }
    let boards: { funnels: SalesFunnel[]; unread: boolean }
    try {
      boards = await readWorkspaceFunnels(env)
    } catch {
      boards = { funnels: [], unread: true }
    }
    const funnels = boards.funnels
    const settings = await loadSettings(env).then(
      (item) => item,
      () => emptySettings()
    )
    let resolved
    try {
      resolved = (await runtimeOf(env)).resolved
    } catch {
      resolved = resolveRuntime(env, emptySecrets())
    }
    const token = resolved.telegramBotToken
    const due = dueWaits([...byId.values()])
    let advanced = 0
    let funnelsUnread = false
    for (const queued of due) {
      try {
        if (env.AUTH && lockOwner !== "local" && !(await renewCronLock(env.AUTH, lockOwner))) break
        let live: Lead | null = queued
        if (env.AUTH) {
          try {
            live = await loadLead(env.AUTH, queued.id, await removedIdsForRead(env.AUTH))
          } catch {
            live = null
          }
        }
        const picked = pickLiveDueLead(queued, live)
        if (!picked) continue
        const extras = await fetchRemoteLeadsByIds(env, [picked.id])
        const lead = extras === null ? picked : hydrateWorkspaceLead(picked, extras[0])
        if (!canAdvanceRemoteWait(lead, Boolean(token))) continue
        if (leadFunnelUnread(boards.unread, lead.funnelId, funnels)) {
          funnelsUnread = true
          continue
        }
        const snapshot = snapshotForLead(funnels, lead)
        const ste = steRuntimeFromFunnels(funnels, settings, lead.funnelId)
        if (isSteWait(lead)) {
          const talked = advanceSteIfDue(lead, Date.now(), ste)
          if (!talked.replies.length && talked.lead.waitUntil === lead.waitUntil) continue
          if (!(await saveLead(env, talked.lead))) continue
          if (token && lead.telegramChatId && talked.replies.length) {
            const sent = await sendSteReplies(env, token, lead.telegramChatId, talked.replies, talked.beat, resolved)
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
    return { advanced, remoteUnread, funnelsUnread }
  } finally {
    if (env.AUTH && lockOwner) {
      try {
        await releaseCronLock(env.AUTH, lockOwner)
      } catch {
        /* o lock expira sozinho */
      }
    }
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
  await persistRemoteFunnels(env, clean)
}

async function persistSettings(env: Env, settings: Settings) {
  const incoming = migrateSettings(settings)
  let clean = incoming
  if (env.AUTH) {
    clean = await persistSettingsMerge(env.AUTH, incoming)
  }
  await persistRemoteSettings(env, clean)
}

async function loadSettings(env: Env): Promise<Settings> {
  return loadWorkspaceSettings(env)
}

async function removedLeadIdsOf(kv: NonNullable<Env["AUTH"]>) {
  try {
    return await loadRemovedLeadIds(kv)
  } catch {
    return undefined
  }
}

async function findLead(env: Env, contact: string, telegramId: number, chatId: string): Promise<Lead | null> {
  const found = await findWorkspaceLead(env, contact, telegramId, chatId)
  if (!found) return null
  const attached = await attachLeadEvents(env, [found])
  return attached.leads[0] ?? found
}

async function attachLeadEvents(env: Env, leads: Lead[]) {
  return attachWorkspaceLeadEvents(env, leads)
}

async function loadMergedLeads(env: Env, limit: number, channel: "telegram" | "all", cursor = "") {
  let page
  try {
    page = env.AUTH
      ? await listLeadPage(env.AUTH, limit, channel, cursor)
      : { leads: [] as Lead[], clipped: false, empty: true, missingIds: [] as string[] }
  } catch {
    return { leads: [] as Lead[], clipped: true, failed: true }
  }
  const canReachRemote = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE)
  if (page.empty) {
    const remote = await fetchRemoteLeadPage(env, limit, channel, cursor)
    if (canReachRemote && remote === null) return { leads: [], clipped: true, failed: true }
    const folded = leadPageFromRemote(remote, limit, canReachRemote)
    const live = env.AUTH ? await filterLiveLeads(env.AUTH, folded.leads) : folded.leads
    const attached = await attachLeadEvents(env, live)
    return {
      leads: attached.leads,
      nextCursor: folded.nextCursor,
      clipped: folded.clipped,
      eventsUnread: attached.unread || undefined,
    }
  }
  const kv = page.leads
  const missing = page.missingIds ?? []
  if (!kv.length && missing.length) {
    const extras = await fetchRemoteLeadsByIds(env, missing)
    if (extras === null) return { leads: [], clipped: true, failed: !cursor, stale: Boolean(cursor) }
    if (!extras.length && page.unread) return { leads: [], clipped: true, failed: !cursor, stale: Boolean(cursor) }
    const live = env.AUTH ? await filterLiveLeads(env.AUTH, extras) : extras
    const attached = await attachLeadEvents(env, live)
    return {
      leads: attached.leads,
      nextCursor: page.stale ? undefined : page.nextCursor,
      stale: page.stale,
      clipped: page.clipped === true || missing.some((id) => !live.some((item) => item.id === id)),
      eventsUnread: attached.unread || undefined,
    }
  }
  if (!kv.length) {
    const filter = channel === "telegram" ? "&channel=eq.telegram" : ""
    const rows = await rest<LeadRow[]>(
      env,
      `leads?workspace_id=eq.${WORKSPACE}${filter}&select=*&order=updated_at.desc&limit=${limit}`
    )
    const remoteFailed = canReachRemote && rows === null
    let removed: string[] = []
    if (env.AUTH) {
      try {
        removed = await loadRemovedLeadIds(env.AUTH)
      } catch {
        /* lista unread — o gone ainda segura o tombstone no filtro seguinte */
      }
    }
    const remote = applyRemovedLeads((rows ?? []).map(rowToLead), removed)
    if (remoteFailed) return { leads: [], clipped: true, failed: !cursor, stale: Boolean(cursor) }
    if (!cursor) {
      const folded = leadPageFromRemote(remote, limit, canReachRemote)
      const live = env.AUTH ? await filterLiveLeads(env.AUTH, folded.leads) : folded.leads
      const attached = await attachLeadEvents(env, live)
      return {
        leads: attached.leads,
        nextCursor: folded.nextCursor,
        clipped: folded.clipped || !live.length,
        eventsUnread: attached.unread || undefined,
      }
    }
    return { leads: [], nextCursor: page.nextCursor, stale: page.stale, clipped: true }
  }
  const filled = await fillLeadHoles(env, kv, missing)
  const extras = await fetchRemoteLeadsByIds(env, kv.map((lead) => lead.id))
  const live = extras ? (env.AUTH ? await filterLiveLeads(env.AUTH, extras) : extras) : []
  const attached = await attachLeadEvents(env, adoptLeadStores(filled.leads, live))
  return {
    leads: attached.leads.slice(0, Math.max(limit, filled.leads.length)),
    nextCursor: page.stale ? undefined : page.nextCursor,
    stale: page.stale,
    clipped: page.clipped === true || filled.holesOpen,
    eventsUnread: attached.unread || undefined,
  }
}

async function leadRemovalTombstoned(kv: KvLike, id: string) {
  try {
    return await isLeadRemoved(kv, id)
  } catch {
    return false
  }
}

async function removeLead(env: Env, id: string): Promise<true | false | "unread"> {
  if (env.AUTH) {
    try {
      await deleteLeadKv(env.AUTH, id)
    } catch {
      if (!(await leadRemovalTombstoned(env.AUTH, id))) return "unread"
    }
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE) return true
  for (let attempt = 0; attempt < 4; attempt++) {
    const leadGone = await rest(env, `leads?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${WORKSPACE}`, { method: "DELETE" })
    const eventsGone = await rest(env, `lead_events?lead_id=eq.${encodeURIComponent(id)}`, { method: "DELETE" })
    if (leadGone !== null && eventsGone !== null) return true
    if (attempt < 3) await sleep(40 * (attempt + 1))
  }
  console.error("supabase delete incompleto")
  return false
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
  if (!env.AUTH) return false
  if (await leadRemovedForRead(env.AUTH, lead.id)) return false
  const removed = await removedIdsForRead(env.AUTH)
  for (let attempt = 0; attempt < 4; attempt++) {
    const live = await loadLead(env.AUTH, lead.id, removed)
    const restored = sanitizeIncomingLead(restoreLeadAfterFailedSend(lead, live))
    if (!restored) return false
    if (!(await upsertLeadKv(env.AUTH, restored))) return false
    const latest = await loadLead(env.AUTH, lead.id, removed)
    if (!latest) return false
    const extras = (latest.messages ?? []).filter(
      (item) => item.id && item.role !== "ste" && !(restored.messages ?? []).some((msg) => msg.id === item.id)
    )
    if (!extras.length && latest.waitUntil === restored.waitUntil && latest.memory === restored.memory) {
      await persistRemoteLead(env, latest)
      return true
    }
  }
  return false
}

async function saveLead(env: Env, lead: Lead) {
  let bounded = sanitizeIncomingLead(lead)
  if (!bounded) return false
  if (env.AUTH) {
    try {
      if (await leadRemovedForRead(env.AUTH, bounded.id)) return false
      const removed = await removedIdsForRead(env.AUTH)
      const prev = await loadLead(env.AUTH, bounded.id, removed)
      bounded = commitStoredLead(prev, bounded)
      const latest = await loadLead(env.AUTH, bounded.id, removed)
      bounded = commitStoredLead(prev, bounded, latest)
      if (!(await upsertLeadKv(env.AUTH, bounded))) return false
      if (await leadRemovedForRead(env.AUTH, bounded.id)) return false
    } catch {
      if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE) return false
    }
  }
  await persistRemoteLead(env, bounded)
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

async function sendSteReplies(
  env: Env,
  token: string,
  chatId: string,
  replies: string[],
  beat?: SteBeat,
  resolved?: ResolvedRuntime
) {
  if (!replies.length) return { ok: true }
  let delivered = false
  const clip = beat ? voiceClipFor(beat.kind) : null
  const kv = kvOf(env)
  if (clip && kv) {
    let voice = resolved
    if (!voice) {
      try {
        voice = (await runtimeOf(env)).resolved
      } catch {
        voice = undefined
      }
    }
    if (voice?.voice) {
      try {
        const stored = await ensureVoiceClip(kv, clip, voice.elevenApiKey, voice.elevenVoiceId)
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

async function requireStudioUser(request: Request, env: Env) {
  if (!env.AUTH) return { ok: false as const, response: json({ error: "Auth ainda sem KV." }, 503) }
  return gateActor(request, kvAuthStore(env.AUTH))
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

