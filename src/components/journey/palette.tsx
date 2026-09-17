import { Plus } from "lucide-react"
import { KindGlyph } from "@/components/canvas/icons"
import { JOURNEY_CATALOG, type JourneyCatalogItem } from "./catalog"

export function JourneyPalette({ onAdd }: { onAdd?: (item: JourneyCatalogItem) => void }) {
  return (
    <div className="w-[200px] shrink-0 overflow-y-auto border-r border-border bg-card">
      <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Blocos</p>
      </div>
      <div className="px-1.5 pb-3 space-y-0.5">
        {JOURNEY_CATALOG.map((item) => (
          <button
            key={item.id}
            type="button"
            draggable
            onClick={() => onAdd?.(item)}
            onDragStart={(e) => {
              e.dataTransfer.setData("application/abilion-node", JSON.stringify(item))
              e.dataTransfer.effectAllowed = "copy"
            }}
            className="flex w-full cursor-grab items-center gap-2 rounded-[8px] border border-transparent px-2 py-1.5 text-left hover:bg-[var(--raise)] active:cursor-grabbing"
          >
            <div className="flow-node-ic bg-[rgb(255_255_255/0.08)]">
              <KindGlyph kind={item.kind} className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium truncate leading-tight">{item.label}</p>
            </div>
            <Plus className="size-3.5 shrink-0 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  )
}
