import { ChartNoAxesCombined } from "lucide-react"
import { AreaChart } from "@/components/analytics/area-chart"
import { FacebookSplit } from "@/components/analytics/facebook-split"
import { FunnelFlow } from "@/components/analytics/funnel-flow"
import { KpiCard } from "@/components/analytics/kpi-card"
import { RankList } from "@/components/analytics/rank-list"
import { VisitorGlobe } from "@/components/analytics/visitor-globe"
import { PageChrome, StatusPill } from "@/components/layout/chrome"
import { funnelFrom, periodDelta, splitSeries } from "@/lib/analytics-view"
import { useStore } from "@/lib/store"
import { facebookOf, formatPercent, formatSession } from "@/lib/track"
import { useTrackSummary } from "@/lib/use-track-summary"

export function AnalyticsPage() {
  const { state } = useStore()
  const { summary, status } = useTrackSummary(4000)
  const facebook = facebookOf(summary)
  const empty =
    summary.visitors === 0 && summary.clicks === 0 && summary.telegrams === 0 && facebook.adClicks === 0 && state.leads.length === 0
  const periods = splitSeries(summary.series)
  const funnel = funnelFrom(summary, state.leads)
  const viewSpark = summary.series.map((item) => item.views)
  const clickSpark = summary.series.map((item) => item.clicks)
  const telegramSpark = summary.series.map((item) => item.telegrams)
  const facebookViewSpark = summary.series.map((item) => item.facebookViews ?? 0)
  const facebookClickSpark = summary.series.map((item) => item.facebookClicks ?? 0)

  return (
    <div className="h-full overflow-y-auto">
      <div className="page-shell">
        <PageChrome icon={ChartNoAxesCombined} title="Analytics">
          <StatusPill tone={status === "ok" ? "success" : status === "error" ? "danger" : "muted"}>
            {status === "ok" ? "Ao vivo · 30 dias" : status === "error" ? "Sem leitura" : "A carregar"}
          </StatusPill>
        </PageChrome>

        <FacebookSplit
          summary={summary}
          deltas={{
            ads: periodDelta(periods.facebookAds.current, periods.facebookAds.previous),
            views: periodDelta(periods.facebookViews.current, periods.facebookViews.previous),
            clicks: periodDelta(periods.facebookClicks.current, periods.facebookClicks.previous),
          }}
        />

        <FunnelFlow steps={funnel} />

        <VisitorGlobe geos={summary.geos} leads={state.leads} />

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Ao vivo" value={summary.online} hint="ativos nos últimos 2 min" live spark={viewSpark.slice(-12)} />
          <KpiCard
            label="Visitantes"
            value={summary.visitors}
            hint="todas as origens"
            delta={periodDelta(periods.views.current, periods.views.previous)}
            spark={viewSpark}
          />
          <KpiCard label="Bounce" value={formatPercent(summary.bounce)} hint="viu e não clicou no Telegram" spark={clickSpark} />
          <KpiCard label="Sessão" value={formatSession(summary.sessionMs)} hint="tempo médio na página" spark={viewSpark} />
        </section>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <KpiCard
            label="/start"
            value={facebook.starts || summary.telegrams}
            hint="fechou o Telegram depois do botão"
            delta={periodDelta(periods.telegrams.current, periods.telegrams.previous)}
            spark={telegramSpark}
          />
          <KpiCard
            label="Page views totais"
            value={summary.views}
            hint="Facebook e o resto"
            spark={facebookViewSpark}
          />
          <KpiCard
            label="Botão Telegram total"
            value={summary.clicks}
            hint="todas as origens"
            spark={facebookClickSpark}
          />
        </section>

        <section className="surface p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[12.5px] text-muted-foreground">30 dias</p>
              <p className="mt-2 text-[32px] font-medium tracking-[-0.04em] tabular-nums">{facebook.pageViews || summary.views}</p>
            </div>
            <p className="text-[12px] text-muted-foreground">Anúncio, page view e clique no Telegram — linhas do Facebook, sem misturar /start</p>
          </div>
          {empty ? (
            <p className="mt-10 text-[13px] text-muted-foreground">
              Sem visitas ainda. Abre /l com fbclid ou cola o pixel. O Facebook conta anúncio, page view e botão à parte.
            </p>
          ) : (
            <AreaChart series={summary.series} className="mt-6" />
          )}
        </section>

        <section className="grid gap-3 lg:grid-cols-2">
          <RankList title="Campanha / origem" rows={summary.referrers} empty="Sem origem ainda." />
          <RankList title="Estado" rows={summary.regions} empty="Sem estado ainda. O pixel grava UF no Cloudflare ou via ipwho.is." />
        </section>
        <section className="grid gap-3 lg:grid-cols-2">
          <RankList title="País" rows={summary.countries} empty="Sem país ainda." />
          <RankList title="Páginas" rows={summary.pages} empty="Nenhuma página rastreada." />
        </section>
        <section className="grid gap-3 lg:grid-cols-2">
          <RankList title="Browser / app" rows={summary.devices} empty="Sem device ainda." />
        </section>
      </div>
    </div>
  )
}
