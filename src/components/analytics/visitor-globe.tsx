import { useMemo } from "react"
import { GlobePulse } from "@/components/ui/cobe-globe-pulse"
import { StudioPanel } from "@/components/layout/studio"
import { markersFromGeos, mergeGlobeGeos, pixelMapEmpty, pixelMapHint } from "@/lib/analytics-view"
import type { Lead } from "@/lib/types"
import type { TrackGeo } from "@/lib/track"
import { cn } from "@/lib/utils"

export function VisitorGlobe({
  geos,
  leads = [],
  className,
  status = "ok",
  hasData = true,
}: {
  geos: Record<string, TrackGeo>
  leads?: Lead[]
  className?: string
  status?: "loading" | "ok" | "error"
  hasData?: boolean
}) {
  const merged = useMemo(() => mergeGlobeGeos(geos, leads), [geos, leads])
  const markers = useMemo(() => markersFromGeos(merged), [merged])
  const live = markers.length > 0
  const people = markers.reduce((total, item) => total + item.count, 0)
  const emptyCopy = pixelMapEmpty(status, hasData)

  return (
    <StudioPanel
      className={className}
      eyebrow="Onde estão"
      title="Visitantes no mapa"
      hint={pixelMapHint(status, hasData || live, live, people, markers.length)}
      bodyClassName="grid gap-0 p-0 pt-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,280px)]"
    >
      <div className="grid place-items-center bg-muted/50 px-2 py-3 sm:px-4 sm:py-4">
        <div className="aspect-square w-full max-w-[420px]">
          <GlobePulse markers={markers} />
        </div>
      </div>
      <div className={cn("border-t border-border px-5 py-5 lg:border-t-0 lg:border-l")}>
        {live ? (
          <ul className="space-y-3 text-[13px]">
            {markers.slice(0, 10).map((item, index) => (
              <li key={item.id} className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <i className="grid size-5 shrink-0 place-items-center rounded-full border border-border bg-muted text-[10px] font-medium">
                    {index + 1}
                  </i>
                  <span className="truncate font-medium">{item.label}</span>
                </span>
                <span className="tabular-nums text-muted-foreground">{item.count}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p
            className="text-[13px] leading-relaxed text-muted-foreground"
            role={!hasData && status === "error" ? "alert" : status === "loading" && !hasData ? "status" : undefined}
            data-pixel-map={!hasData && status === "error" ? "error" : status === "loading" && !hasData ? "loading" : live ? "ok" : "empty"}
          >
            {emptyCopy}
          </p>
        )}
      </div>
    </StudioPanel>
  )
}
