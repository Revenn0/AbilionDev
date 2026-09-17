import { nodeTitle } from "@/lib/runtime"
import type { Lead, SalesSnapshot } from "@/lib/types"

function startOfDay(ms: number) {
  const date = new Date(ms)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

export function hasConversation(lead: Lead) {
  return (
    lead.channel === "telegram" &&
    ((lead.messages?.length ?? 0) > 0 ||
      Boolean(lead.lastMessage) ||
      lead.origin === "private" ||
      lead.origin === "facebook" ||
      lead.origin === "group_join")
  )
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

export function deriveOps(leads: Lead[], snapshot: SalesSnapshot | null = null) {
  const today = startOfDay(Date.now())
  return {
    leads: leads.length,
    conversations: leads.filter(hasConversation).length,
    startedToday: leads.filter((lead) => hasConversation(lead) && new Date(lead.createdAt).getTime() >= today).length,
    newToday: leads.filter((lead) => new Date(lead.createdAt).getTime() >= today).length,
    whatsapp: leads.filter((lead) => lead.channel === "whatsapp").length,
    telegram: leads.filter((lead) => lead.channel === "telegram").length,
    novo: leads.filter((lead) => lead.temperature === "novo").length,
    morno: leads.filter((lead) => lead.temperature === "morno").length,
    quente: leads.filter((lead) => lead.temperature === "quente").length,
    ester: leads.filter(needsEster).length,
    waiting: leads.filter((lead) => isWaiting(lead)).length,
    offered: leads.filter(hasOffer).length,
    facebook: leads.filter((lead) => lead.origin === "facebook").length,
    facebookToday: leads.filter((lead) => lead.origin === "facebook" && new Date(lead.createdAt).getTime() >= today).length,
    inStep: leads.filter((lead) => Boolean(lead.nodeId)).length,
    stepLabel: (lead: Lead) => nodeTitle(snapshot, lead.nodeId) ?? lead.stage,
  }
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
