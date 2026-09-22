import type { PlatformEnvironment } from "@/lib/platform"

export function environmentLabel(environment: PlatformEnvironment) {
  if (environment === "production") return "Produção"
  if (environment === "staging") return "Staging"
  return "Desenvolvimento"
}

export function formatPlatformDate(value?: string) {
  if (!value) return "—"
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return "—"
  return new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date)
}
