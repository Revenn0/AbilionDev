import { useMemo, useState } from "react"
import { Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { applyEvent, snapshotOf, type RuntimeEvent, type RuntimeEffect } from "@/lib/runtime"
import type { Lead, SalesFunnel } from "@/lib/types"
import { uid } from "@/lib/format"
import { campaignFor } from "@/lib/labels"

function blankLead(): Lead {
  const now = new Date().toISOString()
  return {
    id: uid(),
    name: "Lead de teste",
    contact: "@teste",
    channel: "telegram",
    campaign: campaignFor("telegram"),
    origin: "private",
    temperature: "novo",
    stage: "welcome",
    memory: "",
    events: [],
    createdAt: now,
    updatedAt: now,
  }
}

const ACTIONS: { id: RuntimeEvent["type"]; label: string }[] = [
  { id: "capture", label: "Popup" },
  { id: "join", label: "Join" },
  { id: "start", label: "/start" },
  { id: "print", label: "Print" },
  { id: "banca", label: "Banca" },
  { id: "timer", label: "Timer" },
  { id: "resume", label: "Seguir" },
]

function effectLine(effect: RuntimeEffect) {
  if (effect.kind === "send_message") return `Mensagem · ${effect.body.slice(0, 80)}`
  if (effect.kind === "wait") return `Espera · ${effect.hours}h`
  if (effect.kind === "handoff") return "Handoff · Sté"
  if (effect.kind === "notify_ester") return `Ester · ${effect.body.slice(0, 60)}`
  if (effect.kind === "tag") return `Tag · ${effect.temperature ?? effect.campaign}`
  if (effect.kind === "offer") return "Oferta disparada"
  return `Bloqueado · ${effect.reason}`
}

export function FlowSimulator({
  funnel,
  onCursor,
}: {
  funnel: SalesFunnel
  onCursor: (nodeId?: string) => void
}) {
  const snapshot = useMemo(() => funnel.production ?? snapshotOf(funnel), [funnel])
  const [lead, setLead] = useState<Lead>(blankLead)
  const [log, setLog] = useState<string[]>([])
  const [open, setOpen] = useState(false)

  const run = (type: RuntimeEvent["type"]) => {
    const origin =
      type === "capture" ? "popup" : type === "join" ? "group_join" : type === "start" ? "private" : lead.origin
    const incoming = lead.nodeId ? lead : { ...lead, origin, funnelId: funnel.id }
    const now = type === "timer" && incoming.waitUntil ? new Date(incoming.waitUntil).getTime() + 1000 : Date.now()
    const result = applyEvent(snapshot, incoming, { type }, now)
    setLead(result.lead)
    onCursor(result.lead.nodeId)
    const lines = result.effects.map(effectLine)
    if (lines.length === 0) lines.push(`Passo · ${result.lead.stage}`)
    setLog((prev) => [...lines, ...prev].slice(0, 16))
  }

  const reset = () => {
    const next = blankLead()
    setLead(next)
    setLog([])
    onCursor(undefined)
  }

  return (
    <div className="absolute bottom-3 left-3 z-20 w-[min(360px,calc(100%-1.5rem))]">
      {!open ? (
        <Button size="sm" className="h-8 rounded-full text-[12px]" onClick={() => setOpen(true)}>
          <Play className="size-3.5" /> Testar fluxo
        </Button>
      ) : (
        <div className="rounded-2xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12px] font-medium">Simulador</p>
            <Button variant="ghost" size="sm" className="h-7 rounded-full text-[11px]" onClick={() => setOpen(false)}>
              Fechar
            </Button>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {lead.nodeId ? `No passo · ${lead.stage}` : "Ainda sem entrada"} · {lead.temperature}
            {lead.waitUntil ? " · à espera" : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {ACTIONS.map((action) => (
              <Button key={action.id} size="sm" variant="outline" className="h-7 rounded-full text-[11px]" onClick={() => run(action.id)}>
                {action.label}
              </Button>
            ))}
            <Button size="sm" variant="ghost" className="h-7 rounded-full text-[11px]" onClick={reset}>
              Reset
            </Button>
          </div>
          {log.length > 0 && (
            <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto text-[11px] text-muted-foreground">
              {log.map((line, index) => (
                <li key={`${line}-${index}`}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
