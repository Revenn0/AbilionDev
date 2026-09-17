export const NODE_W = 300
export const NODE_H = 260
export const GAP = 64
export const DROP_GRID = 16

export type LayoutBox = { w: number; h: number }
type Pos = { x: number; y: number }

export function snapPosition(pos: Pos, grid = DROP_GRID): Pos {
  return {
    x: Math.round(pos.x / grid) * grid,
    y: Math.round(pos.y / grid) * grid,
  }
}

export function positionFromPointer(flowPos: Pos): Pos {
  return snapPosition(flowPos)
}

export function dropBoxForKind(kind: string): LayoutBox {
  if (kind === "sales_page" || kind === "whatsapp" || kind === "telegram" || kind === "email" || kind === "delay" || kind === "split") {
    return { w: 400, h: 180 }
  }
  if (kind === "trigger" || kind === "message" || kind === "ask" || kind === "wait") return { w: 260, h: 160 }
  return { w: 200, h: 120 }
}

export function autoLayout<T extends { id: string; position: Pos }>(
  nodes: T[],
  edges: { source: string; target: string }[],
  box: LayoutBox = { w: NODE_W, h: NODE_H }
): T[] {
  if (nodes.length === 0) return nodes
  const ids = new Set(nodes.map((n) => n.id))
  const outgoing = new Map<string, string[]>()
  const indeg = new Map<string, number>()
  nodes.forEach((n) => indeg.set(n.id, 0))
  edges.forEach((e) => {
    if (!ids.has(e.source) || !ids.has(e.target)) return
    outgoing.set(e.source, [...(outgoing.get(e.source) || []), e.target])
    indeg.set(e.target, (indeg.get(e.target) || 0) + 1)
  })

  const layer = new Map<string, number>()
  const queue = nodes.filter((n) => (indeg.get(n.id) || 0) === 0).map((n) => n.id)
  if (queue.length === 0 && nodes[0]) queue.push(nodes[0].id)
  queue.forEach((id) => layer.set(id, 0))

  let guard = 0
  while (queue.length && guard < nodes.length * 4) {
    guard += 1
    const id = queue.shift()!
    const l = layer.get(id) || 0
    for (const t of outgoing.get(id) || []) {
      const next = Math.max(layer.get(t) ?? 0, l + 1)
      if (!layer.has(t) || next > (layer.get(t) || 0)) {
        layer.set(t, next)
        queue.push(t)
      }
    }
  }
  nodes.forEach((n, i) => {
    if (!layer.has(n.id)) layer.set(n.id, i % 3)
  })

  const byLayer = new Map<number, T[]>()
  nodes.forEach((n) => {
    const l = layer.get(n.id) || 0
    byLayer.set(l, [...(byLayer.get(l) || []), n])
  })

  const col = box.w + GAP + 28
  const row = box.h + GAP
  return nodes.map((n) => {
    const l = layer.get(n.id) || 0
    const siblings = byLayer.get(l) || []
    const i = siblings.findIndex((s) => s.id === n.id)
    const y0 = 40 - ((siblings.length - 1) * row) / 2
    return { ...n, position: { x: 40 + l * col, y: Math.max(20, y0 + i * row) } }
  })
}
