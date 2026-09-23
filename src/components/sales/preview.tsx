import type { SalesFunnel, SalesKind } from "@/lib/types"
import { cn } from "@/lib/utils"

const KIND: Record<SalesKind, { label: string; pill: string; stroke: string }> = {
  traffic: { label: "Tráfego", pill: "#dbeafe", stroke: "#bfdbfe" },
  landing: { label: "Landing", pill: "#dbeafe", stroke: "#bfdbfe" },
  split: { label: "Campanha", pill: "#ede9fe", stroke: "#ddd6fe" },
  entry: { label: "Entrada", pill: "#d1fae5", stroke: "#a7f3d0" },
  message: { label: "Mensagem", pill: "#e0f2fe", stroke: "#bae6fd" },
  wait: { label: "Espera", pill: "#ffedd5", stroke: "#fed7aa" },
  condition: { label: "Condição", pill: "#ede9fe", stroke: "#ddd6fe" },
  handoff: { label: "Sté", pill: "#fce7f3", stroke: "#fbcfe8" },
  notify: { label: "Ester", pill: "#fef3c7", stroke: "#fde68a" },
  tag: { label: "Tag", pill: "#f1f5f9", stroke: "#e2e8f0" },
  offer: { label: "Oferta", pill: "#d1fae5", stroke: "#a7f3d0" },
  bot: { label: "Bot / IA", pill: "#ede9fe", stroke: "#ddd6fe" },
  human: { label: "Humano", pill: "#fce7f3", stroke: "#fbcfe8" },
  approve: { label: "Aprovar", pill: "#d1fae5", stroke: "#a7f3d0" },
  audio: { label: "Áudio", pill: "#ffedd5", stroke: "#fed7aa" },
  webhook: { label: "Webhook", pill: "#f1f5f9", stroke: "#e2e8f0" },
  talk: { label: "Início", pill: "#d1fae5", stroke: "#a7f3d0" },
  file: { label: "Arquivo", pill: "#e0f2fe", stroke: "#bae6fd" },
  intake: { label: "Leitura", pill: "#ede9fe", stroke: "#ddd6fe" },
}

const NODE_W = 168
const NODE_H = 70

export function FunnelPreview({
  funnel,
  className,
}: {
  funnel: Pick<SalesFunnel, "nodes" | "edges">
  className?: string
}) {
  const all = funnel.nodes
  const ranked = [...all].sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y)
  const picked = [
    all.find((node) => node.type === "traffic"),
    all.find((node) => node.type === "landing"),
    all.find((node) => node.type === "entry" && node.data.entryTrigger === "start") || all.find((node) => node.type === "entry"),
    all.find((node) => node.type === "message"),
  ].filter((node): node is (typeof all)[number] => Boolean(node))
  const nodes = picked.length >= 2 ? picked : ranked.slice(0, 4)
  if (all.length === 0) {
    return (
      <div className={cn("relative grid h-[188px] place-items-center bg-muted/50", className)}>
        <p className="text-[12px] text-muted-foreground">Em branco</p>
      </div>
    )
  }

  const laid = nodes.map((node, index) => ({
    ...node,
    position: { x: 24 + index * (NODE_W + 52), y: 28 },
  }))
  const minX = 0
  const minY = 0
  const width = Math.max(laid.length * (NODE_W + 52) + 24, 420)
  const height = NODE_H + 80
  const byId = new Map(laid.map((node) => [node.id, node]))

  return (
    <div className={cn("relative h-[188px] overflow-hidden bg-muted/40", className)}>
      <svg className="size-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" aria-hidden>
        {funnel.edges.map((edge) => {
          if (!nodes.some((node) => node.id === edge.source) || !nodes.some((node) => node.id === edge.target)) return null
          const from = byId.get(edge.source)
          const to = byId.get(edge.target)
          if (!from || !to) return null
          const x1 = from.position.x - minX + NODE_W
          const y1 = from.position.y - minY + 14
          const x2 = to.position.x - minX
          const y2 = to.position.y - minY + 14
          return (
            <path
              key={edge.id}
              d={`M ${x1} ${y1} C ${x1 + 48} ${y1}, ${x2 - 48} ${y2}, ${x2} ${y2}`}
              fill="none"
              stroke="#93c5fd"
              strokeWidth="2"
            />
          )
        })}
        {laid.map((node) => {
          const meta = KIND[node.type] ?? KIND.traffic
          const x = node.position.x - minX
          const y = node.position.y - minY
          const title = node.data.title || meta.label
          return (
            <g key={node.id} transform={`translate(${x} ${y})`}>
              <rect x="18" y="0" width={NODE_W - 36} height="28" rx="14" fill={meta.pill} stroke={meta.stroke} />
              <rect x="0" y="16" width={NODE_W} height="48" rx="16" fill="#ffffff" stroke={meta.stroke} />
              <rect x="18" y="0" width={NODE_W - 36} height="28" rx="14" fill={meta.pill} stroke={meta.stroke} />
              <text x={NODE_W / 2} y="18" textAnchor="middle" fill="#334155" fontSize="11" fontWeight="500">
                {title.length > 18 ? `${title.slice(0, 17)}…` : title}
              </text>
              <text x={NODE_W / 2} y="46" textAnchor="middle" fill="#94a3b8" fontSize="10">
                {meta.label}
              </text>
            </g>
          )
        })}
      </svg>
      <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-border bg-card/90 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
        {all.length} {all.length === 1 ? "bloco" : "blocos"}
      </span>
    </div>
  )
}
