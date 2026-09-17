import { uid } from "./format"
import type { ChatMessage, Lead, StePhase } from "./types"

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
  /\b(vai se f|vai tomar|vsf|fdp|filho da|sua mãe|sua mae|idiota|imbecil|lixo humano|te foder|cuz[aã]o|arrombado|otári[oa] de merda|cala a boca)\b/i

const PAIN =
  /\b(perco|perdendo|perdi|loss|tilt|devolver|furado|quebrado|viciad|frustrad|raiva|medo|sozinho|não ganho|nao ganho|no vermelho)\b/i

const READY =
  /\b(quanto|preço|preco|valor|plano|link|quero|vamos|fech|assinar|cartão|cartao|pagar)\b/i

const HELP = /\b(ajuda|método|metodo|app|ferramenta|profissional|preciso|como funciona|sinais)\b/i

const OFFTOPIC =
  /\b(eleição|eleicao|bolsonaro|lula|receita de|bolo|clima|previsão do tempo|futebol|flamengo|política|politica)\b/i

function nowIso() {
  return new Date().toISOString()
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

export function replySte(lead: Lead, incoming?: string | null): { lead: Lead; reply: string | null } {
  const next: Lead = {
    ...lead,
    messages: [...(lead.messages ?? [])],
    stePhase: lead.stePhase ?? "entry",
  }

  if (next.steBlocked || next.stePhase === "closed") {
    return { lead: next, reply: null }
  }

  const text = (incoming ?? "").trim()
  if (text) {
    push(next, "lead", text)
    if (HOSTILE.test(text)) {
      next.steBlocked = true
      next.stePhase = "closed"
      push(next, "ste", STE_CLOSE)
      return { lead: next, reply: STE_CLOSE }
    }
  }

  if (!text && !(next.messages ?? []).some((item) => item.role === "ste")) {
    const opener = OPENERS[Math.floor(Math.random() * OPENERS.length)] ?? OPENERS[0]!
    next.stePhase = "listen"
    push(next, "ste", opener)
    return { lead: next, reply: opener }
  }

  if (!text) return { lead: next, reply: null }

  let reply: string
  let phase: StePhase = next.stePhase ?? "listen"

  if (OFFTOPIC.test(text)) {
    reply = "Bora ficar no Aviator — me conta como estão seus resultados, se tá lucrando ou devolvendo pra casa."
  } else if (READY.test(text) && (phase === "solution" || phase === "offer" || phase === "diagnosis")) {
    phase = "offer"
    reply = next.messages.some((item) => item.text.includes(STE_LANDING))
      ? `Semestral é o que eu recomendo: 12x de R$ 24,80 ou R$ 247 à vista. Mensal fica R$ 47. Olha com calma: ${STE_LANDING}`
      : `Vou te mandar o link oficial com os dois planos pra você escolher. Dá uma olhada com calma: ${STE_LANDING}`
  } else if (PAIN.test(text) && (phase === "listen" || phase === "entry" || phase === "diagnosis")) {
    phase = "diagnosis"
    reply = next.messages.filter((item) => item.role === "ste" && item.text.includes("ciclo")).length
      ? "Operar no achismo e tentar recuperar no tilt é o ciclo que come o lucro do dia."
      : "Entendo. Ganhar cedo e devolver tudo no mesmo dia é o ciclo que mais quebra apostador."
  } else if (HELP.test(text) || phase === "diagnosis") {
    phase = "solution"
    reply = "Quando você cansar de palpite, o app te dá catalogador em tempo real e gestão de banca — método, não robô milagroso."
  } else if (phase === "solution" || phase === "offer") {
    phase = "offer"
    reply = `Mensal R$ 47. Semestral, o que eu indico, 12x de R$ 24,80 ou R$ 247 à vista: ${STE_LANDING}`
  } else {
    phase = "listen"
    reply = "Me fala sem filtro: no mês você fecha no lucro ou entra naquele vai-e-volta de ganhar e devolver?"
  }

  reply = oneLine(reply)
  next.stePhase = phase
  push(next, "ste", reply)
  return { lead: next, reply }
}

export async function replySteSmart(
  lead: Lead,
  incoming: string | null | undefined,
  opts?: { apiKey?: string; baseUrl?: string }
): Promise<{ lead: Lead; reply: string | null }> {
  const fallback = replySte(lead, incoming)
  const key = opts?.apiKey
  if (!key || fallback.lead.steBlocked || fallback.reply === STE_CLOSE) return fallback
  if (!incoming?.trim() && fallback.reply) return fallback

  try {
    const history = fallback.lead.messages.slice(-12).map((item) => ({
      role: item.role === "ste" ? "assistant" : "user",
      content: item.text,
    }))
    const res = await fetch(`${(opts?.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.6,
        max_tokens: 120,
        messages: [
          { role: "system", content: `${STE_SYSTEM_PROMPT}\n\nResponda só UMA frase curta, em português, como Telegram.` },
          ...history,
        ],
      }),
    })
    if (!res.ok) return fallback
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const raw = oneLine(data.choices?.[0]?.message?.content ?? "")
    if (!raw) return fallback
    const lead = fallback.lead
    const last = lead.messages[lead.messages.length - 1]
    if (last?.role === "ste") {
      last.text = raw
      lead.lastMessage = raw
    }
    return { lead, reply: raw }
  } catch {
    return fallback
  }
}
