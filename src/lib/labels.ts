import type { LeadOrigin, LeadStage, LeadTemp } from "./types"

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
  facebook: "Facebook → Telegram",
}

export function campaignFor(channel: "whatsapp" | "telegram", origin?: LeadOrigin) {
  if (origin === "facebook") return "Facebook · ads"
  return channel === "telegram" ? "Telegram · grupo" : "WhatsApp · grupo"
}
