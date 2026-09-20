import { uid } from "./format.ts"
import { campaignFor } from "./labels.ts"
import { isImportedLead } from "./ops.ts"
import { isFlowKind, isMapKind, BANCA_FIXED, type FlowEdge, type FlowNode, type Lead, type LeadEvent, type LeadOrigin, type LeadStage, type SalesFunnel, type SalesSnapshot } from "./types.ts"

export type RuntimeEvent =
  | { type: "capture" }
  | { type: "join" }
  | { type: "start" }
  | { type: "message"; text?: string }
  | { type: "print" }
  | { type: "banca" }
  | { type: "timer" }
  | { type: "resume" }

export type RuntimeEffect =
  | { kind: "send_message"; body: string; cta?: string; url?: string }
  | { kind: "wait"; until: string; hours: number }
  | { kind: "handoff"; agent: "ste" }
  | { kind: "notify_ester"; body: string }
  | { kind: "tag"; temperature?: Lead["temperature"]; campaign?: string }
  | { kind: "offer"; body?: string; url?: string; cta?: string }
  | { kind: "blocked"; reason: string }

export type RuntimeResult = {
  lead: Lead
  effects: RuntimeEffect[]
}

export function eventFromOrigin(origin: LeadOrigin): RuntimeEvent {
  if (origin === "popup" || origin === "import") return { type: "capture" }
  if (origin === "group_join") return { type: "join" }
  return { type: "start" }
}

function publishedAt(funnel: SalesFunnel) {
  return funnel.production?.publishedAt ?? funnel.updatedAt
}

export function publishedFunnel(funnels: SalesFunnel[]): SalesFunnel | undefined {
  const live = funnels.filter((item) => item.status === "active" && item.production)
  const pool = live.length ? live : funnels.filter((item) => item.production)
  if (!pool.length) return undefined
  return pool.slice().sort((a, b) => publishedAt(b).localeCompare(publishedAt(a)))[0]
}

export function publishedSnapshot(funnels: SalesFunnel[]): SalesSnapshot | null {
  return publishedFunnel(funnels)?.production ?? null
}

export function snapshotOf(funnel: SalesFunnel): SalesSnapshot {
  return {
    name: funnel.name,
    publishedAt: funnel.production?.publishedAt ?? funnel.updatedAt,
    nodes: funnel.nodes,
    edges: funnel.edges,
  }
}

function graph(snapshot: SalesSnapshot) {
  const nodes = new Map(snapshot.nodes.map((node) => [node.id, node]))
  const outs = new Map<string, FlowEdge[]>()
  for (const edge of snapshot.edges) {
    const list = outs.get(edge.source) ?? []
    list.push(edge)
    outs.set(edge.source, list)
  }
  return { nodes, outs }
}

function nextId(outs: Map<string, FlowEdge[]>, nodeId: string, handle?: string) {
  const edges = outs.get(nodeId) ?? []
  if (handle) {
    const match = edges.find((edge) => (edge.sourceHandle || "next") === handle)
    if (match) return match.target
  }
  const next = edges.find((edge) => !edge.sourceHandle || edge.sourceHandle === "next")
  return next?.target ?? edges[0]?.target
}

function matchesEntry(node: FlowNode, event: RuntimeEvent) {
  const trigger = node.data.entryTrigger ?? "any"
  if (trigger === "any") return true
  if (event.type === "capture") return trigger === "popup"
  if (event.type === "join") return trigger === "group_join"
  if (event.type === "start") return trigger === "start"
  return false
}

function findEntry(snapshot: SalesSnapshot, event: RuntimeEvent, channel?: Lead["channel"]) {
  const entries = snapshot.nodes.filter((node) => node.type === "entry")
  const locked = entries.filter((node) => !node.data.campaignLock || node.data.campaignLock === channel)
  const exact = locked.find((node) => matchesEntry(node, event) && node.data.entryTrigger !== "any")
  if (exact) return exact
  const any = locked.find((node) => (node.data.entryTrigger ?? "any") === "any")
  return any ?? locked[0] ?? entries[0] ?? snapshot.nodes.find((node) => isFlowKind(node.type))
}

function evalCondition(node: FlowNode, lead: Lead) {
  const kind = node.data.conditionKind ?? "print"
  if (kind === "print") return Boolean(lead.printAt)
  if (kind === "banca") return Boolean(lead.bancaAt)
  if (kind === "temperature") return lead.temperature === node.data.conditionValue
  if (kind === "campaign") return lead.channel === node.data.conditionValue
  return false
}

function stageFrom(type: FlowNode["type"], lead: Lead): LeadStage {
  if (type === "entry") {
    if (lead.origin === "popup" || lead.origin === "import") return "capture"
    if (lead.origin === "group_join") return "group"
    return "welcome"
  }
  if (type === "message") return "welcome"
  if (type === "handoff") return "attendance"
  if (type === "condition") return lead.printAt ? "print" : "attendance"
  if (type === "notify") return lead.bancaAt ? "banca" : lead.printAt ? "print" : "attendance"
  if (type === "wait") return lead.bancaAt ? "banca" : lead.printAt ? "print" : "attendance"
  if (type === "offer") return "offer"
  return lead.stage
}

function pushEvent(lead: Lead, partial: Omit<LeadEvent, "id" | "at">, at: string) {
  lead.events = [
    ...lead.events,
    {
      id: uid(),
      at,
      ...partial,
    },
  ]
}

function skipMap(
  nodes: Map<string, FlowNode>,
  outs: Map<string, FlowEdge[]>,
  start: string | undefined,
  handle?: string
) {
  let current = start
  let first = true
  const seen = new Set<string>()
  while (current && !seen.has(current)) {
    seen.add(current)
    const node = nodes.get(current)
    if (!node) return undefined
    if (!isMapKind(node.type)) return current
    current = nextId(outs, current, first ? handle : undefined)
    first = false
  }
  return current
}

export function waitHours(value: unknown, fallback = 84) {
  const hours = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(hours) || hours < 0) return fallback
  return Math.min(8760, hours)
}

export function applyEvent(
  snapshot: SalesSnapshot | null,
  lead: Lead,
  event: RuntimeEvent,
  nowMs = Date.now()
): RuntimeResult {
  const next: Lead = {
    ...lead,
    events: [...(lead.events ?? [])],
    messages: [...(lead.messages ?? [])],
    facts: { ...(lead.facts ?? {}) },
    campaign: lead.campaign || campaignFor(lead.channel),
  }
  const effects: RuntimeEffect[] = []
  const at = new Date(nowMs).toISOString()

  if (event.type === "print") {
    next.printAt = next.printAt ?? at
    next.stage = "print"
    pushEvent(next, { kind: "print", title: "Print do cadastro", body: "A Ester envia a banca. O fluxo não inventa." }, at)
  }
  if (event.type === "banca") {
    if (!next.printAt) {
      effects.push({ kind: "blocked", reason: "Sem print não há banca." })
      pushEvent(next, { kind: "blocked", title: "Banca bloqueada", body: "Sem print não há banca." }, at)
      next.updatedAt = at
      return { lead: next, effects }
    }
    next.bancaAt = next.bancaAt ?? at
    next.stage = "banca"
    pushEvent(next, { kind: "banca", title: "Ester enviou a banca", body: BANCA_FIXED }, at)
  }

  if (!snapshot) {
    next.updatedAt = at
    if (event.type === "start" || event.type === "join" || event.type === "capture") {
      next.lastMessage = event.type === "join" ? "Entrou no grupo. Lead da campanha." : "/start — sem funil publicado."
    }
    return { lead: next, effects }
  }

  const { nodes, outs } = graph(snapshot)

  if (!next.nodeId) {
    const entry = findEntry(snapshot, event, next.channel)
    if (!entry) {
      next.updatedAt = at
      return { lead: next, effects }
    }
    next.nodeId = skipMap(nodes, outs, entry.id) ?? entry.id
    next.paused = false
    pushEvent(next, { kind: "entered", nodeId: next.nodeId, title: entry.data.title, body: `Entrada · ${event.type}` }, at)
  }

  if (event.type === "print" || event.type === "banca" || event.type === "resume") {
    next.paused = false
  }

  let steps = 0
  while (next.nodeId && steps < 24) {
    steps += 1
    const node = nodes.get(next.nodeId)
    if (!node) break

    if (isMapKind(node.type)) {
      const skip = skipMap(nodes, outs, next.nodeId)
      if (!skip || skip === next.nodeId) break
      next.nodeId = skip
      continue
    }

    next.stage = stageFrom(node.type, next)

    if (node.type === "entry") {
      const target = skipMap(nodes, outs, nextId(outs, node.id))
      if (!target) break
      next.nodeId = target
      continue
    }

    if (node.type === "message") {
      const body = node.data.body || ""
      if (!node.data.steLine) {
        effects.push({ kind: "send_message", body, cta: node.data.cta, url: node.data.url })
        next.lastMessage = body
        pushEvent(next, { kind: "message", nodeId: node.id, title: node.data.title, body, effect: "send_message" }, at)
      }
      const target = skipMap(nodes, outs, nextId(outs, node.id))
      if (!target || target === node.id) break
      next.nodeId = target
      continue
    }

    if (node.type === "wait") {
      const hours = waitHours(node.data.delayHours)
      const due = next.waitUntil ? new Date(next.waitUntil).getTime() : 0
      if (due && nowMs >= due && event.type === "timer") {
        next.waitUntil = undefined
        pushEvent(next, { kind: "advance", nodeId: node.id, title: node.data.title, body: "Espera concluída." }, at)
        const target = skipMap(nodes, outs, nextId(outs, node.id))
        if (!target) break
        next.nodeId = target
        event = { type: "resume" }
        continue
      }
      if (!next.waitUntil) {
        const until = new Date(nowMs + hours * 3_600_000).toISOString()
        next.waitUntil = until
        effects.push({ kind: "wait", until, hours })
        pushEvent(next, { kind: "wait", nodeId: node.id, title: node.data.title, body: `Espera ${hours}h`, effect: until }, at)
      }
      next.paused = true
      break
    }

    if (node.type === "condition") {
      const yes = evalCondition(node, next)
      const target = skipMap(nodes, outs, nextId(outs, node.id, yes ? "yes" : "no"), yes ? "yes" : "no")
      if (!target) {
        next.paused = true
        break
      }
      next.nodeId = target
      continue
    }

    if (node.type === "handoff") {
      if (next.paused && event.type !== "print" && event.type !== "banca" && event.type !== "resume") {
        break
      }
      if (event.type === "print" || event.type === "banca" || event.type === "resume") {
        const target = skipMap(nodes, outs, nextId(outs, node.id))
        if (!target) break
        next.nodeId = target
        next.paused = false
        continue
      }
      effects.push({ kind: "handoff", agent: "ste" })
      next.paused = true
      next.stage = "attendance"
      next.lastMessage = next.lastMessage ?? "Sté no 1:1"
      pushEvent(next, { kind: "handoff", nodeId: node.id, title: node.data.title, body: "Atendimento humano. O fluxo pausa." }, at)
      break
    }

    if (node.type === "notify") {
      const kind = node.data.notifyKind ?? "ester"
      if (!next.printAt) {
        effects.push({ kind: "blocked", reason: "Sem print não há aviso de banca." })
        pushEvent(next, { kind: "blocked", nodeId: node.id, title: node.data.title, body: "Sem print não há aviso de banca." }, at)
        next.paused = true
        break
      }
      const body = kind === "banca" ? BANCA_FIXED : node.data.notifyBody || BANCA_FIXED
      effects.push({ kind: "notify_ester", body })
      pushEvent(next, { kind: "notify_ester", nodeId: node.id, title: node.data.title, body, effect: kind }, at)
      if (kind === "banca") {
        next.bancaAt = next.bancaAt ?? at
        next.stage = "banca"
      }
      const target = skipMap(nodes, outs, nextId(outs, node.id))
      if (!target) break
      next.nodeId = target
      continue
    }

    if (node.type === "tag") {
      if (node.data.tagKind === "temperature" && node.data.temperature) {
        next.temperature = node.data.temperature
        effects.push({ kind: "tag", temperature: node.data.temperature })
      }
      if (node.data.tagKind === "campaign" && node.data.campaignLock) {
        next.channel = node.data.campaignLock
        next.campaign = campaignFor(node.data.campaignLock)
        effects.push({ kind: "tag", campaign: next.campaign })
      }
      pushEvent(next, { kind: "tag", nodeId: node.id, title: node.data.title, body: node.data.title }, at)
      const target = skipMap(nodes, outs, nextId(outs, node.id))
      if (!target) break
      next.nodeId = target
      continue
    }

    if (node.type === "offer") {
      const already = next.events.some((item) => item.kind === "offer" && item.nodeId === node.id)
      if (!already) {
        effects.push({ kind: "offer", body: node.data.body, url: node.data.url, cta: node.data.cta })
        next.lastMessage = node.data.body || node.data.cta || "Oferta do produto"
        next.stage = "offer"
        pushEvent(next, { kind: "offer", nodeId: node.id, title: node.data.title, body: next.lastMessage, effect: "offer" }, at)
      }
      const target = skipMap(nodes, outs, nextId(outs, node.id))
      if (!target || target === node.id) break
      next.nodeId = target
      continue
    }

    break
  }

  next.updatedAt = at
  return { lead: next, effects }
}

export function dueWaits(leads: Lead[], nowMs = Date.now()) {
  return leads.filter((lead) => lead.waitUntil && new Date(lead.waitUntil).getTime() <= nowMs)
}

/** Espera com chat real só avança quando o Worker tem token — senão o cron come o follow-up sem mandar. Importado nunca corre no cron. */
export function canAdvanceRemoteWait(lead: Lead, hasTelegramToken: boolean) {
  if (isImportedLead(lead)) return false
  return !lead.telegramChatId || hasTelegramToken
}

export function nodeTitle(snapshot: SalesSnapshot | null, nodeId?: string) {
  if (!snapshot || !nodeId) return undefined
  return snapshot.nodes.find((node) => node.id === nodeId)?.data.title
}
