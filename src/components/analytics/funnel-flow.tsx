import { Megaphone, MessagesSquare, MousePointerClick, PanelsTopLeft } from "lucide-react"
import { StudioMetric, StudioPanel, type StudioTone } from "@/components/layout/studio"
import { formatPercent } from "@/lib/track"
import { stepDrop, type FunnelStep } from "@/lib/analytics-view"

const META: Record<FunnelStep["id"], { icon: typeof Megaphone; tone: StudioTone }> = {
  ads: { icon: Megaphone, tone: "blue" },
  landing: { icon: PanelsTopLeft, tone: "sky" },
  button: { icon: MousePointerClick, tone: "pink" },
  chat: { icon: MessagesSquare, tone: "emerald" },
}

export function FunnelFlow({ steps, pixelReady = true }: { steps: FunnelStep[]; pixelReady?: boolean }) {
  const peak = Math.max(...steps.map((item) => item.value), 1)
  const figure = (step: FunnelStep) => (pixelReady || step.id === "chat" ? step.value : "—")
  return (
    <StudioPanel
      eyebrow="Funil Facebook"
      title="Anúncio → page view → botão → chat"
      hint="O mesmo caminho do quadro: Ads, landing, Telegram e conversa iniciada."
    >
      <div className="hidden md:grid md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] md:items-stretch md:gap-1">
        {steps.map((step, index) => {
          const prev = steps[index - 1]
          const drop = pixelReady && prev ? stepDrop(step.value, prev.value) : null
          const meta = META[step.id]
          const Icon = meta.icon
          return (
            <div key={step.id} className="contents">
              {index > 0 ? (
                <div className="flex flex-col items-center justify-center px-1 text-[11px] text-muted-foreground">
                  <span className="tabular-nums">{drop === null ? "—" : formatPercent(drop)}</span>
                  <span className="mt-2 h-px w-8 bg-sky-200" />
                </div>
              ) : null}
              <StudioMetric
                title={step.label}
                tone={meta.tone}
                value={figure(step)}
                hint={step.hint}
                footer={
                  <div className="mt-3">
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.max(step.value ? 8 : 0, (step.value / peak) * 100)}%` }}
                      />
                    </div>
                    <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Icon className="size-3.5" strokeWidth={1.75} />
                      Passo {index + 1}
                    </p>
                  </div>
                }
              />
            </div>
          )
        })}
      </div>

      <ol className="space-y-3 md:hidden">
        {steps.map((step, index) => {
          const prev = steps[index - 1]
          const drop = pixelReady && prev ? stepDrop(step.value, prev.value) : null
          const meta = META[step.id]
          return (
            <li key={step.id}>
              {index > 0 ? (
                <p className="mb-2 text-center text-[11.5px] text-muted-foreground">
                  ↓ {drop === null ? "—" : formatPercent(drop)}
                </p>
              ) : null}
              <StudioMetric title={step.label} tone={meta.tone} value={figure(step)} hint={step.hint} />
            </li>
          )
        })}
      </ol>
    </StudioPanel>
  )
}
