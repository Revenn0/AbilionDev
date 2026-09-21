import type { Lead } from "./types.ts"

function startOfDay(ms: number) {
  const date = new Date(ms)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

export function hasConversation(lead: Lead) {
  return lead.channel === "telegram" && ((lead.messages?.length ?? 0) > 0 || Boolean(lead.lastMessage))
}

export function needsEster(lead: Lead) {
  return Boolean(lead.printAt) && !lead.bancaAt
}

export function isWaiting(lead: Lead, now = Date.now()) {
  return Boolean(lead.waitUntil && new Date(lead.waitUntil).getTime() > now)
}

export function hasOffer(lead: Lead) {
  return lead.stage === "offer" || lead.events.some((item) => item.kind === "offer")
}

export function isImportedLead(lead: Pick<Lead, "origin" | "channel">) {
  return lead.origin === "import" || lead.channel === "whatsapp"
}

/** Chat real do Telegram ou lista importada: o painel só grava nota, nome e temperatura. */
export function isOperatorLockedLead(lead: Pick<Lead, "origin" | "channel"> & { telegramChatId?: string }) {
  return Boolean(lead.telegramChatId) || isImportedLead(lead)
}

export function deriveOps(leads: Lead[]) {
  return {
    leads: leads.length,
    conversations: leads.filter(hasConversation).length,
    telegram: leads.filter((lead) => lead.channel === "telegram").length,
    whatsapp: leads.filter((lead) => lead.channel === "whatsapp").length,
    imported: leads.filter((lead) => lead.origin === "import").length,
    novo: leads.filter((lead) => lead.temperature === "novo").length,
    morno: leads.filter((lead) => lead.temperature === "morno").length,
    quente: leads.filter((lead) => lead.temperature === "quente").length,
    waiting: leads.filter((lead) => isWaiting(lead)).length,
    offered: leads.filter(hasOffer).length,
    facebook: leads.filter((lead) => lead.origin === "facebook").length,
  }
}

export function leadsHydrating(persistSync: "idle" | "ok" | "error", leadCount: number) {
  return persistSync === "idle" && leadCount === 0
}

/** GET falhou e ainda não há cache — não é lista vazia. `extraFailed` cobre inbox/CRM à parte. */
export function leadsLoadFailed(
  persistSync: "idle" | "ok" | "error",
  leadCount: number,
  extraFailed = false
) {
  return leadCount === 0 && (persistSync === "error" || extraFailed)
}

/** KPI de um recorte (conversas, joins, Facebook hoje): cache doutro canal não fecha o GET. */
export function metricPending(
  persistSync: "idle" | "ok" | "error",
  count: number,
  extraFailed = false
) {
  return leadsHydrating(persistSync, count) || leadsLoadFailed(persistSync, count, extraFailed)
}

export function barShare(value: number, total: number) {
  if (total <= 0) return 0
  return Math.round((value / total) * 100)
}

export function seriesLast30(leads: Lead[], pick: (lead: Lead) => boolean) {
  const days = Array.from({ length: 30 }, () => 0)
  const start = startOfDay(Date.now() - 29 * 86_400_000)
  for (const lead of leads) {
    if (!pick(lead)) continue
    const index = Math.floor((new Date(lead.createdAt).getTime() - start) / 86_400_000)
    if (index >= 0 && index < 30) days[index] += 1
  }
  return days
}
