import { useEffect, useMemo, useRef, useState } from "react"
import { MessagesSquare } from "lucide-react"
import { FilterChip, PageChrome, StatusPill } from "@/components/layout/chrome"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { migrateLead } from "@/lib/migrate"
import { useStore } from "@/lib/store"
import { hasConversation } from "@/lib/ops"
import { ORIGIN_LABEL, TEMP_LABEL } from "@/lib/labels"
import { GeoBadge } from "@/components/crm/geo-badge"
import { factsWithTrack } from "@/lib/geo"
import { advanceSteIfDue, replySte, splitSteMarkup, steRuntimeFromSettings, steStepLabel } from "@/lib/ste"
import { useTrackSummary } from "@/lib/use-track-summary"
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
  const { state, saveLead, createLeads } = useStore()
  const { summary } = useTrackSummary(4000)
  const runtime = steRuntimeFromSettings(state.settings)
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
    const result = advanceSteIfDue(lead, Date.now(), runtime)
    if (result.replies.length) saveLead(result.lead)
  }, [lead?.id, lead?.waitUntil])

  useEffect(() => {
    const pull = async () => {
      const res = await fetch("/api/inbox", { credentials: "include", cache: "no-store" })
      if (!res.ok) return
      const data = (await res.json()) as { leads?: Lead[] }
      const incoming = (data.leads ?? []).map((item) => migrateLead(item))
      if (!incoming.length) return
      const known = new Map(state.leads.map((item) => [item.id, item]))
      const fresh = incoming.filter((item) => {
        const current = known.get(item.id)
        return !current || current.updatedAt < item.updatedAt
      })
      if (!fresh.length) return
      const existingIds = new Set(state.leads.map((item) => item.id))
      const created = fresh.filter((item) => !existingIds.has(item.id))
      if (created.length) createLeads(created)
      for (const item of fresh.filter((row) => existingIds.has(row.id))) saveLead(item)
    }
    void pull()
    const timer = window.setInterval(() => void pull(), 4000)
    return () => window.clearInterval(timer)
  }, [createLeads, saveLead, state.leads])

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" })
  }, [lead?.id, lead?.messages?.length])

  const send = (event: React.FormEvent) => {
    event.preventDefault()
    if (!lead || lead.steBlocked || lead.steQuiet) return
    const text = draft.trim()
    if (!text) return
    const result = replySte(lead, text, Date.now(), runtime)
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
        <FlowStrip
          page={summary.visitors}
          click={summary.clicks}
          telegram={all.length}
          talking={all.filter((item) => (item.messages ?? []).some((msg) => msg.role === "lead") && !item.steBlocked && !item.steQuiet).length}
          premium={all.filter((item) => item.stePhase === "offer" || item.steQuiet).length}
        />
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
                        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span>
                            {steStepLabel(item)} · {ORIGIN_LABEL[item.origin]}
                          </span>
                          <GeoBadge facts={factsWithTrack(item, summary.geos)} />
                        </p>
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
                    <p className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted-foreground">
                      <span>
                        Sté · {steStepLabel(lead)} · {lead.contact} · {ORIGIN_LABEL[lead.origin]}
                      </span>
                      <GeoBadge facts={factsWithTrack(lead, summary.geos)} />
                    </p>
                  </div>
                  <StatusPill tone={lead.steQuiet || lead.steBlocked ? "danger" : lead.temperature === "quente" ? "danger" : "muted"}>
                    {lead.steQuiet ? "Quieto" : lead.steBlocked ? "Encerrado" : TEMP_LABEL[lead.temperature]}
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
                    placeholder={
                      lead.steQuiet || lead.steBlocked ? "Esta instância já silenciou." : "Mensagem do lead no Telegram…"
                    }
                    disabled={lead.steBlocked || lead.steQuiet}
                  />
                  <Button type="submit" className="rounded-full" disabled={lead.steBlocked || lead.steQuiet || !draft.trim()}>
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

function FlowStrip({
  page,
  click,
  telegram,
  talking,
  premium,
}: {
  page: number
  click: number
  telegram: number
  talking: number
  premium: number
}) {
  const steps = [
    { label: "Página", value: page },
    { label: "Clique", value: click },
    { label: "Telegram", value: telegram },
    { label: "Sté", value: talking },
    { label: "Premium", value: premium },
  ]
  return (
    <section className="surface flex flex-wrap items-center gap-2 px-4 py-3">
      {steps.map((step, index) => (
        <div key={step.label} className="flex items-center gap-2">
          {index > 0 && <span className="text-muted-foreground">→</span>}
          <div>
            <p className="text-[11px] text-muted-foreground">{step.label}</p>
            <p className="text-[18px] font-medium tabular-nums">{step.value}</p>
          </div>
        </div>
      ))}
    </section>
  )
}
