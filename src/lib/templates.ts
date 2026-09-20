import { normalizeTelegramContact } from "./capture.ts"
import { uid } from "./format.ts"
import { campaignFor } from "./labels.ts"
import { applyEvent, eventFromOrigin, publishedSnapshot } from "./runtime.ts"
import { replySte, steRuntimeFromSnapshot, STE_COURSE_BLOCK, STE_LIVE_BLOCK, STE_OFFER_BLOCK, STE_REMARKETING_BLOCK, STE_SUPERBET_BLOCK, STE_SUPERBET_RESCUE, STE_WELCOME } from "./ste.ts"
import type { Lead, LeadChannel, LeadOrigin, SalesFunnel, SalesSnapshot } from "./types.ts"

export function emptySalesFunnel(name = "Operação"): SalesFunnel {
  const ad = uid()
  const land = uid()
  const entryStart = uid()
  const entryPopup = uid()
  const entryJoin = uid()
  const w1 = uid()
  const w2 = uid()
  const w3 = uid()
  const course = uid()
  const superbet = uid()
  const rescue = uid()
  const offer = uid()
  const lives = uid()
  const wait = uid()
  const remark = uid()
  const ste = uid()
  const now = new Date().toISOString()

  const nodes: SalesFunnel["nodes"] = [
    {
      id: ad,
      type: "traffic",
      position: { x: 40, y: 80 },
      data: { title: "Anúncio Facebook", tag: "META ADS", channel: "meta", url: "" },
    },
    {
      id: land,
      type: "landing",
      position: { x: 380, y: 80 },
      data: { title: "Landing · mini curso", url: "", cta: "Falar com a Sté" },
    },
    {
      id: entryStart,
      type: "entry",
      position: { x: 760, y: 80 },
      data: { title: "Entrada · /start", entryTrigger: "start" },
    },
    {
      id: entryPopup,
      type: "entry",
      position: { x: 760, y: -100 },
      data: { title: "Entrada · popup", entryTrigger: "popup" },
    },
    {
      id: entryJoin,
      type: "entry",
      position: { x: 760, y: 260 },
      data: { title: "Entrada · join", entryTrigger: "group_join", campaignLock: "telegram" },
    },
    {
      id: w1,
      type: "message",
      position: { x: 1160, y: 80 },
      data: { title: "Boas-vindas 1", steLine: "welcome", body: STE_WELCOME[0] },
    },
    {
      id: w2,
      type: "message",
      position: { x: 1560, y: 80 },
      data: { title: "Boas-vindas 2", steLine: "welcome", body: STE_WELCOME[1] },
    },
    {
      id: w3,
      type: "message",
      position: { x: 1960, y: 80 },
      data: { title: "Boas-vindas 3", steLine: "welcome", body: STE_WELCOME[2] },
    },
    {
      id: ste,
      type: "handoff",
      position: { x: 2360, y: 80 },
      data: {
        title: "Sté · 1:1",
        handoffAgent: "ste",
        steTalk: true,
        dieAfter: true,
        body: "A Sté fala o que está neste quadro. Edita as mensagens, publica, e o Telegram usa esta cópia.",
      },
    },
    {
      id: course,
      type: "message",
      position: { x: 1160, y: 420 },
      data: { title: "Minicurso", steLine: "course", body: STE_COURSE_BLOCK.join("\n") },
    },
    {
      id: superbet,
      type: "message",
      position: { x: 1560, y: 420 },
      data: { title: "Superbet", steLine: "superbet", body: STE_SUPERBET_BLOCK.join("\n") },
    },
    {
      id: rescue,
      type: "message",
      position: { x: 1960, y: 420 },
      data: { title: "Resgate 5–10 min", steLine: "rescue", body: STE_SUPERBET_RESCUE },
    },
    {
      id: offer,
      type: "offer",
      position: { x: 2360, y: 420 },
      data: { title: "App e Premium", steLine: "offer", body: STE_OFFER_BLOCK.join("\n"), cta: "Ver oferta" },
    },
    {
      id: lives,
      type: "message",
      position: { x: 2760, y: 420 },
      data: { title: "Horário das lives", steLine: "lives", body: STE_LIVE_BLOCK.join("\n") },
    },
    {
      id: wait,
      type: "wait",
      position: { x: 2760, y: 80 },
      data: { title: "Espera 7 horas", steLine: "remarketing", delayHours: 7, delayWindow: "depois do /start", dieAfter: true },
    },
    {
      id: remark,
      type: "offer",
      position: { x: 3160, y: 80 },
      data: {
        title: "Remarketing",
        steLine: "remarketing",
        dieAfter: true,
        body: STE_REMARKETING_BLOCK.join("\n"),
        cta: "Grupo Premium",
      },
    },
  ]

  const edges: SalesFunnel["edges"] = [
    { id: uid(), source: ad, target: land },
    { id: uid(), source: land, target: entryStart },
    { id: uid(), source: entryStart, target: w1 },
    { id: uid(), source: entryPopup, target: w1 },
    { id: uid(), source: entryJoin, target: w1 },
    { id: uid(), source: w1, target: w2 },
    { id: uid(), source: w2, target: w3 },
    { id: uid(), source: w3, target: ste },
    { id: uid(), source: ste, target: wait },
    { id: uid(), source: wait, target: remark },
    { id: uid(), source: ste, target: course },
    { id: uid(), source: course, target: superbet },
    { id: uid(), source: superbet, target: rescue },
    { id: uid(), source: rescue, target: offer },
    { id: uid(), source: offer, target: lives },
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
    contact: normalizeTelegramContact(input.contact) || input.contact.trim(),
    channel: input.channel,
    campaign: campaignFor(input.channel, input.origin),
    origin: input.origin,
    temperature: "novo",
    stage: input.origin === "popup" || input.origin === "import" ? "capture" : input.origin === "group_join" ? "group" : "welcome",
    memory: "",
    facts: {},
    events: [],
    messages: [],
    funnelId,
    createdAt: now,
    updatedAt: now,
  }
  const walked = applyEvent(snapshot, base, eventFromOrigin(input.origin)).lead
  if (walked.channel !== "telegram") return walked
  return replySte(walked, null, Date.now(), steRuntimeFromSnapshot(snapshot)).lead
}

export function captureAgainstFunnels(
  input: { name: string; contact: string; channel: LeadChannel; origin: LeadOrigin },
  funnels: SalesFunnel[]
) {
  const published = publishedSnapshot(funnels)
  const funnel = funnels.find((item) => item.production === published) ?? funnels.find((item) => item.status === "active")
  return leadFromCapture(input, published, funnel?.id)
}
