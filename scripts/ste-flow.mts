import { chatStarted, funnelFrom, markersFromGeos, mergeGlobeGeos, periodDelta, pixelDropFigure, pixelFigure, pixelGeoEmpty, pixelMapEmpty, pixelMapHint, stepDrop } from "../src/lib/analytics-view.ts"
import { coordsFromGeo } from "../src/lib/geo-coords.ts"
import { flagEmoji, formatGeo, mergeGeo, normalizeRegionCode, stateLabel } from "../src/lib/geo.ts"
import { emptySummary, isFacebookTraffic, summarizeTrack, type TrackEvent } from "../src/lib/track.ts"
import { parseTrackSummary } from "../src/lib/track-api.ts"
import {
  isolateLead,
  rememberLeadTalk,
  canTickSteLocally,
  canSimulateSte,
  replySte,
  replySteLived,
  replySteSmart,
  replySteTick,
  applySteVoice,
  guardSteVoice,
  listenLine,
  STE_WELCOME,
  STE_COURSE_BLOCK,
  STE_SUPERBET_BLOCK,
  STE_SUPERBET_RESCUE,
  STE_OFFER_BLOCK,
  STE_LIVE_BLOCK,
  STE_REMARKETING_BLOCK,
  STE_CLOSE,
  steRuntimeFromSnapshot,
  steRuntimeFromFunnels,
  steWaitDelayMs,
  safeHttpUrl,
  splitSteMarkup,
  toTelegramHtml,
} from "../src/lib/ste.ts"
import { emptySalesFunnel } from "../src/lib/templates.ts"
import {
  activatePublishedFunnels,
  enforceSinglePublished,
  adoptDueLeads,
  adoptLeadKvStores,
  adoptLeadStores,
  adoptStoredLead,
  adoptOperatorLead,
  commitStoredLead,
  restoreLeadAfterFailedSend,
  adoptRemoteFunnels,
  clipFunnelsKeepBoards,
  mergeLeadMessages,
  applyRemovedFunnels,
  applyRemovedLeads,
  crmDeleteAck,
  crmStateAfterActorChange,
  persistScopeKey,
  sessionQueueKeys,
  sessionQueuesCleared,
  QUEUE_PENDING_LEADS,
  QUEUE_REMOVED_LEADS,
  leadDeleteAck,
  rememberLocalTombstone,
  restoreAfterFailedDelete,
  leadsStillOnRemote,
  adoptHydrateSettings,
  adoptFunnelStores,
  adoptSettingsStores,
  canCreateFunnel,
  canDeleteFunnel,
  funnelsListBlocked,
  cacheLeadsForStorage,
  canFlushCrm,
  clipNewestIds,
  clipRemovedIds,
  collectLeadPages,
  INBOX_LIST_PAGES,
  LEAD_LIST_CAP,
  LEAD_LIST_PAGES,
  LEAD_CACHE_CAP,
  commitCrmFunnels,
  FUNNEL_CAP,
  commitStoredSettings,
  emptySettings,
  linkRuntimeSettings,
  hydrateFunnels,
  hydrateLeads,
  leftoverPendingFunnelIds,
  pendingSeedFunnelIds,
  recoverPendingFunnelIds,
  revertPublishedFunnels,
  mergeFunnels,
  mergeLeadEvents,
  sanitizeLeadEvents,
  mergeLeads,
  overlayPendingLeads,
  adoptSearchLeads,
  remapAdoptedLeads,
  publicSettings,
  reconcileFunnels,
  reconcileLeads,
  resolveLeadLookup,
  settingsWriteFingerprint,
  leadPersistSync,
} from "../src/lib/crm.ts"
import { applyEvent, canAdvanceRemoteWait, eventFromOrigin, leadFunnelUnread, pickLiveDueLead, publishedFunnel, publishedSnapshot, snapshotForLead, waitHours } from "../src/lib/runtime.ts"
import { ADS_ORIGIN, isTelegramAdsHref, pixelPageHtml, pixelSnippet, TRACKER_JS } from "../src/lib/tracker-script.ts"
import { csvCell, leadsToCsv } from "../src/lib/leads-export.ts"
import { defaultSettings, type Lead, type SalesFunnel } from "../src/lib/types.ts"
import { CRM_CRON_LOCK, CRM_FUNNELS, CRM_INDEX, CRM_REMOVED, CRM_REMOVED_FUNNELS, CRM_SETTINGS, LEAD_INDEX_PINNED_CAP, LEAD_INDEX_REST_CAP, LEAD_REMOVED_CAP, aliasKey, claimCronLock, claimLeadAlias, clipCrmIndex, crmIndexClipped, deleteLeadKv, dueLeadsKv, filterLiveLeads, findLeadInKv, importOrAdoptLead, isFunnelRemoved, isLeadPageCursor, isLeadRemoved, leadKey, leadPageCursor, leadPageFromRemote, listLeadPage, listLeads, loadFunnelsKv, loadLead, lookupLeadsByQuery, loadAdoptedSettings, loadRemovedFunnelIds, loadRemovedLeadIds, loadSettingsKv, mergeIndexEntries, persistFunnelsMerge, persistSettingsMerge, rememberRemovedFunnels, rememberRemovedLead, rememberSentLead, releaseCronLock, renewCronLock, reserveLeadIdentity, resolveLeadWrite, saveFunnelsKv, saveSettingsKv, sentLeadKey, settingsPersistSettled, upsertLeadKv } from "../worker/crm-store.ts"
import { readJsonObject } from "../worker/json-body.ts"
import { memoryKv } from "../worker/kv.ts"
import { fetchRemoteDueLeads, fetchRemoteLeadByIdentity, fetchRemoteLeadsByIds, fetchRemotePageEvents, findWorkspaceLead, findWorkspaceLeadById, hydrateWorkspaceLead, leadCatalogUnread, leadFactsForRemote, loadWorkspaceFunnels, loadWorkspaceSettings, persistRemoteFunnels, persistRemoteLead, persistRemoteSettings, persistWorkspaceFunnels, persistWorkspaceSettings, readWorkspaceFunnels, readWorkspaceSettings, remoteLeadDuePath, remoteLeadIdentityPath, remoteLeadListPath, remoteLeadSearchPath, resolveWorkspaceLeadWrite, rowToLead, rowToTrackEvent, sanitizeRemoteSearchNeedle, searchWorkspaceLeads, summarizeWorkspaceTrack, telegramIdFromLead } from "../worker/workspace-settings.ts"
import { STE_LLM_FALLBACK, STE_LLM_MODEL, STE_OPENCODE_MODEL, steLlmAttempts, steModelChain } from "../src/lib/llm.ts"
import { clipHash, linkFollowUp, linksFromReplies, spokenHasUrl, STE_VOICE_CLIPS, voiceClipFor } from "../src/lib/ste-voice.ts"
import { FETCH_TIMEOUT_MS, KEEPALIVE_MAX_BYTES } from "../src/lib/http.ts"
import { LEAD_WRITE_BATCH, leadWriteAdopted, leadWriteChunks, leadWriteIds } from "../src/lib/runtime-api.ts"
import { remoteSearchBlank } from "../src/lib/lead-search.ts"
import { foldPublicPath, foldStudioPath, isWorkerPublicPath, safeAppPath, withSafeNext } from "../src/lib/safe-path.ts"
import { firstInvalidPublishUrl, validatePublish } from "../src/lib/validate.ts"
import { contactLookups, normalizeTelegramContact, sameLeadContact, validateCapture } from "../src/lib/capture.ts"
import { displayContact, draftLeadField, formatPhoneContact, isPhoneLikeName, isResolvedPersonName, leadMatchesQuery, nameFromMessages, preferLeadName, resolveLeadName, resolvePersonName } from "../src/lib/lead-name.ts"
import { cleanBotUsername, cleanHttpUrl, cleanTelegramGroupUrl, migrateLead, migrateLeadOrigin, migrateSettings, sanitizeIncomingFunnel, sanitizeIncomingLead } from "../src/lib/migrate.ts"
import { adsDeepLink, campaignFromStart, scriptIdFromStart, visitorIdFromStart } from "../src/lib/telegram-start.ts"
import { authForgotDocument, authLoginDocument, authPrivacyDocument, authResetDocument, wantsAuthHtml } from "../src/lib/auth-pages.ts"
import { addPageScript, adsLandingDocument, adsLandingUrl, adsStartToken, installSettingsBlocked, pageInstallManual, pageScriptFunnelLabel, pageScriptFunnelPending, pageScriptsFunnelUnread, pageScriptsListBlocked, pageScriptsMutationBlocked, pageScriptsWriteBlocked, PAGE_INSTALL_STEPS, removePageScript } from "../src/lib/page-script.ts"
import { leadCategoriesListBlocked, leadCategoriesMutationBlocked, leadCategoriesWriteBlocked, leadFromImport, leadImportGroupBlocked, parseLeadImportLine, parseLeadImportText } from "../src/lib/lead-category.ts"
import { burstFacebookLeads, burstStartsBlocked, burstStats, simulateOpenLead } from "../src/lib/burst.ts"
import { leadFromCapture } from "../src/lib/templates.ts"
import { campaignFor } from "../src/lib/labels.ts"
import { barShare, catalogMetricPending, crmSyncAfterFlush, eventsSyncAfterNarrowRead, funnelsWriteBlocked, hasConversation, isImportedLead, isOperatorLockedLead, leadCatalogClipped, leadCatalogEmpty, leadFilterCount, leadFilterPending, leadMatchesFilter, leadTimelinePending, leadWritesBlocked, leadsExportBlocked, leadsHydrating, leadsLoadFailed, metricPending, offerMetricPending, trackSyncAfterRead } from "../src/lib/ops.ts"
import { usersWriteBlocked } from "../src/lib/users-api.ts"
import { commitSecrets, loadSecrets, mergeSecrets, resolveRuntime, RUNTIME_KEY, saveSecrets, tokenHint } from "../worker/runtime-secrets.ts"
import { kvTrackStore, memoryTrackStore, mergeTrackEvents, recordTrack } from "../worker/track-store.ts"
import { AUTH_REVOKED_CAP, consumeThrottle, consumeMemoryThrottle, consumeKvThrottle, confirmKvThrottle, clearThrottle, ensureOperatorUsers, findUserByApiToken, gateActor, handleAuth, hashApiToken, hashPassword, kvAuthStore, memoryAuthStore, mergeAuthSnapshots, mergeTokens, mergeThrottles, mintApiToken, readActor, requestHasAuth, retainUserSessions, sessionUser } from "../worker/auth.ts"
import { importFunnel } from "../src/lib/funnel-import.ts"
import { ensureVoiceClip, VOICE_STORE_KEY, voiceClipStatus } from "../worker/ste-voice.ts"
import { claimTelegramUpdate, forgetTelegramUpdate, forgetTelegramId, mergeTelegramClaims, telegramCall, telegramJoinActor, telegramUpdateActor } from "../worker/telegram.ts"
import { backgroundCtx, handleRequest, type Env } from "../worker/index.ts"
import { clearSessionExpired, noteUnauthorized, subscribeSessionExpired } from "../src/lib/session.ts"

function lead(id = "lead-1", contact = "@fb1"): Lead {
  const now = new Date().toISOString()
  return {
    id,
    name: "Lead",
    contact,
    channel: "telegram",
    campaign: "facebook",
    origin: "facebook",
    temperature: "novo",
    stage: "welcome",
    memory: "",
    facts: {},
    events: [],
    messages: [],
    createdAt: now,
    updatedAt: now,
  }
}

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message)
}

function kvThrowsOn(base: ReturnType<typeof memoryKv>, ...blocked: string[]) {
  return {
    async get(key: string, type: "json") {
      if (blocked.includes(key)) throw new Error("kv down")
      return base.get(key, type)
    },
    async put(key: string, value: string) {
      return base.put(key, value)
    },
  }
}

function kvThrowsAfter(base: ReturnType<typeof memoryKv>, key: string, allow: number) {
  let hits = 0
  return {
    async get(name: string, type: "json") {
      if (name === key) {
        hits += 1
        if (hits > allow) throw new Error("kv down")
      }
      return base.get(name, type)
    },
    async put(name: string, value: string) {
      return base.put(name, value)
    },
  }
}

function kvThrowsOnPut(base: ReturnType<typeof memoryKv>, ...blocked: string[]) {
  return {
    async get(key: string, type: "json") {
      return base.get(key, type)
    },
    async put(key: string, value: string) {
      if (blocked.includes(key)) throw new Error("kv put down")
      return base.put(key, value)
    },
  }
}

const script = steRuntimeFromSnapshot(emptySalesFunnel("teste"))
assert(script.welcome?.[0] === STE_WELCOME[0], "funil carrega boas-vindas 1")
assert((script.welcome?.length ?? 0) === 3, "tres falas de boas-vindas no template")
assert(script.remarketing?.length, "remarketing vive no funil")
assert(script.course?.[0] === STE_COURSE_BLOCK[0], "minicurso no template")
assert(script.dieAfterRemarketing, "silencio depois do follow-up")
assert(script.talking, "ste fala se o quadro tiver handoff")
assert(script.remarketingHours === 7, "espera de 7h no wait")
const customTalk = replySte(lead("funil"), null, Date.now(), { welcome: ["Oi do quadro.", "Segunda fala.", "Terceira."] })
assert(customTalk.replies[0] === "Oi do quadro.", "copia do funil manda no /start")

const start = replySte(lead(), null)
assert(start.replies.join("|") === STE_WELCOME.join("|"), "passo 1: 3 boas-vindas")
assert(start.lead.stePhase === "listen", "fase listen")
assert(start.replies.length === 3, "espera depois das 3")

const silent = replySte(start.lead, null)
assert(silent.replies.length === 0, "sem spam no segundo /start")

const course = replySte(start.lead, "to começando agora e perdendo")
assert(course.replies[0] === STE_COURSE_BLOCK[0], "passo 2 acolhe")
assert(course.replies.some((item) => item.includes("minicurso gratuito")), "link mascarado do curso")
assert(!course.replies.some((item) => item.includes("http") && !item.includes("](")), "sem url crua no curso")
assert(course.lead.stePhase === "diagnosis", "fase diagnosis")
assert(course.beat.kind === "course" && course.beat.vary, "passo do minicurso pode ter voz")
assert(course.lead.facts.heard?.includes("perdendo"), "guarda o que o lead falou")
assert(
  listenLine({ experience: "beginner", results: "losing" }, "to começando agora e perdendo", "course")?.includes("prejuízo"),
  "voz ouve iniciante no prejuízo"
)
const lived = replySteLived(start.lead, "to começando agora e perdendo")
assert(lived.replies[0] !== STE_COURSE_BLOCK[0], "voz troca a primeira fala")
assert(lived.replies[0].includes("prejuízo"), "primeira fala reconhece o lead")
assert(lived.replies.some((item) => item.includes("minicurso gratuito")), "voz mantém o link do quadro")
assert(lived.lead.stePhase === "diagnosis", "voz nao pula de fase")
assert(!guardSteVoice(course.replies, ["oi sem link"], course.beat), "guarda derruba fala sem o link")
assert(
  !guardSteVoice(course.replies, [course.replies[0]!, "https://go.perfectpay.com.br/PPU38CQDT9B"], course.beat),
  "guarda barra url crua e checkout"
)

const platform = replySte(course.lead, "ainda nao tenho conta")
assert(platform.replies[0] === STE_SUPERBET_BLOCK[0], "passo 3 superbet")
assert(platform.replies.some((item) => item.includes("Superbet com bônus")), "link superbet")
assert(platform.lead.memory.includes("ste:superbet"), "espera 5-10 min")
assert(platform.lead.waitUntil, "waitUntil do cadastro")

const tooSoon = replySteTick(platform.lead, Date.now() + 60_000)
assert(tooSoon.replies.length === 0, "nao resgata antes de 5 min")

const rescue = replySteTick(platform.lead, Date.now() + 8 * 60_000)
assert(rescue.replies[0] === STE_SUPERBET_RESCUE, "resgate 5-10 min")

const lives = replySte(start.lead, "que horas é a live?")
assert(lives.replies[0] === STE_LIVE_BLOCK[0], "faq lives")

const app = replySte(start.lead, "quanto custa o app?")
assert(app.replies.join("|") === STE_OFFER_BLOCK.join("|"), "passo 4 sob demanda")

const hate = replySte(start.lead, "vai se foder")
assert(hate.reply === STE_CLOSE, "ofensa encerra")
assert(hate.lead.steBlocked, "bloqueado")

const remark = replySteTick(
  { ...start.lead, memory: "ste:remarketing", waitUntil: new Date(Date.now() - 1000).toISOString() },
  Date.now()
)
assert(remark.replies.join("|") === STE_REMARKETING_BLOCK.join("|"), "remarketing 7h")
assert(remark.lead.steQuiet, "silencia depois do premium")
assert(replySte(remark.lead, "e aí?").replies.length === 0, "morto depois do follow-up")

const alice = replySte(lead("alice", "@alice"), "eu sou a Alice e estou perdendo tudo")
const bob = replySte(lead("bob", "@bob"), "ainda nao tenho conta")
assert(alice.lead.facts.results === "losing", "fato da Alice")
assert(alice.lead.facts.experience === undefined || alice.lead.facts.results === "losing", "fato isolado")
assert(!JSON.stringify(bob.lead).includes("Alice"), "Bob nao ve Alice")
assert(!JSON.stringify(bob.lead.messages).includes("perdendo tudo"), "transcript isolado")
assert(isolateLead(alice.lead).id === "alice", "isolate guarda o id")
assert(isolateLead(alice.lead).messages.every((item) => alice.lead.messages.some((own) => own.id === item.id)), "so mensagens dela")
assert(isolateLead({ ...alice.lead, category: "Grupo" }).category === "Grupo", "isolate conserva a categoria")
const taggedLead = { ...alice.lead, category: "Grupo", updatedAt: "2026-01-01T00:00:00.000Z" }
assert(
  adoptStoredLead(taggedLead, { ...isolateLead(taggedLead), category: undefined, updatedAt: "2026-06-01T00:00:00.000Z" }).category ===
    "Grupo",
  "tick da Sté não apaga a categoria"
)
assert(
  adoptOperatorLead(taggedLead, { ...taggedLead, category: "", updatedAt: "2026-06-01T00:00:00.000Z" }).category === "",
  "o painel pode tirar a categoria"
)
assert(leadMatchesQuery({ id: "c1", name: "Ana", contact: "@ana", category: "Grupo" }, "grupo", 1), "busca local pela categoria")
assert(draftLeadField("ste:remarketing", "memoria isolada", true, "ste:remarketing") === "memoria isolada", "dirty ganha do input revertido")
assert(draftLeadField("ste:remarketing", "ste:remarketing", false, "memoria isolada") === "memoria isolada", "sem dirty o input visível ganha")
assert(draftLeadField("guarda", "rascunho", false) === "guarda", "sem dirty nem input mantém o gravado")
assert(
  adoptOperatorLead(
    { ...alice.lead, memory: "ste:welcome", updatedAt: "2026-01-01T00:00:00.000Z" },
    { ...alice.lead, memory: "memoria isolada", updatedAt: "2026-06-01T00:00:00.000Z" }
  ).memory === "memoria isolada",
  "nota da ficha ganha dos tokens da Sté"
)
assert(bob.lead.facts.hasSuperbet === false, "fato do Bob")

const html = toTelegramHtml(STE_COURSE_BLOCK[2]!)
assert(html.includes("<a href=\"https://mundoaviator.com.br/mini-curso/\">"), "html do telegram")
assert(!html.includes("]("), "markdown nao vaza")
assert(safeHttpUrl("https://t.me/bot")?.startsWith("https://t.me/bot"), "https passa")
assert(safeHttpUrl("javascript:alert(1)") === null, "javascript nao passa")
assert(safeHttpUrl("https://user:pass@evil.test/") === null, "userinfo no link da Sté cai")
assert(splitSteMarkup("[x](javascript:alert(1))")[0]?.type === "text", "markup recusa javascript")
assert(splitSteMarkup("[x](https://user:pass@evil.test/)")[0]?.type === "text", "markup recusa userinfo")
assert(!toTelegramHtml("[x](javascript:alert(1))").includes("href"), "html recusa javascript")
assert(!toTelegramHtml("[x](https://user:pass@evil.test/)").includes("href"), "html recusa userinfo")
const published = publicSettings({ ...defaultSettings, telegramBotToken: "123:abc", esterTelegramChatId: "999001" })
assert(published.telegramBotToken === "", "settings públicas não levam o token")
assert(published.esterTelegramChatId === "", "settings públicas não levam o chat da Ester")
assert(migrateSettings({ esterTelegramChatId: "999001" }).esterTelegramChatId === "", "persist não guarda o chat da Ester")

assert(flagEmoji("BR") === "🇧🇷", "bandeira BR")
assert(stateLabel("São Paulo", "SP", "BR") === "São Paulo (SP)", "estado SP")
assert(formatGeo({ countryCode: "BR", regionCode: "RJ" }) === "🇧🇷 Rio de Janeiro (RJ)", "geo do cliente")
assert(normalizeRegionCode("Sao Paulo", "BR") === "SP", "UF sem acento")
assert(mergeGeo({ countryCode: "BR", regionCode: "SP" }, { countryCode: "", regionCode: "" }).regionCode === "SP", "hint sobrevive ao CF vazio")
assert(mergeGeo({ countryCode: "BR", regionCode: "RJ" }, { countryCode: "BR", city: "Niterói" }).regionCode === "RJ", "CF sem UF nao apaga estado")
assert(coordsFromGeo({ countryCode: "BR", regionCode: "SP" })?.[0] === -23.55, "SP no globo")
assert(markersFromGeos({ a: { country: "Brasil", countryCode: "BR", city: "", region: "São Paulo", regionCode: "SP" } })[0]?.id === "pulse-1", "marker do pixel")
assert(markersFromGeos({ a: { country: "Brasil", countryCode: "BR", city: "", region: "São Paulo", regionCode: "SP" } })[0]?.label.includes("São Paulo"), "estado no globo")
assert(
  markersFromGeos({
    a: { country: "Brasil", countryCode: "BR", city: "", region: "São Paulo", regionCode: "SP" },
    b: { country: "Brasil", countryCode: "BR", city: "", region: "", regionCode: "" },
  }).every((item) => item.label !== "Brasil"),
  "UF vale mais que o pais sozinho"
)
assert(mergeGlobeGeos({}, [{ ...lead("geo-1"), facts: { countryCode: "BR", regionCode: "RJ", region: "Rio de Janeiro", country: "Brasil" } }])["geo-1"]?.regionCode === "RJ", "lead entra no globo")
assert(periodDelta(120, 100) > 0, "delta positivo")
assert(isFacebookTraffic({ campaign: "Facebook · ads" }), "campanha facebook")
assert(!isFacebookTraffic({ campaign: "Direto" }), "direto nao e ads")
const talking = { ...lead("chat"), origin: "facebook" as const, visitorId: "aaaaaa", messages: [{ id: "m1", at: new Date().toISOString(), role: "lead" as const, text: "oi" }] }
const organicTalk = { ...lead("org"), origin: "private" as const, messages: [{ id: "m2", at: new Date().toISOString(), role: "lead" as const, text: "oi" }] }
const funnel = funnelFrom(
  {
    ...emptySummary(),
    visitors: 80,
    ads: 50,
    clicks: 30,
    telegrams: 22,
    facebook: { adClicks: 20, pageViews: 41, buttonClicks: 12, visitors: 20, buttonVisitors: 9, starts: 7 },
  },
  [talking, organicTalk]
)
assert(funnel.map((item) => item.id).join(">") === "ads>landing>button>chat", "ordem do funil facebook")
assert(funnel[0]?.value === 20, "anuncio separado")
assert(funnel[1]?.value === 41, "page view separado")
assert(funnel[2]?.value === 12, "botao telegram separado")
assert(funnel[3]?.value === 1, "chat so do facebook")
assert(funnel[0]?.value !== funnel[1]?.value, "anuncio != page view")
assert(funnel[1]?.value !== funnel[2]?.value, "page view != botao")
assert(chatStarted(talking), "lead falou")
assert(stepDrop(7, 20) === 7 / 20, "queda do funil")
assert(stepDrop(20, 12) === null, "nao inventa conversao acima de 100%")

const now = new Date().toISOString()
const sample = (partial: Partial<TrackEvent>): TrackEvent => ({
  id: partial.id ?? "e",
  visitorId: partial.visitorId ?? "aa",
  kind: partial.kind ?? "view",
  path: "/",
  referrer: partial.referrer ?? "",
  campaign: partial.campaign ?? "Direto",
  country: "Brasil",
  countryCode: "BR",
  city: "",
  region: "São Paulo",
  regionCode: "SP",
  device: "Chrome",
  language: "pt-BR",
  at: now,
  ...partial,
})
const counted = summarizeTrack([
  sample({ id: "v1", visitorId: "aaaaaa", kind: "view", campaign: "Facebook · ads", referrer: "https://l.facebook.com" }),
  sample({ id: "v2", visitorId: "aaaaaa", kind: "view", campaign: "Facebook · ads" }),
  sample({ id: "c1", visitorId: "aaaaaa", kind: "click", campaign: "Facebook · ads" }),
  sample({ id: "t1", visitorId: "aaaaaa", kind: "telegram", campaign: "Facebook · ads" }),
  sample({ id: "o1", visitorId: "bbbbbb", kind: "view", campaign: "Direto" }),
  sample({ id: "o2", visitorId: "bbbbbb", kind: "click", campaign: "Direto" }),
])
assert(counted.facebook.adClicks === 1, "um clique no anuncio")
assert(counted.facebook.pageViews === 2, "duas page views do ads")
assert(counted.facebook.buttonClicks === 1, "um clique no botao")
assert(counted.facebook.starts === 1, "/start nao mistura no botao")
assert(counted.views === 3, "page view total inclui direto")
assert(counted.clicks === 2, "clique total inclui direto")
assert(mergeTrackEvents([sample({ id: "a1" })], [sample({ id: "b1" })]).length === 2, "pixel une ids distintos")
assert(
  mergeTrackEvents([sample({ id: "same", at: "2020-01-01T00:00:00.000Z" })], [sample({ id: "same", at: "2026-01-01T00:00:00.000Z", path: "/novo" })]).find(
    (item) => item.id === "same"
  )?.path === "/novo",
  "pixel fica com o evento mais novo do mesmo id"
)
const raceTrack = memoryTrackStore()
await Promise.all([
  recordTrack(raceTrack, { kind: "view", visitorId: "aaaaaa", path: "/a", id: "pix-a" }, 1000),
  recordTrack(raceTrack, { kind: "view", visitorId: "bbbbbb", path: "/b", id: "pix-b" }, 2000),
])
const racedPixel = await raceTrack.load()
assert(racedPixel.some((item) => item.id === "pix-a"), "pixel A não some na corrida")
assert(racedPixel.some((item) => item.id === "pix-b"), "pixel B não some na corrida")

const kept = mergeSecrets({ telegramBotToken: "123:abc" }, { telegramBotToken: "•••• abc" })
assert(kept.telegramBotToken === "123:abc", "mascara nao apaga o token")
assert(
  mergeSecrets({ telegramBotUsername: "@ste_bot" }, { telegramBotUsername: "" }).telegramBotUsername === "@ste_bot",
  "username vazio não apaga o Vincular"
)
assert(
  mergeSecrets({ telegramGroupUrl: "https://t.me/steaviator" }, { telegramGroupUrl: "" }).telegramGroupUrl ===
    "https://t.me/steaviator",
  "grupo vazio não apaga o convite"
)
const secretRaceKv = memoryKv()
await Promise.all([
  saveSecrets(secretRaceKv, { telegramBotUsername: "@ste_bot" }),
  saveSecrets(secretRaceKv, { telegramBotToken: "123:abc" }),
])
const racedSecrets = await loadSecrets(secretRaceKv)
assert(racedSecrets.telegramBotUsername === "@ste_bot", "Vincular em paralelo não perde o username")
assert(racedSecrets.telegramBotToken === "123:abc", "Vincular em paralelo não perde o token")
assert(
  commitSecrets({ telegramBotUsername: "@ste_bot" }, { telegramBotToken: "123:abc", webhookOk: true }).telegramBotUsername ===
    "@ste_bot",
  "commit do runtime une username e token"
)
const spoofHook = mergeSecrets({ webhookOk: false, webhookUrl: "https://www.abilion.lol/api/telegram" }, { webhookOk: true, webhookUrl: "https://evil.test/hook" })
assert(spoofHook.webhookOk !== true, "cliente não marca webhookOk")
assert(spoofHook.webhookUrl !== "https://evil.test/hook", "cliente não aponta o webhook")
const spoofLlm = mergeSecrets(
  { openaiBaseUrl: "https://openrouter.ai/api/v1" },
  { openaiBaseUrl: "http://169.254.169.254/latest/meta-data" }
)
assert(!spoofLlm.openaiBaseUrl, "cliente não aponta o endpoint da IA")
const envLlm = resolveRuntime({ OPENAI_BASE_URL: "https://openrouter.ai/api/v1", AUTH: {} }, { openaiBaseUrl: "http://127.0.0.1:9" })
assert(envLlm.baseUrl.includes("openrouter.ai"), "IA só usa URL do Worker")
const swapped = mergeSecrets({ telegramBotToken: "123:abc" }, { telegramBotToken: "999:xyz" })
assert(swapped.telegramBotToken === "999:xyz", "token novo substitui")
assert(tokenHint("123:abcd") === "•••• abcd", "hint do token")
const resolved = resolveRuntime({ TELEGRAM_BOT_TOKEN: "env-token", STE_USE_LLM: "1", AUTH: {} }, { telegramBotToken: "kv-token", openaiApiKey: "sk-or", steModel: "google/gemma-4-31b-it:free" })
assert(resolved.telegramBotToken === "kv-token", "KV manda no token")
assert(resolved.telegram, "telegram ligado")
assert(resolved.llm, "llm ligada")
assert(resolved.persist === "kv", "persistencia KV")
assert(resolved.model === STE_LLM_MODEL, "Gemma padrão")
assert(resolved.fallbackModel === STE_LLM_FALLBACK, "DeepSeek reserva")
assert(resolved.baseUrl.includes("openrouter.ai"), "OpenRouter")
assert(steModelChain()[0] === STE_LLM_MODEL, "cadeia começa no Gemma")
assert(steModelChain()[1] === STE_LLM_FALLBACK, "depois DeepSeek")
assert(steLlmAttempts({ openrouterKey: "or" }).map((item) => item.model).join(">") === `${STE_LLM_MODEL}>${STE_LLM_FALLBACK}`, "tentativas Gemma→DeepSeek")
assert(steLlmAttempts({ opencodeKey: "oc" }).map((item) => item.model).join(">") === STE_OPENCODE_MODEL, "OpenCode sozinho é V4.1 Flash")
assert(
  steLlmAttempts({ opencodeKey: "oc", openrouterKey: "or" }).map((item) => item.model).join(">") ===
    `${STE_OPENCODE_MODEL}>${STE_LLM_MODEL}>${STE_LLM_FALLBACK}`,
  "OpenCode primeiro, OpenRouter reserva"
)
const withGo = resolveRuntime({ OPENCODE_API_KEY: "oc_sk", STE_USE_LLM: "1", AUTH: {} }, {})
assert(withGo.model === STE_OPENCODE_MODEL && withGo.llm, "OpenCode liga DeepSeek V4.1 Flash")
assert(withGo.fallbackModel === STE_LLM_MODEL, "Gemma fica de reserva")
assert(steModelChain(STE_LLM_FALLBACK, STE_LLM_FALLBACK).length === 1, "nao duplica reserva")
const fallback = resolveRuntime({ AUTH: {} }, { steModel: "z-ai/glm-5.3-flash" })
assert(fallback.model === "z-ai/glm-5.3-flash", "glm conhecido fica")
const unknown = resolveRuntime({ AUTH: {} }, { steModel: "mimo-v2.5-free" })
assert(unknown.model === STE_LLM_MODEL, "MiMo antigo cai no Gemma")
const migrated = resolveRuntime({ AUTH: {} }, { steModel: "mimo-v2.5-free", steFallbackModel: "google/gemma-4-31b-it:free" })
assert(migrated.model === STE_LLM_MODEL && migrated.fallbackModel === STE_LLM_FALLBACK, "KV velho vira Gemma→DeepSeek")

assert(STE_VOICE_CLIPS.length === 8, "oito clips generalizados")
assert(!STE_VOICE_CLIPS.some((item) => spokenHasUrl(item.script)), "script falado sem url")
assert(voiceClipFor("welcome")?.id === "welcome", "boas-vindas tem audio")
assert(voiceClipFor("offer")?.id === "offer", "oferta tem audio")
assert(voiceClipFor("confirm") === null, "confirm fica texto")
assert(voiceClipFor("redirect") === null, "redirect fica texto")
assert(voiceClipFor("idle") === null, "idle fica texto")
assert(clipHash("fala", "voz-1") === clipHash("fala", "voz-1"), "hash estavel")
assert(clipHash("fala", "voz-1") !== clipHash("fala", "voz-2"), "troca de voz invalida o clip")
assert(linksFromReplies(["veja [curso](https://mundoaviator.com.br/mini-curso/) e [app](https://app.mundoaviator.com.br/)"]).length === 2, "tira dois links")
assert(linkFollowUp(["sem link"]) === "", "sem follow-up se nao tem link")
assert(linkFollowUp(course.replies).includes("mundoaviator.com.br"), "links do curso saem no texto")
const keptVoice = mergeSecrets({ elevenApiKey: "sk_old", elevenVoiceId: "voice_old" }, { elevenApiKey: "•••• old", elevenVoiceId: "•••• old" })
assert(keptVoice.elevenApiKey === "sk_old" && keptVoice.elevenVoiceId === "voice_old", "mascara nao apaga a voz")
const fromEnv = resolveRuntime({ ELEVENLABS_API_KEY: "sk_env", ELEVENLABS_VOICE_ID: "voice_env" }, {})
assert(fromEnv.voice && fromEnv.elevenVoiceId === "voice_env", "env liga a voz")
const fromKv = resolveRuntime({ ELEVENLABS_API_KEY: "sk_env" }, { elevenApiKey: "sk_kv", elevenVoiceId: "cloned" })
assert(fromKv.elevenApiKey === "sk_kv" && fromKv.voice, "KV manda na chave da ElevenLabs")
assert(!resolveRuntime({}, {}).voice, "sem chave a Sté fica em texto")
const welcomeClip = voiceClipFor("welcome")
assert(welcomeClip, "clip de boas-vindas existe")
const readyStore = {
  welcome: {
    id: "welcome",
    hash: clipHash(welcomeClip.script, "cloned"),
    voiceId: "cloned",
    mime: "audio/ogg" as const,
    fileId: "tg-1",
    updatedAt: "now",
  },
}
assert(voiceClipStatus(readyStore, "cloned").find((item) => item.id === "welcome")?.ready, "clip com file_id esta pronto")
assert(!voiceClipStatus(readyStore, "cloned").find((item) => item.id === "course")?.ready, "clip que falta fica a espera")
assert(!voiceClipStatus(readyStore, "outra").find((item) => item.id === "welcome")?.ready, "outra voz invalida o cache")
const voiceFetch = globalThis.fetch
let elevenCalls = 0
globalThis.fetch = (async (input: RequestInfo | URL) => {
  elevenCalls += 1
  if (String(input).includes("elevenlabs.io")) return new Response(Uint8Array.from([1, 2, 3, 4]), { status: 200 })
  return new Response("no", { status: 404 })
}) as typeof fetch
try {
  const voiceKv = memoryKv()
  const firstClip = await ensureVoiceClip(voiceKv, welcomeClip, "sk_test", "voice_abc")
  assert(firstClip.audioB64 && firstClip.hash === clipHash(welcomeClip.script, "voice_abc"), "ElevenLabs grava o clip")
  const beforeReuse = elevenCalls
  const reusedClip = await ensureVoiceClip(voiceKv, welcomeClip, "sk_test", "voice_abc")
  assert(elevenCalls === beforeReuse, "reutiliza clip sem gastar ElevenLabs")
  assert(reusedClip.audioB64 === firstClip.audioB64, "o mesmo arquivo volta do KV")
} finally {
  globalThis.fetch = voiceFetch
}

const first = lead("crm-1", "@ana")
first.telegramChatId = "41"
const kv = memoryKv()
await upsertLeadKv(kv, first)
const found = await findLeadInKv(kv, "@ana", 41, "41")
assert(found?.id === "crm-1", "lead no KV por contacto")
assert((await claimLeadAlias(kv, "chat", "41", "outro")) === "crm-1", "alias ocupado não cria outro id")
const chatRaceKv = memoryKv()
const [raceA, raceB] = await Promise.all([
  reserveLeadIdentity(chatRaceKv, "@dup", "77", "lead-a"),
  reserveLeadIdentity(chatRaceKv, "@dup", "77", "lead-b"),
])
assert(raceA === raceB, "dois /start no mesmo chat ficam com o mesmo id")
assert((await reserveLeadIdentity(chatRaceKv, "@dup", "77", "lead-c")) === raceA, "terceiro /start reusa o mesmo lead")
const aliasKv = memoryKv()
await upsertLeadKv(aliasKv, lead("named", "@ana"))
assert((await findLeadInKv(aliasKv, "ana", 0, ""))?.id === "named", "findLead sem @ reusa o @user")
assert((await reserveLeadIdentity(aliasKv, "ana", "", "other")) === "named", "reserva sem @ reusa o @user")
assert(sameLeadContact("@ana", "ana"), "mesmo contacto com e sem @")
const importThenStart = memoryKv()
const importedRita = leadFromImport({ name: "Rita", contact: "@rita" })
await upsertLeadKv(importThenStart, importedRita)
assert(
  (await reserveLeadIdentity(importThenStart, "@rita", "937750764", "chat-novo")) === importedRita.id,
  "/start reusa o import pelo @user"
)
const stealKv = memoryKv()
await upsertLeadKv(stealKv, { ...lead("live-foo", "@foo"), telegramChatId: "1" })
const stubFoo = leadFromImport({ name: "Foo", contact: "@foo" })
await upsertLeadKv(stealKv, stubFoo)
assert((await findLeadInKv(stealKv, "@foo", 0, "1"))?.id === "live-foo", "import não rouba o alias do chat vivo")
const adoptedFoo = await importOrAdoptLead(stealKv, leadFromImport({ name: "Foo", contact: "@foo", }, { category: "Grupo" }))
assert(adoptedFoo?.id === "live-foo" && adoptedFoo.category === "Grupo", "segundo import anota o lead vivo")
assert((await listLeads(stealKv, 400, "all")).filter((item) => item.contact === "@foo" || item.id === "live-foo").length >= 1, "não duplica o @foo")
const staleAlias = memoryKv()
await rememberRemovedLead(staleAlias, "dead")
await staleAlias.put(aliasKey("contact", "@gone"), JSON.stringify({ id: "dead" }))
assert((await claimLeadAlias(staleAlias, "contact", "@gone", "fresh")) === "fresh", "alias de lead apagado cede o contacto")
const twice = memoryKv()
const firstImport = await importOrAdoptLead(twice, leadFromImport({ name: "Rita", contact: "@rita" }))
const secondImport = await importOrAdoptLead(twice, leadFromImport({ name: "Rita Silva", contact: "@rita" }, { category: "VIP" }))
assert(firstImport && secondImport && firstImport.id === secondImport.id, "importar o mesmo @user duas vezes é um lead")
assert(secondImport?.category === "VIP", "reimport actualiza a categoria")
assert((await listLeads(twice, 400, "all")).length === 1, "reimport não cria segunda ficha")
const rematched = await resolveLeadWrite(twice, leadFromImport({ name: "Outra", contact: "@rita" }))
assert(rematched.incoming.id === firstImport.id && rematched.prev?.id === firstImport.id, "POST rematch pelo contacto")
assert((await listLeads(kv, 400, "all")).some((item) => item.id === "crm-1"), "lista completa inclui o lead")
const newer = { ...first, lastMessage: "oi", updatedAt: new Date(Date.now() + 1000).toISOString() }
assert(mergeLeads([first], [newer])[0]?.lastMessage === "oi", "merge fica com o mais novo")
assert(mergeLeads([newer], [first])[0]?.lastMessage === "oi", "merge nao volta atras")
const localEvents = [
  { id: "e1", at: "2026-01-01T00:00:00.000Z", kind: "entered" as const, title: "kv" },
  { id: "e2", at: "2026-01-01T00:01:00.000Z", kind: "message" as const, title: "kv" },
]
const remoteEvents = [
  { id: "e1", at: "2026-01-01T00:00:00.000Z", kind: "entered" as const, title: "supabase" },
  { id: "e3", at: "2026-01-01T00:02:00.000Z", kind: "wait" as const, title: "supabase" },
]
const mergedEvents = mergeLeadEvents(localEvents, remoteEvents)
assert(mergedEvents.map((item) => item.id).join(",") === "e1,e2,e3", "eventos unem por id")
assert(mergedEvents[0]?.title === "kv", "evento local ganha no mesmo id")
assert(mergeLeadEvents(localEvents, []).length === 2, "remoto vazio não apaga o KV")
assert(mergeLeadEvents([], remoteEvents).map((item) => item.id).join(",") === "e1,e3", "KV vazio adopta o remoto")

const seen: string[] = []
const realFetch = globalThis.fetch
globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
  const body = JSON.parse(String(init?.body ?? "{}")) as { model?: string }
  seen.push(body.model ?? "")
  if ((body.model ?? "").includes("gemma")) return new Response("rate", { status: 429 })
  return new Response(
    JSON.stringify({
      choices: [
        {
          message: {
            content:
              "Quer subir de nível agora? Te passo o caminho sem enrolação.\n\n[clique aqui para conhecer os planos do App](https://app.mundoaviator.com.br/)",
          },
        },
      ],
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  )
}) as typeof fetch
try {
  const offerLead = { ...replySte(lead("llm-1"), null).lead, stePhase: "offer" as const }
  const chained = await replySteSmart(offerLead, "e agora o que eu faço?", { openCodeKey: "oc-test", openRouterKey: "sk-test" })
  assert(seen[0] === STE_OPENCODE_MODEL, "tenta OpenCode DeepSeek V4.1 primeiro")
  assert(chained.replies.some((item) => item.includes("enrolação")), "usa a resposta se o OpenCode já passou")
  seen.length = 0
  const smart = await replySteSmart(offerLead, "e agora o que eu faço?", { apiKey: "sk-test" })
  assert(seen[0] === STE_LLM_MODEL, "sem OpenCode tenta Gemma primeiro")
  assert(seen[1] === STE_LLM_FALLBACK, "DeepSeek OpenRouter entra no 429")
  assert(smart.replies.some((item) => item.includes("enrolação")), "usa a resposta da reserva")
  assert(smart.replies.some((item) => item.includes("app.mundoaviator.com.br")), "IA precisa manter o link do passo")
  seen.length = 0
  const badFetch = globalThis.fetch
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ choices: [{ message: { content: "Me chama no privado que te passo os detalhes certinho." } }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch
  const rejected = await replySteSmart(offerLead, "e agora o que eu faço?", { apiKey: "sk-test" })
  globalThis.fetch = badFetch
  assert(!rejected.replies.some((item) => item.includes("privado")), "guarda recusa fala solta")
  assert(rejected.replies.some((item) => item.includes("app.mundoaviator.com.br")), "cai na voz com o link do quadro")
  const voicedOffer = applySteVoice(replySte(offerLead, "quero o app"), "quero o app")
  assert(voicedOffer.beat.kind === "offer", "pedido de app continua oferta")
} finally {
  globalThis.fetch = realFetch
}

const emptyCapture = validateCapture("  ", "")
assert(!emptyCapture.ok && emptyCapture.errors.name && emptyCapture.errors.contact, "captura vazia falha com os dois campos")
assert(validateCapture("Ana", "@ana").ok, "captura valida passa")
assert(validateCapture("Ana", "ana").ok && validateCapture("Ana", "ana").contact === "@ana", "captura sem @ normaliza")
assert(validateCapture("Ana", "tg:9001").ok, "captura aceita tg:id")
assert(!validateCapture("Ana", "???").ok, "captura recusa contacto inválido")
assert(normalizeTelegramContact("ana") === "@ana", "contacto sem @ ganha @")
assert(normalizeTelegramContact("tg:9") === "tg:9", "tg:id não ganha @")
assert(normalizeTelegramContact("5511987654321") === "5511987654321", "telefone não vira @user")
assert(contactLookups("ana").includes("@ana") && contactLookups("@ana").includes("ana"), "lookup cobre as duas formas")
assert(contactLookups("+55 11 98765-4321").includes("5511987654321"), "lookup do telefone também tem os dígitos")
assert(isPhoneLikeName("5511987654321"), "telefone cru conta como nome-telefone")
assert(!isPhoneLikeName("Ana Souza"), "nome de pessoa não é telefone")
assert(formatPhoneContact("5511987654321") === "+55 11 98765-4321", "formata telemóvel BR")
assert(displayContact("5511987654321") === "+55 11 98765-4321", "contacto na lista mostra o telefone formatado")
assert(displayContact("@ana") === "@ana", "contacto Telegram não se formata")
assert(formatPhoneContact("551139325678") === "+55 11 3932-5678", "formata fixo BR")
assert(resolvePersonName("PAULO SERGIO FRANCISCO") === "Paulo Sergio Francisco", "MAIÚSCULAS viram nome")
assert(resolvePersonName("lucas mota de araujo") === "Lucas Mota de Araujo", "partícula de fica minúscula")
assert(resolvePersonName("JARSON DOS SANTOS") === "Jarson dos Santos", "dos fica minúsculo")
assert(resolveLeadName("5511987654321", "5511987654321") === "+55 11 98765-4321", "nome-telefone fica legível")
assert(resolveLeadName("ana.souza@exemplo.com", "5511987654321") === "Ana Souza", "e-mail no nome vira pessoa")
assert(resolveLeadName("5511987654321", "5511987654321", { email: "ana.souza@exemplo.com" }) === "Ana Souza", "e-mail no facto resolve nome-telefone")
assert(resolveLeadName("Joao", "5511987654321", { email: "ana.souza@exemplo.com" }) === "Ana Souza", "e-mail mais completo ganha do nome curto")
assert(
  resolveLeadName("5511987654321", "5511987654321", { messages: [{ role: "lead", text: "Meu nome é Carla Mendes" }] }) === "Carla Mendes",
  "fala do lead resolve o nome"
)
assert(nameFromMessages([{ role: "ste", text: "Meu nome é Sté" }]) === "", "fala da Sté não inventa o nome do lead")
assert(resolveLeadName("MARIA SILVA 11987654321", "5511987654321") === "Maria Silva", "telefone embutido no nome sai")
assert(!isResolvedPersonName("Lead"), "placeholder Lead não conta como pessoa")
assert(preferLeadName("+55 11 98765-4321", "PAULO SERGIO", "5511987654321") === "Paulo Sergio", "pessoa ganha do telefone no merge")
assert(migrateLead({ id: "n1", name: "PAULO SERGIO DE SOUZA", contact: "5511987654321" }).name === "Paulo Sergio de Souza", "migrateLead resolve o nome")
assert(migrateLead({ id: "n2", name: "5511987654321", contact: "5511987654321" }).name === "+55 11 98765-4321", "migrateLead formata nome-telefone")
assert(migrateLead({ id: "n2", name: "5511987654321", contact: "5511987654321" }).contact === "5511987654321", "migrateLead não pisa o contacto")
const migratedTimeline = migrateLead({
  id: "n3",
  name: "Ana",
  contact: "@ana",
  facts: { email: "ana@abilion.com", timeline: [{ id: "ev-kv", at: "2026-01-01T00:00:00.000Z", kind: "offer" }] } as Lead["facts"],
})
assert(migratedTimeline.events.some((item) => item.id === "ev-kv"), "migrateLead recupera a timeline do jsonb")
assert(!("timeline" in migratedTimeline.facts), "migrateLead não deixa timeline nos facts do painel")
assert(leadFromCapture({ name: "Ana", contact: "ana", channel: "telegram", origin: "popup" }).contact === "@ana", "lead capturado grava @user")

assert(cleanBotUsername("@ste_bot") === "@ste_bot", "username válido fica")
assert(cleanBotUsername("steaviator") === "@steaviator", "username sem @ ganha @")
assert(cleanBotUsername("ab") === "", "username curto cai")
assert(cleanBotUsername("foo/bar") === "", "username com barra cai")
assert(cleanBotUsername("foo?x=1") === "", "username com query cai")
assert(adsDeepLink("foo/bar") === "", "deep link recusa handle inválido")
assert(adsDeepLink("@good_bot") === "https://t.me/good_bot?start=fb", "deep link usa handle limpo")
assert(adsDeepLink("@good_bot", "fb_a1b2c3d4e5") === "https://t.me/good_bot?start=fb_a1b2c3d4e5", "deep link aceita visitor id")
assert(visitorIdFromStart("fb_a1b2c3d4e5") === "a1b2c3d4e5", "start fb_vid devolve o visitor")
assert(visitorIdFromStart("fb") === undefined, "start fb sem vid não inventa visitor")
assert(
  pixelSnippet("https://www.abilion.lol").includes(`<script src="https://www.abilion.lol/t.js?v=2" data-cta="[data-abilion-cta]"></script>`) &&
    pixelSnippet("https://www.abilion.lol").includes("manual de instalação"),
  "snippet do pixel usa a origem e o manual"
)
assert(ADS_ORIGIN === "https://www.abilion.lol", "pixel do ads aponta para produção")
assert(
  pixelPageHtml(ADS_ORIGIN, "https://t.me/steaviator?start=fb").includes('data-abilion-cta'),
  "html da landing leva o atributo no botão"
)
assert(
  pixelPageHtml(ADS_ORIGIN, "javascript:alert(1)") === pixelSnippet(ADS_ORIGIN),
  "html da landing recusa href que não é t.me"
)
assert(scriptIdFromStart("fb_sdeadbeef_a1b2c3d4e5") === "deadbeef", "start com script devolve o id")
assert(visitorIdFromStart("fb_sdeadbeef_a1b2c3d4e5") === "a1b2c3d4e5", "start com script ainda devolve o visitor")
assert(visitorIdFromStart("fb_sdeadbeef") === undefined, "script sem vid não inventa visitor")
assert(campaignFromStart("fb_sdeadbeef_a1b2c3d4e5") === "Facebook · deadbeef", "campanha do script no start")
assert(adsStartToken("deadbeef", "a1b2c3d4e5") === "fb_sdeadbeef_a1b2c3d4e5", "token de start junta script e vid")
assert(
  pixelSnippet(ADS_ORIGIN, "deadbeef").includes(
    `<script src="https://www.abilion.lol/t.js?v=2&s=deadbeef" data-cta="[data-abilion-cta]" data-abilion-script="deadbeef"></script>`
  ),
  "snippet de página leva o id do script"
)
assert(TRACKER_JS.includes("/api/install") && TRACKER_JS.includes("fb_s") && TRACKER_JS.includes("Publica o funil"), "t.js leva o manual e reescreve fb_s")
assert(PAGE_INSTALL_STEPS.length >= 5, "manual de instalação tem os passos")
assert(pageInstallManual({}).snippet.includes("/t.js?v=2"), "manual geral inclui o script")
assert(pageInstallManual({ script: { id: "deadbeef", name: "Landing", funnelId: "f1", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" } }).scriptSrc.includes("s=deadbeef"), "manual do script inclui ?s=")
assert(adsLandingUrl() === "https://www.abilion.lol/l", "anúncio sem script vai à landing geral")
assert(adsLandingUrl("deadbeef") === "https://www.abilion.lol/l?s=deadbeef", "anúncio com script leva ?s=")
assert(adsLandingUrl("nao-e-id") === "https://www.abilion.lol/l", "id inválido não inventa query")
const landingDoc = adsLandingDocument({ botUsername: "@ste_bot" })
assert(
  landingDoc.includes("/t.js?v=2") && landingDoc.includes("data-abilion-cta") && landingDoc.includes("t.me/ste_bot?start=fb"),
  "HTML da /l leva t.js e CTA no primeiro byte"
)
assert(!adsLandingDocument({}).includes("<a data-abilion-cta"), "HTML da /l sem bot não inventa CTA")
assert(adsLandingDocument({ unread: true }).includes("Não confirmei o Telegram"), "HTML unread não diz que o bot não está ligado")
assert(!adsLandingDocument({ unread: true }).includes("ainda não está ligado"), "unread não usa a cópia de bot desligado")
assert(
  adsLandingDocument({ botUsername: "@ste_bot", scriptId: "deadbeef" }).includes("/t.js?v=2&s=deadbeef") &&
    adsLandingDocument({ botUsername: "@ste_bot", scriptId: "deadbeef" }).includes("start=fb_sdeadbeef"),
  "HTML da /l?s= leva o script no t.js e no start"
)
assert(!adsLandingDocument({ scriptId: '"><script>alert(1)</script>' }).includes("<script>alert"), "id inválido não entra no HTML")
assert(!adsLandingDocument({ botUsername: '"><img src=x>' }).includes("<img"), "username sujo não entra no HTML")
assert(authLoginDocument().includes('id="email"') && authLoginDocument().includes('action="/api/auth/login"'), "HTML do login tem o formulário")
assert(authLoginDocument().includes('src="/auth.js"') && authLoginDocument().includes('data-toggle-password="password"'), "HTML do login tem Mostrar senha sem script inline")
assert(authResetDocument({ token: "tok" }).includes('data-toggle-password="password"'), "HTML do reset também mostra a senha")
assert(authLoginDocument({ next: "//evil.com" }).includes('name="next" value="/"'), "next perigoso no login vira /")
assert(!authLoginDocument({ error: "<script>alert(1)</script>" }).includes("<script>alert"), "erro do login é escapado")
assert(authForgotDocument().includes('action="/api/auth/forgot"'), "HTML do forgot tem o formulário")
assert(authPrivacyDocument().includes("Privacidade") && authPrivacyDocument().includes("/login"), "HTML da privacidade liga o login")
assert(
  authResetDocument().includes("incompleto") && authResetDocument().includes("Gerar outro"),
  "HTML do reset sem token é empty state"
)
assert(authResetDocument({ token: "abc" }).includes('action="/api/auth/reset"'), "HTML do reset tem o formulário")
assert(authResetDocument({ token: "abc", next: "//evil.com" }).includes('name="next" value="/"'), "next perigoso no reset vira /")
assert(
  !authResetDocument({ token: '"><img src=x>', error: "<script>alert(1)</script>" }).includes("<script>alert"),
  "erro do reset é escapado"
)
assert(!authResetDocument({ token: '"><img src=x>' }).includes("<img"), "token sujo não entra no HTML")
assert(
  wantsAuthHtml(new Request("http://local.test/api/auth/login", { headers: { "content-type": "application/x-www-form-urlencoded" } })),
  "POST form pede HTML"
)
assert(
  !wantsAuthHtml(new Request("http://local.test/api/auth/login", { headers: { "content-type": "application/json" } })),
  "POST JSON do painel continua JSON"
)
assert(pageInstallManual({}).landing === adsLandingUrl(), "manual geral aponta o ads para /l")
assert(
  pageInstallManual({
    script: { id: "deadbeef", name: "Landing", funnelId: "f1", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  }).landing === adsLandingUrl("deadbeef"),
  "manual do script aponta o ads para /l?s="
)
assert(installSettingsBlocked(true, "deadbeef", undefined), "unread + s= válido + miss bloqueia o manual")
assert(!installSettingsBlocked(false, "deadbeef", undefined), "settings lidas + miss não bloqueiam")
assert(!installSettingsBlocked(true, "", undefined), "unread sem s= não bloqueia o manual geral")
assert(!installSettingsBlocked(true, "nao-e-id", undefined), "unread + s= inválido não bloqueia")
assert(
  !installSettingsBlocked(true, "deadbeef", {
    id: "deadbeef",
    name: "Landing",
    funnelId: "f1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }),
  "unread com o script no KV não bloqueia"
)
assert(pageScriptsListBlocked(true, []), "lista unread e oca bloqueia")
assert(!pageScriptsListBlocked(true, [{ id: "deadbeef", name: "Landing", funnelId: "f1", createdAt: "t", updatedAt: "t" }]), "lista unread com script no KV segue")
assert(!pageScriptsListBlocked(false, []), "lista lida vazia não bloqueia")
assert(pageScriptsWriteBlocked(true), "settings unread bloqueia criar script")
assert(pageScriptsFunnelUnread(true, [{ funnelId: "missing" }], []), "lista unread + funil miss não omite o nome")
assert(!pageScriptsFunnelUnread(true, [{ funnelId: "fun-install" }], [{ id: "fun-install" }]), "funil leftover na lista segue")
assert(!pageScriptsFunnelUnread(false, [{ funnelId: "missing" }], []), "GET confirmado + miss é órfão")
assert(pageScriptFunnelPending(true, undefined), "UI unread + miss não é apagado")
assert(!pageScriptFunnelPending(true, { id: "x" }), "funil leftover na UI mostra o nome")
assert(!pageScriptFunnelPending(false, undefined), "GET confirmado + miss é órfão")
assert(pageScriptFunnelLabel(true, undefined) === "Não confirmei o funil", "UI unread pede confirmação")
assert(pageScriptFunnelLabel(false, undefined) === "já não está no CRM", "UI confirmada diz órfão")
assert(pageScriptFunnelLabel(true, { name: "Quadro" }) === "Quadro", "leftover unread ainda mostra o nome")
assert(!pageScriptsWriteBlocked(false), "settings lidas deixam criar script")
assert(
  pageScriptsMutationBlocked(true, [{ id: "deadbeef", name: "Landing", funnelId: "f1", createdAt: "t", updatedAt: "t" }], [
    { id: "deadbeef", name: "Landing", funnelId: "f1", createdAt: "t", updatedAt: "t" },
    { id: "cafebabe", name: "Nova", funnelId: "f1", createdAt: "t", updatedAt: "t" },
  ]),
  "script novo com leftover unread bloqueia o POST"
)
assert(
  !pageScriptsMutationBlocked(true, [{ id: "deadbeef", name: "Landing", funnelId: "f1", createdAt: "t", updatedAt: "t" }], [
    { id: "deadbeef", name: "Landing", funnelId: "f1", createdAt: "t", updatedAt: "t" },
  ]),
  "username/rascunho com os mesmos scripts unread ainda grava"
)
assert(
  pageScriptsMutationBlocked(true, [{ id: "deadbeef", name: "Landing", funnelId: "f1", createdAt: "t", updatedAt: "t" }], [], [], ["deadbeef"]),
  "tombstone novo com leftover unread bloqueia o POST"
)
assert(FUNNEL_CAP === 20 && !canCreateFunnel(Array.from({ length: 20 }, () => emptySalesFunnel("x"))).ok, "criar o 21.º funil é recusado")
assert(funnelsListBlocked(true, []), "funis unread e ocas bloqueiam criar")
assert(!funnelsListBlocked(true, [emptySalesFunnel("x")]), "funis unread com lista no KV seguem")
assert(!funnelsListBlocked(false, []), "funis lidos vazios não bloqueiam criar")
assert(funnelsWriteBlocked("idle"), "CRM idle bloqueia escrita contra o quadro")
assert(funnelsWriteBlocked("error"), "CRM error bloqueia escrita contra o quadro")
assert(!funnelsWriteBlocked("ok"), "CRM confirmado deixa escrever contra o quadro")
assert(crmSyncAfterFlush(true, true) === "ok", "persist com GET confirmado mantém o CRM")
assert(crmSyncAfterFlush(true, false) === "error", "persist de rascunho não confirma funis unread")
assert(crmSyncAfterFlush(false, true) === "error", "persist falho não confirma o CRM")
assert(funnelsWriteBlocked(crmSyncAfterFlush(true, false)), "rascunho gravado com leftover não solta Publicar")
assert(burstStartsBlocked("idle", false), "hydrate ainda não solta o lote de 100")
assert(burstStartsBlocked("error", false), "GET falhou não solta o lote de 100")
assert(burstStartsBlocked("ok", true), "funis unread ocas bloqueiam o lote de 100")
assert(burstStartsBlocked("ok", funnelsWriteBlocked("error")), "funis unread com cache leftover ainda bloqueiam o lote de 100")
assert(!burstStartsBlocked("ok", false), "CRM confirmado deixa simular 100 /start")
assert(leadWritesBlocked("idle"), "hydrate ainda não solta captura nem import")
assert(leadWritesBlocked("error"), "GET falhou não solta captura nem import")
assert(leadWritesBlocked("ok", true), "funis unread ocas bloqueiam a captura")
assert(leadWritesBlocked("ok", funnelsWriteBlocked("error")), "funis unread com cache leftover ainda bloqueiam a captura")
assert(!leadWritesBlocked("ok", false), "CRM confirmado deixa capturar e importar")
const twentyOne = Array.from({ length: 21 }, (_, index) => ({ ...emptySalesFunnel(`n${index}`), id: `funil-${index}` }))
assert(reconcileFunnels([], twentyOne).length === 21, "reconcile não corta o 21.º quadro à calada")
assert(commitCrmFunnels([], twentyOne, [], []).length === 21, "commit do CRM não corta o 21.º à calada")
const boardA = { ...emptySalesFunnel("A"), id: "funil-a", production: { name: "A", publishedAt: "2026-01-01T00:00:00.000Z", nodes: [], edges: [] } }
const boardB = { ...emptySalesFunnel("B"), id: "funil-b", production: { name: "B", publishedAt: "2026-01-02T00:00:00.000Z", nodes: [], edges: [] } }
const clippedBoards = clipFunnelsKeepBoards(
  [
    ...Array.from({ length: 20 }, (_, index) => ({ ...emptySalesFunnel(`d${index}`), id: `draft-${index}` })),
    { ...boardA, id: "publicado-vivo" },
  ],
  []
)
assert(clippedBoards.some((item) => item.id === "publicado-vivo"), "hydrate recorta rascunho, não o quadro publicado")
assert(snapshotForLead([boardA, boardB], { funnelId: "funil-a" })?.name === "A", "lead com script usa o quadro daquela landing")
assert(leadFunnelUnread(true, "fun-ads", []), "unread + funil miss não cai no publicado leftover")
assert(!leadFunnelUnread(true, "fun-ads", [{ id: "fun-ads" }]), "funil leftover no KV segue")
assert(!leadFunnelUnread(true, "", [{ id: "fun-other" }]), "sem funnelId usa o publicado leftover")
assert(!leadFunnelUnread(false, "fun-ads", []), "GET confirmado + miss é órfão")
const madeScript = addPageScript([], { name: "Landing Superbet", funnelId: "funil-b" })
assert(madeScript.ok && madeScript.script.funnelId === "funil-b", "cria script de outra página")
assert(cleanTelegramGroupUrl("https://t.me/+abc123").includes("t.me"), "convite t.me passa")
assert(cleanTelegramGroupUrl("https://evil.com/x") === "", "url alheia cai")
assert(cleanTelegramGroupUrl("javascript:alert(1)") === "", "javascript: cai")
assert(sanitizeIncomingLead({ id: " lead-1 ", name: " Ana ", contact: "@ana" })?.name === "Ana", "lead incoming corta espaços")
assert(sanitizeIncomingLead({ id: "lead-ana", contact: "ana" })?.contact === "@ana", "lead incoming normaliza o @")
assert(sanitizeIncomingLead({ id: "" }) === null, "lead sem id cai")
assert(sanitizeIncomingLead({ id: "x".repeat(81) }) === null, "lead com id longo cai")
assert(
  (sanitizeIncomingLead({ id: "lead-2", telegramChatId: "9".repeat(80) })?.telegramChatId ?? "").length === 32,
  "chat id longo é cortado"
)
assert(sanitizeIncomingLead({ id: "lead-3", lastMessage: "z".repeat(800) })?.lastMessage?.length === 400, "lastMessage longo é cortado")
assert(cleanHttpUrl("javascript:alert(1)") === "", "javascript: no funil cai")
assert(
  firstInvalidPublishUrl([{ data: { title: "Oferta", url: "javascript:alert(1)" } }])?.message.includes("inválido"),
  "publicar aponta o link javascript"
)
assert(!firstInvalidPublishUrl([{ data: { title: "Oferta", url: "https://abilion.lol/oferta" } }]), "https do bloco passa")
assert(!firstInvalidPublishUrl([{ data: { title: "Oferta", url: "" } }]), "url vazia do bloco passa")
assert(
  validatePublish(
    [
      { id: "e", type: "entry", position: { x: 0, y: 0 }, data: { title: "Start", entryTrigger: "start" } },
      { id: "o", type: "offer", position: { x: 40, y: 0 }, data: { title: "Oferta", url: "javascript:alert(1)" } },
    ],
    [{ id: "x", source: "e", target: "o" }]
  ).some((item) => item.message.includes("inválido")),
  "validatePublish recusa javascript:"
)
assert(cleanHttpUrl("https://mundoaviator.com.br/premium") === "https://mundoaviator.com.br/premium", "https do funil fica")
assert(cleanHttpUrl("https://user:pass@evil.test/") === "", "URL com userinfo cai")
assert(
  !sanitizeIncomingFunnel({
    id: "funil-url",
    name: "Quadro",
    nodes: [{ id: "n1", type: "offer", position: { x: 0, y: 0 }, data: { title: "Oferta", url: "javascript:alert(1)" } }],
    edges: [],
  })?.nodes[0]?.data.url,
  "sanitize do funil tira javascript:"
)
assert(aliasKey("chat", "9".repeat(200)).length <= "crm:alias:chat:".length + 80, "alias não rebenta a chave do KV")
assert(sanitizeIncomingFunnel({ id: "funil-1", name: "Quadro", nodes: [], edges: [] })?.id === "funil-1", "funil válido passa")
assert(sanitizeIncomingFunnel({ id: "" }) === null, "funil sem id cai")
assert(sanitizeIncomingFunnel({ id: "funil-1", nodes: "nope" }) === null, "funil com nodes inválidos cai")
const brokenNode = sanitizeIncomingFunnel({
  id: "funil-broken",
  name: "Quadro",
  nodes: [{ type: "message", data: { title: "sem id" } }, { id: "ok", type: "message", position: { x: 0, y: 0 }, data: { title: "Ok" } }],
  edges: [],
})
assert(brokenNode?.nodes.length === 1 && brokenNode.nodes[0]?.id === "ok", "nó sem id não derruba o sanitize")
const fatProduction = sanitizeIncomingFunnel({
  id: "funil-fat",
  name: "Gordo",
  nodes: [{ id: "n1", type: "message", position: { x: 0, y: 0 }, data: { title: "x" } }],
  edges: [],
  production: {
    name: "Pub",
    publishedAt: "2026-01-01T00:00:00.000Z",
    nodes: Array.from({ length: 250 }, (_, i) => ({
      id: `p${i}`,
      type: "message",
      position: { x: 0, y: 0 },
      data: { title: "x" },
    })),
    edges: [],
  },
})
assert(fatProduction?.production?.nodes.length === 200, "production também respeita o teto de nós")
const fatBody = sanitizeIncomingFunnel({
  id: "funil-body",
  name: "x".repeat(200),
  nodes: [
    {
      id: "n1",
      type: "message",
      position: { x: 0, y: 0 },
      data: { title: "t".repeat(200), body: "b".repeat(5000), url: `https://exemplo.com/${"u".repeat(600)}` },
    },
  ],
  edges: [],
})
assert(fatBody?.name.length === 80, "nome do funil corta em 80")
assert(fatBody?.nodes[0]?.data.title.length === 80, "título do bloco corta em 80")
assert((fatBody?.nodes[0]?.data.body?.length ?? 0) === 4000, "corpo do bloco corta em 4000")
assert((fatBody?.nodes[0]?.data.url?.length ?? 0) === 500, "url do bloco corta em 500")
const hugeName = migrateSettings({ workspaceName: "W".repeat(200), steWelcome: "S".repeat(800) })
assert(hugeName.workspaceName.length === 80, "settings corta o nome do workspace")
assert(hugeName.steWelcome.length === 500, "settings corta a boas-vindas")
assert(hugeName.telegramBotToken === "", "settings nunca guarda token")
const fatKv = memoryKv()
await fatKv.put(
  CRM_FUNNELS,
  JSON.stringify([
    {
      id: "fat-kv",
      name: "Gordo",
      mode: "sales",
      status: "draft",
      updatedAt: "2026-01-01T00:00:00.000Z",
      nodes: [],
      edges: [],
      production: {
        name: "Pub",
        publishedAt: "2026-01-01T00:00:00.000Z",
        nodes: Array.from({ length: 250 }, (_, i) => ({
          id: `p${i}`,
          type: "message",
          position: { x: 0, y: 0 },
          data: { title: "x" },
        })),
        edges: [],
      },
    },
  ])
)
assert((await loadFunnelsKv(fatKv))[0]?.production?.nodes.length === 200, "leitura do KV corta production gordo")

const publishedA = emptySalesFunnel("A")
publishedA.status = "active"
publishedA.production = { name: "A", publishedAt: publishedA.updatedAt, nodes: publishedA.nodes, edges: publishedA.edges }
assert(!canDeleteFunnel([publishedA], publishedA.id).ok, "último funil não apaga")
const extraDraft = emptySalesFunnel("B")
extraDraft.status = "draft"
assert(canDeleteFunnel([publishedA, extraDraft], extraDraft.id).ok, "rascunho extra apaga")
assert(!canDeleteFunnel([publishedA, extraDraft], publishedA.id).ok, "último publicado não apaga")
const publishedC = emptySalesFunnel("C")
publishedC.status = "active"
publishedC.production = { name: "C", publishedAt: publishedC.updatedAt, nodes: publishedC.nodes, edges: publishedC.edges }
assert(canDeleteFunnel([publishedA, publishedC], publishedA.id).ok, "publicado extra apaga")
const olderPub = { ...publishedA, production: { ...publishedA.production!, publishedAt: "2026-01-01T00:00:00.000Z" } }
const newerPub = { ...publishedC, production: { ...publishedC.production!, publishedAt: "2026-06-01T00:00:00.000Z" } }
assert(publishedFunnel([olderPub, newerPub])?.id === newerPub.id, "Sté usa o quadro publicado mais recente")
assert(publishedFunnel([newerPub, olderPub])?.id === newerPub.id, "a ordem da lista não manda no runtime")
assert(activatePublishedFunnels([olderPub, newerPub], newerPub.id).find((item) => item.id === olderPub.id)?.status === "draft", "publicar um funil desce o outro")
const failedPublish = {
  ...olderPub,
  nodes: olderPub.nodes,
  status: "active" as const,
  production: { ...olderPub.production!, publishedAt: "2026-09-20T00:00:00.000Z" },
}
const revertedPub = revertPublishedFunnels([failedPublish], [olderPub])
assert(revertedPub[0]?.production?.publishedAt === olderPub.production?.publishedAt, "POST falhado devolve o quadro publicado")
assert(revertedPub[0]?.nodes === failedPublish.nodes, "o rascunho local não some no revert")
const samePub = [olderPub]
assert(revertPublishedFunnels(samePub, [olderPub]) === samePub, "sem mudança o revert não clona")
assert(
  enforceSinglePublished([olderPub, newerPub]).filter((item) => item.status === "active" && item.production).length === 1,
  "Worker deixa um só quadro publicado"
)
assert(enforceSinglePublished([olderPub, newerPub]).find((item) => item.status === "active")?.id === newerPub.id, "o publicado que fica é o mais recente")
const localNew = emptySalesFunnel("local")
const older = { ...publishedA, name: "servidor", updatedAt: "2020-01-01T00:00:00.000Z" }
const newerLocal = { ...publishedA, name: "local-novo", updatedAt: "2026-01-01T00:00:00.000Z" }
assert(mergeFunnels([localNew, newerLocal], [older]).some((item) => item.id === localNew.id), "hydrate conserva funil local")
assert(mergeFunnels([newerLocal], [older])[0]?.name === "local-novo", "hydrate não pisa rascunho mais novo")
const keptNewer = reconcileFunnels(
  [{ ...publishedA, updatedAt: "2026-02-01T00:00:00.000Z" }, { ...publishedC, updatedAt: "2026-03-01T00:00:00.000Z" }],
  [{ ...publishedA, name: "cliente", updatedAt: "2026-02-15T00:00:00.000Z" }]
)
assert(keptNewer.some((item) => item.id === publishedC.id), "reconcile conserva funil mais novo no servidor")
assert(keptNewer.find((item) => item.id === publishedA.id)?.name === "cliente", "reconcile aceita o cliente mais novo")
const deletedOld = reconcileFunnels(
  [{ ...publishedA, updatedAt: "2026-01-01T00:00:00.000Z" }, { ...publishedC, updatedAt: "2026-01-02T00:00:00.000Z" }],
  [{ ...publishedA, updatedAt: "2026-04-01T00:00:00.000Z" }]
)
assert(deletedOld.some((item) => item.id === publishedC.id), "sem tombstone o funil mais velho fica")
const newestKept = reconcileFunnels(
  [{ ...publishedA, updatedAt: "2026-01-01T00:00:00.000Z" }, { ...publishedC, updatedAt: "2026-05-01T00:00:00.000Z" }],
  [{ ...publishedA, updatedAt: "2026-04-01T00:00:00.000Z" }]
)
assert(newestKept.some((item) => item.id === publishedC.id), "sem tombstone o funil mais novo fica")
assert(
  !applyRemovedFunnels(newestKept, [publishedC.id]).some((item) => item.id === publishedC.id),
  "tombstone apaga o funil mais novo"
)
const seedWipe = reconcileFunnels(
  [{ ...publishedA, updatedAt: "2024-01-01T00:00:00.000Z" }],
  [{ ...emptySalesFunnel("seed"), updatedAt: "2026-09-20T00:00:00.000Z" }]
)
assert(seedWipe.some((item) => item.id === publishedA.id), "POST só com seed já não apaga o quadro do Worker")
const staleTab = reconcileFunnels(
  [
    { ...publishedA, updatedAt: "2026-01-01T00:00:00.000Z" },
    { ...publishedC, updatedAt: "2026-03-01T00:00:00.000Z" },
  ],
  [{ ...publishedA, name: "separador-velho", updatedAt: "2026-04-01T00:00:00.000Z" }]
)
assert(staleTab.some((item) => item.id === publishedC.id), "separador velho não apaga o funil do outro")
const staleAfterDelete = commitCrmFunnels(
  [
    { ...publishedA, updatedAt: "2026-01-01T00:00:00.000Z" },
    { ...publishedC, updatedAt: "2026-03-01T00:00:00.000Z" },
  ],
  [
    { ...publishedA, updatedAt: "2026-01-01T00:00:00.000Z" },
    { ...publishedC, updatedAt: "2026-03-01T00:00:00.000Z" },
  ],
  [],
  [],
  [{ ...publishedA, updatedAt: "2026-01-01T00:00:00.000Z" }],
  [publishedC.id]
)
assert(!staleAfterDelete.some((item) => item.id === publishedC.id), "POST velho não ressuscita o funil já tombstonado")
assert(staleAfterDelete.some((item) => item.id === publishedA.id), "POST velho conserva o funil que ficou")
const newerDuringFlush = { ...publishedA, name: "editado", updatedAt: "2026-09-20T12:00:00.000Z" }
assert(
  leftoverPendingFunnelIds([publishedA.id], [{ ...publishedA, updatedAt: "2026-09-20T11:00:00.000Z" }], [newerDuringFlush]).includes(
    publishedA.id
  ),
  "rascunho a meio do POST fica na fila"
)
assert(
  leftoverPendingFunnelIds([publishedA.id], [newerDuringFlush], [newerDuringFlush]).length === 0,
  "snapshot já gravado sai da fila"
)
assert(
  leftoverPendingFunnelIds([publishedA.id, publishedC.id], [publishedA, publishedC], [publishedA]).length === 0,
  "funil apagado a meio do POST sai da fila"
)
assert(
  leftoverPendingFunnelIds([publishedC.id], [publishedA], [publishedA, publishedC]).includes(publishedC.id),
  "funil criado a meio do POST fica na fila"
)
const inboxOnly = lead("inbox-1")
assert(
  hydrateLeads([lead("local-1")], { ok: false, leads: [] }, { ok: true, leads: [inboxOnly] }, new Map(), []).some(
    (item) => item.id === "inbox-1"
  ),
  "inbox do retry une sem wipe"
)
assert(
  hydrateLeads([lead("local-1")], { ok: false, leads: [] }, { ok: true, leads: [inboxOnly] }, new Map(), []).some(
    (item) => item.id === "local-1"
  ),
  "inbox do retry conserva o local quando o GET dos leads falhou"
)
assert(
  !hydrateLeads([lead("local-1")], { ok: true, leads: [] }, { ok: true, leads: [] }, new Map(), []).some((item) => item.id === "local-1"),
  "GET leads ok+[] continua a limpar o local"
)
assert(
  hydrateLeads([lead("local-1")], { ok: true, leads: [] }, { ok: true, leads: [inboxOnly] }, new Map(), []).some(
    (item) => item.id === "inbox-1"
  ),
  "inbox entra depois do wipe ok+[]"
)
const phased = hydrateLeads([lead("local-1")], { ok: false, leads: [] }, { ok: true, leads: [inboxOnly] }, new Map(), [])
assert(
  !hydrateLeads(phased, { ok: true, leads: [] }, { ok: false, leads: [] }, new Map(), []).some((item) => item.id === "inbox-1"),
  "dois setState (inbox e depois GET vazio) apagariam a inbox — o hydrate tem de ir junto"
)
assert(
  hydrateLeads(phased, { ok: true, leads: [] }, { ok: true, leads: [inboxOnly] }, new Map(), []).some((item) => item.id === "inbox-1"),
  "o mesmo GET vazio com a inbox no mesmo hydrate conserva o Telegram"
)
assert(withSafeNext("/login", "/pagina-inexistente") === "/login", "404 do painel não vira next")
assert(withSafeNext("/login", "/conversas?q=ana") === "/login?next=%2Fconversas%3Fq%3Dana", "next leva a query da rota")
assert(
  !hydrateLeads([inboxOnly], { ok: false, leads: [] }, { ok: true, leads: [inboxOnly] }, new Map(), ["inbox-1"]).some(
    (item) => item.id === "inbox-1"
  ),
  "inbox do retry respeita tombstone"
)
assert(
  overlayPendingLeads([inboxOnly], new Map(), ["inbox-1"]).length === 0,
  "overlay sem fila ainda aplica tombstone"
)
const pageA = lead("page-a")
const pageB = lead("page-b")
assert(collectLeadPages([{ leads: [pageA], nextCursor: "c1" }, { leads: [pageB] }]).ok, "duas páginas completas entram")
assert(collectLeadPages([{ leads: [pageA], nextCursor: "c1" }, { leads: [pageB] }]).leads.map((item) => item.id).join() === "page-a,page-b", "páginas somam")
assert(collectLeadPages([{ leads: [] }]).ok && collectLeadPages([{ leads: [] }]).leads.length === 0, "primeira página vazia é lista completa")
assert(collectLeadPages([{ leads: [pageA], nextCursor: "c1" }, { leads: [], stale: true }]).retry, "cursor velho pede retry")
assert(!collectLeadPages([{ leads: [pageA], nextCursor: "c1" }, { leads: [], stale: true }]).ok, "cursor velho não finge lista completa")
assert(collectLeadPages([{ leads: [pageA], nextCursor: "c1" }, { leads: [] }]).retry, "página seguinte vazia sem stale também retenta")
assert(collectLeadPages([{ leads: [pageA], nextCursor: "c1" }]).retry, "ainda há cursor, lista incompleta")
assert(!collectLeadPages([{ leads: [pageA], nextCursor: "c1" }]).ok, "lista cortada não reconcilia")
assert(collectLeadPages([{ leads: [pageA], nextCursor: "c1" }], "window").ok, "janela cheia do hydrate conta")
assert(collectLeadPages([{ leads: [pageA], nextCursor: "c1" }], "window").leads[0]?.id === "page-a", "janela cheia conserva os leads")
assert(collectLeadPages([{ leads: [pageA], nextCursor: "c1" }], "window").complete === false, "janela cheia não é lista completa")
assert(collectLeadPages([{ leads: [pageA], nextCursor: "c1" }, { leads: [pageB] }]).complete, "sem cursor residual a lista está completa")
assert(collectLeadPages([{ leads: [pageA], nextCursor: "c1", clipped: true }, { leads: [pageB] }]).complete === false, "clipped no meio não é universo")
assert(collectLeadPages([{ leads: [pageA], clipped: true }]).ok, "índice no teto ainda entrega a página")
assert(collectLeadPages([{ leads: [pageA], clipped: true }]).complete === false, "índice no teto não é lista completa")
assert(collectLeadPages([{ leads: [], clipped: true }]).complete === false, "página vazia no teto não é lista completa")
assert(leadPageFromRemote(null, 400, true).clipped, "Postgres em baixo marca clipped")
assert(!leadPageFromRemote(null, 400, false).clipped, "sem credenciais não finge falha do Postgres")
assert(!leadPageFromRemote([], 400, true).clipped, "Postgres vazio é lista completa")
const remoteFull = Array.from({ length: 400 }, (_, index) => ({
  ...lead(`pg-${index}`),
  updatedAt: `2026-01-01T00:00:${String(index % 60).padStart(2, "0")}.000Z`,
}))
const remoteFullPage = leadPageFromRemote(remoteFull, 400, true)
assert(remoteFullPage.clipped === true, "página cheia do backup não é universo")
assert(remoteFullPage.nextCursor === leadPageCursor(remoteFull[399]), "página cheia do backup leva cursor")
assert(!leadPageFromRemote(remoteFull.slice(0, 3), 400, true).clipped, "página curta do backup é completa")
assert(remoteLeadListPath("all", 400).includes("order=updated_at.desc,id.desc"), "backup ordena por updated_at")
assert(
  remoteLeadListPath("telegram", 400, "2026-01-01T00:00:00.000Z|abc").includes("updated_at.lt.2026-01-01T00:00:00.000Z"),
  "cursor do backup vira keyset no Postgres"
)
assert(leadFactsForRemote({ ...lead("cat-1"), category: "Grupo" }).category === "Grupo", "facts do backup levam a categoria")
assert(
  leadFactsForRemote({
    ...lead("cat-1"),
    events: [{ id: "ev-offer", at: "2026-01-02T00:00:00.000Z", kind: "offer", title: "App" }],
  }).timeline?.some((item) => item.id === "ev-offer"),
  "facts do backup levam a timeline"
)
assert(!("timeline" in (leadFactsForRemote({ ...lead("cat-1"), events: [] }) as { timeline?: unknown })), "sem eventos o jsonb não inventa timeline")
assert(sanitizeRemoteSearchNeedle("ana,(id.eq.x)") === "anaid.eq.x", "needle da busca corta vírgulas e parênteses")
assert(remoteLeadSearchPath("ab") === "", "busca curta não monta filtro no Postgres")
assert(remoteLeadSearchPath("!!!") === "", "needle só pontuação não monta filtro")
assert(remoteLeadSearchPath("look-me").includes("id.eq.look-me"), "busca pelo id vai no eq")
assert(remoteLeadSearchPath("Grupo Premium").includes("name.ilike.*Grupo Premium*"), "busca pelo nome vai no ilike")
assert(remoteLeadSearchPath("Grupo Premium").includes("facts->>category.ilike.*Grupo Premium*"), "busca pela categoria vai no jsonb")
assert(!remoteLeadSearchPath("foo,bar").includes("foo,bar"), "vírgula do operador não entra no or=")
const fromFacts = rowToLead({
  id: "cat-1",
  name: "Ana",
  contact: "@ana",
  channel: "telegram",
  campaign: "",
  origin: "import",
  temperature: "novo",
  stage: "capture",
  facts: { category: "Grupo", email: "ana@abilion.com" },
  updated_at: "2026-01-01T00:00:00.000Z",
  created_at: "2026-01-01T00:00:00.000Z",
})
assert(fromFacts.category === "Grupo", "rowToLead recupera a categoria do jsonb")
assert(fromFacts.facts.email === "ana@abilion.com" && !("category" in fromFacts.facts), "categoria não fica à mistura nos facts do painel")
const fromTimeline = rowToLead({
  id: "cat-1",
  name: "Ana",
  contact: "@ana",
  channel: "telegram",
  campaign: "",
  origin: "import",
  temperature: "novo",
  stage: "offer",
  facts: {
    email: "ana@abilion.com",
    timeline: [{ id: "ev-offer", at: "2026-01-02T00:00:00.000Z", kind: "offer", title: "App" }],
  },
  updated_at: "2026-01-01T00:00:00.000Z",
  created_at: "2026-01-01T00:00:00.000Z",
})
assert(fromTimeline.events.some((item) => item.id === "ev-offer" && item.kind === "offer"), "rowToLead recupera a timeline do jsonb")
assert(!("timeline" in fromTimeline.facts), "timeline não fica à mistura nos facts do painel")
assert(sanitizeLeadEvents([{ id: "bad", at: "t", kind: "nope" }]).length === 0, "kind inventado não entra na timeline")
assert(sanitizeLeadEvents([{ id: "ev-1", at: "2026-01-01T00:00:00.000Z", kind: "offer" }])[0]?.id === "ev-1", "evento válido passa")
assert(LEAD_LIST_PAGES === 40, "hydrate lê até 40 páginas")
assert(LEAD_LIST_CAP === 16_000, "lista hidratada cabe o índice (8000 chats + 4000 resto + esperas)")
assert(LEAD_CACHE_CAP === 2000, "localStorage só guarda os 2000 mais novos")
const agedCache = ["old-a", "old-b", "old-c"].map((id, index) => ({
  ...lead(id, `@${id}`),
  updatedAt: `2020-01-0${index + 1}T00:00:00.000Z`,
}))
const freshCache = { ...lead("fresh", "@fresh"), updatedAt: "2026-09-20T00:00:00.000Z" }
const storedCache = cacheLeadsForStorage([freshCache, ...agedCache], ["old-c"], 2)
assert(storedCache.some((item) => item.id === "old-c"), "cache do browser segura o lead ainda por gravar")
assert(storedCache.some((item) => item.id === "fresh"), "cache do browser ainda guarda o mais novo")
assert(!storedCache.some((item) => item.id === "old-a"), "cache do browser larga o velho já gravado")
try {
  await saveFunnelsKv(
    memoryKv(),
    Array.from({ length: 21 }, () => emptySalesFunnel("extra"))
  )
  assert(false, "saveFunnelsKv 21 não pode cortar em silêncio")
} catch (error) {
  assert(error instanceof Error && error.message.includes("20"), "saveFunnelsKv recusa o 21.º")
}
assert(steWaitDelayMs(undefined) === null, "sem espera não agenda tick")
assert(steWaitDelayMs(new Date(Date.now() + 1000).toISOString(), Date.now()) === 1050, "espera futura agenda com folga")
assert(steWaitDelayMs(new Date(Date.now() - 1000).toISOString(), Date.now()) === 50, "espera atrasada dispara já")
assert(steWaitDelayMs(new Date(Date.now() + 2 * 86_400_000).toISOString(), Date.now()) === null, "espera de dias não fica no browser")
assert(
  settingsWriteFingerprint({ ...defaultSettings, telegramBotToken: "secret" }) ===
    settingsWriteFingerprint({ ...defaultSettings, telegramBotToken: "" }),
  "fingerprint do settings ignora o token"
)
assert(
  settingsWriteFingerprint({ ...defaultSettings, telegramBotUsername: "novo" }) !== settingsWriteFingerprint(defaultSettings),
  "fingerprint muda com a fala da Sté"
)
assert(leadPersistSync({ readKnown: false, readOk: false, pendingWrites: 0 }) === "idle", "ainda sem GET dos leads")
assert(leadPersistSync({ readKnown: true, readOk: true, pendingWrites: 0 }) === "ok", "GET ok sem fila")
assert(leadPersistSync({ readKnown: true, readOk: true, pendingWrites: 1 }) === "error", "GET ok não esconde POST pendente")
assert(
  leadPersistSync({ readKnown: true, readOk: false, pendingWrites: 0, writeOk: true }) === "error",
  "POST ok não esconde GET falhado"
)
assert(
  leadPersistSync({ readKnown: true, readOk: true, pendingWrites: 0, writeOk: false }) === "error",
  "DELETE falhou continua erro"
)
assert(leadCatalogClipped("ok", false), "GET 200 clipped não confirma o catálogo")
assert(!leadCatalogClipped("ok", true), "GET completo confirma o catálogo")
assert(!leadCatalogClipped("error", false), "GET falho não é clipped")
assert(!leadCatalogClipped("idle", false), "ainda sem GET não é clipped")
assert(leadsExportBlocked("ok", false), "GET clipped não solta o CSV")
assert(!leadsExportBlocked("ok", true), "GET completo solta o CSV")
assert(leadsExportBlocked("error", true), "GET falho não solta o CSV")
assert(leadsExportBlocked("idle", false), "ainda sem GET não solta o CSV")
assert(leadCatalogEmpty("ok", true, 0), "GET completo vazio é vazio")
assert(!leadCatalogEmpty("ok", false, 0), "GET clipped vazio não é catálogo vazio")
assert(!leadCatalogEmpty("ok", true, 2), "GET completo com leads não é vazio")
assert(!leadWritesBlocked("ok"), "GET clipped ainda deixa gravar lead")
assert(remoteSearchBlank("ab", 0, "idle") === "local", "busca curta é filtro local")
assert(remoteSearchBlank("ana", 0, "idle") === "loading", "debounce não é vazio")
assert(remoteSearchBlank("ana", 0, "loading") === "loading", "pedido em voo")
assert(remoteSearchBlank("ana", 0, "error") === "error", "GET q= falhou não é vazio")
assert(remoteSearchBlank("ana", 0, "ok") === "empty", "Worker e local vazios")
assert(remoteSearchBlank("ana", 1, "error") === "hits", "acerto local não some se o Worker falhar")
const settingsLive = migrateSettings({ telegramBotUsername: "@ste_bot", plugins: { telegram: true } })
const settingsStale = migrateSettings({ telegramBotUsername: "", workspaceName: "Abilion" })
assert(
  commitStoredSettings(settingsStale, settingsStale, settingsLive).telegramBotUsername === "@ste_bot",
  "autosave vazio não apaga o username do Vincular"
)
assert(commitStoredSettings(settingsStale, settingsStale, settingsLive).plugins.telegram, "autosave vazio não desliga o plugin do Telegram")
assert(
  commitStoredSettings(settingsLive, migrateSettings({ telegramBotUsername: "@novo_bot" }), settingsLive).telegramBotUsername ===
    "@novo_bot",
  "username novo substitui"
)
const scriptKept = addPageScript([], { name: "Landing A", funnelId: "funil-b" })
assert(scriptKept.ok, "script de teste")
const settingsWithScript = migrateSettings({ pageScripts: scriptKept.scripts })
assert(
  commitStoredSettings(settingsWithScript, migrateSettings({ workspaceName: "Abilion" }), settingsWithScript).pageScripts[0]?.id ===
    scriptKept.script.id,
  "autosave vazio não apaga scripts de página"
)
const afterDelete = removePageScript(scriptKept.scripts, scriptKept.script.id)
const settingsDeleted = commitStoredSettings(
  settingsWithScript,
  migrateSettings({ pageScripts: afterDelete, removedPageScripts: [scriptKept.script.id] }),
  settingsWithScript
)
assert(settingsDeleted.pageScripts.length === 0, "tombstone remove o último script")
const settingsKvEmpty = migrateSettings({ workspaceName: "Abilion" })
const settingsPg = migrateSettings({
  telegramBotUsername: "@ste_bot",
  pageScripts: scriptKept.scripts,
  leadCategories: ["VIP"],
})
const settingsAdopted = adoptSettingsStores(settingsKvEmpty, settingsPg)
assert(settingsAdopted.telegramBotUsername === "@ste_bot", "KV vazio recupera o username do Postgres")
assert(settingsAdopted.pageScripts[0]?.id === scriptKept.script.id, "KV vazio recupera os scripts do Postgres")
assert(settingsAdopted.leadCategories.includes("VIP"), "KV vazio recupera as categorias do Postgres")
assert(adoptSettingsStores(settingsLive, settingsKvEmpty).telegramBotUsername === "@ste_bot", "KV vivo ganha a um Postgres vazio")
const adoptedKv = memoryKv()
assert(
  (await loadAdoptedSettings(adoptedKv, settingsPg)).telegramBotUsername === "@ste_bot",
  "loadAdoptedSettings lê KV oco + Postgres"
)
const kvBoard = emptySalesFunnel("Quadro KV")
const pgBoard = emptySalesFunnel("Quadro PG")
assert(adoptFunnelStores([], [pgBoard])[0]?.name === "Quadro PG", "KV vazio recupera funis do Postgres")
assert(adoptFunnelStores([kvBoard], [pgBoard])[0]?.name === "Quadro KV", "KV com quadro ganha ao Postgres")
assert(
  adoptFunnelStores([kvBoard], [pgBoard]).some((item) => item.id === pgBoard.id),
  "KV com quadro já não esconde o funil que só está no Postgres"
)
assert(adoptFunnelStores([kvBoard], [], [kvBoard.id]).length === 0, "tombstone remove o funil do KV")
assert(adoptFunnelStores([], [pgBoard], [pgBoard.id]).length === 0, "tombstone remove o funil do Postgres")
const adoptFunnelKv = memoryKv()
await saveFunnelsKv(adoptFunnelKv, [kvBoard])
assert((await loadWorkspaceFunnels({ AUTH: adoptFunnelKv }))[0]?.name === "Quadro KV", "loadWorkspaceFunnels lê o KV")
assert((await loadWorkspaceFunnels({ AUTH: memoryKv() })).length === 0, "loadWorkspaceFunnels sem KV nem Postgres fica vazio")
const pgDownPrev = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (String(input).includes("/rest/v1/")) throw new Error("postgres down")
  return pgDownPrev(input, init)
}) as typeof fetch
const pgDownEnv = { AUTH: memoryKv(), SUPABASE_URL: "https://sb.test", SUPABASE_SERVICE_ROLE: "role" }
try {
  await loadWorkspaceFunnels(pgDownEnv)
  assert(false, "loadWorkspaceFunnels sem KV e Postgres em baixo tem de falhar")
} catch (error) {
  assert(error instanceof Error && error.message.includes("Postgres"), "loadWorkspaceFunnels não finge funis vazios")
}
assert((await loadWorkspaceSettings(pgDownEnv)).telegramBotUsername === "", "settings ocas no KV não fingem o Postgres")
await saveSettingsKv(pgDownEnv.AUTH, migrateSettings({ telegramBotUsername: "@ste_bot" }))
assert((await loadWorkspaceSettings(pgDownEnv)).telegramBotUsername === "@ste_bot", "settings no KV sobrevivem ao Postgres em baixo")
assert((await loadWorkspaceFunnels({ AUTH: adoptFunnelKv, SUPABASE_URL: "https://sb.test", SUPABASE_SERVICE_ROLE: "role" }))[0]?.name === "Quadro KV", "KV com quadro não depende do Postgres")
const unreadBoards = await readWorkspaceFunnels({ AUTH: adoptFunnelKv, SUPABASE_URL: "https://sb.test", SUPABASE_SERVICE_ROLE: "role" })
assert(unreadBoards.unread && unreadBoards.funnels[0]?.name === "Quadro KV", "KV com quadro e Postgres em baixo é funis unread")
assert(!(await readWorkspaceFunnels({ AUTH: adoptFunnelKv })).unread, "sem credenciais o KV não é unread")
globalThis.fetch = pgDownPrev
const unionLoadPrev = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (String(input).includes("/rest/v1/funnels") && (init?.method || "GET").toUpperCase() === "GET") {
    return new Response(
      JSON.stringify([
        {
          id: pgBoard.id,
          name: pgBoard.name,
          mode: pgBoard.mode,
          status: pgBoard.status,
          updated_at: pgBoard.updatedAt,
          nodes: pgBoard.nodes,
          edges: pgBoard.edges,
          production: pgBoard.production ?? null,
        },
      ]),
      { status: 200 }
    )
  }
  return unionLoadPrev(input, init)
}) as typeof fetch
const unionLoaded = await loadWorkspaceFunnels({
  AUTH: adoptFunnelKv,
  SUPABASE_URL: "https://sb.test",
  SUPABASE_SERVICE_ROLE: "role",
})
assert(
  unionLoaded.some((item) => item.id === kvBoard.id) && unionLoaded.some((item) => item.id === pgBoard.id),
  "GET dos funis junta o quadro do KV com o do Postgres"
)
globalThis.fetch = unionLoadPrev
const adoptGoneKv = memoryKv()
await rememberRemovedFunnels(adoptGoneKv, [kvBoard.id])
await saveFunnelsKv(adoptGoneKv, [kvBoard])
assert((await loadWorkspaceFunnels({ AUTH: adoptGoneKv })).length === 0, "loadWorkspaceFunnels aplica tombstone do funil")
const remotePosts: string[] = []
const remotePrev = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  const method = (init?.method || "GET").toUpperCase()
  if (url.includes("/rest/v1/funnels") && method === "POST") {
    remotePosts.push(String(init?.body || ""))
    return new Response("", { status: 201 })
  }
  if (url.includes("/rest/v1/funnels") && method === "GET") {
    return new Response(JSON.stringify([{ id: "gone-remote" }]), { status: 200 })
  }
  if (url.includes("/rest/v1/funnels") && method === "DELETE") {
    remotePosts.push(`DELETE ${url}`)
    return new Response("", { status: 204 })
  }
  if (url.includes("/rest/v1/settings") && method === "GET") {
    return new Response(JSON.stringify([]), { status: 200 })
  }
  if (url.includes("/rest/v1/settings") && method === "POST") {
    remotePosts.push(String(init?.body || ""))
    return new Response("", { status: 201 })
  }
  if (url.includes("/rest/v1/leads") && method === "GET") {
    return new Response(JSON.stringify([]), { status: 200 })
  }
  if (url.includes("/rest/v1/leads") && method === "POST") {
    remotePosts.push(String(init?.body || ""))
    return new Response("", { status: 201 })
  }
  return remotePrev(input, init)
}) as typeof fetch
const remoteEnv = { SUPABASE_URL: "https://sb.test", SUPABASE_SERVICE_ROLE: "role" }
const remoteBoard = emptySalesFunnel("Quadro remoto")
await persistRemoteFunnels(remoteEnv, [remoteBoard])
assert(remotePosts.some((item) => item.includes(remoteBoard.id) && item.includes("Quadro remoto")), "persistRemoteFunnels grava o funil no Postgres")
assert(
  !remotePosts.some((item) => item.includes("DELETE") && item.includes("gone-remote")),
  "funil remoto sem tombstone não é apagado só porque o KV tem outro quadro"
)
const extraBoard = emptySalesFunnel("Quadro extra")
const unionPosts: string[] = []
const unionDeletes: string[] = []
const unionPrev = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  const method = (init?.method || "GET").toUpperCase()
  if (url.includes("/rest/v1/funnels") && method === "GET") {
    return new Response(
      JSON.stringify([
        {
          id: extraBoard.id,
          name: extraBoard.name,
          mode: extraBoard.mode,
          status: extraBoard.status,
          updated_at: extraBoard.updatedAt,
          nodes: extraBoard.nodes,
          edges: extraBoard.edges,
          production: extraBoard.production ?? null,
        },
      ]),
      { status: 200 }
    )
  }
  if (url.includes("/rest/v1/funnels") && method === "POST") {
    unionPosts.push(String(init?.body || ""))
    return new Response("", { status: 201 })
  }
  if (url.includes("/rest/v1/funnels") && method === "DELETE") {
    unionDeletes.push(url)
    return new Response("", { status: 204 })
  }
  return unionPrev(input, init)
}) as typeof fetch
await persistRemoteFunnels(remoteEnv, [remoteBoard])
assert(
  unionPosts.some((item) => item.includes(remoteBoard.id) && item.includes(extraBoard.id)),
  "persistRemoteFunnels junta o quadro do KV com o do Postgres"
)
assert(unionDeletes.length === 0, "quadro extra sem tombstone sobrevive ao persist")
const goneFunnelKv = memoryKv()
await rememberRemovedFunnels(goneFunnelKv, [extraBoard.id])
unionDeletes.length = 0
unionPosts.length = 0
await persistRemoteFunnels({ AUTH: goneFunnelKv, ...remoteEnv }, [remoteBoard])
assert(unionDeletes.some((item) => item.includes(extraBoard.id)), "tombstone do funil apaga o backup")
assert(!unionPosts.some((item) => item.includes(extraBoard.id)), "tombstone não volta a gravar o funil no Postgres")
globalThis.fetch = unionPrev
await persistRemoteSettings(remoteEnv, migrateSettings({ telegramBotUsername: "@ste_bot" }))
assert(remotePosts.some((item) => item.includes("@ste_bot")), "persistRemoteSettings grava settings no Postgres")
const mergePosts: string[] = []
const mergePrev = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  const method = (init?.method || "GET").toUpperCase()
  if (url.includes("/rest/v1/settings") && method === "GET") {
    return new Response(
      JSON.stringify([{ data: { telegramBotUsername: "@keep_bot", pageScripts: scriptKept.scripts, leadCategories: ["VIP"] } }]),
      { status: 200 }
    )
  }
  if (url.includes("/rest/v1/settings") && method === "POST") {
    mergePosts.push(String(init?.body || ""))
    return new Response("", { status: 201 })
  }
  return mergePrev(input, init)
}) as typeof fetch
await persistRemoteSettings(remoteEnv, migrateSettings({ notifyNewLead: false }))
const mergedRemote = JSON.parse(mergePosts.at(-1) || "{}") as {
  data?: { telegramBotUsername?: string; pageScripts?: Array<{ id?: string }>; leadCategories?: string[] }
}
assert(mergedRemote.data?.telegramBotUsername === "@keep_bot", "POST oco não apaga o username do Postgres")
assert(
  mergedRemote.data?.pageScripts?.some((item) => item.id === scriptKept.script.id),
  "POST oco não apaga os scripts do Postgres"
)
assert(mergedRemote.data?.leadCategories?.includes("VIP"), "POST oco não apaga as categorias do Postgres")
const skipPosts: string[] = []
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  const method = (init?.method || "GET").toUpperCase()
  if (url.includes("/rest/v1/settings") && method === "GET") return new Response("nope", { status: 500 })
  if (url.includes("/rest/v1/settings") && method === "POST") {
    skipPosts.push(String(init?.body || ""))
    return new Response("", { status: 201 })
  }
  return mergePrev(input, init)
}) as typeof fetch
await persistRemoteSettings(remoteEnv, migrateSettings({ telegramBotUsername: "" }))
assert(skipPosts.length === 0, "GET falho das definições não grava settings ocas no Postgres")
const unreadEnv = { SUPABASE_URL: "https://sb.test", SUPABASE_SERVICE_ROLE: "role" }
const unread = await readWorkspaceSettings(unreadEnv)
assert(unread.unread && unread.settings.telegramBotUsername === "", "settings sem confirmação do Postgres ficam unread")
globalThis.fetch = mergePrev
let leadTries = 0
const retryPrev = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  const method = (init?.method || "GET").toUpperCase()
  if (url.includes("/rest/v1/leads") && method === "POST") {
    leadTries += 1
    if (leadTries < 3) return new Response("nope", { status: 500 })
    remotePosts.push(String(init?.body || ""))
    return new Response("", { status: 201 })
  }
  return retryPrev(input, init)
}) as typeof fetch
const retryLead = leadFromImport({ name: "Retry", contact: "@retry" })
await persistRemoteLead(remoteEnv, retryLead)
assert(leadTries === 3 && remotePosts.some((item) => item.includes(retryLead.id)), "persistRemoteLead insiste no Postgres")
globalThis.fetch = retryPrev
const remoteLead = leadFromImport({ name: "Rita", contact: "@rita" })
await persistRemoteLead(remoteEnv, remoteLead)
assert(remotePosts.some((item) => item.includes(remoteLead.id) && item.includes("@rita")), "persistRemoteLead grava o lead no Postgres")
const ritaPost = JSON.parse(remotePosts.find((item) => item.includes(remoteLead.id) && item.includes("@rita")) || "{}") as { category?: string; facts?: { category?: string } }
assert(!("category" in ritaPost), "persistRemoteLead não manda coluna category")
const groupedRemote = leadFromImport({ name: "Grupo", contact: "@grp" }, { toGroup: true })
await persistRemoteLead(remoteEnv, groupedRemote)
const groupedPost = JSON.parse(remotePosts.filter((item) => item.includes(groupedRemote.id)).at(-1) || "{}") as {
  category?: string
  facts?: { category?: string }
}
assert(!("category" in groupedPost), "lead do grupo também não manda coluna category")
assert(groupedPost.facts?.category === "Grupo", "categoria do grupo vai no jsonb facts")
const talkPosts: string[] = []
const talkPrev = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  const method = (init?.method || "GET").toUpperCase()
  if (url.includes("/rest/v1/leads") && method === "GET") {
    return new Response(
      JSON.stringify([
        {
          id: remoteLead.id,
          name: "Rita Backup",
          contact: "@rita",
          channel: "telegram",
          campaign: "fb",
          origin: "facebook",
          temperature: "hot",
          stage: "chat",
          memory: "ste:welcome",
          facts: {
            email: "rita@keep.test",
            timeline: [{ id: "ev-keep", at: "2026-01-01T00:00:00.000Z", kind: "entered", title: "Entrou" }],
          },
          last_message: "oi do backup",
          messages: [{ id: "m-keep", role: "lead", text: "oi do backup", at: "2026-01-01T00:00:00.000Z" }],
          updated_at: "2026-01-02T00:00:00.000Z",
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ]),
      { status: 200 }
    )
  }
  if (url.includes("/rest/v1/leads") && method === "POST") {
    talkPosts.push(String(init?.body || ""))
    return new Response("", { status: 201 })
  }
  return talkPrev(input, init)
}) as typeof fetch
await persistRemoteLead(remoteEnv, {
  ...remoteLead,
  messages: [],
  memory: "",
  facts: {},
  lastMessage: undefined,
  updatedAt: "2026-08-01T00:00:00.000Z",
})
const talkSaved = JSON.parse(talkPosts.at(-1) || "{}") as {
  messages?: Array<{ id?: string; text?: string }>
  memory?: string
  facts?: { email?: string; timeline?: Array<{ id?: string }> }
}
assert(talkSaved.messages?.some((item) => item.id === "m-keep"), "POST oco do lead não apaga as falas do Postgres")
assert(talkSaved.memory === "ste:welcome", "POST oco do lead não apaga a memória do Postgres")
assert(talkSaved.facts?.email === "rita@keep.test", "POST oco do lead não apaga o e-mail do Postgres")
assert(talkSaved.facts?.timeline?.some((item) => item.id === "ev-keep"), "POST oco do lead não apaga a timeline do jsonb")
const skipLeadPosts: string[] = []
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  const method = (init?.method || "GET").toUpperCase()
  if (url.includes("/rest/v1/leads") && method === "GET") return new Response("nope", { status: 500 })
  if (url.includes("/rest/v1/leads") && method === "POST") {
    skipLeadPosts.push(String(init?.body || ""))
    return new Response("", { status: 201 })
  }
  return talkPrev(input, init)
}) as typeof fetch
await persistRemoteLead(remoteEnv, { ...remoteLead, messages: [] })
assert(skipLeadPosts.length === 0, "GET falho do lead não grava ficha oca no Postgres")
globalThis.fetch = talkPrev
const wsPersistKv = memoryKv()
const wsBoard = emptySalesFunnel("Quadro workspace")
await persistWorkspaceFunnels({ AUTH: wsPersistKv, ...remoteEnv }, [wsBoard])
assert((await loadFunnelsKv(wsPersistKv))[0]?.id === wsBoard.id, "persistWorkspaceFunnels grava o KV")
assert(remotePosts.some((item) => item.includes(wsBoard.id)), "persistWorkspaceFunnels também grava o Postgres")
await persistWorkspaceSettings({ AUTH: wsPersistKv, ...remoteEnv }, migrateSettings({ telegramBotUsername: "@ws_bot" }))
assert(remotePosts.some((item) => item.includes("@ws_bot")), "persistWorkspaceSettings grava settings no Postgres")
const postsBeforeSkip = remotePosts.length
await persistRemoteFunnels({ AUTH: memoryKv() }, [remoteBoard])
assert(remotePosts.length === postsBeforeSkip, "sem service role o persist remoto não fala com o Postgres")
const failDeletes: string[] = []
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  const method = (init?.method || "GET").toUpperCase()
  if (url.includes("/rest/v1/funnels") && method === "POST") return new Response("nope", { status: 500 })
  if (url.includes("/rest/v1/funnels") && method === "GET") {
    return new Response(JSON.stringify([{ id: "keep-backup" }]), { status: 200 })
  }
  if (url.includes("/rest/v1/funnels") && method === "DELETE") {
    failDeletes.push(url)
    return new Response("", { status: 204 })
  }
  return remotePrev(input, init)
}) as typeof fetch
await persistRemoteFunnels(remoteEnv, [remoteBoard])
assert(failDeletes.length === 0, "POST falho dos funis não apaga o backup")
const unreadFunnelPosts: string[] = []
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  const method = (init?.method || "GET").toUpperCase()
  if (url.includes("/rest/v1/funnels") && method === "GET") return new Response("nope", { status: 500 })
  if (url.includes("/rest/v1/funnels") && method === "POST") {
    unreadFunnelPosts.push(String(init?.body || ""))
    return new Response("", { status: 201 })
  }
  return remotePrev(input, init)
}) as typeof fetch
await persistRemoteFunnels(remoteEnv, [{ ...remoteBoard, name: "Quadro velho do KV", updatedAt: "2026-01-01T00:00:00.000Z" }])
assert(unreadFunnelPosts.length === 0, "GET falho dos funis não grava o quadro velho do KV no Postgres")
globalThis.fetch = remotePrev
assert(
  !settingsPersistSettled(
    migrateSettings({ telegramBotUsername: "@a", leadCategories: ["VIP"] }),
    migrateSettings({ telegramBotUsername: "@a", leadCategories: ["Outro"] })
  ),
  "categorias diferentes não fecham o persist"
)
assert(
  !settingsPersistSettled(
    migrateSettings({ telegramBotUsername: "@a", steWelcomeLines: ["Um", "Dois", "Três"] }),
    migrateSettings({ telegramBotUsername: "@a", steWelcomeLines: ["Outro", "Dois", "Três"] })
  ),
  "falas da Sté diferentes não fecham o persist"
)
assert(
  !settingsPersistSettled(migrateSettings({ workspaceName: "A" }), migrateSettings({ workspaceName: "B" })),
  "nome do workspace diferente não fecha o persist"
)
const setKv = memoryKv()
await saveSettingsKv(setKv, migrateSettings({ telegramBotUsername: "@ste_bot", leadCategories: ["VIP"] }))
await persistSettingsMerge(setKv, migrateSettings({ pageScripts: scriptKept.scripts, leadCategories: ["VIP"] }))
const afterSet = await loadSettingsKv(setKv)
assert(afterSet.leadCategories.includes("VIP"), "merge de settings conserva categorias")
assert(afterSet.pageScripts[0]?.id === scriptKept.script.id, "merge de settings conserva scripts")
assert(afterSet.telegramBotUsername.includes("ste_bot"), "merge de settings não apaga o username")
const funnelKeep = emptySalesFunnel("Keep")
const funnelExtra = emptySalesFunnel("Extra")
const funnelKv = memoryKv()
await saveFunnelsKv(funnelKv, [funnelKeep])
const mergedFunnels = await persistFunnelsMerge(funnelKv, [funnelKeep, funnelExtra])
assert(
  mergedFunnels.some((item) => item.id === funnelKeep.id) && mergedFunnels.some((item) => item.id === funnelExtra.id),
  "persist de funis une o quadro novo sem largar o outro"
)
const goneFunnel = emptySalesFunnel("Gone")
await rememberRemovedFunnels(funnelKv, [goneFunnel.id])
await funnelKv.put(CRM_REMOVED_FUNNELS, JSON.stringify({ ids: [] }))
assert(await isFunnelRemoved(funnelKv, goneFunnel.id), "funil apagado fica gone depois do recorte")
const keptAfterGone = await persistFunnelsMerge(funnelKv, [funnelKeep, goneFunnel])
assert(
  keptAfterGone.some((item) => item.id === funnelKeep.id) && !keptAfterGone.some((item) => item.id === goneFunnel.id),
  "merge não ressuscita funil gone"
)
assert(parseLeadImportLine("Ana Silva, 11987654321")?.contact === "11987654321", "import lê nome e telefone")
assert(parseLeadImportLine("@carlos")?.contact === "@carlos", "import lê @user")
assert(parseLeadImportText("Ana, 11987654321\nAna, 11987654321").rows.length === 1, "import não duplica o mesmo contacto")
const importedGroup = leadFromImport({ name: "Ana", contact: "11987654321" }, { toGroup: true, groupUrl: "https://t.me/+abc" })
assert(importedGroup.origin === "import" && importedGroup.stage === "group" && importedGroup.category === "Grupo", "import para o grupo")
assert(importedGroup.channel === "whatsapp", "telefone importado fica WhatsApp")
assert(importedGroup.memory.includes("t.me"), "import para o grupo guarda o convite")
assert(leadImportGroupBlocked("error", ""), "import toGroup bloqueia se settings unread sem URL")
assert(leadImportGroupBlocked("idle", ""), "import toGroup bloqueia enquanto as settings carregam sem URL")
assert(!leadImportGroupBlocked("ok", ""), "import toGroup sem URL confirmado continua")
assert(!leadImportGroupBlocked("error", "https://t.me/+abc"), "import toGroup unread com URL no KV segue")
assert(leadCategoriesListBlocked(true, []), "categorias unread e ocas bloqueiam criar")
assert(leadCategoriesListBlocked(true, undefined), "categorias unread sem lista bloqueiam criar")
assert(!leadCategoriesListBlocked(true, ["VIP"]), "categorias unread com lista no KV seguem no select")
assert(!leadCategoriesListBlocked(false, []), "categorias lidas vazias não bloqueiam criar")
assert(leadCategoriesWriteBlocked(true), "categorias unread bloqueiam criar mesmo com leftover")
assert(!leadCategoriesWriteBlocked(false), "categorias confirmadas deixam criar")
assert(leadCategoriesMutationBlocked(true, ["VIP"], ["VIP", "Gold"]), "categoria nova com leftover unread bloqueia o POST")
assert(!leadCategoriesMutationBlocked(true, ["VIP"], ["VIP"]), "username/rascunho com as mesmas categorias unread ainda grava")
assert(!leadCategoriesMutationBlocked(true, ["VIP"], ["vip"]), "categoria leftover não distingue maiúsculas")
assert(!leadCategoriesMutationBlocked(false, ["VIP"], ["VIP", "Gold"]), "categorias confirmadas deixam o POST criar")
assert(leadsToCsv([importedGroup]).includes("category"), "CSV exporta categoria")
assert(!canFlushCrm(false), "sem hydrate o painel não grava CRM")
assert(canFlushCrm(true), "depois do GET o painel pode gravar")
assert(pendingSeedFunnelIds([], [{ ...emptySalesFunnel("seed"), id: "seed-1" }]).includes("seed-1"), "Worker vazio adopta o seed")
assert(pendingSeedFunnelIds([{ ...publishedA }], [{ ...emptySalesFunnel("seed"), id: "seed-1" }]).length === 0, "Worker com quadro não adopta seed")
assert(
  !hydrateFunnels(
    [{ ...publishedA }],
    [{ ...publishedA }, { ...publishedC }],
    [],
    [publishedC.id]
  ).some((item) => item.id === publishedC.id),
  "hydrate aplica o tombstone do funil apagado"
)
assert(
  hydrateFunnels(
    [{ ...publishedA }, { ...publishedC, updatedAt: "2026-05-01T00:00:00.000Z" }],
    [{ ...publishedA }],
    [publishedC.id],
    []
  ).some((item) => item.id === publishedC.id),
  "hydrate conserva o funil local ainda a gravar"
)
assert(
  !hydrateFunnels(
    [{ ...publishedA }, { ...publishedC }],
    [{ ...publishedA }, { ...publishedC }],
    [publishedC.id],
    [publishedC.id]
  ).some((item) => item.id === publishedC.id),
  "tombstone ganha do pending do mesmo funil"
)
assert(
  !hydrateFunnels(
    [{ ...publishedA }, { ...publishedC }],
    [],
    [],
    [publishedC.id]
  ).some((item) => item.id === publishedC.id),
  "Worker vazio ainda aplica o tombstone local"
)
assert(clipRemovedIds(["  ok  ", "", "x".repeat(81), "ok", 12, null]).join(",") === "ok", "ids removidos são cortados")
assert(clipNewestIds(Array.from({ length: 401 }, (_, i) => `d-${i}`), 400).at(-1) === "d-400", "tombstone local fica com o id mais novo")
assert(clipNewestIds(Array.from({ length: 401 }, (_, i) => `d-${i}`), 400)[0] === "d-1", "tombstone local larga o id mais velho")
assert(INBOX_LIST_PAGES === 5, "hydrate da inbox pede até 5 páginas")
assert(LEAD_REMOVED_CAP === 8000, "teto do tombstone de lead é o mesmo no painel e no Worker")
assert(
  !adoptRemoteFunnels(
    [{ ...publishedA, updatedAt: "2020-01-01T00:00:00.000Z" }, { ...publishedC, updatedAt: "2026-05-01T00:00:00.000Z" }],
    [{ ...publishedA, updatedAt: "2026-04-01T00:00:00.000Z" }]
  ).some((item) => item.id === publishedC.id),
  "hydrate do CRM não ressuscita funil apagado"
)
assert(
  adoptRemoteFunnels(
    [{ ...publishedA, updatedAt: "2020-01-01T00:00:00.000Z" }, { ...publishedC, updatedAt: "2026-05-01T00:00:00.000Z" }],
    [{ ...publishedA, updatedAt: "2026-04-01T00:00:00.000Z" }],
    [publishedC.id]
  ).some((item) => item.id === publishedC.id),
  "hydrate conserva funil local ainda a gravar"
)
assert(
  recoverPendingFunnelIds(
    [{ ...publishedA, updatedAt: "2026-06-01T00:00:00.000Z" }],
    [{ ...publishedA, updatedAt: "2026-04-01T00:00:00.000Z" }]
  ).includes(publishedA.id),
  "rascunho mais novo volta à fila de flush"
)
assert(
  recoverPendingFunnelIds(
    [{ ...publishedC, updatedAt: "2026-06-01T00:00:00.000Z" }],
    [{ ...publishedA }]
  ).length === 0,
  "funil só local sem pending não entra na fila — o tombstone do outro operador manda"
)
const dirtyLocal = {
  ...defaultSettings,
  telegramBotUsername: "@novo",
  telegramGroupUrl: "https://t.me/grupo",
  plugins: { ...defaultSettings.plugins, telegram: true, forms: true },
}
const staleRemote = {
  ...defaultSettings,
  telegramBotUsername: "@velho",
  telegramGroupUrl: "https://t.me/old",
  plugins: { ...defaultSettings.plugins, telegram: false, reports: true },
}
const keptDirty = adoptHydrateSettings(dirtyLocal, staleRemote, true, {
  ok: true,
  telegram: false,
  telegramBotUsername: "@runtime",
  telegramGroupUrl: "https://t.me/rt",
})
assert(keptDirty.telegramBotUsername === "@novo", "settings sujo não pisa o username local")
assert(keptDirty.telegramGroupUrl === "https://t.me/grupo", "settings sujo não pisa o grupo local")
assert(persistScopeKey(QUEUE_PENDING_LEADS, "") === QUEUE_PENDING_LEADS, "sem actor a chave de fila fica a antiga")
assert(persistScopeKey(QUEUE_PENDING_LEADS, "   ") === QUEUE_PENDING_LEADS, "actor vazio não inventa sufixo")
assert(
  persistScopeKey(QUEUE_REMOVED_LEADS, "op-a") === `${QUEUE_REMOVED_LEADS}:op-a`,
  "tombstone do operador A não partilha a chave do B"
)
assert(
  sessionQueueKeys("op-a").pendingLeads !== sessionQueueKeys("op-b").pendingLeads,
  "fila de leads do A não é a do B"
)
assert(
  sessionQueueKeys("op-a").removedLeads !== sessionQueueKeys("op-b").removedLeads,
  "hide local do A não é o do B"
)
assert(!sessionQueuesCleared().pendingLeadIds.length && !sessionQueuesCleared().settingsDirty, "401 limpa a fila e o dirty")
const actorA = { id: "op-a", name: "A", email: "a@abilion.com", role: "owner" as const }
const actorB = { id: "op-b", name: "B", email: "b@abilion.com", role: "operator" as const }
const leftoverCrm = {
  user: actorA,
  leads: [{ id: "lead-a" } as Lead],
  funnels: [emptySalesFunnel()],
  settings: { ...defaultSettings, telegramGroupUrl: "https://t.me/grupo-a" },
}
const afterLoginB = crmStateAfterActorChange(leftoverCrm, actorB)
assert(afterLoginB.user?.id === "op-b", "login fica com o actor novo")
assert(afterLoginB.leads.length === 0, "login não herda leads do operador anterior")
assert(afterLoginB.funnels.length === 0, "login não herda funis do operador anterior")
assert(!afterLoginB.settings.telegramGroupUrl, "login não herda o grupo local do A")
assert(
  crmStateAfterActorChange(leftoverCrm, null).user === null && crmStateAfterActorChange(leftoverCrm, null).leads.length === 0,
  "logout não deixa o cache do A para o próximo login"
)
assert(keptDirty.plugins.telegram === true && keptDirty.plugins.forms === true, "settings sujo não pisa os plugins locais")
assert(!keptDirty.plugins.reports, "settings sujo não adopta plugin remoto")
const adoptedClean = adoptHydrateSettings(dirtyLocal, staleRemote, false, {
  ok: true,
  telegram: true,
  telegramBotUsername: "@runtime",
  telegramGroupUrl: "https://t.me/rt",
})
assert(adoptedClean.telegramBotUsername === "@runtime", "runtime ganha username quando o CRM já gravou")
assert(adoptedClean.plugins.reports, "settings limpo adopta plugin remoto")
assert(adoptedClean.plugins.telegram === true, "runtime ganha o plugin telegram quando o CRM já gravou")
const scriptKeptLocal = addPageScript([], { name: "Landing FB", funnelId: "funil-a" })
assert(scriptKeptLocal.ok, "script local de teste")
const localWithScripts = {
  ...defaultSettings,
  pageScripts: scriptKeptLocal.ok ? scriptKeptLocal.scripts : [],
  leadCategories: ["VIP"],
  telegramBotUsername: "@ste_bot",
}
const hollowRemote = adoptHydrateSettings(localWithScripts, emptySettings(), false, {})
assert(
  hollowRemote.pageScripts.some((item) => item.id === (scriptKeptLocal.ok ? scriptKeptLocal.script.id : "")),
  "GET vazio não apaga scripts locais"
)
assert(hollowRemote.leadCategories.includes("VIP"), "GET vazio não apaga categorias locais")
assert(hollowRemote.telegramBotUsername === "@ste_bot", "GET vazio não apaga o username local")
const olderLead = lead("merge-1")
olderLead.updatedAt = "2020-01-01T00:00:00.000Z"
olderLead.events = [{ id: "ev-1", at: olderLead.updatedAt, kind: "entered", title: "entrou" }]
olderLead.messages = [{ id: "m-1", at: olderLead.updatedAt, role: "ste", text: "oi" }]
olderLead.memory = "local"
const newerEmpty = { ...olderLead, updatedAt: "2026-01-01T00:00:00.000Z", events: [], messages: [], memory: "" }
const mergedNewer = mergeLeads([olderLead], [newerEmpty])[0]
assert(mergedNewer?.events[0]?.id === "ev-1", "hydrate remoto vazio conserva eventos")
assert(mergedNewer?.messages?.[0]?.id === "m-1", "hydrate remoto vazio conserva mensagens")
assert(mergedNewer?.memory === "local", "hydrate remoto vazio conserva memória")
const adopted = adoptStoredLead(olderLead, newerEmpty)
assert(adopted.memory === "local", "gravação nova sem memória não apaga a nota")
assert(adopted.messages?.[0]?.id === "m-1", "gravação nova sem mensagens conserva o chat")
assert(adoptStoredLead(olderLead, { ...newerEmpty, updatedAt: "2019-01-01T00:00:00.000Z" }) === olderLead, "gravação antiga perde para o KV")
const staleWrite = { ...olderLead, memory: "velha", updatedAt: "2020-01-01T00:00:00.000Z", messages: [] }
const liveWrite = {
  ...olderLead,
  memory: "nova",
  updatedAt: "2026-09-20T12:00:00.000Z",
  messages: [{ id: "m-live", role: "ste" as const, text: "tick", at: "2026-09-20T12:00:00.000Z" }],
}
const committed = commitStoredLead(olderLead, staleWrite, liveWrite)
assert(committed.memory === "nova", "POST velho do lead não apaga a nota mais nova")
assert(committed.messages?.some((item) => item.id === "m-live"), "POST velho do lead não apaga a fala do tick")
assert(commitStoredLead(null, staleWrite, liveWrite).memory === "nova", "upsert sem prev ainda une o KV mais novo")
assert(commitStoredLead(olderLead, liveWrite).memory === "nova", "sem latest extra o commit cai no adopt")
const queuedWait = {
  ...olderLead,
  waitUntil: "2026-09-21T00:00:00.000Z",
  memory: "ste:remarketing",
  stePhase: "offer" as const,
  messages: [{ id: "m-old", role: "ste" as const, text: "boas", at: "2026-09-20T11:00:00.000Z" }],
}
const liveAfterSend = {
  ...queuedWait,
  waitUntil: undefined,
  memory: "ste:welcome,ste:remarketing",
  stePhase: "close" as const,
  updatedAt: "2026-09-20T12:05:00.000Z",
  messages: [
    { id: "m-old", role: "ste" as const, text: "boas", at: "2026-09-20T11:00:00.000Z" },
    { id: "m-ste-new", role: "ste" as const, text: "oferta", at: "2026-09-20T12:05:00.000Z" },
    { id: "m-talk", role: "lead" as const, text: "quero o app", at: "2026-09-20T12:05:01.000Z" },
  ],
  lastMessage: "quero o app",
}
const restoredWait = restoreLeadAfterFailedSend(queuedWait, liveAfterSend)
assert(restoredWait.waitUntil === queuedWait.waitUntil, "restore do cron devolve a espera")
assert(restoredWait.memory === "ste:remarketing", "restore do cron devolve a memória de antes")
assert(restoredWait.stePhase === "offer", "restore do cron devolve a fase")
assert(restoredWait.messages?.some((item) => item.id === "m-talk"), "restore do cron conserva a fala do lead")
assert(!restoredWait.messages?.some((item) => item.id === "m-ste-new"), "restore do cron não fica com a fala da Sté que não saiu")
assert(restoredWait.messages?.some((item) => item.id === "m-old"), "restore do cron mantém o chat antigo")
assert(restoreLeadAfterFailedSend(queuedWait, null).waitUntil === queuedWait.waitUntil, "restore sem KV vivo usa a fila")
const telegramWait = {
  ...olderLead,
  id: "tg-flow",
  telegramChatId: "9001",
  waitUntil: "2026-09-21T00:00:00.000Z",
  stage: "welcome" as const,
  memory: "nota",
  temperature: "novo" as const,
}
const panelAdvance = {
  ...telegramWait,
  waitUntil: undefined,
  stage: "offer" as const,
  printAt: "2026-09-22T00:00:00.000Z",
  memory: "nova",
  temperature: "quente" as const,
  updatedAt: "2026-09-22T00:00:00.000Z",
}
const operatorKept = adoptOperatorLead(telegramWait, panelAdvance)
assert(operatorKept.waitUntil === telegramWait.waitUntil, "painel não come a espera do Telegram")
assert(operatorKept.stage === "welcome", "painel não muda o passo do Telegram")
assert(!operatorKept.printAt, "painel não marca print no chat real")
assert(operatorKept.memory === "nova", "painel ainda grava a nota do Telegram")
assert(operatorKept.temperature === "quente", "painel ainda grava a temperatura")
const inboxNewer = {
  ...telegramWait,
  updatedAt: "2026-09-23T00:00:00.000Z",
  temperature: "morno" as const,
  memory: "nota",
  messages: [{ id: "in-1", at: "2026-09-23T00:00:00.000Z", role: "lead" as const, text: "oi" }],
}
const pendingDrawer = new Map([[telegramWait.id, operatorKept]])
const overlaidInbox = overlayPendingLeads([inboxNewer], pendingDrawer)[0]
assert(overlaidInbox?.temperature === "quente", "inbox não pisa a temperatura ainda por gravar")
assert(overlaidInbox?.memory === "nova", "inbox não pisa a nota ainda por gravar")
assert(overlaidInbox?.messages?.some((item) => item.id === "in-1"), "fala nova da inbox entra por cima da fila")
assert(overlaidInbox?.waitUntil === telegramWait.waitUntil, "overlay não avança a espera do Telegram")
const ghostPending = lead("ghost-ui", "@ghostui")
assert(
  !overlayPendingLeads([], [ghostPending], ["ghost-ui"]).some((item) => item.id === "ghost-ui"),
  "pending tombstoned não volta à lista"
)
assert(
  overlayPendingLeads([], [ghostPending], []).some((item) => item.id === "ghost-ui"),
  "pending sem tombstone ainda entra"
)
const localWait = { ...olderLead, id: "local-flow", waitUntil: "2026-09-21T00:00:00.000Z" }
const localAdvanced = adoptOperatorLead(localWait, { ...localWait, waitUntil: undefined, updatedAt: "2026-09-22T00:00:00.000Z" })
assert(!localAdvanced.waitUntil, "simulação local ainda avança a espera")
const importedWait = {
  ...olderLead,
  id: "imp-flow",
  channel: "whatsapp" as const,
  origin: "import" as const,
  stage: "capture" as const,
  memory: "nota import",
  temperature: "novo" as const,
}
const importedAdvance = {
  ...importedWait,
  waitUntil: undefined,
  stage: "offer" as const,
  printAt: "2026-09-22T00:00:00.000Z",
  memory: "nova import",
  temperature: "quente" as const,
  updatedAt: "2026-09-22T00:00:00.000Z",
}
const importedKept = adoptOperatorLead(importedWait, importedAdvance)
assert(isOperatorLockedLead(importedWait), "import WhatsApp tranca o quadro no POST")
assert(importedKept.stage === "capture", "painel não muda o passo do import")
assert(!importedKept.printAt, "painel não marca print no import")
assert(importedKept.memory === "nova import", "painel ainda grava a nota do import")
assert(importedKept.temperature === "quente", "painel ainda grava a temperatura do import")
const chatPrev = {
  ...olderLead,
  updatedAt: "2026-06-01T00:00:00.000Z",
  temperature: "novo" as const,
  messages: [
    { id: "m-1", at: "2026-06-01T00:00:00.000Z", role: "ste" as const, text: "oi" },
    { id: "m-2", at: "2026-06-01T00:01:00.000Z", role: "lead" as const, text: "já jogo" },
  ],
}
const staleDrawer = {
  ...chatPrev,
  updatedAt: "2026-06-02T00:00:00.000Z",
  temperature: "quente" as const,
  messages: [chatPrev.messages[0]!],
}
const keptChat = adoptStoredLead(chatPrev, staleDrawer)
assert(keptChat.temperature === "quente", "clique mais novo do operador entra")
assert(keptChat.messages?.map((item) => item.id).join(",") === "m-1,m-2", "chat do Telegram sobrevive ao POST incompleto")
const lateTelegram = {
  ...chatPrev,
  updatedAt: "2026-05-01T00:00:00.000Z",
  temperature: "novo" as const,
  messages: [
    ...chatPrev.messages,
    { id: "m-3", at: "2026-06-01T00:02:00.000Z", role: "ste" as const, text: "minicurso" },
  ],
}
const afterClick = { ...keptChat, updatedAt: "2026-06-02T00:00:00.000Z", temperature: "quente" as const }
const mergedLate = adoptStoredLead(afterClick, lateTelegram)
assert(mergedLate.temperature === "quente", "gravação antiga do webhook não reverte a temperatura")
assert(mergedLate.messages?.some((item) => item.id === "m-3"), "mensagem nova do Telegram entra mesmo com updatedAt velho")
const afterOperator = {
  ...afterClick,
  temperature: "quente" as const,
  updatedAt: "2026-06-02T00:00:00.000Z",
  printAt: "2026-06-02T00:00:00.000Z",
}
const newerTelegram = {
  ...afterOperator,
  updatedAt: "2026-06-03T00:00:00.000Z",
  temperature: "novo" as const,
  printAt: undefined,
  name: afterOperator.name,
  messages: [
    ...afterOperator.messages,
    { id: "m-4", at: "2026-06-03T00:00:00.000Z", role: "ste" as const, text: "superbet" },
  ],
}
const keptTemp = adoptStoredLead(afterOperator, newerTelegram)
assert(keptTemp.temperature === "quente", "webhook mais novo não arrefece o lead que o operador marcou")
assert(keptTemp.printAt === "2026-06-02T00:00:00.000Z", "print do operador sobrevive ao webhook")
assert(keptTemp.messages?.some((item) => item.id === "m-4"), "fala nova do webhook mais novo entra")
const operatorRename = adoptStoredLead(afterOperator, {
  ...afterOperator,
  updatedAt: "2026-06-04T00:00:00.000Z",
  name: "Ana Quente",
  temperature: "morno" as const,
})
assert(operatorRename.name === "Ana Quente" && operatorRename.temperature === "morno", "POST só de operador ainda troca nome e temperatura")
const phoneNamed = { ...afterOperator, name: "+55 11 98765-4321", contact: "5511987654321" }
const archivedPerson = { ...phoneNamed, name: "PAULO SERGIO", updatedAt: "2019-01-01T00:00:00.000Z" }
assert(adoptStoredLead(phoneNamed, archivedPerson).name === "Paulo Sergio", "nome de pessoa mais velho ganha do telefone")
assert(mergeLeadMessages([{ id: "m-1", at: "1", role: "ste", text: "a" }], [{ id: "m-2", at: "2", role: "lead", text: "b" }]).map((item) => item.id).join(",") === "m-1,m-2", "merge de falas une por id")
assert(waitHours(Number("x")) === 84, "espera NaN cai nas 84h")
assert(waitHours(-3) === 84, "espera negativa cai nas 84h")
assert(waitHours(10_000) === 8760, "espera tem teto de um ano")
const nanWait = sanitizeIncomingFunnel({
  id: "funil-nan",
  name: "NaN",
  nodes: [{ id: "w", type: "wait", position: { x: 0, y: 0 }, data: { title: "Espera", delayHours: Number("x") } }],
  edges: [],
})
assert(nanWait?.nodes[0]?.data.delayHours === 84, "funil persistido não guarda NaN na espera")
const nanSnap = {
  name: "nan",
  publishedAt: "2026-01-01T00:00:00.000Z",
  nodes: [
    { id: "e", type: "entry" as const, position: { x: 0, y: 0 }, data: { title: "Start", entryTrigger: "start" as const } },
    { id: "w", type: "wait" as const, position: { x: 0, y: 0 }, data: { title: "Espera", delayHours: Number("x") } },
  ],
  edges: [{ id: "e1", source: "e", target: "w" }],
}
let nanHours = -1
try {
  const nanFired = applyEvent(nanSnap, lead("nan-wait"), { type: "start" }, Date.parse("2026-01-01T00:00:00.000Z"))
  const waitEffect = nanFired.effects.find((item) => item.kind === "wait")
  nanHours = waitEffect && "hours" in waitEffect ? waitEffect.hours : -1
} catch {
  nanHours = -2
}
assert(nanHours === 84, "applyEvent com espera NaN não rebenta")
olderLead.facts = { regionCode: "SP" }
olderLead.telegramChatId = "9001"
const newerBare = { ...newerEmpty, facts: {}, telegramChatId: undefined }
const mergedFacts = mergeLeads([olderLead], [newerBare])[0]
assert(mergedFacts?.facts.regionCode === "SP", "hydrate remoto vazio conserva factos")
assert(mergedFacts?.telegramChatId === "9001", "hydrate remoto vazio conserva o chat Telegram")
const staleLead = lead("stale")
staleLead.updatedAt = "2020-01-01T00:00:00.000Z"
const liveLead = lead("live")
liveLead.updatedAt = "2026-06-01T00:00:00.000Z"
const freshLead = lead("fresh")
freshLead.updatedAt = "2026-07-01T00:00:00.000Z"
assert(!reconcileLeads([staleLead, liveLead], [liveLead]).some((item) => item.id === "stale"), "hydrate dropa lead apagado")
assert(reconcileLeads([staleLead], []).some((item) => item.id === "stale"), "lista remota vazia nao limpa")
assert(!reconcileLeads([freshLead, liveLead], [liveLead]).some((item) => item.id === "fresh"), "lead local sem pending some")
assert(
  reconcileLeads([freshLead, liveLead], [liveLead], ["fresh"]).some((item) => item.id === "fresh"),
  "pending local sobrevive ao hydrate"
)
assert(
  reconcileLeads([freshLead, liveLead], [liveLead], [], false).some((item) => item.id === "fresh"),
  "janela incompleta não apaga lead local"
)
assert(
  hydrateLeads(
    [freshLead, liveLead],
    { ok: true, leads: [liveLead], complete: false },
    { ok: true, leads: [] },
    new Map(),
    []
  ).some((item) => item.id === "fresh"),
  "hydrate incompleto conserva o lead fora da janela"
)
assert(
  !hydrateLeads(
    [freshLead, liveLead],
    { ok: true, leads: [liveLead], complete: true },
    { ok: true, leads: [] },
    new Map(),
    []
  ).some((item) => item.id === "fresh"),
  "hydrate completo ainda dropa o lead que o Worker já não tem"
)
assert(
  hydrateLeads(
    [freshLead, liveLead],
    { ok: true, leads: [liveLead], complete: false },
    { ok: true, leads: [] },
    new Map(),
    ["fresh"]
  ).every((item) => item.id !== "fresh"),
  "tombstone remoto ainda dropa na janela incompleta"
)
assert(
  hydrateLeads(
    [freshLead],
    { ok: true, leads: [], complete: false },
    { ok: true, leads: [] },
    new Map(),
    []
  ).some((item) => item.id === "fresh"),
  "GET vazio incompleto não limpa o local"
)
const crowd = Array.from({ length: LEAD_LIST_CAP }, (_, i) => {
  const row = lead(`cap-${i}`, `@cap${i}`)
  row.updatedAt = new Date(1_800_000_000_000 + i).toISOString()
  return row
})
const oldPin = lead("old-pin", "@oldpin")
oldPin.updatedAt = "2020-01-01T00:00:00.000Z"
assert(!mergeLeads(crowd, [oldPin]).some((item) => item.id === "old-pin"), "sem pin o antigo cai do teto")
assert(mergeLeads(crowd, [oldPin], ["old-pin"]).some((item) => item.id === "old-pin"), "pin da busca fura o teto")
assert(!applyRemovedLeads([freshLead, liveLead], ["fresh"]).some((item) => item.id === "fresh"), "tombstone tira o lead da lista")
assert(leadDeleteAck(200).keepTombstone && leadDeleteAck(200).ok, "DELETE 200 persiste o hide")
assert(leadDeleteAck(204).keepTombstone && leadDeleteAck(204).ok, "DELETE 204 persiste o hide")
assert(leadDeleteAck(503).keepTombstone && !leadDeleteAck(503).ok, "DELETE 503 persiste o hide — KV já tombstoneou")
assert(!leadDeleteAck(409).keepTombstone && !leadDeleteAck(409).ok, "DELETE 409 não esconde o leftover — KV não confirmou tombstone")
assert(!leadDeleteAck(401).keepTombstone && !leadDeleteAck(401).ok, "DELETE 401 não esconde o lead para sempre")
assert(!leadDeleteAck(429).keepTombstone, "DELETE 429 não tombstoneia o local")
assert(!leadDeleteAck(400).keepTombstone, "DELETE 400 não tombstoneia o local")
assert(!leadDeleteAck(null).keepTombstone, "sem rede não tombstoneia o local")
assert(!leadDeleteAck(undefined).keepTombstone, "status oco não tombstoneia")
assert(crmDeleteAck(true).keepTombstone && crmDeleteAck(true).ok, "CRM 200 persiste o hide do funil")
assert(!crmDeleteAck(false).keepTombstone && !crmDeleteAck(false).ok, "CRM falho não esconde o funil para sempre")
assert(rememberLocalTombstone(["gone"], "fresh", true).includes("fresh"), "ack 200/503 acrescenta o tombstone local")
assert(!rememberLocalTombstone(["fresh", "gone"], "fresh", false).includes("fresh"), "401/rede tira o tombstone local")
assert(
  restoreAfterFailedDelete([liveLead], freshLead).some((item) => item.id === "fresh"),
  "401/rede devolve o lead à lista"
)
assert(
  restoreAfterFailedDelete([freshLead, liveLead], freshLead).every((item, i, all) => all.findIndex((row) => row.id === item.id) === i),
  "restore não duplica o lead que o hydrate já trouxe"
)
assert(
  restoreAfterFailedDelete([liveLead], undefined).every((item) => item.id === "live"),
  "sem snapshot o restore não inventa lead"
)
assert(
  hydrateLeads(
    [liveLead],
    { ok: true, leads: [freshLead, liveLead], complete: false },
    { ok: false, leads: [] },
    new Map(),
    []
  ).some((item) => item.id === "fresh"),
  "sem tombstone local o GET clipped devolve o lead que o DELETE 401 não apagou"
)
assert(
  hydrateLeads(
    [liveLead],
    { ok: true, leads: [freshLead, liveLead], complete: false },
    { ok: false, leads: [] },
    new Map(),
    rememberLocalTombstone([], "fresh", leadDeleteAck(401).keepTombstone)
  ).some((item) => item.id === "fresh"),
  "401 não deixa tombstone para o hydrate esconder"
)
assert(
  !hydrateLeads(
    [liveLead],
    { ok: true, leads: [freshLead, liveLead], complete: false },
    { ok: false, leads: [] },
    new Map(),
    rememberLocalTombstone([], "fresh", leadDeleteAck(503).keepTombstone)
  ).some((item) => item.id === "fresh"),
  "503 deixa tombstone — GET clipped não ressuscita"
)
assert(
  !hydrateLeads(
    [liveLead],
    { ok: true, leads: [freshLead, liveLead], complete: false },
    { ok: false, leads: [] },
    new Map(),
    rememberLocalTombstone([], "fresh", leadDeleteAck(200).keepTombstone)
  ).some((item) => item.id === "fresh"),
  "200 deixa tombstone — GET clipped não ressuscita"
)
assert(
  leadsStillOnRemote(["fresh", "gone"], [freshLead, liveLead]).join(",") === "fresh",
  "tombstone ainda no Worker volta a tentar o DELETE"
)
assert(leadsStillOnRemote(["gone"], [freshLead]).length === 0, "tombstone sem linha remota não dispara DELETE")
assert(
  mergeLeads(applyRemovedLeads([liveLead], ["fresh"]), [freshLead]).some((item) => item.id === "fresh"),
  "sem tombstone a inbox volta a trazer o lead"
)
assert(
  !mergeLeads(applyRemovedLeads([liveLead], ["fresh"]), applyRemovedLeads([freshLead], ["fresh"])).some((item) => item.id === "fresh"),
  "inbox com tombstone nao ressuscita"
)
assert(
  !adoptLeadStores([liveLead], [liveLead, freshLead]).some((item) => item.id === "fresh"),
  "KV nao aceita lead que so existe no Supabase"
)
assert(adoptLeadStores([], [freshLead]).some((item) => item.id === "fresh"), "KV vazio recupera do remoto")
assert(csvCell("a,b") === '"a,b"', "csv cita vírgula")
assert(csvCell('diz "oi"') === '"diz ""oi"""', "csv escapa aspas")
assert(csvCell("=1+1") === '"\'=1+1"', "csv não executa fórmula")
assert(csvCell("+cmd") === '"\'+cmd"', "csv não executa mais")
assert(csvCell("@fb1") === '"\'@fb1"', "arroba do Telegram não vira fórmula")
assert(csvCell("-2+3") === '"\'-2+3"', "csv não executa menos")
assert(leadsToCsv([lead()]).includes("lead-1"), "csv inclui o id")

assert(safeAppPath("/leads") === "/leads", "rota interna passa")
assert(safeAppPath("/Leads") === "/leads", "next /Leads não cai no dashboard")
assert(safeAppPath("/FLUXO/funil/AbC") === "/fluxo/funil/AbC", "next do editor maiúsculo conserva o id")
assert(safeAppPath("/configuracoes?tab=conta") === "/configuracoes?tab=conta", "query da conta passa")
assert(safeAppPath("//evil.com") === "/", "protocol-relative nao redireciona")
assert(safeAppPath("/\\evil") === "/", "backslash nao redireciona")
assert(safeAppPath("https://evil.com") === "/", "url absoluta cai no inicio")
assert(safeAppPath("/fluxo/funil/abc") === "/fluxo/funil/abc", "editor do funil passa")
assert(safeAppPath("/fluxo/funil/../x") === "/", "path traversal cai no inicio")
assert(safeAppPath("/configuracoesfoo") === "/", "prefixo de configuracoes nao passa")
assert(safeAppPath("/configuracoes/") === "/", "barra extra em configuracoes nao passa")
assert(safeAppPath("/privacidade") === "/privacidade", "politica no next do login passa")
assert(foldPublicPath("/Login") === "/login", "Login maiúsculo é a rota pública")
assert(foldPublicPath("/L/") === "/l", "L/ é a landing")
assert(foldPublicPath("/RESET") === "/reset", "RESET é o HTML do reset")
assert(foldPublicPath("/T.js") === "/t.js", "T.js é o pixel")
assert(isWorkerPublicPath("/Login"), "Vite manda /Login ao Worker")
assert(isWorkerPublicPath("/L/"), "Vite manda /L/ à landing")
assert(isWorkerPublicPath("/T.js"), "Vite manda /T.js ao pixel")
assert(isWorkerPublicPath("/Api/health"), "Vite manda /Api ao Worker")
assert(isWorkerPublicPath("/Forgot"), "Vite manda /Forgot ao Worker")
assert(!isWorkerPublicPath("/leads"), "painel canónico não é HTML público")
assert(!isWorkerPublicPath("/"), "home não é HTML público")
assert(foldPublicPath("/leads") === "/leads", "painel não muda de path")
assert(foldStudioPath("/Leads") === "/leads", "Leads maiúsculo vai ao painel")
assert(foldStudioPath("/leads") === null, "leads canónico não redirecciona")
assert(foldStudioPath("/FLUXO/funil/AbC") === "/fluxo/funil/AbC", "editor maiúsculo conserva o id")
assert(foldStudioPath("/fluxo/funil/AbC") === null, "editor canónico não redirecciona")
assert(foldStudioPath("/Configuracoes/") === "/configuracoes", "barra extra no studio dobra")
assert(foldStudioPath("/settings") === "/configuracoes", "settings inglês vai às definições")
assert(foldStudioPath("/Settings") === "/configuracoes", "Settings maiúsculo vai às definições")
assert(foldStudioPath("/users") === "/utilizadores", "users inglês vai às contas")
assert(foldStudioPath("/Users/") === "/utilizadores", "Users com barra vai às contas")
assert(foldStudioPath("/configuracoes") === null, "configurações canónico não redirecciona")
assert(foldStudioPath("/utilizadores") === null, "utilizadores canónico não redirecciona")
assert(safeAppPath("/settings") === "/configuracoes", "next=/settings não despeja na home")
assert(safeAppPath("/users") === "/utilizadores", "next=/users não despeja na home")
assert(safeAppPath("/utilizadores") === "/utilizadores", "gestor de contas passa no next")
assert(withSafeNext("/forgot", "/leads") === "/forgot?next=%2Fleads", "forgot conserva o next")
assert(withSafeNext("/login", "//evil.com") === "/login", "next perigoso não entra no forgot")
assert(withSafeNext("/reset?token=abc", "/leads") === "/reset?token=abc&next=%2Fleads", "reset junta next ao token")
assert(withSafeNext("/login", "/login") === "/login", "next para o próprio login some")
assert(FETCH_TIMEOUT_MS === 12_000, "timeout do painel é 12s")
assert(KEEPALIVE_MAX_BYTES === 60_000, "keepalive do pagehide fica abaixo de 64kb")
assert(typeof AbortSignal.timeout === "function", "AbortSignal.timeout existe neste runtime")

let gated = consumeThrottle({ users: [], sessions: [], resets: {} }, "login:1:a", 2, 60_000, 1000)
assert(gated.ok, "primeira tentativa passa")
gated = consumeThrottle(gated.snapshot, "login:1:a", 2, 60_000, 1001)
assert(gated.ok, "segunda tentativa passa")
gated = consumeThrottle(gated.snapshot, "login:1:a", 2, 60_000, 1002)
assert(!gated.ok, "terceira tentativa bloqueia")
const unlocked = consumeThrottle(clearThrottle(gated.snapshot, "login:1:a"), "login:1:a", 2, 60_000, 1003)
assert(unlocked.ok, "sucesso limpa o bloqueio")
assert(consumeMemoryThrottle("track:test-ip", 2, 60_000, 2000), "pixel primeira passa")
assert(consumeMemoryThrottle("track:test-ip", 2, 60_000, 2001), "pixel segunda passa")
assert(!consumeMemoryThrottle("track:test-ip", 2, 60_000, 2002), "pixel terceira bloqueia")
const throttleKv = memoryKv()
assert(await consumeKvThrottle(throttleKv, "track:kv-ip", 2, 60_000, 3000), "kv throttle primeira passa")
assert(await consumeKvThrottle(throttleKv, "track:kv-ip", 2, 60_000, 3001), "kv throttle segunda passa")
assert(!(await consumeKvThrottle(throttleKv, "track:kv-ip", 2, 60_000, 3002)), "kv throttle terceira bloqueia")
const mergedLimits = mergeThrottles({ a: { count: 2, resetAt: 9 } }, { a: { count: 4, resetAt: 9 }, b: { count: 1, resetAt: 9 } })
assert(mergedLimits.a?.count === 4 && mergedLimits.b?.count === 1, "throttle une a mesma janela pelo maior count")
const throttleRaceKv = memoryKv()
await Promise.all([
  consumeKvThrottle(throttleRaceKv, "race-a", 5, 60_000, 4000),
  consumeKvThrottle(throttleRaceKv, "race-b", 5, 60_000, 4000),
])
const racedThrottles = (await throttleRaceKv.get("track:throttles", "json")) as Record<string, { count: number }> | null
assert(racedThrottles?.["race-a"] && racedThrottles?.["race-b"], "throttle concorrente não apaga a outra chave")
const sameKeyKv = memoryKv()
const sameKeyHits = await Promise.all([
  consumeKvThrottle(sameKeyKv, "same", 1, 60_000, 5000),
  consumeKvThrottle(sameKeyKv, "same", 1, 60_000, 5000),
  consumeKvThrottle(sameKeyKv, "same", 1, 60_000, 5000),
])
assert(sameKeyHits.filter(Boolean).length === 1, "throttle da mesma chave só deixa passar o limite")
const throttleUnreadHit = await confirmKvThrottle(
  {
    async get() {
      throw new Error("kv down")
    },
    async put() {},
  },
  "unread",
  2,
  60_000
)
assert(throttleUnreadHit.unread && !throttleUnreadHit.allowed, "confirmKvThrottle marca unread sem fingir limite")
const throttleOkHit = await confirmKvThrottle(memoryKv(), "ok", 2, 60_000, 6000)
assert(!throttleOkHit.unread && throttleOkHit.allowed, "confirmKvThrottle passa quando o KV responde")
const retained = retainUserSessions(
  [
    { token: "old", userId: "u1", expiresAt: 9, issuedAt: 1 },
    { token: "mid", userId: "u1", expiresAt: 9, issuedAt: 2 },
    { token: "fresh", userId: "u1", expiresAt: 9, issuedAt: 3 },
    { token: "other", userId: "u2", expiresAt: 9, issuedAt: 4 },
  ],
  "u1",
  { token: "new", userId: "u1", expiresAt: 9, issuedAt: 5 },
  3
)
assert(retained.some((item) => item.token === "other"), "outras contas mantêm sessão")
assert(retained.some((item) => item.token === "new"), "sessão nova entra")
assert(!retained.some((item) => item.token === "old"), "sessão mais velha sai")
assert(retained.filter((item) => item.userId === "u1").length === 3, "cap de 3 sessões por operador")
const sessionExp = Date.now() + 60_000
const victorSession = { token: "tok-v", userId: "victor", expiresAt: sessionExp, issuedAt: 1 }
const gabrielSession = { token: "tok-g", userId: "gabriel", expiresAt: sessionExp, issuedAt: 2 }
const victorUser = { id: "victor", email: "victor@abilion.com", name: "Victor", passwordHash: "h1", createdAt: "2026-01-01T00:00:00.000Z" }
const gabrielUser = { id: "gabriel", email: "gabriel@abilion.com", name: "Gabriel", passwordHash: "h2", createdAt: "2026-01-01T00:00:00.000Z" }
const mergedLogin = mergeAuthSnapshots(
  { users: [victorUser], sessions: [victorSession], resets: {}, throttles: {} },
  { users: [gabrielUser], sessions: [gabrielSession], resets: {}, throttles: {} }
)
assert(mergedLogin.sessions.some((item) => item.token === "tok-v"), "merge de login conserva a sessão do Victor")
assert(mergedLogin.sessions.some((item) => item.token === "tok-g"), "merge de login conserva a sessão do Gabriel")
const mergedLogout = mergeAuthSnapshots(
  { users: [victorUser], sessions: [victorSession, gabrielSession], resets: {}, revoked: ["tok-v"] },
  { users: [victorUser], sessions: [victorSession, gabrielSession], resets: {}, revoked: [] }
)
assert(!mergedLogout.sessions.some((item) => item.token === "tok-v"), "tombstone de logout ganha do snapshot velho")
assert(mergedLogout.sessions.some((item) => item.token === "tok-g"), "logout de um não derruba o outro")
const mergedReset = mergeAuthSnapshots(
  { users: [victorUser], sessions: [], resets: { old: { userId: "victor", expiresAt: sessionExp } }, spentResets: [] },
  { users: [victorUser], sessions: [], resets: {}, spentResets: ["old"] }
)
assert(!mergedReset.resets.old, "reset gasto não volta no merge")
const raceKv = memoryKv()
const raceStore = kvAuthStore(raceKv)
await raceStore.save({ users: [victorUser], sessions: [victorSession], resets: {}, throttles: {} })
const stale = await raceStore.load()
await raceStore.save({ users: [gabrielUser, ...stale.users], sessions: [gabrielSession, ...stale.sessions], resets: {}, throttles: {} })
await raceStore.save({ users: [victorUser], sessions: [victorSession], resets: {}, throttles: {} })
const raced = await raceStore.load()
assert(raced.sessions.some((item) => item.token === "tok-v") && raced.sessions.some((item) => item.token === "tok-g"), "KV não perde a sessão da escrita concorrente")
const oldPwd = { ...victorUser, passwordHash: "old", passwordUpdatedAt: 1000 }
const newPwd = { ...victorUser, passwordHash: "new", passwordUpdatedAt: 2000 }
const staleSession = { token: "tok-stale", userId: "victor", expiresAt: sessionExp, issuedAt: 0 }
const mergedPassword = mergeAuthSnapshots(
  { users: [newPwd], sessions: [victorSession], resets: {}, revoked: ["tok-old"] },
  { users: [oldPwd], sessions: [victorSession, staleSession], resets: {}, revoked: [] }
)
assert(mergedPassword.users[0]?.passwordHash === "new", "login velho não reverte a senha")
assert(!mergedPassword.sessions.some((item) => item.token === "tok-stale"), "sessão do login velho cai depois da troca")
assert(mergedPassword.sessions.some((item) => item.token === "tok-v"), "sessão actual da troca fica")
const hashKv = memoryKv()
const hashStore = kvAuthStore(hashKv)
await hashStore.save({ users: [oldPwd], sessions: [victorSession], resets: {}, throttles: {} })
const stalePwd = await hashStore.load()
await hashStore.save({ users: [newPwd], sessions: [victorSession], resets: {}, revoked: ["tok-old"], throttles: {} })
await hashStore.save({
  users: stalePwd.users,
  sessions: [...stalePwd.sessions, staleSession],
  resets: {},
  throttles: {},
})
const hashRaced = await hashStore.load()
assert(hashRaced.users[0]?.passwordHash === "new", "KV não reverte a senha na corrida do login")
assert(!hashRaced.sessions.some((item) => item.token === "tok-stale"), "KV não ressuscita sessão anterior à troca")
const apiTok = { id: "tokapi1", name: "Agente", hash: "deadbeef", prefix: "abn_tokapi1", createdAt: "2026-01-01T00:00:00.000Z" }
assert(mergeTokens([apiTok], [apiTok], ["tokapi1"]).length === 0, "mergeTokens ignora id no drop")
const opUser = {
  id: "ana-merge",
  email: "ana-merge@abilion.com",
  name: "Ana",
  passwordHash: "h",
  createdAt: "2026-01-01T00:00:00.000Z",
  role: "operator" as const,
  disabled: false,
  tokens: [apiTok],
  accountUpdatedAt: 1000,
}
const disabledUser = { ...opUser, disabled: true, tokens: [], accountUpdatedAt: 2000 }
const mergedDisable = mergeAuthSnapshots(
  { users: [disabledUser], sessions: [], resets: {}, revokedApi: ["tokapi1"] },
  { users: [opUser], sessions: [], resets: {}, revokedApi: [] }
)
assert(mergedDisable.users[0]?.disabled === true, "desligar ganha do snapshot velho")
assert(!(mergedDisable.users[0]?.tokens ?? []).some((item) => item.id === "tokapi1"), "token da conta desligada não volta")
assert(mergedDisable.revokedApi?.includes("tokapi1"), "tombstone de token MCP fica no merge")
const mergedEqualDisable = mergeAuthSnapshots(
  { users: [{ ...opUser, disabled: true, accountUpdatedAt: 0 }], sessions: [], resets: {} },
  { users: [{ ...opUser, disabled: false, accountUpdatedAt: 0 }], sessions: [], resets: {} }
)
assert(mergedEqualDisable.users[0]?.disabled === true, "sem carimbo, disabled ganha")
const mintedApi = mintApiToken("revoke")
const mintedHash = await hashApiToken(mintedApi.token)
const revokedSnap = {
  users: [{ ...opUser, tokens: [{ id: mintedApi.id, name: "revoke", hash: mintedHash, prefix: mintedApi.prefix, createdAt: "2026-01-01T00:00:00.000Z" }], disabled: false }],
  sessions: [],
  resets: {},
  revokedApi: [mintedApi.id],
}
assert((await findUserByApiToken(revokedSnap, mintedApi.token)) === null, "token no revokedApi não autentica")
const liveSnap = { ...revokedSnap, revokedApi: [] }
assert((await findUserByApiToken(liveSnap, mintedApi.token))?.user.email === "ana-merge@abilion.com", "token vivo ainda autentica")
const overflowRevoked = Array.from({ length: AUTH_REVOKED_CAP }, (_, i) => `old-rev-${i}`)
const overflowMerge = mergeAuthSnapshots(
  { users: [victorUser], sessions: [staleSession], resets: {}, revoked: overflowRevoked },
  { users: [victorUser], sessions: [], resets: {}, revoked: ["tok-stale"] }
)
assert(overflowMerge.revoked?.includes("tok-stale"), "tombstone novo ganha do tecto cheio")
assert(!overflowMerge.sessions.some((item) => item.token === "tok-stale"), "sessão ainda viva no snapshot velho não volta")

const authStore = memoryAuthStore()
const loginAttempt = (password: string) =>
  handleAuth(
    new Request("http://local.test/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" },
      body: JSON.stringify({ email: "victor@abilion.com", password }),
    }),
    authStore,
    { ABILION_ENV: "development" }
  )
const prodFirstStore = memoryAuthStore()
const prodFirst = await handleAuth(
  new Request("http://local.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.8" },
    body: JSON.stringify({ email: "gabriel@abilion.com", password: "senhaok" }),
  }),
  prodFirstStore,
  { ABILION_ENV: "production" }
)
assert(prodFirst.status === 200, "produção sem seed cria a senha no primeiro acesso")
const prodFirstBody = (await prodFirst.json()) as { user: { email: string } | null }
assert(prodFirstBody.user?.email === "gabriel@abilion.com", "primeiro acesso devolve o operador")
assert(Boolean(prodFirst.headers.get("set-cookie")?.includes("abilion_session=")), "primeiro acesso grava cookie")
const prodWrong = await handleAuth(
  new Request("http://local.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.8" },
    body: JSON.stringify({ email: "gabriel@abilion.com", password: "outraok" }),
  }),
  prodFirstStore,
  { ABILION_ENV: "production" }
)
assert(prodWrong.status === 401, "depois do primeiro acesso a senha errada não entra")
const prodAgain = await handleAuth(
  new Request("http://local.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.8" },
    body: JSON.stringify({ email: "gabriel@abilion.com", password: "senhaok" }),
  }),
  prodFirstStore,
  { ABILION_ENV: "production" }
)
assert(prodAgain.status === 200, "a senha do primeiro acesso continua a entrar")
assert(!requestHasAuth(new Request("http://local.test/mcp")), "sem cookie nem bearer não há credencial")
assert(
  requestHasAuth(new Request("http://local.test/mcp", { headers: { authorization: "Bearer abn_x" } })),
  "bearer conta como credencial"
)
assert((await loginAttempt("senhaok")).status === 200, "primeiro acesso define a senha")
assert(
  (
    await handleAuth(
      new Request("http://local.test/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "victor@abilion.com", password: "x".repeat(9000) }),
      }),
      memoryAuthStore(),
      { ABILION_ENV: "development" }
    )
  ).status === 413,
  "login recusa corpo enorme"
)
const meAnon = await handleAuth(new Request("http://local.test/api/auth/me"), memoryAuthStore(), {
  ABILION_ENV: "development",
})
const meAnonBody = (await meAnon.json()) as { user: unknown }
assert(meAnon.status === 200 && meAnonBody.user === null, "me sem cookie devolve user null")
const hollowMeStore = memoryAuthStore()
const meCookieHollow = await handleAuth(
  new Request("http://local.test/api/auth/me", { headers: { cookie: "abilion_session=oco" } }),
  hollowMeStore,
  { ABILION_ENV: "development", ABILION_OPERATOR_PASSWORD: "seedpass" }
)
assert(meCookieHollow.status === 503, "me com cookie e snapshot oco não é logout")
assert((await hollowMeStore.load()).users.length === 0, "me não persiste seed em cima do snapshot oco")
const meBearerHollow = await handleAuth(
  new Request("http://local.test/api/auth/me", { headers: { authorization: "Bearer abn_oco" } }),
  memoryAuthStore(),
  { ABILION_ENV: "development" }
)
assert(meBearerHollow.status === 503, "me com bearer e snapshot oco não é logout")
const hollowLogout = memoryAuthStore()
const logoutHollow = await handleAuth(
  new Request("http://local.test/api/auth/logout", { method: "POST", headers: { cookie: "abilion_session=oco" } }),
  hollowLogout,
  { ABILION_ENV: "development", ABILION_OPERATOR_PASSWORD: "seedpass" }
)
assert(logoutHollow.status === 200, "logout oco ainda limpa o cookie")
assert((await hollowLogout.load()).users.length === 0, "logout oco não persiste seed")
const hollowActor = await readActor(
  new Request("http://local.test/api/auth/me", { headers: { cookie: "abilion_session=oco" } }),
  memoryAuthStore()
)
assert(hollowActor.unread && !hollowActor.user, "readActor marca snapshot oco como unread")
const hollowGate = await gateActor(
  new Request("http://local.test/api/leads", { headers: { cookie: "abilion_session=oco" } }),
  memoryAuthStore()
)
assert(!hollowGate.ok && hollowGate.response.status === 503, "gateActor recusa snapshot oco com 503")
assert(!noteUnauthorized({ status: 503 }), "503 de contas unread não é sessão expirada")
const boomAuthStore = {
  async load() {
    throw new Error("kv down")
  },
  async save() {},
}
const boomMe = await handleAuth(
  new Request("http://local.test/api/auth/me", { headers: { cookie: "abilion_session=oco" } }),
  boomAuthStore,
  { ABILION_ENV: "development" }
)
assert(boomMe.status === 503, "me com KV throw não é Falha interna")
assert(((await boomMe.json()) as { error?: string }).error === "Não confirmei as contas.", "me KV throw pede confirmação")
const boomMeAnon = await handleAuth(new Request("http://local.test/api/auth/me"), boomAuthStore, { ABILION_ENV: "development" })
const boomMeAnonBody = (await boomMeAnon.json()) as { user: unknown }
assert(boomMeAnon.status === 200 && boomMeAnonBody.user === null, "me sem cookie não lê o snapshot")
const boomForgot = await handleAuth(
  new Request("http://local.test/api/auth/forgot", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "victor@abilion.com" }),
  }),
  boomAuthStore,
  { ABILION_ENV: "development" }
)
assert(boomForgot.status === 503, "forgot KV throw não finge que não há contas")
assert(((await boomForgot.json()) as { error?: string }).error === "Não confirmei as contas.", "forgot KV throw pede confirmação")
const boomLogin = await handleAuth(
  new Request("http://local.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "victor@abilion.com", password: "senhaok" }),
  }),
  boomAuthStore,
  { ABILION_ENV: "development", ABILION_OPERATOR_PASSWORD: "seedpass" }
)
assert(boomLogin.status === 503, "login KV throw não é 500 nem cria conta")
assert(((await boomLogin.json()) as { error?: string }).error === "Não confirmei as contas.", "login KV throw pede confirmação")
const boomLogout = await handleAuth(
  new Request("http://local.test/api/auth/logout", { method: "POST", headers: { cookie: "abilion_session=oco" } }),
  boomAuthStore,
  { ABILION_ENV: "development" }
)
assert(boomLogout.status === 200, "logout KV throw ainda limpa o cookie")
assert((boomLogout.headers.get("set-cookie") || "").toLowerCase().includes("abilion_session="), "logout KV throw manda cookie vazio")
const boomReset = await handleAuth(
  new Request("http://local.test/api/auth/reset", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: "abc", password: "senhaok" }),
  }),
  boomAuthStore,
  { ABILION_ENV: "development" }
)
assert(boomReset.status === 503, "reset KV throw não finge link inválido")
assert(((await boomReset.json()) as { error?: string }).error === "Não confirmei as contas.", "reset KV throw pede confirmação")
const boomPassword = await handleAuth(
  new Request("http://local.test/api/auth/password", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: "abilion_session=oco" },
    body: JSON.stringify({ currentPassword: "senhaok", password: "senhaok" }),
  }),
  boomAuthStore,
  { ABILION_ENV: "development" }
)
assert(boomPassword.status === 503, "password KV throw não é sessão expirada")
assert(((await boomPassword.json()) as { error?: string }).error === "Não confirmei as contas.", "password KV throw pede confirmação")
const boomActor = await readActor(
  new Request("http://local.test/api/auth/me", { headers: { cookie: "abilion_session=oco" } }),
  boomAuthStore
)
assert(boomActor.unread && !boomActor.user, "readActor marca KV throw como unread")
const boomGate = await gateActor(
  new Request("http://local.test/api/leads", { headers: { cookie: "abilion_session=oco" } }),
  boomAuthStore
)
assert(!boomGate.ok && boomGate.response.status === 503, "gateActor KV throw é 503")
const boomKv = {
  async get() {
    throw new Error("kv down")
  },
  async put() {},
}
const boomMeHttp = await handleRequest(
  new Request("http://local.test/api/auth/me", { headers: { cookie: "abilion_session=oco" } }),
  { ASSETS: { fetch: async () => new Response("ok") }, AUTH: boomKv } as Env,
  backgroundCtx()
)
const boomMeHttpBody = (await boomMeHttp.json()) as { error?: string }
assert(boomMeHttp.status === 503 && boomMeHttpBody.error === "Não confirmei as contas.", "GET /me KV throw não cai em Falha interna")
const boomLeadsHttp = await handleRequest(
  new Request("http://local.test/api/leads", { headers: { cookie: "abilion_session=oco" } }),
  { ASSETS: { fetch: async () => new Response("ok") }, AUTH: boomKv } as Env,
  backgroundCtx()
)
assert(boomLeadsHttp.status === 503, "GET /api/leads com snapshot KV throw é 503")
assert(((await boomLeadsHttp.json()) as { error?: string }).error === "Não confirmei as contas.", "leads KV throw pede as contas")
const passwordWrong = await handleAuth(
  new Request("http://local.test/api/auth/password", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: (await loginAttempt("senhaok")).headers.get("set-cookie") || "" },
    body: JSON.stringify({ currentPassword: "errada1", password: "novasenha" }),
  }),
  authStore,
  { ABILION_ENV: "development" }
)
assert(passwordWrong.status === 400, "senha actual errada é 400, não 401")
const seedStore = memoryAuthStore()
await ensureOperatorUsers(seedStore, "seedpass")
const seedLogin = await handleAuth(
  new Request("http://local.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.40" },
    body: JSON.stringify({ email: "victor@abilion.com", password: "seedpass" }),
  }),
  seedStore,
  { ABILION_ENV: "development", ABILION_OPERATOR_PASSWORD: "seedpass" }
)
assert(seedLogin.status === 200, "senha semeada entra")
const seedCookie = seedLogin.headers.get("set-cookie") || ""
const seedChange = await handleAuth(
  new Request("http://local.test/api/auth/password", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: seedCookie },
    body: JSON.stringify({ currentPassword: "seedpass", password: "novasenha" }),
  }),
  seedStore,
  { ABILION_ENV: "development", ABILION_OPERATOR_PASSWORD: "seedpass" }
)
assert(seedChange.status === 200, "troca de senha com seed no env")
await ensureOperatorUsers(seedStore, "seedpass")
const afterSeed = await handleAuth(
  new Request("http://local.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.41" },
    body: JSON.stringify({ email: "victor@abilion.com", password: "novasenha" }),
  }),
  seedStore,
  { ABILION_ENV: "development", ABILION_OPERATOR_PASSWORD: "seedpass" }
)
assert(afterSeed.status === 200, "seed no env não reescreve a senha trocada")
const staleSeed = await handleAuth(
  new Request("http://local.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.42" },
    body: JSON.stringify({ email: "victor@abilion.com", password: "seedpass" }),
  }),
  seedStore,
  { ABILION_ENV: "development", ABILION_OPERATOR_PASSWORD: "seedpass" }
)
assert(staleSeed.status === 401, "senha antiga do seed já não entra")

const sessionStore = memoryAuthStore()
const sessionCookies: string[] = []
for (let i = 0; i < 6; i++) {
  const res = await handleAuth(
    new Request("http://local.test/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${10 + i}` },
      body: JSON.stringify({ email: "victor@abilion.com", password: "sessao1" }),
    }),
    sessionStore,
    { ABILION_ENV: "development" }
  )
  assert(res.status === 200, `login ${i + 1} cria sessão`)
  sessionCookies.push(res.headers.get("set-cookie") || "")
}
const oldestMe = await handleAuth(
  new Request("http://local.test/api/auth/me", { headers: { cookie: sessionCookies[0] || "" } }),
  sessionStore,
  { ABILION_ENV: "development" }
)
const oldestBody = (await oldestMe.json()) as { user: unknown }
assert(oldestBody.user === null, "a 6ª sessão derruba a mais antiga")
const newestMe = await handleAuth(
  new Request("http://local.test/api/auth/me", { headers: { cookie: sessionCookies[5] || "" } }),
  sessionStore,
  { ABILION_ENV: "development" }
)
const newestBody = (await newestMe.json()) as { user: { email?: string } | null }
assert(newestBody.user?.email === "victor@abilion.com", "a sessão mais nova continua")

const pwdStore = memoryAuthStore()
const pwdLogin = await handleAuth(
  new Request("http://local.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.80" },
    body: JSON.stringify({ email: "gabriel@abilion.com", password: "senhaok" }),
  }),
  pwdStore,
  { ABILION_ENV: "development" }
)
const pwdCookie = pwdLogin.headers.get("set-cookie") || ""
for (let i = 0; i < 5; i++) {
  assert(
    (
      await handleAuth(
        new Request("http://local.test/api/auth/password", {
          method: "POST",
          headers: { "content-type": "application/json", cookie: pwdCookie, "x-forwarded-for": "203.0.113.80" },
          body: JSON.stringify({ currentPassword: "errada1", password: "novasenha" }),
        }),
        pwdStore,
        { ABILION_ENV: "development" }
      )
    ).status === 400,
    `password falha ${i + 1} entra no throttle`
  )
}
assert(
  (
    await handleAuth(
      new Request("http://local.test/api/auth/password", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: pwdCookie, "x-forwarded-for": "203.0.113.80" },
        body: JSON.stringify({ currentPassword: "errada1", password: "novasenha" }),
      }),
      pwdStore,
      { ABILION_ENV: "development" }
    )
  ).status === 429,
  "password bloqueia na sexta falha"
)

for (let i = 0; i < 8; i++) {
  assert((await loginAttempt("errada1")).status === 401, `falha ${i + 1} ainda entra no throttle`)
}
assert((await loginAttempt("errada1")).status === 429, "nona falha bloqueia de verdade")

const forgotAttempt = () =>
  handleAuth(
    new Request("http://local.test/api/auth/forgot", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" },
      body: JSON.stringify({ email: "victor@abilion.com" }),
    }),
    authStore,
    { ABILION_ENV: "development" }
  )
for (let i = 0; i < 5; i++) assert((await forgotAttempt()).status === 200, `forgot ${i + 1} passa`)
assert((await forgotAttempt()).status === 429, "forgot bloqueia na sexta")

const resetStore = memoryAuthStore()
const resetAttempt = () =>
  handleAuth(
    new Request("http://local.test/api/auth/reset", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.8" },
      body: JSON.stringify({ token: "nope", password: "novasenha" }),
    }),
    resetStore,
    { ABILION_ENV: "development" }
  )
for (let i = 0; i < 5; i++) assert((await resetAttempt()).status === 400, `reset ${i + 1} passa no throttle`)
assert((await resetAttempt()).status === 429, "reset bloqueia na sexta")

const disabledResetStore = memoryAuthStore()
const disabledHash = await hashPassword("senhaok")
await disabledResetStore.save({
  users: [
    {
      id: "rita-off",
      email: "rita@abilion.com",
      name: "Rita",
      passwordHash: disabledHash,
      createdAt: "2026-01-01T00:00:00.000Z",
      role: "operator",
      disabled: false,
    },
  ],
  sessions: [],
  resets: {},
})
const forgotRitaOn = (await (
  await handleAuth(
    new Request("http://local.test/api/auth/forgot", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.61" },
      body: JSON.stringify({ email: "rita@abilion.com" }),
    }),
    disabledResetStore,
    { ABILION_ENV: "development" }
  )
).json()) as { resetPath?: string }
const ritaResetToken = forgotRitaOn.resetPath?.split("token=")[1] || ""
assert(ritaResetToken, "forgot de conta ligada devolve link")
const ritaSnap = await disabledResetStore.load()
const ritaUser = ritaSnap.users.find((item) => item.email === "rita@abilion.com")
assert(ritaUser, "Rita existe")
ritaUser.disabled = true
ritaUser.accountUpdatedAt = Date.now()
await disabledResetStore.save(ritaSnap)
const forgotRitaOff = (await (
  await handleAuth(
    new Request("http://local.test/api/auth/forgot", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.62" },
      body: JSON.stringify({ email: "rita@abilion.com" }),
    }),
    disabledResetStore,
    { ABILION_ENV: "development" }
  )
).json()) as { ok?: boolean; resetPath?: string }
assert(forgotRitaOff.ok === true && !forgotRitaOff.resetPath, "conta desligada não recebe link")
const resetRitaOff = await handleAuth(
  new Request("http://local.test/api/auth/reset", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.63" },
    body: JSON.stringify({ token: ritaResetToken, password: "novasenha" }),
  }),
  disabledResetStore,
  { ABILION_ENV: "development" }
)
assert(resetRitaOff.status === 400, "reset de conta desligada é 400")
const ritaAfter = await disabledResetStore.load()
assert(!ritaAfter.resets[ritaResetToken], "token de conta desligada gasta-se")
assert(ritaAfter.spentResets?.includes(ritaResetToken), "token gasto fica no tombstone")
assert(ritaAfter.users.find((item) => item.id === "rita-off")?.passwordHash === disabledHash, "senha da conta desligada não muda")

const gone = lead("gone", "@gone")
gone.telegramChatId = "9"
await upsertLeadKv(kv, gone)
assert((await loadLead(kv, "gone"))?.contact === "@gone", "lead persistido no KV")
await deleteLeadKv(kv, "gone")
assert((await loadLead(kv, "gone")) === null, "lead apagado do KV")
assert((await findLeadInKv(kv, "@gone", 9, "9")) === null, "alias some com o lead apagado")
assert((await loadRemovedLeadIds(kv)).includes("gone"), "apagar grava tombstone persistente")
const staleGone = { ...gone, memory: "", updatedAt: new Date(Date.now() + 5000).toISOString() }
assert(resolveLeadLookup(null, staleGone, await loadRemovedLeadIds(kv)) === null, "tombstone bloqueia o remoto")
assert(resolveLeadLookup(first, staleGone)?.id === "crm-1", "KV ganha do remoto no webhook")
assert(resolveLeadLookup(null, first)?.id === "crm-1", "remoto serve se o KV nao tem")
assert(
  !adoptDueLeads([], [staleGone], ["gone"]).some((item) => item.id === "gone"),
  "cron nao adopta lead tombstoned"
)
assert(adoptDueLeads([first], [staleGone], []).some((item) => item.id === "crm-1"), "cron prefere o KV")
const dueMixWait = "2026-06-01T00:00:00.000Z"
const dueMixKv = { ...lead("due-mix", "@duemix"), waitUntil: undefined, updatedAt: "2026-06-01T00:00:00.000Z" }
const dueMixPg = { ...lead("due-mix", "@duemix"), waitUntil: dueMixWait, updatedAt: "2026-06-02T00:00:00.000Z" }
assert(
  adoptDueLeads([dueMixKv], [dueMixPg], []).some((item) => item.id === "due-mix" && item.waitUntil === dueMixWait),
  "cron não deixa a espera do backup se o KV está velho"
)
const dueAteKv = { ...lead("due-ate", "@dueate"), waitUntil: undefined, updatedAt: "2026-06-03T00:00:00.000Z" }
const dueAtePg = { ...lead("due-ate", "@dueate"), waitUntil: dueMixWait, updatedAt: "2026-06-01T00:00:00.000Z" }
assert(!adoptDueLeads([dueAteKv], [dueAtePg], [])[0]?.waitUntil, "cron não ressuscita espera que o KV já comeu")
assert(!(await upsertLeadKv(kv, gone)), "upsert não ressuscita tombstone")
assert(await isLeadRemoved(kv, "gone"), "voltar a gravar não limpa o tombstone")
assert((await loadLead(kv, "gone")) === null, "ficha apagada não volta pelo upsert")
assert((await findLeadInKv(kv, "@gone", 9, "9")) === null, "alias de lead apagado continua morto")

const sentOnly = memoryKv()
const sentNewer = {
  ...lead("sent-1", "@sent"),
  updatedAt: "2026-01-02T00:00:00.000Z",
  waitUntil: "2026-01-01T12:00:00.000Z",
  memory: "ste:welcome",
  telegramChatId: "9301",
  messages: [{ id: "m-ste", at: "2026-01-02T00:00:00.000Z", role: "ste" as const, text: "oi" }],
}
await rememberSentLead(sentOnly, sentNewer)
assert((await loadLead(sentOnly, "sent-1"))?.messages?.some((item) => item.id === "m-ste"), "loadLead lê crm:sent sem crm:lead")
assert((await listLeads(sentOnly, 20, "all")).some((item) => item.id === "sent-1"), "crm:sent entra no GET")
assert(
  (await dueLeadsKv(sentOnly, "2026-01-02T00:00:00.000Z")).leads.some((item) => item.id === "sent-1"),
  "crm:sent com espera entra no cron"
)
await sentOnly.put(
  leadKey("sent-1"),
  JSON.stringify({ ...lead("sent-1", "@sent"), updatedAt: "2026-01-01T00:00:00.000Z", messages: [] })
)
assert((await loadLead(sentOnly, "sent-1"))?.messages?.some((item) => item.id === "m-ste"), "loadLead prefere crm:sent mais novo")
const storedTalk = {
  ...lead("talk", "@talk"),
  updatedAt: "2026-01-01T00:00:00.000Z",
  messages: [
    { id: "m1", at: "2026-01-01T00:00:00.000Z", role: "ste" as const, text: "oi" },
    { id: "m2", at: "2026-01-01T00:01:00.000Z", role: "lead" as const, text: "sim" },
    { id: "m3", at: "2026-01-01T00:02:00.000Z", role: "ste" as const, text: "link" },
  ],
}
const sentThin = {
  ...lead("talk", "@talk"),
  updatedAt: "2026-01-02T00:00:00.000Z",
  waitUntil: "2026-01-03T00:00:00.000Z",
  messages: [{ id: "m4", at: "2026-01-02T00:00:00.000Z", role: "ste" as const, text: "retry" }],
}
const mergedTalk = adoptLeadKvStores(storedTalk, sentThin)
assert(mergedTalk?.messages?.map((item) => item.id).join(",") === "m1,m2,m3,m4", "crm:sent novo não apaga o histórico do crm:lead")
assert(mergedTalk?.waitUntil === "2026-01-03T00:00:00.000Z", "crm:sent novo ainda manda a espera")
assert(adoptLeadKvStores(null, sentThin)?.messages?.some((item) => item.id === "m4"), "só crm:sent")
assert(adoptLeadKvStores(storedTalk, null)?.messages?.length === 3, "só crm:lead")
const forkKv = memoryKv()
await forkKv.put(leadKey("talk"), JSON.stringify(storedTalk))
await forkKv.put(sentLeadKey("talk"), JSON.stringify(sentThin))
assert(
  (await loadLead(forkKv, "talk"))?.messages?.map((item) => item.id).join(",") === "m1,m2,m3,m4",
  "loadLead junta crm:lead e crm:sent"
)
await upsertLeadKv(sentOnly, { ...sentNewer, updatedAt: "2026-01-03T00:00:00.000Z", memory: "ste:welcome" })
assert(!(await sentOnly.get(sentLeadKey("sent-1"), "json")), "upsert canónico apaga o crm:sent")
const sentGone = memoryKv()
await rememberSentLead(sentGone, sentNewer)
await rememberRemovedLead(sentGone, "sent-1")
assert((await loadLead(sentGone, "sent-1")) === null, "lead apagado larga o crm:sent")
assert(!(await sentGone.get(sentLeadKey("sent-1"), "json")), "tombstone apaga crm:sent")

const capKv = memoryKv()
for (let i = 0; i < 401; i++) {
  const row = lead(`id-${i}`, `@u${i}`)
  row.telegramChatId = String(i)
  row.updatedAt = new Date(1_700_000_000_000 + i * 1000).toISOString()
  await upsertLeadKv(capKv, row)
}
assert((await findLeadInKv(capKv, "@u0", 0, "0"))?.id === "id-0", "alias encontra lead fora do recorte de 400")
assert((await listLeads(capKv, 400, "all")).length === 400, "lista pagina 400 de um índice maior")
assert(LEAD_WRITE_BATCH === 120, "POST de leads corta em 120")
assert(leadWriteChunks(Array.from({ length: 250 }, (_, i) => lead(`w-${i}`, `@w${i}`))).length === 3, "250 leads vão em 3 POSTs")
assert(leadWriteChunks(Array.from({ length: 250 }, (_, i) => lead(`k-${i}`, `@k${i}`)), true).length === 1, "pagehide só manda o primeiro lote")
const writeChunk = [lead("a", "@a"), lead("b", "@b"), lead("c", "@c")]
assert(leadWriteIds({ ok: true, saved: 3, ids: ["a", "c"] }, writeChunk).join() === "a,c", "flush só tira os ids que o Worker gravou")
assert(leadWriteIds({ ok: true, saved: 2 }, writeChunk).length === 0, "saved parcial sem ids não esvazia a fila")
assert(leadWriteIds({ ok: true, saved: 3 }, writeChunk).join() === "a,b,c", "Worker velho com saved completo ainda devolve o lote")
assert(leadWriteIds({ ok: true, ids: ["a", "ghost", "a"] }, writeChunk).join() === "a", "id de outro lote e repetido não entram")
assert(leadWriteIds({ ok: true, ids: ["live"], adopted: { a: "live" } }, writeChunk).join() === "a", "id canónico conta o local como gravado")
assert(leadWriteAdopted({ adopted: { a: "live", b: "b" } }).a === "live" && !leadWriteAdopted({ adopted: { b: "b" } }).b, "adopted ignora id igual")
assert(leadWriteIds({}, writeChunk).length === 0, "200 sem saved não finge que gravou")
const remapped = remapAdoptedLeads([lead("phantom", "@a"), lead("live", "@a")], { phantom: "live" })
assert(remapped.length === 1 && remapped[0]?.id === "live", "ficha fantasma cede ao id canónico")
assert(LEAD_INDEX_REST_CAP === 4000, "simulação sem chat cabe até 4000 no índice")
assert(LEAD_INDEX_PINNED_CAP === 8000, "chats sem espera cabem 8000 no índice")
const clippedChats = clipCrmIndex(
  Array.from({ length: LEAD_INDEX_PINNED_CAP + 2 }, (_, i) => ({
    id: `c-${i}`,
    contact: `@c${i}`,
    chatId: String(i),
    updatedAt: new Date(1_700_000_000_000 + i * 1000).toISOString(),
    channel: "telegram" as const,
  }))
)
assert(clippedChats.length === LEAD_INDEX_PINNED_CAP, "chat sem espera corta no teto")
assert(crmIndexClipped(clippedChats), "índice no teto de chats marca recorte")
assert(!crmIndexClipped(clippedChats.slice(1)), "abaixo do teto não marca recorte")
assert(!clippedChats.some((item) => item.id === "c-0"), "chat mais velho sai do índice")
assert(
  clippedChats.some((item) => item.id === `c-${LEAD_INDEX_PINNED_CAP + 1}`),
  "chat novo fica no índice"
)
assert(
  clipCrmIndex([
    ...clippedChats,
    {
      id: "w-old",
      contact: "@wold",
      chatId: "w-old",
      waitUntil: "2026-12-01T00:00:00.000Z",
      updatedAt: "2010-01-01T00:00:00.000Z",
      channel: "telegram" as const,
    },
  ]).some((item) => item.id === "w-old"),
  "espera antiga não cai do índice"
)
const lookKv = memoryKv()
const lookLead = lead("look-me", "@lookme")
lookLead.telegramChatId = "4400"
await upsertLeadKv(lookKv, lookLead)
lookLead.name = "Paulo Sergio de Souza"
lookLead.category = "Grupo Premium"
await upsertLeadKv(lookKv, lookLead)
assert((await lookupLeadsByQuery(lookKv, "@lookme"))[0]?.id === "look-me", "busca pelo @user usa o alias")
assert((await lookupLeadsByQuery(lookKv, "look-me"))[0]?.id === "look-me", "busca pelo id do lead")
assert((await lookupLeadsByQuery(lookKv, "Paulo Sergio"))[0]?.id === "look-me", "busca pelo nome da pessoa")
assert((await lookupLeadsByQuery(lookKv, "sergio"))[0]?.id === "look-me", "busca pelo nome sem acento/caixa")
assert((await lookupLeadsByQuery(lookKv, "ab")).length === 0, "busca curta não varre o índice")
assert((await lookupLeadsByQuery(lookKv, "Grupo Premium"))[0]?.id === "look-me", "busca Worker pela categoria")
assert(leadMatchesQuery({ id: "x", name: "Maria Silva", contact: "+5511987654321" }, "maria"), "nome dobra na busca")
assert(leadMatchesQuery({ id: "x", name: "José Silva", contact: "@jose" }, "jose"), "acento dobra na busca")
assert(leadMatchesQuery({ id: "x", name: "Ana", contact: "@ana", campaign: "Black Friday" }, "black"), "campanha entra na busca")
assert(leadMatchesQuery({ id: "x", name: "Ana", contact: "@ana", lastMessage: "quero o link" }, "link"), "última fala entra na busca")
assert(leadMatchesQuery({ id: "x", name: "José", contact: "@j" }, "jo", 1), "busca local curta com acento")
assert(!leadMatchesQuery({ id: "x", name: "Maria Silva", contact: "@maria" }, "ab"), "busca curta não casa")
const silentChat = lead("silent-fb", "@silent")
assert(!hasConversation(silentChat), "origem facebook sem fala não é conversa")
silentChat.lastMessage = "oi"
assert(hasConversation(silentChat), "lastMessage conta como conversa")
assert(clipRemovedIds(Array.from({ length: 8010 }, (_, i) => `gone-${i}`), LEAD_REMOVED_CAP).length === 8000, "tombstone de lead aguenta 8000")
const tombKv = memoryKv()
for (let i = 0; i < 12; i++) await rememberRemovedLead(tombKv, `gone-${i}`)
assert((await loadRemovedLeadIds(tombKv)).length === 12, "tombstones recentes ficam")
const durableGone = memoryKv()
await upsertLeadKv(durableGone, lead("old-id", "@oldgone"))
await deleteLeadKv(durableGone, "old-id")
await durableGone.put(CRM_REMOVED, JSON.stringify({ ids: [] }))
assert(!(await loadRemovedLeadIds(durableGone)).includes("old-id"), "lista de tombstone rolou")
assert(await isLeadRemoved(durableGone, "old-id"), "chave gone sobrevive ao recorte")
assert((await importOrAdoptLead(durableGone, lead("old-id", "@oldgone"))) === null, "import não ressuscita id apagado")
assert(await isLeadRemoved(durableGone, "old-id"), "import recusado não limpa o gone")
assert((await loadLead(durableGone, "old-id")) === null, "id gone não volta pelo import")
await durableGone.put(leadKey("old-id"), JSON.stringify(lead("old-id", "@oldgone")))
assert((await loadLead(durableGone, "old-id")) === null, "crm:lead leftover com gone não volta")
assert((await filterLiveLeads(durableGone, [lead("old-id", "@oldgone"), lead("vivo", "@vivo")])).map((item) => item.id).join() === "vivo", "filterLiveLeads tira o gone e deixa o vivo")
assert((await claimLeadAlias(durableGone, "contact", "@oldgone", "fresh-id")) === "fresh-id", "alias de id gone cede o contacto")
const olderIdx = { id: "a", contact: "@a", updatedAt: "2020-01-01T00:00:00.000Z", channel: "telegram" as const }
const newerIdx = { id: "a", contact: "@a", updatedAt: "2026-01-01T00:00:00.000Z", channel: "telegram" as const }
const otherIdx = { id: "b", contact: "@b", updatedAt: "2026-01-02T00:00:00.000Z", channel: "telegram" as const }
assert(mergeIndexEntries([olderIdx], [newerIdx, otherIdx]).length === 2, "índice une ids distintos")
assert(mergeIndexEntries([newerIdx], [olderIdx]).find((item) => item.id === "a")?.updatedAt === newerIdx.updatedAt, "índice fica com o updatedAt mais novo")
const indexRaceKv = memoryKv()
await Promise.all(
  Array.from({ length: 30 }, (_, i) => {
    const row = lead(`idx-${i}`, `@idx${i}`)
    row.telegramChatId = String(2000 + i)
    row.waitUntil = new Date(Date.now() - 1000).toISOString()
    return upsertLeadKv(indexRaceKv, row)
  })
)
assert((await listLeads(indexRaceKv, 40, "all")).length === 30, "índice une upserts em paralelo")
assert((await dueLeadsKv(indexRaceKv, new Date().toISOString())).leads.length === 30, "cron vê esperas dos upserts em paralelo")
const indexDeleteKv = memoryKv()
await upsertLeadKv(indexDeleteKv, lead("keep-me", "@keep"))
await upsertLeadKv(indexDeleteKv, lead("drop-me", "@drop"))
await deleteLeadKv(indexDeleteKv, "drop-me")
assert((await listLeads(indexDeleteKv, 10, "all")).some((item) => item.id === "keep-me"), "DELETE não apaga o outro do índice")
assert(!(await listLeads(indexDeleteKv, 10, "all")).some((item) => item.id === "drop-me"), "DELETE tira o lead do índice")
const noIndexKv = memoryKv()
const innerPut = noIndexKv.put.bind(noIndexKv)
noIndexKv.put = async (key, value) => {
  if (key === "crm:index") return
  return innerPut(key, value)
}
assert(!(await upsertLeadKv(noIndexKv, lead("ghost-idx", "@ghostidx"))), "índice que não grava falha o upsert")
const simKv = memoryKv()
for (let i = 0; i < 401; i++) {
  const row = lead(`sim-${i}`, `@sim${i}`)
  row.updatedAt = new Date(1_700_000_000_000 + i * 1000).toISOString()
  await upsertLeadKv(simKv, row)
}
assert((await listLeads(simKv, 500, "all")).length === 401, "401 simulações sem chat não caem do índice")
const firstLeadPage = await listLeadPage(capKv, 400, "all")
assert(firstLeadPage.nextCursor && isLeadPageCursor(firstLeadPage.nextCursor), "primeira página de 401 leads tem cursor")
assert(!firstLeadPage.clipped, "401 chats não marcam o teto do índice")
const secondLeadPage = await listLeadPage(capKv, 400, "all", firstLeadPage.nextCursor)
assert(secondLeadPage.leads.some((item) => item.id === "id-0"), "página seguinte traz o lead antigo com chat")
const firstInboxPage = await listLeadPage(capKv, 400, "telegram")
assert(firstInboxPage.nextCursor && isLeadPageCursor(firstInboxPage.nextCursor), "primeira página da inbox tem cursor")
const secondInboxPage = await listLeadPage(capKv, 400, "telegram", firstInboxPage.nextCursor)
assert(secondInboxPage.leads.some((item) => item.id === "id-0"), "página seguinte da inbox traz o chat antigo")
assert(
  (await listLeadPage(capKv, 400, "all", "1999-01-01T00:00:00.000Z|missing")).leads.length === 0,
  "cursor desconhecido não rebobina a lista"
)
assert(
  (await listLeadPage(capKv, 400, "all", "1999-01-01T00:00:00.000Z|missing")).stale,
  "cursor desconhecido marca a página como velha"
)
const waitingOld = lead("wait-old", "@waitold")
waitingOld.waitUntil = new Date(Date.now() - 1000).toISOString()
waitingOld.updatedAt = new Date(1_600_000_000_000).toISOString()
waitingOld.telegramChatId = "wait-old"
waitingOld.channel = "telegram"
await upsertLeadKv(capKv, waitingOld)
for (let i = 500; i < 920; i++) {
  const row = lead(`id-${i}`, `@u${i}`)
  row.telegramChatId = String(i)
  row.updatedAt = new Date(1_800_000_000_000 + i * 1000).toISOString()
  await upsertLeadKv(capKv, row)
}
assert(
  (await dueLeadsKv(capKv, new Date().toISOString())).leads.some((item) => item.id === "wait-old"),
  "espera antiga não cai do índice"
)
const lockKv = memoryKv()
const lockOwner = await claimCronLock(lockKv, Date.now(), 90_000)
assert(lockOwner, "cron pega o lock")
assert(!(await claimCronLock(lockKv, Date.now(), 90_000)), "lock impede cron sobreposto")
await releaseCronLock(lockKv, "outro")
assert(!(await claimCronLock(lockKv, Date.now(), 90_000)), "release alheio não solta o lock")
await releaseCronLock(lockKv, lockOwner ?? "")
assert(await claimCronLock(lockKv, Date.now(), 90_000), "release certo solta o lock")
const expiredLock = memoryKv()
await expiredLock.put(CRM_CRON_LOCK, JSON.stringify({ until: new Date(Date.now() - 1000).toISOString(), owner: "velho" }))
assert(await claimCronLock(expiredLock, Date.now(), 90_000), "lock expirado pode ser pego")
const renewKv = memoryKv()
const renewOwner = await claimCronLock(renewKv, 1000, 90_000, "cron-a")
assert(renewOwner === "cron-a", "claim para renovar")
assert(await renewCronLock(renewKv, "cron-a", 91_000, 90_000), "dono renova depois do TTL")
assert(!(await claimCronLock(renewKv, 91_000, 90_000, "cron-b")), "lock renovado ainda impede o outro")
assert(!(await renewCronLock(renewKv, "cron-b", 91_000, 90_000)), "alheio não renova")
let lockReads = 0
const racedLock = {
  async get(key: string) {
    if (key === CRM_CRON_LOCK) {
      lockReads += 1
      if (lockReads === 1) return null
      return { until: new Date(Date.now() + 90_000).toISOString(), owner: "outro" }
    }
    return null
  },
  async put() {},
}
assert(!(await claimCronLock(racedLock, Date.now(), 90_000, "eu")), "lock perde a corrida no verify")
let retryReads = 0
const retryLock = {
  async get(key: string) {
    if (key !== CRM_CRON_LOCK) return null
    retryReads += 1
    if (retryReads <= 2) return null
    return { until: new Date(Date.now() + 90_000).toISOString(), owner: "eu" }
  },
  async put() {},
}
assert((await claimCronLock(retryLock, Date.now(), 90_000, "eu")) === "eu", "lock retenta se o verify ainda veio vazio")
const badJsonReq = new Request("http://local.test/api/crm", { method: "POST", headers: { "content-type": "application/json" }, body: "{bad" })
assert((await readJsonObject(badJsonReq, 1000)).ok === false, "JSON inválido não passa a objeto vazio")

clearSessionExpired()
let expiredHits = 0
const stopWatch = subscribeSessionExpired(() => {
  expiredHits += 1
})
assert(noteUnauthorized({ status: 401 }), "401 marca sessão expirada")
assert(!noteUnauthorized({ status: 401 }), "401 não dispara duas vezes")
assert(expiredHits === 1, "listener da sessão corre uma vez")
clearSessionExpired()
assert(!noteUnauthorized({ status: 403 }), "403 não é sessão expirada")
stopWatch()

const apiEnv = {
  ASSETS: { fetch: async () => new Response("ok") },
  SUPABASE_URL: "https://example.supabase.co",
  AUTH: memoryKv(),
  ABILION_ENV: "development",
} as Env
const denied = await handleRequest(new Request("http://local.test/api/crm"), apiEnv, backgroundCtx())
assert(denied.status === 401, "CRM sem sessão é 401")
const deniedInbox = await handleRequest(new Request("http://local.test/api/inbox"), apiEnv, backgroundCtx())
assert(deniedInbox.status === 401, "inbox sem sessão é 401")
const deniedLeads = await handleRequest(
  new Request("http://local.test/api/leads", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ leads: [] }),
  }),
  apiEnv,
  backgroundCtx()
)
assert(deniedLeads.status === 401, "leads sem sessão é 401")
const deniedLeadList = await handleRequest(new Request("http://local.test/api/leads"), apiEnv, backgroundCtx())
assert(deniedLeadList.status === 401, "lista de leads sem sessão é 401")
const hollowLeads = await handleRequest(
  new Request("http://local.test/api/leads", { headers: { cookie: "abilion_session=oco" } }),
  { ...apiEnv, AUTH: memoryKv() } as Env,
  backgroundCtx()
)
assert(hollowLeads.status === 503, "lista com cookie e snapshot oco não é logout")
const hollowCrm = await handleRequest(
  new Request("http://local.test/api/crm", { headers: { cookie: "abilion_session=oco" } }),
  { ...apiEnv, AUTH: memoryKv() } as Env,
  backgroundCtx()
)
assert(hollowCrm.status === 503, "CRM com cookie e snapshot oco não é logout")
const deniedSummary = await handleRequest(new Request("http://local.test/api/track/summary"), apiEnv, backgroundCtx())
assert(deniedSummary.status === 401, "analytics sem sessão é 401")
assert(rowToTrackEvent({ id: "ev-1", visitor_id: "aabbcc11", kind: "view", at: "2026-01-01T00:00:00.000Z" })?.visitorId === "aabbcc11", "page_events vira evento do pixel")
assert(rowToTrackEvent({ id: "ev-1", visitor_id: "aabbcc11", kind: "nope" }) === null, "kind inválido não entra no summary")
assert((await fetchRemotePageEvents({} as Env)).length === 0, "sem credenciais o pixel remoto não finge falha")
assert(
  (await fetchRemotePageEvents({ SUPABASE_URL: "https://sb.test", SUPABASE_SERVICE_ROLE: "role" } as Env)) === null,
  "page_events com Postgres em baixo é null"
)
const trackEmptyUnread = await summarizeWorkspaceTrack(
  { SUPABASE_URL: "https://sb.test", SUPABASE_SERVICE_ROLE: "role" } as Env,
  []
)
assert(!trackEmptyUnread.ok, "KV oco + page_events unread não é zero")
const trackLeftover = await recordTrack(memoryTrackStore(), { kind: "view", visitorId: "aabbcc11" }, Date.now())
const trackLeftoverSummary = await summarizeWorkspaceTrack(
  { SUPABASE_URL: "https://sb.test", SUPABASE_SERVICE_ROLE: "role" } as Env,
  trackLeftover ? [trackLeftover] : []
)
assert(trackLeftoverSummary.ok && trackLeftoverSummary.unread && trackLeftoverSummary.summary.views >= 1, "KV leftover do pixel sobrevive unread")
const trackDownKv = memoryKv()
const trackDownEnv = {
  ASSETS: { fetch: async () => new Response("ok") },
  SUPABASE_URL: "https://sb.test",
  SUPABASE_SERVICE_ROLE: "role",
  AUTH: trackDownKv,
  ABILION_ENV: "development",
} as Env
const trackDownLogin = await handleRequest(
  new Request("http://local.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "victor@abilion.com", password: "senhaok" }),
  }),
  trackDownEnv,
  backgroundCtx()
)
assert(trackDownLogin.status === 200, "login para o summary unread")
const trackDownCookie = trackDownLogin.headers.get("set-cookie") || ""
const trackDownPrev = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (String(input).includes("/rest/v1/page_events")) throw new Error("page_events down")
  return trackDownPrev(input, init)
}) as typeof fetch
try {
  const trackDownSummary = await handleRequest(
    new Request("http://local.test/api/track/summary", { headers: { cookie: trackDownCookie } }),
    trackDownEnv,
    backgroundCtx()
  )
  const trackDownBody = (await trackDownSummary.json()) as { error?: string; summary?: { views?: number } }
  assert(trackDownSummary.status === 503 && trackDownBody.error?.includes("Postgres"), "GET summary oco + Postgres unread é 503")
  assert(!trackDownBody.summary, "503 do pixel não devolve zeros")
  await recordTrack(kvTrackStore(trackDownKv), { kind: "view", visitorId: "aabbcc11" }, Date.now())
  const trackKeepSummary = await handleRequest(
    new Request("http://local.test/api/track/summary", { headers: { cookie: trackDownCookie } }),
    trackDownEnv,
    backgroundCtx()
  )
  const trackKeepBody = (await trackKeepSummary.json()) as { ok?: boolean; summary?: { views?: number }; trackUnread?: boolean }
  assert(trackKeepSummary.status === 200 && trackKeepBody.ok && (trackKeepBody.summary?.views ?? 0) >= 1, "GET summary leftover não esconde o pixel do KV")
  assert(trackKeepBody.trackUnread, "GET summary leftover marca trackUnread")
} finally {
  globalThis.fetch = trackDownPrev
}
const trackRemoteKv = memoryKv()
const trackRemoteEnv = {
  ASSETS: { fetch: async () => new Response("ok") },
  SUPABASE_URL: "https://sb.test",
  SUPABASE_SERVICE_ROLE: "role",
  AUTH: trackRemoteKv,
  ABILION_ENV: "development",
} as Env
const trackRemoteLogin = await handleRequest(
  new Request("http://local.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "victor@abilion.com", password: "senhaok" }),
  }),
  trackRemoteEnv,
  backgroundCtx()
)
assert(trackRemoteLogin.status === 200, "login para o summary do backup")
const trackRemoteCookie = trackRemoteLogin.headers.get("set-cookie") || ""
const trackRemotePrev = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (String(input).includes("/rest/v1/page_events")) {
    return new Response(
      JSON.stringify([
        {
          id: "pg-view",
          visitor_id: "aabbcc22",
          kind: "view",
          path: "/l",
          campaign: "Facebook · ads",
          at: new Date().toISOString(),
        },
      ]),
      { status: 200, headers: { "content-type": "application/json" } }
    )
  }
  return trackRemotePrev(input, init)
}) as typeof fetch
try {
  const trackRemoteSummary = await handleRequest(
    new Request("http://local.test/api/track/summary", { headers: { cookie: trackRemoteCookie } }),
    trackRemoteEnv,
    backgroundCtx()
  )
  const trackRemoteBody = (await trackRemoteSummary.json()) as { ok?: boolean; summary?: { views?: number; visitors?: number } }
  assert(trackRemoteSummary.status === 200 && trackRemoteBody.ok && (trackRemoteBody.summary?.views ?? 0) >= 1, "GET summary lê page_events quando o KV está oco")
  assert((trackRemoteBody.summary?.visitors ?? 0) >= 1, "page_events oco no KV não finge zero visitantes")
} finally {
  globalThis.fetch = trackRemotePrev
}
const health = await handleRequest(new Request("http://local.test/api/health"), apiEnv, backgroundCtx())
const healthBody = (await health.json()) as { ok?: boolean; telegramBotUsername?: string }
assert(health.status === 200 && healthBody.ok && healthBody.telegramBotUsername === "", "health público expõe username vazio")
assert(health.headers.get("strict-transport-security")?.includes("max-age=31536000"), "health manda HSTS")
assert(
  !("llm" in healthBody) && !("model" in healthBody) && !("persist" in healthBody) && !("telegram" in healthBody),
  "health público não expõe o runtime"
)
await saveSettingsKv(apiEnv.AUTH, migrateSettings({ telegramBotUsername: "good_bot" }))
const namedHealth = (await (await handleRequest(new Request("http://local.test/api/health"), apiEnv, backgroundCtx())).json()) as {
  telegramBotUsername?: string
}
assert(namedHealth.telegramBotUsername === "@good_bot", "health usa o username das settings")
const unsignedHook = await handleRequest(
  new Request("http://local.test/api/telegram", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  }),
  apiEnv,
  backgroundCtx()
)
assert(unsignedHook.status === 401, "webhook sem secret é 401")
const signedEnv = { ...apiEnv, TELEGRAM_WEBHOOK_SECRET: "hook-secret" }
const badHook = await handleRequest(
  new Request("http://local.test/api/telegram", {
    method: "POST",
    headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "hook-secret" },
    body: "{",
  }),
  signedEnv,
  backgroundCtx()
)
assert(badHook.status === 400, "webhook recusa JSON inválido")
const wrongSecret = await handleRequest(
  new Request("http://local.test/api/telegram", {
    method: "POST",
    headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "nope" },
    body: "{}",
  }),
  signedEnv,
  backgroundCtx()
)
assert(wrongSecret.status === 401, "webhook com secret errado é 401")
const hugeHook = await handleRequest(
  new Request("http://local.test/api/telegram", {
    method: "POST",
    headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "hook-secret" },
    body: JSON.stringify({ message: { chat: { id: 1 }, text: "x".repeat(70_000) } }),
  }),
  signedEnv,
  backgroundCtx()
)
assert(hugeHook.status === 413, "webhook recusa corpo enorme")
const prevTelegramFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (String(input).includes("api.telegram.org")) {
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  }
  return prevTelegramFetch(input, init)
}) as typeof fetch
const startCtx = backgroundCtx()
const startEnv = { ...apiEnv, TELEGRAM_WEBHOOK_SECRET: "hook-secret", TELEGRAM_BOT_TOKEN: "000:test" } as Env
const startHook = await handleRequest(
  new Request("http://local.test/api/telegram", {
    method: "POST",
    headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "hook-secret" },
    body: JSON.stringify({
      message: {
        chat: { id: 9001 },
        text: "/start fb_aabbcc",
        from: { id: 9001, username: "fbuser", first_name: "Ana" },
      },
    }),
  }),
  startEnv,
  startCtx
)
assert(startHook.status === 200, "webhook /start Facebook é 200")
await startCtx.flush()
const started = await listLeads(startEnv.AUTH, 20, "all")
const ana = started.find((item) => item.contact === "@fbuser")
assert(ana?.origin === "facebook", "/start fb cria lead Facebook")
assert(ana?.visitorId === "aabbcc", "/start fecha o visitor do pixel")
assert((ana?.messages ?? []).some((item) => item.role === "ste"), "Sté mandou as boas-vindas")
assert(!(ana?.messages ?? []).some((item) => item.role === "lead"), "/start não entra como fala do lead")
const steWelcome = (ana?.messages ?? []).filter((item) => item.role === "ste").length
const againCtx = backgroundCtx()
assert(
  (
    await handleRequest(
      new Request("http://local.test/api/telegram", {
        method: "POST",
        headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "hook-secret" },
        body: JSON.stringify({
          message: {
            chat: { id: 9001 },
            text: "/start fb_aabbcc",
            from: { id: 9001, username: "fbuser", first_name: "Ana" },
          },
        }),
      }),
      startEnv,
      againCtx
    )
  ).status === 200,
  "segundo /start é 200"
)
await againCtx.flush()
const anaAgain = (await listLeads(startEnv.AUTH, 20, "all")).find((item) => item.contact === "@fbuser")
assert((anaAgain?.messages ?? []).filter((item) => item.role === "ste").length === steWelcome, "segundo /start não spam")
const talkCtx = backgroundCtx()
assert(
  (
    await handleRequest(
      new Request("http://local.test/api/telegram", {
        method: "POST",
        headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "hook-secret" },
        body: JSON.stringify({
          message: {
            chat: { id: 9001 },
            text: "tô perdendo tudo no Aviator",
            from: { id: 9001, username: "fbuser", first_name: "Ana" },
          },
        }),
      }),
      startEnv,
      talkCtx
    )
  ).status === 200,
  "webhook da fala do lead é 200"
)
await talkCtx.flush()
const anaTalk = (await listLeads(startEnv.AUTH, 20, "all")).find((item) => item.contact === "@fbuser")
assert((anaTalk?.messages ?? []).some((item) => item.role === "lead" && item.text.includes("perdendo")), "lead falou no 1:1")
assert(
  anaTalk?.stePhase === "diagnosis" || (anaTalk?.messages ?? []).some((item) => item.text.includes("minicurso")),
  "Sté avançou ao minicurso"
)
const joinCtx = backgroundCtx()
assert(
  (
    await handleRequest(
      new Request("http://local.test/api/telegram", {
        method: "POST",
        headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "hook-secret" },
        body: JSON.stringify({
          message: {
            chat: { id: -100 },
            from: { id: 7002, username: "joiner", first_name: "João" },
            new_chat_members: [{ id: 7002, username: "joiner", first_name: "João" }],
          },
        }),
      }),
      startEnv,
      joinCtx
    )
  ).status === 200,
  "webhook join é 200"
)
await joinCtx.flush()
const joined = (await listLeads(startEnv.AUTH, 20, "all")).find((item) => item.contact === "@joiner")
assert(joined?.origin === "group_join" || joined?.stage === "group", "join cria lead do grupo")
assert(!(joined?.messages ?? []).some((item) => item.role === "ste"), "join não dispara a Sté no 1:1")
globalThis.fetch = prevTelegramFetch
const denyFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (String(input).includes("api.telegram.org")) {
    return new Response(JSON.stringify({ ok: false, description: "Forbidden: bot was blocked" }), { status: 403 })
  }
  return denyFetch(input, init)
}) as typeof fetch
const failEnv = { ...apiEnv, TELEGRAM_WEBHOOK_SECRET: "hook-secret", TELEGRAM_BOT_TOKEN: "000:fail" } as Env
const failCtx = backgroundCtx()
assert(
  (
    await handleRequest(
      new Request("http://local.test/api/telegram", {
        method: "POST",
        headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "hook-secret" },
        body: JSON.stringify({
          update_id: 77,
          message: {
            chat: { id: 8001 },
            text: "/start fb_fail",
            from: { id: 8001, username: "blocked", first_name: "Bia" },
          },
        }),
      }),
      failEnv,
      failCtx
    )
  ).status === 200,
  "webhook recusado pelo Telegram ainda é 200"
)
await failCtx.flush()
const blocked = (await listLeads(failEnv.AUTH, 20, "all")).find((item) => item.contact === "@blocked")
assert(blocked?.telegramChatId === "8001", "lead recusado fica com o chat")
assert(!(blocked?.messages ?? []).some((item) => item.role === "ste"), "Telegram recusado não grava boas-vindas")
const heard = rememberLeadTalk({ ...blocked!, messages: [] }, "quero o app")
assert(heard.messages.some((item) => item.role === "lead" && item.text === "quero o app"), "rememberLeadTalk guarda a fala")
assert(rememberLeadTalk(heard, "quero o app").messages.filter((item) => item.role === "lead").length === 1, "rememberLeadTalk não duplica a mesma fala")
assert(rememberLeadTalk(heard, "").messages.length === heard.messages.length, "rememberLeadTalk ignora texto vazio")
const retryTalk = replySte(heard, "quero o app")
assert(retryTalk.lead.messages.filter((item) => item.role === "lead" && item.text === "quero o app").length === 1, "replySte não duplica inbound já gravado")
const talkFailCtx = backgroundCtx()
assert(
  (
    await handleRequest(
      new Request("http://local.test/api/telegram", {
        method: "POST",
        headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "hook-secret" },
        body: JSON.stringify({
          update_id: 78,
          message: {
            chat: { id: 8002 },
            text: "quero o app",
            from: { id: 8002, username: "blockedtalk", first_name: "Bia" },
          },
        }),
      }),
      failEnv,
      talkFailCtx
    )
  ).status === 200,
  "webhook de fala recusada ainda é 200"
)
await talkFailCtx.flush()
const blockedTalk = (await listLeads(failEnv.AUTH, 20, "all")).find((item) => item.contact === "@blockedtalk")
assert((blockedTalk?.messages ?? []).some((item) => item.role === "lead" && item.text === "quero o app"), "Telegram recusado guarda a fala do lead")
assert(!(blockedTalk?.messages ?? []).some((item) => item.role === "ste"), "Telegram recusado não grava a resposta da Sté")
const talkPersistKv = memoryKv()
const talkPersistPut = talkPersistKv.put.bind(talkPersistKv)
talkPersistKv.put = async (key, value) => {
  if (key === CRM_INDEX) return
  return talkPersistPut(key, value)
}
const talkPersistEnv = {
  ...failEnv,
  AUTH: talkPersistKv,
} as Env
const talkPersistCtx = backgroundCtx()
assert(
  (
    await handleRequest(
      new Request("http://local.test/api/telegram", {
        method: "POST",
        headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "hook-secret" },
        body: JSON.stringify({
          update_id: 79,
          message: {
            chat: { id: 8003 },
            text: "quero o app",
            from: { id: 8003, username: "savetalk", first_name: "Bia" },
          },
        }),
      }),
      talkPersistEnv,
      talkPersistCtx
    )
  ).status === 200,
  "webhook recusado com índice falho ainda é 200"
)
await talkPersistCtx.flush()
const savedTalk = await findLeadInKv(talkPersistKv, "@savetalk", 8003, "8003")
assert((savedTalk?.messages ?? []).some((item) => item.role === "lead" && item.text === "quero o app"), "recusa + índice falho ainda guarda a fala no crm:sent")
assert(!(savedTalk?.messages ?? []).some((item) => item.role === "ste"), "recusa + índice falho não grava a Sté")
globalThis.fetch = denyFetch
let partialCalls = 0
const partialPrev = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (String(input).includes("api.telegram.org")) {
    partialCalls += 1
    if (partialCalls === 1) return new Response(JSON.stringify({ ok: true }), { status: 200 })
    return new Response(JSON.stringify({ ok: false, description: "timeout" }), { status: 403 })
  }
  return partialPrev(input, init)
}) as typeof fetch
const partEnv = { ...apiEnv, TELEGRAM_WEBHOOK_SECRET: "hook-secret", TELEGRAM_BOT_TOKEN: "000:part" } as Env
const partBody = {
  update_id: 91,
  message: {
    chat: { id: 8201 },
    text: "/start fb_part",
    from: { id: 8201, username: "partial", first_name: "Pia" },
  },
}
const partCtx = backgroundCtx()
assert(
  (
    await handleRequest(
      new Request("http://local.test/api/telegram", {
        method: "POST",
        headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "hook-secret" },
        body: JSON.stringify(partBody),
      }),
      partEnv,
      partCtx
    )
  ).status === 200,
  "webhook parcial ainda é 200"
)
await partCtx.flush()
const pia = (await listLeads(partEnv.AUTH, 20, "all")).find((item) => item.contact === "@partial")
assert((pia?.messages ?? []).some((item) => item.role === "ste"), "envio parcial já entregue grava as boas-vindas")
assert(partialCalls === 2, "para no primeiro recusado depois de um aceite")
const partAgain = backgroundCtx()
await handleRequest(
  new Request("http://local.test/api/telegram", {
    method: "POST",
    headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "hook-secret" },
    body: JSON.stringify(partBody),
  }),
  partEnv,
  partAgain
)
await partAgain.flush()
assert(partialCalls === 2, "update parcial não reenvia as falas já aceites")
globalThis.fetch = partialPrev
const okFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (String(input).includes("api.telegram.org")) {
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  }
  return okFetch(input, init)
}) as typeof fetch
const dupEnv = { ...apiEnv, TELEGRAM_WEBHOOK_SECRET: "hook-secret", TELEGRAM_BOT_TOKEN: "000:dup" } as Env
const dupOnce = backgroundCtx()
const dupBody = {
  update_id: 42,
  message: {
    chat: { id: 8100 },
    text: "/start fb_dup",
    from: { id: 8100, username: "dup", first_name: "Duda" },
  },
}
await handleRequest(
  new Request("http://local.test/api/telegram", {
    method: "POST",
    headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "hook-secret" },
    body: JSON.stringify(dupBody),
  }),
  dupEnv,
  dupOnce
)
await dupOnce.flush()
const dudaFirst = (await listLeads(dupEnv.AUTH, 20, "all")).find((item) => item.contact === "@dup")
const dudaSte = (dudaFirst?.messages ?? []).filter((item) => item.role === "ste").length
assert(dudaSte > 0, "primeiro update grava as boas-vindas")
const dupAgain = backgroundCtx()
await handleRequest(
  new Request("http://local.test/api/telegram", {
    method: "POST",
    headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "hook-secret" },
    body: JSON.stringify(dupBody),
  }),
  dupEnv,
  dupAgain
)
await dupAgain.flush()
const duda = (await listLeads(dupEnv.AUTH, 20, "all")).find((item) => item.contact === "@dup")
assert((duda?.messages ?? []).filter((item) => item.role === "ste").length === dudaSte, "update_id repetido não reenvia")
assert(await claimTelegramUpdate(dupEnv.AUTH, 42) === false, "update_id já visto não volta a entrar")
const saveFailBase = memoryKv()
const saveFailKv = {
  get: (key: string, type: "json") => saveFailBase.get(key, type),
  async put(key: string, value: string) {
    if (key.startsWith("crm:lead:")) throw new Error("kv down")
    return saveFailBase.put(key, value)
  },
  delete: (key: string) => saveFailBase.delete?.(key),
}
let saveFailCalls = 0
const saveFailFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (String(input).includes("api.telegram.org")) {
    saveFailCalls += 1
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  }
  return saveFailFetch(input, init)
}) as typeof fetch
const saveFailEnv = { ...apiEnv, AUTH: saveFailKv, TELEGRAM_WEBHOOK_SECRET: "hook-secret", TELEGRAM_BOT_TOKEN: "000:savefail" } as Env
const saveFailBody = {
  update_id: 501,
  message: {
    chat: { id: 9301 },
    text: "/start fb_savefail",
    from: { id: 9301, username: "savefail", first_name: "Lia" },
  },
}
const saveFailCtx = backgroundCtx()
assert(
  (
    await handleRequest(
      new Request("http://local.test/api/telegram", {
        method: "POST",
        headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "hook-secret" },
        body: JSON.stringify(saveFailBody),
      }),
      saveFailEnv,
      saveFailCtx
    )
  ).status === 200,
  "envio ok com KV a falhar ainda é 200"
)
await saveFailCtx.flush()
const firstSaveFailCalls = saveFailCalls
assert(firstSaveFailCalls > 0, "Telegram recebeu as boas-vindas antes do KV falhar")
assert((await claimTelegramUpdate(saveFailKv, 501)) === false, "KV a falhar depois do envio não esquece o update")
const saveFailAgain = backgroundCtx()
await handleRequest(
  new Request("http://local.test/api/telegram", {
    method: "POST",
    headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "hook-secret" },
    body: JSON.stringify(saveFailBody),
  }),
  saveFailEnv,
  saveFailAgain
)
await saveFailAgain.flush()
assert(saveFailCalls === firstSaveFailCalls, "retry do mesmo update não volta a mandar")
const sentLia = await findLeadInKv(saveFailKv, "@savefail", 9301, "9301")
assert((sentLia?.messages ?? []).some((item) => item.role === "ste"), "crm:sent guarda as boas-vindas se crm:lead falhar")
assert(sentLia?.stePhase === "listen", "crm:sent guarda a fase listen")
assert(sentLia?.memory?.includes("ste:remarketing"), "crm:sent guarda o token da espera")
assert((await listLeads(saveFailKv, 20, "all")).some((item) => item.contact === "@savefail"), "GET vê o lead só com crm:sent")
const sentWait = sentLia?.waitUntil ?? ""
assert(sentWait, "crm:sent guarda a espera")
assert(
  (await dueLeadsKv(saveFailKv, sentWait)).leads.some((item) => item.id === sentLia?.id),
  "índice do crm:sent entra no cron"
)
const welcomeSaved = (sentLia?.messages ?? []).filter((item) => item.role === "ste").length
const saveFailStart2 = backgroundCtx()
await handleRequest(
  new Request("http://local.test/api/telegram", {
    method: "POST",
    headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "hook-secret" },
    body: JSON.stringify({
      update_id: 502,
      message: {
        chat: { id: 9301 },
        text: "/start fb_again",
        from: { id: 9301, username: "savefail", first_name: "Lia" },
      },
    }),
  }),
  saveFailEnv,
  saveFailStart2
)
await saveFailStart2.flush()
assert(saveFailCalls === firstSaveFailCalls, "segundo /start não reenvia as boas-vindas")
const sentLiaAgain = await findLeadInKv(saveFailKv, "@savefail", 9301, "9301")
assert((sentLiaAgain?.messages ?? []).filter((item) => item.role === "ste").length === welcomeSaved, "transcript do /start seguinte fica igual")
globalThis.fetch = saveFailFetch
await forgetTelegramUpdate(dupEnv.AUTH, 42)
assert(await claimTelegramUpdate(dupEnv.AUTH, 42), "esquecer o update permite retry")
const claimedOnce = mergeTelegramClaims(
  { ids: [88], owners: { "88": "first" } },
  { ids: [88], owners: { "88": "second" } }
)
assert(claimedOnce.owners["88"] === "first", "primeiro dono do update_id fica")
const evicted = mergeTelegramClaims(
  { ids: [3, 2, 1], owners: { "1": "a", "2": "b", "3": "c" } },
  { ids: [4], owners: { "4": "d" } },
  3
)
assert(!evicted.ids.includes(1) && (evicted.seenBelow ?? 0) >= 1, "o anel evicto marca o piso")
const evictKv = memoryKv()
await evictKv.put("tg:updates", JSON.stringify(evicted))
assert((await claimTelegramUpdate(evictKv, 1)) === false, "update_id evicto não reprocessa")
assert(await claimTelegramUpdate(evictKv, 9), "update_id novo ainda entra")
const raceTg = memoryKv()
const racedClaims = await Promise.all([claimTelegramUpdate(raceTg, 88), claimTelegramUpdate(raceTg, 88)])
assert(racedClaims.filter(Boolean).length === 1, "só um claim do mesmo update_id ganha")
const staleVerify = memoryKv()
let hideClaim = 0
const staleVerifyKv = {
  get: async (key: string, type?: "json") => {
    if (key === "tg:updates" && hideClaim === 1) {
      hideClaim = 0
      return null
    }
    return staleVerify.get(key, type)
  },
  put: async (key: string, value: string) => {
    if (key === "tg:updates") hideClaim = 1
    return staleVerify.put(key, value)
  },
}
assert(await claimTelegramUpdate(staleVerifyKv, 77), "claim retenta se o verify do KV vier vazio")
assert(await claimTelegramUpdate(staleVerifyKv, 77) === false, "claim confirmado não entra outra vez")
const keepOther = forgetTelegramId({ ids: [10, 11], owners: { "10": "a", "11": "b" } }, 10)
assert(keepOther.ids.includes(11) && !keepOther.ids.includes(10), "esquecer um update_id não apaga o outro")
const forgetRace = memoryKv()
assert(await claimTelegramUpdate(forgetRace, 10), "claim 10")
await Promise.all([forgetTelegramUpdate(forgetRace, 10), claimTelegramUpdate(forgetRace, 11)])
assert(await claimTelegramUpdate(forgetRace, 11) === false, "forget concorrente não apaga outro update_id")
assert(telegramUpdateActor({ message: { from: { id: 9, username: "a" } } })?.id === 9, "actor da mensagem")
assert(telegramJoinActor({ message: { new_chat_members: [{ id: 3, username: "j" }] } })?.id === 3, "actor do join")
assert(
  telegramUpdateActor({ chat_member: { new_chat_member: { status: "member", user: { id: 4 } } } })?.id === 4,
  "actor do chat_member member"
)
assert(
  !telegramUpdateActor({ chat_member: { new_chat_member: { status: "left", user: { id: 4, username: "gone" } } } }),
  "saída do grupo não é actor"
)
assert(!telegramUpdateActor({ message: { from: { id: 0 } } }), "id 0 não é actor")
assert(!telegramUpdateActor({ message: {} }), "mensagem sem from não é actor")
assert(!telegramUpdateActor({}), "update vazio não é actor")
globalThis.fetch = okFetch
const noFromPrev = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (String(input).includes("api.telegram.org")) {
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  }
  return noFromPrev(input, init)
}) as typeof fetch
const noFromKv = memoryKv()
const noFromEnv = { ...apiEnv, AUTH: noFromKv, TELEGRAM_WEBHOOK_SECRET: "hook-secret", TELEGRAM_BOT_TOKEN: "000:nofrom" } as Env
const postTelegramUpdate = async (body: Record<string, unknown>, label: string) => {
  const ctx = backgroundCtx()
  assert(
    (
      await handleRequest(
        new Request("http://local.test/api/telegram", {
          method: "POST",
          headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "hook-secret" },
          body: JSON.stringify(body),
        }),
        noFromEnv,
        ctx
      )
    ).status === 200,
    label
  )
  await ctx.flush()
}
const memberUpdate = {
  update_id: 8811,
  my_chat_member: {
    chat: { id: -100 },
    from: { id: 1, username: "admin" },
    new_chat_member: { status: "member", user: { id: 99 } },
  },
}
await postTelegramUpdate(memberUpdate, "my_chat_member é 200")
await postTelegramUpdate(memberUpdate, "retry do my_chat_member é 200")
assert((await listLeads(noFromKv, 20, "all")).length === 0, "my_chat_member não mint lead")
assert(await claimTelegramUpdate(noFromKv, 8811), "my_chat_member não ocupa o anel")
await postTelegramUpdate({ update_id: 8812, message: { chat: { id: 99 }, text: "oi" } }, "mensagem sem from é 200")
assert(await claimTelegramUpdate(noFromKv, 8812), "mensagem sem from não ocupa o anel")
await postTelegramUpdate(
  {
    update_id: 8813,
    chat_member: { chat: { id: -100 }, new_chat_member: { status: "left", user: { id: 5, username: "gone" } } },
  },
  "saída do grupo é 200"
)
assert(await claimTelegramUpdate(noFromKv, 8813), "saída do grupo não ocupa o anel")
assert(!(await listLeads(noFromKv, 20, "all")).some((item) => item.contact === "@gone"), "saída não mint lead")
await postTelegramUpdate(
  {
    update_id: 8814,
    message: {
      chat: { id: 8814 },
      text: "/start fb_nofromok",
      from: { id: 8814, username: "nofromok", first_name: "Nia" },
    },
  },
  "mensagem com from continua a entrar"
)
assert((await listLeads(noFromKv, 20, "all")).some((item) => item.contact === "@nofromok"), "mensagem com from mint lead")
assert((await claimTelegramUpdate(noFromKv, 8814)) === false, "mensagem com from continua reclamada")
globalThis.fetch = noFromPrev
const startLogin = await handleRequest(
  new Request("http://local.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "victor@abilion.com", password: "senhaok" }),
  }),
  startEnv,
  backgroundCtx()
)
assert(startLogin.status === 200, "login no KV do webhook")
const startCookie = startLogin.headers.get("set-cookie") || ""
const pgFailEnv = {
  ASSETS: { fetch: async () => new Response("ok") },
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE: "role",
  AUTH: memoryKv(),
  ABILION_ENV: "development",
} as Env
const pgFailLogin = await handleRequest(
  new Request("http://local.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "victor@abilion.com", password: "senhaok" }),
  }),
  pgFailEnv,
  backgroundCtx()
)
assert(pgFailLogin.status === 200, "login no KV vazio para o GET de leads")
const pgFailCookie = pgFailLogin.headers.get("set-cookie") || ""
const pgFailPrev = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (String(input).includes("/rest/v1/")) throw new Error("postgres down")
  return pgFailPrev(input, init)
}) as typeof fetch
const pgFailList = await handleRequest(
  new Request("http://local.test/api/leads", { headers: { cookie: pgFailCookie } }),
  pgFailEnv,
  backgroundCtx()
)
const pgFailBody = (await pgFailList.json()) as { error?: string; ok?: boolean }
assert(pgFailList.status === 503 && pgFailBody.error?.includes("Postgres"), "KV vazio + Postgres em baixo é 503 na lista")
const pgFailWrite = await handleRequest(
  new Request("http://local.test/api/leads", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: pgFailCookie },
    body: JSON.stringify({ lead: lead("pg-fail-write", "@pgfailwrite") }),
  }),
  pgFailEnv,
  backgroundCtx()
)
const pgFailWriteBody = (await pgFailWrite.json()) as { error?: string }
assert(pgFailWrite.status === 503 && pgFailWriteBody.error?.includes("Postgres"), "KV vazio + Postgres em baixo não aceita POST de lead")
assert((await listLeads(pgFailEnv.AUTH, 20, "all")).length === 0, "POST recusado não mint lead no KV oco")
assert(collectLeadPages([{ leads: [], clipped: true }]).complete === false, "clipped vazio não é lista completa")
const pgFailInbox = await handleRequest(
  new Request("http://local.test/api/inbox", { headers: { cookie: pgFailCookie } }),
  pgFailEnv,
  backgroundCtx()
)
assert(pgFailInbox.status === 503, "KV vazio + Postgres em baixo é 503 na inbox")
const pgFailMint = await handleRequest(
  new Request("http://local.test/api/tokens", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: pgFailCookie, "x-forwarded-for": "198.51.100.78" },
    body: JSON.stringify({ name: "Lista" }),
  }),
  pgFailEnv,
  backgroundCtx()
)
const pgFailMinted = (await pgFailMint.json()) as { token?: string }
assert(pgFailMint.status === 201 && pgFailMinted.token?.startsWith("abn_"), "token para a lista MCP")
const pgFailMcp = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${pgFailMinted.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 82,
      method: "tools/call",
      params: { name: "abilion_list_leads", arguments: { limit: 5 } },
    }),
  }),
  pgFailEnv,
  backgroundCtx()
)
const pgFailMcpBody = (await pgFailMcp.json()) as { result?: { content?: Array<{ text?: string }>; isError?: boolean } }
const pgFailMcpText = JSON.parse(pgFailMcpBody.result?.content?.[0]?.text || "{}") as { error?: string }
assert(pgFailMcpBody.result?.isError && pgFailMcpText.error?.includes("Postgres"), "MCP lista no KV oco é erro se o Postgres falhar")
const pgFailCrm = await handleRequest(
  new Request("http://local.test/api/crm", { headers: { cookie: pgFailCookie } }),
  pgFailEnv,
  backgroundCtx()
)
assert(pgFailCrm.status === 503, "GET CRM não finge funis vazios quando o Postgres falha")
const pgFailHealth = await handleRequest(new Request("http://local.test/api/health"), pgFailEnv, backgroundCtx())
assert(pgFailHealth.status === 200, "health público continua de pé se o Postgres falhar")
const pgFailHealthBody = (await pgFailHealth.json()) as { telegramBotUsername?: string; telegramBotUnread?: boolean }
assert(pgFailHealthBody.telegramBotUnread === true && !pgFailHealthBody.telegramBotUsername, "health unread não finge bot desligado")
const pgFailLanding = await handleRequest(new Request("http://local.test/l"), pgFailEnv, backgroundCtx())
const pgFailLandingHtml = await pgFailLanding.text()
assert(pgFailLanding.status === 200 && pgFailLandingHtml.includes("/t.js"), "GET /l unread ainda serve o pixel")
assert(pgFailLandingHtml.includes("Não confirmei o Telegram"), "GET /l unread não diz que o bot não está ligado")
assert(!pgFailLandingHtml.includes("ainda não está ligado"), "GET /l unread não usa a cópia de bot desligado")
assert(!pgFailLandingHtml.includes("<a data-abilion-cta"), "GET /l unread sem username não inventa CTA")
globalThis.fetch = pgFailPrev
const orphanKv = memoryKv()
await orphanKv.put(
  CRM_INDEX,
  JSON.stringify({
    entries: [{ id: "ghost-1", contact: "@ghost1", updatedAt: "2026-06-01T00:00:00.000Z", channel: "telegram" }],
  })
)
const orphanEnv = {
  ASSETS: { fetch: async () => new Response("ok") },
  SUPABASE_URL: "https://sb.test",
  SUPABASE_SERVICE_ROLE: "role",
  AUTH: orphanKv,
  ABILION_ENV: "development",
} as Env
const orphanLogin = await handleRequest(
  new Request("http://local.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "victor@abilion.com", password: "senhaok" }),
  }),
  orphanEnv,
  backgroundCtx()
)
assert(orphanLogin.status === 200, "login no índice órfão")
const orphanCookie = orphanLogin.headers.get("set-cookie") || ""
const orphanPrev = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (String(input).includes("/rest/v1/")) throw new Error("postgres down")
  return orphanPrev(input, init)
}) as typeof fetch
const orphanFail = await handleRequest(
  new Request("http://local.test/api/leads", { headers: { cookie: orphanCookie } }),
  orphanEnv,
  backgroundCtx()
)
assert(orphanFail.status === 503, "índice órfão + Postgres em baixo é 503")
const orphanInboxFail = await handleRequest(
  new Request("http://local.test/api/inbox", { headers: { cookie: orphanCookie } }),
  orphanEnv,
  backgroundCtx()
)
assert(orphanInboxFail.status === 503, "inbox com índice órfão + Postgres em baixo é 503")
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  if (url.includes("/rest/v1/leads") && (init?.method || "GET").toUpperCase() === "GET") {
    return new Response("[]", { status: 200 })
  }
  if (url.includes("/rest/v1/")) return new Response("[]", { status: 200 })
  return orphanPrev(input, init)
}) as typeof fetch
const orphanEmpty = await handleRequest(
  new Request("http://local.test/api/leads", { headers: { cookie: orphanCookie } }),
  orphanEnv,
  backgroundCtx()
)
const orphanEmptyBody = (await orphanEmpty.json()) as { ok?: boolean; leads?: unknown[]; clipped?: boolean }
assert(orphanEmpty.status === 200 && orphanEmptyBody.ok && orphanEmptyBody.clipped === true, "índice órfão + backup vazio não finge universo")
assert(collectLeadPages([{ leads: [], clipped: true }]).complete === false, "página clipped vazia não reconcilia")
const orphanRow = {
  id: "pg-orphan",
  name: "Ana Viva",
  contact: "@anaviva",
  channel: "telegram" as const,
  campaign: "Facebook · ads",
  origin: "facebook" as const,
  temperature: "novo" as const,
  stage: "capture" as const,
  memory: "",
  facts: {},
  messages: [],
  updated_at: "2026-06-02T00:00:00.000Z",
  created_at: "2026-06-01T00:00:00.000Z",
}
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  if (url.includes("/rest/v1/leads") && (init?.method || "GET").toUpperCase() === "GET") {
    return new Response(JSON.stringify([orphanRow]), { status: 200 })
  }
  if (url.includes("/rest/v1/")) return new Response("[]", { status: 200 })
  return orphanPrev(input, init)
}) as typeof fetch
const orphanHit = await handleRequest(
  new Request("http://local.test/api/leads", { headers: { cookie: orphanCookie } }),
  orphanEnv,
  backgroundCtx()
)
const orphanHitBody = (await orphanHit.json()) as { leads?: Array<{ id?: string }> }
assert(orphanHit.status === 200 && orphanHitBody.leads?.some((item) => item.id === "pg-orphan"), "índice órfão lê o lead do Postgres")
globalThis.fetch = orphanPrev
const mixedIndexKv = memoryKv()
await upsertLeadKv(mixedIndexKv, lead("mixed-live", "@mixedlive"))
await mixedIndexKv.put(
  CRM_INDEX,
  JSON.stringify({
    entries: [
      { id: "mixed-live", contact: "@mixedlive", updatedAt: "2026-06-02T00:00:00.000Z", channel: "telegram" },
      { id: "mixed-ghost", contact: "@mixedghost", updatedAt: "2026-06-01T00:00:00.000Z", channel: "telegram" },
      { id: "mixed-gone", contact: "@mixedgone", updatedAt: "2026-05-01T00:00:00.000Z", channel: "telegram" },
    ],
  })
)
await rememberRemovedLead(mixedIndexKv, "mixed-gone")
const mixedListed = await listLeadPage(mixedIndexKv, 10, "all")
assert(mixedListed.leads.some((item) => item.id === "mixed-live"), "página mista traz o vivo do KV")
assert(mixedListed.missingIds.includes("mixed-ghost"), "página mista aponta o id órfão")
assert(!mixedListed.missingIds.includes("mixed-gone"), "tombstone no índice não é buraco")
assert(!mixedListed.missingIds.includes("mixed-live"), "vivo não entra nos buracos")
assert((await listLeadPage(mixedIndexKv, 10, "all", "1999-01-01T00:00:00.000Z|missing")).missingIds.length === 0, "cursor velho não inventa buracos")
const dueHoleKv = memoryKv()
const dueStamp = "2026-06-01T00:00:00.000Z"
await dueHoleKv.put(
  leadKey("due-live"),
  JSON.stringify({ ...lead("due-live", "@duelive"), waitUntil: dueStamp, updatedAt: "2026-06-02T00:00:00.000Z" })
)
await dueHoleKv.put(
  leadKey("due-thin"),
  JSON.stringify({ ...lead("due-thin", "@duethin"), updatedAt: "2026-06-01T00:00:00.000Z" })
)
await dueHoleKv.put(
  CRM_INDEX,
  JSON.stringify({
    entries: [
      { id: "due-live", contact: "@duelive", waitUntil: dueStamp, updatedAt: "2026-06-02T00:00:00.000Z", channel: "telegram" },
      { id: "due-ghost", contact: "@dueghost", waitUntil: dueStamp, updatedAt: "2026-06-01T00:00:00.000Z", channel: "telegram" },
      { id: "due-thin", contact: "@duethin", waitUntil: dueStamp, updatedAt: "2026-06-01T00:00:00.000Z", channel: "telegram" },
      { id: "due-gone", contact: "@duegone", waitUntil: dueStamp, updatedAt: "2026-05-01T00:00:00.000Z", channel: "telegram" },
      { id: "due-later", contact: "@duelater", waitUntil: "2026-06-03T00:00:00.000Z", updatedAt: "2026-06-02T00:00:00.000Z", channel: "telegram" },
    ],
  })
)
await rememberRemovedLead(dueHoleKv, "due-gone")
const dueHoles = await dueLeadsKv(dueHoleKv, "2026-06-02T00:00:00.000Z")
assert(dueHoles.leads.some((item) => item.id === "due-live"), "cron lê a espera viva no KV")
assert(dueHoles.missingIds.includes("due-ghost"), "cron aponta a espera oca do índice")
assert(dueHoles.missingIds.includes("due-thin"), "ficha sem espera é buraco do cron")
assert(!dueHoles.leads.some((item) => item.id === "due-thin"), "ficha sem espera não entra como viva")
assert(!dueHoles.missingIds.includes("due-gone"), "tombstone vencido não é buraco do cron")
assert(!dueHoles.missingIds.includes("due-live"), "espera viva não entra nos buracos do cron")
assert(!dueHoles.leads.some((item) => item.id === "due-later"), "espera futura não entra na fila")
assert(!dueHoles.missingIds.includes("due-later"), "espera futura oca não é buraco ainda")
assert(remoteLeadDuePath("2026-06-02T00:00:00.000Z").includes('wait_until=lte."2026-06-02T00:00:00.000Z"'), "due remoto cita o timestamp")
assert(remoteLeadDuePath("  ") === "", "stamp vazio não pergunta ao Postgres")
assert((await fetchRemoteLeadsByIds({} as Env, ["ghost"])).length === 0, "sem credenciais o fill não finge falha")
assert((await fetchRemoteLeadsByIds({ SUPABASE_URL: "https://sb.test", SUPABASE_SERVICE_ROLE: "role" } as Env, [])).length === 0, "sem ids o fill é vazio")
assert(remoteLeadIdentityPath("", 0, "") === "", "identidade vazia não pergunta ao Postgres")
assert(remoteLeadIdentityPath("@ana", 41, "41").includes("telegram_chat_id.eq."), "identidade do webhook filtra o chat")
assert((await fetchRemoteLeadByIdentity({} as Env, "@ana", 41, "41")).length === 0, "sem credenciais a identidade não finge falha")
assert((await fetchRemoteDueLeads({} as Env, "2026-06-02T00:00:00.000Z")).length === 0, "sem credenciais o due remoto é vazio")
const byIdPrev = globalThis.fetch
globalThis.fetch = (async () => {
  throw new Error("postgres down")
}) as typeof fetch
assert((await fetchRemoteLeadsByIds({ SUPABASE_URL: "https://sb.test", SUPABASE_SERVICE_ROLE: "role" } as Env, ["ghost"])) === null, "fill com Postgres em baixo é null")
assert((await fetchRemoteLeadByIdentity({ SUPABASE_URL: "https://sb.test", SUPABASE_SERVICE_ROLE: "role" } as Env, "@ghost", 9, "9")) === null, "identidade com Postgres em baixo é null")
assert((await fetchRemoteDueLeads({ SUPABASE_URL: "https://sb.test", SUPABASE_SERVICE_ROLE: "role" } as Env, "2026-06-02T00:00:00.000Z")) === null, "due remoto com Postgres em baixo é null")
assert(
  await leadCatalogUnread({ AUTH: memoryKv(), SUPABASE_URL: "https://sb.test", SUPABASE_SERVICE_ROLE: "role" } as Env),
  "índice oco + Postgres em baixo é catálogo unread"
)
assert(!(await leadCatalogUnread({ AUTH: memoryKv() } as Env)), "sem credenciais o catálogo oco não é unread")
let identityThrew = false
try {
  await findWorkspaceLead({ SUPABASE_URL: "https://sb.test", SUPABASE_SERVICE_ROLE: "role" } as Env, "@ghost", 9, "9")
} catch (error) {
  identityThrew = error instanceof Error && error.message.includes("Não li o lead do Postgres.")
}
assert(identityThrew, "lookup do webhook não trata falha do Postgres como miss")
assert((await findWorkspaceLead({} as Env, "@ghost", 9, "9")) === null, "sem credenciais o lookup é miss")
const liveLookup = lead("live-kv", "@livekv")
liveLookup.telegramChatId = "55"
const liveLookupKv = memoryKv()
await upsertLeadKv(liveLookupKv, liveLookup)
assert(
  (await findWorkspaceLead({ AUTH: liveLookupKv, SUPABASE_URL: "https://sb.test", SUPABASE_SERVICE_ROLE: "role" } as Env, "@livekv", 55, "55"))?.id ===
    "live-kv",
  "KV vivo ganha mesmo com Postgres em baixo"
)
const kvThinTalk = {
  ...lead("talk-kv", "@talkkv"),
  telegramChatId: "91",
  updatedAt: "2026-06-02T00:00:00.000Z",
  messages: [{ id: "m-kv", at: "2026-06-02T00:00:00.000Z", role: "user" as const, text: "agora" }],
}
const pgFullTalk = {
  ...lead("talk-kv", "@talkkv"),
  telegramChatId: "91",
  memory: "ficha no backup",
  updatedAt: "2026-06-01T00:00:00.000Z",
  messages: [
    { id: "m-pg", at: "2026-06-01T00:00:00.000Z", role: "ste" as const, text: "já falámos" },
    { id: "m-kv", at: "2026-06-02T00:00:00.000Z", role: "user" as const, text: "agora" },
  ],
}
const unionTalk = hydrateWorkspaceLead(kvThinTalk, pgFullTalk)
assert(
  unionTalk.messages.some((item) => item.id === "m-pg") && unionTalk.messages.some((item) => item.id === "m-kv"),
  "hydrate une falas do KV com o backup"
)
assert(hydrateWorkspaceLead(kvThinTalk, null).messages.every((item) => item.id === "m-kv"), "hydrate sem remoto fica o KV")
assert(hydrateWorkspaceLead(kvThinTalk, null).messages.length === 1, "hydrate unread não inventa fala")
const talkKv = memoryKv()
await upsertLeadKv(talkKv, kvThinTalk)
const talkRow = {
  id: "talk-kv",
  name: "Talk",
  contact: "@talkkv",
  channel: "telegram" as const,
  campaign: "facebook",
  origin: "facebook" as const,
  temperature: "novo" as const,
  stage: "welcome" as const,
  memory: "ficha no backup",
  facts: {},
  messages: [{ id: "m-pg", at: "2026-06-01T00:00:00.000Z", role: "ste" as const, text: "já falámos" }],
  telegram_chat_id: "91",
  updated_at: "2026-06-01T00:00:00.000Z",
  created_at: "2026-06-01T00:00:00.000Z",
}
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input)
  if (url.includes("id=in.") && url.includes("talk-kv")) {
    return new Response(JSON.stringify([talkRow]), { status: 200 })
  }
  return new Response("[]", { status: 200 })
}) as typeof fetch
const talkHit = await findWorkspaceLead(
  { AUTH: talkKv, SUPABASE_URL: "https://sb.test", SUPABASE_SERVICE_ROLE: "role" } as Env,
  "@talkkv",
  91,
  "91"
)
assert(talkHit?.id === "talk-kv", "KV hit mantém o id")
assert(
  talkHit?.messages.some((item) => item.id === "m-pg") && talkHit?.messages.some((item) => item.id === "m-kv"),
  "webhook no KV hit lê as falas do backup"
)
globalThis.fetch = (async () => {
  throw new Error("postgres down")
}) as typeof fetch
assert(
  (await findWorkspaceLead({ AUTH: talkKv, SUPABASE_URL: "https://sb.test", SUPABASE_SERVICE_ROLE: "role" } as Env, "@talkkv", 91, "91"))
    ?.messages.some((item) => item.id === "m-kv"),
  "KV hit + backup unread devolve o KV"
)
const mixedGhostRow = {
  id: "mixed-ghost",
  name: "Ghost Vivo",
  contact: "@mixedghost",
  channel: "telegram" as const,
  campaign: "Facebook · ads",
  origin: "facebook" as const,
  temperature: "novo" as const,
  stage: "capture" as const,
  memory: "",
  facts: {},
  messages: [],
  updated_at: "2026-06-01T00:00:00.000Z",
  created_at: "2026-06-01T00:00:00.000Z",
}
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input)
  if (url.includes("id=in.") && url.includes("mixed-ghost")) {
    return new Response(JSON.stringify([mixedGhostRow]), { status: 200 })
  }
  return new Response("[]", { status: 200 })
}) as typeof fetch
const byIdHit = await fetchRemoteLeadsByIds(
  { SUPABASE_URL: "https://sb.test", SUPABASE_SERVICE_ROLE: "role" } as Env,
  ["mixed-ghost"]
)
assert(byIdHit?.some((item) => item.id === "mixed-ghost"), "fill lê o id no Postgres")
const identityRow = {
  id: "pg-ana",
  name: "Ana PG",
  contact: "@pgana",
  channel: "telegram" as const,
  campaign: "Facebook · ads",
  origin: "facebook" as const,
  temperature: "novo" as const,
  stage: "welcome" as const,
  memory: "ficha no backup",
  facts: {},
  messages: [{ id: "old", at: "2026-06-01T00:00:00.000Z", role: "ste" as const, text: "já falámos" }],
  telegram_chat_id: "8802",
  updated_at: "2026-06-01T00:00:00.000Z",
  created_at: "2026-06-01T00:00:00.000Z",
}
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input)
  if (url.includes("/rest/v1/leads") && url.includes("or=(")) {
    return new Response(JSON.stringify([identityRow]), { status: 200 })
  }
  return new Response("[]", { status: 200 })
}) as typeof fetch
const identityHit = await fetchRemoteLeadByIdentity(
  { SUPABASE_URL: "https://sb.test", SUPABASE_SERVICE_ROLE: "role" } as Env,
  "@pgana",
  8802,
  "8802"
)
assert(identityHit?.some((item) => item.id === "pg-ana"), "identidade lê o chat no Postgres")
assert(
  (await findWorkspaceLead({ SUPABASE_URL: "https://sb.test", SUPABASE_SERVICE_ROLE: "role", AUTH: memoryKv() } as Env, "@pgana", 8802, "8802"))?.id ===
    "pg-ana",
  "lookup reusa o id do backup"
)
assert(telegramIdFromLead({ contact: "tg:8802" }) === 8802, "tg:id vira número")
assert(telegramIdFromLead({ contact: "@pgana" }) === 0, "@user não inventa id")
const writeHit = await resolveWorkspaceLeadWrite(
  { SUPABASE_URL: "https://sb.test", SUPABASE_SERVICE_ROLE: "role", AUTH: memoryKv() } as Env,
  { ...lead("local-ana", "@pgana"), telegramChatId: "8802" }
)
assert(writeHit.ok && writeHit.incoming.id === "pg-ana", "POST/MCP reusa o id do backup")
assert(writeHit.ok && writeHit.prev?.id === "pg-ana", "POST/MCP adopta a ficha do Postgres")
assert((await fetchRemoteDueLeads({ SUPABASE_URL: "https://sb.test", SUPABASE_SERVICE_ROLE: "role" } as Env, "2026-06-02T00:00:00.000Z"))?.length === 0, "due remoto vazio é array, não null")
const hookDownKv = memoryKv()
const hookDownEnv = {
  ASSETS: { fetch: async () => new Response("ok") },
  SUPABASE_URL: "https://sb.test",
  SUPABASE_SERVICE_ROLE: "role",
  AUTH: hookDownKv,
  TELEGRAM_WEBHOOK_SECRET: "hook-secret",
  TELEGRAM_BOT_TOKEN: "000:test",
  ABILION_ENV: "development",
} as Env
const hookPrev = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  if (url.includes("api.telegram.org")) return new Response(JSON.stringify({ ok: true }), { status: 200 })
  if (url.includes("/rest/v1/leads")) throw new Error("postgres down")
  if (url.includes("/rest/v1/")) return new Response("[]", { status: 200 })
  return hookPrev(input, init)
}) as typeof fetch
const hookDownCtx = backgroundCtx()
assert(
  (
    await handleRequest(
      new Request("http://local.test/api/telegram", {
        method: "POST",
        headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "hook-secret" },
        body: JSON.stringify({
          update_id: 8801,
          message: {
            chat: { id: 8801 },
            text: "/start fb_dupmiss",
            from: { id: 8801, username: "dupmiss", first_name: "Dup" },
          },
        }),
      }),
      hookDownEnv,
      hookDownCtx
    )
  ).status === 200,
  "webhook com Postgres em baixo ainda é 200"
)
await hookDownCtx.flush()
assert(!(await listLeads(hookDownKv, 20, "all")).some((item) => item.contact === "@dupmiss"), "webhook não mint com Postgres em baixo")
assert((await findLeadInKv(hookDownKv, "@dupmiss", 8801, "8801")) === null, "falha do backup não grava alias de um lead novo")
const writeUnreadKv = memoryKv()
await upsertLeadKv(writeUnreadKv, lead("already-there", "@other"))
const writeUnreadEnv = {
  ASSETS: { fetch: async () => new Response("ok") },
  SUPABASE_URL: "https://sb.test",
  SUPABASE_SERVICE_ROLE: "role",
  AUTH: writeUnreadKv,
  ABILION_ENV: "development",
} as Env
const writeUnreadResolved = await resolveWorkspaceLeadWrite(writeUnreadEnv, lead("new-dup", "@dupwrite"))
assert(!writeUnreadResolved.ok && writeUnreadResolved.unread, "índice com outros + Postgres em baixo não mint")
const writeKnown = await resolveWorkspaceLeadWrite(writeUnreadEnv, lead("already-there", "@other"))
assert(writeKnown.ok && writeKnown.incoming.id === "already-there", "ficha já no KV ainda grava com Postgres unread")
const writeUnreadLogin = await handleRequest(
  new Request("http://local.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "victor@abilion.com", password: "senhaok" }),
  }),
  writeUnreadEnv,
  backgroundCtx()
)
assert(writeUnreadLogin.status === 200, "login no KV com índice para o POST unread")
const writeUnreadCookie = writeUnreadLogin.headers.get("set-cookie") || ""
const writeUnreadPost = await handleRequest(
  new Request("http://local.test/api/leads", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: writeUnreadCookie },
    body: JSON.stringify({ lead: lead("new-dup", "@dupwrite") }),
  }),
  writeUnreadEnv,
  backgroundCtx()
)
const writeUnreadPostBody = (await writeUnreadPost.json()) as { error?: string }
assert(writeUnreadPost.status === 503 && writeUnreadPostBody.error?.includes("Postgres"), "POST com índice leftover não mint contacto unread")
assert(!(await listLeads(writeUnreadKv, 20, "all")).some((item) => item.contact === "@dupwrite"), "POST recusado não mint o segundo UUID")
const writeKnownPost = await handleRequest(
  new Request("http://local.test/api/leads", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: writeUnreadCookie },
    body: JSON.stringify({ lead: { ...lead("already-there", "@other"), memory: "keepalive" } }),
  }),
  writeUnreadEnv,
  backgroundCtx()
)
assert(writeKnownPost.status === 200, "POST da ficha do KV sobrevive ao Postgres unread")
assert((await loadLead(writeUnreadKv, "already-there"))?.memory === "keepalive", "POST conhecido actualiza o KV")
const writeUnreadMint = await handleRequest(
  new Request("http://local.test/api/tokens", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: writeUnreadCookie, "x-forwarded-for": "198.51.100.91" },
    body: JSON.stringify({ name: "Import unread" }),
  }),
  writeUnreadEnv,
  backgroundCtx()
)
const writeUnreadMinted = (await writeUnreadMint.json()) as { token?: string }
assert(writeUnreadMint.status === 201 && writeUnreadMinted.token?.startsWith("abn_"), "token para o import unread")
const writeUnreadMcp = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${writeUnreadMinted.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 210,
      method: "tools/call",
      params: { name: "abilion_import_leads", arguments: { text: "Dup, @dupwrite" } },
    }),
  }),
  writeUnreadEnv,
  backgroundCtx()
)
const writeUnreadMcpBody = (await writeUnreadMcp.json()) as { result?: { isError?: boolean; content?: Array<{ text?: string }> } }
const writeUnreadMcpData = JSON.parse(writeUnreadMcpBody.result?.content?.[0]?.text || "{}") as { error?: string }
assert(writeUnreadMcpBody.result?.isError && writeUnreadMcpData.error?.includes("Postgres"), "MCP import com índice leftover não mint contacto unread")
assert(!(await listLeads(writeUnreadKv, 20, "all")).some((item) => item.contact === "@dupwrite"), "MCP recusado não mint o segundo UUID")
const hookReuseKv = memoryKv()
const hookReuseEnv = { ...hookDownEnv, AUTH: hookReuseKv }
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  if (url.includes("api.telegram.org")) return new Response(JSON.stringify({ ok: true }), { status: 200 })
  if (url.includes("/rest/v1/leads") && (init?.method || "GET").toUpperCase() === "GET" && url.includes("or=(")) {
    return new Response(JSON.stringify([identityRow]), { status: 200 })
  }
  if (url.includes("/rest/v1/")) return new Response(JSON.stringify([]), { status: 200 })
  return hookPrev(input, init)
}) as typeof fetch
const hookReuseCtx = backgroundCtx()
assert(
  (
    await handleRequest(
      new Request("http://local.test/api/telegram", {
        method: "POST",
        headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "hook-secret" },
        body: JSON.stringify({
          update_id: 8802,
          message: {
            chat: { id: 8802 },
            text: "/start fb_pgreuse",
            from: { id: 8802, username: "pgana", first_name: "Ana" },
          },
        }),
      }),
      hookReuseEnv,
      hookReuseCtx
    )
  ).status === 200,
  "webhook reusa o lead do Postgres"
)
await hookReuseCtx.flush()
const reused = await listLeads(hookReuseKv, 20, "all")
assert(reused.filter((item) => item.telegramChatId === "8802").length === 1, "um só lead para o chat do Postgres")
assert(reused.some((item) => item.id === "pg-ana"), "webhook reusa o id do backup")
assert(reused.some((item) => item.memory === "ficha no backup" || (item.messages ?? []).some((msg) => msg.text === "já falámos")), "webhook não apaga a ficha do backup")
globalThis.fetch = byIdPrev
const mixedEnv = {
  ASSETS: { fetch: async () => new Response("ok") },
  SUPABASE_URL: "https://sb.test",
  SUPABASE_SERVICE_ROLE: "role",
  AUTH: memoryKv(),
  ABILION_ENV: "development",
} as Env
await upsertLeadKv(mixedEnv.AUTH, lead("mix-live", "@mixlive"))
await mixedEnv.AUTH.put(
  CRM_INDEX,
  JSON.stringify({
    entries: [
      { id: "mix-live", contact: "@mixlive", updatedAt: "2026-06-02T00:00:00.000Z", channel: "telegram" },
      { id: "mix-ghost", contact: "@mixghost", updatedAt: "2026-06-01T00:00:00.000Z", channel: "telegram" },
    ],
  })
)
const mixedLogin = await handleRequest(
  new Request("http://local.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "victor@abilion.com", password: "senhaok" }),
  }),
  mixedEnv,
  backgroundCtx()
)
assert(mixedLogin.status === 200, "login na página mista")
const mixedCookie = mixedLogin.headers.get("set-cookie") || ""
const mixedPrev = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (String(input).includes("/rest/v1/")) throw new Error("postgres down")
  return mixedPrev(input, init)
}) as typeof fetch
const mixedFail = await handleRequest(
  new Request("http://local.test/api/leads", { headers: { cookie: mixedCookie } }),
  mixedEnv,
  backgroundCtx()
)
const mixedFailBody = (await mixedFail.json()) as { ok?: boolean; leads?: Array<{ id?: string }>; clipped?: boolean; error?: string }
assert(mixedFail.status === 200 && mixedFailBody.ok && mixedFailBody.clipped === true, "página mista + Postgres em baixo é 200 clipped")
assert(mixedFailBody.leads?.some((item) => item.id === "mix-live"), "página mista conserva o vivo se o backup cair")
assert(!mixedFailBody.leads?.some((item) => item.id === "mix-ghost"), "órfão sem backup não inventa ficha")
assert(
  collectLeadPages([{ leads: (mixedFailBody.leads ?? []) as Lead[], clipped: true }]).complete === false,
  "página mista clipped não reconcilia como universo"
)
const mixedInboxFail = await handleRequest(
  new Request("http://local.test/api/inbox", { headers: { cookie: mixedCookie } }),
  mixedEnv,
  backgroundCtx()
)
const mixedInboxFailBody = (await mixedInboxFail.json()) as { ok?: boolean; clipped?: boolean }
assert(mixedInboxFail.status === 200 && mixedInboxFailBody.ok && mixedInboxFailBody.clipped === true, "inbox mista + Postgres em baixo é 200 clipped")
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  if (url.includes("/rest/v1/leads") && (init?.method || "GET").toUpperCase() === "GET") {
    return new Response("[]", { status: 200 })
  }
  if (url.includes("/rest/v1/")) return new Response("[]", { status: 200 })
  return mixedPrev(input, init)
}) as typeof fetch
const mixedEmpty = await handleRequest(
  new Request("http://local.test/api/leads", { headers: { cookie: mixedCookie } }),
  mixedEnv,
  backgroundCtx()
)
const mixedEmptyBody = (await mixedEmpty.json()) as { ok?: boolean; leads?: Array<{ id?: string }>; clipped?: boolean }
assert(mixedEmpty.status === 200 && mixedEmptyBody.ok && mixedEmptyBody.clipped === true, "página mista + backup vazio não finge universo")
assert(mixedEmptyBody.leads?.some((item) => item.id === "mix-live"), "página mista + backup vazio conserva o vivo")
const mixGhostRow = {
  id: "mix-ghost",
  name: "Ghost Misto",
  contact: "@mixghost",
  channel: "telegram" as const,
  campaign: "Facebook · ads",
  origin: "facebook" as const,
  temperature: "novo" as const,
  stage: "capture" as const,
  memory: "",
  facts: {},
  messages: [],
  updated_at: "2026-06-01T00:00:00.000Z",
  created_at: "2026-06-01T00:00:00.000Z",
}
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  if (url.includes("/rest/v1/leads") && url.includes("id=in.") && (init?.method || "GET").toUpperCase() === "GET") {
    return new Response(JSON.stringify([mixGhostRow]), { status: 200 })
  }
  if (url.includes("/rest/v1/")) return new Response("[]", { status: 200 })
  return mixedPrev(input, init)
}) as typeof fetch
const mixedHit = await handleRequest(
  new Request("http://local.test/api/leads", { headers: { cookie: mixedCookie } }),
  mixedEnv,
  backgroundCtx()
)
const mixedHitBody = (await mixedHit.json()) as { ok?: boolean; leads?: Array<{ id?: string }>; clipped?: boolean }
assert(mixedHit.status === 200 && mixedHitBody.ok, "página mista com backup de pé é 200")
assert(mixedHitBody.leads?.some((item) => item.id === "mix-live"), "página mista mantém o vivo do KV")
assert(mixedHitBody.leads?.some((item) => item.id === "mix-ghost"), "página mista preenche o órfão no Postgres")
assert(mixedHitBody.clipped !== true, "página mista preenchida não marca clipped")
const mixedMint = await handleRequest(
  new Request("http://local.test/api/tokens", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: mixedCookie, "x-forwarded-for": "198.51.100.91" },
    body: JSON.stringify({ name: "Mista" }),
  }),
  mixedEnv,
  backgroundCtx()
)
const mixedMinted = (await mixedMint.json()) as { token?: string }
assert(mixedMint.status === 201 && mixedMinted.token?.startsWith("abn_"), "token para a lista MCP mista")
const mixedMcpHit = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mixedMinted.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 83,
      method: "tools/call",
      params: { name: "abilion_list_leads", arguments: { limit: 5 } },
    }),
  }),
  mixedEnv,
  backgroundCtx()
)
const mixedMcpHitBody = (await mixedMcpHit.json()) as { result?: { content?: Array<{ text?: string }>; isError?: boolean } }
const mixedMcpHitText = JSON.parse(mixedMcpHitBody.result?.content?.[0]?.text || "{}") as {
  ok?: boolean
  leads?: Array<{ id?: string }>
  clipped?: boolean
}
assert(mixedMcpHit.status === 200 && !mixedMcpHitBody.result?.isError && mixedMcpHitText.ok, "MCP lista a página mista")
assert(mixedMcpHitText.leads?.some((item) => item.id === "mix-live"), "MCP mista traz o vivo")
assert(mixedMcpHitText.leads?.some((item) => item.id === "mix-ghost"), "MCP mista preenche o órfão")
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (String(input).includes("/rest/v1/")) throw new Error("postgres down")
  return mixedPrev(input, init)
}) as typeof fetch
const mixedMcpFail = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mixedMinted.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 84,
      method: "tools/call",
      params: { name: "abilion_list_leads", arguments: { limit: 5 } },
    }),
  }),
  mixedEnv,
  backgroundCtx()
)
const mixedMcpFailBody = (await mixedMcpFail.json()) as { result?: { content?: Array<{ text?: string }>; isError?: boolean } }
const mixedMcpFailText = JSON.parse(mixedMcpFailBody.result?.content?.[0]?.text || "{}") as {
  ok?: boolean
  leads?: Array<{ id?: string }>
  clipped?: boolean
  error?: string
}
assert(mixedMcpFail.status === 200 && !mixedMcpFailBody.result?.isError && mixedMcpFailText.ok, "MCP mista + Postgres em baixo não é erro")
assert(mixedMcpFailText.clipped === true, "MCP mista + Postgres em baixo marca clipped")
assert(mixedMcpFailText.leads?.some((item) => item.id === "mix-live"), "MCP mista conserva o vivo se o backup cair")
globalThis.fetch = mixedPrev
const pageTalkEnv = {
  ASSETS: { fetch: async () => new Response("ok") },
  SUPABASE_URL: "https://sb.test",
  SUPABASE_SERVICE_ROLE: "role",
  AUTH: memoryKv(),
  ABILION_ENV: "development",
} as Env
const pageTalk = {
  ...lead("page-talk", "@pagetalk"),
  updatedAt: "2026-01-01T00:00:00.000Z",
  messages: [{ id: "m-kv", at: "2026-01-01T00:00:00.000Z", role: "user" as const, text: "agora" }],
}
await upsertLeadKv(pageTalkEnv.AUTH, pageTalk)
const pageTalkLogin = await handleRequest(
  new Request("http://local.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "victor@abilion.com", password: "senhaok" }),
  }),
  pageTalkEnv,
  backgroundCtx()
)
assert(pageTalkLogin.status === 200, "login na página hidratada")
const pageTalkCookie = pageTalkLogin.headers.get("set-cookie") || ""
const pageTalkRow = {
  id: "page-talk",
  name: "Talk",
  contact: "@pagetalk",
  channel: "telegram" as const,
  campaign: "facebook",
  origin: "facebook" as const,
  temperature: "novo" as const,
  stage: "welcome" as const,
  memory: "ficha no backup",
  facts: {
    timeline: [{ id: "ev-pg", at: "2025-12-01T00:00:00.000Z", kind: "offer" as const, title: "App" }],
  },
  messages: [{ id: "m-pg", at: "2025-12-01T00:00:00.000Z", role: "ste" as const, text: "já falámos" }],
  updated_at: "2025-12-01T00:00:00.000Z",
  created_at: "2025-12-01T00:00:00.000Z",
}
const pageNewRow = {
  id: "page-new",
  name: "Novo",
  contact: "@pagenew",
  channel: "telegram" as const,
  campaign: "facebook",
  origin: "facebook" as const,
  temperature: "novo" as const,
  stage: "welcome" as const,
  memory: "",
  facts: {},
  messages: [],
  updated_at: "2026-08-01T00:00:00.000Z",
  created_at: "2026-08-01T00:00:00.000Z",
}
const pageTalkPrev = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  if (url.includes("/rest/v1/leads") && url.includes("order=updated_at") && (init?.method || "GET").toUpperCase() === "GET") {
    return new Response(JSON.stringify([pageNewRow]), { status: 200 })
  }
  if (url.includes("/rest/v1/leads") && url.includes("id=in.") && url.includes("page-talk") && (init?.method || "GET").toUpperCase() === "GET") {
    return new Response(JSON.stringify([pageTalkRow]), { status: 200 })
  }
  if (url.includes("/rest/v1/")) return new Response("[]", { status: 200 })
  return pageTalkPrev(input, init)
}) as typeof fetch
try {
  const pageTalkGet = await handleRequest(
    new Request("http://local.test/api/leads", { headers: { cookie: pageTalkCookie } }),
    pageTalkEnv,
    backgroundCtx()
  )
  const pageTalkBody = (await pageTalkGet.json()) as {
    ok?: boolean
    eventsUnread?: boolean
    leads?: Array<{ id?: string; messages?: Array<{ id?: string }>; events?: Array<{ id?: string }> }>
  }
  const pageTalkHit = pageTalkBody.leads?.find((item) => item.id === "page-talk")
  assert(pageTalkGet.status === 200 && pageTalkBody.ok, "GET leads hidrata a página do KV")
  assert(pageTalkHit?.messages?.some((item) => item.id === "m-pg"), "GET leads lê as falas pelo id, não pelas últimas N")
  assert(pageTalkHit?.messages?.some((item) => item.id === "m-kv"), "GET leads conserva as falas do KV")
  assert(pageTalkHit?.events?.some((item) => item.id === "ev-pg"), "GET leads lê a timeline no jsonb, não só em lead_events")
  assert(!pageTalkBody.eventsUnread, "timeline no jsonb não marca unread se lead_events veio vazio")
  assert(!pageTalkBody.leads?.some((item) => item.id === "page-new"), "GET leads não troca a página do KV pelas últimas N")
  const pageTalkInbox = await handleRequest(
    new Request("http://local.test/api/inbox", { headers: { cookie: pageTalkCookie } }),
    pageTalkEnv,
    backgroundCtx()
  )
  const pageTalkInboxBody = (await pageTalkInbox.json()) as { leads?: Array<{ id?: string; messages?: Array<{ id?: string }> }> }
  assert(
    pageTalkInboxBody.leads?.some((item) => item.id === "page-talk" && item.messages?.some((msg) => msg.id === "m-pg")),
    "GET inbox hidrata as falas pelo id"
  )
} finally {
  globalThis.fetch = pageTalkPrev
}
const mcpHydrateKv = memoryKv()
const mcpStaleLead = {
  ...lead("mcp-stale", "@mcpstale"),
  name: "Rita Backup",
  stage: "capture" as const,
  updatedAt: "2026-01-01T00:00:00.000Z",
}
await upsertLeadKv(mcpHydrateKv, mcpStaleLead)
const mcpHydrateEnv = {
  ASSETS: { fetch: async () => new Response("ok") },
  SUPABASE_URL: "https://sb.test",
  SUPABASE_SERVICE_ROLE: "role",
  AUTH: mcpHydrateKv,
  ABILION_ENV: "development",
} as Env
const mcpHydrateLogin = await handleRequest(
  new Request("http://local.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "victor@abilion.com", password: "senhaok" }),
  }),
  mcpHydrateEnv,
  backgroundCtx()
)
assert(mcpHydrateLogin.status === 200, "login na lista MCP hidratada")
const mcpHydrateCookie = mcpHydrateLogin.headers.get("set-cookie") || ""
const mcpHydrateMint = await handleRequest(
  new Request("http://local.test/api/tokens", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: mcpHydrateCookie, "x-forwarded-for": "198.51.100.92" },
    body: JSON.stringify({ name: "MCP hidrata" }),
  }),
  mcpHydrateEnv,
  backgroundCtx()
)
const mcpHydrateMinted = (await mcpHydrateMint.json()) as { token?: string }
assert(mcpHydrateMint.status === 201 && mcpHydrateMinted.token?.startsWith("abn_"), "token para a lista MCP hidratada")
const mcpHydratePrev = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  if (url.includes("/rest/v1/leads") && url.includes("id=in.") && (init?.method || "GET").toUpperCase() === "GET") {
    return new Response(
      JSON.stringify([
        {
          id: "mcp-stale",
          name: "Ana Souza",
          contact: "@mcpstale",
          channel: "telegram",
          campaign: "facebook",
          origin: "facebook",
          temperature: "quente",
          stage: "welcome",
          memory: "",
          facts: {},
          messages: [],
          updated_at: "2026-08-01T00:00:00.000Z",
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ]),
      { status: 200 }
    )
  }
  if (url.includes("/rest/v1/")) return new Response("[]", { status: 200 })
  return mcpHydratePrev(input, init)
}) as typeof fetch
const mcpHydrateList = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mcpHydrateMinted.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 85,
      method: "tools/call",
      params: { name: "abilion_list_leads", arguments: { limit: 5 } },
    }),
  }),
  mcpHydrateEnv,
  backgroundCtx()
)
const mcpHydrateBody = (await mcpHydrateList.json()) as { result?: { content?: Array<{ text?: string }>; isError?: boolean } }
const mcpHydrateText = JSON.parse(mcpHydrateBody.result?.content?.[0]?.text || "{}") as {
  ok?: boolean
  leads?: Array<{ id?: string; name?: string; stage?: string }>
}
assert(mcpHydrateList.status === 200 && !mcpHydrateBody.result?.isError && mcpHydrateText.ok, "MCP lista hidrata a página do KV")
assert(
  mcpHydrateText.leads?.some((item) => item.id === "mcp-stale" && item.name === "Ana Souza" && item.stage === "welcome"),
  "MCP lista lê o nome e o passo pelo id, não o leftover do KV"
)
globalThis.fetch = (async (input: RequestInfo | URL) => {
  if (String(input).includes("/rest/v1/")) throw new Error("postgres down")
  return mcpHydratePrev(input)
}) as typeof fetch
const mcpHydrateFail = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mcpHydrateMinted.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 86,
      method: "tools/call",
      params: { name: "abilion_list_leads", arguments: { limit: 5 } },
    }),
  }),
  mcpHydrateEnv,
  backgroundCtx()
)
const mcpHydrateFailBody = (await mcpHydrateFail.json()) as { result?: { content?: Array<{ text?: string }>; isError?: boolean } }
const mcpHydrateFailText = JSON.parse(mcpHydrateFailBody.result?.content?.[0]?.text || "{}") as {
  ok?: boolean
  leads?: Array<{ id?: string; name?: string }>
  error?: string
}
assert(mcpHydrateFail.status === 200 && !mcpHydrateFailBody.result?.isError && mcpHydrateFailText.ok, "MCP hidrata leftover se o Postgres cair")
assert(
  mcpHydrateFailText.leads?.some((item) => item.id === "mcp-stale" && item.name === "Rita Backup"),
  "MCP lista conserva o leftover se o backup cair"
)
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  if (url.includes("/rest/v1/leads") && url.includes("id=in.") && (init?.method || "GET").toUpperCase() === "GET") {
    return new Response(
      JSON.stringify([
        {
          id: "mcp-stale",
          name: "Ana Souza",
          contact: "@mcpstale",
          channel: "telegram",
          campaign: "facebook",
          origin: "facebook",
          temperature: "quente",
          stage: "welcome",
          memory: "ste:welcome",
          last_message: "já falámos",
          facts: {
            timeline: [{ id: "ev-get", at: "2026-07-01T00:00:00.000Z", kind: "offer", title: "App" }],
          },
          messages: [{ id: "m-pg", at: "2026-07-01T00:00:00.000Z", role: "ste", text: "já falámos" }],
          updated_at: "2026-08-01T00:00:00.000Z",
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ]),
      { status: 200 }
    )
  }
  if (url.includes("/rest/v1/")) return new Response("[]", { status: 200 })
  return mcpHydratePrev(input, init)
}) as typeof fetch
const mcpGetLead = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mcpHydrateMinted.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 87,
      method: "tools/call",
      params: { name: "abilion_get_lead", arguments: { id: "mcp-stale" } },
    }),
  }),
  mcpHydrateEnv,
  backgroundCtx()
)
const mcpGetLeadBody = (await mcpGetLead.json()) as { result?: { content?: Array<{ text?: string }>; isError?: boolean } }
const mcpGetLeadText = JSON.parse(mcpGetLeadBody.result?.content?.[0]?.text || "{}") as {
  ok?: boolean
  eventsUnread?: boolean
  lead?: { id?: string; name?: string; stage?: string; messages?: Array<{ id?: string }>; events?: Array<{ id?: string }> }
}
assert(mcpGetLead.status === 200 && !mcpGetLeadBody.result?.isError && mcpGetLeadText.ok, "MCP get_lead hidrata a ficha")
assert(mcpGetLeadText.lead?.name === "Ana Souza" && mcpGetLeadText.lead.stage === "welcome", "MCP get_lead lê nome e passo do Postgres")
assert(mcpGetLeadText.lead?.messages?.some((item) => item.id === "m-pg"), "MCP get_lead devolve as falas que a lista compacta esconde")
assert(mcpGetLeadText.lead?.events?.some((item) => item.id === "ev-get"), "MCP get_lead lê a timeline no jsonb")
assert(!mcpGetLeadText.eventsUnread, "jsonb + lead_events vazio não marca unread")
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  if (url.includes("/rest/v1/lead_events") && (init?.method || "GET").toUpperCase() === "GET") {
    return new Response(
      JSON.stringify([
        {
          id: "ev-table",
          lead_id: "mcp-stale",
          at: "2026-07-02T00:00:00.000Z",
          kind: "offer",
          title: "Grupo",
        },
      ]),
      { status: 200 }
    )
  }
  if (url.includes("/rest/v1/leads") && url.includes("id=in.") && (init?.method || "GET").toUpperCase() === "GET") {
    return new Response(
      JSON.stringify([
        {
          id: "mcp-stale",
          name: "Ana Souza",
          contact: "@mcpstale",
          channel: "telegram",
          campaign: "facebook",
          origin: "facebook",
          temperature: "quente",
          stage: "welcome",
          memory: "",
          facts: {},
          messages: [],
          updated_at: "2026-08-01T00:00:00.000Z",
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ]),
      { status: 200 }
    )
  }
  if (url.includes("/rest/v1/")) return new Response("[]", { status: 200 })
  return mcpHydratePrev(input, init)
}) as typeof fetch
const mcpGetLeadTable = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mcpHydrateMinted.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 87.5,
      method: "tools/call",
      params: { name: "abilion_get_lead", arguments: { id: "mcp-stale" } },
    }),
  }),
  mcpHydrateEnv,
  backgroundCtx()
)
const mcpGetLeadTableBody = (await mcpGetLeadTable.json()) as { result?: { content?: Array<{ text?: string }>; isError?: boolean } }
const mcpGetLeadTableText = JSON.parse(mcpGetLeadTableBody.result?.content?.[0]?.text || "{}") as {
  ok?: boolean
  eventsUnread?: boolean
  lead?: { events?: Array<{ id?: string; title?: string }> }
}
assert(mcpGetLeadTable.status === 200 && !mcpGetLeadTableBody.result?.isError && mcpGetLeadTableText.ok, "MCP get_lead junta lead_events")
assert(mcpGetLeadTableText.lead?.events?.some((item) => item.id === "ev-table"), "MCP get_lead lê a timeline da tabela, não só o jsonb")
assert(!mcpGetLeadTableText.eventsUnread, "lead_events lido não marca unread")
globalThis.fetch = (async (input: RequestInfo | URL) => {
  if (String(input).includes("/rest/v1/")) throw new Error("postgres down")
  return mcpHydratePrev(input)
}) as typeof fetch
const mcpGetLeadKv = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mcpHydrateMinted.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 88,
      method: "tools/call",
      params: { name: "abilion_get_lead", arguments: { id: "mcp-stale" } },
    }),
  }),
  mcpHydrateEnv,
  backgroundCtx()
)
const mcpGetLeadKvBody = (await mcpGetLeadKv.json()) as { result?: { content?: Array<{ text?: string }>; isError?: boolean } }
const mcpGetLeadKvText = JSON.parse(mcpGetLeadKvBody.result?.content?.[0]?.text || "{}") as {
  ok?: boolean
  eventsUnread?: boolean
  lead?: { id?: string; name?: string }
}
assert(mcpGetLeadKv.status === 200 && !mcpGetLeadKvBody.result?.isError && mcpGetLeadKvText.ok, "MCP get_lead com KV não falha se o Postgres cair")
assert(mcpGetLeadKvText.lead?.name === "Rita Backup", "MCP get_lead conserva o leftover se o backup cair")
assert(mcpGetLeadKvText.eventsUnread === true, "MCP get_lead marca timeline unread se lead_events falhar")
const mcpGetMiss = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mcpHydrateMinted.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 89,
      method: "tools/call",
      params: { name: "abilion_get_lead", arguments: { id: "ghost-mcp" } },
    }),
  }),
  mcpHydrateEnv,
  backgroundCtx()
)
const mcpGetMissBody = (await mcpGetMiss.json()) as { result?: { content?: Array<{ text?: string }>; isError?: boolean } }
const mcpGetMissText = JSON.parse(mcpGetMissBody.result?.content?.[0]?.text || "{}") as { error?: string }
assert(mcpGetMissBody.result?.isError && mcpGetMissText.error?.includes("Postgres"), "MCP get_lead miss + backup em baixo não finge que a ficha não existe")
const mcpGetEmpty = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mcpHydrateMinted.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 90,
      method: "tools/call",
      params: { name: "abilion_get_lead", arguments: {} },
    }),
  }),
  mcpHydrateEnv,
  backgroundCtx()
)
const mcpGetEmptyBody = (await mcpGetEmpty.json()) as { result?: { content?: Array<{ text?: string }>; isError?: boolean } }
const mcpGetEmptyText = JSON.parse(mcpGetEmptyBody.result?.content?.[0]?.text || "{}") as { error?: string }
assert(mcpGetEmptyBody.result?.isError && mcpGetEmptyText.error?.includes("id"), "MCP get_lead sem id é erro")
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  if (url.includes("/rest/v1/leads") && url.includes("id=in.") && (init?.method || "GET").toUpperCase() === "GET") {
    return new Response("[]", { status: 200 })
  }
  if (url.includes("/rest/v1/")) return new Response("[]", { status: 200 })
  return mcpHydratePrev(input, init)
}) as typeof fetch
const mcpGetGone = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mcpHydrateMinted.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 91,
      method: "tools/call",
      params: { name: "abilion_get_lead", arguments: { id: "ghost-mcp" } },
    }),
  }),
  mcpHydrateEnv,
  backgroundCtx()
)
const mcpGetGoneBody = (await mcpGetGone.json()) as { result?: { content?: Array<{ text?: string }>; isError?: boolean } }
const mcpGetGoneText = JSON.parse(mcpGetGoneBody.result?.content?.[0]?.text || "{}") as { error?: string }
assert(mcpGetGoneBody.result?.isError && mcpGetGoneText.error?.includes("já não está"), "MCP get_lead miss confirmado não inventa ficha")
globalThis.fetch = (async () => new Response("nope", { status: 500 })) as typeof fetch
let byIdUnreadError = ""
try {
  await findWorkspaceLeadById({ AUTH: memoryKv(), SUPABASE_URL: "https://sb.test", SUPABASE_SERVICE_ROLE: "role" }, "only-pg")
} catch (error) {
  byIdUnreadError = error instanceof Error ? error.message : ""
}
assert(byIdUnreadError.includes("Postgres"), "findWorkspaceLeadById miss + GET falho lança unread")
globalThis.fetch = mcpHydratePrev
const pagedOrphanKv = memoryKv()
await upsertLeadKv(pagedOrphanKv, lead("page-live", "@pagelive"))
await pagedOrphanKv.put(
  CRM_INDEX,
  JSON.stringify({
    entries: [
      ...Array.from({ length: 400 }, (_, index) => ({
        id: `page-ghost-${index}`,
        contact: `@pageghost${index}`,
        updatedAt: `2026-07-01T00:${String(Math.floor(index / 60)).padStart(2, "0")}:${String(index % 60).padStart(2, "0")}.000Z`,
        channel: "telegram",
      })),
      { id: "page-live", contact: "@pagelive", updatedAt: "2026-01-01T00:00:00.000Z", channel: "telegram" },
    ],
  })
)
const pagedOrphanEnv = {
  ASSETS: { fetch: async () => new Response("ok") },
  SUPABASE_URL: "https://sb.test",
  SUPABASE_SERVICE_ROLE: "role",
  AUTH: pagedOrphanKv,
  ABILION_ENV: "development",
} as Env
const pagedLogin = await handleRequest(
  new Request("http://local.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "victor@abilion.com", password: "senhaok" }),
  }),
  pagedOrphanEnv,
  backgroundCtx()
)
assert(pagedLogin.status === 200, "login na página órfã com continuação")
const pagedCookie = pagedLogin.headers.get("set-cookie") || ""
const pagedPrev = globalThis.fetch
const pagedUnrelated = {
  id: "pg-unrelated",
  name: "Outro",
  contact: "@outro",
  channel: "telegram" as const,
  campaign: "Facebook · ads",
  origin: "facebook" as const,
  temperature: "novo" as const,
  stage: "capture" as const,
  memory: "",
  facts: {},
  messages: [],
  updated_at: "2026-08-01T00:00:00.000Z",
  created_at: "2026-08-01T00:00:00.000Z",
}
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  if (url.includes("/rest/v1/leads") && url.includes("id=in.") && (init?.method || "GET").toUpperCase() === "GET") {
    return new Response("[]", { status: 200 })
  }
  if (url.includes("/rest/v1/leads") && (init?.method || "GET").toUpperCase() === "GET") {
    return new Response(JSON.stringify([pagedUnrelated]), { status: 200 })
  }
  if (url.includes("/rest/v1/")) return new Response("[]", { status: 200 })
  return pagedPrev(input, init)
}) as typeof fetch
const pagedFirst = await handleRequest(
  new Request("http://local.test/api/leads", { headers: { cookie: pagedCookie } }),
  pagedOrphanEnv,
  backgroundCtx()
)
const pagedFirstBody = (await pagedFirst.json()) as {
  ok?: boolean
  leads?: Array<{ id?: string }>
  nextCursor?: string
  clipped?: boolean
}
assert(pagedFirst.status === 200 && pagedFirstBody.ok && pagedFirstBody.nextCursor, "primeira página órfã mantém o cursor do índice")
assert(pagedFirstBody.clipped === true, "primeira página órfã sem fill marca clipped")
assert(!pagedFirstBody.leads?.some((item) => item.id === "pg-unrelated"), "página órfã com continuação não troca o índice pelo Postgres")
assert(!pagedFirstBody.leads?.some((item) => item.id === "page-live"), "o vivo da página 2 não vem na primeira")
const pagedSecond = await handleRequest(
  new Request(`http://local.test/api/leads?cursor=${encodeURIComponent(pagedFirstBody.nextCursor || "")}`, {
    headers: { cookie: pagedCookie },
  }),
  pagedOrphanEnv,
  backgroundCtx()
)
const pagedSecondBody = (await pagedSecond.json()) as { ok?: boolean; leads?: Array<{ id?: string }>; clipped?: boolean }
assert(pagedSecond.status === 200 && pagedSecondBody.leads?.some((item) => item.id === "page-live"), "página 2 do índice ainda entrega o vivo")
assert(
  collectLeadPages([
    { leads: (pagedFirstBody.leads ?? []) as Lead[], nextCursor: pagedFirstBody.nextCursor, clipped: true },
    { leads: (pagedSecondBody.leads ?? []) as Lead[] },
  ]).complete === false,
  "órfãos na página 1 não fecham o universo"
)
const hollowIndexKv = memoryKv()
await hollowIndexKv.put(
  CRM_INDEX,
  JSON.stringify({
    entries: [{ id: "index-ana", contact: "@indexana", updatedAt: "2026-06-01T00:00:00.000Z", channel: "telegram" }],
  })
)
const hollowIndexEnv = {
  ASSETS: { fetch: async () => new Response("ok") },
  SUPABASE_URL: "https://sb.test",
  SUPABASE_SERVICE_ROLE: "role",
  AUTH: hollowIndexKv,
  ABILION_ENV: "development",
} as Env
const hollowLogin = await handleRequest(
  new Request("http://local.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "victor@abilion.com", password: "senhaok" }),
  }),
  hollowIndexEnv,
  backgroundCtx()
)
assert(hollowLogin.status === 200, "login no índice oco da única página")
const hollowCookie = hollowLogin.headers.get("set-cookie") || ""
const hollowAnaRow = {
  id: "index-ana",
  name: "Ana Souza",
  contact: "@indexana",
  channel: "telegram" as const,
  campaign: "Facebook · ads",
  origin: "facebook" as const,
  temperature: "novo" as const,
  stage: "capture" as const,
  memory: "",
  facts: {},
  messages: [],
  updated_at: "2026-06-01T00:00:00.000Z",
  created_at: "2026-06-01T00:00:00.000Z",
}
const hollowRitaRow = {
  ...hollowAnaRow,
  id: "other-rita",
  name: "Rita Backup",
  contact: "@otherrita",
  updated_at: "2026-08-01T00:00:00.000Z",
  created_at: "2026-08-01T00:00:00.000Z",
}
const hollowPrev = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  if (url.includes("/rest/v1/leads") && url.includes("id=in.") && (init?.method || "GET").toUpperCase() === "GET") {
    return new Response(JSON.stringify([hollowAnaRow]), { status: 200 })
  }
  if (url.includes("/rest/v1/leads") && (init?.method || "GET").toUpperCase() === "GET") {
    return new Response(JSON.stringify([hollowRitaRow]), { status: 200 })
  }
  if (url.includes("/rest/v1/")) return new Response("[]", { status: 200 })
  return hollowPrev(input, init)
}) as typeof fetch
const hollowHit = await handleRequest(
  new Request("http://local.test/api/leads", { headers: { cookie: hollowCookie } }),
  hollowIndexEnv,
  backgroundCtx()
)
const hollowHitBody = (await hollowHit.json()) as { ok?: boolean; leads?: Array<{ id?: string; name?: string }>; clipped?: boolean }
assert(hollowHit.status === 200 && hollowHitBody.ok, "única página órfã com backup de pé é 200")
assert(hollowHitBody.leads?.some((item) => item.id === "index-ana"), "única página órfã hidrata o id do índice")
assert(!hollowHitBody.leads?.some((item) => item.id === "other-rita"), "única página órfã não troca o índice pelo latest-N")
assert(hollowHitBody.clipped !== true, "única página órfã preenchida não marca clipped")
const hollowInbox = await handleRequest(
  new Request("http://local.test/api/inbox", { headers: { cookie: hollowCookie } }),
  hollowIndexEnv,
  backgroundCtx()
)
const hollowInboxBody = (await hollowInbox.json()) as { leads?: Array<{ id?: string }> }
assert(hollowInboxBody.leads?.some((item) => item.id === "index-ana"), "inbox da única página órfã hidrata o id do índice")
assert(!hollowInboxBody.leads?.some((item) => item.id === "other-rita"), "inbox da única página órfã não cai no latest-N")
const hollowMint = await handleRequest(
  new Request("http://local.test/api/tokens", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: hollowCookie, "x-forwarded-for": "198.51.100.94" },
    body: JSON.stringify({ name: "Oca" }),
  }),
  hollowIndexEnv,
  backgroundCtx()
)
const hollowMinted = (await hollowMint.json()) as { token?: string }
assert(hollowMint.status === 201 && hollowMinted.token?.startsWith("abn_"), "token para a lista MCP oca")
const hollowMcp = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${hollowMinted.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 87,
      method: "tools/call",
      params: { name: "abilion_list_leads", arguments: { limit: 5 } },
    }),
  }),
  hollowIndexEnv,
  backgroundCtx()
)
const hollowMcpBody = (await hollowMcp.json()) as { result?: { content?: Array<{ text?: string }>; isError?: boolean } }
const hollowMcpText = JSON.parse(hollowMcpBody.result?.content?.[0]?.text || "{}") as {
  ok?: boolean
  leads?: Array<{ id?: string }>
  clipped?: boolean
}
assert(hollowMcp.status === 200 && !hollowMcpBody.result?.isError && hollowMcpText.ok, "MCP lista a única página órfã")
assert(hollowMcpText.leads?.some((item) => item.id === "index-ana"), "MCP oca hidrata o id do índice")
assert(!hollowMcpText.leads?.some((item) => item.id === "other-rita"), "MCP oca não troca o índice pelo latest-N")
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (String(input).includes("/rest/v1/")) throw new Error("postgres down")
  return hollowPrev(input, init)
}) as typeof fetch
const hollowDown = await handleRequest(
  new Request("http://local.test/api/leads", { headers: { cookie: hollowCookie } }),
  hollowIndexEnv,
  backgroundCtx()
)
assert(hollowDown.status === 503, "única página órfã + Postgres em baixo é 503")
const hollowMcpDown = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${hollowMinted.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 88,
      method: "tools/call",
      params: { name: "abilion_list_leads", arguments: { limit: 5 } },
    }),
  }),
  hollowIndexEnv,
  backgroundCtx()
)
const hollowMcpDownBody = (await hollowMcpDown.json()) as { result?: { content?: Array<{ text?: string }>; isError?: boolean } }
const hollowMcpDownText = JSON.parse(hollowMcpDownBody.result?.content?.[0]?.text || "{}") as { error?: string }
assert(hollowMcpDownBody.result?.isError && hollowMcpDownText.error?.includes("Postgres"), "MCP oca + Postgres em baixo é erro")
globalThis.fetch = hollowPrev
const mcpPageEnv = {
  ASSETS: { fetch: async () => new Response("ok") },
  SUPABASE_URL: "https://sb.test",
  SUPABASE_SERVICE_ROLE: "role",
  AUTH: memoryKv(),
  ABILION_ENV: "development",
} as Env
await upsertLeadKv(mcpPageEnv.AUTH, lead("mcp-live", "@mcplive"))
await mcpPageEnv.AUTH.put(
  CRM_INDEX,
  JSON.stringify({
    entries: [
      { id: "mcp-ghost", contact: "@mcpghost", updatedAt: "2026-07-01T00:00:00.000Z", channel: "telegram" },
      { id: "mcp-live", contact: "@mcplive", updatedAt: "2026-01-01T00:00:00.000Z", channel: "telegram" },
    ],
  })
)
const mcpPageLogin = await handleRequest(
  new Request("http://local.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "victor@abilion.com", password: "senhaok" }),
  }),
  mcpPageEnv,
  backgroundCtx()
)
const mcpPageCookie = mcpPageLogin.headers.get("set-cookie") || ""
const mcpPageMint = await handleRequest(
  new Request("http://local.test/api/tokens", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: mcpPageCookie, "x-forwarded-for": "198.51.100.93" },
    body: JSON.stringify({ name: "Paginada" }),
  }),
  mcpPageEnv,
  backgroundCtx()
)
const mcpPageMinted = (await mcpPageMint.json()) as { token?: string }
assert(mcpPageMint.status === 201 && mcpPageMinted.token?.startsWith("abn_"), "token para a lista MCP paginada")
const mcpPagedFirst = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mcpPageMinted.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 85,
      method: "tools/call",
      params: { name: "abilion_list_leads", arguments: { limit: 1 } },
    }),
  }),
  mcpPageEnv,
  backgroundCtx()
)
const mcpPagedFirstBody = (await mcpPagedFirst.json()) as { result?: { content?: Array<{ text?: string }>; isError?: boolean } }
const mcpPagedFirstText = JSON.parse(mcpPagedFirstBody.result?.content?.[0]?.text || "{}") as {
  ok?: boolean
  leads?: Array<{ id?: string }>
  nextCursor?: string
  clipped?: boolean
}
assert(mcpPagedFirst.status === 200 && !mcpPagedFirstBody.result?.isError && mcpPagedFirstText.nextCursor, "MCP órfã com continuação mantém o cursor")
assert(!mcpPagedFirstText.leads?.some((item) => item.id === "pg-unrelated"), "MCP órfã com continuação não pagina o Postgres")
const mcpPagedSecond = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mcpPageMinted.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 86,
      method: "tools/call",
      params: { name: "abilion_list_leads", arguments: { limit: 1, cursor: mcpPagedFirstText.nextCursor } },
    }),
  }),
  mcpPageEnv,
  backgroundCtx()
)
const mcpPagedSecondBody = (await mcpPagedSecond.json()) as { result?: { content?: Array<{ text?: string }> } }
const mcpPagedSecondText = JSON.parse(mcpPagedSecondBody.result?.content?.[0]?.text || "{}") as { leads?: Array<{ id?: string }> }
assert(mcpPagedSecondText.leads?.some((item) => item.id === "mcp-live"), "MCP página 2 entrega o vivo do índice")
globalThis.fetch = pagedPrev
const pgFullRows = Array.from({ length: 400 }, (_, index) => ({
  id: `pg-${String(index).padStart(3, "0")}`,
  name: `Lead ${index}`,
  contact: `@pg${index}`,
  channel: "telegram" as const,
  campaign: "Facebook · ads",
  origin: "facebook" as const,
  temperature: "novo" as const,
  stage: "capture" as const,
  memory: "",
  facts: index === 399 ? { category: "Grupo" } : {},
  messages: [],
  updated_at: `2026-06-01T00:${String(Math.floor(index / 60)).padStart(2, "0")}:${String(index % 60).padStart(2, "0")}.000Z`,
  created_at: "2026-06-01T00:00:00.000Z",
}))
const pgFullEnv = {
  ASSETS: { fetch: async () => new Response("ok") },
  SUPABASE_URL: "https://sb.test",
  SUPABASE_SERVICE_ROLE: "role",
  AUTH: memoryKv(),
  ABILION_ENV: "development",
} as Env
const pgFullLogin = await handleRequest(
  new Request("http://local.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "victor@abilion.com", password: "senhaok" }),
  }),
  pgFullEnv,
  backgroundCtx()
)
assert(pgFullLogin.status === 200, "login no KV oco para o backup de leads")
const pgFullCookie = pgFullLogin.headers.get("set-cookie") || ""
const pgFullPrev = globalThis.fetch
let pgFullCursorSeen = false
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  const method = (init?.method || "GET").toUpperCase()
  if (url.includes("/rest/v1/leads") && method === "GET") {
    if (url.includes("updated_at.lt.")) pgFullCursorSeen = true
    const rows = url.includes("updated_at.lt.") ? [] : [...pgFullRows].reverse()
    return new Response(JSON.stringify(rows), { status: 200 })
  }
  return pgFullPrev(input, init)
}) as typeof fetch
const pgFullList = await handleRequest(
  new Request("http://local.test/api/leads", { headers: { cookie: pgFullCookie } }),
  pgFullEnv,
  backgroundCtx()
)
const pgFullBody = (await pgFullList.json()) as {
  ok?: boolean
  leads?: Array<{ id?: string; category?: string }>
  nextCursor?: string
  clipped?: boolean
}
assert(pgFullList.status === 200 && pgFullBody.ok && pgFullBody.leads?.length === 400, "KV oco lê a página do Postgres")
assert(pgFullBody.clipped === true && Boolean(pgFullBody.nextCursor), "página cheia do backup não finge lista completa")
assert(pgFullBody.leads?.[0]?.category === "Grupo", "GET leads recupera a categoria do jsonb")
const pgFullNext = await handleRequest(
  new Request(`http://local.test/api/leads?cursor=${encodeURIComponent(pgFullBody.nextCursor || "")}`, {
    headers: { cookie: pgFullCookie },
  }),
  pgFullEnv,
  backgroundCtx()
)
const pgFullNextBody = (await pgFullNext.json()) as { leads?: unknown[]; nextCursor?: string; clipped?: boolean }
assert(pgFullNext.status === 200 && pgFullCursorSeen, "segunda página do backup usa o keyset")
assert((pgFullNextBody.leads?.length ?? 1) === 0 && !pgFullNextBody.nextCursor && !pgFullNextBody.clipped, "última página curta do backup fecha a lista")
const pgSearchRow = {
  id: "pg-ana",
  name: "Ana Souza",
  contact: "@anasouza",
  channel: "telegram" as const,
  campaign: "Facebook · ads",
  origin: "facebook" as const,
  temperature: "novo" as const,
  stage: "capture" as const,
  memory: "",
  facts: { category: "Grupo Premium" },
  messages: [],
  telegram_chat_id: "4401",
  updated_at: "2026-06-02T00:00:00.000Z",
  created_at: "2026-06-01T00:00:00.000Z",
}
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  if (url.includes("/rest/v1/leads") && (init?.method || "GET").toUpperCase() === "GET" && url.includes("ilike")) {
    return new Response(JSON.stringify([pgSearchRow]), { status: 200 })
  }
  if (url.includes("/rest/v1/")) return new Response("[]", { status: 200 })
  return pgFullPrev(input, init)
}) as typeof fetch
const pgSearchHit = await searchWorkspaceLeads(pgFullEnv, "Ana Souza")
assert(pgSearchHit.ok && pgSearchHit.leads[0]?.id === "pg-ana", "índice oco encontra o lead no Postgres")
const pgSearchCat = await searchWorkspaceLeads(pgFullEnv, "Grupo Premium")
assert(pgSearchCat.ok && pgSearchCat.leads[0]?.id === "pg-ana", "índice oco encontra pela categoria no jsonb")
const pgSearchHttp = await handleRequest(
  new Request("http://local.test/api/leads?q=Ana%20Souza", { headers: { cookie: pgFullCookie } }),
  pgFullEnv,
  backgroundCtx()
)
const pgSearchHttpBody = (await pgSearchHttp.json()) as { ok?: boolean; leads?: Array<{ id?: string }> }
assert(pgSearchHttp.status === 200 && pgSearchHttpBody.leads?.some((item) => item.id === "pg-ana"), "GET ?q= no KV oco lê o Postgres")
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (String(input).includes("/rest/v1/")) throw new Error("postgres down")
  return pgFullPrev(input, init)
}) as typeof fetch
const pgSearchFail = await searchWorkspaceLeads(pgFullEnv, "Ana Souza")
assert(!pgSearchFail.ok, "índice oco + Postgres em baixo não finge busca vazia")
const pgSearchFailHttp = await handleRequest(
  new Request("http://local.test/api/leads?q=Ana%20Souza", { headers: { cookie: pgFullCookie } }),
  pgFullEnv,
  backgroundCtx()
)
assert(pgSearchFailHttp.status === 503, "GET ?q= no KV oco é 503 se o Postgres falhar")
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  if (url.includes("/rest/v1/leads") && (init?.method || "GET").toUpperCase() === "GET" && url.includes("ilike")) {
    return new Response(JSON.stringify([pgSearchRow]), { status: 200 })
  }
  if (url.includes("/rest/v1/")) return new Response("[]", { status: 200 })
  return pgFullPrev(input, init)
}) as typeof fetch
const pgSearchMint = await handleRequest(
  new Request("http://local.test/api/tokens", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: pgFullCookie, "x-forwarded-for": "198.51.100.77" },
    body: JSON.stringify({ name: "Busca" }),
  }),
  pgFullEnv,
  backgroundCtx()
)
const pgSearchMinted = (await pgSearchMint.json()) as { token?: string }
assert(pgSearchMint.status === 201 && pgSearchMinted.token?.startsWith("abn_"), "token para a busca MCP")
const mcpSearch = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${pgSearchMinted.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 80,
      method: "tools/call",
      params: { name: "abilion_list_leads", arguments: { q: "Ana Souza" } },
    }),
  }),
  pgFullEnv,
  backgroundCtx()
)
const mcpSearchBody = (await mcpSearch.json()) as { result?: { content?: Array<{ text?: string }>; isError?: boolean } }
const mcpSearchList = JSON.parse(mcpSearchBody.result?.content?.[0]?.text || "{}") as { ok?: boolean; leads?: Array<{ id?: string }> }
assert(mcpSearch.status === 200 && mcpSearchList.ok && mcpSearchList.leads?.some((item) => item.id === "pg-ana"), "MCP q= no KV oco lê o Postgres")
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (String(input).includes("/rest/v1/")) throw new Error("postgres down")
  return pgFullPrev(input, init)
}) as typeof fetch
const mcpSearchFail = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${pgSearchMinted.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 81,
      method: "tools/call",
      params: { name: "abilion_list_leads", arguments: { q: "Ana Souza" } },
    }),
  }),
  pgFullEnv,
  backgroundCtx()
)
const mcpSearchFailBody = (await mcpSearchFail.json()) as { result?: { content?: Array<{ text?: string }>; isError?: boolean } }
const mcpSearchFailText = JSON.parse(mcpSearchFailBody.result?.content?.[0]?.text || "{}") as { error?: string }
assert(mcpSearchFailBody.result?.isError && mcpSearchFailText.error?.includes("Postgres"), "MCP q= no KV oco é erro se o Postgres falhar")
await upsertLeadKv(pgFullEnv.AUTH, lead("kv-live", "@kvlive"))
const pgSearchKvMiss = await searchWorkspaceLeads(pgFullEnv, "zzzmissing")
assert(pgSearchKvMiss.ok && pgSearchKvMiss.leads.length === 0, "índice com entradas e zero hits não é 503")
const pgSearchKvHit = await searchWorkspaceLeads(pgFullEnv, "@kvlive")
assert(pgSearchKvHit.ok && pgSearchKvHit.leads[0]?.id === "kv-live", "GET ?q= ainda lê o KV quando ele tem o lead")
const kvAna = { ...lead("kv-ana", "@anakv"), name: "Ana KV" }
assert(adoptSearchLeads([kvAna], [rowToLead(pgSearchRow)]).some((item) => item.id === "kv-ana"), "busca une o hit do KV")
assert(adoptSearchLeads([kvAna], [rowToLead(pgSearchRow)]).some((item) => item.id === "pg-ana"), "busca une o órfão do backup")
assert(adoptSearchLeads([kvAna], []).every((item) => item.id === "kv-ana"), "busca sem remoto fica o KV")
await upsertLeadKv(pgFullEnv.AUTH, kvAna)
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  if (url.includes("/rest/v1/leads") && (init?.method || "GET").toUpperCase() === "GET" && url.includes("ilike")) {
    return new Response(JSON.stringify([pgSearchRow]), { status: 200 })
  }
  if (url.includes("/rest/v1/")) return new Response("[]", { status: 200 })
  return pgFullPrev(input, init)
}) as typeof fetch
const pgSearchKvHole = await searchWorkspaceLeads(pgFullEnv, "Ana Souza")
assert(pgSearchKvHole.ok && pgSearchKvHole.leads.some((item) => item.id === "pg-ana"), "índice com entradas ainda lê o Postgres se o KV não tem o nome")
const pgSearchUnion = await searchWorkspaceLeads(pgFullEnv, "Ana")
assert(pgSearchUnion.ok && pgSearchUnion.leads.some((item) => item.id === "kv-ana"), "hit no KV não fecha a busca")
assert(pgSearchUnion.ok && pgSearchUnion.leads.some((item) => item.id === "pg-ana"), "hit no KV ainda lê o órfão no Postgres")
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (String(input).includes("/rest/v1/")) throw new Error("postgres down")
  return pgFullPrev(input, init)
}) as typeof fetch
const pgSearchUnionDown = await searchWorkspaceLeads(pgFullEnv, "Ana")
assert(pgSearchUnionDown.ok && pgSearchUnionDown.leads.some((item) => item.id === "kv-ana"), "hit no KV + backup unread devolve o KV")
assert(!pgSearchUnionDown.ok || !pgSearchUnionDown.leads.some((item) => item.id === "pg-ana"), "unread não inventa o órfão")
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  if (url.includes("/rest/v1/leads") && (init?.method || "GET").toUpperCase() === "GET" && url.includes("ilike")) {
    return new Response(JSON.stringify([pgSearchRow]), { status: 200 })
  }
  if (url.includes("/rest/v1/")) return new Response("[]", { status: 200 })
  return pgFullPrev(input, init)
}) as typeof fetch
const pgSearchKvHoleHttp = await handleRequest(
  new Request("http://local.test/api/leads?q=Ana%20Souza", { headers: { cookie: pgFullCookie } }),
  pgFullEnv,
  backgroundCtx()
)
const pgSearchKvHoleBody = (await pgSearchKvHoleHttp.json()) as { ok?: boolean; leads?: Array<{ id?: string }> }
assert(pgSearchKvHoleHttp.status === 200 && pgSearchKvHoleBody.leads?.some((item) => item.id === "pg-ana"), "GET ?q= com índice preenchido lê o órfão no Postgres")
globalThis.fetch = pgFullPrev
const inbox = (await (
  await handleRequest(new Request("http://local.test/api/inbox", { headers: { cookie: startCookie } }), startEnv, backgroundCtx())
).json()) as { leads?: Array<{ contact?: string }> }
assert(inbox.leads?.some((item) => item.contact === "@fbuser"), "inbox devolve a Ana")
const runtimeGet = await handleRequest(
  new Request("http://local.test/api/runtime", { headers: { cookie: startCookie } }),
  startEnv,
  backgroundCtx()
)
const runtimeBody = (await runtimeGet.json()) as Record<string, unknown>
assert(runtimeGet.status === 200 && runtimeBody.ok === true && runtimeBody.telegram === true, "runtime vê o token")
assert(
  !JSON.stringify(runtimeBody).includes("000:test") &&
    !("telegramBotToken" in runtimeBody) &&
    !("openaiApiKey" in runtimeBody) &&
    !("elevenApiKey" in runtimeBody),
  "runtime não vaza secrets"
)
assert((await handleRequest(new Request("http://local.test/api/runtime"), startEnv, backgroundCtx())).status === 401, "runtime sem sessão é 401")
const deleted = await handleRequest(
  new Request(`http://local.test/api/leads?id=${encodeURIComponent(anaTalk?.id || ana?.id || "")}`, {
    method: "DELETE",
    headers: { cookie: startCookie },
  }),
  startEnv,
  backgroundCtx()
)
assert(deleted.status === 200, "DELETE lead autenticado")
assert(!(await listLeads(startEnv.AUTH, 20, "all")).some((item) => item.contact === "@fbuser"), "lead apagado some do KV")
assert(
  (await loadRemovedLeadIds(startEnv.AUTH)).some((id) => id === (anaTalk?.id || ana?.id)),
  "DELETE autenticado grava tombstone"
)

const liveEnv = {
  ASSETS: { fetch: async () => new Response("ok") },
  SUPABASE_URL: "https://example.supabase.co",
  AUTH: memoryKv(),
  ABILION_ENV: "development",
} as Env
const liveLogin = await handleRequest(
  new Request("http://local.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "victor@abilion.com", password: "senhaok" }),
  }),
  liveEnv,
  backgroundCtx()
)
assert(liveLogin.status === 200, "login pelo handleRequest")
const liveCookie = liveLogin.headers.get("set-cookie") || ""
const hookEnv = {
  ASSETS: { fetch: async () => new Response("ok") },
  AUTH: memoryKv(),
  ABILION_ENV: "development",
} as Env
const hookLogin = await handleRequest(
  new Request("http://local.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "victor@abilion.com", password: "senhaok" }),
  }),
  hookEnv,
  backgroundCtx()
)
assert(hookLogin.status === 200, "login no KV do runtime")
const hookCookie = hookLogin.headers.get("set-cookie") || ""
const runtimeFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (String(input).includes("api.telegram.org")) {
    return new Response(JSON.stringify({ ok: false, description: "Bad Request: failed to set webhook" }), { status: 200 })
  }
  return runtimeFetch(input, init)
}) as typeof fetch
const hookFail = await handleRequest(
  new Request("http://local.test/api/runtime", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: hookCookie },
    body: JSON.stringify({ telegramBotToken: "111:retry-me" }),
  }),
  hookEnv,
  backgroundCtx()
)
const hookBody = (await hookFail.json()) as { ok?: boolean; telegram?: boolean; warning?: string }
assert(hookFail.status === 200, "webhook falhou mas o token ficou")
assert(hookBody.ok === true && hookBody.telegram === true && Boolean(hookBody.warning), "runtime avisa sem recusar o token")
assert((await loadSecrets(hookEnv.AUTH)).telegramBotToken === "111:retry-me", "token sobrevive ao webhook falhado")
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (String(input).includes("api.telegram.org")) {
    return new Response(JSON.stringify({ ok: false, description: "Unauthorized" }), { status: 401 })
  }
  return runtimeFetch(input, init)
}) as typeof fetch
const hookDenied = await handleRequest(
  new Request("http://local.test/api/runtime", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: hookCookie },
    body: JSON.stringify({ telegramBotToken: "000:bad" }),
  }),
  hookEnv,
  backgroundCtx()
)
assert(hookDenied.status === 400, "token recusado continua 400")
assert((await loadSecrets(hookEnv.AUTH)).telegramBotToken === "111:retry-me", "token recusado não pisa o gravado")
globalThis.fetch = runtimeFetch
const forgotOnce = (await (
  await handleRequest(
    new Request("http://local.test/api/auth/forgot", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.44" },
      body: JSON.stringify({ email: "victor@abilion.com" }),
    }),
    liveEnv,
    backgroundCtx()
  )
).json()) as { resetPath?: string }
const forgotTwice = (await (
  await handleRequest(
    new Request("http://local.test/api/auth/forgot", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.44" },
      body: JSON.stringify({ email: "victor@abilion.com" }),
    }),
    liveEnv,
    backgroundCtx()
  )
).json()) as { resetPath?: string }
const oldReset = forgotOnce.resetPath?.split("token=")[1] || ""
const newReset = forgotTwice.resetPath?.split("token=")[1] || ""
assert(oldReset && newReset && oldReset !== newReset, "forgot novo substitui o token")
assert(
  (
    await handleRequest(
      new Request("http://local.test/api/auth/reset", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.44" },
        body: JSON.stringify({ token: oldReset, password: "outrasenha" }),
      }),
      liveEnv,
      backgroundCtx()
    )
  ).status === 400,
  "token antigo de reset já não entra"
)
const persistFunnel = emptySalesFunnel("persistido")
const crmPost = await handleRequest(
  new Request("http://local.test/api/crm", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: liveCookie },
    body: JSON.stringify({ funnels: [persistFunnel] }),
  }),
  liveEnv,
  backgroundCtx()
)
assert(crmPost.status === 200, "CRM POST autenticado")
const crmGet = (await (
  await handleRequest(new Request("http://local.test/api/crm", { headers: { cookie: liveCookie } }), liveEnv, backgroundCtx())
).json()) as { funnels?: Array<{ id?: string; name?: string }> }
assert(crmGet.funnels?.some((item) => item.id === persistFunnel.id), "CRM GET devolve o funil gravado")
const crmTooMany = await handleRequest(
  new Request("http://local.test/api/crm", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: liveCookie },
    body: JSON.stringify({ funnels: Array.from({ length: 21 }, (_, index) => emptySalesFunnel(`cap-${index}`)) }),
  }),
  liveEnv,
  backgroundCtx()
)
assert(crmTooMany.status === 400, "POST de 21 funis é recusado em vez de cortar o quadro")
const crmAfterCap = (await (
  await handleRequest(new Request("http://local.test/api/crm", { headers: { cookie: liveCookie } }), liveEnv, backgroundCtx())
).json()) as { funnels?: Array<{ id?: string }> }
assert(crmAfterCap.funnels?.some((item) => item.id === persistFunnel.id), "recusa do 21.º conserva o quadro já gravado")
assert(
  (
    await handleRequest(
      new Request("http://local.test/api/crm", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: liveCookie },
        body: JSON.stringify({ settings: { ...defaultSettings, esterTelegramChatId: "999001" } }),
      }),
      liveEnv,
      backgroundCtx()
    )
  ).status === 200,
  "CRM POST com chat da Ester é 200"
)
const crmSettings = (await (
  await handleRequest(new Request("http://local.test/api/crm", { headers: { cookie: liveCookie } }), liveEnv, backgroundCtx())
).json()) as { settings?: { esterTelegramChatId?: string } }
assert(!crmSettings.settings?.esterTelegramChatId, "GET CRM não devolve o chat da Ester")
const extraFunnel = emptySalesFunnel("extra")
extraFunnel.updatedAt = "2099-01-01T00:00:00.000Z"
assert(
  (
    await handleRequest(
      new Request("http://local.test/api/crm", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: liveCookie },
        body: JSON.stringify({ funnels: [persistFunnel, extraFunnel] }),
      }),
      liveEnv,
      backgroundCtx()
    )
  ).status === 200,
  "CRM POST grava o funil extra"
)
assert(
  (
    await handleRequest(
      new Request("http://local.test/api/crm", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: liveCookie },
        body: JSON.stringify({ funnels: [persistFunnel] }),
      }),
      liveEnv,
      backgroundCtx()
    )
  ).status === 200,
  "CRM POST sem tombstone aceita a lista menor"
)
const crmWithoutTombstone = (await (
  await handleRequest(new Request("http://local.test/api/crm", { headers: { cookie: liveCookie } }), liveEnv, backgroundCtx())
).json()) as { funnels?: Array<{ id?: string }> }
assert(crmWithoutTombstone.funnels?.some((item) => item.id === extraFunnel.id), "sem tombstone o extra mais novo fica")
const olderExtra = emptySalesFunnel("velho")
olderExtra.updatedAt = "2020-01-01T00:00:00.000Z"
assert(
  (
    await handleRequest(
      new Request("http://local.test/api/crm", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: liveCookie },
        body: JSON.stringify({ funnels: [persistFunnel, extraFunnel, olderExtra] }),
      }),
      liveEnv,
      backgroundCtx()
    )
  ).status === 200,
  "CRM POST grava o funil mais velho"
)
assert(
  (
    await handleRequest(
      new Request("http://local.test/api/crm", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: liveCookie },
        body: JSON.stringify({ funnels: [persistFunnel] }),
      }),
      liveEnv,
      backgroundCtx()
    )
  ).status === 200,
  "CRM POST do separador velho sem o extra"
)
const crmKeepsOlder = (await (
  await handleRequest(new Request("http://local.test/api/crm", { headers: { cookie: liveCookie } }), liveEnv, backgroundCtx())
).json()) as { funnels?: Array<{ id?: string }> }
assert(crmKeepsOlder.funnels?.some((item) => item.id === olderExtra.id), "separador velho não apaga o funil mais antigo")
assert(
  (
    await handleRequest(
      new Request("http://local.test/api/crm", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: liveCookie },
        body: JSON.stringify({ funnels: [persistFunnel], removedFunnelIds: [extraFunnel.id] }),
      }),
      liveEnv,
      backgroundCtx()
    )
  ).status === 200,
  "CRM POST com tombstone apaga o extra"
)
const crmAfterTombstone = (await (
  await handleRequest(new Request("http://local.test/api/crm", { headers: { cookie: liveCookie } }), liveEnv, backgroundCtx())
).json()) as { funnels?: Array<{ id?: string }> }
assert(!crmAfterTombstone.funnels?.some((item) => item.id === extraFunnel.id), "tombstone remove o extra do KV")
assert(crmAfterTombstone.funnels?.some((item) => item.id === persistFunnel.id), "o funil que ficou continua")
assert((await loadRemovedFunnelIds(liveEnv.AUTH)).includes(extraFunnel.id), "tombstone de funil fica no KV")
assert(
  (
    await handleRequest(
      new Request("http://local.test/api/crm", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: liveCookie },
        body: JSON.stringify({ funnels: [persistFunnel, extraFunnel] }),
      }),
      liveEnv,
      backgroundCtx()
    )
  ).status === 200,
  "CRM POST do extra já tombstoned é 200"
)
const crmNoRevive = (await (
  await handleRequest(new Request("http://local.test/api/crm", { headers: { cookie: liveCookie } }), liveEnv, backgroundCtx())
).json()) as { funnels?: Array<{ id?: string; status?: string }> }
assert(!crmNoRevive.funnels?.some((item) => item.id === extraFunnel.id), "tombstone persistente impede o extra voltar")
const twin = emptySalesFunnel("gemeo")
twin.status = "active"
twin.production = { name: "Gemeo", publishedAt: "2026-01-01T00:00:00.000Z", nodes: twin.nodes, edges: twin.edges }
const latestPub = { ...persistFunnel, status: "active" as const, production: { name: persistFunnel.name, publishedAt: "2026-07-01T00:00:00.000Z", nodes: persistFunnel.nodes, edges: persistFunnel.edges } }
assert(
  (
    await handleRequest(
      new Request("http://local.test/api/crm", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: liveCookie },
        body: JSON.stringify({ funnels: [latestPub, twin] }),
      }),
      liveEnv,
      backgroundCtx()
    )
  ).status === 200,
  "CRM POST com dois publicados"
)
const crmOnePub = (await (
  await handleRequest(new Request("http://local.test/api/crm", { headers: { cookie: liveCookie } }), liveEnv, backgroundCtx())
).json()) as { funnels?: Array<{ id?: string; status?: string; production?: unknown }> }
assert(
  (crmOnePub.funnels ?? []).filter((item) => item.status === "active" && item.production).length === 1,
  "Worker grava um só funil publicado"
)
assert(crmOnePub.funnels?.find((item) => item.status === "active")?.id === latestPub.id, "fica o publicado mais recente")
assert(
  (
    await handleRequest(
      new Request("http://local.test/api/crm", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: liveCookie },
        body: JSON.stringify({ funnels: [], removedFunnelIds: (crmOnePub.funnels ?? []).map((item) => item.id || "") }),
      }),
      liveEnv,
      backgroundCtx()
    )
  ).status === 400,
  "CRM recusa ficar sem funil"
)
const afterRefuseEmpty = (await (
  await handleRequest(new Request("http://local.test/api/crm", { headers: { cookie: liveCookie } }), liveEnv, backgroundCtx())
).json()) as { funnels?: Array<{ id?: string; production?: { nodes?: unknown[]; publishedAt?: string } }> }
assert(afterRefuseEmpty.funnels?.some((item) => item.id === latestPub.id), "400 sem funil não tombstoneia o que ficou")
const emptyPublished = emptySalesFunnel("vazio")
emptyPublished.status = "active"
emptyPublished.production = { name: "Vazio", publishedAt: "2099-09-20T00:00:00.000Z", nodes: [], edges: [] }
const emptyPubRes = await handleRequest(
  new Request("http://local.test/api/crm", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: liveCookie },
    body: JSON.stringify({ funnels: [emptyPublished] }),
  }),
  liveEnv,
  backgroundCtx()
)
assert(emptyPubRes.status === 400, "CRM recusa publicar quadro vazio")
const emptyPubBody = (await emptyPubRes.json()) as { error?: string }
assert(emptyPubBody.error === "Publica pelo menos uma entrada (popup, join ou /start).", "CRM diz o erro de publicação")
const afterEmptyPub = (await (
  await handleRequest(new Request("http://local.test/api/crm", { headers: { cookie: liveCookie } }), liveEnv, backgroundCtx())
).json()) as { funnels?: Array<{ id?: string }> }
assert(!afterEmptyPub.funnels?.some((item) => item.id === emptyPublished.id), "quadro vazio não entra no KV")
assert(afterEmptyPub.funnels?.some((item) => item.id === latestPub.id), "recusar o vazio não apaga o publicado")
const sameStampEmpty = {
  ...latestPub,
  updatedAt: "2099-09-20T00:00:00.000Z",
  production: { name: latestPub.name, publishedAt: latestPub.production!.publishedAt, nodes: [], edges: [] },
}
assert(
  (
    await handleRequest(
      new Request("http://local.test/api/crm", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: liveCookie },
        body: JSON.stringify({ funnels: [sameStampEmpty] }),
      }),
      liveEnv,
      backgroundCtx()
    )
  ).status === 200,
  "CRM aceita o mesmo publishedAt já gravado"
)
const afterGrandfather = (await (
  await handleRequest(new Request("http://local.test/api/crm", { headers: { cookie: liveCookie } }), liveEnv, backgroundCtx())
).json()) as { funnels?: Array<{ id?: string; production?: { nodes?: unknown[]; publishedAt?: string } }> }
const keptPublished = afterGrandfather.funnels?.find((item) => item.id === latestPub.id)
assert((keptPublished?.production?.nodes?.length ?? 0) > 0, "grandfather não apaga o quadro já publicado")
assert(keptPublished?.production?.publishedAt === latestPub.production!.publishedAt, "publishedAt do quadro fica")
const dirtyUrlFunnel = emptySalesFunnel("url-suja")
dirtyUrlFunnel.status = "active"
const dirtyNodes = dirtyUrlFunnel.nodes.map((node) =>
  node.type === "offer" ? { ...node, data: { ...node.data, url: "javascript:alert(1)" } } : node
)
dirtyUrlFunnel.production = {
  name: dirtyUrlFunnel.name,
  publishedAt: "2099-09-21T00:00:00.000Z",
  nodes: dirtyNodes,
  edges: dirtyUrlFunnel.edges,
}
const dirtyUrlRes = await handleRequest(
  new Request("http://local.test/api/crm", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: liveCookie },
    body: JSON.stringify({ funnels: [dirtyUrlFunnel] }),
  }),
  liveEnv,
  backgroundCtx()
)
assert(dirtyUrlRes.status === 400, "CRM recusa publicar javascript:")
const dirtyUrlBody = (await dirtyUrlRes.json()) as { error?: string }
assert(dirtyUrlBody.error?.includes("inválido"), "CRM diz o link inválido")
const afterDirtyUrl = (await (
  await handleRequest(new Request("http://local.test/api/crm", { headers: { cookie: liveCookie } }), liveEnv, backgroundCtx())
).json()) as { funnels?: Array<{ id?: string }> }
assert(!afterDirtyUrl.funnels?.some((item) => item.id === dirtyUrlFunnel.id), "quadro com javascript: não entra no KV")
assert(afterDirtyUrl.funnels?.some((item) => item.id === latestPub.id), "recusar o link sujo não apaga o publicado")
const freshMemory = lead("mem-1")
freshMemory.memory = "guarda"
freshMemory.updatedAt = "2026-06-02T00:00:00.000Z"
const staleCreate = { ...freshMemory, memory: "", updatedAt: "2026-06-01T00:00:00.000Z" }
assert(
  (
    await handleRequest(
      new Request("http://local.test/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: liveCookie },
        body: JSON.stringify({ lead: freshMemory }),
      }),
      liveEnv,
      backgroundCtx()
    )
  ).status === 200,
  "POST lead com memória"
)
assert(
  (
    await handleRequest(
      new Request("http://local.test/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: liveCookie },
        body: JSON.stringify({ lead: staleCreate }),
      }),
      liveEnv,
      backgroundCtx()
    )
  ).status === 200,
  "POST lead atrasado é 200"
)
assert((await loadLead(liveEnv.AUTH, "mem-1"))?.memory === "guarda", "POST antigo não apaga a memória")
const newerBlank = { ...freshMemory, memory: "", updatedAt: "2026-06-03T00:00:00.000Z" }
assert(
  (
    await handleRequest(
      new Request("http://local.test/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: liveCookie },
        body: JSON.stringify({ lead: newerBlank }),
      }),
      liveEnv,
      backgroundCtx()
    )
  ).status === 200,
  "POST lead mais novo sem memória é 200"
)
assert((await loadLead(liveEnv.AUTH, "mem-1"))?.memory === "guarda", "POST novo sem memória não apaga a nota")
const telegramPanel = lead("tg-panel", "@tgpanel")
telegramPanel.telegramChatId = "9001"
telegramPanel.waitUntil = "2026-09-21T00:00:00.000Z"
telegramPanel.stage = "welcome"
telegramPanel.memory = "nota"
telegramPanel.updatedAt = "2026-06-04T00:00:00.000Z"
assert(
  (
    await handleRequest(
      new Request("http://local.test/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: liveCookie },
        body: JSON.stringify({ lead: telegramPanel }),
      }),
      liveEnv,
      backgroundCtx()
    )
  ).status === 200,
  "POST lead do Telegram"
)
assert(
  (
    await handleRequest(
      new Request("http://local.test/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: liveCookie },
        body: JSON.stringify({
          lead: {
            ...telegramPanel,
            waitUntil: undefined,
            stage: "offer",
            printAt: "2026-09-22T00:00:00.000Z",
            memory: "nova",
            temperature: "quente",
            updatedAt: "2026-09-22T00:00:00.000Z",
          },
        }),
      }),
      liveEnv,
      backgroundCtx()
    )
  ).status === 200,
  "POST da ficha no chat real é 200"
)
const afterPanel = await loadLead(liveEnv.AUTH, "tg-panel")
assert(afterPanel?.waitUntil === telegramPanel.waitUntil, "POST da ficha não come a espera do Telegram")
assert(afterPanel?.stage === "welcome", "POST da ficha não muda o passo")
assert(!afterPanel?.printAt, "POST da ficha não marca print")
assert(afterPanel?.memory === "nova", "POST da ficha grava a nota")
assert(afterPanel?.temperature === "quente", "POST da ficha grava a temperatura")
const importedPanel = lead("imp-panel", "+5511999000222")
importedPanel.channel = "whatsapp"
importedPanel.origin = "import"
importedPanel.stage = "capture"
importedPanel.memory = "nota import"
importedPanel.updatedAt = "2026-06-04T00:00:00.000Z"
assert(
  (
    await handleRequest(
      new Request("http://local.test/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: liveCookie },
        body: JSON.stringify({ lead: importedPanel }),
      }),
      liveEnv,
      backgroundCtx()
    )
  ).status === 200,
  "POST lead importado"
)
assert(
  (
    await handleRequest(
      new Request("http://local.test/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: liveCookie },
        body: JSON.stringify({
          lead: {
            ...importedPanel,
            waitUntil: undefined,
            stage: "offer",
            printAt: "2026-09-22T00:00:00.000Z",
            memory: "nova import",
            temperature: "quente",
            updatedAt: "2026-09-22T00:00:00.000Z",
          },
        }),
      }),
      liveEnv,
      backgroundCtx()
    )
  ).status === 200,
  "POST da ficha no import é 200"
)
const afterImportPanel = await loadLead(liveEnv.AUTH, "imp-panel")
assert(afterImportPanel?.stage === "capture", "POST da ficha não muda o passo do import")
assert(!afterImportPanel?.printAt, "POST da ficha não marca print no import")
assert(afterImportPanel?.memory === "nova import", "POST da ficha grava a nota do import")
assert(afterImportPanel?.temperature === "quente", "POST da ficha grava a temperatura do import")
const chatLead = lead("chat-1", "@chatmerge")
chatLead.messages = [
  { id: "cm-1", at: "2026-06-01T00:00:00.000Z", role: "ste", text: "oi" },
  { id: "cm-2", at: "2026-06-01T00:01:00.000Z", role: "lead", text: "já jogo" },
]
chatLead.updatedAt = "2026-06-01T00:01:00.000Z"
assert(
  (
    await handleRequest(
      new Request("http://local.test/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: liveCookie },
        body: JSON.stringify({ lead: chatLead }),
      }),
      liveEnv,
      backgroundCtx()
    )
  ).status === 200,
  "POST lead com duas falas"
)
const staleChat = {
  ...chatLead,
  updatedAt: "2026-06-02T00:00:00.000Z",
  temperature: "quente" as const,
  messages: [chatLead.messages[0]!],
}
assert(
  (
    await handleRequest(
      new Request("http://local.test/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: liveCookie },
        body: JSON.stringify({ lead: staleChat }),
      }),
      liveEnv,
      backgroundCtx()
    )
  ).status === 200,
  "POST mais novo com chat incompleto é 200"
)
const storedChat = await loadLead(liveEnv.AUTH, "chat-1")
assert(storedChat?.temperature === "quente", "temperatura nova entra")
assert(storedChat?.messages?.map((item) => item.id).join(",") === "cm-1,cm-2", "POST incompleto não apaga a fala do Telegram")
const lateChat = {
  ...chatLead,
  updatedAt: "2026-05-01T00:00:00.000Z",
  temperature: "novo" as const,
  messages: [
    ...chatLead.messages,
    { id: "cm-3", at: "2026-06-01T00:02:00.000Z", role: "ste" as const, text: "minicurso" },
  ],
}
assert(
  (
    await handleRequest(
      new Request("http://local.test/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: liveCookie },
        body: JSON.stringify({ lead: lateChat }),
      }),
      liveEnv,
      backgroundCtx()
    )
  ).status === 200,
  "POST atrasado com fala nova é 200"
)
const afterLate = await loadLead(liveEnv.AUTH, "chat-1")
assert(afterLate?.temperature === "quente", "POST atrasado não reverte a temperatura")
assert(afterLate?.messages?.some((item) => item.id === "cm-3"), "fala nova do Telegram entra com updatedAt velho")
const newerTalk = {
  ...afterLate!,
  updatedAt: "2026-06-05T00:00:00.000Z",
  temperature: "novo" as const,
  printAt: undefined,
  messages: [
    ...(afterLate?.messages ?? []),
    { id: "cm-4", at: "2026-06-05T00:00:00.000Z", role: "ste" as const, text: "superbet" },
  ],
}
assert(
  (
    await handleRequest(
      new Request("http://local.test/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: liveCookie },
        body: JSON.stringify({ lead: newerTalk }),
      }),
      liveEnv,
      backgroundCtx()
    )
  ).status === 200,
  "POST mais novo só com fala nova é 200"
)
const afterTalk = await loadLead(liveEnv.AUTH, "chat-1")
assert(afterTalk?.temperature === "quente", "webhook mais novo não arrefece o lead")
assert(afterTalk?.messages?.some((item) => item.id === "cm-4"), "fala do webhook mais novo entra")
assert((await handleRequest(new Request("http://local.test/api/leads?id=", { method: "DELETE", headers: { cookie: liveCookie } }), liveEnv, backgroundCtx())).status === 400, "DELETE sem id é 400")
assert(
  (
    await handleRequest(
      new Request(`http://local.test/api/leads?id=${"x".repeat(81)}`, { method: "DELETE", headers: { cookie: liveCookie } }),
      liveEnv,
      backgroundCtx()
    )
  ).status === 400,
  "DELETE com id longo é 400"
)
const zombie = lead("zombie", "@zombie")
zombie.memory = "apagar"
const zombieCreate = await handleRequest(
  new Request("http://local.test/api/leads", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: liveCookie },
    body: JSON.stringify({ lead: zombie }),
  }),
  liveEnv,
  backgroundCtx()
)
const zombieCreated = (await zombieCreate.json()) as { ok?: boolean; saved?: number; ids?: string[] }
assert(zombieCreate.status === 200 && zombieCreated.saved === 1 && zombieCreated.ids?.join() === "zombie", "POST cria o lead e devolve o id gravado")
assert(
  (
    await handleRequest(
      new Request("http://local.test/api/leads?id=zombie", { method: "DELETE", headers: { cookie: liveCookie } }),
      liveEnv,
      backgroundCtx()
    )
  ).status === 200,
  "DELETE do lead tombstoneia"
)
assert((await loadLead(liveEnv.AUTH, "zombie")) === null, "lead apagado some do KV")
assert((await loadRemovedLeadIds(liveEnv.AUTH)).includes("zombie"), "DELETE grava tombstone")
const delUnreadKv = memoryKv()
await upsertLeadKv(delUnreadKv, lead("del-keep", "@delkeep"))
await upsertLeadKv(delUnreadKv, lead("del-pg", "@delpg"))
const delUnreadEnv = {
  ASSETS: { fetch: async () => new Response("ok") },
  SUPABASE_URL: "https://sb.test",
  SUPABASE_SERVICE_ROLE: "role",
  AUTH: delUnreadKv,
  ABILION_ENV: "development",
} as Env
const delUnreadLogin = await handleRequest(
  new Request("http://local.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "victor@abilion.com", password: "senhaok" }),
  }),
  delUnreadEnv,
  backgroundCtx()
)
assert(delUnreadLogin.status === 200, "login para o DELETE unread")
const delUnreadCookie = delUnreadLogin.headers.get("set-cookie") || ""
const delUnreadPrev = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (String(input).includes("/rest/v1/")) throw new Error("postgres down")
  return delUnreadPrev(input, init)
}) as typeof fetch
try {
  const delUnread = await handleRequest(
    new Request("http://local.test/api/leads?id=del-pg", { method: "DELETE", headers: { cookie: delUnreadCookie } }),
    delUnreadEnv,
    backgroundCtx()
  )
  const delUnreadBody = (await delUnread.json()) as { error?: string; ok?: boolean }
  assert(delUnread.status === 503 && delUnreadBody.error?.includes("Postgres"), "DELETE com backup unread não mente ok")
  assert(delUnreadBody.ok !== true, "503 do DELETE não devolve ok")
  assert(await isLeadRemoved(delUnreadKv, "del-pg"), "DELETE falho ainda tombstoneia o KV")
  assert((await loadLead(delUnreadKv, "del-pg")) === null, "DELETE falho tira o lead do KV")
  const delUnreadList = (await (
    await handleRequest(new Request("http://local.test/api/leads", { headers: { cookie: delUnreadCookie } }), delUnreadEnv, backgroundCtx())
  ).json()) as { leads?: Array<{ id?: string }> }
  assert(!delUnreadList.leads?.some((item) => item.id === "del-pg"), "GET não ressuscita o lead com tombstone")
  assert(delUnreadList.leads?.some((item) => item.id === "del-keep"), "GET ainda vê o outro lead do KV")
} finally {
  globalThis.fetch = delUnreadPrev
}
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (String(input).includes("/rest/v1/")) return new Response("[]", { status: 200 })
  return delUnreadPrev(input, init)
}) as typeof fetch
try {
  await upsertLeadKv(delUnreadKv, lead("del-ok", "@delok"))
  const delOk = await handleRequest(
    new Request("http://local.test/api/leads?id=del-ok", { method: "DELETE", headers: { cookie: delUnreadCookie } }),
    delUnreadEnv,
    backgroundCtx()
  )
  assert(delOk.status === 200, "DELETE confirma quando o Postgres apaga")
  assert(await isLeadRemoved(delUnreadKv, "del-ok"), "DELETE ok tombstoneia")
} finally {
  globalThis.fetch = delUnreadPrev
}
const inboxRemoved = (await (
  await handleRequest(new Request("http://local.test/api/inbox", { headers: { cookie: liveCookie } }), liveEnv, backgroundCtx())
).json()) as { removed?: string[] }
assert(inboxRemoved.removed?.includes("zombie"), "GET inbox da primeira página manda o tombstone")
const inboxCursorGone = (await (
  await handleRequest(
    new Request("http://local.test/api/inbox?cursor=2026-01-01T00:00:00.000Z%7Czombie", { headers: { cookie: liveCookie } }),
    liveEnv,
    backgroundCtx()
  )
).json()) as { removed?: string[] }
assert(inboxCursorGone.removed === undefined, "GET inbox com cursor não remete a lista de tombstones")
assert(
  (
    await handleRequest(
      new Request("http://local.test/api/leads?cursor=broken", { headers: { cookie: liveCookie } }),
      liveEnv,
      backgroundCtx()
    )
  ).status === 400,
  "GET leads com cursor inválido é 400"
)
assert(
  (
    await handleRequest(
      new Request("http://local.test/api/inbox?cursor=broken", { headers: { cookie: liveCookie } }),
      liveEnv,
      backgroundCtx()
    )
  ).status === 400,
  "GET inbox com cursor inválido é 400"
)
const inboxHome = await handleRequest(
  new Request("http://local.test/"),
  {
    ...liveEnv,
    ASSETS: {
      fetch: async () => new Response("<!doctype html>", { headers: { "content-type": "text/html; charset=utf-8" } }),
    },
  } as Env,
  backgroundCtx()
)
const homeCsp = inboxHome.headers.get("content-security-policy") || ""
assert(/script-src 'self'(?:;|$)/.test(homeCsp), "CSP do HTML só permite script do próprio origin")
assert(homeCsp.includes("style-src 'self' 'unsafe-inline'"), "CSP ainda precisa de style inline")
const zombieBack = await handleRequest(
  new Request("http://local.test/api/leads", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: liveCookie },
    body: JSON.stringify({ lead: { ...zombie, memory: "ressuscita", updatedAt: new Date().toISOString() } }),
  }),
  liveEnv,
  backgroundCtx()
)
const zombieSaved = (await zombieBack.json()) as { ok?: boolean; saved?: number; ids?: string[] }
assert(zombieBack.status === 200 && zombieSaved.saved === 0 && (zombieSaved.ids?.length ?? 1) === 0, "POST depois do DELETE não conta o lead apagado")
assert((await loadLead(liveEnv.AUTH, "zombie")) === null, "POST atrasado não ressuscita lead apagado")
assert((await loadRemovedLeadIds(liveEnv.AUTH)).includes("zombie"), "POST atrasado não limpa o tombstone")
const listedAfterZombie = (await (
  await handleRequest(new Request("http://local.test/api/leads", { headers: { cookie: liveCookie } }), liveEnv, backgroundCtx())
).json()) as { leads?: Array<{ id?: string }>; removed?: string[]; clipped?: boolean }
assert(!listedAfterZombie.leads?.some((item) => item.id === "zombie"), "GET não devolve lead tombstoned")
assert(listedAfterZombie.removed?.includes("zombie"), "GET inclui o id apagado nos tombstones")
assert(!listedAfterZombie.clipped, "índice pequeno não marca recorte")
const lookCreate = await handleRequest(
  new Request("http://local.test/api/leads", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: liveCookie },
    body: JSON.stringify({ lead: lookLead }),
  }),
  liveEnv,
  backgroundCtx()
)
assert(lookCreate.status === 200, "POST do lead da busca")
const canonCreate = await handleRequest(
  new Request("http://local.test/api/leads", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: liveCookie },
    body: JSON.stringify({ lead: lead("canon-live", "@canon") }),
  }),
  liveEnv,
  backgroundCtx()
)
assert(canonCreate.status === 200, "POST do lead canónico")
const canonRematch = await handleRequest(
  new Request("http://local.test/api/leads", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: liveCookie },
    body: JSON.stringify({ lead: lead("canon-phantom", "@canon") }),
  }),
  liveEnv,
  backgroundCtx()
)
const canonBody = (await canonRematch.json()) as { ids?: string[]; adopted?: Record<string, string> }
assert(canonRematch.status === 200 && canonBody.ids?.includes("canon-live"), "POST devolve o id canónico")
assert(canonBody.adopted?.["canon-phantom"] === "canon-live", "POST mapeia o id local para o canónico")
assert((await listLeads(liveEnv.AUTH, 20, "all")).filter((item) => item.contact === "@canon").length === 1, "POST rematch não cria segunda ficha")
const lookQuery = await handleRequest(
  new Request("http://local.test/api/leads?q=@lookme", { headers: { cookie: liveCookie } }),
  liveEnv,
  backgroundCtx()
)
const lookFound = (await lookQuery.json()) as { leads?: Array<{ id?: string }> }
assert(lookQuery.status === 200 && lookFound.leads?.some((item) => item.id === "look-me"), "GET ?q= encontra pelo @user")
assert(
  (
    await handleRequest(
      new Request(`http://local.test/api/leads?q=${"x".repeat(81)}`, { headers: { cookie: liveCookie } }),
      liveEnv,
      backgroundCtx()
    )
  ).status === 400,
  "GET ?q= longo é 400"
)
const zombieQuery = (await (
  await handleRequest(new Request("http://local.test/api/leads?q=@zombie", { headers: { cookie: liveCookie } }), liveEnv, backgroundCtx())
).json()) as { leads?: Array<{ id?: string }> }
assert(!zombieQuery.leads?.some((item) => item.id === "zombie"), "GET ?q= não ressuscita tombstone")
const hugeCrm = await handleRequest(
  new Request("http://local.test/api/crm", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: liveCookie },
    body: JSON.stringify({ funnels: [{ id: "x", name: "y".repeat(260_000), nodes: [], edges: [] }] }),
  }),
  liveEnv,
  backgroundCtx()
)
assert(hugeCrm.status === 413, "CRM recusa corpo enorme")
const badCrm = await handleRequest(
  new Request("http://local.test/api/crm", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: liveCookie },
    body: "{nao-e-json",
  }),
  liveEnv,
  backgroundCtx()
)
assert(badCrm.status === 400, "CRM recusa JSON inválido")
const brokenCrm = await handleRequest(
  new Request("http://local.test/api/crm", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: liveCookie },
    body: JSON.stringify({
      funnels: [
        {
          id: "funil-broken-node",
          name: "Ok",
          nodes: [{ type: "message" }, { id: "n1", type: "message", position: { x: 0, y: 0 }, data: { title: "Oi" } }],
          edges: [],
        },
      ],
    }),
  }),
  liveEnv,
  backgroundCtx()
)
assert(brokenCrm.status === 200, "CRM com nó sem id continua 200")
const badLogin = await handleRequest(
  new Request("http://local.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{nao-e-json",
  }),
  liveEnv,
  backgroundCtx()
)
assert(badLogin.status === 400, "login recusa JSON inválido")
const voiceReq = () =>
  handleRequest(
    new Request("http://local.test/api/runtime/voice", { method: "POST", headers: { cookie: liveCookie } }),
    liveEnv,
    backgroundCtx()
  )
for (let i = 0; i < 5; i++) assert((await voiceReq()).status === 400, `voz ${i + 1} ainda entra no throttle`)
assert((await voiceReq()).status === 429, "sexta geração de voz bloqueia")
const pixel = await handleRequest(
  new Request("http://local.test/api/track", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind: "view", visitorId: "aabbcc" }),
  }),
  liveEnv,
  backgroundCtx()
)
assert(pixel.status === 204, "pixel público grava")
const tracker = await handleRequest(new Request("http://local.test/t.js"), liveEnv, backgroundCtx())
assert(tracker.status === 200, "t.js público")
assert(tracker.headers.get("x-content-type-options") === "nosniff", "t.js tem nosniff")
assert(tracker.headers.get("cache-control") === "public, max-age=60", "t.js não fica 5 minutos velho")
assert(tracker.headers.get("strict-transport-security")?.includes("max-age=31536000"), "t.js manda HSTS")
const trackerBody = await tracker.text()
assert(trackerBody.includes("/api/track"), "t.js aponta o pixel")
assert(trackerBody.includes("joinchat"), "t.js não reescreve convite de grupo")
const landingBare = await handleRequest(
  new Request("http://local.test/l"),
  {
    ...liveEnv,
    ASSETS: {
      fetch: async () => {
        throw new Error("assets down")
      },
    },
  } as Env,
  backgroundCtx()
)
assert(landingBare.status === 200, "GET /l não depende dos assets")
assert((landingBare.headers.get("content-type") || "").includes("text/html"), "GET /l é HTML")
assert((landingBare.headers.get("content-security-policy") || "").includes("script-src 'self'"), "GET /l leva CSP")
const landingBareHtml = await landingBare.text()
assert(landingBareHtml.includes("/t.js?v=2") && landingBareHtml.includes("ainda não está ligado"), "GET /l sem bot ainda serve o pixel")
assert(!landingBareHtml.includes("<a data-abilion-cta"), "GET /l sem username não inventa CTA")
const kvDownLanding = await handleRequest(
  new Request("http://local.test/l"),
  {
    ASSETS: { fetch: async () => new Response("ok") },
    AUTH: {
      async get() {
        throw new Error("kv down")
      },
      async put() {},
    },
  } as Env,
  backgroundCtx()
)
const kvDownHtml = await kvDownLanding.text()
assert(kvDownLanding.status === 200 && kvDownHtml.includes("/t.js"), "GET /l com KV em baixo ainda serve o pixel")
assert(kvDownHtml.includes("Não confirmei o Telegram"), "GET /l catch não diz que o bot não está ligado")
assert(!kvDownHtml.includes("ainda não está ligado"), "GET /l catch não usa a cópia de bot desligado")
assert(!kvDownHtml.includes("<a data-abilion-cta"), "GET /l catch sem username não inventa CTA")
const kvDownHealth = await handleRequest(
  new Request("http://local.test/api/health"),
  {
    ASSETS: { fetch: async () => new Response("ok") },
    AUTH: {
      async get() {
        throw new Error("kv down")
      },
      async put() {},
    },
  } as Env,
  backgroundCtx()
)
const kvDownHealthBody = (await kvDownHealth.json()) as {
  ok?: boolean
  telegramBotUsername?: string
  telegramBotUnread?: boolean
}
assert(kvDownHealth.status === 200 && kvDownHealthBody.ok, "GET /api/health com KV em baixo continua de pé")
assert(kvDownHealthBody.telegramBotUnread === true && !kvDownHealthBody.telegramBotUsername, "health KV throw não finge bot desligado")
assert(!("telegram" in kvDownHealthBody) && !("llm" in kvDownHealthBody), "health KV throw não expõe o runtime")
const kvDownInstall = await handleRequest(
  new Request("http://local.test/api/install"),
  {
    ASSETS: { fetch: async () => new Response("ok") },
    AUTH: {
      async get() {
        throw new Error("kv down")
      },
      async put() {},
    },
  } as Env,
  backgroundCtx()
)
const kvDownInstallBody = (await kvDownInstall.json()) as { ok?: boolean; steps?: unknown[]; script?: { id?: string } }
assert(kvDownInstall.status === 200 && kvDownInstallBody.ok, "GET /api/install com KV em baixo continua o manual geral")
assert((kvDownInstallBody.steps?.length ?? 0) >= 5, "manual geral KV throw ainda tem os passos")
assert(!kvDownInstallBody.script, "install KV throw não inventa script")
const kvDownInstallMiss = await handleRequest(
  new Request("http://local.test/api/install?s=deadbeef"),
  {
    ASSETS: { fetch: async () => new Response("ok") },
    AUTH: {
      async get() {
        throw new Error("kv down")
      },
      async put() {},
    },
  } as Env,
  backgroundCtx()
)
assert(kvDownInstallMiss.status === 503, "GET /api/install?s= com KV em baixo não finge script em falta")
assert(
  ((await kvDownInstallMiss.json()) as { error?: string }).error === "Não confirmei o script desta página.",
  "install KV throw + s= pede confirmação"
)
const kvDownInstallBad = await handleRequest(
  new Request("http://local.test/api/install?s=nao-e-id"),
  {
    ASSETS: { fetch: async () => new Response("ok") },
    AUTH: {
      async get() {
        throw new Error("kv down")
      },
      async put() {},
    },
  } as Env,
  backgroundCtx()
)
assert(kvDownInstallBad.status === 200, "s= inválido com KV em baixo não é 503")
const runtimeHoleKv = memoryKv()
const runtimeHoleBase = {
  ASSETS: { fetch: async () => new Response("ok") },
  AUTH: runtimeHoleKv,
  ABILION_ENV: "development",
} as Env
const runtimeHoleLogin = await handleRequest(
  new Request("http://local.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "victor@abilion.com", password: "senhaok" }),
  }),
  runtimeHoleBase,
  backgroundCtx()
)
assert(runtimeHoleLogin.status === 200, "login no KV do runtime hole")
const runtimeHoleCookie = runtimeHoleLogin.headers.get("set-cookie") || ""
await saveSettingsKv(runtimeHoleKv, migrateSettings({ telegramBotUsername: "@steaviator" }))
await saveSecrets(runtimeHoleKv, { telegramBotToken: "000:kv-token" })
const secretsSettingsDownEnv = {
  ...runtimeHoleBase,
  AUTH: kvThrowsOn(runtimeHoleKv, CRM_SETTINGS, RUNTIME_KEY),
  TELEGRAM_BOT_TOKEN: "000:env-token",
} as Env
const kvDownRuntime = await handleRequest(
  new Request("http://local.test/api/runtime", { headers: { cookie: runtimeHoleCookie } }),
  secretsSettingsDownEnv,
  backgroundCtx()
)
const kvDownRuntimeBody = (await kvDownRuntime.json()) as {
  ok?: boolean
  telegram?: boolean
  telegramBotUsername?: string
  settingsUnread?: boolean
  tokenHint?: string
}
assert(kvDownRuntime.status === 200 && kvDownRuntimeBody.ok, "GET /api/runtime com settings/secrets a falhar continua de pé")
assert(kvDownRuntimeBody.settingsUnread === true, "runtime KV throw marca settings unread")
assert(kvDownRuntimeBody.telegram === true, "runtime KV throw ainda lê o token do env")
assert(!kvDownRuntimeBody.telegramBotUsername, "runtime KV throw não inventa username")
assert(!JSON.stringify(kvDownRuntimeBody).includes("000:env-token"), "runtime KV throw não vaza o token do env")
const secretsOnlyDownEnv = {
  ...runtimeHoleBase,
  AUTH: kvThrowsOn(runtimeHoleKv, RUNTIME_KEY),
} as Env
const secretsOnlyRuntime = await handleRequest(
  new Request("http://local.test/api/runtime", { headers: { cookie: runtimeHoleCookie } }),
  secretsOnlyDownEnv,
  backgroundCtx()
)
const secretsOnlyRuntimeBody = (await secretsOnlyRuntime.json()) as {
  ok?: boolean
  telegram?: boolean
  telegramBotUsername?: string
  settingsUnread?: boolean
}
assert(secretsOnlyRuntime.status === 200 && secretsOnlyRuntimeBody.ok, "GET runtime com secrets a falhar ainda lê settings")
assert(secretsOnlyRuntimeBody.telegramBotUsername === "@steaviator", "runtime secrets throw não apaga o username leftover")
assert(!secretsOnlyRuntimeBody.settingsUnread, "settings leftover confirmadas não ficam unread por causa dos secrets")
assert(secretsOnlyRuntimeBody.telegram !== true, "sem token no env o runtime não finge bot ligado")
const kvDownRuntimePost = await handleRequest(
  new Request("http://local.test/api/runtime", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: runtimeHoleCookie,
      "x-forwarded-for": "203.0.113.90",
    },
    body: JSON.stringify({ telegramBotUsername: "@ste_novo", telegramBotToken: "111:should-not-save" }),
  }),
  secretsOnlyDownEnv,
  backgroundCtx()
)
const kvDownRuntimePostBody = (await kvDownRuntimePost.json()) as { error?: string; ok?: boolean }
assert(kvDownRuntimePost.status === 503, "POST /api/runtime KV throw não cai em 500")
assert(kvDownRuntimePostBody.error === "Não confirmei as chaves do Worker.", "POST runtime KV throw pede confirmação")
assert(kvDownRuntimePostBody.error !== "Falha interna.", "POST runtime KV throw não vira Falha interna")
assert(kvDownRuntimePostBody.ok !== true, "POST runtime KV throw não finge gravado")
assert((await loadSecrets(runtimeHoleKv)).telegramBotToken === "000:kv-token", "POST runtime KV throw não apaga o token leftover")
assert((await loadSecrets(runtimeHoleKv)).telegramBotUsername !== "@ste_novo", "POST runtime KV throw não grava username em cima do unread")
const putDownRuntimePost = await handleRequest(
  new Request("http://local.test/api/runtime", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: runtimeHoleCookie,
      "x-forwarded-for": "203.0.113.91",
    },
    body: JSON.stringify({ telegramBotUsername: "@ste_put" }),
  }),
  { ...runtimeHoleBase, AUTH: kvThrowsOnPut(runtimeHoleKv, RUNTIME_KEY) } as Env,
  backgroundCtx()
)
const putDownRuntimePostBody = (await putDownRuntimePost.json()) as { error?: string; ok?: boolean }
assert(putDownRuntimePost.status === 503, "POST runtime put throw não cai em 500")
assert(putDownRuntimePostBody.error === "Não confirmei as chaves do Worker.", "POST runtime put throw pede confirmação")
assert((await loadSecrets(runtimeHoleKv)).telegramBotToken === "000:kv-token", "POST runtime put throw não pisa o token leftover")
assert((await loadSecrets(runtimeHoleKv)).telegramBotUsername !== "@ste_put", "POST runtime put throw não grava username")
const throttleDownRuntimePost = await handleRequest(
  new Request("http://local.test/api/runtime", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: runtimeHoleCookie,
      "x-forwarded-for": "203.0.113.92",
    },
    body: JSON.stringify({ telegramBotUsername: "@ste_limite" }),
  }),
  { ...runtimeHoleBase, AUTH: kvThrowsOn(runtimeHoleKv, "track:throttles") } as Env,
  backgroundCtx()
)
const throttleDownRuntimePostBody = (await throttleDownRuntimePost.json()) as { error?: string }
assert(throttleDownRuntimePost.status === 503, "POST runtime throttle throw não cai em 500")
assert(throttleDownRuntimePostBody.error === "Não confirmei as chaves do Worker.", "POST runtime throttle throw pede confirmação")
assert((await loadSecrets(runtimeHoleKv)).telegramBotUsername !== "@ste_limite", "POST runtime throttle throw não grava")
const voiceDownRuntimePost = await handleRequest(
  new Request("http://local.test/api/runtime", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: runtimeHoleCookie,
      "x-forwarded-for": "203.0.113.93",
    },
    body: JSON.stringify({ telegramBotUsername: "@ste_voz" }),
  }),
  { ...runtimeHoleBase, AUTH: kvThrowsOn(runtimeHoleKv, VOICE_STORE_KEY) } as Env,
  backgroundCtx()
)
const voiceDownRuntimePostBody = (await voiceDownRuntimePost.json()) as {
  ok?: boolean
  telegram?: boolean
  telegramBotUsername?: string
  error?: string
}
assert(voiceDownRuntimePost.status === 200 && voiceDownRuntimePostBody.ok, "POST runtime com voz unread continua de pé")
assert(voiceDownRuntimePostBody.telegram === true, "POST runtime voz unread ainda lê o token leftover")
assert(voiceDownRuntimePostBody.telegramBotUsername === "@ste_voz", "POST runtime voz unread devolve o username gravado")
assert(voiceDownRuntimePostBody.error !== "Falha interna.", "POST runtime voz unread não vira Falha interna")
assert((await loadSecrets(runtimeHoleKv)).telegramBotToken === "000:kv-token", "POST runtime voz unread não apaga o token leftover")
assert((await loadSecrets(runtimeHoleKv)).telegramBotUsername === "@ste_voz", "POST runtime voz unread grava o username")
await saveSecrets(runtimeHoleKv, {
  elevenApiKey: "sk_leftover",
  elevenVoiceId: "voice_leftover",
})
let elevenHits = 0
const elevenLabsFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (String(input).includes("api.elevenlabs.io")) {
    elevenHits += 1
    return new Response("blocked", { status: 500 })
  }
  return elevenLabsFetch(input, init)
}) as typeof fetch
const voicePostOf = (ip: string, env: Env) =>
  handleRequest(
    new Request("http://local.test/api/runtime/voice", {
      method: "POST",
      headers: { cookie: runtimeHoleCookie, "x-forwarded-for": ip },
    }),
    env,
    backgroundCtx()
  )
const kvDownVoicePost = await voicePostOf("203.0.113.94", secretsOnlyDownEnv)
const kvDownVoicePostBody = (await kvDownVoicePost.json()) as { error?: string; ok?: boolean }
assert(kvDownVoicePost.status === 503, "POST /api/runtime/voice KV throw não cai em 500")
assert(kvDownVoicePostBody.error === "Não confirmei as chaves do Worker.", "POST voice KV throw pede confirmação")
assert(kvDownVoicePostBody.error !== "Falta a chave da ElevenLabs e o voice id da Sté.", "POST voice KV throw não finge chave em falta")
assert(kvDownVoicePostBody.error !== "Falha interna.", "POST voice KV throw não vira Falha interna")
assert(elevenHits === 0, "POST voice KV throw não gasta ElevenLabs")
assert((await loadSecrets(runtimeHoleKv)).elevenApiKey === "sk_leftover", "POST voice KV throw não apaga a chave leftover")
assert((await loadSecrets(runtimeHoleKv)).elevenVoiceId === "voice_leftover", "POST voice KV throw não apaga o voice id leftover")
const throttleDownVoicePost = await voicePostOf(
  "203.0.113.95",
  { ...runtimeHoleBase, AUTH: kvThrowsOn(runtimeHoleKv, "track:throttles") } as Env
)
const throttleDownVoicePostBody = (await throttleDownVoicePost.json()) as { error?: string }
assert(throttleDownVoicePost.status === 503, "POST voice throttle throw não cai em 500")
assert(throttleDownVoicePostBody.error === "Não confirmei as chaves do Worker.", "POST voice throttle throw pede confirmação")
assert(elevenHits === 0, "POST voice throttle throw não gasta ElevenLabs")
const storeDownVoicePost = await voicePostOf(
  "203.0.113.96",
  { ...runtimeHoleBase, AUTH: kvThrowsOn(runtimeHoleKv, VOICE_STORE_KEY) } as Env
)
const storeDownVoicePostBody = (await storeDownVoicePost.json()) as { error?: string }
assert(storeDownVoicePost.status === 503, "POST voice store throw não cai em 400 da ElevenLabs")
assert(storeDownVoicePostBody.error === "Não confirmei a voz do Worker.", "POST voice store throw pede confirmação da voz")
assert(
  storeDownVoicePostBody.error !== "A ElevenLabs não gerou os áudios. Confere a chave e o voice id.",
  "POST voice store throw não culpa a ElevenLabs"
)
assert(elevenHits === 0, "POST voice store throw não gasta ElevenLabs")
assert((await loadSecrets(runtimeHoleKv)).elevenApiKey === "sk_leftover", "POST voice store throw não pisa a chave leftover")
globalThis.fetch = elevenLabsFetch
const throttleDownEnv = { ...runtimeHoleBase, AUTH: kvThrowsOn(runtimeHoleKv, "track:throttles") } as Env
const throttleDownMcp = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: runtimeHoleCookie, "x-forwarded-for": "203.0.113.97" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 214,
      method: "tools/call",
      params: { name: "abilion_health", arguments: {} },
    }),
  }),
  throttleDownEnv,
  backgroundCtx()
)
const throttleDownMcpBody = (await throttleDownMcp.json()) as { error?: string; result?: { isError?: boolean } }
assert(throttleDownMcp.status === 503, "MCP throttle throw não cai em 500")
assert(throttleDownMcpBody.error === "Não confirmei o limite de pedidos.", "MCP throttle throw pede confirmação")
assert(throttleDownMcpBody.error !== "Demasiados pedidos MCP. Espera um pouco.", "MCP throttle throw não finge 429")
assert(throttleDownMcpBody.error !== "Falha interna.", "MCP throttle throw não vira Falha interna")
assert(!throttleDownMcpBody.result, "MCP throttle throw não entra na ferramenta")
const throttleDownCrm = await handleRequest(
  new Request("http://local.test/api/crm", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: runtimeHoleCookie,
      "x-forwarded-for": "203.0.113.98",
    },
    body: JSON.stringify({ settings: { telegramBotUsername: "@ste_limite" } }),
  }),
  throttleDownEnv,
  backgroundCtx()
)
const throttleDownCrmBody = (await throttleDownCrm.json()) as { error?: string }
assert(throttleDownCrm.status === 503, "POST CRM throttle throw não cai em 500")
assert(throttleDownCrmBody.error === "Não confirmei o limite de pedidos.", "POST CRM throttle throw pede confirmação")
assert((await loadSettingsKv(runtimeHoleKv)).telegramBotUsername !== "@ste_limite", "POST CRM throttle throw não pisa o username leftover")
const throttleDownUsers = await handleRequest(
  new Request("http://local.test/api/users", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: runtimeHoleCookie,
      "x-forwarded-for": "203.0.113.99",
    },
    body: JSON.stringify({ email: "novo@abilion.com", name: "Novo", password: "senhaok" }),
  }),
  throttleDownEnv,
  backgroundCtx()
)
const throttleDownUsersBody = (await throttleDownUsers.json()) as { error?: string }
assert(throttleDownUsers.status === 503, "POST users throttle throw não cai em 500")
assert(throttleDownUsersBody.error === "Não confirmei o limite de pedidos.", "POST users throttle throw pede confirmação")
const usersAfterThrottle = (await (
  await handleRequest(new Request("http://local.test/api/users", { headers: { cookie: runtimeHoleCookie } }), runtimeHoleBase, backgroundCtx())
).json()) as { users?: Array<{ email?: string }> }
assert(!usersAfterThrottle.users?.some((item) => item.email === "novo@abilion.com"), "POST users throttle throw não cria conta")
const throttleDownLeads = await handleRequest(
  new Request("http://local.test/api/leads", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: runtimeHoleCookie,
      "x-forwarded-for": "203.0.113.100",
    },
    body: JSON.stringify({
      lead: { id: "lead-throttle", name: "Throttle", contact: "@throttle", origin: "telegram", status: "new" },
    }),
  }),
  throttleDownEnv,
  backgroundCtx()
)
const throttleDownLeadsBody = (await throttleDownLeads.json()) as { error?: string; saved?: number }
assert(throttleDownLeads.status === 503, "POST leads throttle throw não cai em 500")
assert(throttleDownLeadsBody.error === "Não confirmei o limite de pedidos.", "POST leads throttle throw pede confirmação")
assert(throttleDownLeadsBody.saved !== 1, "POST leads throttle throw não grava")
const throttleDownDelete = await handleRequest(
  new Request("http://local.test/api/leads?id=lead-throttle", {
    method: "DELETE",
    headers: { cookie: runtimeHoleCookie, "x-forwarded-for": "203.0.113.101" },
  }),
  throttleDownEnv,
  backgroundCtx()
)
assert(throttleDownDelete.status === 503, "DELETE leads throttle throw não cai em 500")
assert(((await throttleDownDelete.json()) as { error?: string }).error === "Não confirmei o limite de pedidos.", "DELETE leads throttle throw pede confirmação")
const throttleDownImport = await handleRequest(
  new Request("http://local.test/api/funnels/import", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: runtimeHoleCookie,
      "x-forwarded-for": "203.0.113.102",
    },
    body: JSON.stringify({ name: "Import throttle", payload: { messages: ["Passo A", "Passo B"] } }),
  }),
  throttleDownEnv,
  backgroundCtx()
)
assert(throttleDownImport.status === 503, "POST import throttle throw não cai em 500")
assert(((await throttleDownImport.json()) as { error?: string }).error === "Não confirmei o limite de pedidos.", "POST import throttle throw pede confirmação")
const throttleDownTrack = await handleRequest(
  new Request("http://local.test/api/track", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.103" },
    body: JSON.stringify({ kind: "view", visitorId: "throttlevid" }),
  }),
  throttleDownEnv,
  backgroundCtx()
)
assert(throttleDownTrack.status === 503, "POST pixel throttle throw não cai em 500")
assert(!(await throttleDownTrack.text()).includes("Falha interna."), "POST pixel throttle throw não vaza Falha interna")
const kvDownMcpHealth = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: runtimeHoleCookie },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 210,
      method: "tools/call",
      params: { name: "abilion_health", arguments: {} },
    }),
  }),
  secretsSettingsDownEnv,
  backgroundCtx()
)
const kvDownMcpHealthBody = (await kvDownMcpHealth.json()) as {
  result?: { isError?: boolean; content?: Array<{ text?: string }> }
}
const kvDownMcpHealthData = JSON.parse(kvDownMcpHealthBody.result?.content?.[0]?.text || "{}") as {
  ok?: boolean
  telegramBound?: boolean
  unread?: boolean
  telegramBotUsername?: string
  error?: string
}
assert(kvDownMcpHealth.status === 200 && !kvDownMcpHealthBody.result?.isError && kvDownMcpHealthData.ok, "MCP health KV throw continua de pé")
assert(kvDownMcpHealthData.unread === true && !kvDownMcpHealthData.telegramBotUsername, "MCP health KV throw não finge bot desligado")
assert(kvDownMcpHealthData.telegramBound === true, "MCP health KV throw ainda lê o token do env")
assert(kvDownMcpHealthData.error !== "kv down", "MCP health KV throw não vaza o erro interno")
const kvDownMcpInstall = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: runtimeHoleCookie },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 211,
      method: "tools/call",
      params: { name: "abilion_page_install_manual", arguments: {} },
    }),
  }),
  secretsSettingsDownEnv,
  backgroundCtx()
)
const kvDownMcpInstallBody = (await kvDownMcpInstall.json()) as {
  result?: { isError?: boolean; content?: Array<{ text?: string }> }
}
const kvDownMcpInstallData = JSON.parse(kvDownMcpInstallBody.result?.content?.[0]?.text || "{}") as {
  ok?: boolean
  steps?: unknown[]
  script?: { id?: string }
}
assert(
  kvDownMcpInstall.status === 200 && !kvDownMcpInstallBody.result?.isError && kvDownMcpInstallData.ok,
  "MCP manual geral KV throw continua de pé"
)
assert((kvDownMcpInstallData.steps?.length ?? 0) >= 5, "MCP manual geral KV throw ainda tem os passos")
assert(!kvDownMcpInstallData.script, "MCP manual geral KV throw não inventa script")
const kvDownMcpInstallMiss = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: runtimeHoleCookie },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 212,
      method: "tools/call",
      params: { name: "abilion_page_install_manual", arguments: { scriptId: "deadbeef" } },
    }),
  }),
  secretsSettingsDownEnv,
  backgroundCtx()
)
const kvDownMcpInstallMissBody = (await kvDownMcpInstallMiss.json()) as {
  result?: { isError?: boolean; content?: Array<{ text?: string }> }
}
const kvDownMcpInstallMissData = JSON.parse(kvDownMcpInstallMissBody.result?.content?.[0]?.text || "{}") as { error?: string }
assert(kvDownMcpInstallMiss.status === 200 && kvDownMcpInstallMissBody.result?.isError, "MCP install?s= KV throw não finge script em falta")
assert(kvDownMcpInstallMissData.error === "Não confirmei o script desta página.", "MCP install KV throw pede confirmação do script")
const kvDownMcpInstallRes = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: runtimeHoleCookie },
    body: JSON.stringify({ jsonrpc: "2.0", id: 213, method: "resources/read", params: { uri: "abilion://install/deadbeef" } }),
  }),
  secretsSettingsDownEnv,
  backgroundCtx()
)
const kvDownMcpInstallResBody = (await kvDownMcpInstallRes.json()) as { error?: { message?: string } }
assert(kvDownMcpInstallRes.status === 200, "resources/read KV throw não rebenta o MCP")
assert(
  kvDownMcpInstallResBody.error?.message === "Não confirmei o script desta página.",
  "resources/read KV throw pede o mesmo erro do HTTP"
)
const settingsThrowEnv = { ...runtimeHoleBase, AUTH: kvThrowsOn(runtimeHoleKv, CRM_SETTINGS) } as Env
const settingsThrowMcp = async (id: number, name: string, args: Record<string, unknown> = {}) =>
  handleRequest(
    new Request("http://local.test/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: runtimeHoleCookie, "x-forwarded-for": "203.0.113.110" },
      body: JSON.stringify({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } }),
    }),
    settingsThrowEnv,
    backgroundCtx()
  )
const kvDownMcpSettings = await settingsThrowMcp(220, "abilion_get_settings")
const kvDownMcpSettingsBody = (await kvDownMcpSettings.json()) as {
  result?: { isError?: boolean; content?: Array<{ text?: string }> }
}
const kvDownMcpSettingsData = JSON.parse(kvDownMcpSettingsBody.result?.content?.[0]?.text || "{}") as { error?: string; ok?: boolean }
assert(kvDownMcpSettings.status === 200 && kvDownMcpSettingsBody.result?.isError, "MCP get_settings KV throw não finge settings")
assert(kvDownMcpSettingsData.error === "Não confirmei as definições no Postgres.", "MCP get_settings KV throw pede confirmação")
assert(kvDownMcpSettingsData.error !== "kv down", "MCP get_settings KV throw não vaza o erro interno")
assert(kvDownMcpSettingsData.ok !== true, "MCP get_settings KV throw não devolve settings ocas")
const kvDownMcpScripts = await settingsThrowMcp(221, "abilion_list_page_scripts")
const kvDownMcpScriptsData = JSON.parse(
  ((await kvDownMcpScripts.json()) as { result?: { content?: Array<{ text?: string }> } }).result?.content?.[0]?.text || "{}"
) as { error?: string; scripts?: unknown[] }
assert(kvDownMcpScripts.status === 200, "MCP list_page_scripts KV throw não cai em 500")
assert(kvDownMcpScriptsData.error === "Não confirmei os scripts desta página.", "MCP list_page_scripts KV throw pede confirmação")
assert(!kvDownMcpScriptsData.scripts, "MCP list_page_scripts KV throw não lista scripts vazios")
const throwBoard = {
  ...emptySalesFunnel("Throw"),
  id: "funil-throw",
  production: { name: "Throw", publishedAt: "2026-01-01T00:00:00.000Z", nodes: [], edges: [] },
}
await saveFunnelsKv(runtimeHoleKv, [throwBoard])
const kvDownMcpCreateScript = await settingsThrowMcp(222, "abilion_create_page_script", {
  name: "Landing throw",
  funnelId: "funil-throw",
})
const kvDownMcpCreateScriptData = JSON.parse(
  ((await kvDownMcpCreateScript.json()) as { result?: { content?: Array<{ text?: string }> } }).result?.content?.[0]?.text || "{}"
) as { error?: string; script?: { id?: string } }
assert(kvDownMcpCreateScriptData.error === "Não confirmei os scripts desta página.", "MCP create_page_script KV throw pede confirmação")
assert(!kvDownMcpCreateScriptData.script, "MCP create_page_script KV throw não inventa script")
const kvDownMcpImport = await settingsThrowMcp(223, "abilion_import_leads", { text: "Ana, 11999999999" })
const kvDownMcpImportData = JSON.parse(
  ((await kvDownMcpImport.json()) as { result?: { content?: Array<{ text?: string }> } }).result?.content?.[0]?.text || "{}"
) as { error?: string; imported?: number }
assert(kvDownMcpImportData.error === "Não confirmei as definições no Postgres.", "MCP import KV throw pede confirmação")
assert(kvDownMcpImportData.imported !== 1, "MCP import KV throw não importa")
const settingsBeforeThrow = await loadSettingsKv(runtimeHoleKv)
const kvDownCrmSettings = await handleRequest(
  new Request("http://local.test/api/crm", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: runtimeHoleCookie,
      "x-forwarded-for": "203.0.113.111",
    },
    body: JSON.stringify({ settings: { telegramBotUsername: "@ste_defs" } }),
  }),
  settingsThrowEnv,
  backgroundCtx()
)
const kvDownCrmSettingsBody = (await kvDownCrmSettings.json()) as { error?: string; ok?: boolean }
assert(kvDownCrmSettings.status === 503, "POST CRM settings KV throw não cai em 500")
assert(kvDownCrmSettingsBody.error === "Não confirmei as definições no Postgres.", "POST CRM settings KV throw pede confirmação")
assert(kvDownCrmSettingsBody.error !== "Falha interna.", "POST CRM settings KV throw não vira Falha interna")
assert(kvDownCrmSettingsBody.ok !== true, "POST CRM settings KV throw não finge gravado")
assert((await loadSettingsKv(runtimeHoleKv)).telegramBotUsername === settingsBeforeThrow.telegramBotUsername, "POST CRM settings KV throw não pisa o username leftover")
assert((await loadSettingsKv(runtimeHoleKv)).telegramBotUsername !== "@ste_defs", "POST CRM settings KV throw não grava username unread")
const settingsDownCrmGet = await handleRequest(
  new Request("http://local.test/api/crm", { headers: { cookie: runtimeHoleCookie } }),
  settingsThrowEnv,
  backgroundCtx()
)
const settingsDownCrmGetBody = (await settingsDownCrmGet.json()) as {
  ok?: boolean
  error?: string
  funnels?: Array<{ id?: string }>
  settings?: { telegramBotUsername?: string }
  settingsUnread?: boolean
  funnelsUnread?: boolean
}
assert(settingsDownCrmGet.status === 200 && settingsDownCrmGetBody.ok, "GET CRM settings KV throw ainda manda os funis leftover")
assert(settingsDownCrmGet.status !== 500, "GET CRM settings KV throw não é Falha interna")
assert(settingsDownCrmGet.status !== 503, "GET CRM settings KV throw não esconde os funis leftover")
assert(settingsDownCrmGetBody.funnels?.some((item) => item.id === "funil-throw"), "GET CRM settings KV throw não esconde o funil leftover")
assert(settingsDownCrmGetBody.settingsUnread === true, "GET CRM settings KV throw marca definições unread")
assert(!settingsDownCrmGetBody.settings, "GET CRM settings KV throw não manda definições ocas que limpam o painel")
assert((await loadSettingsKv(runtimeHoleKv)).telegramBotUsername === settingsBeforeThrow.telegramBotUsername, "GET CRM settings KV throw não pisa o username leftover")
assert((await loadFunnelsKv(runtimeHoleKv)).some((item) => item.id === "funil-throw"), "GET CRM settings KV throw não pisa o funil leftover")
const funnelsThrowEnv = { ...runtimeHoleBase, AUTH: kvThrowsOn(runtimeHoleKv, CRM_FUNNELS) } as Env
const funnelsThrowMcp = async (id: number, name: string, args: Record<string, unknown> = {}) =>
  handleRequest(
    new Request("http://local.test/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: runtimeHoleCookie, "x-forwarded-for": "203.0.113.120" },
      body: JSON.stringify({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } }),
    }),
    funnelsThrowEnv,
    backgroundCtx()
  )
const funnelsBeforeThrow = await loadFunnelsKv(runtimeHoleKv)
assert(funnelsBeforeThrow.some((item) => item.id === "funil-throw"), "leftover do funil throw está no KV")
const funnelsDownCrmGet = await handleRequest(
  new Request("http://local.test/api/crm", { headers: { cookie: runtimeHoleCookie } }),
  funnelsThrowEnv,
  backgroundCtx()
)
const funnelsDownCrmGetBody = (await funnelsDownCrmGet.json()) as {
  ok?: boolean
  error?: string
  funnels?: Array<{ id?: string }>
  settings?: { telegramBotUsername?: string }
}
assert(funnelsDownCrmGet.status === 503, "GET CRM funnels KV throw é 503")
assert(funnelsDownCrmGet.status !== 500, "GET CRM funnels KV throw não é Falha interna")
assert(funnelsDownCrmGetBody.error === "Não li o CRM do Worker.", "GET CRM funnels KV throw pede confirmação")
assert(!Array.isArray(funnelsDownCrmGetBody.funnels), "GET CRM funnels KV throw não manda lista vazia de funis")
assert(funnelsDownCrmGetBody.ok !== true, "GET CRM funnels KV throw não mente ok")
assert((await loadFunnelsKv(runtimeHoleKv)).some((item) => item.id === "funil-throw"), "GET CRM funnels KV throw não pisa o funil leftover")
const kvDownMcpFunnels = await funnelsThrowMcp(230, "abilion_list_funnels")
const kvDownMcpFunnelsBody = (await kvDownMcpFunnels.json()) as {
  result?: { isError?: boolean; content?: Array<{ text?: string }> }
}
const kvDownMcpFunnelsData = JSON.parse(kvDownMcpFunnelsBody.result?.content?.[0]?.text || "{}") as {
  error?: string
  ok?: boolean
  funnels?: unknown[]
}
assert(kvDownMcpFunnels.status === 200 && kvDownMcpFunnelsBody.result?.isError, "MCP list_funnels KV throw não finge lista vazia")
assert(kvDownMcpFunnelsData.error === "Não confirmei os funis.", "MCP list_funnels KV throw pede confirmação")
assert(kvDownMcpFunnelsData.error !== "kv down", "MCP list_funnels KV throw não vaza o erro interno")
assert(kvDownMcpFunnelsData.ok !== true && !kvDownMcpFunnelsData.funnels, "MCP list_funnels KV throw não devolve catálogo oco")
const kvDownMcpGetFunnel = await funnelsThrowMcp(231, "abilion_get_funnel", { id: "funil-throw" })
const kvDownMcpGetFunnelData = JSON.parse(
  ((await kvDownMcpGetFunnel.json()) as { result?: { content?: Array<{ text?: string }> } }).result?.content?.[0]?.text || "{}"
) as { error?: string }
assert(kvDownMcpGetFunnelData.error === "Não confirmei os funis.", "MCP get_funnel KV throw pede confirmação")
assert(kvDownMcpGetFunnelData.error !== "Este funil já não está no CRM.", "MCP get_funnel KV throw não finge funil apagado")
const kvDownMcpCreateFunnel = await funnelsThrowMcp(232, "abilion_create_funnel", { name: "Novo throw" })
const kvDownMcpCreateFunnelData = JSON.parse(
  ((await kvDownMcpCreateFunnel.json()) as { result?: { content?: Array<{ text?: string }> } }).result?.content?.[0]?.text || "{}"
) as { error?: string; id?: string }
assert(kvDownMcpCreateFunnelData.error === "Não confirmei os funis.", "MCP create_funnel KV throw pede confirmação")
assert(!kvDownMcpCreateFunnelData.id, "MCP create_funnel KV throw não inventa id")
const kvDownMcpImportFunnel = await funnelsThrowMcp(233, "abilion_import_funnel", {
  name: "Import throw",
  payload: { messages: ["Passo A", "Passo B"] },
})
const kvDownMcpImportFunnelData = JSON.parse(
  ((await kvDownMcpImportFunnel.json()) as { result?: { content?: Array<{ text?: string }> } }).result?.content?.[0]?.text || "{}"
) as { error?: string }
assert(kvDownMcpImportFunnelData.error === "Não confirmei os funis.", "MCP import_funnel KV throw pede confirmação")
const kvDownMcpPublish = await funnelsThrowMcp(234, "abilion_publish_funnel", { id: "funil-throw" })
const kvDownMcpPublishData = JSON.parse(
  ((await kvDownMcpPublish.json()) as { result?: { content?: Array<{ text?: string }> } }).result?.content?.[0]?.text || "{}"
) as { error?: string }
assert(kvDownMcpPublishData.error === "Não confirmei os funis.", "MCP publish_funnel KV throw pede confirmação")
const kvDownMcpScriptFunnel = await funnelsThrowMcp(235, "abilion_create_page_script", {
  name: "Landing funnel throw",
  funnelId: "funil-throw",
})
const kvDownMcpScriptFunnelData = JSON.parse(
  ((await kvDownMcpScriptFunnel.json()) as { result?: { content?: Array<{ text?: string }> } }).result?.content?.[0]?.text || "{}"
) as { error?: string; script?: { id?: string } }
assert(kvDownMcpScriptFunnelData.error === "Não confirmei os funis.", "MCP create_page_script funnel KV throw pede confirmação")
assert(!kvDownMcpScriptFunnelData.script, "MCP create_page_script funnel KV throw não inventa script")
assert(
  (await loadFunnelsKv(runtimeHoleKv)).length === funnelsBeforeThrow.length,
  "MCP funnel KV throw não pisa o leftover"
)
assert(
  !(await loadFunnelsKv(runtimeHoleKv)).some((item) => item.name === "Novo throw" || item.name === "Import throw"),
  "MCP funnel KV throw não grava funil novo"
)
const kvDownCrmFunnels = await handleRequest(
  new Request("http://local.test/api/crm", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: runtimeHoleCookie,
      "x-forwarded-for": "203.0.113.121",
    },
    body: JSON.stringify({
      funnels: [{ ...emptySalesFunnel("CRM throw"), id: "funil-crm-throw" }],
    }),
  }),
  funnelsThrowEnv,
  backgroundCtx()
)
const kvDownCrmFunnelsBody = (await kvDownCrmFunnels.json()) as { error?: string }
assert(kvDownCrmFunnels.status === 503, "POST CRM funnels KV throw não cai em 500")
assert(kvDownCrmFunnelsBody.error === "Não confirmei os funis.", "POST CRM funnels KV throw pede confirmação")
assert(kvDownCrmFunnelsBody.error !== "Falha interna.", "POST CRM funnels KV throw não vira Falha interna")
assert(!(await loadFunnelsKv(runtimeHoleKv)).some((item) => item.id === "funil-crm-throw"), "POST CRM funnels KV throw não grava")
const accountsSecondDownEnv = { ...runtimeHoleBase, AUTH: kvThrowsAfter(runtimeHoleKv, "snapshot", 1) } as Env
const usersBeforeSecond = (await (
  await handleRequest(new Request("http://local.test/api/users", { headers: { cookie: runtimeHoleCookie } }), runtimeHoleBase, backgroundCtx())
).json()) as { users?: Array<{ email?: string }> }
const kvDownUsersGet = await handleRequest(
  new Request("http://local.test/api/users", { headers: { cookie: runtimeHoleCookie } }),
  accountsSecondDownEnv,
  backgroundCtx()
)
const kvDownUsersGetBody = (await kvDownUsersGet.json()) as { error?: string; ok?: boolean; users?: unknown[] }
assert(kvDownUsersGet.status === 503, "GET users 2ª leitura KV throw não cai em 500")
assert(kvDownUsersGetBody.error === "Não confirmei as contas.", "GET users 2ª leitura pede confirmação")
assert(kvDownUsersGetBody.error !== "Falha interna.", "GET users 2ª leitura não vira Falha interna")
assert(kvDownUsersGetBody.error !== "Sessão expirada.", "GET users 2ª leitura não finge logout")
assert(kvDownUsersGetBody.ok !== true && !kvDownUsersGetBody.users, "GET users 2ª leitura não lista vazio")
const kvDownUsersPost = await handleRequest(
  new Request("http://local.test/api/users", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: runtimeHoleCookie,
      "x-forwarded-for": "203.0.113.130",
    },
    body: JSON.stringify({ email: "segunda@abilion.com", name: "Segunda", password: "senhaok" }),
  }),
  { ...runtimeHoleBase, AUTH: kvThrowsAfter(runtimeHoleKv, "snapshot", 1) } as Env,
  backgroundCtx()
)
const kvDownUsersPostBody = (await kvDownUsersPost.json()) as { error?: string }
assert(kvDownUsersPost.status === 503, "POST users 2ª leitura KV throw não cai em 500")
assert(kvDownUsersPostBody.error === "Não confirmei as contas.", "POST users 2ª leitura pede confirmação")
const usersAfterSecond = (await (
  await handleRequest(new Request("http://local.test/api/users", { headers: { cookie: runtimeHoleCookie } }), runtimeHoleBase, backgroundCtx())
).json()) as { users?: Array<{ email?: string }> }
assert(
  (usersAfterSecond.users?.length ?? 0) === (usersBeforeSecond.users?.length ?? 0),
  "POST users 2ª leitura não cria conta"
)
assert(!usersAfterSecond.users?.some((item) => item.email === "segunda@abilion.com"), "POST users 2ª leitura não grava e-mail novo")
const kvDownTokensGet = await handleRequest(
  new Request("http://local.test/api/tokens", { headers: { cookie: runtimeHoleCookie } }),
  { ...runtimeHoleBase, AUTH: kvThrowsAfter(runtimeHoleKv, "snapshot", 1) } as Env,
  backgroundCtx()
)
const kvDownTokensGetBody = (await kvDownTokensGet.json()) as { error?: string; ok?: boolean }
assert(kvDownTokensGet.status === 503, "GET tokens 2ª leitura KV throw não cai em 500")
assert(kvDownTokensGetBody.error === "Não confirmei as contas.", "GET tokens 2ª leitura pede confirmação")
assert(kvDownTokensGetBody.error !== "Sessão expirada.", "GET tokens 2ª leitura não finge logout")
const kvDownTokensPost = await handleRequest(
  new Request("http://local.test/api/tokens", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: runtimeHoleCookie,
      "x-forwarded-for": "203.0.113.131",
    },
    body: JSON.stringify({ name: "Token throw" }),
  }),
  { ...runtimeHoleBase, AUTH: kvThrowsAfter(runtimeHoleKv, "snapshot", 1) } as Env,
  backgroundCtx()
)
const kvDownTokensPostBody = (await kvDownTokensPost.json()) as { error?: string; token?: string }
assert(kvDownTokensPost.status === 503, "POST tokens 2ª leitura KV throw não cai em 500")
assert(kvDownTokensPostBody.error === "Não confirmei as contas.", "POST tokens 2ª leitura pede confirmação")
assert(!kvDownTokensPostBody.token, "POST tokens 2ª leitura não emite token")
const kvDownMcpUsers = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: runtimeHoleCookie, "x-forwarded-for": "203.0.113.132" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 240,
      method: "tools/call",
      params: { name: "abilion_list_users", arguments: {} },
    }),
  }),
  { ...runtimeHoleBase, AUTH: kvThrowsAfter(runtimeHoleKv, "snapshot", 1) } as Env,
  backgroundCtx()
)
const kvDownMcpUsersBody = (await kvDownMcpUsers.json()) as {
  result?: { isError?: boolean; content?: Array<{ text?: string }> }
}
const kvDownMcpUsersData = JSON.parse(kvDownMcpUsersBody.result?.content?.[0]?.text || "{}") as {
  error?: string
  ok?: boolean
  users?: unknown[]
}
assert(kvDownMcpUsers.status === 200 && kvDownMcpUsersBody.result?.isError, "MCP list_users 2ª leitura não finge lista")
assert(kvDownMcpUsersData.error === "Não confirmei as contas.", "MCP list_users 2ª leitura pede confirmação")
assert(kvDownMcpUsersData.ok !== true && !kvDownMcpUsersData.users, "MCP list_users 2ª leitura não lista vazio")
const kvDownUsersPut = await handleRequest(
  new Request("http://local.test/api/users", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: runtimeHoleCookie,
      "x-forwarded-for": "203.0.113.133",
    },
    body: JSON.stringify({ email: "putdown@abilion.com", name: "Put", password: "senhaok" }),
  }),
  { ...runtimeHoleBase, AUTH: kvThrowsOnPut(runtimeHoleKv, "snapshot") } as Env,
  backgroundCtx()
)
assert(kvDownUsersPut.status === 503, "POST users put throw não cai em 500")
assert(((await kvDownUsersPut.json()) as { error?: string }).error === "Não confirmei as contas.", "POST users put throw pede confirmação")
assert(
  !(
    await (
      await handleRequest(new Request("http://local.test/api/users", { headers: { cookie: runtimeHoleCookie } }), runtimeHoleBase, backgroundCtx())
    ).json() as { users?: Array<{ email?: string }> }
  ).users?.some((item) => item.email === "putdown@abilion.com"),
  "POST users put throw não cria conta"
)
const settingsBeforePersist = await loadSettingsKv(runtimeHoleKv)
const persistSettingsDownEnv = { ...runtimeHoleBase, AUTH: kvThrowsAfter(runtimeHoleKv, CRM_SETTINGS, 1) } as Env
const persistSettingsDown = await handleRequest(
  new Request("http://local.test/api/crm", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: runtimeHoleCookie,
      "x-forwarded-for": "203.0.113.140",
    },
    body: JSON.stringify({ settings: { telegramBotUsername: "@ste_persist" } }),
  }),
  persistSettingsDownEnv,
  backgroundCtx()
)
const persistSettingsDownBody = (await persistSettingsDown.json()) as { error?: string; ok?: boolean }
assert(persistSettingsDown.status === 503, "POST CRM persist settings KV throw não cai em 500")
assert(persistSettingsDownBody.error === "Não confirmei as definições no Postgres.", "POST CRM persist settings pede confirmação")
assert(persistSettingsDownBody.error !== "kv down", "POST CRM persist settings não vaza o erro interno")
assert(persistSettingsDownBody.error !== "Falha interna.", "POST CRM persist settings não vira Falha interna")
assert(persistSettingsDownBody.ok !== true, "POST CRM persist settings não finge gravado")
assert((await loadSettingsKv(runtimeHoleKv)).telegramBotUsername === settingsBeforePersist.telegramBotUsername, "POST CRM persist settings não pisa o leftover")
assert((await loadSettingsKv(runtimeHoleKv)).telegramBotUsername !== "@ste_persist", "POST CRM persist settings não grava username unread")
const funnelsBeforePersist = await loadFunnelsKv(runtimeHoleKv)
const persistFunnelsDown = await handleRequest(
  new Request("http://local.test/api/crm", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: runtimeHoleCookie,
      "x-forwarded-for": "203.0.113.141",
    },
    body: JSON.stringify({
      funnels: [...funnelsBeforePersist, { ...emptySalesFunnel("Persist throw"), id: "funil-persist-throw" }],
    }),
  }),
  { ...runtimeHoleBase, AUTH: kvThrowsAfter(runtimeHoleKv, CRM_FUNNELS, 1) } as Env,
  backgroundCtx()
)
const persistFunnelsDownBody = (await persistFunnelsDown.json()) as { error?: string }
assert(persistFunnelsDown.status === 503, "POST CRM persist funnels KV throw não cai em 400")
assert(persistFunnelsDownBody.error === "Não confirmei os funis.", "POST CRM persist funnels pede confirmação")
assert(persistFunnelsDownBody.error !== "kv down", "POST CRM persist funnels não vaza o erro interno")
assert(!(await loadFunnelsKv(runtimeHoleKv)).some((item) => item.id === "funil-persist-throw"), "POST CRM persist funnels não grava")
const persistMcpScript = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: runtimeHoleCookie, "x-forwarded-for": "203.0.113.142" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 250,
      method: "tools/call",
      params: { name: "abilion_create_page_script", arguments: { name: "Persist script", funnelId: "funil-throw" } },
    }),
  }),
  { ...runtimeHoleBase, AUTH: kvThrowsAfter(runtimeHoleKv, CRM_SETTINGS, 1) } as Env,
  backgroundCtx()
)
const persistMcpScriptData = JSON.parse(
  ((await persistMcpScript.json()) as { result?: { content?: Array<{ text?: string }> } }).result?.content?.[0]?.text || "{}"
) as { error?: string; script?: { id?: string } }
assert(persistMcpScriptData.error === "Não confirmei os scripts desta página.", "MCP persist settings KV throw pede confirmação")
assert(persistMcpScriptData.error !== "kv down", "MCP persist settings não vaza o erro interno")
assert(!persistMcpScriptData.script, "MCP persist settings não inventa script")
const persistMcpFunnel = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: runtimeHoleCookie, "x-forwarded-for": "203.0.113.143" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 251,
      method: "tools/call",
      params: { name: "abilion_create_funnel", arguments: { name: "Persist funnel" } },
    }),
  }),
  { ...runtimeHoleBase, AUTH: kvThrowsAfter(runtimeHoleKv, CRM_FUNNELS, 1) } as Env,
  backgroundCtx()
)
const persistMcpFunnelData = JSON.parse(
  ((await persistMcpFunnel.json()) as { result?: { content?: Array<{ text?: string }> } }).result?.content?.[0]?.text || "{}"
) as { error?: string; id?: string }
assert(persistMcpFunnelData.error === "Não confirmei os funis.", "MCP persist funnels KV throw pede confirmação")
assert(!persistMcpFunnelData.id, "MCP persist funnels não inventa id")
assert(!(await loadFunnelsKv(runtimeHoleKv)).some((item) => item.name === "Persist funnel"), "MCP persist funnels não grava")
await saveSecrets(runtimeHoleKv, { telegramWebhookSecret: "hook-kv" })
const hookKvDownCtx = backgroundCtx()
let hookKvTelegramCalls = 0
const hookKvPrevFetch = globalThis.fetch
try {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes("api.telegram.org")) {
      hookKvTelegramCalls += 1
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }
    return hookKvPrevFetch(input, init)
  }) as typeof fetch
  const hookKvDown = await handleRequest(
    new Request("http://local.test/api/telegram", {
      method: "POST",
      headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "hook-kv" },
      body: JSON.stringify({
        update_id: 88001,
        message: {
          chat: { id: 88001 },
          text: "/start fb_hookkv",
          from: { id: 88001, username: "hookkv", first_name: "Hook" },
        },
      }),
    }),
    { ...runtimeHoleBase, AUTH: kvThrowsOn(runtimeHoleKv, RUNTIME_KEY) } as Env,
    hookKvDownCtx
  )
  const hookKvDownBody = (await hookKvDown.json()) as { ok?: boolean; error?: string }
  assert(hookKvDown.status === 503, "webhook KV throw é 503")
  assert(hookKvDown.status !== 401, "webhook KV throw não é 401 — o Telegram parava de tentar")
  assert(hookKvDown.status !== 200, "webhook KV throw não é 200 — o update ficava acked sem processar")
  assert(hookKvDown.status !== 500, "webhook KV throw não é Falha interna")
  assert(hookKvDownBody.ok === false, "webhook KV throw não finge ok")
  assert(hookKvDownBody.error === "Não confirmei as chaves do Worker.", "webhook KV throw pede confirmação das chaves")
  assert(hookKvDownBody.error !== "Falha interna.", "webhook KV throw não cai no catch genérico")
  await hookKvDownCtx.flush()
  assert(hookKvTelegramCalls === 0, "webhook KV throw não entrega no waitUntil")
} finally {
  globalThis.fetch = hookKvPrevFetch
}
assert(!(await listLeads(runtimeHoleKv, 20, "all")).some((item) => item.contact === "@hookkv"), "webhook KV throw não cria lead")
assert((await loadSecrets(runtimeHoleKv)).telegramWebhookSecret === "hook-kv", "webhook KV throw não apaga o secret leftover")
assert((await loadSecrets(runtimeHoleKv)).telegramBotToken === "000:kv-token", "webhook KV throw não apaga o token leftover")
const leftoverAuth = (await runtimeHoleKv.get("snapshot", "json")) as {
  users?: Array<{ email?: string; passwordHash?: string }>
  sessions?: unknown[]
  resets?: Record<string, unknown>
}
const leftoverAuthUsers = leftoverAuth?.users?.length ?? 0
const leftoverAuthSessions = leftoverAuth?.sessions?.length ?? 0
const leftoverAuthResets = Object.keys(leftoverAuth?.resets ?? {}).length
const leftoverAuthHash = leftoverAuth?.users?.find((item) => item.email === "victor@abilion.com")?.passwordHash
assert(leftoverAuthUsers > 0 && leftoverAuthHash, "KV do runtime hole ainda tem a conta leftover")
const authPutDownEnv = { ...runtimeHoleBase, AUTH: kvThrowsOnPut(runtimeHoleKv, "snapshot") } as Env
const authPutDownLogin = await handleRequest(
  new Request("http://local.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "victor@abilion.com", password: "senhaok" }),
  }),
  authPutDownEnv,
  backgroundCtx()
)
const authPutDownLoginBody = (await authPutDownLogin.json()) as { error?: string; user?: { email?: string } }
assert(authPutDownLogin.status === 503, "login persist KV throw é 503")
assert(authPutDownLogin.status !== 500, "login persist KV throw não é Falha interna")
assert(authPutDownLoginBody.error === "Não confirmei as contas.", "login persist KV throw pede confirmação")
assert(!authPutDownLoginBody.user, "login persist KV throw não finge sessão")
assert(!(authPutDownLogin.headers.get("set-cookie") || "").includes("abilion_session="), "login persist KV throw não manda cookie")
const authAfterLoginPut = (await runtimeHoleKv.get("snapshot", "json")) as {
  users?: Array<{ email?: string }>
  sessions?: unknown[]
}
assert((authAfterLoginPut?.users?.length ?? 0) === leftoverAuthUsers, "login persist KV throw não cria conta no leftover")
assert((authAfterLoginPut?.sessions?.length ?? 0) === leftoverAuthSessions, "login persist KV throw não grava sessão no leftover")
const authPutDownForgot = await handleRequest(
  new Request("http://local.test/api/auth/forgot", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "victor@abilion.com" }),
  }),
  { ...authPutDownEnv, ABILION_ENV: "development" } as Env,
  backgroundCtx()
)
const authPutDownForgotBody = (await authPutDownForgot.json()) as { error?: string; ok?: boolean; resetPath?: string }
assert(authPutDownForgot.status === 503, "forgot persist KV throw é 503")
assert(authPutDownForgotBody.ok !== true, "forgot persist KV throw não finge ok")
assert(!authPutDownForgotBody.resetPath, "forgot persist KV throw não inventa link")
assert(authPutDownForgotBody.error === "Não confirmei as contas.", "forgot persist KV throw pede confirmação")
assert(Object.keys(((await runtimeHoleKv.get("snapshot", "json")) as { resets?: Record<string, unknown> })?.resets ?? {}).length === leftoverAuthResets, "forgot persist KV throw não grava reset no leftover")
const authPutDownLogout = await handleRequest(
  new Request("http://local.test/api/auth/logout", {
    method: "POST",
    headers: { cookie: runtimeHoleCookie },
  }),
  authPutDownEnv,
  backgroundCtx()
)
const authPutDownLogoutBody = (await authPutDownLogout.json()) as { error?: string; ok?: boolean }
assert(authPutDownLogout.status === 503, "logout persist KV throw é 503")
assert(authPutDownLogoutBody.ok !== true, "logout persist KV throw não finge ok")
assert(authPutDownLogoutBody.error === "Não confirmei as contas.", "logout persist KV throw pede confirmação")
assert(!(authPutDownLogout.headers.get("set-cookie") || "").toLowerCase().includes("max-age=0"), "logout persist KV throw não apaga o cookie sem confirmar")
assert(((await runtimeHoleKv.get("snapshot", "json")) as { sessions?: unknown[] })?.sessions?.length === leftoverAuthSessions, "logout persist KV throw não revoga a sessão leftover")
const authPutDownPassword = await handleRequest(
  new Request("http://local.test/api/auth/password", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: runtimeHoleCookie },
    body: JSON.stringify({ currentPassword: "senhaok", password: "senha-nova" }),
  }),
  authPutDownEnv,
  backgroundCtx()
)
const authPutDownPasswordBody = (await authPutDownPassword.json()) as { error?: string; ok?: boolean }
assert(authPutDownPassword.status === 503, "password persist KV throw é 503")
assert(authPutDownPasswordBody.ok !== true, "password persist KV throw não finge ok")
assert(authPutDownPasswordBody.error === "Não confirmei as contas.", "password persist KV throw pede confirmação")
assert(
  ((await runtimeHoleKv.get("snapshot", "json")) as { users?: Array<{ email?: string; passwordHash?: string }> })?.users?.find(
    (item) => item.email === "victor@abilion.com"
  )?.passwordHash === leftoverAuthHash,
  "password persist KV throw não pisa o hash leftover"
)
await recordTrack(kvTrackStore(runtimeHoleKv), { kind: "view", visitorId: "aabbcc99", path: "/l" }, Date.now())
const leftoverTrack = await kvTrackStore(runtimeHoleKv).load()
assert(leftoverTrack.some((item) => item.visitorId === "aabbcc99"), "KV do runtime hole ainda tem o pixel leftover")
const trackKvDownEnv = { ...runtimeHoleBase, AUTH: kvThrowsOn(runtimeHoleKv, "track:events") } as Env
const trackKvDownPost = await handleRequest(
  new Request("http://local.test/api/track", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.160" },
    body: JSON.stringify({ kind: "click", visitorId: "aabbcc00" }),
  }),
  trackKvDownEnv,
  backgroundCtx()
)
assert(trackKvDownPost.status === 503, "POST pixel KV throw é 503")
assert(trackKvDownPost.status !== 500, "POST pixel KV throw não é Falha interna")
assert(trackKvDownPost.status !== 204, "POST pixel KV throw não finge que gravou")
assert(!(await trackKvDownPost.text()).includes("Falha interna."), "POST pixel KV throw não vaza Falha interna")
assert(trackKvDownPost.headers.get("access-control-allow-origin") === "*", "POST pixel KV throw manda CORS")
assert((await kvTrackStore(runtimeHoleKv).load()).some((item) => item.visitorId === "aabbcc99"), "POST pixel KV throw não apaga o leftover")
assert(!(await kvTrackStore(runtimeHoleKv).load()).some((item) => item.visitorId === "aabbcc00"), "POST pixel KV throw não grava o clique unread")
const trackKvDownSummary = await handleRequest(
  new Request("http://local.test/api/track/summary", { headers: { cookie: runtimeHoleCookie } }),
  trackKvDownEnv,
  backgroundCtx()
)
const trackKvDownSummaryBody = (await trackKvDownSummary.json()) as { error?: string; summary?: { views?: number }; ok?: boolean }
assert(trackKvDownSummary.status === 503, "GET summary KV throw é 503")
assert(trackKvDownSummaryBody.error === "Não confirmei os eventos do pixel.", "GET summary KV throw pede confirmação")
assert(!trackKvDownSummaryBody.summary, "GET summary KV throw não devolve zeros")
assert(trackKvDownSummaryBody.ok !== true, "GET summary KV throw não finge ok")
const trackRemotePrevFetch = globalThis.fetch
let trackKvDownRemote: Response
let trackKvDownRemoteBody: { ok?: boolean; summary?: { views?: number }; trackUnread?: boolean }
try {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes("/rest/v1/page_events")) {
      return new Response(
        JSON.stringify([
          {
            id: "pg-pix-1",
            visitor_id: "aabbcc99",
            kind: "view",
            path: "/l",
            at: "2026-09-21T00:00:00.000Z",
          },
        ]),
        { status: 200 }
      )
    }
    return trackRemotePrevFetch(input, init)
  }) as typeof fetch
  trackKvDownRemote = await handleRequest(
    new Request("http://local.test/api/track/summary", { headers: { cookie: runtimeHoleCookie } }),
    { ...trackKvDownEnv, SUPABASE_URL: "https://sb.test", SUPABASE_SERVICE_ROLE: "role" } as Env,
    backgroundCtx()
  )
  trackKvDownRemoteBody = (await trackKvDownRemote.json()) as {
    ok?: boolean
    summary?: { views?: number }
    trackUnread?: boolean
  }
} finally {
  globalThis.fetch = trackRemotePrevFetch
}
assert(trackKvDownRemote.status === 200 && trackKvDownRemoteBody.ok, "GET summary KV throw ainda lê page_events")
assert((trackKvDownRemoteBody.summary?.views ?? 0) >= 1, "GET summary KV throw não esconde o pixel do Postgres")
assert(trackKvDownRemoteBody.trackUnread === true, "GET summary KV throw marca trackUnread")
assert((await kvTrackStore(runtimeHoleKv).load()).some((item) => item.visitorId === "aabbcc99"), "GET summary KV throw não pisa o leftover")
const writeHoleLead = { ...lead("hole-lead", "@holelead"), memory: "leftover-ficha" }
await upsertLeadKv(runtimeHoleKv, writeHoleLead)
assert((await loadLead(runtimeHoleKv, "hole-lead"))?.memory === "leftover-ficha", "KV do runtime hole ainda tem a ficha leftover")
const leadKeyDownEnv = { ...runtimeHoleBase, AUTH: kvThrowsOn(runtimeHoleKv, leadKey("hole-lead")) } as Env
const leadKeyDownResolved = await resolveWorkspaceLeadWrite(leadKeyDownEnv, { ...writeHoleLead, memory: "unread-write" })
assert(!leadKeyDownResolved.ok && leadKeyDownResolved.unread, "resolve com ficha KV throw é unread")
const leadKeyDownPost = await handleRequest(
  new Request("http://local.test/api/leads", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: runtimeHoleCookie },
    body: JSON.stringify({ lead: { ...writeHoleLead, memory: "unread-write" } }),
  }),
  leadKeyDownEnv,
  backgroundCtx()
)
const leadKeyDownPostBody = (await leadKeyDownPost.json()) as { error?: string; ok?: boolean; saved?: number }
assert(leadKeyDownPost.status === 503, "POST lead KV throw é 503")
assert(leadKeyDownPost.status !== 500, "POST lead KV throw não é Falha interna")
assert(leadKeyDownPostBody.error === "Não li o lead do Postgres.", "POST lead KV throw pede confirmação")
assert(leadKeyDownPostBody.ok !== true && leadKeyDownPostBody.saved !== 1, "POST lead KV throw não finge gravar")
assert((await loadLead(runtimeHoleKv, "hole-lead"))?.memory === "leftover-ficha", "POST lead KV throw não pisa a ficha leftover")
const mintKeyDownPost = await handleRequest(
  new Request("http://local.test/api/leads", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: runtimeHoleCookie },
    body: JSON.stringify({ lead: lead("mint-hole", "@minthole") }),
  }),
  { ...runtimeHoleBase, AUTH: kvThrowsOn(runtimeHoleKv, leadKey("mint-hole")) } as Env,
  backgroundCtx()
)
assert(mintKeyDownPost.status === 503, "POST mint KV throw é 503")
assert(!(await listLeads(runtimeHoleKv, 20, "all")).some((item) => item.contact === "@minthole"), "POST mint KV throw não mint o segundo UUID")
const removedDownEnv = { ...runtimeHoleBase, AUTH: kvThrowsOn(runtimeHoleKv, CRM_REMOVED) } as Env
const removedDownList = await handleRequest(
  new Request("http://local.test/api/leads", { headers: { cookie: runtimeHoleCookie } }),
  removedDownEnv,
  backgroundCtx()
)
const removedDownListBody = (await removedDownList.json()) as { ok?: boolean; leads?: Array<{ id?: string }>; removed?: unknown; error?: string }
assert(removedDownList.status === 200 && removedDownListBody.ok, "GET leads tombstone KV throw ainda manda o leftover")
assert(removedDownList.status !== 500, "GET leads tombstone KV throw não é Falha interna")
assert(removedDownListBody.leads?.some((item) => item.id === "hole-lead"), "GET leads tombstone KV throw não esconde a ficha leftover")
assert(!Array.isArray(removedDownListBody.removed), "GET leads tombstone KV throw não inventa lista vazia de removidos")
const removedDownInbox = await handleRequest(
  new Request("http://local.test/api/inbox", { headers: { cookie: runtimeHoleCookie } }),
  removedDownEnv,
  backgroundCtx()
)
const removedDownInboxBody = (await removedDownInbox.json()) as { ok?: boolean; error?: string }
assert(removedDownInbox.status === 200 && removedDownInboxBody.ok, "GET inbox tombstone KV throw ainda responde")
assert((await loadLead(runtimeHoleKv, "hole-lead"))?.contact === "@holelead", "GET tombstone KV throw não pisa a ficha leftover")
const leadKeyDownMcp = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: runtimeHoleCookie, "x-forwarded-for": "203.0.113.170" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 260,
      method: "tools/call",
      params: { name: "abilion_get_lead", arguments: { id: "hole-lead" } },
    }),
  }),
  leadKeyDownEnv,
  backgroundCtx()
)
const leadKeyDownMcpData = JSON.parse(
  ((await leadKeyDownMcp.json()) as { result?: { isError?: boolean; content?: Array<{ text?: string }> } }).result?.content?.[0]?.text || "{}"
) as { error?: string; lead?: { memory?: string } }
assert(leadKeyDownMcp.status === 200, "MCP get_lead KV throw não cai em 500")
assert(leadKeyDownMcpData.error === "Não li o lead do Postgres.", "MCP get_lead KV throw pede confirmação")
assert(!leadKeyDownMcpData.lead, "MCP get_lead KV throw não finge que a ficha já não está")
assert((await loadLead(runtimeHoleKv, "hole-lead"))?.memory === "leftover-ficha", "MCP get_lead KV throw não pisa a ficha leftover")
const leadKeyDownDelete = await handleRequest(
  new Request("http://local.test/api/leads?id=hole-lead", {
    method: "DELETE",
    headers: { cookie: runtimeHoleCookie, "x-forwarded-for": "203.0.113.181" },
  }),
  leadKeyDownEnv,
  backgroundCtx()
)
const leadKeyDownDeleteBody = (await leadKeyDownDelete.json()) as { error?: string; ok?: boolean }
assert(leadKeyDownDelete.status === 409, "DELETE lead KV throw é 409")
assert(leadKeyDownDelete.status !== 500, "DELETE lead KV throw não é Falha interna")
assert(leadKeyDownDelete.status !== 503, "DELETE lead KV throw antes do tombstone não é 503")
assert(leadKeyDownDeleteBody.error === "Não confirmei a exclusão do lead.", "DELETE lead KV throw pede confirmação")
assert(leadKeyDownDeleteBody.ok !== true, "DELETE lead KV throw não mente ok")
assert((await loadLead(runtimeHoleKv, "hole-lead"))?.memory === "leftover-ficha", "DELETE lead KV throw não pisa a ficha leftover")
assert(!(await isLeadRemoved(runtimeHoleKv, "hole-lead")), "DELETE lead KV throw não tombstoneia o leftover")
const removedPutDownDelete = await handleRequest(
  new Request("http://local.test/api/leads?id=hole-lead", {
    method: "DELETE",
    headers: { cookie: runtimeHoleCookie, "x-forwarded-for": "203.0.113.182" },
  }),
  { ...runtimeHoleBase, AUTH: kvThrowsOnPut(runtimeHoleKv, CRM_REMOVED) } as Env,
  backgroundCtx()
)
const removedPutDownDeleteBody = (await removedPutDownDelete.json()) as { error?: string; ok?: boolean }
assert(removedPutDownDelete.status === 409, "DELETE tombstone put throw é 409")
assert(removedPutDownDelete.status !== 500, "DELETE tombstone put throw não é Falha interna")
assert(removedPutDownDelete.status !== 503, "DELETE tombstone put throw não é 503")
assert(removedPutDownDeleteBody.error === "Não confirmei a exclusão do lead.", "DELETE tombstone put throw pede confirmação")
assert((await loadLead(runtimeHoleKv, "hole-lead"))?.memory === "leftover-ficha", "DELETE tombstone put throw não pisa a ficha leftover")
assert(!(await isLeadRemoved(runtimeHoleKv, "hole-lead")), "DELETE tombstone put throw não tombstoneia")
assert(
  (await filterLiveLeads(kvThrowsOn(runtimeHoleKv, CRM_REMOVED), [writeHoleLead])).some((item) => item.id === "hole-lead"),
  "filterLiveLeads com tombstone unread não esconde o leftover"
)
assert(
  (await lookupLeadsByQuery(kvThrowsOn(runtimeHoleKv, CRM_REMOVED), "@holelead")).some((item) => item.id === "hole-lead"),
  "busca KV com tombstone unread ainda acha o leftover"
)
const removedDownSearch = await handleRequest(
  new Request("http://local.test/api/leads?q=@holelead", { headers: { cookie: runtimeHoleCookie } }),
  removedDownEnv,
  backgroundCtx()
)
const removedDownSearchBody = (await removedDownSearch.json()) as { ok?: boolean; leads?: Array<{ id?: string }>; error?: string }
assert(removedDownSearch.status === 200 && removedDownSearchBody.ok, "GET ?q= tombstone KV throw ainda manda o leftover")
assert(removedDownSearch.status !== 500, "GET ?q= tombstone KV throw não é Falha interna")
assert(removedDownSearch.status !== 503, "GET ?q= tombstone KV throw com hit no KV não é 503")
assert(removedDownSearchBody.leads?.some((item) => item.id === "hole-lead"), "GET ?q= tombstone KV throw não esconde a ficha leftover")
assert((await loadLead(runtimeHoleKv, "hole-lead"))?.memory === "leftover-ficha", "GET ?q= tombstone KV throw não pisa a ficha leftover")
const removedDownSearchMcp = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: runtimeHoleCookie, "x-forwarded-for": "203.0.113.183" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 261,
      method: "tools/call",
      params: { name: "abilion_list_leads", arguments: { q: "@holelead" } },
    }),
  }),
  removedDownEnv,
  backgroundCtx()
)
const removedDownSearchMcpData = JSON.parse(
  ((await removedDownSearchMcp.json()) as { result?: { isError?: boolean; content?: Array<{ text?: string }> } }).result?.content?.[0]?.text || "{}"
) as { error?: string; leads?: Array<{ id?: string }> }
assert(removedDownSearchMcp.status === 200, "MCP list busca KV throw não cai em 500")
assert(!removedDownSearchMcpData.error, "MCP list busca tombstone unread não pede 503")
assert(removedDownSearchMcpData.leads?.some((item) => item.id === "hole-lead"), "MCP list busca tombstone unread ainda manda o leftover")
const indexDownEnv = { ...runtimeHoleBase, AUTH: kvThrowsOn(runtimeHoleKv, CRM_INDEX) } as Env
assert(
  (await lookupLeadsByQuery(kvThrowsOn(runtimeHoleKv, CRM_INDEX), "@holelead")).some((item) => item.id === "hole-lead"),
  "busca KV com índice unread ainda acha o leftover pelo alias"
)
const indexDownList = await handleRequest(
  new Request("http://local.test/api/leads", { headers: { cookie: runtimeHoleCookie } }),
  indexDownEnv,
  backgroundCtx()
)
const indexDownListBody = (await indexDownList.json()) as { ok?: boolean; leads?: Array<{ id?: string }>; error?: string }
assert(indexDownList.status === 503, "GET leads índice KV throw é 503")
assert(indexDownList.status !== 500, "GET leads índice KV throw não é Falha interna")
assert(indexDownListBody.error === "Não li os leads do Postgres.", "GET leads índice KV throw pede confirmação")
assert(!Array.isArray(indexDownListBody.leads), "GET leads índice KV throw não manda lista vazia")
assert((await loadLead(runtimeHoleKv, "hole-lead"))?.memory === "leftover-ficha", "GET leads índice KV throw não pisa a ficha leftover")
const indexDownInbox = await handleRequest(
  new Request("http://local.test/api/inbox", { headers: { cookie: runtimeHoleCookie } }),
  indexDownEnv,
  backgroundCtx()
)
const indexDownInboxBody = (await indexDownInbox.json()) as { ok?: boolean; leads?: Array<{ id?: string }>; error?: string }
assert(indexDownInbox.status === 503, "GET inbox índice KV throw é 503")
assert(indexDownInbox.status !== 500, "GET inbox índice KV throw não é Falha interna")
assert(indexDownInboxBody.error === "Não li os leads do Postgres.", "GET inbox índice KV throw pede confirmação")
assert(!Array.isArray(indexDownInboxBody.leads), "GET inbox índice KV throw não manda lista vazia")
const indexDownSearch = await handleRequest(
  new Request("http://local.test/api/leads?q=@holelead", { headers: { cookie: runtimeHoleCookie } }),
  indexDownEnv,
  backgroundCtx()
)
const indexDownSearchBody = (await indexDownSearch.json()) as { ok?: boolean; leads?: Array<{ id?: string }>; error?: string }
assert(indexDownSearch.status === 200 && indexDownSearchBody.ok, "GET ?q= índice unread ainda manda o leftover do alias")
assert(indexDownSearch.status !== 500, "GET ?q= índice unread não é Falha interna")
assert(indexDownSearchBody.leads?.some((item) => item.id === "hole-lead"), "GET ?q= índice unread não esconde a ficha leftover")
const indexDownMcpList = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: runtimeHoleCookie, "x-forwarded-for": "203.0.113.184" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 262,
      method: "tools/call",
      params: { name: "abilion_list_leads", arguments: { limit: 5 } },
    }),
  }),
  indexDownEnv,
  backgroundCtx()
)
const indexDownMcpListData = JSON.parse(
  ((await indexDownMcpList.json()) as { result?: { isError?: boolean; content?: Array<{ text?: string }> } }).result?.content?.[0]?.text || "{}"
) as { error?: string; leads?: Array<{ id?: string }> }
assert(indexDownMcpList.status === 200, "MCP list índice KV throw não cai em 500")
assert(indexDownMcpListData.error === "Não li os leads do Postgres.", "MCP list índice KV throw pede confirmação")
assert(!indexDownMcpListData.leads, "MCP list índice KV throw não finge lista vazia")
const indexDownMcpSearch = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: runtimeHoleCookie, "x-forwarded-for": "203.0.113.185" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 263,
      method: "tools/call",
      params: { name: "abilion_list_leads", arguments: { q: "@holelead" } },
    }),
  }),
  indexDownEnv,
  backgroundCtx()
)
const indexDownMcpSearchData = JSON.parse(
  ((await indexDownMcpSearch.json()) as { result?: { isError?: boolean; content?: Array<{ text?: string }> } }).result?.content?.[0]?.text || "{}"
) as { error?: string; leads?: Array<{ id?: string }> }
assert(indexDownMcpSearch.status === 200, "MCP busca índice unread não cai em 500")
assert(!indexDownMcpSearchData.error, "MCP busca índice unread com alias não pede 503")
assert(indexDownMcpSearchData.leads?.some((item) => item.id === "hole-lead"), "MCP busca índice unread ainda manda o leftover")
assert((await loadLead(runtimeHoleKv, "hole-lead"))?.memory === "leftover-ficha", "índice KV throw não pisa a ficha leftover")
const removedDownFound = await findWorkspaceLead(removedDownEnv, "@holelead", 0, "")
assert(removedDownFound?.id === "hole-lead", "lookup webhook com tombstone unread ainda devolve o leftover")
assert(removedDownFound?.memory === "leftover-ficha", "lookup webhook com tombstone unread não esconde a ficha leftover")
const hookRemovedDownCtx = backgroundCtx()
const hookRemovedPrevFetch = globalThis.fetch
const holeLeadIdsBefore = (await listLeads(runtimeHoleKv, 40, "all")).filter((item) => item.contact === "@holelead").map((item) => item.id)
try {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes("api.telegram.org")) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }
    return hookRemovedPrevFetch(input, init)
  }) as typeof fetch
  const hookRemovedDown = await handleRequest(
    new Request("http://local.test/api/telegram", {
      method: "POST",
      headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "hook-kv" },
      body: JSON.stringify({
        update_id: 88002,
        message: {
          chat: { id: 88002 },
          text: "oi leftover",
          from: { id: 88002, username: "holelead", first_name: "Hole" },
        },
      }),
    }),
    removedDownEnv,
    hookRemovedDownCtx
  )
  const hookRemovedDownBody = (await hookRemovedDown.json()) as { ok?: boolean; error?: string }
  assert(hookRemovedDown.status === 200, "webhook tombstone unread ainda acks o Telegram")
  assert(hookRemovedDown.status !== 500, "webhook tombstone unread não é Falha interna")
  assert(hookRemovedDownBody.ok === true, "webhook tombstone unread não mente falha no ack")
  await hookRemovedDownCtx.flush()
} finally {
  globalThis.fetch = hookRemovedPrevFetch
}
const holeLeadIdsAfter = (await listLeads(runtimeHoleKv, 40, "all")).filter((item) => item.contact === "@holelead").map((item) => item.id)
assert(holeLeadIdsAfter.join() === holeLeadIdsBefore.join(), "webhook tombstone unread não mint o segundo UUID")
assert((await loadLead(runtimeHoleKv, "hole-lead"))?.id === "hole-lead", "webhook tombstone unread não apaga o leftover")
assert((await loadLead(runtimeHoleKv, "hole-lead"))?.contact === "@holelead", "webhook tombstone unread não troca o contacto leftover")
const holeAfterHook = await loadLead(runtimeHoleKv, "hole-lead")
assert(
  (holeAfterHook?.messages ?? []).some((item) => item.role === "lead" && item.text === "oi leftover") ||
    (holeAfterHook?.messages ?? []).some((item) => item.role === "ste"),
  "webhook tombstone unread grava a fala no leftover"
)
assert(
  await upsertLeadKv(kvThrowsOn(runtimeHoleKv, CRM_REMOVED), { ...holeAfterHook!, memory: "leftover-ficha" }),
  "upsert tombstone unread ainda grava o leftover"
)
assert((await loadLead(runtimeHoleKv, "hole-lead"))?.id === "hole-lead", "upsert tombstone unread não apaga o leftover")
assert((await loadLead(runtimeHoleKv, "hole-lead"))?.contact === "@holelead", "upsert tombstone unread não troca o contacto leftover")
assert(!(await upsertLeadKv(kvThrowsOn(durableGone, CRM_REMOVED), lead("old-id", "@oldgone"))), "upsert não ressuscita id com chave gone")
await saveSettingsKv(liveEnv.AUTH, migrateSettings({ telegramBotUsername: "@steaviator" }))
const landingTagged = await handleRequest(new Request("http://local.test/l?s=deadbeef&fbclid=IwAR"), liveEnv, backgroundCtx())
const landingTaggedHtml = await landingTagged.text()
assert(landingTagged.status === 200, "GET /l?s= é 200")
assert(
  landingTaggedHtml.includes("/t.js?v=2&s=deadbeef") &&
    landingTaggedHtml.includes("data-abilion-cta") &&
    landingTaggedHtml.includes("t.me/steaviator?start=fb_sdeadbeef"),
  "GET /l?s= leva t.js, CTA e start do script"
)
const landingSlash = await handleRequest(new Request("http://local.test/l/"), liveEnv, backgroundCtx())
assert((await landingSlash.text()).includes("/t.js?v=2"), "GET /l/ também é a landing do Worker")
const landingHead = await handleRequest(new Request("http://local.test/l", { method: "HEAD" }), liveEnv, backgroundCtx())
assert(landingHead.status === 200 && (await landingHead.text()) === "", "HEAD /l não manda o HTML")
const loginHtml = await handleRequest(
  new Request("http://local.test/login"),
  {
    ...liveEnv,
    ASSETS: {
      fetch: async () => {
        throw new Error("assets down")
      },
    },
  } as Env,
  backgroundCtx()
)
assert(loginHtml.status === 200, "GET /login não depende dos assets")
const loginHtmlBody = await loginHtml.text()
assert(loginHtmlBody.includes('id="email"') && loginHtmlBody.includes('action="/api/auth/login"'), "GET /login traz o formulário no primeiro HTML")
assert((loginHtml.headers.get("content-security-policy") || "").includes("script-src 'self'"), "GET /login leva CSP")
const loginAuthed = await handleRequest(
  new Request("http://local.test/login?next=/leads", { headers: { cookie: liveCookie } }),
  liveEnv,
  backgroundCtx()
)
assert(loginAuthed.status === 303 && loginAuthed.headers.get("location") === "/leads", "GET /login com sessão vai para o next")
const loginEvilNext = await handleRequest(
  new Request("http://local.test/login?next=//evil.com", { headers: { cookie: liveCookie } }),
  liveEnv,
  backgroundCtx()
)
assert(loginEvilNext.headers.get("location") === "/", "GET /login recusa next perigoso")
const formBad = await handleRequest(
  new Request("http://local.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "email=nobody%40abilion.com&password=senhaok",
  }),
  liveEnv,
  backgroundCtx()
)
assert(formBad.status === 401, "login form inválido é 401")
assert((await formBad.text()).includes("E-mail ou senha inválidos."), "login form inválido mostra o erro no HTML")
const formOk = await handleRequest(
  new Request("http://local.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "email=victor%40abilion.com&password=senhaok&next=%2Fleads",
  }),
  liveEnv,
  backgroundCtx()
)
assert(formOk.status === 303 && formOk.headers.get("location") === "/leads", "login form válido redirecciona")
assert((formOk.headers.get("set-cookie") || "").includes("abilion_session="), "login form grava o cookie")
const privacyHtml = await handleRequest(new Request("http://local.test/privacidade"), liveEnv, backgroundCtx())
assert(privacyHtml.status === 200 && (await privacyHtml.text()).includes("Privacidade"), "GET /privacidade é HTML do Worker")
const loginCase = await handleRequest(
  new Request("http://local.test/Login"),
  {
    ...liveEnv,
    ASSETS: {
      fetch: async () => {
        throw new Error("assets down")
      },
    },
  } as Env,
  backgroundCtx()
)
const loginCaseHtml = await loginCase.text()
assert(loginCase.status === 200 && loginCaseHtml.includes('action="/api/auth/login"'), "GET /Login é o HTML do Worker")
assert(loginCaseHtml.includes('class="skip-link"'), "login do Worker tem skip-link")
const landingCase = await handleRequest(
  new Request("http://local.test/L/"),
  {
    ...liveEnv,
    ASSETS: {
      fetch: async () => {
        throw new Error("assets down")
      },
    },
  } as Env,
  backgroundCtx()
)
const landingCaseHtml = await landingCase.text()
assert(landingCase.status === 200 && landingCaseHtml.includes("/t.js"), "GET /L/ é a landing do Worker")
assert(landingCaseHtml.includes('class="skip-link"'), "landing do Worker tem skip-link")
const pixelCase = await handleRequest(
  new Request("http://local.test/T.js"),
  {
    ...liveEnv,
    ASSETS: {
      fetch: async () => {
        throw new Error("assets down")
      },
    },
  } as Env,
  backgroundCtx()
)
assert(pixelCase.status === 200 && (await pixelCase.text()).includes("abilion_vid"), "GET /T.js é o pixel do Worker")
const mcpCase = await handleRequest(
  new Request("http://local.test/Mcp"),
  {
    ...liveEnv,
    ASSETS: {
      fetch: async () => {
        throw new Error("assets down")
      },
    },
  } as Env,
  backgroundCtx()
)
const mcpCaseBody = (await mcpCase.json()) as { ok?: boolean; name?: string }
assert(mcpCase.status === 200 && mcpCaseBody.ok && mcpCaseBody.name === "abilion", "GET /Mcp é o MCP do Worker")
const apiCase = await handleRequest(
  new Request("http://local.test/Api/health"),
  {
    ...liveEnv,
    ASSETS: {
      fetch: async () => {
        throw new Error("assets down")
      },
    },
  } as Env,
  backgroundCtx()
)
const apiCaseBody = (await apiCase.json()) as { ok?: boolean }
assert(apiCase.status === 200 && apiCaseBody.ok, "GET /Api/health é a API do Worker")
const leadsCase = await handleRequest(
  new Request("http://local.test/Leads?q=ana"),
  {
    ...liveEnv,
    ASSETS: {
      fetch: async () => {
        throw new Error("assets down")
      },
    },
  } as Env,
  backgroundCtx()
)
assert(leadsCase.status === 303 && leadsCase.headers.get("location") === "/leads?q=ana", "GET /Leads não cai no 404 do SPA")
const settingsCase = await handleRequest(
  new Request("http://local.test/settings?tab=bot"),
  {
    ...liveEnv,
    ASSETS: {
      fetch: async () => {
        throw new Error("assets down")
      },
    },
  } as Env,
  backgroundCtx()
)
assert(settingsCase.status === 303 && settingsCase.headers.get("location") === "/configuracoes?tab=bot", "GET /settings não cai no 404 do SPA")
const usersCase = await handleRequest(
  new Request("http://local.test/Users"),
  {
    ...liveEnv,
    ASSETS: {
      fetch: async () => {
        throw new Error("assets down")
      },
    },
  } as Env,
  backgroundCtx()
)
assert(usersCase.status === 303 && usersCase.headers.get("location") === "/utilizadores", "GET /Users não cai no 404 do SPA")
const forgotHtml = await handleRequest(new Request("http://local.test/forgot"), liveEnv, backgroundCtx())
assert(forgotHtml.status === 200 && (await forgotHtml.text()).includes('action="/api/auth/forgot"'), "GET /forgot é HTML do Worker")
const resetEmptyHtml = await handleRequest(
  new Request("http://local.test/reset"),
  {
    ...liveEnv,
    ASSETS: {
      fetch: async () => {
        throw new Error("assets down")
      },
    },
  } as Env,
  backgroundCtx()
)
assert(resetEmptyHtml.status === 200, "GET /reset não depende dos assets")
const resetEmptyBody = await resetEmptyHtml.text()
assert(resetEmptyBody.includes("incompleto") && resetEmptyBody.includes("Gerar outro"), "GET /reset sem token é empty state")
const resetHtml = await handleRequest(new Request("http://local.test/reset?token=abc&next=/leads"), liveEnv, backgroundCtx())
const resetHtmlBody = await resetHtml.text()
assert(resetHtml.status === 200 && resetHtmlBody.includes('action="/api/auth/reset"'), "GET /reset?token= traz o formulário")
assert(resetHtmlBody.includes('name="token" value="abc"') && resetHtmlBody.includes('name="next" value="/leads"'), "GET /reset conserva token e next")
const resetFormEnv = {
  ASSETS: { fetch: async () => new Response("ok") },
  AUTH: memoryKv(),
  ABILION_ENV: "development",
} as Env
await handleRequest(
  new Request("http://local.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "victor@abilion.com", password: "senhaok" }),
  }),
  resetFormEnv,
  backgroundCtx()
)
const resetFormBad = await handleRequest(
  new Request("http://local.test/api/auth/reset", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "token=nope&password=senhaok&next=%2Fleads",
  }),
  resetFormEnv,
  backgroundCtx()
)
assert(resetFormBad.status === 400, "reset form inválido é 400")
assert((await resetFormBad.text()).includes("Link expirado ou inválido."), "reset form inválido mostra o erro no HTML")
const resetForgot = (await (
  await handleRequest(
    new Request("http://local.test/api/auth/forgot", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.41" },
      body: JSON.stringify({ email: "victor@abilion.com" }),
    }),
    resetFormEnv,
    backgroundCtx()
  )
).json()) as { resetPath?: string }
const resetFormToken = resetForgot.resetPath?.split("token=")[1] || ""
assert(resetFormToken, "forgot local devolve token para o form do reset")
const resetFormOk = await handleRequest(
  new Request("http://local.test/api/auth/reset", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: `token=${encodeURIComponent(resetFormToken)}&password=senhaok&next=%2Fleads`,
  }),
  resetFormEnv,
  backgroundCtx()
)
assert(resetFormOk.status === 303 && resetFormOk.headers.get("location") === "/login?next=%2Fleads", "reset form válido redirecciona ao login")
const pixelPlain = await handleRequest(
  new Request("http://local.test/api/track", {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: JSON.stringify({ kind: "click", visitorId: "aabbcc" }),
  }),
  liveEnv,
  backgroundCtx()
)
assert(pixelPlain.status === 204, "pixel text/plain grava")
const boom = await handleRequest(
  new Request("http://local.test/"),
  {
    ...liveEnv,
    ASSETS: {
      fetch: async () => {
        throw new Error("assets down")
      },
    },
  } as Env,
  backgroundCtx()
)
assert(boom.status === 500, "assets a falhar devolve 500")
const boomBody = (await boom.json()) as { error?: string }
assert(boomBody.error === "Falha interna.", "500 sem stack")
assert(!JSON.stringify(boomBody).includes("assets down"), "500 sem detalhe interno")
const downEnv = {
  ...liveEnv,
  SUPABASE_URL: "https://invalid.invalid",
  SUPABASE_SERVICE_ROLE: "role",
} as Env
const downCrm = await handleRequest(new Request("http://local.test/api/crm", { headers: { cookie: liveCookie } }), downEnv, backgroundCtx())
assert(downCrm.status === 200, "CRM lê o KV se o Supabase cair")
const downCrmBody = (await downCrm.json()) as { settingsUnread?: boolean; funnelsUnread?: boolean; funnels?: unknown[] }
assert(Array.isArray(downCrmBody.funnels), "CRM com Postgres em baixo ainda manda os funis do KV")
assert(downCrmBody.settingsUnread === true, "CRM marca definições por confirmar se o Postgres cair")
assert(downCrmBody.funnelsUnread === true, "CRM marca funis por confirmar se o Postgres cair")
const downLeads = await handleRequest(new Request("http://local.test/api/leads", { headers: { cookie: liveCookie } }), downEnv, backgroundCtx())
const downLeadsBody = (await downLeads.json()) as { ok?: boolean; eventsUnread?: boolean; leads?: unknown[] }
assert(downLeads.status === 200 && downLeadsBody.ok, "GET leads com KV ainda responde se o Postgres cair")
assert(downLeadsBody.eventsUnread === true, "GET leads com Postgres em baixo marca a timeline unread")
assert(Array.isArray(downLeadsBody.leads), "GET leads unread não apaga os leads do KV")
const downLeadId = (downLeadsBody.leads ?? []).map((item) => (item as { id?: string }).id).find(Boolean)
assert(downLeadId, "GET leads unread ainda tem um id no KV para a busca")
const downSearch = await handleRequest(
  new Request(`http://local.test/api/leads?q=${encodeURIComponent(downLeadId!)}`, { headers: { cookie: liveCookie } }),
  downEnv,
  backgroundCtx()
)
const downSearchBody = (await downSearch.json()) as { ok?: boolean; eventsUnread?: boolean; leads?: unknown[] }
assert(downSearch.status === 200 && downSearchBody.ok, "GET ?q= com KV ainda responde se o Postgres cair")
assert(downSearchBody.eventsUnread === true, "GET ?q= com Postgres em baixo marca a timeline unread")
const downCrmBoards = Array.isArray(downCrmBody.funnels) ? downCrmBody.funnels : []
const downCrmAdd = await handleRequest(
  new Request("http://local.test/api/crm", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: liveCookie },
    body: JSON.stringify({ funnels: [...downCrmBoards, emptySalesFunnel("Novo unread")] }),
  }),
  downEnv,
  backgroundCtx()
)
assert(downCrmAdd.status === 503, "POST CRM não cria funil novo com a lista unread")
assert(((await downCrmAdd.json()) as { error?: string }).error === "Não confirmei os funis.", "POST CRM unread pede confirmação")
const downCrmKeep = await handleRequest(
  new Request("http://local.test/api/crm", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: liveCookie },
    body: JSON.stringify({ funnels: downCrmBoards }),
  }),
  downEnv,
  backgroundCtx()
)
assert(downCrmKeep.status === 200, "POST CRM ainda grava o quadro que já estava no KV unread")
const downCrmDrop = await handleRequest(
  new Request("http://local.test/api/crm", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: liveCookie },
    body: JSON.stringify({ funnels: downCrmBoards, removedFunnelIds: ["ghost-board"] }),
  }),
  downEnv,
  backgroundCtx()
)
assert(downCrmDrop.status === 503, "POST CRM não apaga funil com a lista unread")
const downCrmSettingsBefore = await loadSettingsKv(liveEnv.AUTH)
const leftoverScript = {
  id: "cafebabe",
  name: "Landing leftover",
  funnelId: "f1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}
const leftoverSettings = migrateSettings({
  ...downCrmSettingsBefore,
  pageScripts: [leftoverScript],
  leadCategories: ["VIP"],
})
await saveSettingsKv(liveEnv.AUTH, leftoverSettings)
const downCrmScriptKeep = await handleRequest(
  new Request("http://local.test/api/crm", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: liveCookie },
    body: JSON.stringify({ funnels: downCrmBoards, settings: leftoverSettings }),
  }),
  downEnv,
  backgroundCtx()
)
assert(downCrmScriptKeep.status === 200, "POST CRM ainda grava username com os scripts leftover unread")
const downCrmScriptAdd = await handleRequest(
  new Request("http://local.test/api/crm", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: liveCookie },
    body: JSON.stringify({
      funnels: downCrmBoards,
      settings: migrateSettings({
        ...leftoverSettings,
        pageScripts: [
          leftoverScript,
          {
            id: "deadbeef",
            name: "Landing nova",
            funnelId: "f1",
            createdAt: "2026-01-02T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
          },
        ],
      }),
    }),
  }),
  downEnv,
  backgroundCtx()
)
assert(downCrmScriptAdd.status === 503, "POST CRM não cria script novo com leftover unread")
assert(((await downCrmScriptAdd.json()) as { error?: string }).error === "Não confirmei os scripts desta página.", "POST CRM script unread pede confirmação")
const downCrmScriptDrop = await handleRequest(
  new Request("http://local.test/api/crm", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: liveCookie },
    body: JSON.stringify({
      funnels: downCrmBoards,
      settings: migrateSettings({ ...leftoverSettings, pageScripts: [], removedPageScripts: ["cafebabe"] }),
    }),
  }),
  downEnv,
  backgroundCtx()
)
assert(downCrmScriptDrop.status === 503, "POST CRM não apaga script com leftover unread")
const downCrmCatKeep = await handleRequest(
  new Request("http://local.test/api/crm", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: liveCookie },
    body: JSON.stringify({ funnels: downCrmBoards, settings: leftoverSettings }),
  }),
  downEnv,
  backgroundCtx()
)
assert(downCrmCatKeep.status === 200, "POST CRM ainda grava username com as categorias leftover unread")
const downCrmCatAdd = await handleRequest(
  new Request("http://local.test/api/crm", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: liveCookie },
    body: JSON.stringify({
      funnels: downCrmBoards,
      settings: migrateSettings({ ...leftoverSettings, leadCategories: ["VIP", "Gold"] }),
    }),
  }),
  downEnv,
  backgroundCtx()
)
assert(downCrmCatAdd.status === 503, "POST CRM não cria categoria nova com leftover unread")
assert(((await downCrmCatAdd.json()) as { error?: string }).error === "Não confirmei as categorias.", "POST CRM categoria unread pede confirmação")
await saveSettingsKv(liveEnv.AUTH, downCrmSettingsBefore)
const downRuntime = await handleRequest(new Request("http://local.test/api/runtime", { headers: { cookie: liveCookie } }), downEnv, backgroundCtx())
const downRuntimeBody = (await downRuntime.json()) as {
  ok?: boolean
  telegramBotUsername?: string
  settingsUnread?: boolean
}
assert(downRuntime.status === 200 && downRuntimeBody.ok, "GET runtime unread continua de pé")
assert(downRuntimeBody.telegramBotUsername === "@steaviator", "GET runtime lê o username das settings do KV")
assert(downRuntimeBody.settingsUnread === true, "GET runtime marca settings unread")
const downInstallMiss = await handleRequest(new Request("http://local.test/api/install?s=deadbeef"), downEnv, backgroundCtx())
assert(downInstallMiss.status === 503, "GET /api/install?s= com settings unread não finge script em falta")
assert(
  ((await downInstallMiss.json()) as { error?: string }).error === "Não confirmei o script desta página.",
  "503 do install pede confirmação do script"
)
const downInstallGeneral = await handleRequest(new Request("http://local.test/api/install"), downEnv, backgroundCtx())
const downInstallGeneralBody = (await downInstallGeneral.json()) as { ok?: boolean; steps?: unknown[] }
assert(
  downInstallGeneral.status === 200 && downInstallGeneralBody.ok && (downInstallGeneralBody.steps?.length ?? 0) >= 5,
  "GET /api/install sem s= continua o manual mesmo unread"
)
const downInstallBadId = await handleRequest(new Request("http://local.test/api/install?s=nao-e-id"), downEnv, backgroundCtx())
assert(downInstallBadId.status === 200, "s= inválido não 503")
const installHollowKv = memoryKv()
await saveSettingsKv(
  installHollowKv,
  migrateSettings({
    pageScripts: [
      {
        id: "deadbeef",
        name: "Landing unread",
        funnelId: "fun-install",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  })
)
const installUnreadEnv = {
  ASSETS: { fetch: async () => new Response("ok") },
  AUTH: installHollowKv,
  SUPABASE_URL: "https://invalid.invalid",
  SUPABASE_SERVICE_ROLE: "role",
  ABILION_ENV: "development",
} as Env
const downInstallFunnel = await handleRequest(new Request("http://local.test/api/install?s=deadbeef"), installUnreadEnv, backgroundCtx())
assert(downInstallFunnel.status === 503, "script no KV sem funis e Postgres em baixo não omite o nome à calada")
assert(
  ((await downInstallFunnel.json()) as { error?: string }).error === "Não confirmei o funil deste script.",
  "503 do install pede confirmação do funil"
)
await saveFunnelsKv(installHollowKv, [{ ...emptySalesFunnel("Quadro do script"), id: "fun-install" }])
const downInstallFound = await handleRequest(new Request("http://local.test/api/install?s=deadbeef"), installUnreadEnv, backgroundCtx())
const downInstallFoundBody = (await downInstallFound.json()) as { ok?: boolean; script?: { id?: string; funnelName?: string } }
assert(downInstallFound.status === 200 && downInstallFoundBody.script?.id === "deadbeef", "script no KV sobrevive ao Postgres unread")
assert(downInstallFoundBody.script?.funnelName === "Quadro do script", "funil no KV entra no manual mesmo unread")
await saveFunnelsKv(installHollowKv, [{ ...emptySalesFunnel("Outro quadro"), id: "fun-other" }])
const downInstallOther = await handleRequest(new Request("http://local.test/api/install?s=deadbeef"), installUnreadEnv, backgroundCtx())
assert(downInstallOther.status === 503, "script cujo funil não está no KV leftover é unread")
assert(
  ((await downInstallOther.json()) as { error?: string }).error === "Não confirmei o funil deste script.",
  "503 do install não omite o nome do funil que só está no Postgres"
)
const leftoverInstallLogin = await handleRequest(
  new Request("http://local.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "victor@abilion.com", password: "senhaok" }),
  }),
  installUnreadEnv,
  backgroundCtx()
)
assert(leftoverInstallLogin.status === 200, "login no KV do install leftover")
const leftoverInstallCookie = leftoverInstallLogin.headers.get("set-cookie") || ""
const leftoverInstallMcp = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: leftoverInstallCookie },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 102,
      method: "tools/call",
      params: { name: "abilion_page_install_manual", arguments: { scriptId: "deadbeef" } },
    }),
  }),
  installUnreadEnv,
  backgroundCtx()
)
const leftoverInstallMcpBody = (await leftoverInstallMcp.json()) as {
  result?: { isError?: boolean; content?: Array<{ text?: string }> }
}
const leftoverInstallMcpData = JSON.parse(leftoverInstallMcpBody.result?.content?.[0]?.text || "{}") as { error?: string }
assert(leftoverInstallMcp.status === 200 && leftoverInstallMcpBody.result?.isError, "MCP não omite o funil unread do script")
assert(leftoverInstallMcpData.error === "Não confirmei o funil deste script.", "MCP leftover pede confirmação do funil")
const leftoverListMcp = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: leftoverInstallCookie },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 103,
      method: "tools/call",
      params: { name: "abilion_list_page_scripts", arguments: {} },
    }),
  }),
  installUnreadEnv,
  backgroundCtx()
)
const leftoverListMcpBody = (await leftoverListMcp.json()) as {
  result?: { isError?: boolean; content?: Array<{ text?: string }> }
}
const leftoverListMcpData = JSON.parse(leftoverListMcpBody.result?.content?.[0]?.text || "{}") as { error?: string }
assert(leftoverListMcp.status === 200 && leftoverListMcpBody.result?.isError, "MCP não lista script cujo funil só está no Postgres")
assert(leftoverListMcpData.error === "Não confirmei o funil deste script.", "MCP list leftover pede confirmação do funil")
await saveFunnelsKv(installHollowKv, [{ ...emptySalesFunnel("Quadro do script"), id: "fun-install" }])
const leftoverListOk = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: leftoverInstallCookie },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 104,
      method: "tools/call",
      params: { name: "abilion_list_page_scripts", arguments: {} },
    }),
  }),
  installUnreadEnv,
  backgroundCtx()
)
const leftoverListOkBody = (await leftoverListOk.json()) as {
  result?: { isError?: boolean; content?: Array<{ text?: string }> }
}
const leftoverListOkData = JSON.parse(leftoverListOkBody.result?.content?.[0]?.text || "{}") as {
  ok?: boolean
  scripts?: Array<{ funnelName?: string }>
}
assert(leftoverListOk.status === 200 && !leftoverListOkBody.result?.isError && leftoverListOkData.ok, "MCP lista script com funil leftover")
assert(leftoverListOkData.scripts?.[0]?.funnelName === "Quadro do script", "lista leftover traz o nome do funil no KV")
const scriptHookPrev = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  if (url.includes("api.telegram.org")) return new Response(JSON.stringify({ ok: true }), { status: 200 })
  if (url.includes("/rest/v1/settings")) throw new Error("settings down")
  if (url.includes("/rest/v1/leads")) return new Response(JSON.stringify([]), { status: 200 })
  if (url.includes("/rest/v1/funnels")) throw new Error("funnels down")
  return scriptHookPrev(input, init)
}) as typeof fetch
const scriptHookKv = memoryKv()
await saveFunnelsKv(scriptHookKv, [{ ...emptySalesFunnel("Quadro ads"), id: "fun-ads" }])
const scriptHookEnv = {
  ASSETS: { fetch: async () => new Response("ok") },
  AUTH: scriptHookKv,
  SUPABASE_URL: "https://sb.test",
  SUPABASE_SERVICE_ROLE: "role",
  TELEGRAM_WEBHOOK_SECRET: "hook-secret",
  TELEGRAM_BOT_TOKEN: "000:script",
  ABILION_ENV: "development",
} as Env
const scriptMissCtx = backgroundCtx()
assert(
  (
    await handleRequest(
      new Request("http://local.test/api/telegram", {
        method: "POST",
        headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "hook-secret" },
        body: JSON.stringify({
          update_id: 8808,
          message: {
            chat: { id: 8808 },
            text: "/start fb_sdeadbeef_aabbcc11",
            from: { id: 8808, username: "scriptmiss", first_name: "Mia" },
          },
        }),
      }),
      scriptHookEnv,
      scriptMissCtx
    )
  ).status === 200,
  "webhook unread + script miss ainda é 200"
)
await scriptMissCtx.flush()
assert(
  !(await listLeads(scriptHookKv, 20, "all")).some((item) => item.contact === "@scriptmiss"),
  "/start com script unread não mint lead no funil publicado"
)
const genericFbCtx = backgroundCtx()
assert(
  (
    await handleRequest(
      new Request("http://local.test/api/telegram", {
        method: "POST",
        headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "hook-secret" },
        body: JSON.stringify({
          update_id: 8809,
          message: {
            chat: { id: 8809 },
            text: "/start fb_aabbcc11",
            from: { id: 8809, username: "scriptgen", first_name: "Gil" },
          },
        }),
      }),
      scriptHookEnv,
      genericFbCtx
    )
  ).status === 200,
  "webhook unread sem s= de script continua"
)
await genericFbCtx.flush()
assert(
  (await listLeads(scriptHookKv, 20, "all")).some((item) => item.contact === "@scriptgen" && item.origin === "facebook"),
  "/start fb_vid sem script id não depende das settings unread"
)
await saveSettingsKv(
  scriptHookKv,
  migrateSettings({
    pageScripts: [
      {
        id: "deadbeef",
        name: "Landing ads",
        funnelId: "fun-ads",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  })
)
const scriptHitCtx = backgroundCtx()
assert(
  (
    await handleRequest(
      new Request("http://local.test/api/telegram", {
        method: "POST",
        headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "hook-secret" },
        body: JSON.stringify({
          update_id: 8810,
          message: {
            chat: { id: 8810 },
            text: "/start fb_sdeadbeef_aabbcc11",
            from: { id: 8810, username: "scripthit", first_name: "Lia" },
          },
        }),
      }),
      scriptHookEnv,
      scriptHitCtx
    )
  ).status === 200,
  "webhook unread com script no KV é 200"
)
await scriptHitCtx.flush()
const scriptHit = (await listLeads(scriptHookKv, 20, "all")).find((item) => item.contact === "@scripthit")
assert(scriptHit?.funnelId === "fun-ads", "/start com script no KV liga o funil mesmo unread")
assert(scriptHit?.campaign === "Facebook · Landing ads", "/start unread usa o nome do script do KV")
await saveFunnelsKv(scriptHookKv, [
  {
    ...emptySalesFunnel("Outro quadro"),
    id: "fun-other",
    status: "active",
    production: { name: "Outro quadro", publishedAt: "2026-01-01T00:00:00.000Z", nodes: [], edges: [] },
  },
])
const scriptWrongCtx = backgroundCtx()
assert(
  (
    await handleRequest(
      new Request("http://local.test/api/telegram", {
        method: "POST",
        headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "hook-secret" },
        body: JSON.stringify({
          update_id: 8811,
          message: {
            chat: { id: 8811 },
            text: "/start fb_sdeadbeef_aabbcc11",
            from: { id: 8811, username: "scriptwrong", first_name: "Noa" },
          },
        }),
      }),
      scriptHookEnv,
      scriptWrongCtx
    )
  ).status === 200,
  "webhook unread + funil do script em falta ainda é 200"
)
await scriptWrongCtx.flush()
assert(
  !(await listLeads(scriptHookKv, 20, "all")).some((item) => item.contact === "@scriptwrong"),
  "/start com funil unread não fala o publicado leftover"
)
globalThis.fetch = scriptHookPrev
const cronEnv = { ...liveEnv, CRON_SECRET: "cron" } as Env
await upsertLeadKv(cronEnv.AUTH, {
  ...lead("due-cron"),
  channel: "telegram",
  waitUntil: new Date(Date.now() - 2000).toISOString(),
  memory: "ste:remarketing",
  stePhase: "offer",
})
await upsertLeadKv(cronEnv.AUTH, {
  ...lead("due-cron-b", "@due2"),
  channel: "telegram",
  waitUntil: new Date(Date.now() - 2000).toISOString(),
  memory: "ste:remarketing",
  stePhase: "offer",
})
const cronRes = await handleRequest(new Request("http://local.test/api/cron?secret=cron"), cronEnv, backgroundCtx())
const cronBody = (await cronRes.json()) as { ok?: boolean; advanced?: number }
assert(cronRes.status === 200 && cronBody.ok && (cronBody.advanced ?? 0) >= 2, "cron avança cada espera vencida")
const afterFirstDue = (await loadLead(cronEnv.AUTH, "due-cron"))?.waitUntil
const cronAgain = await handleRequest(new Request("http://local.test/api/cron?secret=cron"), cronEnv, backgroundCtx())
assert(cronAgain.status === 200, "segundo cron corre")
assert((await loadLead(cronEnv.AUTH, "due-cron"))?.waitUntil === afterFirstDue, "segundo cron não remói a espera já avançada")
assert(canAdvanceRemoteWait(lead("sim-wait"), false), "espera simulada avança sem token")
assert(canAdvanceRemoteWait({ ...lead("tg-wait"), telegramChatId: "8800" }, true), "espera Telegram avança com token")
assert(!canAdvanceRemoteWait({ ...lead("tg-hold"), telegramChatId: "8800" }, false), "espera Telegram sem token não avança")
assert(
  !canAdvanceRemoteWait({ ...lead("imp-wait"), channel: "whatsapp", origin: "import" }, true),
  "cron não avança import mesmo com token"
)
const dueQueued = { ...lead("due-live"), waitUntil: new Date(Date.now() - 2000).toISOString() }
const dueFuture = { ...dueQueued, waitUntil: new Date(Date.now() + 86_400_000).toISOString() }
assert(pickLiveDueLead(dueQueued, dueQueued)?.id === "due-live", "espera ainda vencida segue")
assert(pickLiveDueLead(dueQueued, dueFuture) === null, "outro cron já comeu a espera")
assert(pickLiveDueLead(dueQueued, null)?.id === "due-live", "sem KV usa a cópia da fila")
const dueStale = { ...dueQueued, waitUntil: undefined, updatedAt: "1999-01-01T00:00:00.000Z" }
assert(pickLiveDueLead(dueQueued, dueStale)?.waitUntil === dueQueued.waitUntil, "KV velho sem espera não come a fila")
const dueAte = { ...dueQueued, waitUntil: undefined, updatedAt: "2099-01-01T00:00:00.000Z" }
assert(pickLiveDueLead(dueQueued, dueAte) === null, "KV novo sem espera já comeu")
await upsertLeadKv(cronEnv.AUTH, {
  ...lead("hold-tg", "@hold"),
  telegramChatId: "8800",
  waitUntil: new Date(Date.now() - 2000).toISOString(),
  memory: "ste:remarketing",
  stePhase: "offer",
})
const holdWait = (await loadLead(cronEnv.AUTH, "hold-tg"))?.waitUntil
const holdRes = await handleRequest(new Request("http://local.test/api/cron?secret=cron"), cronEnv, backgroundCtx())
assert(holdRes.status === 200, "cron sem token corre")
assert((await loadLead(cronEnv.AUTH, "hold-tg"))?.waitUntil === holdWait, "sem token o cron não come a espera do Telegram")
assert(isTelegramAdsHref("https://t.me/steaviator?start=fb"), "pixel reescreve deep link do bot")
assert(!isTelegramAdsHref("https://t.me/+AbCdEfGhIjK"), "pixel não reescreve convite +")
assert(!isTelegramAdsHref("https://t.me/joinchat/AbCdEf"), "pixel não reescreve joinchat")
assert(TRACKER_JS.includes("joinchat") && TRACKER_JS.includes('charAt(0) === "+"'), "t.js recusa convite de grupo")
assert(TRACKER_JS.includes("auxclick") && TRACKER_JS.includes("pointerdown"), "t.js reescreve o CTA antes do clique do meio")
assert(TRACKER_JS.includes('querySelector(\'script[src*="/t.js"]\')'), "t.js aguenta async sem currentScript")

const waitId = "w-html"
const msgId = "m-html"
const offerId = "o-html"
const nowBoard = new Date().toISOString()
const htmlBoard: SalesFunnel = {
  id: "funil-cron-html",
  name: "Cron HTML",
  mode: "sales",
  status: "active",
  updatedAt: nowBoard,
  nodes: [
    { id: "e-start", type: "entry", position: { x: 0, y: 0 }, data: { title: "Start", entryTrigger: "start" } },
    { id: waitId, type: "wait", position: { x: 0, y: 0 }, data: { title: "Espera", delayHours: 1 } },
    { id: msgId, type: "message", position: { x: 0, y: 0 }, data: { title: "Texto", body: "veja [curso](https://mundoaviator.com.br/mini-curso/)" } },
    { id: offerId, type: "offer", position: { x: 0, y: 0 }, data: { title: "Oferta", body: "abre [app](https://app.mundoaviator.com.br/)", url: "https://app.mundoaviator.com.br/" } },
  ],
  edges: [
    { id: "e1", source: "e-start", target: waitId },
    { id: "e2", source: waitId, target: msgId },
    { id: "e3", source: msgId, target: offerId },
  ],
}
htmlBoard.production = { name: htmlBoard.name, publishedAt: nowBoard, nodes: htmlBoard.nodes, edges: htmlBoard.edges }
const htmlSnap = publishedSnapshot([htmlBoard])
const htmlDue = {
  ...lead("due-html", "@html"),
  telegramChatId: "9100",
  nodeId: waitId,
  waitUntil: new Date(Date.now() - 2000).toISOString(),
}
const htmlFired = applyEvent(htmlSnap, htmlDue, { type: "timer" }, Date.now())
assert(htmlFired.effects.some((item) => item.kind === "send_message"), "espera do quadro gera send_message")
assert(htmlFired.effects.some((item) => item.kind === "offer"), "espera do quadro gera oferta")
const htmlCronEnv = { ...cronEnv, TELEGRAM_BOT_TOKEN: "000:html" } as Env
await saveFunnelsKv(htmlCronEnv.AUTH, [htmlBoard])
await upsertLeadKv(htmlCronEnv.AUTH, htmlDue)
const telegramBodies: string[] = []
const prevCronFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (String(input).includes("api.telegram.org")) {
    telegramBodies.push(String(init?.body ?? ""))
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  }
  return prevCronFetch(input, init)
}) as typeof fetch
const htmlCron = await handleRequest(new Request("http://local.test/api/cron?secret=cron"), htmlCronEnv, backgroundCtx())
assert(htmlCron.status === 200, "cron da oferta do quadro corre")
const sentHtml = telegramBodies.filter((body) => body.includes("parse_mode") && body.includes("<a href="))
assert(sentHtml.length >= 2, "cron manda mensagem e oferta em HTML")
assert(telegramBodies.some((body) => body.includes("mundoaviator.com.br/mini-curso")), "cron envia o send_message")
assert(telegramBodies.some((body) => body.includes("app.mundoaviator.com.br")), "cron envia a oferta")
globalThis.fetch = prevCronFetch

const cronFailKv = memoryKv()
const cronFailEnv = {
  ASSETS: { fetch: async () => new Response("ok") },
  AUTH: cronFailKv,
  ABILION_ENV: "development",
  CRON_SECRET: "cron",
  TELEGRAM_BOT_TOKEN: "000:cronfail",
} as Env
const cronFailWait = new Date(Date.now() - 2000).toISOString()
await upsertLeadKv(cronFailKv, {
  ...lead("cron-403", "@cron403"),
  telegramChatId: "9401",
  waitUntil: cronFailWait,
  memory: "ste:remarketing",
  stePhase: "offer",
})
let cronFailCalls = 0
const cronFailPrev = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (String(input).includes("api.telegram.org")) {
    cronFailCalls += 1
    const live = await loadLead(cronFailKv, "cron-403")
    if (live) {
      await upsertLeadKv(cronFailKv, {
        ...live,
        messages: [
          ...(live.messages ?? []),
          { id: "talk-mid", at: new Date().toISOString(), role: "lead", text: "quero o app" },
        ],
        lastMessage: "quero o app",
        updatedAt: new Date().toISOString(),
      })
    }
    return new Response(JSON.stringify({ ok: false, description: "Forbidden" }), { status: 403 })
  }
  return cronFailPrev(input, init)
}) as typeof fetch
const cronFailRes = await handleRequest(new Request("http://local.test/api/cron?secret=cron"), cronFailEnv, backgroundCtx())
assert(cronFailRes.status === 200, "cron com Telegram 403 ainda é 200")
const cronFailBody = (await cronFailRes.json()) as { advanced?: number }
assert((cronFailBody.advanced ?? 1) === 0, "cron não conta avanço se o Telegram recusou")
const cronFailLead = await loadLead(cronFailKv, "cron-403")
assert(cronFailLead?.waitUntil === cronFailWait, "Telegram 403 devolve a espera")
assert(!(cronFailLead?.messages ?? []).some((item) => item.role === "ste"), "Telegram 403 não grava remarketing")
assert((cronFailLead?.messages ?? []).some((item) => item.text === "quero o app"), "Telegram 403 não apaga fala que chegou a meio")
assert(cronFailCalls > 0, "cron tentou mandar")
const cronFailAgain = await handleRequest(new Request("http://local.test/api/cron?secret=cron"), cronFailEnv, backgroundCtx())
assert(cronFailAgain.status === 200, "segundo cron com 403 corre")
assert(cronFailCalls > 1, "segundo cron tenta outra vez a espera restaurada")
assert((await loadLead(cronFailKv, "cron-403"))?.waitUntil === cronFailWait, "segundo 403 mantém a espera")

const boardFailKv = memoryKv()
const boardFailEnv = { ...cronFailEnv, AUTH: boardFailKv, TELEGRAM_BOT_TOKEN: "000:boardfail" } as Env
await saveFunnelsKv(boardFailKv, [htmlBoard])
const boardWait = new Date(Date.now() - 2000).toISOString()
await upsertLeadKv(boardFailKv, {
  ...lead("due-board-fail", "@boardfail"),
  telegramChatId: "9501",
  nodeId: waitId,
  waitUntil: boardWait,
})
const boardFailCallsBefore = cronFailCalls
const boardFailRes = await handleRequest(new Request("http://local.test/api/cron?secret=cron"), boardFailEnv, backgroundCtx())
assert(boardFailRes.status === 200, "cron do quadro com 403 ainda é 200")
const boardFailBody = (await boardFailRes.json()) as { advanced?: number }
assert((boardFailBody.advanced ?? 1) === 0, "quadro não avança se o Telegram recusou")
const boardFailLead = await loadLead(boardFailKv, "due-board-fail")
assert(boardFailLead?.waitUntil === boardWait, "403 do quadro devolve a espera")
assert(boardFailLead?.nodeId === waitId, "403 do quadro mantém o nó da espera")
assert(cronFailCalls > boardFailCallsBefore, "cron do quadro tentou mandar")
globalThis.fetch = cronFailPrev

const hugePixel = await handleRequest(
  new Request("http://local.test/api/track", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind: "view", visitorId: "aabbcc", extra: "x".repeat(9000) }),
  }),
  liveEnv,
  backgroundCtx()
)
assert(hugePixel.status === 413, "pixel recusa corpo enorme")
const badPixel = await handleRequest(
  new Request("http://local.test/api/track", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  }),
  liveEnv,
  backgroundCtx()
)
assert(badPixel.status === 400, "pixel recusa JSON inválido")

const inboxLead = simulateOpenLead([emptySalesFunnel("inbox")])
assert(!inboxLead.steBlocked && !inboxLead.steQuiet, "simular conversa não encerra")
assert((inboxLead.messages ?? []).some((item) => item.role === "lead"), "simular conversa tem fala do lead")
assert((inboxLead.messages ?? []).some((item) => item.role === "ste"), "simular conversa tem resposta da Sté")
assert(inboxLead.stePhase !== "closed", "simular conversa fica no funil")
assert(!inboxLead.telegramChatId, "simular conversa não inventa chat id")
assert(canTickSteLocally(inboxLead), "simulação avança no painel")
assert(canSimulateSte(inboxLead), "simulação no painel só para lead sem chat")
assert(!canTickSteLocally({ ...inboxLead, telegramChatId: "9001" }), "lead real do Telegram não avança no painel")
assert(!canTickSteLocally({ ...inboxLead, channel: "whatsapp" }), "import WhatsApp não avança o quadro no painel")
assert(!canSimulateSte({ ...inboxLead, channel: "whatsapp" }), "import WhatsApp não simula a Sté")
assert(isImportedLead({ origin: "import", channel: "whatsapp" }), "WhatsApp importado conta como lista antiga")
assert(migrateLeadOrigin("import") === "import", "origem import sobrevive")
assert(migrateLeadOrigin("pagina") === "popup", "pagina da lista antiga vira popup")
assert(migrateLeadOrigin("private") === "private", "privado /start fica")
assert(migrateLead({ id: "imp", origin: "import" }).origin === "import", "migrateLead conserva import")
assert(eventFromOrigin("import").type === "capture", "import entra como captura, não /start")
assert(campaignFor("whatsapp", "import") === "Importado", "campanha da lista antiga é Importado")
assert(!canSimulateSte({ ...inboxLead, telegramChatId: "9001" }), "lead real do Telegram não simula no painel")
assert(!canSimulateSte({ ...inboxLead, steBlocked: true }), "lead encerrado não simula")
assert(!canSimulateSte({ ...inboxLead, steQuiet: true }), "lead quieto não simula")
function publishedBoard(id: string, name: string, publishedAt: string, welcome: string) {
  const base = { ...emptySalesFunnel(name), id, status: "active" as const }
  const nodes = base.nodes.map((node) =>
    node.data.steLine === "welcome" && node.data.body === STE_WELCOME[0]
      ? { ...node, data: { ...node.data, body: welcome } }
      : node
  )
  return { ...base, nodes, production: { name, publishedAt, nodes, edges: base.edges } }
}
const leftoverBoard = publishedBoard("fun-new", "Novo", "2026-09-20T12:00:00.000Z", "publicado leftover")
const adsBoard = publishedBoard("fun-ads", "Ads", "2026-01-01T00:00:00.000Z", "landing do anúncio")
assert(steRuntimeFromFunnels([leftoverBoard, adsBoard], null).welcome?.[0] === "publicado leftover", "sem funnelId o painel usaria o publicado leftover")
assert(steRuntimeFromFunnels([leftoverBoard, adsBoard], null, "fun-ads").welcome?.[0] === "landing do anúncio", "painel com funnelId fala a landing, não o leftover")
assert(snapshotForLead([leftoverBoard, adsBoard], { funnelId: "fun-ads" })?.name === "Ads", "ficha do CRM lê o quadro da landing")
assert(publishedSnapshot([leftoverBoard, adsBoard])?.name === "Novo", "publicado leftover é o mais recente")
const adsSim = { ...inboxLead, funnelId: "fun-ads" }
assert(!canTickSteLocally(adsSim, { funnelsUnread: true, funnels: [] }), "painel unread + funil miss não avança leftover")
assert(!canSimulateSte(adsSim, { funnelsUnread: true, funnels: [] }), "simular lead unread + funil miss bloqueia")
assert(canTickSteLocally(adsSim, { funnelsUnread: true, funnels: [{ id: "fun-ads" }] }), "funil leftover no cache segue no painel")
assert(canSimulateSte(adsSim, { funnelsUnread: true, funnels: [adsBoard] }), "simular segue se o funil leftover está no cache")
assert(canTickSteLocally({ ...inboxLead, funnelId: undefined }, { funnelsUnread: true, funnels: [] }), "sem funnelId o publicado leftover segue")
assert(!canTickSteLocally({ ...adsSim, telegramChatId: "9001" }, { funnelsUnread: false, funnels: [adsBoard] }), "Telegram real continua trancado mesmo com funil confirmado")
assert(!canSimulateSte({ ...adsSim, telegramChatId: "9001" }, { funnelsUnread: true, funnels: [] }), "Telegram real não desbloqueia por unread")
const burstOne = burstFacebookLeads([emptySalesFunnel("lote-um")], 1)[0]
assert(burstOne?.steBlocked, "o primeiro do lote de 100 ainda testa ofensa")
assert(!burstOne?.telegramChatId, "lote não inventa chat id")
const burstMix = burstStats(burstFacebookLeads([emptySalesFunnel("lote")], 100))
assert(burstMix.blocked >= 1 && burstMix.talking >= 1, "lote Facebook mistura abertos e encerrados")
assert(barShare(0, 0) === 0, "barra vazia fica em 0")
assert(barShare(5, 5) === 100, "barra igual ao total é 100")
assert(barShare(2, 10) === 20, "barra compara com o total")
assert(pixelFigure("loading", false, 0) === "…", "pixel a carregar nao finge zero")
assert(pixelFigure("error", false, 0) === "—", "pixel falhou nao finge zero")
assert(pixelFigure("error", true, 12) === 12, "pixel falhou depois guarda a ultima leitura")
assert(pixelFigure("ok", true, 0) === 0, "pixel vazio de verdade continua zero")
assert(pixelMapHint("loading", false, false) === "A carregar o pixel…", "globo a carregar nao finge sem geo")
assert(pixelMapHint("error", false, false) === "Sem leitura do pixel.", "globo falhou nao finge sem geo")
assert(pixelMapHint("ok", true, false) === "Sem geo ainda. Arrasta para girar.", "globo vazio de verdade continua sem geo")
assert(pixelMapEmpty("error", false).includes("não é um mapa vazio"), "globo falhou explica que não é vazio")
assert(pixelMapEmpty("loading", false).includes("A carregar"), "globo a carregar pede espera")
assert(pixelGeoEmpty("loading", false) === "…", "UF a carregar nao finge sem estado")
assert(pixelGeoEmpty("error", false) === "—", "UF falhou nao finge sem estado")
assert(pixelGeoEmpty("ok", true) === "Sem estado", "UF vazia de verdade continua sem estado")
assert(pixelGeoEmpty("error", false, "Estado ainda sem rastreio") === "—", "ficha unread nao diz sem rastreio")
assert(funnelsWriteBlocked("error"), "publicar com CRM unread usa o mesmo bloqueio da captura")
assert(pixelDropFigure("loading", false, 0.4) === "…", "seta do funil a carregar nao finge conversao")
assert(pixelDropFigure("error", false, 0.4) === "—", "seta do funil sem leitura nao finge conversao")
assert(pixelDropFigure("ok", true, null) === "—", "seta sem taxa fica em dash")
assert(pixelDropFigure("ok", true, 0.5) === "50%", "seta com taxa formata")
assert(leadsHydrating("idle", 0), "KPI espera o GET se a lista está vazia")
assert(!leadsHydrating("idle", 3), "KPI com cache local não esconde o número")
assert(!leadsHydrating("ok", 0), "KPI vazio depois do GET é zero de verdade")
assert(leadsLoadFailed("error", 0), "GET falhou sem cache não é lista vazia")
assert(!leadsLoadFailed("error", 3), "GET falhou com cache local ainda mostra os números")
assert(!leadsLoadFailed("ok", 0), "GET vazio de verdade não é falha")
assert(leadsHydrating("idle", 0), "conversas sem Telegram ainda hidratam mesmo com WhatsApp em cache")
assert(leadsLoadFailed("ok", 0, true), "inbox falhou sem conversas não é inbox vazia")
assert(!leadsLoadFailed("ok", 2, true), "inbox falhou com conversas em cache ainda mostra a lista")
assert(metricPending("idle", 0), "KPI de conversas hidrata sem recorte Telegram")
assert(!metricPending("idle", 4), "KPI de conversas com cache Telegram já conta")
assert(metricPending("ok", 0, true), "KPI de conversas com inbox falhada não finge zero")
assert(!metricPending("ok", 0), "KPI de conversas vazio depois do GET é zero")
assert(!metricPending("error", 3), "KPI de conversas com cache ainda mostra o número")
assert(metricPending("error", 0), "campanha Telegram/Facebook sem recorte e GET falho fica …")
assert(leadMatchesFilter(lead("wa-1"), "telegram"), "lead Telegram entra no filtro Telegram")
assert(!leadMatchesFilter({ ...lead("wa-2"), channel: "whatsapp", origin: "import" }, "telegram"), "WhatsApp não entra no filtro Telegram")
assert(leadFilterCount([{ ...lead("wa-3"), channel: "whatsapp", origin: "import" }], "telegram") === 0, "recorte Telegram vazio com WhatsApp")
assert(leadFilterPending("idle", 0, "telegram"), "filtro Telegram hidrata sem cache daquele canal")
assert(!leadFilterPending("idle", 8, "whatsapp"), "filtro WhatsApp com cache já conta")
assert(leadFilterPending("ok", 0, "telegram", true), "filtro Telegram com inbox falhada não finge vazio")
assert(!leadFilterPending("ok", 0, "whatsapp", true), "filtro WhatsApp vazio depois do GET é vazio")
assert(!leadFilterPending("ok", 0, "facebook", true), "filtro Facebook vazio depois do GET é vazio")
assert(!leadFilterPending("ok", 0, "import", true), "filtro Importados vazio depois do GET é vazio")
assert(!catalogMetricPending("ok", 0, true), "passo Chat / joins com GET ok e inbox falha é zero")
assert(catalogMetricPending("idle", 0, true), "passo Chat / joins hidrata sem recorte")
assert(catalogMetricPending("error", 0, true), "passo Chat / joins sem GET fica …")
assert(!catalogMetricPending("ok", 3, true), "passo Chat / joins com cache mostra o número")
assert(usersWriteBlocked(null, ""), "equipa a carregar bloqueia criar")
assert(usersWriteBlocked(null, "Não li as contas."), "equipa sem leitura bloqueia criar")
assert(usersWriteBlocked([{ id: "1" }], "Não li as contas."), "equipa leftover com GET falho bloqueia criar")
assert(!usersWriteBlocked([], ""), "equipa vazia confirmada deixa criar")
assert(!usersWriteBlocked([{ id: "1" }], ""), "equipa lida deixa criar")
assert(leadTimelinePending("idle", 0), "timeline hidrata sem eventos")
assert(leadTimelinePending("error", 0), "timeline unread sem eventos não finge vazia")
assert(!leadTimelinePending("ok", 0), "timeline confirmada vazia esconde a lista")
assert(!leadTimelinePending("error", 2), "timeline unread com eventos do KV ainda mostra")
assert(offerMetricPending("ok", "error", 0), "KPI de ofertas unread sem eventos não finge zero")
assert(!offerMetricPending("ok", "error", 3), "KPI de ofertas unread com leftover ainda conta")
assert(!offerMetricPending("ok", "ok", 0), "KPI de ofertas confirmado vazio é zero")
assert(offerMetricPending("ok", "ok", 0, true), "KPI de ofertas no recorte clipped não finge zero")
assert(offerMetricPending("idle", "idle", 0), "KPI de ofertas hidrata sem catálogo")
assert(eventsSyncAfterNarrowRead("ok", true) === "error", "inbox/busca unread marca a timeline")
assert(eventsSyncAfterNarrowRead("error", false) === "error", "inbox/busca sem unread não confirma a timeline")
assert(eventsSyncAfterNarrowRead("idle", false) === "idle", "inbox/busca cedo não confirma a timeline")
assert(eventsSyncAfterNarrowRead("ok", false) === "ok", "inbox/busca sem unread conserva o GET confirmado")
assert(trackSyncAfterRead(true) === "error", "trackUnread leftover não é Pixel ao vivo")
assert(trackSyncAfterRead(false) === "ok", "summary confirmado é ao vivo")
assert(parseTrackSummary({ summary: { views: 4 }, trackUnread: true })?.unread === true, "cliente não larga o trackUnread")
assert(parseTrackSummary({ summary: { views: 4 }, trackUnread: true })?.summary.views === 4, "leftover do pixel continua no cliente")
assert(parseTrackSummary({ summary: emptySummary() })?.unread === false, "200 sem trackUnread confirma o pixel")
assert(parseTrackSummary({ ok: true }) === null, "summary em falta não inventa zeros")
assert(pixelFigure(trackSyncAfterRead(true), true, 12) === 12, "trackUnread ainda mostra o leftover")
assert(linkRuntimeSettings(null, { telegramBotUsername: "ste" }) === null, "Vincular sem settings não inventa um objecto oco")
assert(
  linkRuntimeSettings(emptySettings(), { telegramBotUsername: "ste_bot", telegramBotToken: "tok" })?.telegramBotUsername ===
    "ste_bot",
  "Vincular copia o username para as settings"
)
assert(
  linkRuntimeSettings(
    {
      ...emptySettings(),
      pageScripts: [{ id: "aabbccdd", name: "Ads", funnelId: "fun-1", createdAt: "t", updatedAt: "t" }],
    },
    { telegramBotUsername: "ste_bot" }
  )?.pageScripts[0]?.id === "aabbccdd",
  "Vincular não apaga scripts de página"
)

const telegramOk = await telegramCall(
  "tok",
  "sendMessage",
  { chat_id: "1", text: "oi" },
  async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
  async () => undefined
)
assert(telegramOk.ok, "telegram 200 ok conta como enviado")
const telegramDenied = await telegramCall(
  "tok",
  "sendMessage",
  { chat_id: "1", text: "oi" },
  async () => new Response(JSON.stringify({ ok: false, description: "Forbidden: bot was blocked" }), { status: 403 }),
  async () => undefined
)
assert(!telegramDenied.ok && !telegramDenied.retryable && telegramDenied.status === 403, "telegram 403 não finge sucesso")
const telegramApiFalse = await telegramCall(
  "tok",
  "sendMessage",
  { chat_id: "1", text: "oi" },
  async () => new Response(JSON.stringify({ ok: false, description: "chat not found" }), { status: 200 }),
  async () => undefined
)
assert(!telegramApiFalse.ok && telegramApiFalse.status === 200, "telegram ok:false não finge sucesso")
let telegramAttempts = 0
const telegramRetry = await telegramCall(
  "tok",
  "sendMessage",
  { chat_id: "1", text: "oi" },
  async () => {
    telegramAttempts += 1
    if (telegramAttempts < 3) return new Response("busy", { status: 500 })
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  },
  async () => undefined
)
assert(telegramRetry.ok && telegramAttempts === 3, "telegram 500 tenta de novo")

const throttleEnv = {
  ASSETS: { fetch: async () => new Response("ok") },
  SUPABASE_URL: "https://example.supabase.co",
  AUTH: memoryKv(),
  ABILION_ENV: "development",
} as Env
const throttleLogin = await handleRequest(
  new Request("http://local.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.70" },
    body: JSON.stringify({ email: "victor@abilion.com", password: "senhaok" }),
  }),
  throttleEnv,
  backgroundCtx()
)
assert(throttleLogin.status === 200, "login para o limite de escrita")
const throttleCookie = throttleLogin.headers.get("set-cookie") || ""
const throttleFunnel = emptySalesFunnel("limite-crm")
const crmHit = () =>
  handleRequest(
    new Request("http://local.test/api/crm", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: throttleCookie, "x-forwarded-for": "198.51.100.70" },
      body: JSON.stringify({ funnels: [throttleFunnel] }),
    }),
    throttleEnv,
    backgroundCtx()
  )
for (let i = 0; i < 80; i++) assert((await crmHit()).status === 200, `crm ${i + 1} ainda entra no throttle`)
assert((await crmHit()).status === 429, "81º CRM bloqueia")
const leadHit = () =>
  handleRequest(
    new Request("http://local.test/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: throttleCookie, "x-forwarded-for": "198.51.100.70" },
      body: JSON.stringify({ lead: lead("limite-lead", "@limite") }),
    }),
    throttleEnv,
    backgroundCtx()
  )
for (let i = 0; i < 40; i++) assert((await leadHit()).status === 200, `lead ${i + 1} ainda entra no throttle`)
assert((await leadHit()).status === 429, "41º POST de lead bloqueia")
const deleteHit = () =>
  handleRequest(
    new Request("http://local.test/api/leads?id=limite-lead", {
      method: "DELETE",
      headers: { cookie: throttleCookie, "x-forwarded-for": "198.51.100.70" },
    }),
    throttleEnv,
    backgroundCtx()
  )
for (let i = 0; i < 30; i++) assert((await deleteHit()).status === 200, `delete ${i + 1} ainda entra no throttle`)
assert((await deleteHit()).status === 429, "31º DELETE de lead bloqueia")

const ghostDue = lead("ghost-due", "@ghost")
ghostDue.waitUntil = new Date(Date.now() - 2000).toISOString()
ghostDue.telegramChatId = "77"
ghostDue.channel = "telegram"
const ghostEnv = {
  ASSETS: { fetch: async () => new Response("ok") },
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE: "role",
  AUTH: memoryKv(),
  CRON_SECRET: "cron",
  ABILION_ENV: "development",
} as Env
await deleteLeadKv(ghostEnv.AUTH, ghostDue.id)
await ghostEnv.AUTH.put(CRM_REMOVED, JSON.stringify({ ids: [] }))
assert(!(await loadRemovedLeadIds(ghostEnv.AUTH)).includes(ghostDue.id), "lista do ghost rolou")
assert(await isLeadRemoved(ghostEnv.AUTH, ghostDue.id), "gone do ghost sobrevive à lista")
const ghostRow = {
  id: ghostDue.id,
  name: ghostDue.name,
  contact: ghostDue.contact,
  channel: ghostDue.channel,
  campaign: ghostDue.campaign,
  origin: ghostDue.origin,
  temperature: ghostDue.temperature,
  stage: ghostDue.stage,
  memory: ghostDue.memory,
  facts: {},
  events: [],
  messages: [],
  telegram_chat_id: ghostDue.telegramChatId,
  wait_until: ghostDue.waitUntil,
  updated_at: ghostDue.updatedAt,
  created_at: ghostDue.createdAt,
}
const ghostFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input)
  if (url.includes("/rest/v1/leads") && url.includes("wait_until")) {
    return new Response(JSON.stringify([ghostRow]), { status: 200, headers: { "content-type": "application/json" } })
  }
  return new Response("[]", { status: 200, headers: { "content-type": "application/json" } })
}) as typeof fetch
try {
  const ghostCron = await handleRequest(new Request("http://local.test/api/cron?secret=cron"), ghostEnv, backgroundCtx())
  const ghostBody = (await ghostCron.json()) as { ok?: boolean; advanced?: number; remoteUnread?: boolean }
  assert(ghostCron.status === 200 && ghostBody.ok && ghostBody.advanced === 0, "cron ignora espera tombstoned do Supabase")
  assert(!ghostBody.remoteUnread, "due remoto que leu não é unread")
  assert((await loadLead(ghostEnv.AUTH, ghostDue.id)) === null, "cron nao ressuscita lead apagado")
} finally {
  globalThis.fetch = ghostFetch
}

const holeWait = new Date(Date.now() - 2000).toISOString()
const holeLead = {
  ...lead("due-hole", "@duehole"),
  waitUntil: holeWait,
  memory: "ste:remarketing",
  stePhase: "offer" as const,
}
const holeKv = memoryKv()
await holeKv.put(
  CRM_INDEX,
  JSON.stringify({
    entries: [
      {
        id: holeLead.id,
        contact: holeLead.contact,
        waitUntil: holeWait,
        updatedAt: holeLead.updatedAt,
        channel: "telegram",
      },
    ],
  })
)
const holeEnv = {
  ASSETS: { fetch: async () => new Response("ok") },
  SUPABASE_URL: "https://sb.test",
  SUPABASE_SERVICE_ROLE: "role",
  AUTH: holeKv,
  CRON_SECRET: "cron",
  ABILION_ENV: "development",
} as Env
const holeRow = {
  id: holeLead.id,
  name: holeLead.name,
  contact: holeLead.contact,
  channel: holeLead.channel,
  campaign: holeLead.campaign,
  origin: holeLead.origin,
  temperature: holeLead.temperature,
  stage: holeLead.stage,
  memory: holeLead.memory,
  facts: {},
  events: [],
  messages: [],
  ste_phase: holeLead.stePhase,
  wait_until: holeWait,
  updated_at: holeLead.updatedAt,
  created_at: holeLead.createdAt,
}
const holeFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input)
  if (url.includes("/rest/v1/leads") && url.includes("id=in.") && url.includes("due-hole")) {
    return new Response(JSON.stringify([holeRow]), { status: 200, headers: { "content-type": "application/json" } })
  }
  return new Response("[]", { status: 200, headers: { "content-type": "application/json" } })
}) as typeof fetch
try {
  const holeCron = await handleRequest(new Request("http://local.test/api/cron?secret=cron"), holeEnv, backgroundCtx())
  const holeBody = (await holeCron.json()) as { ok?: boolean; advanced?: number; remoteUnread?: boolean }
  assert(holeCron.status === 200 && holeBody.ok && holeBody.advanced === 1, "cron avança espera oca pelo id no Postgres")
  assert(!holeBody.remoteUnread, "due remoto vazio confirmado não é unread")
  assert((await loadLead(holeKv, "due-hole"))?.id === "due-hole", "cron gravou o avanço da espera oca")
  assert((await loadLead(holeKv, "due-hole"))?.waitUntil !== holeWait, "cron comeu a espera oca")
} finally {
  globalThis.fetch = holeFetch
}

const thinWait = new Date(Date.now() - 2000).toISOString()
const thinKv = memoryKv()
await thinKv.put(
  leadKey("due-thin-cron"),
  JSON.stringify({
    ...lead("due-thin-cron", "@duethincron"),
    updatedAt: "1999-01-01T00:00:00.000Z",
    memory: "ste:remarketing",
    stePhase: "offer",
  })
)
await thinKv.put(
  CRM_INDEX,
  JSON.stringify({
    entries: [
      {
        id: "due-thin-cron",
        contact: "@duethincron",
        waitUntil: thinWait,
        updatedAt: thinWait,
        channel: "telegram",
      },
    ],
  })
)
const thinEnv = {
  ASSETS: { fetch: async () => new Response("ok") },
  SUPABASE_URL: "https://sb.test",
  SUPABASE_SERVICE_ROLE: "role",
  AUTH: thinKv,
  CRON_SECRET: "cron",
  ABILION_ENV: "development",
} as Env
const thinRow = {
  id: "due-thin-cron",
  name: "Talk",
  contact: "@duethincron",
  channel: "telegram" as const,
  campaign: "facebook",
  origin: "facebook" as const,
  temperature: "novo" as const,
  stage: "welcome" as const,
  memory: "ste:remarketing",
  facts: {},
  messages: [],
  ste_phase: "offer",
  wait_until: thinWait,
  updated_at: thinWait,
  created_at: thinWait,
}
const thinFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input)
  if (url.includes("/rest/v1/leads") && (url.includes("due-thin-cron") || url.includes("wait_until"))) {
    return new Response(JSON.stringify([thinRow]), { status: 200, headers: { "content-type": "application/json" } })
  }
  return new Response("[]", { status: 200, headers: { "content-type": "application/json" } })
}) as typeof fetch
try {
  const thinCron = await handleRequest(new Request("http://local.test/api/cron?secret=cron"), thinEnv, backgroundCtx())
  const thinBody = (await thinCron.json()) as { ok?: boolean; advanced?: number }
  assert(thinCron.status === 200 && thinBody.ok && (thinBody.advanced ?? 0) >= 1, "cron avança espera que o KV velho tinha perdido")
  assert((await loadLead(thinKv, "due-thin-cron"))?.waitUntil !== thinWait, "cron comeu a espera da ficha oca")
} finally {
  globalThis.fetch = thinFetch
}

const unreadDueKv = memoryKv()
const unreadWait = new Date(Date.now() - 2000).toISOString()
await upsertLeadKv(unreadDueKv, {
  ...lead("due-kv", "@duekv"),
  waitUntil: unreadWait,
  memory: "ste:remarketing",
  stePhase: "offer",
})
const unreadDueEnv = {
  ASSETS: { fetch: async () => new Response("ok") },
  SUPABASE_URL: "https://sb.test",
  SUPABASE_SERVICE_ROLE: "role",
  AUTH: unreadDueKv,
  CRON_SECRET: "cron",
  ABILION_ENV: "development",
} as Env
const unreadDueFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input)
  if (url.includes("/rest/v1/leads")) throw new Error("postgres down")
  return new Response("[]", { status: 200, headers: { "content-type": "application/json" } })
}) as typeof fetch
try {
  const unreadCron = await handleRequest(new Request("http://local.test/api/cron?secret=cron"), unreadDueEnv, backgroundCtx())
  const unreadBody = (await unreadCron.json()) as { ok?: boolean; advanced?: number; remoteUnread?: boolean }
  assert(unreadCron.status === 200 && unreadBody.ok && unreadBody.advanced === 1, "cron avança a espera do KV com Postgres unread")
  assert(unreadBody.remoteUnread, "Postgres em baixo marca remoteUnread no cron")
  assert((await loadLead(unreadDueKv, "due-kv"))?.waitUntil !== unreadWait, "espera do KV avançou mesmo unread")
} finally {
  globalThis.fetch = unreadDueFetch
}

const dueTalkWait = new Date(Date.now() - 2000).toISOString()
const dueTalkKv = memoryKv()
await upsertLeadKv(dueTalkKv, {
  ...lead("due-talk", "@duetalk"),
  waitUntil: dueTalkWait,
  updatedAt: "2026-06-02T00:00:00.000Z",
  memory: "ste:remarketing",
  stePhase: "offer",
  messages: [{ id: "m-kv", at: "2026-06-02T00:00:00.000Z", role: "user" as const, text: "agora" }],
})
const dueTalkEnv = {
  ASSETS: { fetch: async () => new Response("ok") },
  SUPABASE_URL: "https://sb.test",
  SUPABASE_SERVICE_ROLE: "role",
  AUTH: dueTalkKv,
  CRON_SECRET: "cron",
  ABILION_ENV: "development",
} as Env
const dueTalkRow = {
  id: "due-talk",
  name: "Talk",
  contact: "@duetalk",
  channel: "telegram" as const,
  campaign: "facebook",
  origin: "facebook" as const,
  temperature: "novo" as const,
  stage: "welcome" as const,
  memory: "ficha no backup",
  facts: {},
  messages: [{ id: "m-pg", at: "2026-06-01T00:00:00.000Z", role: "ste" as const, text: "já falámos" }],
  wait_until: dueTalkWait,
  updated_at: "2026-06-01T00:00:00.000Z",
  created_at: "2026-06-01T00:00:00.000Z",
}
const dueTalkFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input)
  if (url.includes("/rest/v1/leads") && url.includes("id=in.") && url.includes("due-talk")) {
    return new Response(JSON.stringify([dueTalkRow]), { status: 200, headers: { "content-type": "application/json" } })
  }
  return new Response("[]", { status: 200, headers: { "content-type": "application/json" } })
}) as typeof fetch
try {
  const dueTalkCron = await handleRequest(new Request("http://local.test/api/cron?secret=cron"), dueTalkEnv, backgroundCtx())
  const dueTalkBody = (await dueTalkCron.json()) as { ok?: boolean; advanced?: number }
  assert(dueTalkCron.status === 200 && dueTalkBody.ok && (dueTalkBody.advanced ?? 0) >= 1, "cron avança a espera hidratada")
  const dueTalked = await loadLead(dueTalkKv, "due-talk")
  assert(dueTalked?.messages.some((item) => item.id === "m-pg"), "cron não responde sem as falas do backup")
  assert(dueTalked?.messages.some((item) => item.id === "m-kv"), "cron conserva as falas do KV")
} finally {
  globalThis.fetch = dueTalkFetch
}

const funnelMissWait = new Date(Date.now() - 2000).toISOString()
const funnelMissKv = memoryKv()
await saveFunnelsKv(funnelMissKv, [
  {
    ...emptySalesFunnel("Outro quadro"),
    id: "fun-other",
    status: "active",
    production: { name: "Outro quadro", publishedAt: "2026-01-01T00:00:00.000Z", nodes: [], edges: [] },
  },
])
await upsertLeadKv(funnelMissKv, {
  ...lead("due-funnel-miss", "@duemiss"),
  waitUntil: funnelMissWait,
  memory: "ste:remarketing",
  stePhase: "offer",
  funnelId: "fun-ads",
})
await upsertLeadKv(funnelMissKv, {
  ...lead("due-funnel-ok", "@dueok"),
  waitUntil: funnelMissWait,
  memory: "ste:remarketing",
  stePhase: "offer",
})
const funnelMissEnv = {
  ASSETS: { fetch: async () => new Response("ok") },
  SUPABASE_URL: "https://sb.test",
  SUPABASE_SERVICE_ROLE: "role",
  AUTH: funnelMissKv,
  CRON_SECRET: "cron",
  ABILION_ENV: "development",
} as Env
const funnelMissFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input)
  if (url.includes("/rest/v1/funnels")) throw new Error("funnels down")
  return new Response("[]", { status: 200, headers: { "content-type": "application/json" } })
}) as typeof fetch
try {
  const funnelMissCron = await handleRequest(new Request("http://local.test/api/cron?secret=cron"), funnelMissEnv, backgroundCtx())
  const funnelMissBody = (await funnelMissCron.json()) as { ok?: boolean; advanced?: number; funnelsUnread?: boolean }
  assert(funnelMissCron.status === 200 && funnelMissBody.ok && funnelMissBody.advanced === 1, "cron avança a espera sem funil preso")
  assert(funnelMissBody.funnelsUnread, "cron marca funis unread quando o quadro do lead falha")
  assert((await loadLead(funnelMissKv, "due-funnel-miss"))?.waitUntil === funnelMissWait, "espera do funil unread não cai no publicado leftover")
  assert((await loadLead(funnelMissKv, "due-funnel-ok"))?.waitUntil !== funnelMissWait, "espera sem funnelId avança no leftover")
} finally {
  globalThis.fetch = funnelMissFetch
}

const cronKvDown = memoryKv()
const cronKvDownWait = new Date(Date.now() - 2000).toISOString()
const cronKvDownRow = {
  id: "due-pg-only",
  name: "Pg Due",
  contact: "@duepg",
  channel: "telegram" as const,
  campaign: "facebook",
  origin: "facebook" as const,
  temperature: "novo" as const,
  stage: "welcome" as const,
  memory: "ste:remarketing",
  facts: {},
  messages: [],
  ste_phase: "offer",
  wait_until: cronKvDownWait,
  updated_at: cronKvDownWait,
  created_at: cronKvDownWait,
}
const cronKvDownAuth = {
  async get(key: string, type: "json") {
    if (key === CRM_INDEX || String(key).startsWith("crm:lead:")) throw new Error("kv down")
    return cronKvDown.get(key, type)
  },
  async put(key: string, value: string) {
    return cronKvDown.put(key, value)
  },
}
const cronKvDownEnv = {
  ASSETS: { fetch: async () => new Response("ok") },
  SUPABASE_URL: "https://sb.test",
  SUPABASE_SERVICE_ROLE: "role",
  AUTH: cronKvDownAuth,
  CRON_SECRET: "cron",
  ABILION_ENV: "development",
} as Env
const cronKvDownFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input)
  if (url.includes("/rest/v1/leads") && (url.includes("wait_until") || url.includes("due-pg-only"))) {
    return new Response(JSON.stringify([cronKvDownRow]), { status: 200, headers: { "content-type": "application/json" } })
  }
  return new Response("[]", { status: 200, headers: { "content-type": "application/json" } })
}) as typeof fetch
try {
  const cronKvDownRes = await handleRequest(new Request("http://local.test/api/cron?secret=cron"), cronKvDownEnv, backgroundCtx())
  const cronKvDownBody = (await cronKvDownRes.json()) as { ok?: boolean; advanced?: number; remoteUnread?: boolean; error?: string }
  assert(cronKvDownRes.status === 200 && cronKvDownBody.ok, "cron com índice KV throw não é Falha interna")
  assert((cronKvDownBody.advanced ?? 0) >= 1, "cron avança a espera que só está no Postgres")
  assert(cronKvDownBody.remoteUnread, "índice KV throw marca o due como unread")
  assert(cronKvDownBody.error !== "Falha interna.", "cron KV throw não vaza 500")
} finally {
  globalThis.fetch = cronKvDownFetch
}

const cronLockDownEnv = {
  ASSETS: { fetch: async () => new Response("ok") },
  SUPABASE_URL: "https://sb.test",
  SUPABASE_SERVICE_ROLE: "role",
  AUTH: {
    async get() {
      throw new Error("kv down")
    },
    async put() {},
  },
  CRON_SECRET: "cron",
  ABILION_ENV: "development",
} as Env
const cronLockDown = await handleRequest(new Request("http://local.test/api/cron?secret=cron"), cronLockDownEnv, backgroundCtx())
const cronLockDownBody = (await cronLockDown.json()) as { ok?: boolean; advanced?: number; remoteUnread?: boolean; error?: string }
assert(cronLockDown.status === 200 && cronLockDownBody.ok, "cron com lock KV throw não é 500")
assert(cronLockDownBody.advanced === 0 && cronLockDownBody.remoteUnread, "sem lock o cron não inventa tick vazio confirmado")
assert(cronLockDownBody.error !== "Falha interna.", "lock KV throw não vaza Falha interna")

const goneRemote = lead("gone-remote", "@goneremote")
goneRemote.telegramChatId = "9901"
const goneRemoteKv = memoryKv()
await rememberRemovedLead(goneRemoteKv, goneRemote.id)
await goneRemoteKv.put(CRM_REMOVED, JSON.stringify({ ids: [] }))
const goneRemoteEnv = {
  ASSETS: { fetch: async () => new Response("ok") },
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE: "role",
  AUTH: goneRemoteKv,
  TELEGRAM_WEBHOOK_SECRET: "hook-secret",
  TELEGRAM_BOT_TOKEN: "000:gone",
  CRON_SECRET: "cron",
  ABILION_ENV: "development",
} as Env
const goneRemoteRow = {
  id: goneRemote.id,
  name: goneRemote.name,
  contact: goneRemote.contact,
  channel: "telegram",
  campaign: goneRemote.campaign,
  origin: goneRemote.origin,
  temperature: "novo",
  stage: "welcome",
  memory: "nota antiga",
  facts: {},
  messages: [{ id: "old-ste", at: goneRemote.updatedAt, role: "ste", text: "fala antiga" }],
  telegram_chat_id: "9901",
  updated_at: goneRemote.updatedAt,
  created_at: goneRemote.createdAt,
  wait_until: new Date(Date.now() - 2000).toISOString(),
}
const goneRemotePrev = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input)
  if (url.includes("api.telegram.org")) {
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  }
  if (url.includes("/rest/v1/leads")) {
    return new Response(JSON.stringify([goneRemoteRow]), { status: 200, headers: { "content-type": "application/json" } })
  }
  return new Response("[]", { status: 200, headers: { "content-type": "application/json" } })
}) as typeof fetch
try {
  const goneHookCtx = backgroundCtx()
  assert(
    (
      await handleRequest(
        new Request("http://local.test/api/telegram", {
          method: "POST",
          headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "hook-secret" },
          body: JSON.stringify({
            update_id: 8801,
            message: {
              chat: { id: 9901 },
              text: "/start fb_gone",
              from: { id: 9901, username: "goneremote", first_name: "Gil" },
            },
          }),
        }),
        goneRemoteEnv,
        goneHookCtx
      )
    ).status === 200,
    "webhook do id gone ainda é 200"
  )
  await goneHookCtx.flush()
  assert((await loadLead(goneRemoteKv, "gone-remote")) === null, "webhook não ressuscita id gone do Supabase")
  const revived = await findLeadInKv(goneRemoteKv, "@goneremote", 9901, "9901")
  assert(!revived || revived.id !== "gone-remote", "webhook não reusa o id apagado")
  const goneLogin = await handleRequest(
    new Request("http://local.test/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "victor@abilion.com", password: "senhaok" }),
    }),
    goneRemoteEnv,
    backgroundCtx()
  )
  assert(goneLogin.status === 200, "login para GET do gone remoto")
  const goneCookie = goneLogin.headers.get("set-cookie") || ""
  const goneList = (await (
    await handleRequest(new Request("http://local.test/api/leads", { headers: { cookie: goneCookie } }), goneRemoteEnv, backgroundCtx())
  ).json()) as { leads?: Array<{ id?: string; memory?: string }> }
  assert(!goneList.leads?.some((item) => item.id === "gone-remote"), "GET não devolve id gone do Supabase")
  assert(!goneList.leads?.some((item) => item.memory === "nota antiga"), "GET não devolve a ficha apagada do Supabase")
} finally {
  globalThis.fetch = goneRemotePrev
}

const nativeImport = importFunnel({
  id: "keep-me",
  name: "Quadro nativo",
  nodes: [{ id: "n1", type: "message", position: { x: 10, y: 10 }, data: { title: "Oi", body: "Olá do JSON Abilion" } }],
  edges: [],
})
assert(nativeImport.ok && nativeImport.source === "abilion", "import nativo Abilion")
assert(nativeImport.ok && nativeImport.funnel.id !== "keep-me", "import nativo ganha id novo")
assert(nativeImport.ok && nativeImport.funnel.status === "draft" && !nativeImport.funnel.production, "import nativo fica rascunho")

const manyImport = importFunnel({
  name: "Fluxo ManyChat",
  steps: [
    { name: "Boas-vindas", content: { messages: [{ type: "text", text: "Oi, sou a Sté" }] } },
    { type: "delay", delayHours: 2, name: "Espera" },
    { name: "Oferta", messages: [{ text: "Vê o premium" }] },
  ],
})
assert(manyImport.ok && manyImport.source === "manychat", "import ManyChat")
assert(manyImport.ok && manyImport.funnel.nodes.some((node) => node.data.body?.includes("Sté")), "ManyChat traz o texto")
assert(manyImport.ok && manyImport.funnel.nodes.some((node) => node.type === "wait"), "ManyChat traz a espera")

const n8nImport = importFunnel({
  name: "Workflow n8n",
  nodes: [
    { id: "a", name: "Telegram", type: "n8n-nodes-base.telegram", position: [0, 0], parameters: { text: "Primeira do n8n" } },
    { id: "b", name: "Wait", type: "n8n-nodes-base.wait", position: [240, 0], parameters: { amount: 3, unit: "hours" } },
    { id: "c", name: "Follow", type: "n8n-nodes-base.telegram", position: [480, 0], parameters: { text: "Segunda do n8n" } },
  ],
  connections: { Telegram: { main: [[{ node: "Wait", type: "main", index: 0 }]] }, Wait: { main: [[{ node: "Follow", type: "main", index: 0 }]] } },
})
assert(n8nImport.ok && n8nImport.source === "n8n", "import n8n")
assert(n8nImport.ok && n8nImport.funnel.edges.length >= 2, "n8n liga as conexões")

const typebotImport = importFunnel({
  name: "Typebot demo",
  groups: [
    { id: "g1", title: "Entrada", graphCoordinates: { x: 0, y: 0 }, blocks: [{ type: "text", content: { richText: [{ children: [{ text: "Olá do Typebot" }] }] } }] },
    { id: "g2", title: "Segue", graphCoordinates: { x: 300, y: 0 }, blocks: [{ type: "text", content: { text: "Segundo grupo" } }] },
  ],
  edges: [{ id: "e1", from: { groupId: "g1" }, to: { groupId: "g2" } }],
})
assert(typebotImport.ok && typebotImport.source === "typebot", "import Typebot")
assert(typebotImport.ok && typebotImport.funnel.nodes.some((node) => node.data.body?.includes("Typebot")), "Typebot extrai richText")

const genericImport = importFunnel({ messages: ["Linha um", "Linha dois"] })
assert(genericImport.ok && genericImport.source === "generic" && genericImport.funnel.nodes.length >= 3, "import genérico vira entrada + mensagens")

const pastedImport = importFunnel("Primeira colada\n\nSegunda colada")
assert(pastedImport.ok && pastedImport.funnel.nodes.some((node) => node.data.body?.includes("colada")), "texto colado vira mensagens")

const badImport = importFunnel({ foo: true })
assert(!badImport.ok, "JSON vazio não inventa funil")

const strangerStore = memoryAuthStore()
const stranger = await handleAuth(
  new Request("http://local.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.200" },
    body: JSON.stringify({ email: "rita@example.com", password: "senhaok" }),
  }),
  strangerStore,
  { ABILION_ENV: "development" }
)
assert(stranger.status === 401, "e-mail desconhecido não entra")
assert((await strangerStore.load()).users.length === 0, "login desconhecido não cria conta")

const teamEnv = {
  ASSETS: { fetch: async () => new Response("ok") },
  SUPABASE_URL: "https://example.supabase.co",
  AUTH: memoryKv(),
  ABILION_ENV: "development",
} as Env
const teamLogin = await handleRequest(
  new Request("http://local.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.201" },
    body: JSON.stringify({ email: "victor@abilion.com", password: "senhaok" }),
  }),
  teamEnv,
  backgroundCtx()
)
assert(teamLogin.status === 200, "dono inicial entra para gerir contas")
const teamCookie = teamLogin.headers.get("set-cookie") || ""
const teamMe = (await teamLogin.json()) as { user: { role?: string } }
assert(teamMe.user?.role === "owner", "primeiro acesso do Victor é dono")

const deniedUsers = await handleRequest(new Request("http://local.test/api/users"), teamEnv, backgroundCtx())
assert(deniedUsers.status === 401, "contas sem sessão são 401")

const createdUser = await handleRequest(
  new Request("http://local.test/api/users", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: teamCookie, "x-forwarded-for": "203.0.113.201" },
    body: JSON.stringify({ email: "ana@abilion.com", name: "Ana", password: "senhaok", role: "operator" }),
  }),
  teamEnv,
  backgroundCtx()
)
const createdBody = (await createdUser.json()) as { user?: { id?: string; email?: string; role?: string } }
assert(createdUser.status === 201 && createdBody.user?.email === "ana@abilion.com", "dono cria operador")
assert(createdBody.user?.role === "operator", "conta nova nasce operador")

const anaLogin = await handleRequest(
  new Request("http://local.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.202" },
    body: JSON.stringify({ email: "ana@abilion.com", password: "senhaok" }),
  }),
  teamEnv,
  backgroundCtx()
)
assert(anaLogin.status === 200, "operador criado entra")
const anaForgotOn = (await (
  await handleRequest(
    new Request("http://local.test/api/auth/forgot", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.221" },
      body: JSON.stringify({ email: "ana@abilion.com" }),
    }),
    teamEnv,
    backgroundCtx()
  )
).json()) as { resetPath?: string }
const anaResetToken = anaForgotOn.resetPath?.split("token=")[1] || ""
assert(anaResetToken, "forgot da Ana ligada devolve link")
const anaCookie = anaLogin.headers.get("set-cookie") || ""
const anaMinted = await handleRequest(
  new Request("http://local.test/api/tokens", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: anaCookie, "x-forwarded-for": "203.0.113.202" },
    body: JSON.stringify({ name: "Ana MCP" }),
  }),
  teamEnv,
  backgroundCtx()
)
const anaMintedBody = (await anaMinted.json()) as { token?: string; item?: { id?: string } }
assert(anaMinted.status === 201 && anaMintedBody.token?.startsWith("abn_"), "operador também gera token")
const anaBearerOk = await sessionUser(
  new Request("http://local.test/api/crm", { headers: { authorization: `Bearer ${anaMintedBody.token}` } }),
  kvAuthStore(teamEnv.AUTH!)
)
assert(anaBearerOk?.email === "ana@abilion.com", "Bearer da Ana resolve")
const staleAnaSnap = await kvAuthStore(teamEnv.AUTH!).load()
const anaForbidden = await handleRequest(
  new Request("http://local.test/api/users", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: anaCookie, "x-forwarded-for": "203.0.113.202" },
    body: JSON.stringify({ email: "bruno@abilion.com", name: "Bruno", password: "senhaok" }),
  }),
  teamEnv,
  backgroundCtx()
)
assert(anaForbidden.status === 403, "operador não cria contas")
assert(
  (await handleRequest(new Request("http://local.test/api/runtime", { headers: { cookie: anaCookie } }), teamEnv, backgroundCtx()))
    .status === 200,
  "operador lê o runtime"
)
assert(
  (
    await handleRequest(
      new Request("http://local.test/api/runtime", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: anaCookie, "x-forwarded-for": "203.0.113.202" },
        body: JSON.stringify({ telegramBotToken: "999:stolen" }),
      }),
      teamEnv,
      backgroundCtx()
    )
  ).status === 403,
  "operador não grava o token do bot"
)
assert(
  (
    await handleRequest(
      new Request("http://local.test/api/runtime/voice", {
        method: "POST",
        headers: { cookie: anaCookie, "x-forwarded-for": "203.0.113.202" },
      }),
      teamEnv,
      backgroundCtx()
    )
  ).status === 403,
  "operador não gera a voz"
)
assert(!(await loadSecrets(teamEnv.AUTH)).telegramBotToken, "POST recusado não grava token")

const minted = await handleRequest(
  new Request("http://local.test/api/tokens", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: teamCookie, "x-forwarded-for": "203.0.113.201" },
    body: JSON.stringify({ name: "Claude Code" }),
  }),
  teamEnv,
  backgroundCtx()
)
const mintedBody = (await minted.json()) as { token?: string; item?: { prefix?: string } }
assert(minted.status === 201 && mintedBody.token?.startsWith("abn_"), "token MCP nasce abn_")
assert(Boolean(mintedBody.item?.prefix), "token devolve prefixo")

const bearerCrm = await handleRequest(
  new Request("http://local.test/api/crm", { headers: { authorization: `Bearer ${mintedBody.token}` } }),
  teamEnv,
  backgroundCtx()
)
assert(bearerCrm.status === 200, "CRM aceita Bearer do token")
const bearerUser = await sessionUser(
  new Request("http://local.test/api/crm", { headers: { authorization: `Bearer ${mintedBody.token}` } }),
  kvAuthStore(teamEnv.AUTH!)
)
assert(bearerUser?.email === "victor@abilion.com", "Bearer resolve o dono")

const mcpAnon = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } }),
  }),
  teamEnv,
  backgroundCtx()
)
assert(mcpAnon.status === 401, "MCP sem token é 401")

const mcpInit = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mintedBody.token}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } }),
  }),
  teamEnv,
  backgroundCtx()
)
const mcpInitBody = (await mcpInit.json()) as { result?: { serverInfo?: { name?: string }; protocolVersion?: string } }
assert(mcpInit.status === 200 && mcpInitBody.result?.serverInfo?.name === "abilion", "MCP initialize")
assert(mcpInitBody.result?.protocolVersion === "2025-03-26", "MCP aceita 2025-03-26")
const mcpTools = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mintedBody.token}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 10, method: "tools/list" }),
  }),
  teamEnv,
  backgroundCtx()
)
const mcpToolsBody = (await mcpTools.json()) as { result?: { tools?: Array<{ name?: string }> } }
const mcpToolNames = (mcpToolsBody.result?.tools ?? []).map((item) => item.name)
assert(mcpToolNames.includes("abilion_patch_user"), "MCP lista patch_user")
assert(mcpToolNames.includes("abilion_revoke_token"), "MCP lista revoke_token")
assert(mcpToolNames.includes("abilion_page_install_manual"), "MCP lista o manual de instalação")
assert(mcpToolNames.includes("abilion_create_page_script"), "MCP lista criar script de página")
assert(mcpToolNames.includes("abilion_get_lead"), "MCP lista get_lead")

const mcpCreate = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mintedBody.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "abilion_create_funnel", arguments: { name: "Funil MCP" } },
    }),
  }),
  teamEnv,
  backgroundCtx()
)
const mcpCreateBody = (await mcpCreate.json()) as { result?: { content?: Array<{ text?: string }>; isError?: boolean } }
const mcpCreated = JSON.parse(mcpCreateBody.result?.content?.[0]?.text || "{}") as { id?: string; ok?: boolean }
assert(mcpCreate.status === 200 && mcpCreated.ok && mcpCreated.id, "MCP cria funil")

const mcpAccount = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mintedBody.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "abilion_create_user", arguments: { email: "carla@abilion.com", name: "Carla", password: "senhaok" } },
    }),
  }),
  teamEnv,
  backgroundCtx()
)
const mcpAccountBody = (await mcpAccount.json()) as { result?: { content?: Array<{ text?: string }> } }
const mcpUser = JSON.parse(mcpAccountBody.result?.content?.[0]?.text || "{}") as { user?: { id?: string; email?: string } }
assert(mcpUser.user?.email === "carla@abilion.com", "MCP cria conta")
const mcpPatch = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mintedBody.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 9,
      method: "tools/call",
      params: { name: "abilion_patch_user", arguments: { id: mcpUser.user?.id, disabled: true } },
    }),
  }),
  teamEnv,
  backgroundCtx()
)
const mcpPatchBody = (await mcpPatch.json()) as { result?: { content?: Array<{ text?: string }> } }
const mcpPatched = JSON.parse(mcpPatchBody.result?.content?.[0]?.text || "{}") as { user?: { disabled?: boolean } }
assert(mcpPatch.status === 200 && mcpPatched.user?.disabled === true, "MCP desliga conta")
const carlaDisabled = await handleRequest(
  new Request("http://local.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.209" },
    body: JSON.stringify({ email: "carla@abilion.com", password: "senhaok" }),
  }),
  teamEnv,
  backgroundCtx()
)
assert(carlaDisabled.status === 401, "conta desligada pelo MCP não entra")

const mcpPublic = await handleRequest(new Request("http://local.test/mcp"), teamEnv, backgroundCtx())
const mcpPublicBody = (await mcpPublic.json()) as { ok?: boolean; name?: string; install?: string }
assert(mcpPublic.status === 200 && mcpPublicBody.ok && mcpPublicBody.name === "abilion", "GET MCP é público")
assert(mcpPublicBody.install === "/api/install", "GET MCP aponta o manual")
const installPublic = await handleRequest(new Request("http://local.test/api/install"), teamEnv, backgroundCtx())
const installBody = (await installPublic.json()) as { ok?: boolean; title?: string; snippet?: string; steps?: unknown[] }
assert(installPublic.status === 200 && installBody.ok && (installBody.steps?.length ?? 0) >= 5, "GET /api/install é o manual")
assert(Boolean(installBody.snippet?.includes("/t.js")), "manual público inclui o snippet")
const mcpInstallDownEnv = {
  ...teamEnv,
  SUPABASE_URL: "https://invalid.invalid",
  SUPABASE_SERVICE_ROLE: "role",
} as Env
const mcpInstallUnread = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mintedBody.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 90,
      method: "tools/call",
      params: { name: "abilion_page_install_manual", arguments: { scriptId: "deadbeef" } },
    }),
  }),
  mcpInstallDownEnv,
  backgroundCtx()
)
const mcpInstallUnreadBody = (await mcpInstallUnread.json()) as {
  result?: { isError?: boolean; content?: Array<{ text?: string }> }
}
const mcpInstallUnreadData = JSON.parse(mcpInstallUnreadBody.result?.content?.[0]?.text || "{}") as { error?: string }
assert(mcpInstallUnread.status === 200 && mcpInstallUnreadBody.result?.isError, "MCP não finge script em falta se settings unread")
assert(mcpInstallUnreadData.error === "Não confirmei o script desta página.", "MCP pede confirmação do script unread")
const mcpInstallResourceUnread = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mintedBody.token}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 91, method: "resources/read", params: { uri: "abilion://install/deadbeef" } }),
  }),
  mcpInstallDownEnv,
  backgroundCtx()
)
const mcpInstallResourceUnreadBody = (await mcpInstallResourceUnread.json()) as { error?: { message?: string } }
assert(mcpInstallResourceUnread.status === 200, "resources/read unread não rebenta o MCP")
assert(
  mcpInstallResourceUnreadBody.error?.message === "Não confirmei o script desta página.",
  "resources/read unread devolve o mesmo erro"
)
const mcpInstallGeneralUnread = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mintedBody.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 92,
      method: "tools/call",
      params: { name: "abilion_page_install_manual", arguments: {} },
    }),
  }),
  mcpInstallDownEnv,
  backgroundCtx()
)
const mcpInstallGeneralUnreadBody = (await mcpInstallGeneralUnread.json()) as {
  result?: { isError?: boolean; content?: Array<{ text?: string }> }
}
const mcpInstallGeneralUnreadData = JSON.parse(mcpInstallGeneralUnreadBody.result?.content?.[0]?.text || "{}") as {
  ok?: boolean
  steps?: unknown[]
}
assert(
  mcpInstallGeneralUnread.status === 200 &&
    !mcpInstallGeneralUnreadBody.result?.isError &&
    (mcpInstallGeneralUnreadData.steps?.length ?? 0) >= 5,
  "MCP manual geral continua unread"
)
const mcpListUnread = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mintedBody.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 93,
      method: "tools/call",
      params: { name: "abilion_list_page_scripts", arguments: {} },
    }),
  }),
  mcpInstallDownEnv,
  backgroundCtx()
)
const mcpListUnreadBody = (await mcpListUnread.json()) as { result?: { isError?: boolean; content?: Array<{ text?: string }> } }
const mcpListUnreadData = JSON.parse(mcpListUnreadBody.result?.content?.[0]?.text || "{}") as { error?: string }
assert(mcpListUnread.status === 200 && mcpListUnreadBody.result?.isError, "MCP não lista scripts vazios se settings unread")
assert(mcpListUnreadData.error === "Não confirmei os scripts desta página.", "MCP pede confirmação da lista unread")
const mcpSettingsUnread = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mintedBody.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 94,
      method: "tools/call",
      params: { name: "abilion_get_settings", arguments: {} },
    }),
  }),
  mcpInstallDownEnv,
  backgroundCtx()
)
const mcpSettingsUnreadBody = (await mcpSettingsUnread.json()) as {
  result?: { isError?: boolean; content?: Array<{ text?: string }> }
}
const mcpSettingsUnreadData = JSON.parse(mcpSettingsUnreadBody.result?.content?.[0]?.text || "{}") as { error?: string }
assert(mcpSettingsUnread.status === 200 && mcpSettingsUnreadBody.result?.isError, "MCP não devolve settings ocas unread")
assert(mcpSettingsUnreadData.error === "Não confirmei as definições no Postgres.", "MCP pede confirmação das settings unread")
const mcpListFunnelsUnread = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mintedBody.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 96,
      method: "tools/call",
      params: { name: "abilion_list_funnels", arguments: {} },
    }),
  }),
  mcpInstallDownEnv,
  backgroundCtx()
)
const mcpListFunnelsUnreadBody = (await mcpListFunnelsUnread.json()) as {
  result?: { isError?: boolean; content?: Array<{ text?: string }> }
}
const mcpListFunnelsUnreadData = JSON.parse(mcpListFunnelsUnreadBody.result?.content?.[0]?.text || "{}") as {
  ok?: boolean
  unread?: boolean
  funnels?: Array<{ id?: string }>
}
assert(mcpListFunnelsUnread.status === 200 && !mcpListFunnelsUnreadBody.result?.isError, "MCP lista os funis do KV se o Postgres cair")
assert(mcpListFunnelsUnreadData.unread === true, "MCP marca funis unread se o Postgres cair")
assert(mcpListFunnelsUnreadData.funnels?.some((item) => item.id === mcpCreated.id), "MCP unread ainda mostra o funil do KV")
const mcpCreateFunnelsUnread = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mintedBody.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 97,
      method: "tools/call",
      params: { name: "abilion_create_funnel", arguments: { name: "Não agora" } },
    }),
  }),
  mcpInstallDownEnv,
  backgroundCtx()
)
const mcpCreateFunnelsUnreadBody = (await mcpCreateFunnelsUnread.json()) as {
  result?: { isError?: boolean; content?: Array<{ text?: string }> }
}
const mcpCreateFunnelsUnreadData = JSON.parse(mcpCreateFunnelsUnreadBody.result?.content?.[0]?.text || "{}") as { error?: string }
assert(mcpCreateFunnelsUnread.status === 200 && mcpCreateFunnelsUnreadBody.result?.isError, "MCP não cria funil com a lista unread")
assert(mcpCreateFunnelsUnreadData.error === "Não confirmei os funis.", "MCP pede confirmação dos funis unread")
const mcpGetFunnelMissUnread = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mintedBody.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 98,
      method: "tools/call",
      params: { name: "abilion_get_funnel", arguments: { id: "missing-funnel" } },
    }),
  }),
  mcpInstallDownEnv,
  backgroundCtx()
)
const mcpGetFunnelMissUnreadBody = (await mcpGetFunnelMissUnread.json()) as {
  result?: { isError?: boolean; content?: Array<{ text?: string }> }
}
const mcpGetFunnelMissUnreadData = JSON.parse(mcpGetFunnelMissUnreadBody.result?.content?.[0]?.text || "{}") as { error?: string }
assert(mcpGetFunnelMissUnread.status === 200 && mcpGetFunnelMissUnreadBody.result?.isError, "MCP não finge funil em falta se unread")
assert(mcpGetFunnelMissUnreadData.error === "Não confirmei os funis.", "MCP miss unread pede confirmação dos funis")
const mcpGetFunnelHitUnread = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mintedBody.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 99,
      method: "tools/call",
      params: { name: "abilion_get_funnel", arguments: { id: mcpCreated.id } },
    }),
  }),
  mcpInstallDownEnv,
  backgroundCtx()
)
const mcpGetFunnelHitUnreadBody = (await mcpGetFunnelHitUnread.json()) as {
  result?: { isError?: boolean; content?: Array<{ text?: string }> }
}
const mcpGetFunnelHitUnreadData = JSON.parse(mcpGetFunnelHitUnreadBody.result?.content?.[0]?.text || "{}") as {
  ok?: boolean
  unread?: boolean
  funnel?: { id?: string }
}
assert(mcpGetFunnelHitUnread.status === 200 && !mcpGetFunnelHitUnreadBody.result?.isError, "MCP lê o funil do KV mesmo unread")
assert(mcpGetFunnelHitUnreadData.funnel?.id === mcpCreated.id && mcpGetFunnelHitUnreadData.unread === true, "MCP get unread devolve o quadro do KV")
const mcpPublishFunnelsUnread = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mintedBody.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 100,
      method: "tools/call",
      params: { name: "abilion_publish_funnel", arguments: { id: mcpCreated.id } },
    }),
  }),
  mcpInstallDownEnv,
  backgroundCtx()
)
const mcpPublishFunnelsUnreadBody = (await mcpPublishFunnelsUnread.json()) as {
  result?: { isError?: boolean; content?: Array<{ text?: string }> }
}
const mcpPublishFunnelsUnreadData = JSON.parse(mcpPublishFunnelsUnreadBody.result?.content?.[0]?.text || "{}") as { error?: string }
assert(mcpPublishFunnelsUnread.status === 200 && mcpPublishFunnelsUnreadBody.result?.isError, "MCP não publica funil com a lista unread")
assert(mcpPublishFunnelsUnreadData.error === "Não confirmei os funis.", "MCP publish unread pede confirmação")
const mcpScriptFunnelsUnread = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mintedBody.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 101,
      method: "tools/call",
      params: { name: "abilion_create_page_script", arguments: { funnelId: "missing-funnel", name: "Landing" } },
    }),
  }),
  mcpInstallDownEnv,
  backgroundCtx()
)
const mcpScriptFunnelsUnreadBody = (await mcpScriptFunnelsUnread.json()) as {
  result?: { isError?: boolean; content?: Array<{ text?: string }> }
}
const mcpScriptFunnelsUnreadData = JSON.parse(mcpScriptFunnelsUnreadBody.result?.content?.[0]?.text || "{}") as { error?: string }
assert(mcpScriptFunnelsUnread.status === 200 && mcpScriptFunnelsUnreadBody.result?.isError, "MCP não cria script com funil unread em falta")
assert(mcpScriptFunnelsUnreadData.error === "Não confirmei os funis.", "MCP script unread não finge funil por publicar")
const mcpDeleteUnread = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mintedBody.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 95,
      method: "tools/call",
      params: { name: "abilion_delete_page_script", arguments: { id: "deadbeef" } },
    }),
  }),
  mcpInstallDownEnv,
  backgroundCtx()
)
const mcpDeleteUnreadBody = (await mcpDeleteUnread.json()) as { result?: { isError?: boolean; content?: Array<{ text?: string }> } }
const mcpDeleteUnreadData = JSON.parse(mcpDeleteUnreadBody.result?.content?.[0]?.text || "{}") as { error?: string }
assert(mcpDeleteUnread.status === 200 && mcpDeleteUnreadBody.result?.isError, "MCP não apaga script unread em falta")
assert(mcpDeleteUnreadData.error === "Não confirmei o script desta página.", "MCP delete unread pede confirmação")
const mcpHealthUnread = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mintedBody.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 96,
      method: "tools/call",
      params: { name: "abilion_health", arguments: {} },
    }),
  }),
  mcpInstallDownEnv,
  backgroundCtx()
)
const mcpHealthUnreadBody = (await mcpHealthUnread.json()) as {
  result?: { isError?: boolean; content?: Array<{ text?: string }> }
}
const mcpHealthUnreadData = JSON.parse(mcpHealthUnreadBody.result?.content?.[0]?.text || "{}") as {
  ok?: boolean
  telegramBound?: boolean
  unread?: boolean
  telegramBotUsername?: string
}
assert(mcpHealthUnread.status === 200 && !mcpHealthUnreadBody.result?.isError && mcpHealthUnreadData.ok, "MCP health unread continua de pé")
assert(mcpHealthUnreadData.unread === true && !mcpHealthUnreadData.telegramBotUsername, "MCP health unread não finge bot desligado")
assert(mcpHealthUnreadData.telegramBound === false, "MCP health sem token no KV nem no env")
await saveSecrets(mcpInstallDownEnv.AUTH, { telegramBotToken: "000:kv-token" })
const mcpHealthBound = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mintedBody.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 97,
      method: "tools/call",
      params: { name: "abilion_health", arguments: {} },
    }),
  }),
  mcpInstallDownEnv,
  backgroundCtx()
)
const mcpHealthBoundData = JSON.parse(
  ((await mcpHealthBound.json()) as { result?: { content?: Array<{ text?: string }> } }).result?.content?.[0]?.text || "{}"
) as { telegramBound?: boolean }
assert(mcpHealthBoundData.telegramBound === true, "MCP health lê o token gravado no KV")
const mcpImportGroupUnread = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mintedBody.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 98,
      method: "tools/call",
      params: { name: "abilion_import_leads", arguments: { text: "Rita, 11911112222", toGroup: true } },
    }),
  }),
  mcpInstallDownEnv,
  backgroundCtx()
)
const mcpImportGroupUnreadBody = (await mcpImportGroupUnread.json()) as {
  result?: { isError?: boolean; content?: Array<{ text?: string }> }
}
const mcpImportGroupUnreadData = JSON.parse(mcpImportGroupUnreadBody.result?.content?.[0]?.text || "{}") as { error?: string }
assert(mcpImportGroupUnread.status === 200 && mcpImportGroupUnreadBody.result?.isError, "MCP não importa para o grupo se o URL unread")
assert(mcpImportGroupUnreadData.error === "Não confirmei o grupo do Telegram.", "MCP import toGroup unread pede o grupo")
const mcpImportCategoryUnread = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mintedBody.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 198,
      method: "tools/call",
      params: { name: "abilion_import_leads", arguments: { text: "Rita, 11911112222", category: "VIP" } },
    }),
  }),
  mcpInstallDownEnv,
  backgroundCtx()
)
const mcpImportCategoryUnreadBody = (await mcpImportCategoryUnread.json()) as {
  result?: { isError?: boolean; content?: Array<{ text?: string }> }
}
const mcpImportCategoryUnreadData = JSON.parse(mcpImportCategoryUnreadBody.result?.content?.[0]?.text || "{}") as {
  error?: string
}
assert(mcpImportCategoryUnread.status === 200 && mcpImportCategoryUnreadBody.result?.isError, "MCP não cria categoria se a lista unread está oca")
assert(mcpImportCategoryUnreadData.error === "Não confirmei as categorias.", "MCP import unread pede confirmação das categorias")
await saveSettingsKv(mcpInstallDownEnv.AUTH, migrateSettings({ leadCategories: ["VIP"] }))
const mcpImportCategoryLeftover = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mintedBody.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 197,
      method: "tools/call",
      params: { name: "abilion_import_leads", arguments: { text: "Rita, 11911112222", category: "Gold" } },
    }),
  }),
  mcpInstallDownEnv,
  backgroundCtx()
)
const mcpImportCategoryLeftoverBody = (await mcpImportCategoryLeftover.json()) as {
  result?: { isError?: boolean; content?: Array<{ text?: string }> }
}
const mcpImportCategoryLeftoverData = JSON.parse(mcpImportCategoryLeftoverBody.result?.content?.[0]?.text || "{}") as {
  error?: string
}
assert(mcpImportCategoryLeftover.status === 200 && mcpImportCategoryLeftoverBody.result?.isError, "MCP não cria categoria nova com leftover unread")
assert(mcpImportCategoryLeftoverData.error === "Não confirmei as categorias.", "MCP leftover VIP não solta criar Gold")
const mcpImportCatalogUnread = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mintedBody.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 199,
      method: "tools/call",
      params: { name: "abilion_import_leads", arguments: { text: "Rita, 11911112222" } },
    }),
  }),
  mcpInstallDownEnv,
  backgroundCtx()
)
const mcpImportCatalogUnreadBody = (await mcpImportCatalogUnread.json()) as {
  result?: { isError?: boolean; content?: Array<{ text?: string }> }
}
const mcpImportCatalogUnreadData = JSON.parse(mcpImportCatalogUnreadBody.result?.content?.[0]?.text || "{}") as {
  error?: string
}
assert(mcpImportCatalogUnread.status === 200 && mcpImportCatalogUnreadBody.result?.isError, "MCP não importa se o catálogo unread está oco")
assert(mcpImportCatalogUnreadData.error === "Não li os leads do Postgres.", "MCP import unread pede confirmação dos leads")

const mcpImport = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mintedBody.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "abilion_import_funnel", arguments: { name: "Import MCP", payload: { messages: ["Passo MCP"] } } },
    }),
  }),
  teamEnv,
  backgroundCtx()
)
const mcpImportBody = (await mcpImport.json()) as { result?: { content?: Array<{ text?: string }> } }
const mcpImported = JSON.parse(mcpImportBody.result?.content?.[0]?.text || "{}") as { ok?: boolean; id?: string; source?: string }
assert(mcpImport.status === 200 && mcpImported.ok && mcpImported.id && mcpImported.source === "generic", "MCP importa funil")

const mcpPublish = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mintedBody.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "abilion_publish_funnel", arguments: { id: mcpCreated.id } },
    }),
  }),
  teamEnv,
  backgroundCtx()
)
const mcpPublishBody = (await mcpPublish.json()) as { result?: { content?: Array<{ text?: string }>; isError?: boolean } }
const mcpPublished = JSON.parse(mcpPublishBody.result?.content?.[0]?.text || "{}") as { ok?: boolean; funnel?: { published?: boolean } }
assert(mcpPublish.status === 200 && mcpPublished.ok && mcpPublished.funnel?.published, "MCP publica funil")
const mcpCreateUnread = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mintedBody.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 99,
      method: "tools/call",
      params: { name: "abilion_create_page_script", arguments: { name: "Landing unread", funnelId: mcpCreated.id } },
    }),
  }),
  mcpInstallDownEnv,
  backgroundCtx()
)
const mcpCreateUnreadBody = (await mcpCreateUnread.json()) as { result?: { isError?: boolean; content?: Array<{ text?: string }> } }
const mcpCreateUnreadData = JSON.parse(mcpCreateUnreadBody.result?.content?.[0]?.text || "{}") as { error?: string }
assert(mcpCreateUnread.status === 200 && mcpCreateUnreadBody.result?.isError, "MCP não cria script com funil leftover unread")
assert(mcpCreateUnreadData.error === "Não confirmei os funis.", "MCP create unread pede confirmação dos funis mesmo com quadro no KV")
const mcpSettingsBefore = await loadSettingsKv(teamEnv.AUTH)
await saveSettingsKv(
  teamEnv.AUTH,
  migrateSettings({
    ...mcpSettingsBefore,
    pageScripts: [
      {
        id: "cafebabe",
        name: "Landing leftover",
        funnelId: mcpCreated.id,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  })
)
const prevFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
  if (url.includes("/rest/v1/settings")) throw new Error("settings down")
  if (url.includes("/rest/v1/funnels")) {
    return new Response("[]", { status: 200, headers: { "content-type": "application/json" } })
  }
  return prevFetch(input, init)
}) as typeof fetch
const mcpSettingsSplitEnv = { ...teamEnv, SUPABASE_URL: "https://sb.test", SUPABASE_SERVICE_ROLE: "role" } as Env
let mcpCreateScriptLeftover: Response
try {
  mcpCreateScriptLeftover = await handleRequest(
    new Request("http://local.test/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${mintedBody.token}` },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 198,
        method: "tools/call",
        params: { name: "abilion_create_page_script", arguments: { name: "Landing leftover create", funnelId: mcpCreated.id } },
      }),
    }),
    mcpSettingsSplitEnv,
    backgroundCtx()
  )
} finally {
  globalThis.fetch = prevFetch
  await saveSettingsKv(teamEnv.AUTH, mcpSettingsBefore)
}
const mcpCreateScriptLeftoverBody = (await mcpCreateScriptLeftover.json()) as {
  result?: { isError?: boolean; content?: Array<{ text?: string }> }
}
const mcpCreateScriptLeftoverData = JSON.parse(mcpCreateScriptLeftoverBody.result?.content?.[0]?.text || "{}") as {
  error?: string
}
assert(mcpCreateScriptLeftover.status === 200 && mcpCreateScriptLeftoverBody.result?.isError, "MCP não cria script com leftover unread")
assert(mcpCreateScriptLeftoverData.error === "Não confirmei os scripts desta página.", "MCP leftover de script não solta criar outro")

const mcpPageScript = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mintedBody.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 21,
      method: "tools/call",
      params: { name: "abilion_create_page_script", arguments: { name: "Landing MCP", funnelId: mcpCreated.id } },
    }),
  }),
  teamEnv,
  backgroundCtx()
)
const mcpPageScriptBody = (await mcpPageScript.json()) as { result?: { content?: Array<{ text?: string }>; isError?: boolean } }
const mcpPage = JSON.parse(mcpPageScriptBody.result?.content?.[0]?.text || "{}") as {
  ok?: boolean
  script?: { id?: string }
  snippet?: string
  start?: string
}
assert(mcpPageScript.status === 200 && mcpPage.ok && mcpPage.script?.id, "MCP cria script de outra página")
assert(Boolean(mcpPage.snippet?.includes(`s=${mcpPage.script?.id}`)), "MCP devolve o snippet daquela landing")
const mcpManual = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mintedBody.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 22,
      method: "tools/call",
      params: { name: "abilion_page_install_manual", arguments: { scriptId: mcpPage.script?.id } },
    }),
  }),
  teamEnv,
  backgroundCtx()
)
const mcpManualBody = (await mcpManual.json()) as { result?: { content?: Array<{ text?: string }> } }
const mcpManualData = JSON.parse(mcpManualBody.result?.content?.[0]?.text || "{}") as { steps?: unknown[]; start?: string }
assert((mcpManualData.steps?.length ?? 0) >= 5 && mcpManualData.start?.includes(mcpPage.script?.id || "nope"), "MCP devolve o manual daquele script")
const mcpResource = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mintedBody.token}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 23, method: "resources/read", params: { uri: "abilion://install" } }),
  }),
  teamEnv,
  backgroundCtx()
)
const mcpResourceBody = (await mcpResource.json()) as { result?: { contents?: Array<{ text?: string }> } }
const mcpResourceManual = JSON.parse(mcpResourceBody.result?.contents?.[0]?.text || "{}") as { steps?: unknown[] }
assert((mcpResourceManual.steps?.length ?? 0) >= 5, "MCP resources/read devolve o manual")
const mcpImportLeads = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mintedBody.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 24,
      method: "tools/call",
      params: { name: "abilion_import_leads", arguments: { text: "Rita, 11911112222", toGroup: true } },
    }),
  }),
  teamEnv,
  backgroundCtx()
)
const mcpImportLeadsBody = (await mcpImportLeads.json()) as { result?: { content?: Array<{ text?: string }> } }
const mcpImportedLeads = JSON.parse(mcpImportLeadsBody.result?.content?.[0]?.text || "{}") as {
  ok?: boolean
  imported?: number
  leads?: Array<{ id?: string; stage?: string; category?: string }>
}
assert(mcpImportLeads.status === 200 && mcpImportedLeads.ok && mcpImportedLeads.imported === 1, "MCP importa lista")
assert(mcpImportedLeads.leads?.[0]?.stage === "group" && mcpImportedLeads.leads?.[0]?.category === "Grupo", "MCP importa para o grupo")
const mcpImportAgain = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mintedBody.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 25,
      method: "tools/call",
      params: { name: "abilion_import_leads", arguments: { text: "Rita, 11911112222", category: "VIP" } },
    }),
  }),
  teamEnv,
  backgroundCtx()
)
const mcpImportAgainBody = (await mcpImportAgain.json()) as { result?: { content?: Array<{ text?: string }> } }
const mcpImportedAgain = JSON.parse(mcpImportAgainBody.result?.content?.[0]?.text || "{}") as {
  ok?: boolean
  imported?: number
  leads?: Array<{ id?: string; category?: string }>
}
assert(mcpImportAgain.status === 200 && mcpImportedAgain.imported === 1, "MCP reimporta o mesmo contacto")
assert(mcpImportedAgain.leads?.[0]?.id === mcpImportedLeads.leads?.[0]?.id, "MCP reimport não cria segunda ficha")
assert(mcpImportedAgain.leads?.[0]?.category === "VIP", "MCP reimport actualiza a categoria")

const mcpLeads = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mintedBody.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: { name: "abilion_list_leads", arguments: { limit: 5 } },
    }),
  }),
  teamEnv,
  backgroundCtx()
)
const mcpLeadsBody = (await mcpLeads.json()) as { result?: { content?: Array<{ text?: string }> } }
const mcpLeadList = JSON.parse(mcpLeadsBody.result?.content?.[0]?.text || "{}") as { ok?: boolean; leads?: unknown[] }
assert(mcpLeads.status === 200 && mcpLeadList.ok && Array.isArray(mcpLeadList.leads), "MCP lista leads")

const mcpSettings = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mintedBody.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: { name: "abilion_get_settings", arguments: {} },
    }),
  }),
  teamEnv,
  backgroundCtx()
)
const mcpSettingsBody = (await mcpSettings.json()) as { result?: { content?: Array<{ text?: string }> } }
const mcpSettingsOut = JSON.parse(mcpSettingsBody.result?.content?.[0]?.text || "{}") as {
  ok?: boolean
  settings?: { telegramBotToken?: string; esterTelegramChatId?: string }
}
assert(mcpSettings.status === 200 && mcpSettingsOut.ok, "MCP devolve settings")
assert(mcpSettingsOut.settings?.telegramBotToken === "", "MCP settings sem token")
assert(mcpSettingsOut.settings?.esterTelegramChatId === "", "MCP settings sem chat da Ester")

const mcpToken = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mintedBody.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 8,
      method: "tools/call",
      params: { name: "abilion_create_token", arguments: { name: "Agente MCP" } },
    }),
  }),
  teamEnv,
  backgroundCtx()
)
const mcpTokenBody = (await mcpToken.json()) as { result?: { content?: Array<{ text?: string }> } }
const mcpTokenOut = JSON.parse(mcpTokenBody.result?.content?.[0]?.text || "{}") as { token?: string; item?: { id?: string } }
assert(mcpToken.status === 200 && mcpTokenOut.token?.startsWith("abn_"), "MCP cria token")
const mcpRevoke = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mintedBody.token}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 11,
      method: "tools/call",
      params: { name: "abilion_revoke_token", arguments: { id: mcpTokenOut.item?.id } },
    }),
  }),
  teamEnv,
  backgroundCtx()
)
const mcpRevokeBody = (await mcpRevoke.json()) as { result?: { content?: Array<{ text?: string }>; isError?: boolean } }
const mcpRevoked = JSON.parse(mcpRevokeBody.result?.content?.[0]?.text || "{}") as { ok?: boolean }
assert(mcpRevoke.status === 200 && mcpRevoked.ok && !mcpRevokeBody.result?.isError, "MCP revoga token")
const revokedBearer = await handleRequest(
  new Request("http://local.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${mcpTokenOut.token}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 12, method: "initialize", params: { protocolVersion: "2025-03-26" } }),
  }),
  teamEnv,
  backgroundCtx()
)
assert(revokedBearer.status === 401, "token MCP revogado não entra")
const staleTokenSnap = await kvAuthStore(teamEnv.AUTH!).load()
const revivedOwner = staleTokenSnap.users.find((item) => item.email === "victor@abilion.com")
assert(Boolean(revivedOwner), "dono ainda está no snapshot")
await kvAuthStore(teamEnv.AUTH!).save({
  ...staleTokenSnap,
  revokedApi: [],
  users: staleTokenSnap.users.map((item) =>
    item.email === "victor@abilion.com"
      ? {
          ...item,
          tokens: [
            ...(item.tokens ?? []),
            {
              id: mcpTokenOut.item?.id || "missing",
              name: "Agente MCP",
              hash: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
              prefix: "abn_dead",
              createdAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        }
      : item
  ),
})
const afterRevive = await kvAuthStore(teamEnv.AUTH!).load()
assert(afterRevive.revokedApi?.includes(mcpTokenOut.item?.id || ""), "tombstone do token MCP sobrevive ao save velho")
assert(!(afterRevive.users.find((item) => item.email === "victor@abilion.com")?.tokens ?? []).some((item) => item.id === mcpTokenOut.item?.id), "token revogado não volta na conta")

const mcpLimitEnv = {
  ASSETS: { fetch: async () => new Response("ok") },
  SUPABASE_URL: "https://example.supabase.co",
  AUTH: memoryKv(),
  ABILION_ENV: "development",
} as Env
const mcpLimitLogin = await handleRequest(
  new Request("http://local.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.91" },
    body: JSON.stringify({ email: "victor@abilion.com", password: "senhaok" }),
  }),
  mcpLimitEnv,
  backgroundCtx()
)
assert(mcpLimitLogin.status === 200, "login para o limite MCP")
const mcpLimitCookie = mcpLimitLogin.headers.get("set-cookie") || ""
const mcpHit = () =>
  handleRequest(
    new Request("http://local.test/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: mcpLimitCookie, "x-forwarded-for": "198.51.100.91" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
    }),
    mcpLimitEnv,
    backgroundCtx()
  )
for (let i = 0; i < 60; i++) assert((await mcpHit()).status === 200, `mcp ${i + 1} ainda entra no throttle`)
assert((await mcpHit()).status === 429, "61º MCP bloqueia")

const mcpAnonLimitEnv = {
  ASSETS: { fetch: async () => new Response("ok") },
  SUPABASE_URL: "https://example.supabase.co",
  AUTH: memoryKv(),
  ABILION_ENV: "development",
} as Env
const mcpAnonHit = () =>
  handleRequest(
    new Request("http://local.test/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.92" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } }),
    }),
    mcpAnonLimitEnv,
    backgroundCtx()
  )
for (let i = 0; i < 20; i++) assert((await mcpAnonHit()).status === 401, `mcp anon ${i + 1} ainda é 401`)
assert((await mcpAnonHit()).status === 429, "21º MCP sem token bloqueia")

const rotateEnv = {
  ASSETS: { fetch: async () => new Response("ok") },
  SUPABASE_URL: "https://example.supabase.co",
  AUTH: memoryKv(),
  ABILION_ENV: "development",
} as Env
const rotateLogin = await handleRequest(
  new Request("http://local.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.93" },
    body: JSON.stringify({ email: "victor@abilion.com", password: "senhaok" }),
  }),
  rotateEnv,
  backgroundCtx()
)
assert(rotateLogin.status === 200, "login para rodar a senha")
const rotateCookie = rotateLogin.headers.get("set-cookie") || ""
const rotateMint = await handleRequest(
  new Request("http://local.test/api/tokens", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: rotateCookie, "x-forwarded-for": "198.51.100.93" },
    body: JSON.stringify({ name: "Antes da troca" }),
  }),
  rotateEnv,
  backgroundCtx()
)
const rotateMinted = (await rotateMint.json()) as { token?: string; item?: { id?: string } }
assert(rotateMint.status === 201 && rotateMinted.token?.startsWith("abn_"), "token antes da troca")
assert(
  (await sessionUser(
    new Request("http://local.test/api/crm", { headers: { authorization: `Bearer ${rotateMinted.token}` } }),
    kvAuthStore(rotateEnv.AUTH!)
  ))?.email === "victor@abilion.com",
  "Bearer vive antes da troca"
)
const rotatePwd = await handleRequest(
  new Request("http://local.test/api/auth/password", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: rotateCookie, "x-forwarded-for": "198.51.100.93" },
    body: JSON.stringify({ currentPassword: "senhaok", password: "giro1ok" }),
  }),
  rotateEnv,
  backgroundCtx()
)
assert(rotatePwd.status === 200, "troca de senha com sessão viva")
assert(
  (await sessionUser(
    new Request("http://local.test/api/crm", { headers: { authorization: `Bearer ${rotateMinted.token}` } }),
    kvAuthStore(rotateEnv.AUTH!)
  )) === null,
  "troca de senha mata o token MCP"
)
const rotateAfterPwd = await kvAuthStore(rotateEnv.AUTH!).load()
assert(rotateAfterPwd.revokedApi?.includes(rotateMinted.item?.id || ""), "troca grava o id em revokedApi")
assert(
  !(rotateAfterPwd.users.find((item) => item.email === "victor@abilion.com")?.tokens ?? []).some((item) => item.id === rotateMinted.item?.id),
  "troca esvazia o token da conta"
)
const rotateMint2 = await handleRequest(
  new Request("http://local.test/api/tokens", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: rotateCookie, "x-forwarded-for": "198.51.100.93" },
    body: JSON.stringify({ name: "Antes do reset" }),
  }),
  rotateEnv,
  backgroundCtx()
)
const rotateMinted2 = (await rotateMint2.json()) as { token?: string; item?: { id?: string } }
assert(rotateMint2.status === 201 && rotateMinted2.token?.startsWith("abn_"), "token novo depois da troca")
const rotateForgot = (await (
  await handleRequest(
    new Request("http://local.test/api/auth/forgot", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.94" },
      body: JSON.stringify({ email: "victor@abilion.com" }),
    }),
    rotateEnv,
    backgroundCtx()
  )
).json()) as { resetPath?: string }
const rotateResetToken = rotateForgot.resetPath?.split("token=")[1] || ""
assert(rotateResetToken, "forgot depois da troca devolve link")
const rotateReset = await handleRequest(
  new Request("http://local.test/api/auth/reset", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.94" },
    body: JSON.stringify({ token: rotateResetToken, password: "giro2ok" }),
  }),
  rotateEnv,
  backgroundCtx()
)
assert(rotateReset.status === 200, "reset troca a senha")
assert(
  (await sessionUser(
    new Request("http://local.test/api/crm", { headers: { authorization: `Bearer ${rotateMinted2.token}` } }),
    kvAuthStore(rotateEnv.AUTH!)
  )) === null,
  "reset mata o token MCP"
)
const rotateAfterReset = await kvAuthStore(rotateEnv.AUTH!).load()
assert(rotateAfterReset.revokedApi?.includes(rotateMinted2.item?.id || ""), "reset grava o id em revokedApi")

const importedHttp = await handleRequest(
  new Request("http://local.test/api/funnels/import", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: teamCookie, "x-forwarded-for": "203.0.113.201" },
    body: JSON.stringify({ name: "Import HTTP", payload: { messages: ["Passo A", "Passo B"] } }),
  }),
  teamEnv,
  backgroundCtx()
)
const importedHttpBody = (await importedHttp.json()) as { source?: string; funnel?: { name?: string } }
assert(importedHttp.status === 201 && importedHttpBody.source === "generic", "POST import cria rascunho")
assert(importedHttpBody.funnel?.name === "Import HTTP", "import HTTP conserva o nome")
const importedHttpUnread = await handleRequest(
  new Request("http://local.test/api/funnels/import", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: teamCookie, "x-forwarded-for": "203.0.113.201" },
    body: JSON.stringify({ name: "Import unread", payload: { messages: ["Passo A", "Passo B"] } }),
  }),
  mcpInstallDownEnv,
  backgroundCtx()
)
const importedHttpUnreadBody = (await importedHttpUnread.json()) as { error?: string }
assert(importedHttpUnread.status === 503, "POST import unread é 503")
assert(importedHttpUnreadBody.error === "Não confirmei os funis.", "POST import unread pede confirmação")
const hollowImportEnv = {
  ASSETS: { fetch: async () => new Response("ok") },
  SUPABASE_URL: "https://invalid.invalid",
  SUPABASE_SERVICE_ROLE: "role",
  AUTH: memoryKv(),
  ABILION_ENV: "development",
} as Env
const hollowImportLogin = await handleRequest(
  new Request("http://local.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.241" },
    body: JSON.stringify({ email: "victor@abilion.com", password: "senhaok" }),
  }),
  hollowImportEnv,
  backgroundCtx()
)
assert(hollowImportLogin.status === 200, "login oco para o import unread")
const hollowImportCookie = hollowImportLogin.headers.get("set-cookie") || ""
const importedHttpHollow = await handleRequest(
  new Request("http://local.test/api/funnels/import", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: hollowImportCookie, "x-forwarded-for": "203.0.113.241" },
    body: JSON.stringify({ name: "Import oco", payload: { messages: ["Passo A", "Passo B"] } }),
  }),
  hollowImportEnv,
  backgroundCtx()
)
const importedHttpHollowBody = (await importedHttpHollow.json()) as { error?: string }
assert(importedHttpHollow.status === 503, "POST import com KV oco e Postgres em baixo é 503")
assert(importedHttpHollowBody.error === "Não confirmei os funis.", "POST import oco não rebenta em 500")

const listed = await handleRequest(new Request("http://local.test/api/users", { headers: { cookie: teamCookie } }), teamEnv, backgroundCtx())
const listedBody = (await listed.json()) as { users?: Array<{ id?: string; email?: string; disabled?: boolean }> }
const anaRow = listedBody.users?.find((item) => item.email === "ana@abilion.com")
assert(listed.status === 200 && Boolean(anaRow), "lista mostra a Ana")
const anaId = anaRow?.id
assert(Boolean(anaId), "id da Ana existe")
const disableAna = await handleRequest(
  new Request("http://local.test/api/users", {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: teamCookie, "x-forwarded-for": "203.0.113.201" },
    body: JSON.stringify({ id: anaId, disabled: true }),
  }),
  teamEnv,
  backgroundCtx()
)
assert(disableAna.status === 200, "dono desliga operador")
const anaDisabledLogin = await handleRequest(
  new Request("http://local.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.203" },
    body: JSON.stringify({ email: "ana@abilion.com", password: "senhaok" }),
  }),
  teamEnv,
  backgroundCtx()
)
assert(anaDisabledLogin.status === 401, "conta desligada não entra")
const anaForgotOff = (await (
  await handleRequest(
    new Request("http://local.test/api/auth/forgot", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.222" },
      body: JSON.stringify({ email: "ana@abilion.com" }),
    }),
    teamEnv,
    backgroundCtx()
  )
).json()) as { ok?: boolean; resetPath?: string }
assert(anaForgotOff.ok === true && !anaForgotOff.resetPath, "forgot da Ana desligada não devolve link")
const anaResetOff = await handleRequest(
  new Request("http://local.test/api/auth/reset", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.223" },
    body: JSON.stringify({ token: anaResetToken, password: "outrasenha" }),
  }),
  teamEnv,
  backgroundCtx()
)
assert(anaResetOff.status === 400, "reset da Ana desligada é 400")
const anaBearerDead = await sessionUser(
  new Request("http://local.test/api/crm", { headers: { authorization: `Bearer ${anaMintedBody.token}` } }),
  kvAuthStore(teamEnv.AUTH!)
)
assert(anaBearerDead === null, "token da conta desligada cai")
await kvAuthStore(teamEnv.AUTH!).save(staleAnaSnap)
const anaAfterStale = (await kvAuthStore(teamEnv.AUTH!).load()).users.find((item) => item.email === "ana@abilion.com")
assert(anaAfterStale?.disabled === true, "save velho não volta a ligar a Ana")
assert(!(anaAfterStale?.tokens ?? []).some((item) => item.id === anaMintedBody.item?.id), "token da Ana desligada não volta")
const anaBearerAfterStale = await sessionUser(
  new Request("http://local.test/api/crm", { headers: { authorization: `Bearer ${anaMintedBody.token}` } }),
  kvAuthStore(teamEnv.AUTH!)
)
assert(anaBearerAfterStale === null, "Bearer da Ana continua morto depois do save velho")

console.log("ste-flow ok")
