import { useMemo, useState } from "react"
import { Plus, Users } from "lucide-react"
import { PageChrome, StatusPill } from "@/components/layout/chrome"
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
import { nodeTitle, publishedSnapshot } from "@/lib/runtime"
import { timeAgo } from "@/lib/format"
import type { Lead, LeadChannel, LeadOrigin, LeadTemp, SalesFunnel } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const FILTERS = [
  { id: "all", label: "Todos" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "telegram", label: "Telegram" },
  { id: "novo", label: "Novos" },
  { id: "morno", label: "Mornos" },
  { id: "quente", label: "Quentes" },
  { id: "ester", label: "Fila Ester" },
  { id: "facebook", label: "Facebook" },
] as const

export function LeadsPage() {
  const { state, createLead, saveLead } = useStore()
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all")
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const lead = state.leads.find((item) => item.id === selected) ?? null
  const snapshot = publishedSnapshot(state.funnels)

  const rows = useMemo(() => {
    return state.leads.filter((item) => {
      if (filter === "whatsapp" || filter === "telegram") return item.channel === filter
      if (filter === "novo" || filter === "morno" || filter === "quente") return item.temperature === filter
      if (filter === "ester") return needsEster(item)
      if (filter === "facebook") return item.origin === "facebook"
      return true
    })
  }, [filter, state.leads])

  return (
    <div className="h-full overflow-y-auto">
      <div className="page-shell">
        <PageChrome icon={Users} title="Leads">
          <Button className="h-8 rounded-full px-3.5" onClick={() => setOpen(true)}>
            <Plus /> Nova captura
          </Button>
        </PageChrome>

        <section className="surface overflow-hidden">
          <div className="flex flex-wrap gap-3 border-b border-border px-5 py-3 text-[13px]">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={cn(
                  "pb-1",
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
                        : item.id === "whatsapp" || item.id === "telegram"
                          ? state.leads.filter((row) => row.channel === item.id).length
                          : state.leads.filter((row) => row.temperature === item.id).length}
                </span>
              </button>
            ))}
          </div>

          <div className="hidden grid-cols-[1.2fr_90px_90px_140px_90px] gap-3 border-b border-border px-5 py-2.5 text-[12px] text-muted-foreground md:grid">
            <p>Nome</p>
            <p>Canal</p>
            <p>Temperatura</p>
            <p>Passo</p>
            <p>Quando</p>
          </div>

          {rows.length === 0 ? (
            <div className="grid place-items-center px-6 py-16 text-center">
              <p className="text-[14px] font-medium">Nenhum lead</p>
              <p className="mt-1 max-w-md text-[13px] text-muted-foreground">
                Popup, join ou /start viram lead no CRM. A Sté atende pelo prompt, não pelo quadro.
              </p>
            </div>
          ) : (
            <ul>
              {rows.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(item.id)}
                    className="grid w-full grid-cols-1 gap-1 border-b border-border px-5 py-3.5 text-left last:border-0 hover:bg-muted/30 md:grid-cols-[1.2fr_90px_90px_140px_90px] md:items-center md:gap-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-medium">{item.name}</p>
                      <p className="truncate text-[12px] text-muted-foreground">{item.contact}</p>
                    </div>
                    <p className="text-[12.5px] text-muted-foreground">{item.channel === "telegram" ? "Telegram" : "WhatsApp"}</p>
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
        onClose={() => setSelected(null)}
        onSave={saveLead}
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
  const [channel, setChannel] = useState<LeadChannel>("telegram")
  const [origin, setOrigin] = useState<LeadOrigin>("popup")

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim() || !contact.trim()) return
    onCreate(captureAgainstFunnels({ name, contact, channel, origin }, funnels))
    toast.success("Lead no CRM.")
    setName("")
    setContact("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova captura</DialogTitle>
          <DialogDescription>O lead entra no CRM. O funil é só o mapa visual.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Field id="lead-name" label="Nome" value={name} onChange={setName} />
          <Field id="lead-contact" label="Contacto" value={contact} onChange={setContact} placeholder="@user ou telemóvel" />
          <div className="space-y-1.5">
            <Label htmlFor="lead-channel">Campanha</Label>
            <select
              id="lead-channel"
              value={channel}
              onChange={(event) => setChannel(event.target.value as LeadChannel)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="telegram">Telegram · convite do grupo</option>
              <option value="whatsapp">WhatsApp · grupo</option>
            </select>
          </div>
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
            <Button type="submit" disabled={!name.trim() || !contact.trim()}>
              Guardar no CRM
            </Button>
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
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}

function LeadDrawer({
  lead,
  esterNotify,
  funnels,
  onClose,
  onSave,
}: {
  lead: Lead | null
  esterNotify: boolean
  funnels: SalesFunnel[]
  onClose: () => void
  onSave: (lead: Lead) => void
}) {
  if (!lead) return null
  const snapshot = publishedSnapshot(funnels)
  const stamp = () => new Date().toISOString()

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col overflow-y-auto bg-card p-6 shadow-xl">
        <p className="text-[12px] text-muted-foreground">
          {ORIGIN_LABEL[lead.origin]} · {lead.campaign}
        </p>
        <h2 className="mt-1 text-[20px] font-medium tracking-tight">{lead.name}</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">{lead.contact}</p>
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
            onClick={() => {
              const at = stamp()
              onSave({ ...lead, printAt: at, updatedAt: at })
              toast.success(esterNotify ? "Aviso para a Ester: enviar a banca." : "Print registado. A Sté não inventa banca.")
            }}
          >
            Print do cadastro
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            disabled={!lead.printAt}
            onClick={() => {
              if (!lead.printAt) {
                toast.error("Sem print não há banca.")
                return
              }
              const at = stamp()
              onSave({ ...lead, bancaAt: at, updatedAt: at })
              toast.success("Ester enviou a banca.")
            }}
          >
            Ester enviou a banca
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={() => {
              const at = stamp()
              onSave({ ...lead, paused: false, updatedAt: at })
              toast.success("Lead volta ao 1:1 da Sté.")
            }}
          >
            Sté no 1:1 / seguir
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

        <div className="mt-auto pt-6">
          <Button variant="ghost" className="rounded-full" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </aside>
    </div>
  )
}
