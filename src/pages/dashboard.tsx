import { Link } from "react-router-dom"
import { LayoutDashboard, Radio } from "lucide-react"
import { PageChrome, StatusPill } from "@/components/layout/chrome"
import { SyncBanner } from "@/components/layout/sync-banner"
import { SparkBars, TrendLine } from "@/components/ui/spark"
import { useStore } from "@/lib/store"
import { pixelFigure } from "@/lib/analytics-view"
import { barShare, deriveOps, seriesLast30 } from "@/lib/ops"
import { facebookOf } from "@/lib/track"
import { useTrackSummary } from "@/lib/use-track-summary"

export function DashboardPage() {
  const { state, crmSync, inboxSync, persistSync } = useStore()
  const { summary, status, hasData } = useTrackSummary(8000)
  const facebook = facebookOf(summary)
  const ops = deriveOps(state.leads)
  const hydrating = persistSync === "idle"
  const empty = !hydrating && ops.leads === 0
  const facebookTotal = Math.max(facebook.adClicks, facebook.pageViews, facebook.buttonClicks)
  const line = seriesLast30(state.leads, () => true)
  const spark = line.slice(-12)
  const waitSpark = seriesLast30(state.leads, (lead) => Boolean(lead.waitUntil)).slice(-12)
  const offerSpark = seriesLast30(state.leads, (lead) => lead.stage === "offer" || lead.events.some((item) => item.kind === "offer")).slice(-12)

  return (
    <div className="h-full overflow-y-auto">
      <div className="page-shell">
        <SyncBanner
          items={[
            { ok: crmSync !== "error", message: "Não consegui ler os funis do Worker. O quadro local pode estar desactualizado." },
            { ok: inboxSync !== "error", message: "A inbox do Telegram não sincronizou. Leads novos podem faltar." },
            { ok: persistSync !== "error", message: "Não consegui ler ou gravar leads no Worker. A lista local pode divergir." },
            { ok: status !== "error", message: "Não consegui ler o pixel. Os números de tráfego abaixo podem estar vazios." },
          ]}
        />
        <PageChrome icon={LayoutDashboard} title="Dashboard">
          <StatusPill>Últimos 30 dias</StatusPill>
          <StatusPill tone={status === "error" ? "danger" : status === "ok" ? "success" : "muted"}>
            {status === "ok" ? "Pixel ao vivo" : status === "error" ? "Pixel falhou" : "A carregar pixel"}
          </StatusPill>
        </PageChrome>

        <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
          <Kpi href="/leads" label="Leads" value={hydrating ? "…" : ops.leads} hint={hydrating ? "a carregar" : empty ? "à espera de captura" : "na base"} bars={spark} />
          <Kpi
            href="/conversas"
            label="Conversas"
            value={hydrating ? "…" : ops.conversations}
            hint={hydrating ? "a carregar" : empty ? "nenhuma iniciada" : "eventos do fluxo"}
            bars={spark}
          />
          <Kpi href="/analytics" label="Anúncio" value={pixelFigure(status, hasData, facebook.adClicks)} hint="clique no ads" bars={spark} />
          <Kpi href="/analytics" label="Page views" value={pixelFigure(status, hasData, facebook.pageViews)} hint="landing do Facebook" bars={spark} />
          <Kpi href="/analytics" label="Botão TG" value={pixelFigure(status, hasData, facebook.buttonClicks)} hint="clique no Telegram" bars={spark} />
          <Kpi href="/leads" label="Aguardando" value={hydrating ? "…" : ops.waiting} hint={hydrating ? "a carregar" : "espera do fluxo"} bars={waitSpark} />
          <Kpi href="/leads" label="Ofertas" value={hydrating ? "…" : ops.offered} hint={hydrating ? "a carregar" : "disparadas pelo quadro"} bars={offerSpark} />
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
              <ChannelRow label="Telegram · convite" value={hydrating ? "…" : ops.telegram} total={ops.leads} />
              <ChannelRow label="Facebook → Telegram" value={hydrating ? "…" : ops.facebook} total={ops.leads} />
              <ChannelRow label="Clique no anúncio" value={pixelFigure(status, hasData, facebook.adClicks)} total={facebookTotal} />
              <ChannelRow label="Page views Facebook" value={pixelFigure(status, hasData, facebook.pageViews)} total={facebookTotal} />
              <ChannelRow label="Clique no botão" value={pixelFigure(status, hasData, facebook.buttonClicks)} total={facebookTotal} />
            </div>
          </div>
          <div className="surface p-6">
            <p className="text-[12.5px] text-muted-foreground">Temperatura</p>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <Heat label="Novos" value={hydrating ? "…" : ops.novo} />
              <Heat label="Mornos" value={hydrating ? "…" : ops.morno} />
              <Heat label="Quentes" value={hydrating ? "…" : ops.quente} />
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
  value: string | number
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

function ChannelRow({ label, value, total }: { label: string; value: string | number; total: number }) {
  const share = typeof value === "number" ? barShare(value, total) : 0
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

function Heat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[12.5px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-[22px] font-medium tracking-tight">{value}</p>
    </div>
  )
}
