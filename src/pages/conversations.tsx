import { useEffect, useMemo, useRef, useState } from "react"
import { MessagesSquare } from "lucide-react"
import { FilterChip, PageChrome, StatusPill } from "@/components/layout/chrome"
import { HydratePanel } from "@/components/layout/hydrate-panel"
import { SyncBanner } from "@/components/layout/sync-banner"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { simulateOpenLead } from "@/lib/burst"
import { useStore } from "@/lib/store"
import { pixelFigure } from "@/lib/analytics-view"
import { hasConversation, leadsHydrating } from "@/lib/ops"
import { ORIGIN_LABEL, TEMP_LABEL } from "@/lib/labels"
import { GeoBadge } from "@/components/crm/geo-badge"
import { factsWithTrack } from "@/lib/geo"
import { publishedFunnel } from "@/lib/runtime"
import { advanceSteIfDue, canSimulateSte, canTickSteLocally, replySteLived, splitSteMarkup, steHeardChips, steRuntimeFromFunnels, steStepLabel, steWaitDelayMs } from "@/lib/ste"
import { useTrackSummary } from "@/lib/use-track-summary"
import { useRemoteLeadSearch } from "@/lib/use-lead-query"
import { timeAgo } from "@/lib/format"
import { displayContact, leadMatchesQuery } from "@/lib/lead-name"
import type { Lead } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

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
  const { state, saveLead, createLead, flushLeadNow, inboxSync, persistSync } = useStore()
  const hydrating = leadsHydrating(persistSync, state.leads.length)
  const { summary, status, hasData } = useTrackSummary(4000)
  const runtime = steRuntimeFromFunnels(state.funnels, state.settings)
  const runtimeKey = publishedFunnel(state.funnels)?.production?.publishedAt ?? ""
  const [filter, setFilter] = useState<FilterId>("waiting")
  const [query, setQuery] = useState("")
  useRemoteLeadSearch(query)
  const [shown, setShown] = useState(INBOX_CAP)
  const [id, setId] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const end = useRef<HTMLDivElement>(null)
  const sending = useRef(false)
  const simulating = useRef(false)
  const leadRef = useRef<Lead | null>(null)

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

  const matched = useMemo(() => {
    const needle = query.trim()
    const pool = needle ? all : all.filter((lead) => matchesFilter(lead, filter))
    if (!needle) return pool
    return pool.filter((lead) => leadMatchesQuery(lead, needle, 1))
  }, [all, filter, query])

  const rows = useMemo(() => {
    const cut = matched.slice(0, shown)
    if (id && matched.some((item) => item.id === id) && !cut.some((item) => item.id === id)) {
      const extra = matched.find((item) => item.id === id)
      if (extra) return [extra, ...cut]
    }
    return cut
  }, [matched, shown, id])

  const selected = id ? all.find((item) => item.id === id) ?? null : null
  const listed = Boolean(selected && rows.some((row) => row.id === selected.id))
  const lead = listed ? selected : id && selected ? null : rows[0] ?? null

  useEffect(() => {
    setShown(INBOX_CAP)
  }, [filter, query])

  useEffect(() => {
    leadRef.current = lead
  }, [lead])

  useEffect(() => {
    if (!lead || !canTickSteLocally(lead)) return
    const tick = () => {
      const current = leadRef.current
      if (!current || !canTickSteLocally(current)) return
      const result = advanceSteIfDue(current, Date.now(), runtime)
      if (result.replies.length) {
        saveLead(result.lead)
        void flushLeadNow()
      }
    }
    tick()
    const delay = steWaitDelayMs(lead.waitUntil)
    if (delay == null) return
    const timer = window.setTimeout(tick, delay)
    return () => window.clearTimeout(timer)
  }, [lead?.id, lead?.waitUntil, runtimeKey])

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" })
  }, [lead?.id, lead?.messages?.length])

  const send = (event: React.FormEvent) => {
    event.preventDefault()
    if (sending.current) return
    if (!lead || !canSimulateSte(lead)) return
    const text = draft.trim()
    if (!text) return
    sending.current = true
    const result = replySteLived(lead, text, Date.now(), runtime)
    saveLead(result.lead)
    setDraft("")
    void flushLeadNow()
      .then((ok) => {
        if (!ok) toast.error("Não gravei a fala no Worker.")
      })
      .finally(() => {
        sending.current = false
      })
  }

  return (
    <div className="h-full overflow-y-auto md:overflow-hidden">
      <div className="page-shell min-h-full !space-y-4 md:h-full md:min-h-0 md:flex md:flex-col">
        <SyncBanner
          items={[
            { ok: inboxSync !== "error", message: "A inbox do Telegram não sincronizou. Conversas novas podem faltar." },
            { ok: persistSync !== "error", message: "Não consegui gravar a simulação no Worker." },
          ]}
        />
        <PageChrome icon={MessagesSquare} title="Conversas">
          {FILTERS.map((item) => (
            <FilterChip key={item.id} active={filter === item.id} onClick={() => setFilter(item.id)}>
              {item.label} {hydrating && all.length === 0 ? "…" : counts[item.id]}
            </FilterChip>
          ))}
        </PageChrome>
        <FlowStrip
          page={pixelFigure(status, hasData, summary.visitors)}
          click={pixelFigure(status, hasData, summary.clicks)}
          telegram={hydrating && all.length === 0 ? "…" : all.length}
          talking={
            hydrating && all.length === 0
              ? "…"
              : all.filter((item) => (item.messages ?? []).some((msg) => msg.role === "lead") && !item.steBlocked && !item.steQuiet).length
          }
          premium={hydrating && all.length === 0 ? "…" : all.filter((item) => item.stePhase === "offer" || item.steQuiet).length}
        />
        {all.length === 0 && hydrating ? (
          <section className="surface">
            <HydratePanel>A carregar as conversas…</HydratePanel>
          </section>
        ) : all.length === 0 ? (
          <section className="surface grid place-items-center px-6 py-16 text-center">
            <p className="text-[14px] font-medium">Nenhuma conversa no Telegram</p>
            <p className="mt-1 max-w-md text-[13px] text-muted-foreground">
              O anúncio do Facebook usa t.me/BOT?start=fb. /start manda as 3 boas-vindas do quadro. Sem bot, podes simular uma conversa aqui — não envia Telegram.
            </p>
            <Button
              type="button"
              className="mt-5 rounded-full"
              onClick={() => {
                if (simulating.current) return
                simulating.current = true
                const lead = simulateOpenLead(state.funnels)
                void createLead(lead)
                  .then((ok) => {
                    setFilter("all")
                    setId(lead.id)
                    if (!ok) toast.error("Não gravei a conversa no Worker.")
                  })
                  .finally(() => {
                    simulating.current = false
                  })
              }}
            >
              Simular conversa
            </Button>
          </section>
        ) : (
          <section className="surface grid min-h-[520px] overflow-hidden md:min-h-0 md:flex-1 md:grid-cols-[280px_1fr]">
            <div className="flex min-h-0 flex-col border-b border-border md:border-b-0 md:border-r">
              <div className="border-b border-border p-3">
                <Label htmlFor="inbox-search" className="sr-only">
                  Buscar conversas
                </Label>
                <Input
                  id="inbox-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Nome, @user ou campanha"
                />
              </div>
              {rows.length === 0 ? (
                <p className="px-4 py-10 text-center text-[13px] text-muted-foreground">
                  Nada neste recorte. Limpa a busca ou escolhe Todas.
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
                  {matched.length > rows.length ? (
                    <li className="border-t border-border p-3">
                      <p className="text-center text-[11px] text-muted-foreground">
                        A mostrar {rows.length} de {matched.length}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        className="mt-1 h-8 w-full rounded-full text-[12px]"
                        onClick={() => setShown((value) => value + INBOX_CAP)}
                      >
                        Carregar mais
                      </Button>
                    </li>
                  ) : matched.length > INBOX_CAP ? (
                    <li className="px-4 py-3 text-center text-[11px] text-muted-foreground">
                      {matched.length} conversas neste recorte
                    </li>
                  ) : null}
                </ul>
              )}
            </div>
            {lead ? (
              <div className="flex min-h-0 flex-col">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
                  <div>
                    <p className="text-[15px] font-medium">{lead.name}</p>
                    <p className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted-foreground">
                      <span>
                        Sté · {steStepLabel(lead)} · {displayContact(lead.contact)} · {ORIGIN_LABEL[lead.origin]}
                      </span>
                      <GeoBadge facts={factsWithTrack(lead, summary.geos)} />
                    </p>
                    {steHeardChips(lead.facts).length > 0 && (
                      <p className="mt-1.5 flex flex-wrap gap-1">
                        {steHeardChips(lead.facts).map((chip) => (
                          <span key={chip} className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                            {chip}
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                  <StatusPill tone={lead.steQuiet || lead.steBlocked ? "danger" : lead.temperature === "quente" ? "danger" : "muted"}>
                    {lead.steQuiet ? "Quieto" : lead.steBlocked ? "Encerrado" : TEMP_LABEL[lead.temperature]}
                  </StatusPill>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4" aria-live="polite">
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
                              rel="noopener noreferrer"
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
                  <Label htmlFor="chat-draft" className="sr-only">
                    Mensagem como o lead
                  </Label>
                  <Input
                    id="chat-draft"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={
                      lead.telegramChatId
                        ? "Esta conversa corre no Telegram. Simular aqui dessincroniza o CRM."
                        : lead.steQuiet || lead.steBlocked
                          ? "Esta instância já silenciou."
                          : "Escreve como o lead. Isto não manda Telegram — só simula a Sté."
                    }
                    disabled={!canSimulateSte(lead)}
                  />
                  <Button type="submit" className="rounded-full" disabled={!canSimulateSte(lead) || !draft.trim()}>
                    Simular lead
                  </Button>
                </form>
              </div>
            ) : (
              <div className="grid place-items-center px-6 py-16 text-center">
                <p className="text-[14px] font-medium">Nada neste recorte</p>
                <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">
                  {id && selected && !listed
                    ? "A conversa escolhida não entra neste filtro. Limpa a busca ou escolhe Todas."
                    : "A lista à esquerda está vazia neste filtro. Limpa a busca ou escolhe Todas."}
                </p>
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
  page: string | number
  click: string | number
  telegram: string | number
  talking: string | number
  premium: string | number
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
