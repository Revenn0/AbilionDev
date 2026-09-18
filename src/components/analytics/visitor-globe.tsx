import { useMemo } from "react"
import { GlobePulse } from "@/components/ui/cobe-globe-pulse"
import { markersFromGeos } from "@/lib/analytics-view"
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
  const markers = useMemo(() => markersFromGeos(geos), [geos])
  const live = markers.length > 0

  return (
    <section className={cn("surface flex min-h-[420px] flex-col p-6", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12.5px] text-muted-foreground">Mapa de visitantes</p>
          <p className="mt-2 text-[22px] font-medium tracking-[-0.03em]">Globo</p>
        </div>
        <p className="text-right text-[12px] text-muted-foreground">
          {live ? `${markers.length} ${markers.length === 1 ? "ponto" : "pontos"}` : "Sem geo ainda"}
          <span className="mt-1 block">Arrasta para girar</span>
        </p>
      </div>
      <div className="mx-auto mt-4 w-full max-w-[280px]">
        <GlobePulse markers={markers} dark={resolvedTheme === "light" ? 0 : 1} />
      </div>
      {live ? (
        <ul className="mt-4 space-y-3 text-[13px]">
          {markers.slice(0, 5).map((item, index) => (
            <li key={item.id} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                <i className="grid size-5 place-items-center rounded-full bg-muted text-[10px] font-medium text-foreground">
                  {index + 1}
                </i>
                <span className="truncate">{item.label}</span>
              </span>
              <span className="tabular-nums">{item.count}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-[13px] text-muted-foreground">O pixel ainda não gravou país ou UF. O globo gira vazio até a primeira visita com geo.</p>
      )}
    </section>
  )
}
