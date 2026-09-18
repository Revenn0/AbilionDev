import { useMemo } from "react"
import { GlobePulse } from "@/components/ui/cobe-globe-pulse"
import { FALLBACK_MARKERS, markersFromGeos } from "@/lib/analytics-view"
import type { TrackGeo } from "@/lib/track"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"

export function VisitorGlobe({
  geos,
  className,
}: {
  geos: Record<string, TrackGeo>
  className?: string
}) {
  const { resolvedTheme } = useTheme()
  const markers = useMemo(() => {
    const live = markersFromGeos(geos)
    return live.length ? live : FALLBACK_MARKERS
  }, [geos])
  const live = Object.keys(geos).length > 0

  return (
    <section className={cn("surface flex min-h-[420px] flex-col overflow-hidden p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12.5px] text-muted-foreground">Visitor map</p>
          <h2 className="mt-1 text-[18px] font-medium tracking-tight">Globo ao vivo</h2>
        </div>
        <p className="text-right text-[11.5px] text-muted-foreground">
          {live ? `${markers.length} pontos` : "Sem geo ainda"}
          <span className="mt-1 block">Arrasta para girar</span>
        </p>
      </div>
      <div className="mx-auto mt-2 w-full max-w-[360px]">
        <GlobePulse markers={markers} dark={resolvedTheme === "light" ? 0 : 1} />
      </div>
      <ul className="mt-2 space-y-1.5 text-[12.5px]">
        {markers.slice(0, 5).map((item, index) => (
          <li key={item.id} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-muted-foreground">
              <i className="grid size-5 place-items-center rounded-full bg-muted text-[10px] font-medium text-foreground">
                {index + 1}
              </i>
              {item.label}
            </span>
            <span className="tabular-nums">{item.count || "—"}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
