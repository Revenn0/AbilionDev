import { ChartNoAxesCombined } from "lucide-react"
import { ComboChart } from "@/components/analytics/combo-chart"
import { RankList } from "@/components/analytics/rank-list"
import { PageChrome, StatusPill } from "@/components/layout/chrome"
import { useStore } from "@/lib/store"
import { formatPercent, formatSession } from "@/lib/track"
import { useTrackSummary } from "@/lib/use-track-summary"

export function AnalyticsPage() {
  const { state } = useStore()
  const { summary, status } = useTrackSummary(4000)
  const empty = summary.visitors === 0 && summary.clicks === 0 && summary.telegrams === 0
  const recent = summary.recent.map((item) => {
    const lead = state.leads.find((row) => row.visitorId === item.visitorId)
    return { ...item, name: lead?.name }
  })

  return (
    <div className="h-full overflow-y-auto">
      <div className="page-shell">
        <PageChrome icon={ChartNoAxesCombined} title="Analytics">
          <StatusPill tone={status === "ok" ? "success" : status === "error" ? "danger" : "muted"}>
            {status === "ok" ? "Ao vivo" : status === "error" ? "Sem leitura" : "A carregar"}
          </StatusPill>
        </PageChrome>

        <section className="surface overflow-hidden">
          <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-7">
            <Kpi label="Visitantes" value={summary.visitors} hint="viram a página" />
            <Kpi label="Cliques" value={summary.clicks} hint="no botão Telegram" />
            <Kpi label="Conversão" value={formatPercent(summary.conversion)} hint="página → Telegram" />
            <Kpi label="Clique / visitante" value={formatPercent(summary.clickRate)} hint="quem clicou" />
            <Kpi label="Bounce" value={formatPercent(summary.bounce)} hint="viu e não clicou" />
            <Kpi label="Sessão" value={formatSession(summary.sessionMs)} hint="tempo médio" />
            <Kpi label="Online" value={summary.online} hint="últimos 2 min" live />
          </div>
          <div className="px-4 pb-4 pt-2">
            {empty ? (
              <p className="px-2 py-16 text-center text-[13px] text-muted-foreground">
                Sem visitas ainda. Cola o pixel da landing em Configurações. Os números só aparecem depois da primeira view.
              </p>
            ) : (
              <ComboChart series={summary.series} recent={recent} />
            )}
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-2">
          <RankList title="Campanha / origem" rows={summary.referrers} empty="Sem origem ainda." />
          <RankList title="País" rows={summary.countries} empty="Sem geo ainda." tone="sky" />
        </section>
        <section className="grid gap-3 lg:grid-cols-2">
          <RankList title="Páginas" rows={summary.pages} empty="Nenhuma página rastreada." tone="sky" />
          <RankList title="Browser / app" rows={summary.devices} empty="Sem device ainda." />
        </section>
      </div>
    </div>
  )
}

function Kpi({ label, value, hint, live }: { label: string; value: string | number; hint: string; live?: boolean }) {
  return (
    <div className="bg-card px-5 py-4">
      <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        {label}
        {live && <i className="size-1.5 rounded-full bg-emerald-400" />}
      </p>
      <p className="mt-2 text-[26px] font-medium tracking-[-0.04em] tabular-nums">{value}</p>
      <p className="mt-1 text-[11.5px] text-muted-foreground">{hint}</p>
    </div>
  )
}
