import { uid } from "@/lib/format"
import type { Lead, LeadChannel, LeadOrigin, SalesFunnel } from "@/lib/types"
import { campaignFor } from "@/lib/labels"

export function emptySalesFunnel(name = "Operação"): SalesFunnel {
  const ad = uid()
  const land = uid()
  const split = uid()
  const group = uid()
  const ste = uid()
  const wait = uid()
  const offer = uid()
  return {
    id: uid(),
    name,
    mode: "sales",
    status: "draft",
    updatedAt: new Date().toISOString(),
    nodes: [
      {
        id: ad,
        type: "traffic",
        position: { x: 40, y: 80 },
        data: { title: "Anúncio", tag: "TRÁFEGO", channel: "meta", url: "" },
      },
      {
        id: land,
        type: "sales_page",
        position: { x: 380, y: 80 },
        data: { title: "Landing · mini curso Stefany", url: "", cta: "Quero o mini curso" },
      },
      {
        id: split,
        type: "split",
        position: { x: 760, y: 40 },
        data: {
          title: "Campanha — não misturar",
          splits: [
            { id: "a", label: "WhatsApp · grupo", percent: 50 },
            { id: "b", label: "Telegram · convite", percent: 50 },
          ],
        },
      },
      {
        id: group,
        type: "telegram",
        position: { x: 1160, y: 40 },
        data: { title: "Grupo + boas-vindas", body: "Join cria lead da campanha. /start segue o mapa.", cta: "Entrar" },
      },
      {
        id: ste,
        type: "whatsapp",
        position: { x: 1160, y: 280 },
        data: {
          title: "Sté · atendimento 1:1",
          body: "Boas-vindas e material. Se mandar print do cadastro, avisar a Ester — o bot não inventa banca.",
          cta: "Falar com a Sté",
        },
      },
      {
        id: wait,
        type: "delay",
        position: { x: 1560, y: 160 },
        data: { title: "Espera 3–4 dias", delayHours: 84, delayWindow: "depois do print" },
      },
      {
        id: offer,
        type: "sales_page",
        position: { x: 1960, y: 160 },
        data: { title: "Bot oferece o produto", url: "", cta: "Ver oferta" },
      },
    ],
    edges: [
      { id: uid(), source: ad, target: land },
      { id: uid(), source: land, target: split },
      { id: uid(), source: split, target: group, sourceHandle: "b" },
      { id: uid(), source: split, target: ste, sourceHandle: "a" },
      { id: uid(), source: group, target: wait },
      { id: uid(), source: ste, target: wait },
      { id: uid(), source: wait, target: offer },
    ],
  }
}

export function leadFromCapture(input: {
  name: string
  contact: string
  channel: LeadChannel
  origin: LeadOrigin
}): Lead {
  const now = new Date().toISOString()
  const talking = input.origin === "private" || input.origin === "group_join" || input.origin === "closing"
  return {
    id: uid(),
    name: input.name.trim(),
    contact: input.contact.trim(),
    channel: input.channel,
    campaign: campaignFor(input.channel),
    origin: input.origin,
    temperature: "novo",
    stage: input.origin === "popup" ? "capture" : input.origin === "group_join" ? "group" : "welcome",
    memory: "",
    lastMessage: talking
      ? input.origin === "group_join"
        ? "Entrou no grupo. Lead da campanha."
        : "/start — segue o mapa da campanha."
      : undefined,
    createdAt: now,
    updatedAt: now,
  }
}
