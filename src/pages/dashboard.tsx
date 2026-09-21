import { Link } from "react-router-dom"
import { LayoutDashboard, Radio } from "lucide-react"
import { PageChrome, StatusPill } from "@/components/layout/chrome"
import { SyncBanner } from "@/components/layout/sync-banner"
import { Button } from "@/components/ui/button"
import { SparkBars, TrendLine } from "@/components/ui/spark"
import { useStore } from "@/lib/store"
import { pixelFigure } from "@/lib/analytics-view"
import { barShare, catalogMetricPending, deriveOps, leadCatalogClipped, leadCatalogEmpty, leadsHydrating, leadsLoadFailed, metricPending, offerMetricPending, seriesLast30 } from "@/lib/ops"
import { facebookOf } from "@/lib/track"
import { useTrackSummary } from "@/lib/use-track-summary"

export function DashboardPage() {
  const { state, crmSync, inboxSync, persistSync, catalogComplete, eventsSync } = useStore()
  const { summary, status, hasData, retry } = useTrackSummary(8000)
  const facebook = facebookOf(summary)
  const ops = deriveOps(state.leads)
  const hydrating = leadsHydrating(persistSync, state.leads.length)
  const failed = leadsLoadFailed(persistSync, state.leads.length)
  const clipped = leadCatalogClipped(persistSync, catalogComplete)
  const empty = leadCatalogEmpty(persistSync, catalogComplete, ops.leads)
  const pending = hydrating || failed
  const clippedZero = (count: number) => clipped && count === 0
  const chatsPending = metricPending(persistSync, ops.conversations, inboxSync === "error") || clippedZero(ops.conversations)
  const telegramPending = catalogMetricPending(persistSync, ops.telegram, inboxSync === "error") || clippedZero(ops.telegram)
  const facebookPending = metricPending(persistSync, ops.facebook) || clippedZero(ops.facebook)
  const importedPending = metricPending(persistSync, ops.imported) || clippedZero(ops.imported)
  const waitPending = metricPending(persistSync, ops.waiting) || clippedZero(ops.waiting)
  const offerPending = offerMetricPending(persistSync, eventsSync, ops.offered, clipped)
  const novoPending = metricPending(persistSync, ops.novo) || clippedZero(ops.novo)
  const mornoPending = metricPending(persistSync, ops.morno) || clippedZero(ops.morno)
  const quentePending = metricPending(persistSync, ops.quente) || clippedZero(ops.quente)
  const facebookTotal = Math.max(facebook.adClicks, facebook.pageViews, facebook.buttonClicks)
  const line = seriesLast30(state.leads, () => true)
  const spark = line.slice(-12)
  const pixelBars = (key: "facebookAds" | "facebookViews" | "facebookClicks") =>
    summary.series.map((row) => row[key]).slice(-12)
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
            { ok: eventsSync !== "error", message: "Não li a timeline dos leads no Postgres. O KPI de ofertas pode esconder disparos que já existiam." },
            { ok: !clipped, message: "A lista do Worker veio recortada. Os totais abaixo não são o catálogo inteiro." },
            { ok: status !== "error", message: "Não confirmei o pixel no Postgres. Os números de tráfego abaixo podem estar desactualizados." },
          ]}
          onRetry={retry}
        />
        <PageChrome icon={LayoutDashboard} title="Dashboard">
          <StatusPill>Últimos 30 dias</StatusPill>
          <span data-track-sync={status}>
            <StatusPill tone={status === "error" ? "danger" : status === "ok" ? "success" : "muted"}>
              {status === "ok" ? "Pixel ao vivo" : status === "error" ? "Sem leitura" : "A carregar pixel"}
            </StatusPill>
          </span>
          <Button asChild variant="outline" className="h-8 rounded-full px-3.5">
            <Link to="/telegram#pixel">Pixel Ads</Link>
          </Button>
        </PageChrome>

        <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
          <Kpi href="/leads" label="Leads" value={pending || (clipped && ops.leads === 0) ? "…" : ops.leads} hint={hydrating ? "a carregar" : failed ? "sem leitura" : clipped ? "recorte" : empty ? "à espera de captura" : "na base"} bars={spark} />
          <Kpi
            href="/conversas"
            label="Conversas"
            value={chatsPending ? "…" : ops.conversations}
            hint={
              chatsPending
                ? persistSync === "idle"
                  ? "a carregar"
                  : "sem leitura"
                : ops.conversations === 0
                  ? "nenhuma iniciada"
                  : "eventos do fluxo"
            }
            bars={spark}
          />
          <Kpi href="/analytics" label="Anúncio" value={pixelFigure(status, hasData, facebook.adClicks)} hint="clique no ads" bars={pixelBars("facebookAds")} />
          <Kpi href="/analytics" label="Page views" value={pixelFigure(status, hasData, facebook.pageViews)} hint="landing do Facebook" bars={pixelBars("facebookViews")} />
          <Kpi href="/analytics" label="Botão TG" value={pixelFigure(status, hasData, facebook.buttonClicks)} hint="clique no Telegram" bars={pixelBars("facebookClicks")} />
          <Kpi
            href="/leads"
            label="Aguardando"
            value={waitPending ? "…" : ops.waiting}
            hint={waitPending ? (persistSync === "idle" ? "a carregar" : "sem leitura") : "espera do fluxo"}
            bars={waitSpark}
          />
          <Kpi
            href="/leads"
            label="Ofertas"
            value={offerPending ? "…" : ops.offered}
            hint={offerPending ? (persistSync === "idle" || eventsSync === "idle" ? "a carregar" : "sem leitura") : "disparadas pelo quadro"}
            bars={offerSpark}
          />
        </section>

        <section className="surface p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[12.5px] text-muted-foreground">Capturas ao longo do tempo</p>
              <p className="mt-2 text-[32px] font-medium tracking-[-0.04em]">{pending ? "…" : ops.leads}</p>
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
          {failed ? (
            <p role="alert" className="mt-4 text-[12.5px] text-muted-foreground">
              Sem leitura dos leads. Os zeros acima não são a base — o Worker não respondeu.
            </p>
          ) : empty ? (
            <p className="mt-4 text-[12.5px] text-muted-foreground">
              Sem movimento. Os números vêm da captura — não inventamos leads.
            </p>
          ) : null}
        </section>

        <section className="grid gap-3 lg:grid-cols-2">
          <div className="surface p-6">
            <p className="text-[12.5px] text-muted-foreground">Campanha · Telegram</p>
            <div className="mt-5 space-y-5">
              <ChannelRow label="Telegram · convite" value={telegramPending ? "…" : ops.telegram} total={ops.leads} />
              <ChannelRow label="Facebook → Telegram" value={facebookPending ? "…" : ops.facebook} total={ops.leads} />
              <ChannelRow label="WhatsApp · importado" value={importedPending ? "…" : ops.imported} total={ops.leads} />
              <ChannelRow label="Clique no anúncio" value={pixelFigure(status, hasData, facebook.adClicks)} total={facebookTotal} />
              <ChannelRow label="Page views Facebook" value={pixelFigure(status, hasData, facebook.pageViews)} total={facebookTotal} />
              <ChannelRow label="Clique no botão" value={pixelFigure(status, hasData, facebook.buttonClicks)} total={facebookTotal} />
            </div>
          </div>
          <div className="surface p-6">
            <p className="text-[12.5px] text-muted-foreground">Temperatura</p>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <Heat label="Novos" value={novoPending ? "…" : ops.novo} />
              <Heat label="Mornos" value={mornoPending ? "…" : ops.morno} />
              <Heat label="Quentes" value={quentePending ? "…" : ops.quente} />
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
