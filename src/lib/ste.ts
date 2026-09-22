import { uid } from "./format.ts"
import { llmHeaders, steLlmAttempts, type SteLlmProvider, STE_LLM_BASE_URL, STE_LLM_FALLBACK, STE_LLM_MODEL } from "./llm.ts"
import { isOperatorLockedLead } from "./ops.ts"
import { leadFunnelUnread, publishedFunnel } from "./runtime.ts"
import type { ChatMessage, FlowNode, Lead, LeadFacts, SalesFunnel, SalesSnapshot, Settings, SteLine, StePhase } from "./types.ts"

export { STE_LLM_BASE_URL, STE_LLM_FALLBACK, STE_LLM_MODEL }

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

export const STE_SUPERBET_CONFIRM =
  "Me confirma se o cadastro na Superbet já saiu — se travar em alguma etapa, me fala que eu te ajudo."

export const STE_SUPERBET_OK =
  "Boa! Com a conta certa a gente opera junto nas lives. Qualquer depósito novo eu te encaixo no bônus de entrada."

export const STE_SUPERBET_HELP =
  "Se o cadastro travar, me diz a etapa: CPF, selfie ou depósito. Ou manda o print que eu te ajudo."

export const STE_SUPERBET_HOLD = `Sem pressa. Quando o cadastro sair, manda o print aqui. O link continua este: ${steLink("superbet")}`

export const STE_SUPERBET_STEP =
  "Me diz a etapa que travou: CPF, selfie ou depósito. Com o print eu te falo o que fazer."

export const STE_LISTEN_REASK =
  "Oi! Pra eu te orientar direito: você já joga Aviator ou está começando agora? E como têm sido os resultados?"

export const STE_PRINT_EARLY =
  "Vi o print. Antes de seguir, me conta: você já joga Aviator ou está começando agora? E como têm sido os resultados?"

export const STE_OFFER_NEXT =
  "Com a conta feita, o próximo passo é o App ou o Grupo Premium. Quer que eu te explique a diferença?"

export const STE_OFFER_ACK =
  "Fechado. Quando quiser o link do App, do Grupo Premium ou do checkout, é só pedir."

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
  /\b(lives?|hor[aá]rios? das lives|transmiss[aã]o|quando (voc[eê]|tu) (entra|opera|transmite)|hora da live|que horas\b[^?.!]{0,40}\b(live|lives|entra|opera|transmite))\b/i

const WANT_OFFER =
  /\b(app|planos|assinar|assinatura|ferramenta|catalogador|premium|checkout|vaga|pre[cç]o|quanto custa|perfectpay|pagar|quero o (app|grupo)|link do (app|grupo|checkout))\b/i

const SIGNED_UP =
  /\b(cadastrei|me cadastrei|fiz o cadastro|criei a conta|j[aá] tenho conta|depositei|dep[oó]sito feito|sou cliente|conta feita|cadastro (feito|ok|pronto)|j[aá] (fiz|saiu|cadastrei)|consegui cadastr)\b/i

const SENT_PRINT = /\b(print|printou|screenshot)\b/i

const GREETING = /^(oi+|o+l[aá]|e+ a[ií]|opa|hey|hola|bom dia|boa tarde|boa noite)\b/i

function isOnlyGreeting(text: string) {
  return /^(oi+|ol[aá]+|e+ a[ií]|opa|hey|hola|bom dia|boa tarde|boa noite|tudo bem)[!.?\s]*$/i.test(text.trim())
}

function affirms(text: string) {
  return /^(sim|ss|claro|isso|pronto|feito|consegui|já|ja|foi|cadastrei)[!.?\s]*$/i.test(text.trim())
}

function denies(text: string) {
  return /^(n[aã]o|ainda n[aã]o|nao|n)[!.?\s]*$/i.test(text.trim())
    || /\b(ainda n[aã]o|n[aã]o consegui|n[aã]o deu|n[aã]o abre|n[aã]o fiz|n[aã]o tenho|n[aã]o mandei|travei na|travou na|emperrou)\b/i.test(text)
}

function mentionsPrint(text: string) {
  if (!SENT_PRINT.test(text) || denies(text)) return false
  return !/\b(n[aã]o|sem|nenhum)\b[^?.!]{0,30}\b(print|printou|screenshot)\b/i.test(text)
}

export function heardSuperbetSignup(incoming: string) {
  const text = incoming.trim()
  if (!text || denies(text)) return false
  return SIGNED_UP.test(text) || mentionsPrint(text)
}

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

export type SteBeatKind =
  | "welcome"
  | "course"
  | "superbet"
  | "rescue"
  | "offer"
  | "lives"
  | "remarketing"
  | "close"
  | "confirm"
  | "redirect"
  | "idle"

export type SteBeat = {
  kind: SteBeatKind
  vary: boolean
  requiredUrls: string[]
  keepPhrases: string[]
}

const FROZEN_BEATS = new Set<SteBeatKind>(["welcome", "close", "idle", "rescue", "remarketing"])
const INVENTED_CLAIM = /garantido|\b100\s?%|acerto de|te dou r\$|pix\s+\d|banca de\s+\d/i

export function urlsIn(texts: readonly string[]) {
  const found: string[] = []
  const pattern = /\]\((https?:[^)\s]+)\)/g
  for (const text of texts) {
    for (const match of text.matchAll(pattern)) {
      if (match[1] && !found.includes(match[1])) found.push(match[1])
    }
  }
  return found
}

export function beatFor(kind: SteBeatKind, replies: readonly string[] = []): SteBeat {
  return {
    kind,
    vary: !FROZEN_BEATS.has(kind),
    requiredUrls: urlsIn(replies),
    keepPhrases: kind === "lives" ? ["10:30", "15:30", "20:30"] : [],
  }
}

export function steHeardChips(facts?: LeadFacts | null) {
  const chips: string[] = []
  if (facts?.experience === "beginner") chips.push("Começando")
  if (facts?.experience === "experienced") chips.push("Já joga")
  if (facts?.results === "losing") chips.push("No prejuízo")
  if (facts?.results === "winning") chips.push("No positivo")
  if (facts?.hasSuperbet === true) chips.push("Tem Superbet")
  if (facts?.hasSuperbet === false) chips.push("Sem conta")
  return chips
}

export type SteRuntime = {
  talking?: boolean
  welcome?: string[]
  course?: string[]
  superbet?: string[]
  rescue?: string[]
  offer?: string[]
  lives?: string[]
  remarketing?: string[]
  close?: string[]
  dieAfterRemarketing?: boolean
  remarketingHours?: number
}

export type SteResult = {
  lead: Lead
  replies: string[]
  reply: string | null
  beat: SteBeat
}

function splitNodeCopy(body?: string) {
  return (body ?? "")
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function nodesForLine(nodes: FlowNode[], line: SteLine) {
  return nodes
    .filter((node) => node.data.steLine === line)
    .sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y)
}

function copyForLine(nodes: FlowNode[], line: SteLine) {
  return nodesForLine(nodes, line).flatMap((node) => splitNodeCopy(node.data.body))
}

export function steRuntimeFromSnapshot(snapshot?: Pick<SalesSnapshot, "nodes"> | null): SteRuntime {
  const nodes = snapshot?.nodes ?? []
  const welcome = copyForLine(nodes, "welcome")
  const remarketing = copyForLine(nodes, "remarketing")
  const course = copyForLine(nodes, "course")
  const superbet = copyForLine(nodes, "superbet")
  const rescue = copyForLine(nodes, "rescue")
  const offer = copyForLine(nodes, "offer")
  const lives = copyForLine(nodes, "lives")
  const close = copyForLine(nodes, "close")
  const wait = nodes.find((node) => node.type === "wait" && node.data.steLine === "remarketing")
  const dieNode = nodes.find((node) => node.data.dieAfter !== undefined)
  const handoff = nodes.find((node) => node.type === "handoff")
  return {
    talking: handoff ? handoff.data.steTalk !== false : nodes.some((node) => node.data.steLine) || !nodes.length,
    welcome: welcome.length ? welcome : undefined,
    course: course.length ? course : undefined,
    superbet: superbet.length ? superbet : undefined,
    rescue: rescue.length ? rescue : undefined,
    offer: offer.length ? offer : undefined,
    lives: lives.length ? lives : undefined,
    remarketing: remarketing.length ? remarketing : undefined,
    close: close.length ? close : undefined,
    dieAfterRemarketing: dieNode ? dieNode.data.dieAfter !== false : true,
    remarketingHours:
      wait?.data.delayHours && Number.isFinite(wait.data.delayHours) && wait.data.delayHours > 0
        ? Math.min(8760, wait.data.delayHours)
        : undefined,
  }
}

export function steRuntimeFromSettings(settings?: Partial<Settings> | null): SteRuntime {
  const welcome = settings?.steWelcomeLines?.filter(Boolean) ?? []
  const remarketing = settings?.steRemarketingLines?.filter(Boolean) ?? []
  return {
    talking: settings?.steLinkedTelegram !== false,
    welcome: welcome.length ? welcome : undefined,
    remarketing: remarketing.length ? remarketing : undefined,
    dieAfterRemarketing: settings?.steDieAfterRemarketing !== false,
  }
}

export function steRuntimeFromFunnels(funnels?: SalesFunnel[], _settings?: Partial<Settings> | null, funnelId?: string) {
  const chosen = funnelId ? funnels?.find((item) => item.id === funnelId) : undefined
  const published = chosen?.production ?? publishedFunnel(funnels ?? [])?.production
  if (!published) return { talking: false }
  const fromFunnel = steRuntimeFromSnapshot(published)
  if (published && (fromFunnel.welcome || fromFunnel.remarketing || published.nodes.some((node) => node.data.steLine || node.type === "handoff"))) {
    return fromFunnel
  }
  return { talking: false }
}

export function isolateLead(lead: Lead): Lead {
  return {
    id: lead.id,
    botId: lead.botId,
    integrationId: lead.integrationId,
    flowVersionId: lead.flowVersionId,
    brainVersionId: lead.brainVersionId,
    testRunId: lead.testRunId,
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
    category: lead.category,
    groupIds: [...(lead.groupIds ?? [])],
    tags: [...(lead.tags ?? [])],
    anonymized: lead.anonymized,
    updatedAt: lead.updatedAt,
    createdAt: lead.createdAt,
  }
}

export function applyLeadFacts(lead: Lead, incoming: string) {
  const text = incoming.trim()
  if (!text) return
  const facts = { ...(lead.facts ?? {}) }
  facts.heard = text.slice(0, 140)
  if (/come[cç]ando|iniciante|primeira vez|nunca jog/i.test(text)) facts.experience = "beginner"
  if (/j[aá] jogo|experi[eê]n|veterano|h[aá] tempo|j[aá] opero/i.test(text)) facts.experience = "experienced"
  if (/perdend|queim|no preju|zerou|quebr|tilt/i.test(text)) facts.results = "losing"
  if (/ganhand|lucr|positivo|no verde/i.test(text)) facts.results = "winning"
  const phase = lead.stePhase ?? "entry"
  if (!denies(text) && SIGNED_UP.test(text)) facts.hasSuperbet = true
  if (!denies(text) && mentionsPrint(text) && phase !== "listen" && phase !== "entry") facts.hasSuperbet = true
  if (/n[aã]o tenho conta|ainda n[aã]o tenho|sem conta|n[aã]o mandei o print/i.test(text)) facts.hasSuperbet = false
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

function cleanLines(value?: string[]) {
  return value?.map((item) => item.trim()).filter(Boolean) ?? []
}

function resolveCopy(runtime?: SteRuntime) {
  const welcome = cleanLines(runtime?.welcome)
  const remarketing = cleanLines(runtime?.remarketing)
  const course = cleanLines(runtime?.course)
  const superbet = cleanLines(runtime?.superbet)
  const rescue = cleanLines(runtime?.rescue)
  const offer = cleanLines(runtime?.offer)
  const lives = cleanLines(runtime?.lives)
  const close = cleanLines(runtime?.close)
  return {
    welcome: welcome.length >= 3 ? welcome : welcome.length ? [...welcome, ...STE_WELCOME.slice(welcome.length)] : [...STE_WELCOME],
    remarketing: remarketing.length ? remarketing : [...STE_REMARKETING_BLOCK],
    course: course.length ? course : [...STE_COURSE_BLOCK],
    superbet: superbet.length ? superbet : [...STE_SUPERBET_BLOCK],
    rescue: rescue.length ? rescue : [STE_SUPERBET_RESCUE],
    offer: offer.length ? offer : [...STE_OFFER_BLOCK],
    lives: lives.length ? lives : [...STE_LIVE_BLOCK],
    close: close[0] || STE_CLOSE,
    dieAfterRemarketing: runtime?.dieAfterRemarketing !== false,
    remarketingMs: Math.max(1, runtime?.remarketingHours ?? 7) * 60 * 60_000,
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

function lastLeadTalk(lead: Lead) {
  const last = lead.messages?.at(-1)
  return last?.role === "lead" ? last.text : undefined
}

function lastSteText(lead: Lead) {
  for (let index = (lead.messages?.length ?? 0) - 1; index >= 0; index--) {
    const item = lead.messages?.[index]
    if (item?.role === "ste") return item.text
  }
}

/** Webhook: se o envio da Sté falhar, a fala do lead fica no CRM sem avançar a fase. */
export function rememberLeadTalk(lead: Lead, incoming?: string | null, now = Date.now()): Lead {
  const text = (incoming ?? "").trim()
  if (!text || lastLeadTalk(lead) === text) return lead
  const next = isolateLead(lead)
  push(next, "lead", text, now)
  return next
}

function pushAll(lead: Lead, texts: readonly string[], now = Date.now()) {
  for (const text of texts) push(lead, "ste", text, now)
}

function pack(lead: Lead, replies: string[], kind: SteBeatKind = "idle"): SteResult {
  return { lead, replies, reply: replies.at(-1) ?? null, beat: beatFor(kind, replies) }
}

function dropLastSte(lead: Lead, count: number) {
  if (count <= 0) return
  const messages = [...(lead.messages ?? [])]
  let left = count
  for (let index = messages.length - 1; index >= 0 && left > 0; index--) {
    if (messages[index]?.role === "ste") {
      messages.splice(index, 1)
      left--
    }
  }
  lead.messages = messages
}

function hasRawUrl(text: string) {
  return /https?:\/\//i.test(text.replace(/\[[^\]]+\]\(https?:[^)\s]+\)/g, ""))
}

export function listenLine(facts: LeadFacts | undefined, incoming: string, kind: SteBeatKind, scripted?: string) {
  const text = incoming.trim()
  if (kind === "course") {
    if (facts?.experience === "beginner" && facts.results === "losing") {
      return "Começar e já estar no prejuízo é o mais comum — sem método a banca some rápido."
    }
    if (facts?.experience === "experienced" && facts.results === "losing") {
      return "Quem já joga e tá queimando precisa de gestão, não de mais palpite."
    }
    if (facts?.results === "winning") {
      return "Bom ver resultado. Agora é proteger e repetir do jeito certo."
    }
    if (facts?.results === "losing") {
      return "Te ouvi: tá no prejuízo. Primeiro a gente alinha o método."
    }
    if (facts?.experience === "beginner") {
      return "Beleza, então a gente começa do zero, sem pressa e sem furada."
    }
    if (facts?.experience === "experienced") {
      return "Entendi, você já joga. Então a gente alinha o método em vez de começar do zero."
    }
    return text ? "Te entendi. Vou te passar a base pra você não operar no achismo." : null
  }
  if (kind === "superbet") {
    if (facts?.hasSuperbet === false) {
      return "Sem conta na casa certa a estratégia não roda. Eu opero e recomendo a Superbet."
    }
    if (facts?.hasSuperbet === true) {
      return "Conta feita. Pra operar junto comigo nas lives, o lugar é a Superbet."
    }
    return "Pra rodar as estratégias de verdade, você precisa estar na casa certa. Eu opero na Superbet."
  }
  if (kind === "confirm") {
    if (scripted === STE_SUPERBET_OK || heardSuperbetSignup(incoming)) return STE_SUPERBET_OK
    if (scripted === STE_SUPERBET_HOLD) return null
    if (scripted === STE_SUPERBET_HELP || scripted === STE_SUPERBET_STEP) {
      return "Se travar, me fala a etapa — CPF, selfie ou depósito — ou manda o print."
    }
    if (GREETING.test(incoming.trim())) {
      return "Oi. Me confirma se o cadastro na Superbet já saiu — se travar em alguma etapa, me fala que eu te ajudo."
    }
    return null
  }
  if (kind === "offer") {
    return "Se quiser subir de nível agora, o caminho é o App, o Grupo Premium ou o checkout direto."
  }
  if (kind === "lives") {
    return "Eu faço lives diárias pra gente operar junto e pegar as melhores velas. Anota os horários:"
  }
  if (kind === "redirect") {
    return "Bora ficar no Aviator — me conta se você já joga, se está começando agora e como têm sido seus resultados."
  }
  return null
}

export function guardSteVoice(scripted: readonly string[], voiced: readonly string[], beat: SteBeat) {
  if (!voiced.length || voiced.length > Math.max(4, scripted.length)) return false
  if (voiced.some((item) => item.length > 420 || hasRawUrl(item))) return false
  const allowed = new Set([...beat.requiredUrls, ...urlsIn(scripted)])
  if (urlsIn(voiced).some((url) => !allowed.has(url))) return false
  if (beat.requiredUrls.some((url) => !voiced.some((item) => item.includes(url)))) return false
  if (beat.keepPhrases.some((phrase) => !voiced.some((item) => item.includes(phrase)))) return false
  const joined = voiced.join("\n")
  const base = scripted.join("\n")
  if (INVENTED_CLAIM.test(joined) && !INVENTED_CLAIM.test(base)) return false
  if (beat.kind === "course" && [STE_SUPERBET, STE_CHECKOUT, STE_PREMIUM, STE_LANDING].some((url) => joined.includes(url))) {
    return false
  }
  if ((beat.kind === "superbet" || beat.kind === "confirm") && (joined.includes(STE_CHECKOUT) || joined.includes(STE_PREMIUM))) {
    return false
  }
  if (beat.kind === "redirect" && urlsIn(voiced).length) return false
  if (beat.kind === "close") return voiced.length === 1 && voiced[0] === scripted[0]
  return true
}

function withKeptLinks(opening: string, source: string) {
  if (urlsIn([opening]).length) return opening
  const links = source.match(/\[[^\]]+\]\(https?:[^)\s]+\)/g) ?? []
  return links.length ? `${opening} ${links.join(" ")}`.trim() : opening
}

export function applySteVoice(result: SteResult, incoming: string, now = Date.now()): SteResult {
  const beat = result.beat
  if (!beat.vary || result.lead.steBlocked || result.lead.steQuiet || !result.replies.length) return result
  const opening = listenLine(result.lead.facts, incoming, beat.kind, result.replies[0])
  if (!opening) return result
  const spoken = (result.lead.messages ?? []).filter((item) => item.role === "ste").map((item) => item.text)
  const older = spoken.slice(0, Math.max(0, spoken.length - result.replies.length))
  if (older.includes(opening)) return result
  const voiced = [withKeptLinks(opening, result.replies[0] ?? ""), ...result.replies.slice(1)]
  if (voiced[0] === result.replies[0]) return result
  if (!guardSteVoice(result.replies, voiced, beat)) return result
  const lead = cloneLead(result.lead)
  dropLastSte(lead, result.replies.length)
  pushAll(lead, voiced, now)
  return pack(lead, voiced, beat.kind)
}

export function replySteLived(lead: Lead, incoming?: string | null, now = Date.now(), runtime?: SteRuntime): SteResult {
  return applySteVoice(replySte(lead, incoming, now, runtime), incoming ?? "", now)
}

function voicePrompt(lead: Lead, incoming: string, scripted: readonly string[], beat: SteBeat) {
  const maxBlocks = Math.min(6, Math.max(2, scripted.length))
  return `Você é a Sté, Mãe do Aviator. Tom receptivo, firme, acolhedor. Odeia robô milagroso.

Você NÃO escolhe o próximo passo. O passo já está travado: ${beat.kind}.
Não avance de fase. Não ofereça outro produto.

Texto-base do quadro (mantenha a mesma intenção, a mesma pergunta e os mesmos links):
${scripted.map((line, index) => `${index + 1}. ${line}`).join("\n")}

O lead acabou de dizer: ${incoming.trim() || "(silêncio)"}
Fatos só deste lead: ${JSON.stringify(lead.facts ?? {})}

Reescreva em no máximo ${maxBlocks} blocos curtos separados por linha em branco.
- Primeiro bloco: mostre que ouviu o lead, sem copiar a frase dele.
- Links só neste formato [texto](url). Sem URL crua.
- URLs obrigatórios: ${beat.requiredUrls.join(" ") || "(nenhum)"}
- Frases que não podem mudar: ${beat.keepPhrases.join(", ") || "(nenhuma)"}
- Sem inventar banca, preço, garantia, porcentagem de acerto ou bônus que não esteja no texto-base.
- Português do Brasil.`
}

function hasSteMessage(lead: Lead) {
  return (lead.messages ?? []).some((item) => item.role === "ste")
}

function scheduleRemarketing(lead: Lead, now: number, remarketingMs = REMARKETING_MS) {
  if (lead.steBlocked || memHas(lead, MEM.converted)) {
    if (memHas(lead, MEM.remarketing) && !memHas(lead, MEM.superbet)) lead.waitUntil = undefined
    return
  }
  const due = new Date(lead.createdAt).getTime() + remarketingMs
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

export function safeHttpUrl(url: string): string | null {
  const next = url.trim()
  if (!/^https?:\/\//i.test(next)) return null
  try {
    const parsed = new URL(next)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null
    if (parsed.username || parsed.password) return null
    return parsed.href
  } catch {
    return null
  }
}

export function splitSteMarkup(text: string): SteMarkup[] {
  const nodes: SteMarkup[] = []
  const pattern = /\[([^\]]+)\]\((https?:[^)\s]+)\)/g
  let cursor = 0
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > cursor) nodes.push({ type: "text", text: text.slice(cursor, index) })
    const href = safeHttpUrl(match[2] ?? "")
    if (href) nodes.push({ type: "link", text: match[1] ?? "", url: href })
    else nodes.push({ type: "text", text: match[0] })
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
      const href = safeHttpUrl(part.url)
      if (!href) {
        return part.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      }
      const safe = href.replace(/&/g, "&amp;").replace(/"/g, "&quot;")
      const label = part.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      return `<a href="${safe}">${label}</a>`
    })
    .join("")
}

function setPhase(lead: Lead, phase: StePhase) {
  lead.stePhase = phase
}

function welcome(lead: Lead, now: number, lines: string[], remarketingMs: number) {
  setPhase(lead, "listen")
  pushAll(lead, lines, now)
  scheduleRemarketing(lead, now, remarketingMs)
  return pack(lead, [...lines], "welcome")
}

function course(lead: Lead, now: number, lines: string[], remarketingMs: number) {
  setPhase(lead, "diagnosis")
  pushAll(lead, lines, now)
  scheduleRemarketing(lead, now, remarketingMs)
  return pack(lead, [...lines], "course")
}

function superbet(lead: Lead, now: number, lines: string[]) {
  setPhase(lead, "solution")
  pushAll(lead, lines, now)
  scheduleSuperbet(lead, now)
  return pack(lead, [...lines], "superbet")
}

function offer(lead: Lead, now: number, lines: string[], remarketingMs: number) {
  setPhase(lead, "offer")
  cancelSuperbetWait(lead, now)
  pushAll(lead, lines, now)
  scheduleRemarketing(lead, now, remarketingMs)
  return pack(lead, [...lines], "offer")
}

function lives(lead: Lead, now: number, lines: string[]) {
  pushAll(lead, lines, now)
  return pack(lead, [...lines], "lives")
}

function close(lead: Lead, now: number, text: string) {
  lead.steBlocked = true
  setPhase(lead, "closed")
  lead.waitUntil = undefined
  push(lead, "ste", text, now)
  return pack(lead, [text], "close")
}

function isConfirmQuestion(text?: string) {
  return Boolean(text && /cadastro na Superbet já saiu|conseguiu fazer o cadastro/i.test(text))
}

function isHelpQuestion(text?: string) {
  return Boolean(text && (text === STE_SUPERBET_HELP || text === STE_SUPERBET_STEP || /CPF, selfie ou depósito|etapa que travou|se o cadastro travar/i.test(text)))
}

function signupHelp(incoming: string) {
  if (/cpf|documento|receita federal/i.test(incoming)) {
    return "No CPF, digita os 11 números sem ponto. Se a tela recusar, espera um minuto e tenta de novo — e me manda o print."
  }
  if (/selfie|foto do rosto|c[aâ]mera|biometria/i.test(incoming)) {
    return "Na selfie, o rosto inteiro, sem boné e com luz na frente. Se a câmera não abrir, fecha o site e entra de novo pelo link."
  }
  if (/dep[oó]sito|pix|b[oô]nus|bonus/i.test(incoming)) {
    return "O bônus de entrada entra num depósito novo, depois da conta criada. Se o Pix não aparecer, me manda o print dessa tela."
  }
  if (/n[aã]o abre|link trav|erro|travei|travou|emperr/i.test(incoming)) {
    return `Se o link travar, abre de novo por aqui: ${steLink("superbet")}`
  }
  return null
}

function pushFresh(lead: Lead, text: string, now: number) {
  if (!text || lastSteText(lead) === text) return false
  push(lead, "ste", text, now)
  return true
}

function finishSignup(lead: Lead, incoming: string, now: number): SteResult {
  lead.facts = { ...(lead.facts ?? {}), hasSuperbet: true }
  if (mentionsPrint(incoming)) lead.printAt = lead.printAt ?? nowIso(now)
  setPhase(lead, "offer")
  cancelSuperbetWait(lead, now)
  push(lead, "ste", STE_SUPERBET_OK, now)
  return pack(lead, [STE_SUPERBET_OK], "confirm")
}

function solutionReply(lead: Lead, incoming: string, now: number): SteResult {
  cancelSuperbetWait(lead, now)
  const asked = lastSteText(lead)
  const signed =
    heardSuperbetSignup(incoming) || (affirms(incoming) && !denies(incoming) && isConfirmQuestion(asked))
  if (signed) return finishSignup(lead, incoming, now)

  const specific = signupHelp(incoming)
  if (specific && pushFresh(lead, specific, now)) return pack(lead, [specific], "confirm")

  if (denies(incoming)) {
    if (pushFresh(lead, STE_SUPERBET_HOLD, now)) return pack(lead, [STE_SUPERBET_HOLD], "confirm")
    if (pushFresh(lead, STE_SUPERBET_HELP, now)) return pack(lead, [STE_SUPERBET_HELP], "confirm")
    return pack(lead, [], "confirm")
  }

  if (affirms(incoming) && isHelpQuestion(asked) && pushFresh(lead, STE_SUPERBET_STEP, now)) {
    return pack(lead, [STE_SUPERBET_STEP], "confirm")
  }

  const nudges = [STE_SUPERBET_CONFIRM, STE_SUPERBET_HELP, STE_SUPERBET_HOLD, STE_SUPERBET_STEP]
  const index = !asked
    ? -1
    : asked === STE_SUPERBET_STEP || /Me diz a etapa que travou/i.test(asked)
      ? 3
      : asked === STE_SUPERBET_HOLD || /Quando o cadastro sair, manda o print/i.test(asked)
        ? 2
        : isHelpQuestion(asked)
          ? 1
          : isConfirmQuestion(asked)
            ? 0
            : -1
  const next = index < 0 ? STE_SUPERBET_CONFIRM : nudges[index + 1]
  if (next && pushFresh(lead, next, now)) return pack(lead, [next], "confirm")
  return pack(lead, [], "confirm")
}

function offerReply(lead: Lead, incoming: string, now: number, copy: ReturnType<typeof resolveCopy>): SteResult {
  if (isOnlyGreeting(incoming) && pushFresh(lead, STE_OFFER_NEXT, now)) {
    return pack(lead, [STE_OFFER_NEXT], "offer")
  }
  if (/\b(obrigad[oa]|valeu|show|entendi|fechou|perfeito|beleza|blz)\b/i.test(incoming) && pushFresh(lead, STE_OFFER_ACK, now)) {
    return pack(lead, [STE_OFFER_ACK], "offer")
  }
  const pitched = (lead.messages ?? []).some((item) => item.role === "ste" && /Grupo Premium|checkout direto/i.test(item.text))
  if (!pitched) return offer(lead, now, copy.offer, copy.remarketingMs)
  if (pushFresh(lead, STE_OFFER_NEXT, now)) return pack(lead, [STE_OFFER_NEXT], "offer")
  if (pushFresh(lead, STE_OFFER_ACK, now)) return pack(lead, [STE_OFFER_ACK], "offer")
  return pack(lead, [], "offer")
}

function replyToIncoming(lead: Lead, incoming: string, now: number, copy: ReturnType<typeof resolveCopy>): SteResult {
  applyLeadFacts(lead, incoming)
  if (HOSTILE.test(incoming)) return close(lead, now, copy.close)
  if (CONVERTED.test(incoming)) memAdd(lead, MEM.converted)
  if (LIVE_HOURS.test(incoming)) return lives(lead, now, copy.lives)
  if (WANT_OFFER.test(incoming)) return offer(lead, now, copy.offer, copy.remarketingMs)
  if (OFFTOPIC.test(incoming)) {
    push(lead, "ste", REDIRECT, now)
    return pack(lead, [REDIRECT], "redirect")
  }
  if (memHas(lead, MEM.converted) && lead.stePhase !== "offer") {
    setPhase(lead, "offer")
    const thanks = "Que bom que você entrou. Se quiser o App ou o Grupo Premium, eu te mando o link."
    push(lead, "ste", thanks, now)
    return pack(lead, [thanks], "offer")
  }

  const phase = lead.stePhase ?? "entry"
  if (phase === "listen" || phase === "entry") {
    if (mentionsPrint(incoming) && lastSteText(lead) !== STE_PRINT_EARLY) {
      push(lead, "ste", STE_PRINT_EARLY, now)
      return pack(lead, [STE_PRINT_EARLY], "welcome")
    }
    if (isOnlyGreeting(incoming) && lastSteText(lead) !== STE_LISTEN_REASK) {
      push(lead, "ste", STE_LISTEN_REASK, now)
      return pack(lead, [STE_LISTEN_REASK], "welcome")
    }
    return course(lead, now, copy.course, copy.remarketingMs)
  }

  if (phase === "diagnosis") {
    if (mentionsPrint(incoming)) {
      lead.facts = { ...(lead.facts ?? {}), hasSuperbet: true }
      lead.printAt = lead.printAt ?? nowIso(now)
      return superbet(lead, now, copy.superbet)
    }
    if (denies(incoming) || /sem conta|n[aã]o tenho conta/i.test(incoming)) {
      lead.facts = { ...(lead.facts ?? {}), hasSuperbet: false }
    } else if (SIGNED_UP.test(incoming) || affirms(incoming)) {
      lead.facts = { ...(lead.facts ?? {}), hasSuperbet: true }
    }
    return superbet(lead, now, copy.superbet)
  }

  if (phase === "solution") return solutionReply(lead, incoming, now)

  return offerReply(lead, incoming, now, copy)
}

export function replySte(lead: Lead, incoming?: string | null, now = Date.now(), runtime?: SteRuntime): SteResult {
  const next = cloneLead(lead)
  if (next.steBlocked || next.steQuiet || next.stePhase === "closed") return pack(next, [])

  const text = (incoming ?? "").trim()
  if (text && lastLeadTalk(next) !== text) push(next, "lead", text, now)

  const copy = resolveCopy(runtime)
  if (!text) {
    if (!hasSteMessage(next)) return welcome(next, now, copy.welcome, copy.remarketingMs)
    return pack(next, [])
  }

  return replyToIncoming(next, text, now, copy)
}

export function replySteTick(lead: Lead, now = Date.now(), runtime?: SteRuntime): SteResult {
  const next = cloneLead(lead)
  if (next.steBlocked || next.steQuiet || next.stePhase === "closed") {
    next.waitUntil = undefined
    return pack(next, [])
  }

  const due = next.waitUntil ? new Date(next.waitUntil).getTime() : 0
  if (!due || due > now) return pack(next, [])
  const copy = resolveCopy(runtime)

  if (memHas(next, MEM.superbet)) {
    memDel(next, MEM.superbet)
    memAdd(next, MEM.rescued)
    setPhase(next, "offer")
    pushAll(next, copy.rescue, now)
    scheduleRemarketing(next, now, copy.remarketingMs)
    return pack(next, [...copy.rescue], "rescue")
  }

  if (memHas(next, MEM.remarketing) && !memHas(next, MEM.converted)) {
    memDel(next, MEM.remarketing)
    next.waitUntil = undefined
    pushAll(next, copy.remarketing, now)
    if (copy.dieAfterRemarketing) {
      next.steQuiet = true
      setPhase(next, "closed")
    }
    return pack(next, [...copy.remarketing], "remarketing")
  }

  next.waitUntil = undefined
  return pack(next, [])
}


function splitBlocks(raw: string, max = 4) {
  return raw
    .split(/\n{2,}/)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, max)
}

/** GET unread + funil do lead em falta: o painel não fala o publicado leftover. Telegram real continua trancado. */
export function canTickSteLocally(
  lead: Lead,
  gate?: { funnelsUnread?: boolean; funnels?: Array<{ id: string }> }
) {
  if (isOperatorLockedLead(lead)) return false
  return !leadFunnelUnread(gate?.funnelsUnread === true, lead.funnelId, gate?.funnels ?? [])
}

/** Simular no painel só para leads sem chat real — senão o CRM e o Telegram dessincronizam. */
export function canSimulateSte(
  lead: Lead,
  gate?: { funnelsUnread?: boolean; funnels?: Array<{ id: string }> }
) {
  return canTickSteLocally(lead, gate) && !lead.steBlocked && !lead.steQuiet
}

export function steWaitDelayMs(waitUntil: string | undefined, now = Date.now()) {
  if (!waitUntil) return null
  const due = new Date(waitUntil).getTime() - now
  if (!Number.isFinite(due) || due > 86_400_000) return null
  return Math.max(50, due + 50)
}

export function advanceSteIfDue(lead: Lead, now = Date.now(), runtime?: SteRuntime): SteResult {
  const due = lead.waitUntil ? new Date(lead.waitUntil).getTime() : 0
  if (!due || due > now || !isSteWait(lead)) return pack(lead, [])
  return replySteTick(lead, now, runtime)
}

export async function replySteSmart(
  lead: Lead,
  incoming: string | null | undefined,
  opts?: {
    apiKey?: string
    openCodeKey?: string
    openRouterKey?: string
    model?: string
    fallbackModel?: string
    runtime?: SteRuntime
  }
): Promise<SteResult> {
  const now = Date.now()
  const scripted = replySte(isolateLead(lead), incoming, now, opts?.runtime)
  if (!scripted.beat.vary || scripted.lead.steBlocked || scripted.lead.steQuiet) return scripted

  const attempts = steLlmAttempts({
    primary: opts?.model,
    fallback: opts?.fallbackModel,
    opencodeKey: opts?.openCodeKey,
    openrouterKey: opts?.openRouterKey,
    apiKey: opts?.apiKey,
  })
  if (attempts.length) {
    const next = cloneLead(scripted.lead)
    dropLastSte(next, scripted.replies.length)
    const history = next.messages.slice(-14).map((item) => ({
      role: item.role === "ste" ? "assistant" : "user",
      content: item.text,
    }))
    const messages = [
      { role: "system", content: voicePrompt(next, incoming ?? "", scripted.replies, scripted.beat) },
      ...history,
    ]
    const maxBlocks = Math.min(6, Math.max(2, scripted.replies.length))
    try {
      for (const attempt of attempts) {
        const blocks = await completeSte(
          `${attempt.baseUrl.replace(/\/$/, "")}/chat/completions`,
          attempt.apiKey,
          attempt.model,
          messages,
          maxBlocks,
          attempt.provider,
          next.id
        )
        if (!blocks.length || !guardSteVoice(scripted.replies, blocks, scripted.beat)) continue
        pushAll(next, blocks, now)
        return pack(next, blocks, scripted.beat.kind)
      }
    } catch {
      /* cai na voz do quadro */
    }
  }

  return applySteVoice(scripted, incoming ?? "", now)
}

function choiceText(data: {
  choices?: Array<{ message?: { content?: string | Array<{ text?: string; content?: string }> } }>
}) {
  const content = data.choices?.[0]?.message?.content
  if (typeof content === "string") return content
  if (Array.isArray(content)) {
    return content.map((part) => (typeof part === "string" ? part : part.text || part.content || "")).join("\n")
  }
  return ""
}

async function completeSte(
  endpoint: string,
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  maxBlocks = 4,
  provider: SteLlmProvider = "openrouter",
  session?: string
) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: llmHeaders(apiKey, provider, session),
    body: JSON.stringify({
      model,
      temperature: 0.75,
      top_p: 0.9,
      max_tokens: provider === "opencode" ? 768 : 512,
      messages,
    }),
  })
  if (!res.ok) return []
  return splitBlocks(choiceText((await res.json()) as Parameters<typeof choiceText>[0]), maxBlocks)
}
