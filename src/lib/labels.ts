import type { LeadOrigin, LeadStage, LeadTemp } from "@/lib/types"

export const TEMP_LABEL: Record<LeadTemp, string> = {
  novo: "Novo",
  morno: "Morno",
  quente: "Quente",
}

export const STAGE_LABEL: Record<LeadStage, string> = {
  capture: "Captura",
  group: "Grupo",
  welcome: "Boas-vindas",
  attendance: "Atendimento",
  print: "Print · Ester",
  banca: "Banca enviada",
  offer: "Oferta",
}

export const ORIGIN_LABEL: Record<LeadOrigin, string> = {
  popup: "Popup mini curso",
  group_join: "Join no grupo",
  private: "Privado /start",
  closing: "Fechamento",
}

export function campaignFor(channel: "whatsapp" | "telegram") {
  return channel === "telegram" ? "Telegram · grupo" : "WhatsApp · grupo"
}
