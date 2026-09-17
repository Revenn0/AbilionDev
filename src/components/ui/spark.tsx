import { cn } from "@/lib/utils"

export function SparkBars({ values, className }: { values: number[]; className?: string }) {
  const max = Math.max(...values, 1)
  return (
    <div className={cn("flex h-7 items-end gap-px", className)} aria-hidden>
      {values.map((value, index) => (
        <div
          key={index}
          className="w-[3px] rounded-[1px] bg-foreground/35"
          style={{ height: `${Math.max(22, (value / max) * 100)}%` }}
        />
      ))}
    </div>
  )
}

export function TrendLine({
  values,
  className,
  height = 200,
}: {
  values: number[]
  className?: string
  height?: number
}) {
  const width = 720
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const span = Math.max(max - min, 1)
  const coords = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * width
    const y = height - ((value - min) / span) * (height - 16) - 8
    return `${x},${y}`
  })
  const line = coords.join(" ")
  const last = values[values.length - 1] ?? 0
  const lastX = width
  const lastY = height - ((last - min) / span) * (height - 16) - 8

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={cn("h-full w-full", className)} preserveAspectRatio="none" aria-hidden>
      {[0.25, 0.5, 0.75].map((slot) => (
        <line
          key={slot}
          x1="0"
          x2={width}
          y1={height * slot}
          y2={height * slot}
          className="stroke-foreground/6"
          strokeWidth="1"
        />
      ))}
      <polyline points={line} fill="none" stroke="var(--line)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r="3.5" fill="var(--line)" />
    </svg>
  )
}
