import { Megaphone, MessagesSquare, PanelsTopLeft, Send } from "lucide-react"
import { formatPercent } from "@/lib/track"
import { stepDrop, type FunnelStep } from "@/lib/analytics-view"

const ICONS = {
  ads: Megaphone,
  landing: PanelsTopLeft,
  telegram: Send,
  chat: MessagesSquare,
} as const

export function FunnelFlow({ steps }: { steps: FunnelStep[] }) {
  const peak = Math.max(...steps.map((item) => item.value), 1)
  return (
    <section className="surface p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12.5px] text-muted-foreground">Funil</p>
          <p className="mt-2 text-[22px] font-medium tracking-[-0.03em]">Ads → landing → Telegram → chat</p>
        </div>
        <p className="max-w-xs text-right text-[12px] text-muted-foreground">Pixel e inbox. Sem receita inventada.</p>
      </div>

      <div className="mt-6 hidden md:grid md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] md:items-stretch md:gap-2">
        {steps.map((step, index) => {
          const prev = steps[index - 1]
          const drop = prev ? stepDrop(step.value, prev.value) : null
          const Icon = ICONS[step.id]
          return (
            <div key={step.id} className="contents">
              {index > 0 ? (
                <div className="flex flex-col items-center justify-center px-1 text-[11.5px] text-muted-foreground">
                  <span className="tabular-nums">{drop === null ? "—" : formatPercent(drop)}</span>
                  <span className="mt-2 h-px w-8 bg-border" />
                </div>
              ) : null}
              <article className="min-w-0 rounded-[18px] bg-muted/60 px-4 py-4">
                <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                  <Icon className="size-3.5" strokeWidth={1.75} />
                  {step.label}
                </p>
                <p className="mt-3 text-[28px] font-medium tracking-[-0.04em] tabular-nums">{step.value}</p>
                <p className="mt-1 text-[12px] text-muted-foreground">{step.hint}</p>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-foreground/8">
                  <div className="h-full rounded-full bg-line" style={{ width: `${Math.max(step.value ? 8 : 0, (step.value / peak) * 100)}%` }} />
                </div>
              </article>
            </div>
          )
        })}
      </div>

      <ol className="mt-6 space-y-3 md:hidden">
        {steps.map((step, index) => {
          const prev = steps[index - 1]
          const drop = prev ? stepDrop(step.value, prev.value) : null
          const Icon = ICONS[step.id]
          return (
            <li key={step.id}>
              {index > 0 ? (
                <p className="mb-2 text-center text-[11.5px] text-muted-foreground">
                  ↓ {drop === null ? "—" : formatPercent(drop)}
                </p>
              ) : null}
              <article className="rounded-[18px] bg-muted/60 px-4 py-4">
                <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                  <Icon className="size-3.5" strokeWidth={1.75} />
                  {step.label}
                </p>
                <p className="mt-2 text-[24px] font-medium tabular-nums">{step.value}</p>
                <p className="mt-1 text-[12px] text-muted-foreground">{step.hint}</p>
              </article>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
