import { Link } from "react-router-dom"
import { MessagesSquare, Send, Users, Workflow } from "lucide-react"
import { useStore } from "@/lib/store"
import { dayGreeting, longDate } from "@/lib/format"
import { cn } from "@/lib/utils"

export function DashboardPage() {
  const { state } = useStore()
  const first = state.user?.name.split(" ")[0] ?? "olá"
  const total = state.funnels.length
  const published = state.funnels.filter((item) => item.status === "active").length
  const drafts = total - published
  const liveShare = total === 0 ? 0 : Math.round((published / total) * 100)

  return (
    <div className="h-full overflow-y-auto">
      <div className="page-shell">
        <header className="flex flex-col gap-1">
          <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{longDate()}</p>
          <h1 className="page-title">
            {dayGreeting()}, {first}
          </h1>
          <p className="page-hint">O estado da operação — o que está publicado e o que ainda é rascunho.</p>
        </header>

        <section className="surface relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] bg-[radial-gradient(circle_at_70%_20%,color-mix(in_oklch,var(--forecast)_28%,transparent),transparent_42%),radial-gradient(circle_at_30%_80%,color-mix(in_oklch,var(--success)_18%,transparent),transparent_46%)] md:block"
          />
          <div className="relative grid gap-8 p-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:p-8">
            <div>
              <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Quadro</p>
              <p className="mt-3 text-[40px] font-semibold leading-none tracking-[-0.04em]">{total}</p>
              <p className="mt-2 text-[14px] text-muted-foreground">{total === 1 ? "funil no quadro" : "funis no quadro"}</p>

              <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-success transition-[width] duration-500 ease-out"
                  style={{ width: `${liveShare}%` }}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-muted-foreground">
                <span>
                  <strong className="font-medium text-foreground">{published}</strong> em produção
                </span>
                <span>
                  <strong className="font-medium text-foreground">{drafts}</strong> em rascunho
                </span>
                {total > 0 && (
                  <span>
                    <strong className="font-medium text-foreground">{liveShare}%</strong> publicados
                  </span>
                )}
              </div>

              {total === 0 && (
                <p className="mt-5 max-w-sm text-[13.5px] leading-relaxed text-muted-foreground">
                  Ainda não há funis. Abre Funil no menu para desenhar o primeiro quadro.
                </p>
              )}
            </div>

            <div className="relative hidden min-h-[168px] items-center justify-center md:flex">
              <FunnelSketch />
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <Metric label="No quadro" value={total} hint="funis criados" />
          <Metric label="Em produção" value={published} hint="já publicados" accent="success" />
          <Metric label="Rascunhos" value={drafts} hint="ainda por publicar" />
        </section>

        <section>
          <div className="mb-3">
            <p className="text-[14px] font-semibold">Áreas</p>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">O que já está pronto e o que vem a seguir.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <AreaCard
              href="/fluxo"
              icon={Workflow}
              title="Funil"
              hint="Tráfego, divisor, páginas e mensagens."
              status="Pronto"
              ready
            />
            <AreaCard href="/leads" icon={Users} title="Leads" hint="Base de contactos e temperatura." status="Em preparação" />
            <AreaCard
              href="/conversas"
              icon={MessagesSquare}
              title="Conversas"
              hint="Inbox de WhatsApp e Telegram."
              status="Em preparação"
            />
            <AreaCard href="/telegram" icon={Send} title="Telegram" hint="Ligação do bot e estado do canal." status="Em preparação" />
          </div>
        </section>
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  hint,
  accent,
}: {
  label: string
  value: number
  hint: string
  accent?: "success"
}) {
  return (
    <div className="surface p-5">
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <p className={cn("mt-2 text-[28px] font-semibold tracking-tight", accent === "success" && "text-success")}>{value}</p>
      <p className="mt-1 text-[12px] text-muted-foreground">{hint}</p>
    </div>
  )
}

function AreaCard({
  href,
  icon: Icon,
  title,
  hint,
  status,
  ready,
}: {
  href: string
  icon: typeof Workflow
  title: string
  hint: string
  status: string
  ready?: boolean
}) {
  return (
    <Link to={href} className="surface flex items-start gap-3.5 p-5 transition-colors hover:bg-muted/30">
      <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-foreground">
        <Icon className="size-4" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[14px] font-medium">{title}</p>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
              ready ? "bg-success/12 text-success" : "bg-muted text-muted-foreground"
            )}
          >
            {status}
          </span>
        </div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{hint}</p>
      </div>
    </Link>
  )
}

function FunnelSketch() {
  return (
    <div className="flex items-center gap-3 text-[11px] font-medium text-muted-foreground">
      <SketchNode label="Tráfego" tone="slate" />
      <span className="h-px w-8 bg-border" />
      <SketchNode label="Divisor" tone="forecast" />
      <span className="h-px w-8 bg-border" />
      <SketchNode label="Página" tone="primary" />
    </div>
  )
}

function SketchNode({ label, tone }: { label: string; tone: "slate" | "forecast" | "primary" }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          "size-12 rounded-2xl border border-border bg-card shadow-[0_10px_30px_-18px_rgb(0_0_0/0.45)]",
          tone === "forecast" && "bg-forecast/15",
          tone === "primary" && "bg-foreground/6"
        )}
      />
      <span>{label}</span>
    </div>
  )
}
