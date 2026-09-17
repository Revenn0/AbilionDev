import { replySte } from "./ste"
import { campaignFromStart } from "./telegram-start"
import { captureAgainstFunnels } from "./templates"
import type { Lead, SalesFunnel } from "./types"

function followUp(index: number) {
  if (index % 20 === 0) return "vai se foder"
  if (index % 11 === 0) return "e o flamengo ontem?"
  if (index % 7 === 0) return "quanto custa o app?"
  if (index % 5 === 0) return "tô perdendo tudo no Aviator"
  return null
}

export function burstFacebookLeads(funnels: SalesFunnel[], count = 100): Lead[] {
  return Array.from({ length: count }, (_, index) => {
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
    const extra = followUp(index)
    return extra ? replySte(captured, extra).lead : captured
  })
}

export function burstStats(leads: Lead[]) {
  return {
    total: leads.length,
    facebook: leads.filter((lead) => lead.origin === "facebook").length,
    blocked: leads.filter((lead) => lead.steBlocked).length,
    offered: leads.filter((lead) => lead.stePhase === "offer" || lead.stage === "offer").length,
    talking: leads.filter((lead) => (lead.messages?.length ?? 0) > 1 && !lead.steBlocked).length,
  }
}
