import { MousePointerClick, PanelsTopLeft, Megaphone } from "lucide-react"
import { StudioMetric, StudioPanel } from "@/components/layout/studio"
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
      title: "Clique no anúncio",
      value: facebook.adClicks,
      hint: "Chegaram na landing pelo Facebook.",
      tone: "blue" as const,
      icon: Megaphone,
      delta: deltas?.ads,
    },
    {
      id: "views",
      title: "Page views",
      value: facebook.pageViews,
      hint: "Aberturas da landing deste tráfego.",
      tone: "sky" as const,
      icon: PanelsTopLeft,
      delta: deltas?.views,
    },
    {
      id: "clicks",
      title: "Clique no Telegram",
      value: facebook.buttonClicks,
      hint: "Tocaram no botão da página.",
      tone: "pink" as const,
      icon: MousePointerClick,
      delta: deltas?.clicks,
    },
  ]

  return (
    <StudioPanel
      eyebrow="Facebook"
      title="Anúncio, página e botão à parte"
      hint="Não soma /start nem chat. Cada cartão é um evento diferente."
    >
      <div className="grid gap-4 md:grid-cols-3">
        {rows.map((row) => {
          const Icon = row.icon
          return (
            <StudioMetric
              key={row.id}
              title={row.title}
              tone={row.tone}
              value={row.value}
              hint={row.hint}
              footer={
                <p className="mt-3 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Icon className="size-3.5" strokeWidth={1.75} />
                    Evento
                  </span>
                  {row.delta !== undefined ? (
                    <span className={cn("tabular-nums", row.delta >= 0 ? "text-success" : "text-destructive")}>
                      {formatDelta(row.delta)}
                    </span>
                  ) : null}
                </p>
              }
            />
          )
        })}
      </div>
    </StudioPanel>
  )
}
