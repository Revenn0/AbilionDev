import { Megaphone, MessagesSquare, MousePointerClick, PanelsTopLeft } from "lucide-react"
import { StudioPanel, STUDIO_TONES, type StudioTone } from "@/components/layout/studio"
import { formatDelta, pixelDropFigure, pixelFigure, stepDrop, type FunnelStep } from "@/lib/analytics-view"
import { cn } from "@/lib/utils"

const META: Record<FunnelStep["id"], { icon: typeof Megaphone; tone: StudioTone; bar: string }> = {
  ads: { icon: Megaphone, tone: "blue", bar: "bg-sky-400" },
  landing: { icon: PanelsTopLeft, tone: "sky", bar: "bg-primary" },
  button: { icon: MousePointerClick, tone: "pink", bar: "bg-pink-300" },
  chat: { icon: MessagesSquare, tone: "emerald", bar: "bg-emerald-400" },
}

export function FunnelFlow({
  steps,
  status = "ok",
  hasData = true,
  leadsReady = true,
  deltas,
}: {
  steps: FunnelStep[]
  status?: "loading" | "ok" | "error"
  hasData?: boolean
  leadsReady?: boolean
  deltas?: Partial<Record<FunnelStep["id"], number>>
}) {
  const peak = Math.max(...steps.map((item) => item.value), 1)
  const pixelReady = status === "ok" || hasData
  const figure = (step: FunnelStep) => {
    if (step.id === "chat") return leadsReady ? step.value : "…"
    return pixelFigure(status, hasData, step.value)
  }
  const widthOf = (step: FunnelStep) => {
    const measurable = step.id === "chat" ? leadsReady : pixelReady
    if (!measurable || step.value <= 0) return 0
    return Math.max(6, (step.value / peak) * 100)
  }

  return (
    <StudioPanel
      eyebrow="Facebook · 30 dias"
      title="Do anúncio ao chat"
      hint="Uma barra por passo. A largura compara com o maior número. A taxa só entra quando o passo cabe no anterior."
    >
      {!pixelReady && status === "loading" ? (
        <p role="status" className="mb-4 text-[13px] leading-relaxed text-muted-foreground">
          A carregar o pixel…
        </p>
      ) : null}
      {!pixelReady && status === "error" ? (
        <p role="alert" className="mb-4 text-[13px] leading-relaxed text-muted-foreground">
          Sem leitura do pixel. Os traços não são zero — a API não respondeu. O chat continua a vir dos leads.
        </p>
      ) : null}
      <ol className="space-y-5" aria-label="Funil Facebook">
        {steps.map((step, index) => {
          const prev = steps[index - 1]
          const meta = META[step.id]
          const Icon = meta.icon
          const skin = STUDIO_TONES[meta.tone]
          const delta = pixelReady ? deltas?.[step.id] : undefined
          const relation = prev ? relationLabel(step, prev, status, hasData, leadsReady) : null
          return (
            <li key={step.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-full border", skin.pill)}>
                    <Icon className="size-3.5" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-medium tracking-[-0.01em]">{step.label}</p>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{step.hint}</p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[22px] font-medium leading-none tracking-[-0.04em] tabular-nums">{figure(step)}</p>
                  {delta !== undefined ? (
                    <p className={cn("mt-1 text-[11px] tabular-nums", delta >= 0 ? "text-success" : "text-destructive")}>
                      {formatDelta(delta)}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="mt-2.5 pl-11">
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full", meta.bar)} style={{ width: `${widthOf(step)}%` }} />
                </div>
                {relation ? <p className="mt-1.5 text-[11.5px] text-muted-foreground">{relation}</p> : null}
              </div>
            </li>
          )
        })}
      </ol>
    </StudioPanel>
  )
}

function relationLabel(
  step: FunnelStep,
  prev: FunnelStep,
  status: "loading" | "ok" | "error",
  hasData: boolean,
  leadsReady: boolean
) {
  if ((step.id === "chat" || prev.id === "chat") && !leadsReady) return "…"
  const drop = stepDrop(step.value, prev.value)
  if (!hasData && (status === "loading" || status === "error")) return pixelDropFigure(status, hasData, drop)
  if (drop === null) {
    if (prev.value <= 0) return "Sem base no passo anterior"
    return "Acima do passo anterior"
  }
  return `${pixelDropFigure(status, hasData, drop)} do passo anterior`
}
