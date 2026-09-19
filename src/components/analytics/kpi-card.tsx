import { SparkBars } from "@/components/ui/spark"
import { formatDelta } from "@/lib/analytics-view"
import { cn } from "@/lib/utils"

export function KpiCard({
  label,
  value,
  hint,
  live,
  delta,
  spark,
}: {
  label: string
  value: string | number
  hint: string
  live?: boolean
  delta?: number
  spark?: number[]
}) {
  return (
    <article className="surface px-5 py-4">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <span className="size-1.5 rounded-full bg-slate-300" />
        {label}
        {live ? <i className="size-1.5 rounded-full bg-success" /> : null}
      </p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[26px] font-medium tracking-[-0.04em] tabular-nums">{value}</p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
            <span>{hint}</span>
            {delta !== undefined ? (
              <span className={cn("tabular-nums", delta >= 0 ? "text-success" : "text-destructive")}>{formatDelta(delta)}</span>
            ) : null}
          </p>
        </div>
        <SparkBars values={spark ?? []} />
      </div>
    </article>
  )
}
