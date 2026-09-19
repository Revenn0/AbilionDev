import { Link } from "react-router-dom"
import { LayoutDashboard, Radio } from "lucide-react"
import { PageChrome, StatusPill } from "@/components/layout/chrome"
import { SparkBars, TrendLine } from "@/components/ui/spark"
import { useStore } from "@/lib/store"
import { deriveOps, seriesLast30 } from "@/lib/ops"
import { facebookOf } from "@/lib/track"
import { useTrackSummary } from "@/lib/use-track-summary"

export function DashboardPage() {
  const { state } = useStore()
  const { summary } = useTrackSummary(8000)
  const facebook = facebookOf(summary)
  const ops = deriveOps(state.leads)
  const empty = ops.leads === 0
  const channelTotal = ops.telegram
  const line = seriesLast30(state.leads, () => true)
  const spark = line.slice(-12)
  const waitSpark = seriesLast30(state.leads, (lead) => Boolean(lead.waitUntil)).slice(-12)
  const offerSpark = seriesLast30(state.leads, (lead) => lead.stage === "offer" || lead.events.some((item) => item.kind === "offer")).slice(-12)

  return (
    <div className="h-full overflow-y-auto">
      <div className="page-shell">
        <PageChrome icon={LayoutDashboard} title="Dashboard">
          <StatusPill>Últimos 30 dias</StatusPill>
          <StatusPill tone="success">Telegram</StatusPill>
        </PageChrome>

        <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
          <Kpi href="/leads" label="Leads" value={ops.leads} hint={empty ? "à espera de captura" : "na base"} bars={spark} />
          <Kpi
            href="/conversas"
            label="Conversas"
            value={ops.conversations}
            hint={empty ? "nenhuma iniciada" : "eventos do fluxo"}
            bars={spark}
          />
          <Kpi href="/analytics" label="Anúncio" value={facebook.adClicks} hint="clique no ads" bars={spark} />
          <Kpi href="/analytics" label="Page views" value={facebook.pageViews} hint="landing do Facebook" bars={spark} />
          <Kpi href="/analytics" label="Botão TG" value={facebook.buttonClicks} hint="clique no Telegram" bars={spark} />
          <Kpi href="/leads" label="Aguardando" value={ops.waiting} hint="espera do fluxo" bars={waitSpark} />
          <Kpi href="/leads" label="Ofertas" value={ops.offered} hint="disparadas pelo quadro" bars={offerSpark} />
        </section>

        <section className="surface p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[12.5px] text-muted-foreground">Capturas ao longo do tempo</p>
              <p className="mt-2 text-[32px] font-medium tracking-[-0.04em]">{ops.leads}</p>
            </div>
            <div className="flex items-center gap-4 text-[12px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <i className="size-1.5 rounded-full bg-line" />
                Facebook, popup, join e /start
              </span>
            </div>
          </div>
          <div className="mt-6 h-[200px]">
            <TrendLine values={line} />
          </div>
          <div className="mt-2 flex justify-between text-[11.5px] text-muted-foreground">
            <span>Dia 1</span>
            <span>Dia 7</span>
            <span>Dia 14</span>
            <span>Dia 21</span>
            <span>Dia 30</span>
          </div>
          {empty && (
            <p className="mt-4 text-[12.5px] text-muted-foreground">
              Sem movimento. Os números vêm da captura — não inventamos leads.
            </p>
          )}
        </section>

        <section className="grid gap-3 lg:grid-cols-2">
          <div className="surface p-6">
            <p className="text-[12.5px] text-muted-foreground">Campanha · Telegram</p>
            <div className="mt-5 space-y-5">
              <ChannelRow label="Telegram · convite" value={ops.telegram} total={channelTotal} />
              <ChannelRow label="Facebook → Telegram" value={ops.facebook} total={ops.leads} />
              <ChannelRow label="Clique no anúncio" value={facebook.adClicks} total={Math.max(facebook.adClicks, 1)} />
              <ChannelRow label="Page views Facebook" value={facebook.pageViews} total={Math.max(facebook.pageViews, 1)} />
              <ChannelRow label="Clique no botão" value={facebook.buttonClicks} total={Math.max(facebook.pageViews, facebook.buttonClicks, 1)} />
            </div>
          </div>
          <div className="surface p-6">
            <p className="text-[12.5px] text-muted-foreground">Temperatura</p>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <Heat label="Novos" value={ops.novo} />
              <Heat label="Mornos" value={ops.morno} />
              <Heat label="Quentes" value={ops.quente} />
            </div>
            <Link to="/leads" className="mt-5 inline-flex text-[12.5px] text-muted-foreground hover:text-foreground">
              Abrir leads
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}

function Kpi({
  href,
  label,
  value,
  hint,
  bars,
}: {
  href: string
  label: string
  value: number
  hint: string
  bars: number[]
}) {
  return (
    <Link to={href} className="surface p-5 transition-colors hover:bg-card/80">
      <p className="text-[12.5px] text-muted-foreground">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[28px] font-medium tracking-[-0.04em]">{value}</p>
          <p className="mt-1 text-[12px] text-muted-foreground">{hint}</p>
        </div>
        <SparkBars values={bars} />
      </div>
    </Link>
  )
}

function ChannelRow({ label, value, total }: { label: string; value: number; total: number }) {
  const share = total === 0 ? 0 : Math.round((value / total) * 100)
  return (
    <div>
      <div className="flex items-center justify-between text-[13px]">
        <span className="inline-flex items-center gap-2">
          <Radio className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
          {label}
        </span>
        <span className="text-muted-foreground">{value}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/8">
        <div className="h-full rounded-full bg-line" style={{ width: `${share}%` }} />
      </div>
    </div>
  )
}

function Heat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[12.5px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-[22px] font-medium tracking-tight">{value}</p>
    </div>
  )
}
