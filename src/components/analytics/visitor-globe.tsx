import { useMemo } from "react"
import { GlobePulse } from "@/components/ui/cobe-globe-pulse"
import { markersFromGeos, mergeGlobeGeos } from "@/lib/analytics-view"
import type { Lead } from "@/lib/types"
import type { TrackGeo } from "@/lib/track"
import { cn } from "@/lib/utils"

export function VisitorGlobe({
  geos,
  leads = [],
  className,
}: {
  geos: Record<string, TrackGeo>
  leads?: Lead[]
  className?: string
}) {
  const merged = useMemo(() => mergeGlobeGeos(geos, leads), [geos, leads])
  const markers = useMemo(() => markersFromGeos(merged), [merged])
  const live = markers.length > 0
  const people = markers.reduce((total, item) => total + item.count, 0)

  return (
    <section className={cn("surface overflow-hidden", className)}>
      <div className="flex items-start justify-between gap-3 px-6 pt-6">
        <div>
          <p className="text-[12.5px] text-muted-foreground">Onde estão</p>
          <p className="mt-2 text-[22px] font-medium tracking-[-0.03em]">Visitantes no mapa</p>
        </div>
        <p className="text-right text-[12px] text-muted-foreground">
          {live ? `${people} ${people === 1 ? "visitante" : "visitantes"} · ${markers.length} ${markers.length === 1 ? "lugar" : "lugares"}` : "Sem geo ainda"}
          <span className="mt-1 block">Arrasta para girar</span>
        </p>
      </div>
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(240px,0.85fr)]">
        <div className="bg-black px-4 py-6 sm:px-8">
          <div className="mx-auto w-full max-w-[520px]">
            <GlobePulse markers={markers} />
          </div>
        </div>
        <div className="border-t border-border px-6 py-5 lg:border-t-0 lg:border-l">
          {live ? (
            <ul className="space-y-3 text-[13px]">
              {markers.slice(0, 10).map((item, index) => (
                <li key={item.id} className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <i className="grid size-5 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-medium">
                      {index + 1}
                    </i>
                    <span className="truncate font-medium">{item.label}</span>
                  </span>
                  <span className="tabular-nums text-muted-foreground">{item.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              O pixel ainda não gravou país ou UF. Quando a visita chegar, o ponto e o nome do estado aparecem em cima do
              globo.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
