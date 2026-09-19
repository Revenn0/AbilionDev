import type { TrackPoint } from "@/lib/track"
import { cn } from "@/lib/utils"

export function AreaChart({ series, className }: { series: TrackPoint[]; className?: string }) {
  const width = 920
  const height = 220
  const pad = { top: 16, right: 8, bottom: 26, left: 4 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const max = Math.max(...series.flatMap((item) => [item.views, item.clicks, item.telegrams]), 1)
  const x = (index: number) => pad.left + (index / Math.max(series.length - 1, 1)) * innerW
  const y = (value: number) => pad.top + innerH - (value / max) * innerH
  const toPath = (key: keyof Pick<TrackPoint, "views" | "clicks" | "telegrams">) =>
    series.map((item, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(item[key])}`).join(" ")
  const area = `${toPath("views")} L${x(series.length - 1)},${y(0)} L${x(0)},${y(0)} Z`
  const ticks = series.filter((_, index) => index === 0 || index === series.length - 1 || index % 7 === 0)

  return (
    <div className={cn("relative", className)}>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[220px] w-full" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="views-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--line)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--line)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((slot) => (
          <line
            key={slot}
            x1={pad.left}
            x2={width - pad.right}
            y1={pad.top + innerH * slot}
            y2={pad.top + innerH * slot}
            className="stroke-foreground/6"
            strokeWidth="1"
          />
        ))}
        <path d={area} fill="url(#views-fill)" />
        <path d={toPath("views")} fill="none" stroke="var(--line)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <path d={toPath("clicks")} fill="none" stroke="currentColor" strokeOpacity="0.38" strokeWidth="1.7" strokeLinejoin="round" />
        <path d={toPath("telegrams")} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1.7" strokeLinejoin="round" />
        {ticks.map((item) => {
          const index = series.indexOf(item)
          return (
            <text key={item.day} x={x(index)} y={height - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">
              {item.day.slice(5)}
            </text>
          )
        })}
      </svg>
      <div className="mt-1 flex flex-wrap gap-4 px-1 text-[12px] text-muted-foreground">
        <Legend color="bg-line" label="Page views" />
        <Legend color="bg-foreground/40" label="Clique no botão" />
        <Legend color="bg-foreground/20" label="/start" />
      </div>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <i className={cn("size-1.5 rounded-full", color)} />
      {label}
    </span>
  )
}
