import { initials } from "@/lib/format"
import type { TrackPoint, TrackRecent } from "@/lib/track"
import { cn } from "@/lib/utils"

export function ComboChart({
  series,
  recent,
  className,
}: {
  series: TrackPoint[]
  recent: TrackRecent[]
  className?: string
}) {
  const width = 920
  const height = 280
  const max = Math.max(...series.flatMap((item) => [item.views, item.telegrams]), 1)
  const barW = width / Math.max(series.length, 1)
  const line = series
    .map((item, index) => {
      const x = index * barW + barW / 2
      const y = height - 28 - (item.telegrams / max) * (height - 48)
      return `${x},${y}`
    })
    .join(" ")

  return (
    <div className={cn("relative", className)}>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[280px] w-full" preserveAspectRatio="none" aria-hidden>
        {[0.25, 0.5, 0.75].map((slot) => (
          <line
            key={slot}
            x1="0"
            x2={width}
            y1={height * slot}
            y2={height * slot}
            className="stroke-foreground/8"
            strokeWidth="1"
          />
        ))}
        {series.map((item, index) => {
          const h = (item.views / max) * (height - 48)
          return (
            <rect
              key={item.day}
              x={index * barW + barW * 0.28}
              y={height - 20 - h}
              width={barW * 0.36}
              height={Math.max(h, item.views ? 2 : 0)}
              rx="3"
              className="fill-rose-400/80"
            />
          )
        })}
        <polyline points={line} fill="none" stroke="rgb(147 197 253)" strokeWidth="2.4" strokeLinejoin="round" />
      </svg>
      <div className="pointer-events-none absolute inset-x-2 top-6 flex justify-around">
        {recent.slice(0, 10).map((item) => (
          <span
            key={`${item.visitorId}-${item.at}`}
            className="grid size-7 place-items-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground ring-2 ring-background"
          >
            {initials(item.name || item.country || item.visitorId)}
          </span>
        ))}
      </div>
    </div>
  )
}
