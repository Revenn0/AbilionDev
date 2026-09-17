import { uid } from "@/lib/format"
import type { Journey, SalesFunnel } from "@/lib/types"

export function emptySalesFunnel(name = "Novo funil"): SalesFunnel {
  const trafficId = uid()
  const splitId = uid()
  const pageId = uid()
  return {
    id: uid(),
    name,
    mode: "sales",
    status: "draft",
    updatedAt: new Date().toISOString(),
    nodes: [
      {
        id: trafficId,
        type: "traffic",
        position: { x: 40, y: 80 },
        data: { title: "Campanha — Meta", tag: "META ADS", channel: "meta", url: "" },
      },
      {
        id: splitId,
        type: "split",
        position: { x: 420, y: 40 },
        data: {
          title: "Divisor de tráfego",
          splits: [
            { id: "a", label: "Página de vendas — V1", percent: 50 },
            { id: "b", label: "Página de vendas — V2", percent: 50 },
          ],
        },
      },
      {
        id: pageId,
        type: "sales_page",
        position: { x: 860, y: 80 },
        data: { title: "Página de vendas — V1", url: "https://abilion.com/v1", cta: "Ver oferta" },
      },
    ],
    edges: [
      { id: uid(), source: trafficId, target: splitId },
      { id: uid(), source: splitId, target: pageId, sourceHandle: "a" },
    ],
  }
}

export function conversationJourney(name = "Novo fluxo do bot"): Journey {
  const triggerId = uid()
  const messageId = uid()
  const askId = uid()
  return {
    id: uid(),
    name,
    description: "Gatilho, mensagem e pergunta.",
    status: "draft",
    updatedAt: new Date().toISOString(),
    nodes: [
      {
        id: triggerId,
        type: "trigger",
        position: { x: 40, y: 120 },
        data: { label: "Quando..." },
      },
      {
        id: messageId,
        type: "message",
        position: { x: 380, y: 80 },
        data: { label: "Mensagem", template: "Olá {{primeiro_nome}}! Como posso ajudar?" },
      },
      {
        id: askId,
        type: "ask",
        position: { x: 720, y: 80 },
        data: { label: "Pergunta", template: "Escolhe uma opção:", buttons: "Sim\nNão" },
      },
    ],
    edges: [
      { id: uid(), source: triggerId, target: messageId },
      { id: uid(), source: messageId, target: askId },
    ],
  }
}
