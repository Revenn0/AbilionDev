import { uid } from "./format"
import type { ChatMessage, Lead } from "./types"

export const STE_LANDING = "https://app.mundoaviator.com.br/"

export const STE_SYSTEM_PROMPT = `# IDENTIDADE E PAPEL
Você é a Sté, conhecida como a "Mãe do Aviator". Você é especialista em iGaming, analista de mercado de apostas e criadora de uma ferramenta de alta performance para apostadores. Seu tom de voz é direto, firme, realista, mas humano, empático e acolhedor quando o lead demonstra frustração. Você fala de igual para igual com o apostador, com uma postura profissional de quem entende o jogo de verdade. Você odeia "promessas de robô milagroso" e foca em método, lógica e gestão.

Canal: Telegram. Fala como mensagem curta de Telegram, não como e-mail.

# OBJETIVO
1. Iniciar a conversa pessoalmente de forma natural e humanizada.
2. Ouvir o lead, entender sua dor, acalmar seu medo, frustração ou raiva por estar perdendo dinheiro.
3. Somente após compreender o cenário dele, apresentar o app como a solução profissional definitiva (baseada em dados, não em achismo).
4. Explicar as funcionalidades e conduzir para a Landing Page utilizando a ancoragem de preços (destacando o plano semestral).

# REGRAS DE OURO (RITMO HUMANO - RIGOROSO)
- NUNCA envie blocos de texto gigantescos ou várias mensagens de uma só vez.
- Mande APENAS UMA frase curta por vez e ESPERE o cliente responder.
- NUNCA empurre o produto logo de cara. Deixe o lead falar, valide a dor e só fale do app ou dos planos após entender o drama dele.

# ETAPA 1: ABORDAGEM
- "Fala, tudo joia? Me diz uma coisa: você costuma fechar o mês no lucro no Aviator ou tá naquele ciclo de ganhar hoje e devolver tudo amanhã?"
- "Oi, tudo bom? Aqui é a Sté. Selecionei algumas pessoas para chamar hoje e trocar uma ideia. Me diz: como estão sendo seus resultados com o Aviator?"

# ETAPA 2: ACOLHIMENTO
Cegueira operacional, ciclo do otário, vício em palpite, caos financeiro, zero mágica.

# ETAPA 3: SOLUÇÃO
Cockpit dark/premium, velas roxas e rosas, disciplina de meta, sinais, catalogador, validador de padrões, gestão de banca blindada.

# ETAPA 4: PREÇOS
1. Mensal: R$ 47/mês.
2. Semestral (recomendado): 12x de R$ 24,80 ou R$ 247 à vista.
Link: ${STE_LANDING}

# GUARDRAILS
1. Off-topic: redirecione para Aviator / app.
2. Ofensa: uma desculpa neutra e NUNCA MAIS responder.`

export const STE_CLOSE =
  "Peço desculpas se te causei qualquer incômodo. Vou encerrar nosso atendimento por aqui para não te ocupar mais. Muito sucesso na sua jornada!"

const OPENERS = [
  "Fala, tudo joia? Me diz uma coisa: você costuma fechar o mês no lucro no Aviator ou tá naquele ciclo de ganhar hoje e devolver tudo amanhã?",
  "Oi, tudo bom? Aqui é a Sté. Selecionei algumas pessoas para chamar hoje e trocar uma ideia. Me diz: como estão sendo seus resultados com o Aviator?",
]

const HOSTILE =
  /(vai se f|vai tomar|\bvsf\b|\bfdp\b|filho da|sua m[aã]e|\bidiota\b|\bimbecil\b|lixo humano|te foder|cuz[aã]o|arrombado|otári[oa] de merda|cala a boca)/i

const OFFTOPIC =
  /\b(eleição|eleicao|bolsonaro|lula|receita de|bolo|clima|previsão do tempo|futebol|flamengo|política|politica)\b/i

const LISTEN =
  "Me fala sem filtro: no mês você fecha no lucro ou entra naquele vai-e-volta de ganhar e devolver?"

const REDIRECT =
  "Bora ficar no Aviator — me conta como estão seus resultados, se tá lucrando ou devolvendo pra casa."

function nowIso() {
  return new Date().toISOString()
}

function cloneLead(lead: Lead): Lead {
  return {
    ...lead,
    messages: [...(lead.messages ?? [])],
    stePhase: lead.stePhase ?? "entry",
  }
}

function push(lead: Lead, role: ChatMessage["role"], text: string) {
  const at = nowIso()
  const message: ChatMessage = { id: uid(), at, role, text }
  lead.messages = [...(lead.messages ?? []), message]
  lead.lastMessage = text
  lead.updatedAt = at
  if (role === "ste") lead.stage = lead.stePhase === "offer" ? "offer" : "attendance"
}

function oneLine(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 280)
}

function hasSteMessage(lead: Lead) {
  return (lead.messages ?? []).some((item) => item.role === "ste")
}

function openConversation(lead: Lead): { lead: Lead; reply: string } {
  const opener = OPENERS[Math.floor(Math.random() * OPENERS.length)] ?? OPENERS[0]!
  lead.stePhase = "listen"
  push(lead, "ste", opener)
  return { lead, reply: opener }
}

function listenLine(lead: Lead, incoming: string): { lead: Lead; reply: string } {
  const reply = oneLine(OFFTOPIC.test(incoming) ? REDIRECT : LISTEN)
  lead.stePhase = "listen"
  push(lead, "ste", reply)
  return { lead, reply }
}

/** Hostility, opener e um fallback curto. Sem walk de preço — isso fica no prompt da LLM. */
function gateSte(lead: Lead, incoming?: string | null): { lead: Lead; reply: string | null; done: boolean } {
  const next = cloneLead(lead)

  if (next.steBlocked || next.stePhase === "closed") {
    return { lead: next, reply: null, done: true }
  }

  const text = (incoming ?? "").trim()
  if (text) {
    push(next, "lead", text)
    if (HOSTILE.test(text)) {
      next.steBlocked = true
      next.stePhase = "closed"
      push(next, "ste", STE_CLOSE)
      return { lead: next, reply: STE_CLOSE, done: true }
    }
  }

  if (!text) {
    if (!hasSteMessage(next)) return { ...openConversation(next), done: true }
    return { lead: next, reply: null, done: true }
  }

  return { lead: next, reply: null, done: false }
}

export function replySte(lead: Lead, incoming?: string | null): { lead: Lead; reply: string | null } {
  const gated = gateSte(lead, incoming)
  if (gated.done) return { lead: gated.lead, reply: gated.reply }
  return listenLine(gated.lead, (incoming ?? "").trim())
}

export const STE_LLM_MODEL = "glm-5.3-flash"
export const STE_LLM_BASE_URL = "https://api.z.ai/api/coding/paas/v4"

export async function replySteSmart(
  lead: Lead,
  incoming: string | null | undefined,
  opts?: { apiKey?: string; baseUrl?: string; model?: string }
): Promise<{ lead: Lead; reply: string | null }> {
  const gated = gateSte(lead, incoming)
  if (gated.done) return { lead: gated.lead, reply: gated.reply }

  const next = gated.lead
  const text = (incoming ?? "").trim()
  const key = opts?.apiKey
  if (!key) return listenLine(next, text)

  try {
    const history = next.messages.slice(-12).map((item) => ({
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
          { role: "system", content: `${STE_SYSTEM_PROMPT}\n\nResponda só UMA frase curta, em português, como Telegram.` },
          ...history,
        ],
      }),
    })
    if (!res.ok) return listenLine(next, text)
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const raw = oneLine(data.choices?.[0]?.message?.content ?? "")
    if (!raw) return listenLine(next, text)
    next.stePhase = raw.includes(STE_LANDING) ? "offer" : "listen"
    push(next, "ste", raw)
    return { lead: next, reply: raw }
  } catch {
    return listenLine(next, text)
  }
}
