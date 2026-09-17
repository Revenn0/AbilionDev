import { uid } from "@/lib/format"
import { campaignFor } from "@/lib/labels"
import { applyEvent, eventFromOrigin, publishedSnapshot } from "@/lib/runtime"
import { replySte } from "@/lib/ste"
import { BANCA_FIXED, type Lead, type LeadChannel, type LeadOrigin, type SalesFunnel, type SalesSnapshot } from "@/lib/types"

export function emptySalesFunnel(name = "Operação"): SalesFunnel {
  const ad = uid()
  const land = uid()
  const split = uid()
  const entryPopup = uid()
  const entryJoin = uid()
  const entryStart = uid()
  const welcome = uid()
  const ste = uid()
  const cond = uid()
  const ester = uid()
  const heat = uid()
  const wait = uid()
  const offer = uid()
  const now = new Date().toISOString()

  const nodes: SalesFunnel["nodes"] = [
    {
      id: ad,
      type: "traffic",
      position: { x: 40, y: 80 },
      data: { title: "Anúncio", tag: "TRÁFEGO", channel: "meta", url: "" },
    },
    {
      id: land,
      type: "landing",
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
      id: entryPopup,
      type: "entry",
      position: { x: 1160, y: 0 },
      data: { title: "Entrada · popup", entryTrigger: "popup" },
    },
    {
      id: entryJoin,
      type: "entry",
      position: { x: 1160, y: 180 },
      data: { title: "Entrada · join", entryTrigger: "group_join", campaignLock: "telegram" },
    },
    {
      id: entryStart,
      type: "entry",
      position: { x: 1160, y: 360 },
      data: { title: "Entrada · /start", entryTrigger: "start" },
    },
    {
      id: welcome,
      type: "message",
      position: { x: 1560, y: 180 },
      data: {
        title: "Boas-vindas",
        body: "Oi, eu sou a Sté. Vi que você chegou pelo mini curso — vou te acompanhar daqui. Qualquer dúvida, é só me chamar.",
        cta: "Falar com a Sté",
      },
    },
    {
      id: ste,
      type: "handoff",
      position: { x: 1960, y: 180 },
      data: { title: "Sté · atendimento 1:1", handoffAgent: "ste", body: "O fluxo pausa. A Sté atende. Sem inventar banca." },
    },
    {
      id: cond,
      type: "condition",
      position: { x: 2360, y: 180 },
      data: { title: "Chegou print?", conditionKind: "print" },
    },
    {
      id: ester,
      type: "notify",
      position: { x: 2760, y: 80 },
      data: { title: "Avisar Ester", notifyKind: "ester", notifyBody: BANCA_FIXED },
    },
    {
      id: heat,
      type: "tag",
      position: { x: 3160, y: 80 },
      data: { title: "Marcar quente", tagKind: "temperature", temperature: "quente" },
    },
    {
      id: wait,
      type: "wait",
      position: { x: 3560, y: 80 },
      data: { title: "Espera 3–4 dias", delayHours: 84, delayWindow: "depois do print" },
    },
    {
      id: offer,
      type: "offer",
      position: { x: 3960, y: 80 },
      data: { title: "Oferta do produto", body: "Passados 3–4 dias, o fluxo oferece o produto.", cta: "Ver oferta", url: "" },
    },
  ]

  const edges: SalesFunnel["edges"] = [
    { id: uid(), source: ad, target: land },
    { id: uid(), source: land, target: split },
    { id: uid(), source: split, target: entryPopup, sourceHandle: "a" },
    { id: uid(), source: split, target: entryJoin, sourceHandle: "b" },
    { id: uid(), source: entryPopup, target: welcome },
    { id: uid(), source: entryJoin, target: welcome },
    { id: uid(), source: entryStart, target: welcome },
    { id: uid(), source: welcome, target: ste },
    { id: uid(), source: ste, target: cond },
    { id: uid(), source: cond, target: ester, sourceHandle: "yes" },
    { id: uid(), source: ester, target: heat },
    { id: uid(), source: heat, target: wait },
    { id: uid(), source: wait, target: offer },
  ]

  return {
    id: uid(),
    name,
    mode: "sales",
    status: "draft",
    updatedAt: now,
    nodes,
    edges,
  }
}

export function publishSnapshot(funnel: SalesFunnel): SalesSnapshot {
  return {
    name: funnel.name,
    publishedAt: new Date().toISOString(),
    nodes: funnel.nodes,
    edges: funnel.edges,
  }
}

export function seededOperation(): SalesFunnel {
  const funnel = emptySalesFunnel("Operação")
  const production = publishSnapshot(funnel)
  return { ...funnel, status: "active", production }
}

export function leadFromCapture(
  input: {
    name: string
    contact: string
    channel: LeadChannel
    origin: LeadOrigin
  },
  snapshot: SalesSnapshot | null = null,
  funnelId?: string
): Lead {
  const now = new Date().toISOString()
  const base: Lead = {
    id: uid(),
    name: input.name.trim(),
    contact: input.contact.trim(),
    channel: input.channel,
    campaign: campaignFor(input.channel),
    origin: input.origin,
    temperature: "novo",
    stage: input.origin === "popup" ? "capture" : input.origin === "group_join" ? "group" : "welcome",
    memory: "",
    events: [],
    messages: [],
    funnelId,
    createdAt: now,
    updatedAt: now,
  }
  const walked = applyEvent(snapshot, base, eventFromOrigin(input.origin)).lead
  if (walked.channel !== "telegram") return walked
  return replySte(walked, null).lead
}

export function captureAgainstFunnels(
  input: { name: string; contact: string; channel: LeadChannel; origin: LeadOrigin },
  funnels: SalesFunnel[]
) {
  const published = publishedSnapshot(funnels)
  const funnel = funnels.find((item) => item.production === published) ?? funnels.find((item) => item.status === "active")
  return leadFromCapture(input, published, funnel?.id)
}
