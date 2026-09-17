import { Handle, Position, type Node, type NodeProps } from "@xyflow/react"
import { KindGlyph } from "@/components/canvas/icons"
import type { JourneyKind, JourneyNodeData } from "@/lib/types"
import { cn } from "@/lib/utils"

export type JourneyCanvasNode = Node<JourneyNodeData, JourneyKind>

export function JourneyBlock({ data, selected, type }: NodeProps<JourneyCanvasNode>) {
  const kind = (type || "message") as JourneyKind
  return (
    <div className={cn("flow-node w-[260px]", selected && "ring-2 ring-primary/30 border-primary")}>
      <div className="flex items-center gap-2 px-3 pt-3">
        <div className="flow-node-ic bg-[rgb(255_255_255/0.08)]">
          <KindGlyph kind={kind} />
        </div>
        <p className="text-[14px] font-semibold truncate">{data.label}</p>
      </div>
      <p className="px-3 pb-3 pt-2 text-[13px] leading-relaxed text-muted-foreground line-clamp-3">
        {data.template || data.buttons || (data.delayValue ? `Espera ${data.delayValue} ${data.delayUnit}` : "Sem texto")}
      </p>
      <Handle type="target" position={Position.Left} className="!size-3 !border-2 !border-[#16181d] !bg-slate-400" />
      <Handle type="source" position={Position.Right} className="!size-3 !border-2 !border-[#16181d] !bg-primary" />
    </div>
  )
}

export const journeyNodeTypes = {
  trigger: JourneyBlock,
  message: JourneyBlock,
  ask: JourneyBlock,
  wait: JourneyBlock,
  condition: JourneyBlock,
  action: JourneyBlock,
  whatsapp: JourneyBlock,
  telegram: JourneyBlock,
}
