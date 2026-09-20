import { useEffect, useMemo, useRef, useState } from "react"
import { Plus, Users } from "lucide-react"
import { PageChrome, StatusPill } from "@/components/layout/chrome"
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
import { needsEster } from "@/lib/ops"
import { applyEvent, nodeTitle, publishedSnapshot, type RuntimeEvent } from "@/lib/runtime"
import { timeAgo } from "@/lib/format"
import type { Lead, LeadOrigin, LeadTemp, SalesFunnel } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { GeoBadge } from "@/components/crm/geo-badge"
import { factsWithTrack } from "@/lib/geo"
import { useTrackSummary } from "@/lib/use-track-summary"

const FILTERS = [
  { id: "all", label: "Todos" },
  { id: "telegram", label: "Telegram" },
  { id: "novo", label: "Novos" },
  { id: "morno", label: "Mornos" },
  { id: "quente", label: "Quentes" },
  { id: "ester", label: "Fila Ester" },
  { id: "facebook", label: "Facebook" },
] as const

export function LeadsPage() {
  const { state, createLead, saveLead, deleteLead, crmSync, inboxSync, persistSync } = useStore()
  const { summary } = useTrackSummary(8000)
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all")
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const lead = state.leads.find((item) => item.id === selected) ?? null
  const snapshot = publishedSnapshot(state.funnels)

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return state.leads.filter((item) => {
      if (filter === "telegram" && item.channel !== "telegram") return false
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
            { ok: persistSync !== "error", message: "A gravação de leads no Worker falhou." },
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
                  {item.id === "all"
                    ? state.leads.length
                    : item.id === "ester"
                      ? state.leads.filter(needsEster).length
                      : item.id === "facebook"
                        ? state.leads.filter((row) => row.origin === "facebook").length
                        : item.id === "telegram"
                          ? state.leads.filter((row) => row.channel === "telegram").length
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

          {rows.length === 0 ? (
            <div className="grid place-items-center px-6 py-16 text-center">
              <p className="text-[14px] font-medium">{query.trim() ? "Nada nesta busca" : "Nenhum lead"}</p>
              <p className="mt-1 max-w-md text-[13px] text-muted-foreground">
                {query.trim()
                  ? "Nenhum nome, @user ou campanha bate com o recorte."
                  : "Popup, join ou /start entram no fluxo publicado. Só Telegram."}
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
                    <p className="text-[12.5px] text-muted-foreground">Telegram</p>
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
        esterNotify={state.settings.esterNotify}
        funnels={state.funnels}
        geos={summary.geos}
        onClose={() => setSelected(null)}
        onSave={saveLead}
        onDelete={(id) => {
          deleteLead(id)
          setSelected(null)
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
  onCreate: (lead: Lead) => void
  funnels: SalesFunnel[]
}) {
  const [name, setName] = useState("")
  const [contact, setContact] = useState("")
  const [origin, setOrigin] = useState<LeadOrigin>("popup")
  const [errors, setErrors] = useState<{ name?: string; contact?: string }>({})

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const check = validateCapture(name, contact)
    if (!check.ok) {
      setErrors(check.errors)
      return
    }
    onCreate(captureAgainstFunnels({ name, contact, channel: "telegram", origin }, funnels))
    toast.success("Lead no fluxo.")
    setName("")
    setContact("")
    setErrors({})
    onOpenChange(false)
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
  esterNotify,
  funnels,
  geos,
  onClose,
  onSave,
  onDelete,
}: {
  lead: Lead | null
  esterNotify: boolean
  funnels: SalesFunnel[]
  geos?: Record<string, { country?: string; countryCode?: string; city?: string; region?: string; regionCode?: string }>
  onClose: () => void
  onSave: (lead: Lead) => void
  onDelete: (id: string) => void
}) {
  const panel = useRef<HTMLElement>(null)
  const snapshot = publishedSnapshot(funnels)

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
        onClose()
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

  const run = (event: RuntimeEvent, ok: string, blocked?: string) => {
    const result = applyEvent(snapshot, lead, event)
    onSave(result.lead)
    const stop = result.effects.find((item) => item.kind === "blocked")
    if (stop) {
      toast.error(blocked ?? stop.reason)
      return
    }
    toast.success(ok)
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
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
          {lead.name}
        </h2>
        <p className="mt-1 text-[13px] text-muted-foreground">{lead.contact}</p>
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
              onClick={() => onSave({ ...lead, temperature: temp, updatedAt: new Date().toISOString() })}
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
            onClick={() => run({ type: "print" }, esterNotify ? "Aviso para a Ester: enviar a banca." : "Print no fluxo. A Sté não inventa banca.")}
          >
            Print do cadastro
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            disabled={!lead.printAt}
            onClick={() => run({ type: "banca" }, "Ester enviou a banca.", "Sem print não há banca.")}
          >
            Ester enviou a banca
          </Button>
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => run({ type: "resume" }, "Fluxo segue a partir da Sté.")}>
            Sté no 1:1 / seguir
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={() => {
              const when = lead.waitUntil ? new Date(lead.waitUntil).getTime() + 1000 : Date.now()
              const result = applyEvent(snapshot, lead, { type: "timer" }, when)
              onSave(result.lead)
              const offered = result.effects.some((item) => item.kind === "offer")
              toast.success(offered ? "Oferta disparada pelo fluxo." : "Espera avançada.")
            }}
          >
            Avançar espera / oferta
          </Button>
        </div>

        <Label htmlFor="lead-memory" className="mt-6">
          Memória individual (Sté)
        </Label>
        <Textarea
          id="lead-memory"
          className="mt-1.5 min-h-28"
          value={lead.memory}
          onChange={(event) => onSave({ ...lead, memory: event.target.value, updatedAt: new Date().toISOString() })}
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
          <Button variant="ghost" className="rounded-full" onClick={onClose}>
            Fechar
          </Button>
          <Button
            variant="ghost"
            className="rounded-full text-destructive"
            onClick={() => {
              if (!confirm("Remover este lead? Isto não se desfaz.")) return
              onDelete(lead.id)
              toast.success("Lead removido.")
            }}
          >
            Excluir lead
          </Button>
        </div>
      </aside>
    </div>
  )
}
