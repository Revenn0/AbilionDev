import type { LeadEvent, LeadEventKind, LeadFacts } from "./types.ts"

const LEAD_EVENT_KINDS = new Set<LeadEventKind>([
  "entered",
  "message",
  "wait",
  "handoff",
  "notify_ester",
  "tag",
  "offer",
  "print",
  "banca",
  "advance",
  "blocked",
])

/** Metadados do backup no jsonb não são factos observados do lead no painel. */
export function factsWithoutRemoteKeys(facts?: object | null): LeadFacts {
  if (!facts || typeof facts !== "object" || Array.isArray(facts)) return {}
  const {
    category: _category,
    timeline: _timeline,
    groupIds: _groupIds,
    tags: _tags,
    anonymized: _anonymized,
    botId: _botId,
    integrationId: _integrationId,
    flowVersionId: _flowVersionId,
    brainVersionId: _brainVersionId,
    testRunId: _testRunId,
    ...rest
  } = facts as Record<string, unknown>
  return rest as LeadFacts
}

/** Timeline no jsonb do lead. `lead_events` unread ou vazio já não zera o GET hidratado. */
export function sanitizeLeadEvents(raw: unknown, cap = 80): LeadEvent[] {
  if (!Array.isArray(raw)) return []
  const out: LeadEvent[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue
    const row = item as Partial<LeadEvent>
    const id = typeof row.id === "string" ? row.id.trim().slice(0, 80) : ""
    const at = typeof row.at === "string" ? row.at.trim().slice(0, 40) : ""
    const kind = typeof row.kind === "string" ? row.kind.trim() : ""
    if (!id || !at || !LEAD_EVENT_KINDS.has(kind as LeadEventKind) || seen.has(id)) continue
    seen.add(id)
    const event: LeadEvent = { id, at, kind: kind as LeadEventKind }
    if (typeof row.nodeId === "string" && row.nodeId.trim()) event.nodeId = row.nodeId.trim().slice(0, 80)
    if (typeof row.title === "string" && row.title.trim()) event.title = row.title.trim().slice(0, 160)
    if (typeof row.body === "string" && row.body.trim()) event.body = row.body.trim().slice(0, 400)
    if (typeof row.effect === "string" && row.effect.trim()) event.effect = row.effect.trim().slice(0, 80)
    out.push(event)
  }
  return out.sort((left, right) => left.at.localeCompare(right.at)).slice(-cap)
}
