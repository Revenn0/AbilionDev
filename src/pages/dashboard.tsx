import { Link } from "react-router-dom"
import { LayoutDashboard, Radio } from "lucide-react"
import { FilterChip, PageChrome } from "@/components/layout/chrome"
import { SparkBars, TrendLine } from "@/components/ui/spark"
import { useStore } from "@/lib/store"

const EMPTY_LINE = Array.from({ length: 30 }, () => 0)
const EMPTY_BARS = Array.from({ length: 12 }, () => 0)

export function DashboardPage() {
  const { state } = useStore()
  const ops = state.ops
  const empty = ops.leads === 0 && ops.conversations === 0
  const channelTotal = ops.whatsapp + ops.telegram

  return (
    <div className="h-full overflow-y-auto">
      <div className="page-shell">
        <PageChrome icon={LayoutDashboard} title="Dashboard">
          <FilterChip active>Últimos 30 dias</FilterChip>
          <FilterChip>Todos os canais</FilterChip>
        </PageChrome>

        <section className="grid gap-3 md:grid-cols-3">
          <Kpi
            href="/leads"
            label="Leads"
            value={ops.leads}
            hint={empty ? "à espera de canal" : "na base"}
          />
          <Kpi
            href="/conversas"
            label="Conversas"
            value={ops.conversations}
            hint={empty ? "nenhuma iniciada" : "inbox aberta"}
          />
          <Kpi
            href="/conversas"
            label="Iniciadas hoje"
            value={ops.startedToday}
            hint="primeiro contacto"
          />
        </section>

        <section className="surface p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[12.5px] text-muted-foreground">Conversas ao longo do tempo</p>
              <p className="mt-2 text-[32px] font-medium tracking-[-0.04em]">{ops.conversations}</p>
            </div>
            <div className="flex items-center gap-4 text-[12px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <i className="size-1.5 rounded-full bg-line" />
                Período actual
              </span>
            </div>
          </div>
          <div className="mt-6 h-[200px]">
            <TrendLine values={EMPTY_LINE} />
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
              Sem movimento nos últimos 30 dias. Os pontos aparecem quando um canal estiver ligado.
            </p>
          )}
        </section>

        <section className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="surface p-6">
            <p className="text-[12.5px] text-muted-foreground">Canais</p>
            <div className="mt-5 space-y-5">
              <ChannelRow label="WhatsApp" value={ops.whatsapp} total={channelTotal} />
              <ChannelRow label="Telegram" value={ops.telegram} total={channelTotal} />
            </div>
          </div>

          <div className="surface p-6">
            <p className="text-[12.5px] text-muted-foreground">Leads ao longo do tempo</p>
            <p className="mt-2 text-[28px] font-medium tracking-[-0.04em]">{ops.leads}</p>
            <div className="mt-4 h-[120px]">
              <TrendLine values={EMPTY_LINE} height={120} />
            </div>
            <Link to="/leads" className="mt-4 inline-flex text-[12.5px] text-muted-foreground hover:text-foreground">
              Abrir leads
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}

function Kpi({ href, label, value, hint }: { href: string; label: string; value: number; hint: string }) {
  return (
    <Link to={href} className="surface p-5 transition-colors hover:bg-card/80">
      <p className="text-[12.5px] text-muted-foreground">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[28px] font-medium tracking-[-0.04em]">{value}</p>
          <p className="mt-1 text-[12px] text-muted-foreground">{hint}</p>
        </div>
        <SparkBars values={EMPTY_BARS} />
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
