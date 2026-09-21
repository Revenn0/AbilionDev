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

/** Chat do funil e joins no grupo vêm do GET /api/leads. Inbox 5xx não esconde o zero. */
export function catalogMetricPending(
  persistSync: "idle" | "ok" | "error",
  count: number,
  _inboxFailed = false
) {
  return metricPending(persistSync, count)
}

/** Filtros de Leads: Telegram vazio com cache WhatsApp ainda não é recorte vazio. */
export function leadMatchesFilter(lead: Lead, filter: string) {
  if (!filter || filter === "all") return true
  if (filter === "telegram") return lead.channel === "telegram"
  if (filter === "whatsapp") return lead.channel === "whatsapp"
  if (filter === "import") return lead.origin === "import"
  if (filter === "novo" || filter === "morno" || filter === "quente") return lead.temperature === filter
  if (filter === "ester") return needsEster(lead)
  if (filter === "facebook") return lead.origin === "facebook"
  if (filter.startsWith("cat:")) return lead.category === filter.slice(4)
  return true
}

export function leadFilterCount(leads: Lead[], filter: string) {
  return leads.filter((item) => leadMatchesFilter(item, filter)).length
}

export function leadFilterPending(
  persistSync: "idle" | "ok" | "error",
  count: number,
  filter: string,
  inboxFailed = false
) {
  const extra = inboxFailed && (filter === "all" || filter === "telegram")
  return metricPending(persistSync, count, extra)
}

/** Escrever lead contra o quadro: leftover no cache não confirma o universo. */
export function funnelsWriteBlocked(crmSync: "idle" | "ok" | "error") {
  return crmSync !== "ok"
}

/** Só o GET confirma o universo. Gravar rascunho (ou falhar o persist) não solta Publicar. */
export function crmSyncAfterFlush(wrote: boolean, funnelsConfirmed: boolean): "ok" | "error" {
  if (!wrote) return "error"
  return funnelsConfirmed ? "ok" : "error"
}

/** Captura, import e lote: GET unread não é catálogo vazio. `funnelsUnread` bloqueia o que precisa do quadro. */
export function leadWritesBlocked(
  persistSync: "idle" | "ok" | "error",
  funnelsUnread = false
) {
  return persistSync !== "ok" || funnelsUnread
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
