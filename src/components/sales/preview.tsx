import type { SalesFunnel, SalesKind } from "@/lib/types"
import { cn } from "@/lib/utils"

const KIND: Record<SalesKind, { label: string; tone: string }> = {
  traffic: { label: "Tráfego", tone: "bg-slate-500" },
  landing: { label: "Landing", tone: "bg-[#2F6BFF]" },
  split: { label: "Campanha", tone: "bg-violet-600" },
  entry: { label: "Entrada", tone: "bg-emerald-500" },
  message: { label: "Mensagem", tone: "bg-sky-500" },
  wait: { label: "Espera", tone: "bg-orange-400" },
  condition: { label: "Condição", tone: "bg-violet-400" },
  handoff: { label: "Sté", tone: "bg-pink-500" },
  notify: { label: "Ester", tone: "bg-amber-400" },
  tag: { label: "Tag", tone: "bg-slate-400" },
  offer: { label: "Oferta", tone: "bg-emerald-400" },
}

const NODE_W = 140
const NODE_H = 56

export function FunnelPreview({
  funnel,
  className,
}: {
  funnel: Pick<SalesFunnel, "nodes" | "edges">
  className?: string
}) {
  const nodes = funnel.nodes
  if (nodes.length === 0) {
    return (
      <div className={cn("relative grid h-[168px] place-items-center bg-foreground/3", className)}>
        <p className="text-[12px] text-muted-foreground">Em branco</p>
      </div>
    )
  }

  const xs = nodes.map((node) => node.position.x)
  const ys = nodes.map((node) => node.position.y)
  const minX = Math.min(...xs) - 24
  const minY = Math.min(...ys) - 24
  const width = Math.max(Math.max(...xs) - minX + NODE_W + 48, 360)
  const height = Math.max(Math.max(...ys) - minY + NODE_H + 48, 160)
  const byId = new Map(nodes.map((node) => [node.id, node]))

  return (
    <div className={cn("relative h-[168px] overflow-hidden bg-foreground/3", className)}>
      <svg className="absolute inset-0 size-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" aria-hidden>
        {funnel.edges.map((edge) => {
          const from = byId.get(edge.source)
          const to = byId.get(edge.target)
          if (!from || !to) return null
          const x1 = from.position.x - minX + NODE_W
          const y1 = from.position.y - minY + NODE_H / 2
          const x2 = to.position.x - minX
          const y2 = to.position.y - minY + NODE_H / 2
          return (
            <path
              key={edge.id}
              d={`M ${x1} ${y1} C ${x1 + 36} ${y1}, ${x2 - 36} ${y2}, ${x2} ${y2}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-foreground/25"
            />
          )
        })}
      </svg>
      {nodes.map((node) => {
        const meta = KIND[node.type] ?? KIND.traffic
        return (
          <div
            key={node.id}
            className="absolute w-[140px] overflow-hidden rounded-lg border border-border bg-card/95 shadow-sm"
            style={{
              left: `${((node.position.x - minX) / width) * 100}%`,
              top: `${((node.position.y - minY) / height) * 100}%`,
            }}
          >
            <div className={cn("h-1 w-full", meta.tone)} />
            <div className="px-2 py-1.5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{meta.label}</p>
              <p className="truncate text-[11px] font-medium leading-tight">{node.data.title || meta.label}</p>
            </div>
          </div>
        )
      })}
      <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-border bg-card/90 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
        {nodes.length} {nodes.length === 1 ? "bloco" : "blocos"}
      </span>
    </div>
  )
}
