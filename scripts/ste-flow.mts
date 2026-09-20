import { chatStarted, funnelFrom, markersFromGeos, mergeGlobeGeos, periodDelta, stepDrop } from "../src/lib/analytics-view.ts"
import { coordsFromGeo } from "../src/lib/geo-coords.ts"
import { flagEmoji, formatGeo, mergeGeo, normalizeRegionCode, stateLabel } from "../src/lib/geo.ts"
import { emptySummary, isFacebookTraffic, summarizeTrack, type TrackEvent } from "../src/lib/track.ts"
import {
  isolateLead,
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
  toTelegramHtml,
} from "../src/lib/ste.ts"
import { emptySalesFunnel } from "../src/lib/templates.ts"
import { mergeLeads } from "../src/lib/crm.ts"
import type { Lead } from "../src/lib/types.ts"
import { deleteLeadKv, findLeadInKv, loadLead, upsertLeadKv } from "../worker/crm-store.ts"
import { memoryKv } from "../worker/kv.ts"
import { STE_LLM_FALLBACK, STE_LLM_MODEL, STE_OPENCODE_MODEL, steLlmAttempts, steModelChain } from "../src/lib/llm.ts"
import { clipHash, linkFollowUp, linksFromReplies, spokenHasUrl, STE_VOICE_CLIPS, voiceClipFor } from "../src/lib/ste-voice.ts"
import { safeAppPath } from "../src/lib/safe-path.ts"
import { validateCapture } from "../src/lib/capture.ts"
import { cleanBotUsername, cleanTelegramGroupUrl, sanitizeIncomingLead } from "../src/lib/migrate.ts"
import { adsDeepLink } from "../src/lib/telegram-start.ts"
import { mergeSecrets, resolveRuntime, tokenHint } from "../worker/runtime-secrets.ts"
import { consumeThrottle, consumeMemoryThrottle, clearThrottle, handleAuth, memoryAuthStore } from "../worker/auth.ts"
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
assert((await loginAttempt("senhaok")).status === 200, "primeiro acesso define a senha")
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

const gone = lead("gone", "@gone")
gone.telegramChatId = "9"
await upsertLeadKv(kv, gone)
assert((await loadLead(kv, "gone"))?.contact === "@gone", "lead persistido no KV")
await deleteLeadKv(kv, "gone")
assert((await loadLead(kv, "gone")) === null, "lead apagado do KV")

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
const deniedSummary = await handleRequest(new Request("http://local.test/api/track/summary"), apiEnv, backgroundCtx())
assert(deniedSummary.status === 401, "analytics sem sessão é 401")
const health = await handleRequest(new Request("http://local.test/api/health"), apiEnv, backgroundCtx())
const healthBody = (await health.json()) as { ok?: boolean; telegramBotUsername?: string }
assert(health.status === 200 && healthBody.ok && healthBody.telegramBotUsername === "", "health público expõe username vazio")

console.log("ste-flow ok")
