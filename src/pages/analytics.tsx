import { Link } from "react-router-dom"
import { ChartNoAxesCombined } from "lucide-react"
import { AreaChart } from "@/components/analytics/area-chart"
import { FunnelFlow } from "@/components/analytics/funnel-flow"
import { RankList } from "@/components/analytics/rank-list"
import { VisitorGlobe } from "@/components/analytics/visitor-globe"
import { PageChrome, StatusPill } from "@/components/layout/chrome"
import { Button } from "@/components/ui/button"
import { SyncBanner } from "@/components/layout/sync-banner"
import { StudioPanel } from "@/components/layout/studio"
import { formatDelta, funnelFrom, periodDelta, pixelFigure, splitSeries } from "@/lib/analytics-view"
import { catalogMetricPending, leadCatalogClipped } from "@/lib/ops"
import { useStore } from "@/lib/store"
import { facebookOf, formatPercent, formatSession } from "@/lib/track"
import { useTrackSummary } from "@/lib/use-track-summary"
import { cn } from "@/lib/utils"

export function AnalyticsPage() {
  const { state, persistSync, catalogComplete, inboxSync } = useStore()
  const { summary, status, hasData, retry } = useTrackSummary(4000)
  const facebook = facebookOf(summary)
  const pixelReady = status === "ok" || hasData
  const empty =
    pixelReady &&
    persistSync === "ok" &&
    catalogComplete &&
    summary.visitors === 0 &&
    summary.clicks === 0 &&
    summary.telegrams === 0 &&
    facebook.adClicks === 0 &&
    state.leads.length === 0
  const unread = status === "error" && !hasData
  const unreadEmpty = "Sem leitura do pixel."
  const periods = splitSeries(summary.series)
  const funnel = funnelFrom(summary, state.leads)
  const chatStartedCount = funnel.find((item) => item.id === "chat")?.value ?? 0
  const leadsReady = !catalogMetricPending(persistSync, chatStartedCount, inboxSync === "error") && !(leadCatalogClipped(persistSync, catalogComplete) && chatStartedCount === 0)
  const figure = (value: number) => pixelFigure(status, hasData, value)

  return (
    <div className="h-full overflow-y-auto">
      <div className="page-shell">
        <SyncBanner
          items={[
            {
              ok: persistSync !== "error",
              message: "Não consegui ler os leads do Worker. O passo Chat do funil pode estar desactualizado.",
            },
            {
              ok: !leadCatalogClipped(persistSync, catalogComplete),
              message: "A lista do Worker veio recortada. O passo Chat do funil pode estar incompleto.",
            },
            {
              ok: inboxSync !== "error",
              message: "A inbox do Telegram não sincronizou. Conversas novas podem faltar no funil.",
            },
            {
              ok: status !== "error",
              message: "Não confirmei o pixel no Postgres. Recarrega ou confere a sessão — os números abaixo podem estar desactualizados.",
            },
          ]}
          onRetry={retry}
        />
        <PageChrome icon={ChartNoAxesCombined} title="Analytics">
          <StatusPill>30 dias</StatusPill>
          <span data-track-sync={status}>
            <StatusPill tone={status === "ok" ? "success" : status === "error" ? "danger" : "muted"}>
              {status === "ok" ? "Pixel ao vivo" : status === "error" ? "Sem leitura" : "A carregar"}
            </StatusPill>
          </span>
          <Button asChild variant="outline" className="h-8 rounded-full px-3.5">
            <Link to="/">Dashboard</Link>
          </Button>
        </PageChrome>

        <FunnelFlow
          steps={funnel}
          status={status}
          hasData={hasData}
          leadsReady={leadsReady}
          deltas={
            pixelReady
              ? {
                  ads: comparableDelta(periods.facebookAds.current, periods.facebookAds.previous),
                  landing: comparableDelta(periods.facebookViews.current, periods.facebookViews.previous),
                  button: comparableDelta(periods.facebookClicks.current, periods.facebookClicks.previous),
                }
              : undefined
          }
        />

        <section className="grid items-start gap-3 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.82fr)]" aria-label="Página">
          <StudioPanel
            eyebrow="30 dias"
            title="Ritmo do anúncio"
            hint="Três linhas do Facebook. O /start fica na saúde da página."
          >
            {status === "loading" && !hasData ? (
              <p role="status" className="text-[13px] leading-relaxed text-muted-foreground">
                A carregar o pixel…
              </p>
            ) : unread ? (
              <p role="alert" className="text-[13px] leading-relaxed text-muted-foreground">
                Sem leitura do pixel. O gráfico não é uma série de zeros — a API não respondeu.
              </p>
            ) : empty ? (
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                Sem visitas ainda. Abre /l com fbclid ou cola o pixel. O Facebook conta anúncio, page view e botão à parte.
              </p>
            ) : (
              <AreaChart series={summary.series} />
            )}
          </StudioPanel>

          <aside className="surface px-5 py-5">
            <p className="text-[12px] text-muted-foreground">Página · 30 dias</p>
            <p className="mt-0.5 text-[15px] font-medium tracking-[-0.02em]">Saúde da visita</p>
            <ul className="mt-4 divide-y divide-border">
              <HealthRow label="Ao vivo" value={figure(summary.online)} hint="ativos nos últimos 2 min" live={pixelReady && summary.online > 0} />
              <HealthRow
                label="Visitantes"
                value={figure(summary.visitors)}
                hint="todas as origens"
                delta={pixelReady ? comparableDelta(periods.views.current, periods.views.previous) : undefined}
              />
              <HealthRow
                label="Bounce"
                value={pixelReady ? formatPercent(summary.bounce) : figure(0)}
                hint="viu e não clicou no Telegram"
              />
              <HealthRow
                label="Sessão"
                value={pixelReady ? formatSession(summary.sessionMs) : figure(0)}
                hint="tempo médio na página"
              />
              <HealthRow
                label="/start"
                value={figure(facebook.starts || summary.telegrams)}
                hint="fechou o Telegram depois do botão"
                delta={pixelReady ? comparableDelta(periods.telegrams.current, periods.telegrams.previous) : undefined}
              />
            </ul>
            <div className="mt-4 border-t border-border pt-3">
              <p className="text-[11px] font-medium text-muted-foreground">Todas as origens</p>
              <dl className="mt-2 space-y-2 text-[13px]">
                <QuietRow label="Page views totais" value={figure(summary.views)} />
                <QuietRow label="Botão Telegram total" value={figure(summary.clicks)} />
              </dl>
            </div>
          </aside>
        </section>

        <section className="grid items-start gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.75fr)]" aria-label="Mapa e recortes">
          <VisitorGlobe geos={summary.geos} leads={state.leads} status={status} hasData={hasData} />
          <div className="grid gap-3">
            <RankList title="Campanha / origem" rows={summary.referrers} empty={unread ? unreadEmpty : "Sem origem ainda."} />
            <RankList title="Estado" rows={summary.regions} empty={unread ? unreadEmpty : "Sem estado ainda. O pixel grava UF no Cloudflare ou via ipwho.is."} />
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3" aria-label="Recortes">
          <RankList title="País" rows={summary.countries} empty={unread ? unreadEmpty : "Sem país ainda."} />
          <RankList title="Páginas" rows={summary.pages} empty={unread ? unreadEmpty : "Nenhuma página rastreada."} />
          <RankList title="Browser / app" rows={summary.devices} empty={unread ? unreadEmpty : "Sem device ainda."} />
        </section>
      </div>
    </div>
  )
}

function HealthRow({
  label,
  value,
  hint,
  live,
  delta,
}: {
  label: string
  value: string | number
  hint: string
  live?: boolean
  delta?: number
}) {
  return (
    <li className="flex items-start justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-[13px] font-medium">
          {label}
          {live ? <i className="size-1.5 rounded-full bg-success" /> : null}
        </p>
        <p className="mt-0.5 text-[11.5px] text-muted-foreground">{hint}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[18px] font-medium tracking-[-0.03em] tabular-nums">{value}</p>
        {delta !== undefined ? (
          <p className={cn("mt-0.5 text-[11px] tabular-nums", delta >= 0 ? "text-success" : "text-destructive")}>{formatDelta(delta)}</p>
        ) : null}
      </div>
    </li>
  )
}

function comparableDelta(current: number, previous: number) {
  if (previous <= 0) return undefined
  return periodDelta(current, previous)
}

function QuietRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}
