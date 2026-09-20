import { useEffect, useMemo, useRef, useState } from "react"
import { Plus, Users } from "lucide-react"
import { PageChrome, StatusPill } from "@/components/layout/chrome"
import { HydratePanel } from "@/components/layout/hydrate-panel"
import { SyncBanner } from "@/components/layout/sync-banner"
import { validateCapture } from "@/lib/capture"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useStore } from "@/lib/store"
import { captureAgainstFunnels } from "@/lib/templates"
import { ORIGIN_LABEL, STAGE_LABEL, TEMP_LABEL } from "@/lib/labels"
import { isImportedLead, needsEster } from "@/lib/ops"
import { applyEvent, nodeTitle, publishedSnapshot, type RuntimeEvent } from "@/lib/runtime"
import { canTickSteLocally } from "@/lib/ste"
import { timeAgo } from "@/lib/format"
import { resolvePersonName } from "@/lib/lead-name"
import type { Lead, LeadOrigin, LeadTemp, SalesFunnel } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { GeoBadge } from "@/components/crm/geo-badge"
import { factsWithTrack } from "@/lib/geo"
import { useTrackSummary } from "@/lib/use-track-summary"
import { useRemoteLeadSearch } from "@/lib/use-lead-query"

const FILTERS = [
  { id: "all", label: "Todos" },
  { id: "telegram", label: "Telegram" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "import", label: "Importados" },
  { id: "novo", label: "Novos" },
  { id: "morno", label: "Mornos" },
  { id: "quente", label: "Quentes" },
  { id: "ester", label: "Fila Ester" },
  { id: "facebook", label: "Facebook" },
] as const

export function LeadsPage() {
  const { state, createLead, saveLead, flushLeadNow, deleteLead, crmSync, inboxSync, persistSync } = useStore()
  const { summary } = useTrackSummary(8000)
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all")
  const [query, setQuery] = useState("")
  useRemoteLeadSearch(query)
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const lead = state.leads.find((item) => item.id === selected) ?? null
  const snapshot = publishedSnapshot(state.funnels)

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return state.leads.filter((item) => {
      if (filter === "telegram" && item.channel !== "telegram") return false
      if (filter === "whatsapp" && item.channel !== "whatsapp") return false
      if (filter === "import" && item.origin !== "import") return false
      if ((filter === "novo" || filter === "morno" || filter === "quente") && item.temperature !== filter) return false
      if (filter === "ester" && !needsEster(item)) return false
      if (filter === "facebook" && item.origin !== "facebook") return false
      if (!needle) return true
      return [item.name, item.contact, item.campaign].some((value) => (value ?? "").toLowerCase().includes(needle))
    })
  }, [filter, query, state.leads])

  return (
    <div className="h-full overflow-y-auto">
      <div className="page-shell">
        <SyncBanner
          items={[
            { ok: crmSync !== "error", message: "Não consegui ler o CRM do Worker." },
            { ok: inboxSync !== "error", message: "A inbox do Telegram não sincronizou." },
            { ok: persistSync !== "error", message: "Não consegui ler ou gravar leads no Worker." },
          ]}
        />
        <PageChrome icon={Users} title="Leads">
          <Button className="h-8 rounded-full px-3.5" onClick={() => setOpen(true)}>
            <Plus /> Nova captura
          </Button>
        </PageChrome>

        <section className="surface overflow-hidden">
          <div className="border-b border-border px-5 py-3">
            <Label htmlFor="lead-search" className="sr-only">
              Buscar leads
            </Label>
            <Input
              id="lead-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nome, @user ou campanha"
            />
          </div>
          <div className="flex flex-wrap gap-3 border-b border-border px-5 py-3 text-[13px]">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={filter === item.id}
                onClick={() => setFilter(item.id)}
                className={cn(
                  "min-h-8 pb-1",
                  filter === item.id ? "border-b-2 border-foreground font-medium" : "text-muted-foreground"
                )}
              >
                {item.label}{" "}
                <span className="text-muted-foreground">
                  {persistSync === "idle" && state.leads.length === 0
                    ? "…"
                    : item.id === "all"
                      ? state.leads.length
                      : item.id === "ester"
                        ? state.leads.filter(needsEster).length
                        : item.id === "facebook"
                          ? state.leads.filter((row) => row.origin === "facebook").length
                          : item.id === "import"
                            ? state.leads.filter((row) => row.origin === "import").length
                            : item.id === "telegram"
                              ? state.leads.filter((row) => row.channel === "telegram").length
                              : item.id === "whatsapp"
                                ? state.leads.filter((row) => row.channel === "whatsapp").length
                                : state.leads.filter((row) => row.temperature === item.id).length}
                </span>
              </button>
            ))}
          </div>

          <div className="hidden grid-cols-[1.1fr_150px_80px_80px_130px_80px] gap-3 border-b border-border px-5 py-2.5 text-[12px] text-muted-foreground md:grid">
            <p>Nome</p>
            <p>Estado</p>
            <p>Canal</p>
            <p>Temperatura</p>
            <p>Passo</p>
            <p>Quando</p>
          </div>

          {rows.length === 0 && persistSync === "idle" && !query.trim() && filter === "all" ? (
            <HydratePanel>A carregar os leads…</HydratePanel>
          ) : rows.length === 0 ? (
            <div className="grid place-items-center px-6 py-16 text-center">
              <p className="text-[14px] font-medium">
                {query.trim() ? "Nada nesta busca" : filter !== "all" ? "Nada neste recorte" : "Nenhum lead"}
              </p>
              <p className="mt-1 max-w-md text-[13px] text-muted-foreground">
                {query.trim()
                  ? "Nenhum nome, @user ou campanha bate com o recorte."
                  : filter !== "all"
                    ? "Este filtro está vazio. Escolhe Todos ou limpa a busca."
                    : "Popup, join ou /start entram no fluxo publicado. Importados da lista antiga ficam em WhatsApp."}
              </p>
            </div>
          ) : (
            <ul>
              {rows.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(item.id)}
                    className="grid w-full grid-cols-1 gap-1 border-b border-border px-5 py-3.5 text-left last:border-0 hover:bg-muted/30 md:grid-cols-[1.1fr_150px_80px_80px_130px_80px] md:items-center md:gap-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-medium">{item.name}</p>
                      <p className="truncate text-[12px] text-muted-foreground">{item.contact}</p>
                    </div>
                    <GeoBadge facts={factsWithTrack(item, summary.geos)} className="text-[12.5px]" />
                    <p className="text-[12.5px] text-muted-foreground">{item.channel === "whatsapp" ? "WhatsApp" : "Telegram"}</p>
                    <StatusPill tone={item.temperature === "quente" ? "danger" : item.temperature === "morno" ? "warn" : "muted"}>
                      {TEMP_LABEL[item.temperature]}
                    </StatusPill>
                    <p className="truncate text-[12.5px]">{nodeTitle(snapshot, item.nodeId) ?? STAGE_LABEL[item.stage]}</p>
                    <p className="text-[12px] text-muted-foreground">{timeAgo(item.updatedAt)}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <CaptureDialog open={open} onOpenChange={setOpen} onCreate={createLead} funnels={state.funnels} />
      <LeadDrawer
        lead={lead}
        funnels={state.funnels}
        geos={summary.geos}
        onClose={() => setSelected(null)}
        onSave={saveLead}
        onFlush={flushLeadNow}
        onDelete={async (id) => {
          const ok = await deleteLead(id)
          if (ok) setSelected(null)
          return ok
        }}
      />
    </div>
  )
}

function CaptureDialog({
  open,
  onOpenChange,
  onCreate,
  funnels,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (lead: Lead) => void | Promise<boolean>
  funnels: SalesFunnel[]
}) {
  const [name, setName] = useState("")
  const [contact, setContact] = useState("")
  const [origin, setOrigin] = useState<LeadOrigin>("popup")
  const [errors, setErrors] = useState<{ name?: string; contact?: string }>({})
  const creating = useRef(false)

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (creating.current) return
    const check = validateCapture(name, contact)
    if (!check.ok) {
      setErrors(check.errors)
      return
    }
    creating.current = true
    const created = captureAgainstFunnels({ name, contact, channel: "telegram", origin }, funnels)
    void Promise.resolve(onCreate(created))
      .then((ok) => {
        if (ok === false) {
          toast.error("Não gravei o lead no Worker.")
          return
        }
        toast.success("Lead no fluxo.")
        setName("")
        setContact("")
        setErrors({})
        onOpenChange(false)
      })
      .catch(() => {
        toast.error("Não gravei o lead no Worker.")
      })
      .finally(() => {
        creating.current = false
      })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova captura</DialogTitle>
          <DialogDescription>O lead entra no funil publicado — não numa planilha.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Field
            id="lead-name"
            label="Nome"
            value={name}
            error={errors.name}
            onChange={(value) => {
              setName(value)
              setErrors((prev) => ({ ...prev, name: undefined }))
            }}
          />
          <Field
            id="lead-contact"
            label="Contacto"
            value={contact}
            error={errors.contact}
            onChange={(value) => {
              setContact(value)
              setErrors((prev) => ({ ...prev, contact: undefined }))
            }}
            placeholder="@user do Telegram"
          />
          <div className="space-y-1.5">
            <Label htmlFor="lead-origin">Origem</Label>
            <select
              id="lead-origin"
              value={origin}
              onChange={(event) => setOrigin(event.target.value as LeadOrigin)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="popup">Popup mini curso (Stefany)</option>
              <option value="group_join">Join no grupo</option>
              <option value="private">Privado /start</option>
              <option value="facebook">Facebook → Telegram</option>
              <option value="closing">Fechamento</option>
            </select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">Guardar no CRM</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  error,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  error?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[12px] text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function LeadDrawer({
  lead,
  funnels,
  geos,
  onClose,
  onSave,
  onFlush,
  onDelete,
}: {
  lead: Lead | null
  funnels: SalesFunnel[]
  geos?: Record<string, { country?: string; countryCode?: string; city?: string; region?: string; regionCode?: string }>
  onClose: () => void
  onSave: (lead: Lead) => void
  onFlush?: () => Promise<boolean>
  onDelete: (id: string) => void | Promise<boolean>
}) {
  const panel = useRef<HTMLElement>(null)
  const snapshot = publishedSnapshot(funnels)
  const [memory, setMemory] = useState(lead?.memory ?? "")
  const [name, setName] = useState(lead?.name ?? "")
  const memoryRef = useRef(memory)
  const nameRef = useRef(name)
  const dirtyMemory = useRef(false)
  const dirtyName = useRef(false)
  const leadRef = useRef(lead)

  useEffect(() => {
    memoryRef.current = memory
  }, [memory])

  useEffect(() => {
    nameRef.current = name
  }, [name])

  const flushEdits = () => {
    const current = leadRef.current
    if (!current) return
    const nextName = dirtyName.current ? resolvePersonName(nameRef.current) || current.name : current.name
    const nextMemory = dirtyMemory.current ? memoryRef.current : current.memory
    if (!dirtyName.current && !dirtyMemory.current) return
    dirtyName.current = false
    dirtyMemory.current = false
    onSave({ ...current, name: nextName, memory: nextMemory, updatedAt: new Date().toISOString() })
  }

  const commit = (next: Lead) => {
    onSave({
      ...next,
      name: dirtyName.current ? resolvePersonName(nameRef.current) || next.name : next.name,
      memory: memoryRef.current,
    })
  }

  const close = () => {
    flushEdits()
    void onFlush?.()
    onClose()
  }

  useEffect(() => {
    return () => {
      flushEdits()
      void onFlush?.()
    }
  }, [lead?.id])

  useEffect(() => {
    leadRef.current = lead
  }, [lead])

  useEffect(() => {
    dirtyMemory.current = false
    dirtyName.current = false
    setMemory(lead?.memory ?? "")
    setName(lead?.name ?? "")
  }, [lead?.id])

  useEffect(() => {
    if (!lead) return
    const root = panel.current
    root?.focus()
    const focusables = () =>
      [...(root?.querySelectorAll<HTMLElement>("button, [href], input, textarea, select, [tabindex]:not([tabindex='-1'])") ?? [])].filter(
        (el) => !el.hasAttribute("disabled")
      )
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close()
        return
      }
      if (event.key !== "Tab" || !root) return
      const items = focusables()
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [lead, onClose])

  if (!lead) return null

  const localFlow = canTickSteLocally(lead)
  const run = (
    event: RuntimeEvent,
    ok: string | ((effects: ReturnType<typeof applyEvent>["effects"]) => string),
    blocked?: string,
    when?: number
  ) => {
    const current = leadRef.current ?? lead
    if (!canTickSteLocally(current)) {
      toast.error(
        isImportedLead(current)
          ? "Lista importada. A Sté não fala aqui — só nota e temperatura."
          : "Este chat corre no Telegram. A ficha não avança o quadro."
      )
      return
    }
    const result = applyEvent(snapshot, { ...current, memory: memoryRef.current }, event, when)
    commit(result.lead)
    const stop = result.effects.find((item) => item.kind === "blocked")
    if (stop) {
      toast.error(blocked ?? stop.reason)
      return
    }
    const message = typeof ok === "function" ? ok(result.effects) : ok
    void (onFlush?.() ?? Promise.resolve(true)).then((saved) => {
      if (saved) toast.success(message)
      else toast.error("Não gravei o lead no Worker.")
    })
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Fechar ficha do lead"
        onClick={close}
      />
      <aside
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-drawer-title"
        tabIndex={-1}
        className="relative z-10 flex h-full w-full max-w-md flex-col overflow-y-auto bg-card p-6 shadow-xl outline-none"
      >
        <p className="text-[12px] text-muted-foreground">
          {ORIGIN_LABEL[lead.origin]} · {lead.campaign}
        </p>
        <h2 id="lead-drawer-title" className="mt-1 text-[20px] font-medium tracking-tight">
          {name || lead.name}
        </h2>
        <p className="mt-1 text-[13px] text-muted-foreground">{lead.contact}</p>
        <Label htmlFor="lead-display-name" className="mt-4">
          Nome
        </Label>
        <Input
          id="lead-display-name"
          className="mt-1.5"
          value={name}
          onChange={(event) => {
            dirtyName.current = true
            setName(event.target.value)
          }}
          onBlur={() => {
            if (!dirtyName.current) return
            const resolved = resolvePersonName(nameRef.current) || lead.name
            nameRef.current = resolved
            setName(resolved)
            flushEdits()
          }}
          placeholder="Nome da pessoa"
        />
        <p className="mt-2 text-[13.5px] font-medium">
          <GeoBadge facts={factsWithTrack(lead, geos)} empty="Estado ainda sem rastreio" />
        </p>
        <p className="mt-2 text-[12.5px] text-muted-foreground">
          Passo · {nodeTitle(snapshot, lead.nodeId) ?? STAGE_LABEL[lead.stage]}
          {lead.waitUntil ? " · à espera" : ""}
          {lead.paused ? " · pausado" : ""}
        </p>

        <div className="mt-5 flex flex-wrap gap-1.5">
          {(["novo", "morno", "quente"] as LeadTemp[]).map((temp) => (
            <button
              key={temp}
              type="button"
              aria-pressed={lead.temperature === temp}
              onClick={() => commit({ ...lead, temperature: temp, updatedAt: new Date().toISOString() })}
              className={cn(
                "h-7 rounded-full px-2.5 text-[12px]",
                lead.temperature === temp ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
              )}
            >
              {TEMP_LABEL[temp]}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            disabled={!localFlow}
            onClick={() => run({ type: "print" }, "Print marcado no CRM. A Ester só é avisada se o Worker tiver ESTER_CHAT_ID.")}
          >
            Print do cadastro
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            disabled={!localFlow || !lead.printAt}
            onClick={() => run({ type: "banca" }, "Banca marcada no CRM.", "Sem print não há banca.")}
          >
            Ester enviou a banca
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            disabled={!localFlow}
            onClick={() => run({ type: "resume" }, "Quadro avançado no CRM.")}
          >
            Sté no 1:1 / seguir
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            disabled={!localFlow}
            onClick={() => {
              const when = lead.waitUntil ? new Date(lead.waitUntil).getTime() + 1000 : Date.now()
              run(
                { type: "timer" },
                (effects) =>
                  effects.some((item) => item.kind === "offer")
                    ? "Oferta marcada no CRM. Nada foi enviado."
                    : "Espera avançada no CRM.",
                undefined,
                when
              )
            }}
          >
            Avançar espera / oferta
          </Button>
        </div>
        {!localFlow ? (
          <p className="mt-3 text-[12.5px] text-muted-foreground">
            {isImportedLead(lead)
              ? "Lista importada. A Sté não fala aqui — só nota e temperatura."
              : "Este chat corre no Telegram. Print, espera e oferta ficam no bot — a ficha só guarda nota e temperatura."}
          </p>
        ) : null}

        <Label htmlFor="lead-memory" className="mt-6">
          Memória individual (Sté)
        </Label>
        <Textarea
          id="lead-memory"
          className="mt-1.5 min-h-28"
          value={memory}
          onChange={(event) => {
            dirtyMemory.current = true
            setMemory(event.target.value)
          }}
          placeholder="O que esta pessoa já disse. Não misturar com outro chat."
        />

        {lead.events.length > 0 && (
          <ul className="mt-5 space-y-2 text-[12.5px] text-muted-foreground">
            {lead.events.slice(-8).reverse().map((item) => (
              <li key={item.id}>
                <span className="font-medium text-foreground">{item.title ?? item.kind}</span>
                {item.body ? ` · ${item.body}` : ""}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto flex flex-wrap gap-2 pt-6">
          <Button variant="ghost" className="rounded-full" data-lead-close onClick={close}>
            Fechar
          </Button>
          <Button
            variant="ghost"
            className="rounded-full text-destructive"
            onClick={() => {
              if (!confirm("Remover este lead? Isto não se desfaz.")) return
              dirtyMemory.current = false
              void Promise.resolve(onDelete(lead.id)).then((ok) => {
                if (ok === false) toast.error("Não removi o lead no Worker.")
                else toast.success("Lead removido.")
              })
            }}
          >
            Excluir lead
          </Button>
        </div>
      </aside>
    </div>
  )
}
