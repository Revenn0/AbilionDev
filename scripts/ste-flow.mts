import {
  replySte,
  replySteTick,
  STE_WELCOME,
  STE_COURSE_BLOCK,
  STE_SUPERBET_BLOCK,
  STE_SUPERBET_RESCUE,
  STE_OFFER_BLOCK,
  STE_LIVE_BLOCK,
  STE_REMARKETING_BLOCK,
  STE_CLOSE,
  toTelegramHtml,
} from "../src/lib/ste.ts"
import type { Lead } from "../src/lib/types.ts"

function lead(): Lead {
  const now = new Date().toISOString()
  return {
    id: "lead-1",
    name: "Lead",
    contact: "@fb1",
    channel: "telegram",
    campaign: "facebook",
    origin: "facebook",
    temperature: "novo",
    stage: "welcome",
    memory: "",
    events: [],
    messages: [],
    createdAt: now,
    updatedAt: now,
  }
}

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message)
}

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

const html = toTelegramHtml(STE_COURSE_BLOCK[2]!)
assert(html.includes("<a href=\"https://mundoaviator.com.br/mini-curso/\">"), "html do telegram")
assert(!html.includes("]("), "markdown nao vaza")

console.log("ste-flow ok")
