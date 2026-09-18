import { Megaphone, MessagesSquare, PanelsTopLeft, Send } from "lucide-react"
import { formatPercent } from "@/lib/track"
import { stepRate, type FunnelStep } from "@/lib/analytics-view"
import { cn } from "@/lib/utils"

const ICONS = {
  ads: Megaphone,
  landing: PanelsTopLeft,
  telegram: Send,
  chat: MessagesSquare,
} as const

export function FunnelFlow({ steps }: { steps: FunnelStep[] }) {
  const peak = Math.max(...steps.map((item) => item.value), 1)
  return (
    <section className="surface overflow-hidden p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12.5px] text-muted-foreground">Funil</p>
          <h2 className="mt-1 text-[18px] font-medium tracking-tight">Ads → landing → Telegram → chat</h2>
        </div>
        <p className="text-[12px] text-muted-foreground">Só números reais do pixel e da inbox. Sem receita inventada.</p>
      </div>
      <div className="mt-5 hidden items-stretch gap-2 md:flex">
        {steps.map((step, index) => {
          const prev = steps[index - 1]
          const rate = prev ? stepRate(step.value, prev.value) : 1
          const Icon = ICONS[step.id]
          return (
            <div key={step.id} className="flex min-w-0 flex-1 items-center gap-2">
              {index > 0 && (
                <div className="flex w-14 shrink-0 flex-col items-center text-[11px] text-muted-foreground">
                  <span className="tabular-nums">{formatPercent(rate)}</span>
                  <span className="mt-1 h-px w-full bg-border" />
                </div>
              )}
              <article className="min-w-0 flex-1 rounded-2xl border border-border bg-muted/30 px-4 py-3">
                <p className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                  <Icon className="size-3.5" />
                  {step.label}
                </p>
                <p className="mt-1 text-[28px] font-medium tracking-[-0.04em] tabular-nums">{step.value}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{step.hint}</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-foreground/8">
                  <div className="h-full rounded-full bg-sky-400" style={{ width: `${Math.max(6, (step.value / peak) * 100)}%` }} />
                </div>
              </article>
            </div>
          )
        })}
      </div>
      <ol className="mt-5 space-y-3 md:hidden">
        {steps.map((step, index) => {
          const prev = steps[index - 1]
          const Icon = ICONS[step.id]
          return (
            <li key={step.id}>
              {index > 0 && prev && (
                <p className="mb-2 text-center text-[11px] text-muted-foreground">↓ {formatPercent(stepRate(step.value, prev.value))}</p>
              )}
              <article className="rounded-2xl border border-border px-4 py-3">
                <p className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                  <Icon className="size-3.5" />
                  {step.label}
                </p>
                <p className="mt-1 text-[24px] font-medium tabular-nums">{step.value}</p>
              </article>
            </li>
          )
        })}
      </ol>
      <ul className="mt-6 space-y-2.5">
        {steps.map((step, index) => {
          const width = Math.max(18, (step.value / peak) * 100)
          return (
            <li key={`${step.id}-bar`} className="grid grid-cols-[110px_1fr_48px] items-center gap-3 text-[13px]">
              <span className="truncate text-muted-foreground">{step.label}</span>
              <div className="h-8 overflow-hidden rounded-lg bg-foreground/6">
                <div
                  className={cn("flex h-full items-center rounded-lg px-3 text-[12px] text-sky-950", index === 0 ? "bg-sky-400" : index === 1 ? "bg-sky-400/80" : index === 2 ? "bg-sky-400/60" : "bg-sky-400/45")}
                  style={{ width: `${width}%` }}
                />
              </div>
              <span className="text-right tabular-nums">{step.value}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
