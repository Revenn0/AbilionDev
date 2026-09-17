import type { JourneyKind, JourneyNodeData } from "@/lib/types"

export type JourneyCatalogItem = {
  id: string
  kind: JourneyKind
  label: string
  hint: string
}

export const JOURNEY_CATALOG: JourneyCatalogItem[] = [
  { id: "trigger", kind: "trigger", label: "Quando...", hint: "Gatilhos dentro do bloco" },
  { id: "message", kind: "message", label: "Mensagem", hint: "Texto que o bot envia" },
  { id: "ask", kind: "ask", label: "Pergunta", hint: "Botões ou resposta livre" },
  { id: "wait", kind: "wait", label: "Espera", hint: "Pausa antes do próximo passo" },
  { id: "condition", kind: "condition", label: "Condição", hint: "Se / senão" },
  { id: "action", kind: "action", label: "Ação", hint: "Tag, disparo, handoff" },
  { id: "whatsapp", kind: "whatsapp", label: "WhatsApp", hint: "Mensagem da operação" },
  { id: "telegram", kind: "telegram", label: "Telegram", hint: "Mensagem no Telegram" },
]

export function defaultJourneyData(kind: JourneyKind): JourneyNodeData {
  if (kind === "trigger") return { label: "Quando..." }
  if (kind === "message") return { label: "Mensagem", template: "Olá {{primeiro_nome}}! Como posso ajudar?" }
  if (kind === "ask") return { label: "Pergunta", template: "Escolhe uma opção:", buttons: "Sim\nNão" }
  if (kind === "wait") return { label: "Espera", delayValue: 3, delayUnit: "seconds" }
  if (kind === "condition") return { label: "Condição", conditionField: "reply", conditionOp: "contains" }
  if (kind === "action") return { label: "Ação" }
  if (kind === "whatsapp") return { label: "WhatsApp", template: "Oi {{primeiro_nome}}, o próximo passo ainda está aberto." }
  return { label: "Telegram", template: "{{primeiro_nome}}, a oferta saiu na comunidade." }
}
