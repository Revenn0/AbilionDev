import { factsFromGeo } from "./geo"
import { replySte } from "./ste"
import { campaignFromStart } from "./telegram-start"
import { captureAgainstFunnels } from "./templates"
import type { Lead, SalesFunnel } from "./types"

const OPEN_FOLLOW_UP = "tô perdendo tudo no Aviator"

function followUp(index: number) {
  if (index % 20 === 0) return "vai se foder"
  if (index % 11 === 0) return "e o flamengo ontem?"
  if (index % 7 === 0) return "quanto custa o app?"
  if (index % 5 === 0) return OPEN_FOLLOW_UP
  return null
}

function seedFacebookLead(funnels: SalesFunnel[], index: number): Lead {
  const payload = index % 9 === 0 ? "fb_campanha" : "fb"
  const captured = captureAgainstFunnels(
    {
      name: `Lead FB ${String(index + 1).padStart(3, "0")}`,
      contact: `@fb${index + 1}`,
      channel: "telegram",
      origin: "facebook",
    },
    funnels
  )
  captured.startPayload = payload
  captured.campaign = campaignFromStart(payload)
  captured.telegramChatId = String(800_000 + index)
  const ufs = ["SP", "RJ", "MG", "BA", "PR", "RS", "PE", "CE", "GO", "SC"] as const
  captured.facts = { ...captured.facts, ...factsFromGeo({ countryCode: "BR", regionCode: ufs[index % ufs.length] }) }
  return captured
}

export function burstFacebookLeads(funnels: SalesFunnel[], count = 100): Lead[] {
  return Array.from({ length: count }, (_, index) => {
    const captured = seedFacebookLead(funnels, index)
    const extra = followUp(index)
    return extra ? replySte(captured, extra).lead : captured
  })
}

/** Uma conversa aberta para o empty state de Conversas — não usa o follow-up ofensivo do lote. */
export function simulateOpenLead(funnels: SalesFunnel[]): Lead {
  return replySte(seedFacebookLead(funnels, 1), OPEN_FOLLOW_UP).lead
}

export function burstStats(leads: Lead[]) {
  return {
    total: leads.length,
    facebook: leads.filter((lead) => lead.origin === "facebook").length,
    blocked: leads.filter((lead) => lead.steBlocked).length,
    offered: leads.filter((lead) => lead.stePhase === "offer" || lead.stage === "offer").length,
    talking: leads.filter((lead) => (lead.messages ?? []).some((item) => item.role === "lead") && !lead.steBlocked).length,
  }
}
