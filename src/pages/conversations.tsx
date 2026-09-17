import { useState } from "react"
import { MessagesSquare } from "lucide-react"
import { PageChrome, StatusPill } from "@/components/layout/chrome"
import { useStore } from "@/lib/store"
import { hasConversation } from "@/lib/ops"
import { TEMP_LABEL } from "@/lib/labels"
import { nodeTitle, publishedSnapshot } from "@/lib/runtime"
import { timeAgo } from "@/lib/format"
import type { LeadEvent } from "@/lib/types"
import { cn } from "@/lib/utils"

export function ConversationsPage() {
  const { state } = useStore()
  const rows = state.leads.filter(hasConversation)
  const [id, setId] = useState<string | null>(null)
  const lead = rows.find((item) => item.id === id) ?? rows[0] ?? null
  const snapshot = publishedSnapshot(state.funnels)

  return (
    <div className="h-full overflow-hidden">
      <div className="page-shell h-full !space-y-4">
        <PageChrome icon={MessagesSquare} title="Conversas" />
        {rows.length === 0 ? (
          <section className="surface grid place-items-center px-6 py-16 text-center">
            <p className="text-[14px] font-medium">Nenhuma conversa</p>
            <p className="mt-1 max-w-md text-[13px] text-muted-foreground">
              Join ou /start entram no fluxo publicado. As bolhas são os eventos do runtime — não um chat inventado.
            </p>
          </section>
        ) : (
          <section className="surface grid min-h-[520px] overflow-hidden md:grid-cols-[280px_1fr]">
            <ul className="border-b border-border md:border-b-0 md:border-r">
              {rows.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setId(item.id)}
                    className={cn(
                      "w-full border-b border-border px-4 py-3.5 text-left last:border-0",
                      lead?.id === item.id ? "bg-muted/40" : "hover:bg-muted/20"
                    )}
                  >
                    <p className="truncate text-[13.5px] font-medium">{item.name}</p>
                    <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{item.lastMessage}</p>
                  </button>
                </li>
              ))}
            </ul>
            {lead && (
              <div className="flex flex-col p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[15px] font-medium">{lead.name}</p>
                    <p className="text-[12.5px] text-muted-foreground">
                      {nodeTitle(snapshot, lead.nodeId) ?? "Fluxo"} · {lead.campaign} · {timeAgo(lead.updatedAt)}
                    </p>
                  </div>
                  <StatusPill tone={lead.temperature === "quente" ? "danger" : lead.temperature === "morno" ? "warn" : "muted"}>
                    {TEMP_LABEL[lead.temperature]}
                  </StatusPill>
                </div>
                <div className="mt-6 space-y-3 overflow-y-auto">
                  {lead.events.length === 0 && <Bubble who="mapa" text="Ainda sem eventos do fluxo." />}
                  {lead.events.map((item) => (
                    <EventBubble key={item.id} event={item} />
                  ))}
                  {lead.memory && <Bubble who="memoria" text={lead.memory} />}
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}

function EventBubble({ event }: { event: LeadEvent }) {
  const who =
    event.kind === "handoff"
      ? "ste"
      : event.kind === "notify_ester" || event.kind === "print" || event.kind === "banca"
        ? "ester"
        : event.kind === "blocked"
          ? "mapa"
          : "fluxo"
  return <Bubble who={who} text={event.body || event.title || event.kind} />
}

function Bubble({ who, text }: { who: "ste" | "mapa" | "memoria" | "ester" | "fluxo"; text?: string }) {
  if (!text) return null
  const label =
    who === "ste" ? "Sté" : who === "ester" ? "Ester" : who === "memoria" ? "Memória" : who === "fluxo" ? "Fluxo" : "Campanha"
  return (
    <div className="max-w-lg rounded-2xl bg-muted px-4 py-3">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-[13.5px] leading-relaxed">{text}</p>
    </div>
  )
}
