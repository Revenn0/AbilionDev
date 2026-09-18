import { useEffect, useMemo, useRef, useState } from "react"
import { MessagesSquare } from "lucide-react"
import { FilterChip, PageChrome, StatusPill } from "@/components/layout/chrome"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useStore } from "@/lib/store"
import { hasConversation } from "@/lib/ops"
import { ORIGIN_LABEL, TEMP_LABEL } from "@/lib/labels"
import { advanceSteIfDue, replySte, splitSteMarkup } from "@/lib/ste"
import { timeAgo } from "@/lib/format"
import type { Lead } from "@/lib/types"
import { cn } from "@/lib/utils"

const INBOX_CAP = 80

const FILTERS = [
  { id: "waiting", label: "Aguardando" },
  { id: "today", label: "Hoje" },
  { id: "facebook", label: "Facebook" },
  { id: "all", label: "Todas" },
] as const

type FilterId = (typeof FILTERS)[number]["id"]

function startOfDay(ms = Date.now()) {
  const date = new Date(ms)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function awaitingReply(lead: Lead) {
  if (lead.steBlocked) return false
  const last = lead.messages?.[lead.messages.length - 1]
  return last?.role === "ste"
}

function matchesFilter(lead: Lead, filter: FilterId) {
  if (filter === "waiting") return awaitingReply(lead)
  if (filter === "today") return new Date(lead.updatedAt).getTime() >= startOfDay()
  if (filter === "facebook") return lead.origin === "facebook"
  return true
}

export function ConversationsPage() {
  const { state, saveLead } = useStore()
  const [filter, setFilter] = useState<FilterId>("waiting")
  const [query, setQuery] = useState("")
  const [id, setId] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const end = useRef<HTMLDivElement>(null)

  const all = useMemo(
    () =>
      state.leads
        .filter((lead) => lead.channel === "telegram" && hasConversation(lead))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [state.leads]
  )

  const counts = useMemo(
    () => ({
      waiting: all.filter((lead) => matchesFilter(lead, "waiting")).length,
      today: all.filter((lead) => matchesFilter(lead, "today")).length,
      facebook: all.filter((lead) => matchesFilter(lead, "facebook")).length,
      all: all.length,
    }),
    [all]
  )

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return all
      .filter((lead) => matchesFilter(lead, filter))
      .filter((lead) => {
        if (!needle) return true
        return [lead.name, lead.contact, lead.campaign, lead.lastMessage].some((value) =>
          (value ?? "").toLowerCase().includes(needle)
        )
      })
      .slice(0, INBOX_CAP)
  }, [all, filter, query])

  const lead = rows.find((item) => item.id === id) ?? rows[0] ?? null

  useEffect(() => {
    if (!lead) return
    const result = advanceSteIfDue(lead)
    if (result.replies.length) saveLead(result.lead)
  }, [lead?.id, lead?.waitUntil])

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
        <PageChrome icon={MessagesSquare} title="Conversas">
          {FILTERS.map((item) => (
            <FilterChip key={item.id} active={filter === item.id} onClick={() => setFilter(item.id)}>
              {item.label} {counts[item.id]}
            </FilterChip>
          ))}
        </PageChrome>
        {all.length === 0 ? (
          <section className="surface grid place-items-center px-6 py-16 text-center">
            <p className="text-[14px] font-medium">Nenhuma conversa no Telegram</p>
            <p className="mt-1 max-w-md text-[13px] text-muted-foreground">
              O anúncio do Facebook usa t.me/BOT?start=fb. /start abre a Sté com 3 boas-vindas e espera a resposta.
            </p>
          </section>
        ) : (
          <section className="surface grid min-h-[520px] overflow-hidden md:grid-cols-[280px_1fr]">
            <div className="flex min-h-0 flex-col border-b border-border md:border-b-0 md:border-r">
              <div className="border-b border-border p-3">
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Nome, @user ou campanha"
                />
              </div>
              {rows.length === 0 ? (
                <p className="px-4 py-10 text-center text-[13px] text-muted-foreground">
                  Nada neste recorte. A inbox mostra no máximo {INBOX_CAP} conversas.
                </p>
              ) : (
                <ul className="min-h-0 flex-1 overflow-y-auto">
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
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-[13.5px] font-medium">{item.name}</p>
                          <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(item.updatedAt)}</span>
                        </div>
                        <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{item.lastMessage}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">{ORIGIN_LABEL[item.origin]}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {lead && (
              <div className="flex min-h-0 flex-col">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
                  <div>
                    <p className="text-[15px] font-medium">{lead.name}</p>
                    <p className="text-[12.5px] text-muted-foreground">
                      Sté · Telegram · {lead.contact} · {ORIGIN_LABEL[lead.origin]}
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
                      <p className="mt-0.5 text-[13.5px] leading-relaxed">
                        {splitSteMarkup(item.text).map((part, index) =>
                          part.type === "link" ? (
                            <a
                              key={`${item.id}-${index}`}
                              href={part.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary underline underline-offset-2"
                            >
                              {part.text}
                            </a>
                          ) : (
                            <span key={`${item.id}-${index}`}>{part.text}</span>
                          )
                        )}
                      </p>
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
