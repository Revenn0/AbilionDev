import { Link } from "react-router-dom"
import { MessagesSquare, Send, Thermometer, Users } from "lucide-react"
import { useStore } from "@/lib/store"
import { dayGreeting, longDate } from "@/lib/format"
import { cn } from "@/lib/utils"

export function DashboardPage() {
  const { state } = useStore()
  const first = state.user?.name.split(" ")[0] ?? "olá"
  const ops = state.ops
  const channelTotal = ops.whatsapp + ops.telegram
  const whatsappShare = channelTotal === 0 ? 0 : Math.round((ops.whatsapp / channelTotal) * 100)
  const heatTotal = ops.cold + ops.warm + ops.hot
  const empty = ops.leads === 0 && ops.conversations === 0

  return (
    <div className="h-full overflow-y-auto">
      <div className="page-shell">
        <header className="flex flex-col gap-1">
          <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{longDate()}</p>
          <h1 className="page-title">
            {dayGreeting()}, {first}
          </h1>
          <p className="page-hint">Leads, conversas iniciadas e o pulso dos canais.</p>
        </header>

        <section className="surface relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 hidden w-[42%] bg-[radial-gradient(circle_at_70%_18%,color-mix(in_oklch,var(--whatsapp)_22%,transparent),transparent_44%),radial-gradient(circle_at_20%_86%,color-mix(in_oklch,var(--forecast)_22%,transparent),transparent_48%)] md:block"
          />
          <div className="relative grid gap-8 p-6 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] md:p-8">
            <div>
              <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Hoje</p>
              <p className="mt-3 text-[40px] font-semibold leading-none tracking-[-0.04em]">{ops.startedToday}</p>
              <p className="mt-2 text-[14px] text-muted-foreground">
                {ops.startedToday === 1 ? "conversa iniciada" : "conversas iniciadas"}
              </p>
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-muted-foreground">
                <span>
                  <strong className="font-medium text-foreground">{ops.newToday}</strong> leads novos
                </span>
                <span>
                  <strong className="font-medium text-foreground">{ops.whatsapp}</strong> no WhatsApp
                </span>
                <span>
                  <strong className="font-medium text-foreground">{ops.telegram}</strong> no Telegram
                </span>
              </div>
              {empty && (
                <p className="mt-5 max-w-md text-[13.5px] leading-relaxed text-muted-foreground">
                  Ainda não há movimento. Os números entram quando WhatsApp e Telegram estiverem ligados.
                </p>
              )}
            </div>
            <div className="grid content-center gap-3">
              <PulseRow label="WhatsApp" value={ops.whatsapp} share={empty ? 0 : whatsappShare} tone="whatsapp" />
              <PulseRow label="Telegram" value={ops.telegram} share={empty ? 0 : 100 - whatsappShare} tone="forecast" />
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric href="/leads" label="Leads" value={ops.leads} hint="na base" icon={Users} />
          <Metric href="/conversas" label="Conversas" value={ops.conversations} hint="inbox aberta" icon={MessagesSquare} />
          <Metric href="/conversas" label="Iniciadas hoje" value={ops.startedToday} hint="primeiro contacto" icon={Send} />
          <Metric href="/leads" label="Quentes" value={ops.hot} hint="prontos a fechar" icon={Thermometer} accent="success" />
        </section>

        <section className="grid gap-3 lg:grid-cols-2">
          <div className="surface p-5">
            <p className="text-[14px] font-semibold">Temperatura</p>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">Como está a base de contactos.</p>
            <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-muted">
              <div className="bg-foreground/25" style={{ width: `${pct(ops.cold, heatTotal)}%` }} />
              <div className="bg-chart-4" style={{ width: `${pct(ops.warm, heatTotal)}%` }} />
              <div className="bg-success" style={{ width: `${pct(ops.hot, heatTotal)}%` }} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-[12.5px]">
              <HeatStat label="Frios" value={ops.cold} />
              <HeatStat label="Mornos" value={ops.warm} />
              <HeatStat label="Quentes" value={ops.hot} />
            </div>
          </div>

          <div className="surface p-5">
            <p className="text-[14px] font-semibold">Inbox</p>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">Conversas à espera de resposta.</p>
            {empty ? (
              <div className="mt-8 text-center">
                <MessagesSquare className="mx-auto size-5 text-muted-foreground" />
                <p className="mt-3 text-[14px] font-medium">Nenhuma conversa ainda</p>
                <p className="mx-auto mt-1 max-w-xs text-[13px] text-muted-foreground">
                  Quando um lead escrever, a conversa aparece aqui e no inbox.
                </p>
                <Link to="/conversas" className="mt-4 inline-flex text-[13px] font-medium hover:underline">
                  Abrir conversas
                </Link>
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-2 gap-3">
                <HeatStat label="WhatsApp" value={ops.whatsapp} />
                <HeatStat label="Telegram" value={ops.telegram} />
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function pct(value: number, total: number) {
  if (total === 0) return 0
  return Math.round((value / total) * 100)
}

function Metric({
  href,
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  href: string
  label: string
  value: number
  hint: string
  icon: typeof Users
  accent?: "success"
}) {
  return (
    <Link to={href} className="surface p-5 transition-colors hover:bg-muted/30">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-muted-foreground">{label}</p>
        <Icon className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
      </div>
      <p className={cn("mt-2 text-[28px] font-semibold tracking-tight", accent === "success" && "text-success")}>{value}</p>
      <p className="mt-1 text-[12px] text-muted-foreground">{hint}</p>
    </Link>
  )
}

function PulseRow({
  label,
  value,
  share,
  tone,
}: {
  label: string
  value: number
  share: number
  tone: "whatsapp" | "forecast"
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[12.5px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", tone === "whatsapp" ? "bg-whatsapp" : "bg-forecast")}
          style={{ width: `${share}%` }}
        />
      </div>
    </div>
  )
}

function HeatStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-1 text-[18px] font-semibold tracking-tight">{value}</p>
    </div>
  )
}
