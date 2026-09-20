import { uid } from "./format.ts"
import { sanitizeIncomingFunnel } from "./migrate.ts"
import type { FlowEdge, FlowNode, SalesFunnel, SalesKind } from "./types.ts"

export type FunnelImportSource = "abilion" | "manychat" | "n8n" | "typebot" | "generic"

export type FunnelImportOk = {
  ok: true
  funnel: SalesFunnel
  source: FunnelImportSource
}

export type FunnelImportFail = {
  ok: false
  error: string
}

export type FunnelImportResult = FunnelImportOk | FunnelImportFail

type Beat = {
  title: string
  body: string
  waitHours?: number
  kind?: SalesKind
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function clipName(value: unknown, fallback: string) {
  const next = typeof value === "string" ? value.trim().slice(0, 80) : ""
  return next || fallback
}

function textOf(value: unknown, depth = 0): string {
  if (depth > 7) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  if (Array.isArray(value)) return value.map((item) => textOf(item, depth + 1)).filter(Boolean).join("\n")
  const row = asRecord(value)
  if (!row) return ""
  if (typeof row.text === "string") return row.text
  if (typeof row.message === "string") return row.message
  if (typeof row.body === "string") return row.body
  if (typeof row.caption === "string") return row.caption
  if (typeof row.html === "string") return row.html
  if (typeof row.content === "string") return row.content
  if (row.richText) return textOf(row.richText, depth + 1)
  if (row.children) return textOf(row.children, depth + 1)
  if (row.messages) return textOf(row.messages, depth + 1)
  if (row.content) return textOf(row.content, depth + 1)
  return ""
}

function delayHoursOf(value: unknown) {
  const row = asRecord(value) ?? {}
  const amount = Number(row.delayHours ?? row.delay_hours ?? row.hours ?? row.amount ?? row.timeout ?? row.delay)
  if (Number.isFinite(amount) && amount > 0) {
    const unit = String(row.unit ?? row.delayUnit ?? "").toLowerCase()
    if (unit.startsWith("min")) return Math.max(1, Math.round(amount / 60))
    if (unit.startsWith("sec")) return Math.max(1, Math.round(amount / 3600))
    if (unit.startsWith("day")) return Math.max(1, Math.round(amount * 24))
    return Math.max(1, Math.round(amount))
  }
  return undefined
}

export function parseFunnelPayload(raw: unknown): unknown {
  if (typeof raw !== "string") return raw
  const text = raw.trim()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    const lines = text
      .split(/\n{2,}|\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    return lines.length ? { name: "Texto colado", messages: lines } : null
  }
}

function isAbilionNode(node: unknown) {
  const row = asRecord(node)
  if (!row || typeof row.type !== "string" || row.type.includes(".")) return false
  return Boolean(row.data && typeof row.data === "object")
}

function isAbilionFunnel(raw: unknown) {
  const row = asRecord(raw)
  if (!row || !Array.isArray(row.nodes) || !row.nodes.length) return false
  return row.nodes.every(isAbilionNode)
}

function draftFromGraph(name: string, nodes: FlowNode[], edges: FlowEdge[]): SalesFunnel | null {
  return sanitizeIncomingFunnel({
    id: uid(),
    name,
    mode: "sales",
    status: "draft",
    updatedAt: new Date().toISOString(),
    nodes,
    edges,
    production: null,
  })
}

export function funnelFromBeats(name: string, beats: Beat[]): SalesFunnel | null {
  const clean = beats
    .map((beat) => ({
      title: clipName(beat.title, beat.kind === "wait" ? "Espera" : "Mensagem"),
      body: (beat.body || "").trim().slice(0, 4000),
      waitHours: beat.waitHours && beat.waitHours > 0 ? Math.min(720, Math.round(beat.waitHours)) : undefined,
      kind: beat.kind,
    }))
    .filter((beat) => beat.body || beat.waitHours || beat.kind === "entry")
  const entry = uid()
  const nodes: FlowNode[] = [
    {
      id: entry,
      type: "entry",
      position: { x: 80, y: 80 },
      data: { title: "Entrada · importado", entryTrigger: "start" },
    },
  ]
  const edges: FlowEdge[] = []
  let prev = entry
  let x = 480
  if (!clean.length) {
    const message = uid()
    nodes.push({
      id: message,
      type: "message",
      position: { x, y: 80 },
      data: { title: "Mensagem", body: "" },
    })
    edges.push({ id: uid(), source: prev, target: message })
    return draftFromGraph(name, nodes, edges)
  }
  for (const beat of clean) {
    if (beat.waitHours) {
      const waitId = uid()
      nodes.push({
        id: waitId,
        type: "wait",
        position: { x, y: 80 },
        data: { title: beat.title, delayHours: beat.waitHours, delayWindow: "depois da mensagem anterior" },
      })
      edges.push({ id: uid(), source: prev, target: waitId })
      prev = waitId
      x += 400
      if (!beat.body) continue
    }
    const id = uid()
    const kind: SalesKind = beat.kind && beat.kind !== "entry" && beat.kind !== "wait" ? beat.kind : "message"
    nodes.push({
      id,
      type: kind,
      position: { x, y: 80 },
      data: { title: beat.title, body: beat.body },
    })
    edges.push({ id: uid(), source: prev, target: id })
    prev = id
    x += 400
  }
  return draftFromGraph(name, nodes, edges)
}

function fromAbilion(raw: Record<string, unknown>, name: string): FunnelImportResult {
  const funnel = sanitizeIncomingFunnel({
    ...raw,
    id: uid(),
    name: clipName(raw.name, name),
    status: "draft",
    updatedAt: new Date().toISOString(),
    production: null,
  })
  if (!funnel || !funnel.nodes.length) return { ok: false, error: "Este JSON da Abilion não tem blocos." }
  return { ok: true, funnel, source: "abilion" }
}

function manyChatBeats(raw: Record<string, unknown>): Beat[] {
  const bags = [raw.steps, raw.contents, raw.pages, raw.messages, asRecord(raw.data)?.steps, asRecord(raw.flow)?.steps]
  const steps = bags.flatMap(asList)
  const beats: Beat[] = []
  for (const step of steps) {
    const row = asRecord(step)
    if (!row) {
      const text = textOf(step).trim()
      if (text) beats.push({ title: "Mensagem", body: text })
      continue
    }
    const type = String(row.type ?? row.ns ?? "").toLowerCase()
    const waitHours = delayHoursOf(row) ?? delayHoursOf(row.content)
    const body = textOf(row.content ?? row.messages ?? row.message ?? row.text ?? row.caption).trim()
    if (type.includes("delay") || type.includes("wait") || (waitHours && !body)) {
      beats.push({ title: clipName(row.name ?? row.title, "Espera"), body: "", waitHours: waitHours ?? 1 })
      continue
    }
    if (body) beats.push({ title: clipName(row.name ?? row.title, "Mensagem"), body, waitHours })
  }
  return beats
}

function n8nBeats(raw: Record<string, unknown>): { beats: Beat[]; nodes: FlowNode[]; edges: FlowEdge[] } | null {
  const items = asList(raw.nodes)
  if (!items.length) return null
  const looksN8n = items.some((item) => {
    const row = asRecord(item)
    const type = typeof row?.type === "string" ? row.type : ""
    return type.includes("n8n") || type.includes(".") || Array.isArray(row?.position)
  })
  if (!looksN8n) return null
  const byName = new Map<string, string>()
  const nodes: FlowNode[] = []
  const beats: Beat[] = []
  items.forEach((item, index) => {
    const row = asRecord(item)
    if (!row) return
    const id = typeof row.id === "string" && row.id.trim() ? row.id.trim().slice(0, 80) : uid()
    const title = clipName(row.name ?? row.title, `Passo ${index + 1}`)
    byName.set(title, id)
    if (typeof row.id === "string") byName.set(row.id, id)
    const params = asRecord(row.parameters) ?? {}
    const type = String(row.type ?? "").toLowerCase()
    const waitHours = type.includes("wait") ? delayHoursOf(params) ?? delayHoursOf(row) : delayHoursOf(params)
    const body = textOf(params.text ?? params.message ?? params.content ?? params.jsonMessage ?? row.notes).trim()
    const position = Array.isArray(row.position)
      ? { x: Number(row.position[0]) || 80 + index * 400, y: Number(row.position[1]) || 80 }
      : { x: 80 + index * 400, y: 80 }
    const kind: SalesKind = waitHours && !body ? "wait" : "message"
    nodes.push({
      id,
      type: kind,
      position,
      data: kind === "wait" ? { title, delayHours: waitHours ?? 1 } : { title, body },
    })
    beats.push({ title, body, waitHours, kind })
  })
  const edges: FlowEdge[] = []
  const connections = asRecord(raw.connections) ?? {}
  for (const [from, bag] of Object.entries(connections)) {
    const source = byName.get(from)
    if (!source) continue
    const mains = asRecord(bag)?.main
    for (const lane of asList(mains)) {
      for (const link of asList(lane)) {
        const targetName = asRecord(link)?.node
        const target = typeof targetName === "string" ? byName.get(targetName) : undefined
        if (target) edges.push({ id: uid(), source, target })
      }
    }
  }
  if (!edges.length && nodes.length > 1) {
    for (let i = 1; i < nodes.length; i++) {
      const prev = nodes[i - 1]
      const next = nodes[i]
      if (prev && next) edges.push({ id: uid(), source: prev.id, target: next.id })
    }
  }
  return { beats, nodes, edges }
}

function typebotBeats(raw: Record<string, unknown>): { beats: Beat[]; nodes: FlowNode[]; edges: FlowEdge[] } | null {
  const typebot = asRecord(raw.typebot) ?? raw
  const groups = asList(typebot.groups)
  if (!groups.length) return null
  const nodes: FlowNode[] = []
  const beats: Beat[] = []
  const groupIds = new Map<string, string>()
  groups.forEach((group, index) => {
    const row = asRecord(group)
    if (!row) return
    const id = typeof row.id === "string" && row.id.trim() ? row.id.trim().slice(0, 80) : uid()
    groupIds.set(typeof row.id === "string" ? row.id : id, id)
    const coords = asRecord(row.graphCoordinates) ?? asRecord(row.graphCoordinates)
    const title = clipName(row.title ?? row.name, `Grupo ${index + 1}`)
    const body = asList(row.blocks)
      .map((block) => textOf(asRecord(block)?.content ?? asRecord(block)?.options ?? block).trim())
      .filter(Boolean)
      .join("\n\n")
    nodes.push({
      id,
      type: "message",
      position: { x: Number(coords?.x) || 80 + index * 400, y: Number(coords?.y) || 80 },
      data: { title, body },
    })
    if (body) beats.push({ title, body })
  })
  const edges: FlowEdge[] = []
  for (const edge of asList(typebot.edges)) {
    const row = asRecord(edge)
    const from = asRecord(row?.from)?.groupId
    const to = asRecord(row?.to)?.groupId
    const source = typeof from === "string" ? groupIds.get(from) : undefined
    const target = typeof to === "string" ? groupIds.get(to) : undefined
    if (source && target) edges.push({ id: uid(), source, target })
  }
  if (!edges.length && nodes.length > 1) {
    for (let i = 1; i < nodes.length; i++) {
      const prev = nodes[i - 1]
      const next = nodes[i]
      if (prev && next) edges.push({ id: uid(), source: prev.id, target: next.id })
    }
  }
  return { beats, nodes, edges }
}

function genericBeats(raw: Record<string, unknown>): Beat[] {
  const messages = asList(raw.messages)
  if (messages.length) {
    return messages
      .map((item, index) => {
        if (typeof item === "string") return { title: `Mensagem ${index + 1}`, body: item.trim() }
        const row = asRecord(item)
        return {
          title: clipName(row?.title ?? row?.name, `Mensagem ${index + 1}`),
          body: textOf(row?.body ?? row?.text ?? row?.message ?? item).trim(),
          waitHours: delayHoursOf(row),
        }
      })
      .filter((item) => item.body)
  }
  const steps = asList(raw.steps)
  return steps
    .map((item, index) => {
      const row = asRecord(item)
      return {
        title: clipName(row?.title ?? row?.name, `Passo ${index + 1}`),
        body: textOf(row?.body ?? row?.text ?? row?.message ?? item).trim(),
        waitHours: delayHoursOf(row),
      }
    })
    .filter((item) => item.body || item.waitHours)
}

function pickNamedBag(raw: Record<string, unknown>) {
  for (const key of ["salesFunnels", "funnels", "flows"]) {
    const first = asList(raw[key])[0]
    if (first) return first
  }
  return asRecord(raw.data)?.flow ?? raw.data ?? raw
}

export function importFunnel(raw: unknown, nameHint = "Funil importado"): FunnelImportResult {
  const parsed = parseFunnelPayload(raw)
  const root = asRecord(parsed)
  if (!root && !Array.isArray(parsed)) return { ok: false, error: "Cola um JSON de funil (Abilion, ManyChat, n8n, Typebot) ou uma lista de mensagens." }

  if (Array.isArray(parsed)) {
    const beats = parsed
      .map((item, index) =>
        typeof item === "string"
          ? { title: `Mensagem ${index + 1}`, body: item.trim() }
          : {
              title: clipName(asRecord(item)?.title ?? asRecord(item)?.name, `Mensagem ${index + 1}`),
              body: textOf(item).trim(),
            }
      )
      .filter((item) => item.body)
    const funnel = funnelFromBeats(nameHint, beats)
    if (!funnel) return { ok: false, error: "Não achei mensagens neste ficheiro." }
    return { ok: true, funnel, source: "generic" }
  }

  if (!root) return { ok: false, error: "JSON inválido." }
  const picked = pickNamedBag(root)
  const bag = asRecord(picked) ?? root
  const name = clipName(nameHint || bag.name || root.name, "Funil importado")

  if (isAbilionFunnel(bag) || isAbilionFunnel(root)) {
    return fromAbilion(isAbilionFunnel(bag) ? bag : root, name)
  }

  const typebot = typebotBeats(bag) ?? typebotBeats(root)
  if (typebot?.beats.length || typebot?.nodes.length) {
    const funnel =
      typebot.nodes.length > 0
        ? draftFromGraph(name, typebot.nodes, typebot.edges)
        : funnelFromBeats(name, typebot.beats)
    if (!funnel) return { ok: false, error: "O Typebot veio sem blocos de texto." }
    return { ok: true, funnel, source: "typebot" }
  }

  const n8n = n8nBeats(bag) ?? n8nBeats(root)
  if (n8n?.nodes.length) {
    const funnel = draftFromGraph(name, n8n.nodes, n8n.edges) ?? funnelFromBeats(name, n8n.beats)
    if (!funnel) return { ok: false, error: "O n8n veio sem nós utilizáveis." }
    return { ok: true, funnel, source: "n8n" }
  }

  const looksMany = Boolean(bag.steps || bag.contents || bag.pages || bag.ns || asRecord(bag.data)?.steps)
  const many = looksMany ? manyChatBeats(bag) : []
  if (many.length) {
    const funnel = funnelFromBeats(name, many)
    if (!funnel) return { ok: false, error: "O ManyChat veio sem mensagens." }
    return { ok: true, funnel, source: "manychat" }
  }

  const generic = genericBeats(bag)
  if (generic.length) {
    const funnel = funnelFromBeats(name, generic)
    if (!funnel) return { ok: false, error: "Não achei mensagens neste ficheiro." }
    return { ok: true, funnel, source: "generic" }
  }

  return { ok: false, error: "Não reconheci o formato. Exporta JSON do ManyChat, n8n, Typebot ou um funil Abilion." }
}

export function funnelImportLabel(source: FunnelImportSource) {
  if (source === "abilion") return "Abilion"
  if (source === "manychat") return "ManyChat"
  if (source === "n8n") return "n8n"
  if (source === "typebot") return "Typebot"
  return "Mensagens"
}
