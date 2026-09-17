import type { Journey } from "@/lib/types"
import { cn } from "@/lib/utils"

export function JourneyPreview({
  journey,
  className,
}: {
  journey: Pick<Journey, "nodes" | "edges">
  className?: string
}) {
  if (journey.nodes.length === 0) {
    return (
      <div className={cn("relative h-[148px] canvas-grid rounded-t-2xl grid place-items-center", className)}>
        <p className="text-[12px] text-muted-foreground">Em branco</p>
      </div>
    )
  }

  return (
    <div className={cn("relative h-[148px] canvas-grid rounded-t-2xl overflow-hidden p-4", className)}>
      <div className="flex h-full items-center gap-3 overflow-hidden">
        {journey.nodes.slice(0, 5).map((node, index) => (
          <div key={node.id} className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-primary/15 ring-1 ring-white/10" />
            {index < Math.min(journey.nodes.length, 5) - 1 && <div className="h-px w-8 bg-[#2F6BFF]" />}
          </div>
        ))}
      </div>
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-card/90 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
        {journey.nodes.length} blocos
      </div>
    </div>
  )
}
