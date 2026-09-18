import { Bell, Clock3, GitBranch, GitFork, Handshake, MessageSquare, Play, Tag, Zap } from "lucide-react"
import { MetaGlyph, YouTubeGlyph } from "@/components/canvas/icons"
import { SALES_CATALOG, SALES_GROUPS } from "./catalog"
import type { SalesKind } from "@/lib/types"

function ItemIcon({ id, kind }: { id: string; kind: SalesKind }) {
  if (id === "traffic-yt") return <YouTubeGlyph className="size-5" />
  if (id === "traffic-meta") return <MetaGlyph className="size-5" />
  if (kind === "landing") return <Zap className="size-4 text-sky-500" />
  if (kind === "split") return <GitFork className="size-4 text-violet-600" />
  if (kind === "entry") return <Play className="size-4 text-emerald-600" />
  if (kind === "message") return <MessageSquare className="size-4 text-sky-600" />
  if (kind === "wait") return <Clock3 className="size-4 text-orange-600" />
  if (kind === "condition") return <GitBranch className="size-4 text-violet-500" />
  if (kind === "handoff") return <Handshake className="size-4 text-pink-500" />
  if (kind === "notify") return <Bell className="size-4 text-amber-500" />
  if (kind === "tag") return <Tag className="size-4 text-slate-400" />
  if (kind === "offer") return <Zap className="size-4 text-emerald-500" />
  return <GitFork className="size-4 text-primary" />
}

export function SalesPalette() {
  return (
    <div className="w-[220px] shrink-0 overflow-y-auto border-r border-border bg-card">
      <div className="px-3.5 pt-4 pb-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Construtor</p>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">Mapa visual. A Sté não lê o quadro.</p>
      </div>
      <div className="space-y-4 px-2.5 pb-4">
        {SALES_GROUPS.map((group) => (
          <div key={group.id}>
            <p className="mb-0.5 px-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{group.label}</p>
            <p className="mb-1.5 px-1.5 text-[11px] text-muted-foreground">{group.hint}</p>
            <div className="space-y-1">
              {SALES_CATALOG.filter((item) => item.group === group.id).map((item) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/abilion-sales", JSON.stringify(item))
                    e.dataTransfer.effectAllowed = "copy"
                  }}
                  className="flex cursor-grab items-center gap-2.5 rounded-xl border border-transparent px-2 py-2 hover:border-white/10 hover:bg-white/5 active:cursor-grabbing"
                >
                  <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5">
                    <ItemIcon id={item.id} kind={item.kind} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-foreground">{item.label}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{item.hint}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
