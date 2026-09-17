import { useEffect, useRef, useState } from "react"
import { MessagesSquare } from "lucide-react"
import { PageChrome, StatusPill } from "@/components/layout/chrome"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useStore } from "@/lib/store"
import { hasConversation } from "@/lib/ops"
import { TEMP_LABEL } from "@/lib/labels"
import { replySte } from "@/lib/ste"
import { timeAgo } from "@/lib/format"
import { cn } from "@/lib/utils"

export function ConversationsPage() {
  const { state, saveLead } = useStore()
  const rows = state.leads.filter((lead) => lead.channel === "telegram" && hasConversation(lead))
  const [id, setId] = useState<string | null>(null)
  const lead = rows.find((item) => item.id === id) ?? rows[0] ?? null
  const [draft, setDraft] = useState("")
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" })
  }, [lead?.id, lead?.messages?.length])

  const send = (event: React.FormEvent) => {
    event.preventDefault()
    if (!lead || lead.steBlocked) return
    const text = draft.trim()
    if (!text) return
    const result = replySte(lead, text)
    saveLead(result.lead)
    setDraft("")
  }

  return (
    <div className="h-full overflow-hidden">
      <div className="page-shell h-full !space-y-4">
        <PageChrome icon={MessagesSquare} title="Conversas" />
        {rows.length === 0 ? (
          <section className="surface grid place-items-center px-6 py-16 text-center">
            <p className="text-[14px] font-medium">Nenhuma conversa no Telegram</p>
            <p className="mt-1 max-w-md text-[13px] text-muted-foreground">
              /start ou uma captura Telegram abre a Sté. Ela manda uma frase e espera o lead.
            </p>
          </section>
        ) : (
          <section className="surface grid min-h-[520px] overflow-hidden md:grid-cols-[260px_1fr]">
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
              <div className="flex min-h-0 flex-col">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
                  <div>
                    <p className="text-[15px] font-medium">{lead.name}</p>
                    <p className="text-[12.5px] text-muted-foreground">
                      Sté · Telegram · {lead.contact} · {timeAgo(lead.updatedAt)}
                    </p>
                  </div>
                  <StatusPill tone={lead.steBlocked ? "danger" : lead.temperature === "quente" ? "danger" : "muted"}>
                    {lead.steBlocked ? "Encerrado" : TEMP_LABEL[lead.temperature]}
                  </StatusPill>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
                  {(lead.messages ?? []).map((item) => (
                    <div
                      key={item.id}
                      className={cn("max-w-[80%] rounded-2xl px-3.5 py-2.5", item.role === "ste" ? "bg-muted" : "ml-auto bg-sky-500/15")}
                    >
                      <p className="text-[10px] font-medium text-muted-foreground">{item.role === "ste" ? "Sté" : "Lead"}</p>
                      <p className="mt-0.5 text-[13.5px] leading-relaxed">{item.text}</p>
                    </div>
                  ))}
                  <div ref={end} />
                </div>
                <form onSubmit={send} className="flex gap-2 border-t border-border p-3">
                  <Input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={lead.steBlocked ? "Sté não responde mais este contacto." : "Mensagem do lead no Telegram…"}
                    disabled={lead.steBlocked}
                  />
                  <Button type="submit" className="rounded-full" disabled={lead.steBlocked || !draft.trim()}>
                    Enviar
                  </Button>
                </form>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
