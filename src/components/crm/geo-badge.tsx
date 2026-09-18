import { formatGeo } from "@/lib/geo"
import type { LeadFacts } from "@/lib/types"
import { cn } from "@/lib/utils"

export function GeoBadge({
  facts,
  className,
  empty = "Sem estado",
}: {
  facts?: LeadFacts | null
  className?: string
  empty?: string
}) {
  const label = formatGeo(facts)
  if (!label) return <span className={cn("text-muted-foreground", className)}>{empty}</span>
  return (
    <span className={cn("inline-flex items-center gap-1 tabular-nums", className)} title={label}>
      {label}
    </span>
  )
}
