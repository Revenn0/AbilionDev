import type { SteBeatKind } from "./ste"

export type SteVoiceClipId =
  | "welcome"
  | "course"
  | "superbet"
  | "rescue"
  | "offer"
  | "lives"
  | "remarketing"
  | "close"

export type SteVoiceClip = {
  id: SteVoiceClipId
  beat: SteBeatKind
  label: string
  script: string
}

export const STE_VOICE_CLIPS: SteVoiceClip[] = [
  {
    id: "welcome",
    beat: "welcome",
    label: "Boas-vindas",
    script:
      "Opa, seja muito bem-vindo. Aqui é a Sté, conhecida como a Mãe do Aviator. Criei esse espaço para guiar quem quer operar de forma profissional, sem cair em furada ou achismo. Para eu te conhecer melhor: você já joga Aviator? Tem experiência ou está começando agora? Como têm sido seus resultados?",
  },
  {
    id: "course",
    beat: "course",
    label: "Minicurso",
    script:
      "Te entendo perfeitamente. Para quem está começando ou quer alinhar a estratégia, eu preparei um minicurso completo do zero. Ele ensina a se cadastrar na plataforma, jogar com segurança, acompanhar minhas lives e fazer a gestão da própria banca. O link do material fica aqui no chat. Dá uma olhada para pegar a base. Me diz uma coisa: você já tem conta na plataforma oficial onde eu opero e faço minhas transmissões?",
  },
  {
    id: "superbet",
    beat: "superbet",
    label: "Superbet",
    script:
      "Para rodar as nossas estratégias de verdade, operar junto comigo nas lives e ter resultado, você precisa estar na casa certa. Eu opero e recomendo a Superbet. Lá tem gráfico exclusivo do Aviator, cashback diário, torneios semanais, alavancagem de banca, e é onde rolam as lives. O link para criar a conta com bônus está aqui no chat.",
  },
  {
    id: "rescue",
    beat: "rescue",
    label: "Resgate Superbet",
    script:
      "E aí, conseguiu fazer o cadastro na plataforma? Porque essa semana a gente conseguiu uma promoção para novos jogadores. Se você fizer o cadastro e qualquer tipo de depósito, a gente te dá mais uma banca para jogar. Me confirma se você conseguiu, se você é cliente novo, que eu te dou esse bônus de entrada para jogar com a gente na próxima live.",
  },
  {
    id: "offer",
    beat: "offer",
    label: "App e Premium",
    script:
      "O App é a ferramenta própria: catalogador em tempo real, validador de padrões e gestão de banca blindada. Além do app, nós temos o Grupo Premium de Sinais. É uma lista analisada por mim, com cinco oportunidades por dia, das oito da manhã até uma e meia da manhã, incluindo os sinais de quatro vezes. Os links do app, do grupo e do checkout estão aqui no chat.",
  },
  {
    id: "lives",
    beat: "lives",
    label: "Horário das lives",
    script:
      "Eu faço lives diárias para a gente operar junto e pegar as melhores velas. Anota os horários: dez e meia da manhã, três e meia da tarde, e oito e meia da noite. Sempre aviso no canal principal momentos antes de entrar ao vivo. Fica de olho.",
  },
  {
    id: "remarketing",
    beat: "remarketing",
    label: "Remarketing 7h",
    script:
      "E aí, como têm sido os resultados desde que a gente se falou? Você conseguiu acompanhar o material? Operar sozinho é o que mais queima banca. O nosso produto é o Grupo Premium de Sinais: cinco oportunidades por dia, das oito até uma e meia, incluindo os de quatro vezes. Os links do minicurso, do grupo e do checkout estão aqui no chat.",
  },
  {
    id: "close",
    beat: "close",
    label: "Encerramento",
    script:
      "Peço desculpas se te causei qualquer incômodo. Vou encerrar nosso atendimento por aqui para não te ocupar mais. Muito sucesso na sua jornada.",
  },
]

export function voiceClipFor(beat: SteBeatKind): SteVoiceClip | null {
  return STE_VOICE_CLIPS.find((item) => item.beat === beat) ?? null
}

export function clipHash(script: string, voiceId: string) {
  const input = `${voiceId.trim()}\n${script}`
  let hash = 2166136261
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16)
}

export function linksFromReplies(replies: readonly string[]) {
  const found: Array<{ label: string; url: string }> = []
  const pattern = /\[([^\]]+)\]\((https?:[^)\s]+)\)/g
  for (const text of replies) {
    for (const match of text.matchAll(pattern)) {
      const url = match[2] ?? ""
      if (!url || found.some((item) => item.url === url)) continue
      found.push({ label: match[1] ?? "abrir", url })
    }
  }
  return found
}

export function linkFollowUp(replies: readonly string[]) {
  const links = linksFromReplies(replies)
  if (!links.length) return ""
  return links.map((item) => `[${item.label}](${item.url})`).join("\n")
}

export function spokenHasUrl(script: string) {
  return /https?:\/\//i.test(script)
}
