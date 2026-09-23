import { useMemo, useState } from "react"
import { Bell, ChevronDown, Clock3, FileSearch, FileUp, GitBranch, GitFork, Handshake, MessageSquare, MessagesSquare, Play, Search, Sparkles, Tag, Zap } from "lucide-react"
import { MetaGlyph, YouTubeGlyph } from "@/components/canvas/icons"
import { SALES_CATALOG, SALES_GROUPS, type SalesCatalogItem } from "./catalog"
import type { SalesKind } from "@/lib/types"
import { cn } from "@/lib/utils"

function ItemIcon({ id, kind }: { id: string; kind: SalesKind }) {
  if (id === "traffic-yt") return <YouTubeGlyph className="size-4" />
  if (id === "traffic-meta") return <MetaGlyph className="size-4" />
  if (kind === "landing") return <Zap className="size-3.5 text-sky-500" />
  if (kind === "split") return <GitFork className="size-3.5 text-violet-500" />
  if (kind === "entry") return <Play className="size-3.5 text-emerald-500" />
  if (kind === "message") return <MessageSquare className="size-3.5 text-sky-500" />
  if (kind === "talk") return <MessagesSquare className="size-3.5 text-emerald-500" />
  if (id === "ai-started") return <Sparkles className="size-3.5 text-violet-500" />
  if (kind === "file") return <FileUp className="size-3.5 text-sky-500" />
  if (kind === "intake") return <FileSearch className="size-3.5 text-violet-500" />
  if (kind === "wait") return <Clock3 className="size-3.5 text-orange-500" />
  if (kind === "condition") return <GitBranch className="size-3.5 text-violet-500" />
  if (kind === "handoff") return <Handshake className="size-3.5 text-pink-500" />
  if (kind === "notify") return <Bell className="size-3.5 text-amber-500" />
  if (kind === "tag") return <Tag className="size-3.5 text-slate-400" />
  if (kind === "offer") return <Zap className="size-3.5 text-emerald-500" />
  return <GitFork className="size-3.5 text-sky-500" />
}

export function SalesPalette({
  className,
  onAdd,
}: {
  className?: string
  onAdd?: (item: SalesCatalogItem) => void
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState<Record<string, boolean>>({ map: true, flow: true })
  const needle = query.trim().toLowerCase()
  const groups = useMemo(
    () =>
      SALES_GROUPS.map((group) => ({
        ...group,
        items: SALES_CATALOG.filter((item) => item.group === group.id).filter((item) => {
          if (!needle) return true
          return [item.label, item.hint, item.kind].some((value) => value.toLowerCase().includes(needle))
        }),
      })).filter((group) => group.items.length),
    [needle]
  )

  return (
    <aside className={cn("flex w-[240px] shrink-0 flex-col border-r border-slate-200 bg-white", className)}>
      <div className="border-b border-slate-100 px-3.5 py-3">
        <p className="text-[13px] font-medium text-slate-800">Componentes</p>
        <label className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-[#fbfcfd] px-2.5 py-1.5">
          <Search className="size-3.5 text-slate-400" />
          <span className="sr-only">Buscar bloco</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar bloco"
            className="w-full bg-transparent text-[12.5px] text-slate-700 outline-none placeholder:text-slate-400"
          />
        </label>
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 py-2">
        {groups.map((group) => (
          <div key={group.id}>
            <button
              type="button"
              onClick={() => setOpen((current) => ({ ...current, [group.id]: !current[group.id] }))}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400"
            >
              {group.label}
              <ChevronDown className={cn("size-3.5 transition-transform", open[group.id] === false && "-rotate-90")} />
            </button>
            {open[group.id] !== false && (
              <div className="space-y-0.5 pb-2">
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    draggable
                    aria-label={`Adicionar ${item.label}`}
                    onClick={() => onAdd?.(item)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        onAdd?.(item)
                      }
                    }}
                    onDragStart={(event) => {
                      event.dataTransfer.setData("application/abilion-sales", JSON.stringify(item))
                      event.dataTransfer.effectAllowed = "copy"
                    }}
                    className="flex cursor-grab items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 active:cursor-grabbing"
                  >
                    <div className="grid size-7 shrink-0 place-items-center rounded-md border border-slate-200 bg-white">
                      <ItemIcon id={item.id} kind={item.kind} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-medium text-slate-800">{item.label}</p>
                      <p className="truncate text-[11px] text-slate-400">{item.hint}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {groups.length === 0 && <p className="px-2 py-6 text-center text-[12px] text-slate-400">Nenhum bloco com esse nome.</p>}
      </div>
    </aside>
  )
}
