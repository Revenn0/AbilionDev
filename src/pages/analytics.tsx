import { ChartNoAxesCombined } from "lucide-react"
import { AreaChart } from "@/components/analytics/area-chart"
import { FunnelFlow } from "@/components/analytics/funnel-flow"
import { KpiCard } from "@/components/analytics/kpi-card"
import { RankList } from "@/components/analytics/rank-list"
import { VisitorGlobe } from "@/components/analytics/visitor-globe"
import { PageChrome, StatusPill } from "@/components/layout/chrome"
import { funnelFrom, periodDelta, splitSeries } from "@/lib/analytics-view"
import { useStore } from "@/lib/store"
import { formatPercent, formatSession } from "@/lib/track"
import { useTrackSummary } from "@/lib/use-track-summary"

export function AnalyticsPage() {
  const { state } = useStore()
  const { summary, status } = useTrackSummary(4000)
  const empty = summary.visitors === 0 && summary.clicks === 0 && summary.telegrams === 0 && state.leads.length === 0
  const periods = splitSeries(summary.series)
  const funnel = funnelFrom(summary, state.leads)
  const viewSpark = summary.series.map((item) => item.views)
  const clickSpark = summary.series.map((item) => item.clicks)
  const telegramSpark = summary.series.map((item) => item.telegrams)

  return (
    <div className="h-full overflow-y-auto">
      <div className="page-shell">
        <PageChrome icon={ChartNoAxesCombined} title="Analytics">
          <StatusPill tone={status === "ok" ? "success" : status === "error" ? "danger" : "muted"}>
            {status === "ok" ? "Ao vivo · 30 dias" : status === "error" ? "Sem leitura" : "A carregar"}
          </StatusPill>
        </PageChrome>

        <section className="surface overflow-hidden">
          <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Live"
              value={summary.online}
              hint="activos nos últimos 2 min"
              live
              spark={viewSpark.slice(-12)}
              tone="green"
            />
            <KpiCard
              label="Visitantes"
              value={summary.visitors}
              hint="viram a landing"
              delta={periodDelta(periods.views.current, periods.views.previous)}
              spark={viewSpark}
              tone="green"
            />
            <KpiCard
              label="Visualizações"
              value={summary.views}
              hint="pageviews do pixel"
              delta={periodDelta(periods.views.current, periods.views.previous)}
              spark={viewSpark}
              tone="blue"
            />
            <KpiCard
              label="Bounce"
              value={formatPercent(summary.bounce)}
              hint="viu e não clicou"
              spark={clickSpark}
              tone="rose"
            />
          </div>
          <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-3">
            <KpiCard
              label="Cliques"
              value={summary.clicks}
              hint="botão Telegram"
              delta={periodDelta(periods.clicks.current, periods.clicks.previous)}
              spark={clickSpark}
              tone="blue"
            />
            <KpiCard
              label="Telegram"
              value={summary.telegrams}
              hint="/start fechado"
              delta={periodDelta(periods.telegrams.current, periods.telegrams.previous)}
              spark={telegramSpark}
              tone="rose"
            />
            <KpiCard label="Sessão" value={formatSession(summary.sessionMs)} hint="tempo médio na página" spark={viewSpark} />
          </div>
        </section>

        <FunnelFlow steps={funnel} />

        <section className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
          <section className="surface overflow-hidden p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[12.5px] text-muted-foreground">Pageviews</p>
                <p className="mt-1 text-[28px] font-medium tracking-[-0.04em] tabular-nums">{summary.views}</p>
              </div>
              <p className="text-[12px] text-muted-foreground">Landing, clique e /start · 30 dias</p>
            </div>
            {empty ? (
              <p className="px-2 py-16 text-center text-[13px] text-muted-foreground">
                Sem visitas ainda. Abre /l ou cola o pixel. O funil só conta Ads → landing → Telegram → chat.
              </p>
            ) : (
              <AreaChart series={summary.series} className="mt-4" />
            )}
          </section>
          <VisitorGlobe geos={summary.geos} />
        </section>

        <section className="grid gap-3 lg:grid-cols-2">
          <RankList title="Campanha / origem" rows={summary.referrers} empty="Sem origem ainda." />
          <RankList title="Estado" rows={summary.regions} empty="Sem estado ainda. O pixel grava UF no Cloudflare ou via ipwho.is." tone="sky" />
        </section>
        <section className="grid gap-3 lg:grid-cols-2">
          <RankList title="País" rows={summary.countries} empty="Sem país ainda." />
          <RankList title="Páginas" rows={summary.pages} empty="Nenhuma página rastreada." tone="sky" />
        </section>
        <section className="grid gap-3 lg:grid-cols-2">
          <RankList title="Browser / app" rows={summary.devices} empty="Sem device ainda." />
        </section>
      </div>
    </div>
  )
}
