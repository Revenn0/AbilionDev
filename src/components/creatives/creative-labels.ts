import type { CreativeLanguage, CreativeStatus } from "@/lib/platform"

export const CREATIVE_STATUS_LABELS: Record<CreativeStatus, string> = {
  draft: "Rascunho",
  review: "Em revisão",
  testing: "Em teste",
  approved: "Aprovado",
  paused: "Pausado",
  winner: "Vencedor",
}

export const CREATIVE_LANGUAGE_LABELS: Record<CreativeLanguage, string> = {
  "pt-BR": "Português (BR)",
  es: "Espanhol",
}
