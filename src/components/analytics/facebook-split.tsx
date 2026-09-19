import { MousePointerClick, PanelsTopLeft, Megaphone } from "lucide-react"
import { formatDelta } from "@/lib/analytics-view"
import { facebookOf, type TrackSummary } from "@/lib/track"
import { cn } from "@/lib/utils"

export function FacebookSplit({
  summary,
  deltas,
}: {
  summary: TrackSummary
  deltas?: { ads?: number; views?: number; clicks?: number }
}) {
  const facebook = facebookOf(summary)
  const rows = [
    {
      id: "ads",
      label: "Clique no anúncio",
      value: facebook.adClicks,
      hint: "chegaram na landing pelo Facebook",
      icon: Megaphone,
      delta: deltas?.ads,
    },
    {
      id: "views",
      label: "Page views",
      value: facebook.pageViews,
      hint: "aberturas da landing deste tráfego",
      icon: PanelsTopLeft,
      delta: deltas?.views,
    },
    {
      id: "clicks",
      label: "Clique no Telegram",
      value: facebook.buttonClicks,
      hint: "tocaram no botão da página",
      icon: MousePointerClick,
      delta: deltas?.clicks,
    },
  ] as const

  return (
    <section className="surface p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12.5px] text-muted-foreground">Facebook</p>
          <p className="mt-2 text-[22px] font-medium tracking-[-0.03em]">Anúncio, página e botão à parte</p>
        </div>
        <p className="max-w-sm text-right text-[12px] text-muted-foreground">
          Não soma /start nem chat. Cada coluna é um evento diferente.
        </p>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {rows.map((row) => {
          const Icon = row.icon
          return (
            <article key={row.id} className="rounded-[18px] bg-muted/60 px-4 py-4">
              <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                <Icon className="size-3.5" strokeWidth={1.75} />
                {row.label}
              </p>
              <p className="mt-3 text-[32px] font-medium tracking-[-0.04em] tabular-nums">{row.value}</p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                <span>{row.hint}</span>
                {row.delta !== undefined ? (
                  <span className={cn("tabular-nums", row.delta >= 0 ? "text-success" : "text-destructive")}>
                    {formatDelta(row.delta)}
                  </span>
                ) : null}
              </p>
            </article>
          )
        })}
      </div>
    </section>
  )
}
