import { cn } from "@/lib/utils"
import { formatDelta } from "@/lib/analytics-view"

export function KpiCard({
  label,
  value,
  hint,
  live,
  delta,
  spark,
  tone = "neutral",
}: {
  label: string
  value: string | number
  hint: string
  live?: boolean
  delta?: number
  spark?: number[]
  tone?: "neutral" | "green" | "blue" | "rose"
}) {
  const stroke = tone === "green" ? "#22c55e" : tone === "blue" ? "#5b8cff" : tone === "rose" ? "#fb7185" : "currentColor"
  return (
    <div className="bg-card px-5 py-4">
      <Sparkline values={spark ?? []} stroke={stroke} />
      <p className="mt-3 flex items-center gap-1.5 text-[12px] text-muted-foreground">
        {label}
        {live && <i className="size-1.5 rounded-full bg-emerald-400" />}
      </p>
      <p className="mt-2 text-[28px] font-medium tracking-[-0.05em] tabular-nums">{value}</p>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-[11.5px] text-muted-foreground">
        <span>{hint}</span>
        {delta !== undefined && (
          <span className={cn("tabular-nums", delta >= 0 ? "text-emerald-500" : "text-rose-400")}>{formatDelta(delta)}</span>
        )}
      </p>
    </div>
  )
}

function Sparkline({ values, stroke }: { values: number[]; stroke: string }) {
  if (values.length < 2) return <div className="h-8" />
  const width = 220
  const height = 32
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const span = Math.max(max - min, 1)
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width
    const y = height - 3 - ((value - min) / span) * (height - 6)
    return `${x},${y}`
  })
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-8 w-full text-foreground/50" preserveAspectRatio="none" aria-hidden>
      <polyline points={points.join(" ")} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
