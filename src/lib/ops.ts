import type { Lead } from "@/lib/types"

function startOfDay(ms: number) {
  const date = new Date(ms)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

export function hasConversation(lead: Lead) {
  return Boolean(lead.lastMessage) || lead.stage !== "capture" || lead.origin === "private"
}

export function needsEster(lead: Lead) {
  return Boolean(lead.printAt) && !lead.bancaAt
}

export function deriveOps(leads: Lead[]) {
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
