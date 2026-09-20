import { chatStarted, funnelFrom, markersFromGeos, mergeGlobeGeos, periodDelta, pixelFigure, stepDrop } from "../src/lib/analytics-view.ts"
import { coordsFromGeo } from "../src/lib/geo-coords.ts"
import { flagEmoji, formatGeo, mergeGeo, normalizeRegionCode, stateLabel } from "../src/lib/geo.ts"
import { emptySummary, isFacebookTraffic, summarizeTrack, type TrackEvent } from "../src/lib/track.ts"
import {
  isolateLead,
  canTickSteLocally,
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
  safeHttpUrl,
  splitSteMarkup,
  toTelegramHtml,
} from "../src/lib/ste.ts"
import { emptySalesFunnel } from "../src/lib/templates.ts"
import {
  activatePublishedFunnels,
  enforceSinglePublished,
  adoptDueLeads,
  adoptLeadStores,
  adoptRemoteFunnels,
  applyRemovedFunnels,
  applyRemovedLeads,
  canDeleteFunnel,
  clipRemovedIds,
  mergeFunnels,
  mergeLeads,
  reconcileFunnels,
  reconcileLeads,
  resolveLeadLookup,
} from "../src/lib/crm.ts"
import { publishedFunnel } from "../src/lib/runtime.ts"
import { csvCell, leadsToCsv } from "../src/lib/leads-export.ts"
import type { Lead } from "../src/lib/types.ts"
import { CRM_FUNNELS, aliasKey, claimCronLock, deleteLeadKv, dueLeadsKv, findLeadInKv, listLeads, loadFunnelsKv, loadLead, loadRemovedFunnelIds, loadRemovedLeadIds, saveSettingsKv, upsertLeadKv } from "../worker/crm-store.ts"
import { readJsonObject } from "../worker/json-body.ts"
import { memoryKv } from "../worker/kv.ts"
import { STE_LLM_FALLBACK, STE_LLM_MODEL, STE_OPENCODE_MODEL, steLlmAttempts, steModelChain } from "../src/lib/llm.ts"
import { clipHash, linkFollowUp, linksFromReplies, spokenHasUrl, STE_VOICE_CLIPS, voiceClipFor } from "../src/lib/ste-voice.ts"
import { safeAppPath } from "../src/lib/safe-path.ts"
import { validateCapture } from "../src/lib/capture.ts"
import { cleanBotUsername, cleanHttpUrl, cleanTelegramGroupUrl, migrateSettings, sanitizeIncomingFunnel, sanitizeIncomingLead } from "../src/lib/migrate.ts"
import { adsDeepLink } from "../src/lib/telegram-start.ts"
import { burstFacebookLeads, burstStats, simulateOpenLead } from "../src/lib/burst.ts"
import { barShare } from "../src/lib/ops.ts"
import { mergeSecrets, resolveRuntime, tokenHint } from "../worker/runtime-secrets.ts"
import { consumeThrottle, consumeMemoryThrottle, consumeKvThrottle, clearThrottle, ensureOperatorUsers, handleAuth, memoryAuthStore, retainUserSessions } from "../worker/auth.ts"
import { ensureVoiceClip, voiceClipStatus } from "../worker/ste-voice.ts"
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
assert(bob.lead.facts.hasSuperbet === false, "fato do Bob")

const html = toTelegramHtml(STE_COURSE_BLOCK[2]!)
assert(html.includes("<a href=\"https://mundoaviator.com.br/mini-curso/\">"), "html do telegram")
assert(!html.includes("]("), "markdown nao vaza")
assert(safeHttpUrl("https://t.me/bot")?.startsWith("https://t.me/bot"), "https passa")
assert(safeHttpUrl("javascript:alert(1)") === null, "javascript nao passa")
assert(splitSteMarkup("[x](javascript:alert(1))")[0]?.type === "text", "markup recusa javascript")
assert(!toTelegramHtml("[x](javascript:alert(1))").includes("href"), "html recusa javascript")

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

const kept = mergeSecrets({ telegramBotToken: "123:abc" }, { telegramBotToken: "•••• abc" })
assert(kept.telegramBotToken === "123:abc", "mascara nao apaga o token")
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
assert((await listLeads(kv, 400, "all")).some((item) => item.id === "crm-1"), "lista completa inclui o lead")
const newer = { ...first, lastMessage: "oi", updatedAt: new Date(Date.now() + 1000).toISOString() }
assert(mergeLeads([first], [newer])[0]?.lastMessage === "oi", "merge fica com o mais novo")
assert(mergeLeads([newer], [first])[0]?.lastMessage === "oi", "merge nao volta atras")

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
assert(validateCapture("Ana", "tg:9001").ok, "captura aceita tg:id")
assert(!validateCapture("Ana", "???").ok, "captura recusa contacto inválido")

assert(cleanBotUsername("@ste_bot") === "@ste_bot", "username válido fica")
assert(cleanBotUsername("steaviator") === "@steaviator", "username sem @ ganha @")
assert(cleanBotUsername("ab") === "", "username curto cai")
assert(cleanBotUsername("foo/bar") === "", "username com barra cai")
assert(cleanBotUsername("foo?x=1") === "", "username com query cai")
assert(adsDeepLink("foo/bar") === "", "deep link recusa handle inválido")
assert(adsDeepLink("@good_bot") === "https://t.me/good_bot?start=fb", "deep link usa handle limpo")
assert(cleanTelegramGroupUrl("https://t.me/+abc123").includes("t.me"), "convite t.me passa")
assert(cleanTelegramGroupUrl("https://evil.com/x") === "", "url alheia cai")
assert(cleanTelegramGroupUrl("javascript:alert(1)") === "", "javascript: cai")
assert(sanitizeIncomingLead({ id: " lead-1 ", name: " Ana ", contact: "@ana" })?.name === "Ana", "lead incoming corta espaços")
assert(sanitizeIncomingLead({ id: "" }) === null, "lead sem id cai")
assert(sanitizeIncomingLead({ id: "x".repeat(81) }) === null, "lead com id longo cai")
assert(
  (sanitizeIncomingLead({ id: "lead-2", telegramChatId: "9".repeat(80) })?.telegramChatId ?? "").length === 32,
  "chat id longo é cortado"
)
assert(sanitizeIncomingLead({ id: "lead-3", lastMessage: "z".repeat(800) })?.lastMessage?.length === 400, "lastMessage longo é cortado")
assert(cleanHttpUrl("javascript:alert(1)") === "", "javascript: no funil cai")
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
assert(!deletedOld.some((item) => item.id === publishedC.id), "reconcile deixa apagar funil mais velho")
const newestKept = reconcileFunnels(
  [{ ...publishedA, updatedAt: "2026-01-01T00:00:00.000Z" }, { ...publishedC, updatedAt: "2026-05-01T00:00:00.000Z" }],
  [{ ...publishedA, updatedAt: "2026-04-01T00:00:00.000Z" }]
)
assert(newestKept.some((item) => item.id === publishedC.id), "sem tombstone o funil mais novo fica")
assert(
  !applyRemovedFunnels(newestKept, [publishedC.id]).some((item) => item.id === publishedC.id),
  "tombstone apaga o funil mais novo"
)
assert(clipRemovedIds(["  ok  ", "", "x".repeat(81), "ok", 12, null]).join(",") === "ok", "ids removidos são cortados")
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
assert(!applyRemovedLeads([freshLead, liveLead], ["fresh"]).some((item) => item.id === "fresh"), "tombstone tira o lead da lista")
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
assert(leadsToCsv([lead()]).includes("lead-1"), "csv inclui o id")

assert(safeAppPath("/leads") === "/leads", "rota interna passa")
assert(safeAppPath("/configuracoes?tab=conta") === "/configuracoes?tab=conta", "query da conta passa")
assert(safeAppPath("//evil.com") === "/", "protocol-relative nao redireciona")
assert(safeAppPath("/\\evil") === "/", "backslash nao redireciona")
assert(safeAppPath("https://evil.com") === "/", "url absoluta cai no inicio")
assert(safeAppPath("/fluxo/funil/abc") === "/fluxo/funil/abc", "editor do funil passa")
assert(safeAppPath("/fluxo/funil/../x") === "/", "path traversal cai no inicio")

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
assert(
  (
    await handleAuth(
      new Request("http://local.test/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "victor@abilion.com", password: "senhaok" }),
      }),
      memoryAuthStore(),
      { ABILION_ENV: "production" }
    )
  ).status === 403,
  "produção sem senha de operador recusa o primeiro acesso"
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
await upsertLeadKv(kv, gone)
assert(!(await loadRemovedLeadIds(kv)).includes("gone"), "voltar a gravar limpa o tombstone")
assert((await findLeadInKv(kv, "@gone", 9, "9"))?.id === "gone", "alias volta quando o lead volta")
await deleteLeadKv(kv, "gone")

const capKv = memoryKv()
for (let i = 0; i < 401; i++) {
  const row = lead(`id-${i}`, `@u${i}`)
  row.telegramChatId = String(i)
  row.updatedAt = new Date(1_700_000_000_000 + i * 1000).toISOString()
  await upsertLeadKv(capKv, row)
}
assert((await findLeadInKv(capKv, "@u0", 0, "0"))?.id === "id-0", "alias encontra lead fora do recorte de 400")
assert((await listLeads(capKv, 400, "all")).length === 400, "lista continua no teto de 400")
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
  (await dueLeadsKv(capKv, new Date().toISOString())).some((item) => item.id === "wait-old"),
  "espera antiga não cai do índice"
)
const lockKv = memoryKv()
assert(await claimCronLock(lockKv, Date.now(), 90_000), "cron pega o lock")
assert(!(await claimCronLock(lockKv, Date.now(), 90_000)), "lock impede cron sobreposto")
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
const deniedSummary = await handleRequest(new Request("http://local.test/api/track/summary"), apiEnv, backgroundCtx())
assert(deniedSummary.status === 401, "analytics sem sessão é 401")
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
assert((await tracker.text()).includes("/api/track"), "t.js aponta o pixel")
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

const inboxLead = simulateOpenLead([emptySalesFunnel("inbox")])
assert(!inboxLead.steBlocked && !inboxLead.steQuiet, "simular conversa não encerra")
assert((inboxLead.messages ?? []).some((item) => item.role === "lead"), "simular conversa tem fala do lead")
assert((inboxLead.messages ?? []).some((item) => item.role === "ste"), "simular conversa tem resposta da Sté")
assert(inboxLead.stePhase !== "closed", "simular conversa fica no funil")
assert(!inboxLead.telegramChatId, "simular conversa não inventa chat id")
assert(canTickSteLocally(inboxLead), "simulação avança no painel")
assert(!canTickSteLocally({ ...inboxLead, telegramChatId: "9001" }), "lead real do Telegram não avança no painel")
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
const ghostFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input)
  if (url.includes("/rest/v1/leads") && url.includes("wait_until")) {
    return new Response(
      JSON.stringify([
        {
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
        },
      ]),
      { status: 200, headers: { "content-type": "application/json" } }
    )
  }
  return new Response("[]", { status: 200, headers: { "content-type": "application/json" } })
}) as typeof fetch
try {
  const ghostCron = await handleRequest(new Request("http://local.test/api/cron?secret=cron"), ghostEnv, backgroundCtx())
  const ghostBody = (await ghostCron.json()) as { ok?: boolean; advanced?: number }
  assert(ghostCron.status === 200 && ghostBody.ok && ghostBody.advanced === 0, "cron ignora espera tombstoned do Supabase")
  assert((await loadLead(ghostEnv.AUTH, ghostDue.id)) === null, "cron nao ressuscita lead apagado")
} finally {
  globalThis.fetch = ghostFetch
}

console.log("ste-flow ok")
