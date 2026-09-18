import { uid } from "./format"
import type { ChatMessage, Lead, Settings, StePhase } from "./types"

export const STE_LANDING = "https://app.mundoaviator.com.br/"
export const STE_COURSE = "https://mundoaviator.com.br/mini-curso/"
export const STE_PREMIUM = "https://mundoaviator.com.br/premium-vsl/"
export const STE_CHECKOUT = "https://go.perfectpay.com.br/PPU38CQDT9B"
export const STE_SUPERBET =
  "https://wlsuperbet.adsrv.eacdn.com/C.ashx?btag=a_46644b_432c_&affid=873&siteid=46644&adid=432&c=&asclurl=https://superbet.bet.br/registro?bonus=STEAVIATOR"

export const STE_LINKS = {
  course: { label: "clique aqui para acessar o minicurso gratuito", url: STE_COURSE },
  superbet: { label: "clique aqui para criar sua conta na Superbet com bônus", url: STE_SUPERBET },
  app: { label: "clique aqui para conhecer os planos do App", url: STE_LANDING },
  premium: { label: "clique aqui para conhecer o Grupo Premium", url: STE_PREMIUM },
  checkout: { label: "clique aqui para garantir sua vaga direto no checkout", url: STE_CHECKOUT },
} as const

export function maskLink(label: string, url: string) {
  return `[${label}](${url})`
}

export function steLink(key: keyof typeof STE_LINKS) {
  const item = STE_LINKS[key]
  return maskLink(item.label, item.url)
}

export const STE_SYSTEM_PROMPT = `# IDENTIDADE E PAPEL
Você é a Sté, conhecida como a "Mãe do Aviator". Você é especialista em iGaming, analista de mercado de apostas e criadora de estratégias profissionais. O lead que está chegando no Telegram veio de anúncios e da Landing Page, ou seja, muitos ainda não te conhecem bem. Seu tom de voz é receptivo, profissional, firme, acolhedor e focado em ensinar o caminho certo. Você odeia "promessas de robô milagroso" e foca em método, lógica e gestão.

# REGRA DE FORMATAÇÃO DE LINKS (OBRIGATÓRIO NO TELEGRAM)
- NUNCA envie URLs longas ou cruas no meio da conversa.
- Todos os links devem ser inseridos em formato de hiperlink (texto âncora), com o texto clicável, mantendo a conversa limpa e profissional. Exemplo: \`[clique aqui para se cadastrar](url)\`.

# FLUXO DA CONVERSA (PASSO A PASSO)

## PASSO 1: BOAS-VINDAS E APRESENTAÇÃO
Assim que o usuário iniciar o bot (/start), envie mensagens curtas e naturais apresentando quem você é:
- Mensagem 1: "Opa, seja muito bem-vindo! Aqui é a Sté, conhecida como a Mãe do Aviator."
- Mensagem 2: "Criei esse espaço para guiar quem quer operar de forma profissional, sem cair em furada ou achismo."
- Mensagem 3: "Para eu te conhecer melhor e saber como posso te ajudar: você já joga Aviator? Tem experiência com o jogo ou está começando agora? Como têm sido seus resultados?"
*(O bot deve parar aqui e ESPERAR o lead responder).*

## PASSO 2: ACOLHIMENTO E MINICURSO (VALOR ANTES DA VENDA)
Assim que o lead responder, acolha a resposta com empatia e ofereça o minicurso usando link mascarado:
- Resposta base: "Te entendo perfeitamente! Para quem está começando ou quer alinhar a estratégia, eu preparei um minicurso completo do zero."
- O que o minicurso ensina: Como se cadastrar na plataforma, como jogar com segurança, como acompanhar minhas lives e como fazer a gestão da própria banca.
- Link: ${steLink("course")}
- Pergunta de transição: "Dá uma olhada nesse material para pegar a base. Mas me diz uma coisa: você já tem conta na plataforma oficial onde eu opero e faço minhas transmissões?"

## PASSO 3: A OFERTA DA PLATAFORMA (SUPERBET) E O GATILHO DE 5 A 10 MINUTOS
Quando o lead responder sobre a plataforma, apresente a Superbet com os benefícios e o link mascarado:
- Argumento inicial: "Para rodar as nossas estratégias de verdade, operar junto comigo nas lives e ter resultado, você precisa estar na casa certa. Eu opero e recomendo a Superbet."
- Benefícios: Gráfico exclusivo do Aviator, cashback diário, torneios semanais, alavancagem de banca e onde rolam as lives.
- Link: ${steLink("superbet")}

### A REGRA DE OURO DO CADASTRO (FOLLOW-UP 5 A 10 MINUTOS)
- Após enviar o link da Superbet, encerre o bloco e espere de 5 a 10 minutos.
- Se o lead não responder confirmando o cadastro nesse intervalo, envie:
  "E aí, conseguiu fazer o cadastro na plataforma? Porque essa semana a gente conseguiu uma promoção para novos jogadores que, se você conseguir fazer o seu cadastro e fazer qualquer tipo de depósito, a gente te dá mais uma banca para você jogar. Me confirma aí se você conseguiu, se você é um cliente novo, que eu te dou esse bônus de entrada para jogar com a gente na próxima live."

## PASSO 4: APRESENTAÇÃO DO APP, DO GRUPO PREMIUM E CHECKOUT DIRETO
Quando o lead demonstrar interesse em elevar o nível, assinar ferramentas ou pedir o link para garantir acesso imediato:
- O App: Ferramenta própria com catalogador em tempo real, validador de padrões e gestão de banca blindada.
  Link: ${steLink("app")}
- O Grupo Premium (Sinais e Oportunidades):
  "Além do app, nós temos o nosso Grupo Premium de Sinais. É uma lista de oportunidades super extensa analisada por mim pessoalmente, com 5 oportunidades diárias das 08:00 até 01:30, incluindo os sinais de 4x."
  Link: ${steLink("premium")}
- Checkout direto:
  Link: ${steLink("checkout")}

# HORÁRIOS DAS LIVES (FAQ / DÚVIDAS)
- "Eu faço lives diárias para a gente operar junto e pegar as melhores velas. Anota aí os horários:"
- Manhã: 10:30
- Tarde: 15:30 (3:30 da tarde)
- Noite: 20:30 (8:30 da noite)
- "Sempre aviso lá no canal principal momentos antes de entrar ao vivo, então fica de olho!"

# REGRA DE REMARKETING (7 HORAS APÓS A ENTRADA)
- Se passarem 7 horas e o lead não finalizar a conversão, chame-o ativamente: pergunte como estão os resultados, se viu o minicurso, reforce a importância de não operar sozinho e envie os links mascarados das soluções ou o link de checkout direto.

# REGRAS DE OURO PARA O TELEGRAM
- Envie as mensagens em blocos curtos e separados (simulando digitação humana), nunca blocos gigantes de texto.
- Seja sempre receptiva com quem está chegando agora e não te conhece.
- Off-topic: redirecione para Aviator / método.
- Ofensa: uma desculpa neutra e NUNCA MAIS responder.`

export const STE_CLOSE =
  "Peço desculpas se te causei qualquer incômodo. Vou encerrar nosso atendimento por aqui para não te ocupar mais. Muito sucesso na sua jornada!"

export const STE_WELCOME = [
  "Opa, seja muito bem-vindo! Aqui é a Sté, conhecida como a Mãe do Aviator.",
  "Criei esse espaço para guiar quem quer operar de forma profissional, sem cair em furada ou achismo.",
  "Para eu te conhecer melhor e saber como posso te ajudar: você já joga Aviator? Tem experiência com o jogo ou está começando agora? Como têm sido seus resultados?",
] as const

export const STE_COURSE_BLOCK = [
  "Te entendo perfeitamente! Para quem está começando ou quer alinhar a estratégia, eu preparei um minicurso completo do zero.",
  "Ele ensina a se cadastrar na plataforma, jogar com segurança, acompanhar minhas lives e fazer a gestão da própria banca.",
  steLink("course"),
  "Dá uma olhada nesse material para pegar a base. Mas me diz uma coisa: você já tem conta na plataforma oficial onde eu opero e faço minhas transmissões?",
]

export const STE_SUPERBET_BLOCK = [
  "Para rodar as nossas estratégias de verdade, operar junto comigo nas lives e ter resultado, você precisa estar na casa certa. Eu opero e recomendo a Superbet.",
  "Lá tem gráfico exclusivo do Aviator, cashback diário, torneios semanais, alavancagem de banca e é onde rolam as lives.",
  steLink("superbet"),
]

export const STE_SUPERBET_RESCUE =
  "E aí, conseguiu fazer o cadastro na plataforma? Porque essa semana a gente conseguiu uma promoção para novos jogadores que, se você conseguir fazer o seu cadastro e fazer qualquer tipo de depósito, a gente te dá mais uma banca para você jogar. Me confirma aí se você conseguiu, se você é um cliente novo, que eu te dou esse bônus de entrada para jogar com a gente na próxima live."

export const STE_OFFER_BLOCK = [
  "O App é a ferramenta própria: catalogador em tempo real, validador de padrões e gestão de banca blindada.",
  steLink("app"),
  "Além do app, nós temos o nosso Grupo Premium de Sinais. É uma lista de oportunidades super extensa analisada por mim pessoalmente, com 5 oportunidades diárias das 08:00 até 01:30, incluindo os sinais de 4x.",
  steLink("premium"),
  "Se já quiser garantir a vaga agora:",
  steLink("checkout"),
]

export const STE_LIVE_BLOCK = [
  "Eu faço lives diárias para a gente operar junto e pegar as melhores velas. Anota aí os horários:",
  "Manhã: 10:30. Tarde: 15:30 (3:30 da tarde). Noite: 20:30 (8:30 da noite).",
  "Sempre aviso lá no canal principal momentos antes de entrar ao vivo, então fica de olho!",
]

export const STE_REMARKETING_BLOCK = [
  "E aí, como têm sido os resultados desde que a gente se falou? Você conseguiu acompanhar o material?",
  `Se ainda não viu o minicurso: ${steLink("course")}`,
  "Operar sozinho é o que mais queima banca. O nosso produto é o Grupo Premium de Sinais — 5 oportunidades por dia, das 08:00 até 01:30, incluindo os de 4x.",
  steLink("premium"),
  "Se quiser garantir a vaga agora:",
  steLink("checkout"),
]

const HOSTILE =
  /(vai se f|vai tomar|\bvsf\b|\bfdp\b|filho da|sua m[aã]e|\bidiota\b|\bimbecil\b|lixo humano|te foder|cuz[aã]o|arrombado|otári[oa] de merda|cala a boca)/i

const OFFTOPIC =
  /\b(eleição|eleicao|bolsonaro|lula|receita de|bolo|clima|previsão do tempo|futebol|flamengo|política|politica)\b/i

const LIVE_HOURS =
  /\b(live|lives|horário|horario|transmissão|transmissao|que horas|quando (voc[eê]|tu) (entra|opera|transmite)|hora da live)\b/i

const WANT_OFFER =
  /\b(app|plano|planos|assinar|assinatura|ferramenta|catalogador|premium|checkout|vaga|preço|preco|valor|quanto custa|perfectpay|pagar|quero o (app|grupo)|link do (app|grupo|checkout))\b/i

const SIGNED_UP =
  /\b(cadastrei|me cadastrei|fiz o cadastro|criei a conta|já tenho conta|ja tenho conta|já tenho|ja tenho|depositei|depósito|deposito|sou cliente|conta feita|tá feito|ta feito)\b/i

const CONVERTED = /\b(paguei|assinei|comprei|já assinei|ja assinei|já paguei|ja paguei)\b/i

const MEM = {
  superbet: "ste:superbet",
  remarketing: "ste:remarketing",
  rescued: "ste:rescued",
  converted: "ste:converted",
} as const

const SUPERBET_WAIT_MS = 7 * 60_000
const REMARKETING_MS = 7 * 60 * 60_000
const REDIRECT = "Bora ficar no Aviator — me conta se você já joga, se está começando agora e como têm sido seus resultados."

export type SteMarkup =
  | { type: "text"; text: string }
  | { type: "link"; text: string; url: string }

export type SteRuntime = {
  welcome?: string[]
  remarketing?: string[]
  dieAfterRemarketing?: boolean
}

export type SteResult = {
  lead: Lead
  replies: string[]
  reply: string | null
}

export function steRuntimeFromSettings(settings?: Partial<Settings> | null): SteRuntime {
  const welcome = settings?.steWelcomeLines?.filter(Boolean) ?? []
  const remarketing = settings?.steRemarketingLines?.filter(Boolean) ?? []
  return {
    welcome: welcome.length === 3 ? welcome : undefined,
    remarketing: remarketing.length ? remarketing : undefined,
    dieAfterRemarketing: settings?.steDieAfterRemarketing !== false,
  }
}

export function isolateLead(lead: Lead): Lead {
  return {
    id: lead.id,
    name: lead.name,
    contact: lead.contact,
    channel: lead.channel,
    campaign: lead.campaign,
    origin: lead.origin,
    startPayload: lead.startPayload,
    visitorId: lead.visitorId,
    temperature: lead.temperature,
    stage: lead.stage,
    printAt: lead.printAt,
    bancaAt: lead.bancaAt,
    memory: lead.memory ?? "",
    facts: { ...(lead.facts ?? {}) },
    lastMessage: lead.lastMessage,
    funnelId: lead.funnelId,
    nodeId: lead.nodeId,
    waitUntil: lead.waitUntil,
    paused: lead.paused,
    events: (lead.events ?? []).map((item) => ({ ...item })),
    messages: (lead.messages ?? []).map((item) => ({ ...item })),
    stePhase: lead.stePhase ?? "entry",
    steBlocked: lead.steBlocked,
    steQuiet: lead.steQuiet,
    telegramChatId: lead.telegramChatId,
    updatedAt: lead.updatedAt,
    createdAt: lead.createdAt,
  }
}

export function applyLeadFacts(lead: Lead, incoming: string) {
  const text = incoming.trim()
  if (!text) return
  const facts = { ...(lead.facts ?? {}) }
  if (/come[cç]ando|iniciante|primeira vez|nunca jog/i.test(text)) facts.experience = "beginner"
  if (/j[aá] jogo|experien|veterano|h[aá] tempo/i.test(text)) facts.experience = "experienced"
  if (/perdend|queim|no preju/i.test(text)) facts.results = "losing"
  if (/ganhand|lucr|positivo/i.test(text)) facts.results = "winning"
  if (SIGNED_UP.test(text)) facts.hasSuperbet = true
  if (/n[aã]o tenho conta|ainda n[aã]o tenho|sem conta/i.test(text)) facts.hasSuperbet = false
  lead.facts = facts
}

export function steStepLabel(lead: Lead) {
  if (lead.steQuiet) return "Quieto"
  if (lead.steBlocked || lead.stePhase === "closed") return "Encerrado"
  if (lead.stePhase === "listen") return "Boas-vindas"
  if (lead.stePhase === "diagnosis") return "Minicurso"
  if (lead.stePhase === "solution") return "Superbet"
  if (lead.stePhase === "offer") return "Oferta"
  return "Entrada"
}

function nowIso(now = Date.now()) {
  return new Date(now).toISOString()
}

function resolveCopy(runtime?: SteRuntime) {
  const welcome = runtime?.welcome?.map((item) => item.trim()).filter(Boolean)
  const remarketing = runtime?.remarketing?.map((item) => item.trim()).filter(Boolean)
  return {
    welcome: welcome && welcome.length === 3 ? welcome : [...STE_WELCOME],
    remarketing: remarketing && remarketing.length ? remarketing : [...STE_REMARKETING_BLOCK],
    dieAfterRemarketing: runtime?.dieAfterRemarketing !== false,
  }
}

function cloneLead(lead: Lead): Lead {
  return isolateLead(lead)
}

function memHas(lead: Lead, token: string) {
  return (lead.memory || "").split(/\s+/).includes(token)
}

function memAdd(lead: Lead, token: string) {
  if (memHas(lead, token)) return
  lead.memory = `${lead.memory || ""} ${token}`.trim()
}

function memDel(lead: Lead, token: string) {
  lead.memory = (lead.memory || "")
    .split(/\s+/)
    .filter((item) => item && item !== token)
    .join(" ")
}

function push(lead: Lead, role: ChatMessage["role"], text: string, now = Date.now()) {
  const at = nowIso(now)
  const message: ChatMessage = { id: uid(), at, role, text }
  lead.messages = [...(lead.messages ?? []), message]
  lead.lastMessage = text
  lead.updatedAt = at
  if (role === "ste") {
    lead.stage = lead.stePhase === "offer" ? "offer" : lead.stePhase === "listen" ? "welcome" : "attendance"
  }
}

function pushAll(lead: Lead, texts: readonly string[], now = Date.now()) {
  for (const text of texts) push(lead, "ste", text, now)
}

function pack(lead: Lead, replies: string[]): SteResult {
  return { lead, replies, reply: replies.at(-1) ?? null }
}

function hasSteMessage(lead: Lead) {
  return (lead.messages ?? []).some((item) => item.role === "ste")
}

function scheduleRemarketing(lead: Lead, now: number) {
  if (lead.steBlocked || memHas(lead, MEM.converted)) {
    if (memHas(lead, MEM.remarketing) && !memHas(lead, MEM.superbet)) lead.waitUntil = undefined
    return
  }
  const due = new Date(lead.createdAt).getTime() + REMARKETING_MS
  if (now >= due) return
  memAdd(lead, MEM.remarketing)
  if (memHas(lead, MEM.superbet)) return
  lead.waitUntil = new Date(due).toISOString()
}

function scheduleSuperbet(lead: Lead, now: number) {
  memAdd(lead, MEM.superbet)
  memDel(lead, MEM.remarketing)
  lead.waitUntil = new Date(now + SUPERBET_WAIT_MS).toISOString()
}

function cancelSuperbetWait(lead: Lead, now: number) {
  memDel(lead, MEM.superbet)
  scheduleRemarketing(lead, now)
}

export function isSteWait(lead: Lead) {
  return Boolean(lead.waitUntil) && (memHas(lead, MEM.superbet) || memHas(lead, MEM.remarketing))
}

export function splitSteMarkup(text: string): SteMarkup[] {
  const nodes: SteMarkup[] = []
  const pattern = /\[([^\]]+)\]\((https?:[^)\s]+)\)/g
  let cursor = 0
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > cursor) nodes.push({ type: "text", text: text.slice(cursor, index) })
    nodes.push({ type: "link", text: match[1] ?? "", url: match[2] ?? "" })
    cursor = index + match[0].length
  }
  if (cursor < text.length) nodes.push({ type: "text", text: text.slice(cursor) })
  return nodes.length ? nodes : [{ type: "text", text }]
}

export function toTelegramHtml(text: string) {
  const parts = splitSteMarkup(text)
  return parts
    .map((part) => {
      if (part.type === "text") {
        return part.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      }
      const href = part.url.replace(/&/g, "&amp;").replace(/"/g, "&quot;")
      const label = part.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      return `<a href="${href}">${label}</a>`
    })
    .join("")
}

function setPhase(lead: Lead, phase: StePhase) {
  lead.stePhase = phase
}

function welcome(lead: Lead, now: number, lines: string[]) {
  setPhase(lead, "listen")
  pushAll(lead, lines, now)
  scheduleRemarketing(lead, now)
  return pack(lead, [...lines])
}

function course(lead: Lead, now: number) {
  setPhase(lead, "diagnosis")
  pushAll(lead, STE_COURSE_BLOCK, now)
  scheduleRemarketing(lead, now)
  return pack(lead, [...STE_COURSE_BLOCK])
}

function superbet(lead: Lead, now: number) {
  setPhase(lead, "solution")
  pushAll(lead, STE_SUPERBET_BLOCK, now)
  scheduleSuperbet(lead, now)
  return pack(lead, [...STE_SUPERBET_BLOCK])
}

function offer(lead: Lead, now: number) {
  setPhase(lead, "offer")
  cancelSuperbetWait(lead, now)
  pushAll(lead, STE_OFFER_BLOCK, now)
  scheduleRemarketing(lead, now)
  return pack(lead, [...STE_OFFER_BLOCK])
}

function lives(lead: Lead, now: number) {
  pushAll(lead, STE_LIVE_BLOCK, now)
  return pack(lead, [...STE_LIVE_BLOCK])
}

function close(lead: Lead, now: number) {
  lead.steBlocked = true
  setPhase(lead, "closed")
  lead.waitUntil = undefined
  push(lead, "ste", STE_CLOSE, now)
  return pack(lead, [STE_CLOSE])
}

function replyToIncoming(lead: Lead, incoming: string, now: number): SteResult {
  applyLeadFacts(lead, incoming)
  if (HOSTILE.test(incoming)) return close(lead, now)
  if (CONVERTED.test(incoming)) memAdd(lead, MEM.converted)
  if (LIVE_HOURS.test(incoming)) return lives(lead, now)
  if (WANT_OFFER.test(incoming)) return offer(lead, now)
  if (OFFTOPIC.test(incoming)) {
    push(lead, "ste", REDIRECT, now)
    return pack(lead, [REDIRECT])
  }

  const phase = lead.stePhase ?? "entry"
  if (phase === "listen" || phase === "entry") return course(lead, now)

  if (phase === "diagnosis") return superbet(lead, now)

  if (phase === "solution") {
    cancelSuperbetWait(lead, now)
    if (SIGNED_UP.test(incoming)) {
      setPhase(lead, "offer")
      const text = "Boa! Com a conta certa a gente opera junto nas lives. Qualquer depósito novo eu te encaixo no bônus de entrada."
      push(lead, "ste", text, now)
      return pack(lead, [text])
    }
    const text = "Me confirma se o cadastro na Superbet já saiu — se travar em alguma etapa, me fala que eu te ajudo."
    push(lead, "ste", text, now)
    return pack(lead, [text])
  }

  const text = `Se quiser subir de nível, o caminho é o App, o Grupo Premium ou o checkout direto: ${steLink("app")}`
  push(lead, "ste", text, now)
  setPhase(lead, "offer")
  return pack(lead, [text])
}

export function replySte(lead: Lead, incoming?: string | null, now = Date.now(), runtime?: SteRuntime): SteResult {
  const next = cloneLead(lead)
  if (next.steBlocked || next.steQuiet || next.stePhase === "closed") return pack(next, [])

  const text = (incoming ?? "").trim()
  if (text) push(next, "lead", text, now)

  if (!text) {
    if (!hasSteMessage(next)) return welcome(next, now, resolveCopy(runtime).welcome)
    return pack(next, [])
  }

  return replyToIncoming(next, text, now)
}

export function replySteTick(lead: Lead, now = Date.now(), runtime?: SteRuntime): SteResult {
  const next = cloneLead(lead)
  if (next.steBlocked || next.steQuiet || next.stePhase === "closed") {
    next.waitUntil = undefined
    return pack(next, [])
  }

  const due = next.waitUntil ? new Date(next.waitUntil).getTime() : 0
  if (!due || due > now) return pack(next, [])

  if (memHas(next, MEM.superbet)) {
    memDel(next, MEM.superbet)
    memAdd(next, MEM.rescued)
    setPhase(next, "offer")
    push(next, "ste", STE_SUPERBET_RESCUE, now)
    scheduleRemarketing(next, now)
    return pack(next, [STE_SUPERBET_RESCUE])
  }

  if (memHas(next, MEM.remarketing) && !memHas(next, MEM.converted)) {
    const copy = resolveCopy(runtime)
    memDel(next, MEM.remarketing)
    next.waitUntil = undefined
    pushAll(next, copy.remarketing, now)
    if (copy.dieAfterRemarketing) {
      next.steQuiet = true
      setPhase(next, "closed")
    }
    return pack(next, [...copy.remarketing])
  }

  next.waitUntil = undefined
  return pack(next, [])
}

export const STE_LLM_MODEL = "glm-5.3-flash"
export const STE_LLM_BASE_URL = "https://api.z.ai/api/coding/paas/v4"

function splitBlocks(raw: string) {
  return raw
    .split(/\n{2,}/)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 4)
}

export function advanceSteIfDue(lead: Lead, now = Date.now(), runtime?: SteRuntime): SteResult {
  const due = lead.waitUntil ? new Date(lead.waitUntil).getTime() : 0
  if (!due || due > now || !isSteWait(lead)) return { lead, replies: [], reply: null }
  return replySteTick(lead, now, runtime)
}

export async function replySteSmart(
  lead: Lead,
  incoming: string | null | undefined,
  opts?: { apiKey?: string; baseUrl?: string; model?: string; runtime?: SteRuntime }
): Promise<SteResult> {
  const isolated = isolateLead(lead)
  const scripted = replySte(isolated, incoming, Date.now(), opts?.runtime)
  const key = opts?.apiKey
  const generic = scripted.replies[0]?.startsWith("Se quiser subir de nível")
  if (!key || !generic || scripted.lead.steBlocked || scripted.lead.steQuiet) return scripted

  const next = scripted.lead
  next.messages = next.messages.slice(0, -1)
  try {
    const own = next.messages.filter((item) => item.id && next.id)
    const history = own.slice(-14).map((item) => ({
      role: item.role === "ste" ? "assistant" : "user",
      content: item.text,
    }))
    const res = await fetch(`${(opts?.baseUrl ?? STE_LLM_BASE_URL).replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: opts?.model ?? STE_LLM_MODEL,
        temperature: 1,
        top_p: 0.95,
        max_tokens: 1024,
        thinking: { type: "enabled" },
        reasoning_effort: "low",
        messages: [
          {
            role: "system",
            content: `${STE_SYSTEM_PROMPT}\n\nFase atual: offer. Fatos só deste lead: ${JSON.stringify(next.facts ?? {})}. Responda em português, no máximo 3 blocos curtos separados por linha em branco. Links só como [texto](url). Sem URL crua. Nunca use dados de outra conversa.`,
          },
          ...history,
        ],
      }),
    })
    if (!res.ok) {
      pushAll(next, scripted.replies)
      return scripted
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const blocks = splitBlocks(data.choices?.[0]?.message?.content ?? "")
    if (!blocks.length) {
      pushAll(next, scripted.replies)
      return scripted
    }
    pushAll(next, blocks)
    return pack(next, blocks)
  } catch {
    pushAll(next, scripted.replies)
    return scripted
  }
}
