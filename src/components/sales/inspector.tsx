import { Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { SalesNodeData } from "@/lib/types"
import type { SalesCanvasNode } from "./nodes"

const CHANNELS: { id: NonNullable<SalesNodeData["channel"]>; label: string }[] = [
  { id: "youtube", label: "YouTube" },
  { id: "google", label: "Google" },
  { id: "meta", label: "Meta" },
  { id: "organic", label: "Orgânico" },
]

export function SalesInspector({
  node,
  readOnly,
  onChange,
  onDelete,
  onClose,
}: {
  node?: SalesCanvasNode
  readOnly?: boolean
  onChange: (id: string, patch: SalesCanvasNode["data"]) => void
  onDelete: () => void
  onClose: () => void
}) {
  if (!node) return null
  const d = node.data
  const set = (patch: Partial<typeof d>) => onChange(node.id, { ...d, ...patch })

  return (
    <aside className="absolute top-2 right-2 bottom-2 z-20 w-[300px] space-y-3.5 overflow-y-auto rounded-2xl border border-border bg-card/95 p-4 shadow-[0_16px_40px_-24px_rgb(0_0_0/0.7)] backdrop-blur-md">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {node.type === "traffic" || node.type === "split" || node.type === "sales_page" ? "Funil" : "Mensagem"}
          {readOnly ? " · produção" : ""}
        </p>
        <Button variant="ghost" size="icon-xs" aria-label="Fechar" onClick={onClose}>
          <X />
        </Button>
      </div>
      <Field label="Título">
        <Input disabled={readOnly} value={d.title} onChange={(e) => set({ title: e.target.value })} />
      </Field>
      {node.type === "traffic" && (
        <>
          <Field label="Etiqueta">
            <Input disabled={readOnly} value={d.tag || ""} onChange={(e) => set({ tag: e.target.value })} />
          </Field>
          <Field label="Canal">
            <div className="flex flex-wrap gap-1.5">
              {CHANNELS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={readOnly}
                  onClick={() => set({ channel: c.id })}
                  className={`rounded-full border px-2.5 py-1 text-[11px] ${
                    d.channel === c.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="URL / destino">
            <Input disabled={readOnly} placeholder="https://…" value={d.url || ""} onChange={(e) => set({ url: e.target.value })} />
          </Field>
        </>
      )}
      {(node.type === "whatsapp" || node.type === "email" || node.type === "trigger") && (
        <Field label="Texto">
          <Textarea disabled={readOnly} rows={5} value={d.body || ""} onChange={(e) => set({ body: e.target.value })} />
        </Field>
      )}
      {node.type === "trigger" && (
        <>
          <Field label="Quando">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["incoming_whatsapp", "WhatsApp"],
                  ["capture", "Captura"],
                  ["any", "Qualquer mensagem"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  disabled={readOnly}
                  onClick={() => set({ triggerType: id })}
                  className={`rounded-full border px-2.5 py-1 text-[11px] ${
                    (d.triggerType || "incoming_whatsapp") === id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Gatilho">
            <Input disabled={readOnly} value={d.triggerLabel || ""} onChange={(e) => set({ triggerLabel: e.target.value })} />
          </Field>
        </>
      )}
      {node.type === "email" && (
        <>
          <Field label="Enviar de">
            <Input disabled={readOnly} value={d.fromEmail || ""} onChange={(e) => set({ fromEmail: e.target.value })} />
          </Field>
          <Field label="Assunto">
            <Input disabled={readOnly} value={d.subject || ""} onChange={(e) => set({ subject: e.target.value })} />
          </Field>
        </>
      )}
      {node.type === "delay" && (
        <>
          <Field label="Horas de espera">
            <Input disabled={readOnly} type="number" min={0} value={d.delayHours ?? 1} onChange={(e) => set({ delayHours: Number(e.target.value) })} />
          </Field>
          <Field label="Janela">
            <Input disabled={readOnly} value={d.delayWindow || ""} onChange={(e) => set({ delayWindow: e.target.value })} />
          </Field>
        </>
      )}
      {node.type === "split" && (
        <div className="space-y-2">
          <Label className="text-[11px]">Ramificações</Label>
          {(d.splits || []).map((s, i) => (
            <div key={s.id} className="flex gap-1.5">
              <Input
                disabled={readOnly}
                className="w-16"
                type="number"
                min={0}
                max={100}
                value={s.percent}
                onChange={(e) => {
                  const splits = [...(d.splits || [])]
                  splits[i] = { ...s, percent: Number(e.target.value) }
                  set({ splits })
                }}
              />
              <Input
                disabled={readOnly}
                value={s.label}
                onChange={(e) => {
                  const splits = [...(d.splits || [])]
                  splits[i] = { ...s, label: e.target.value }
                  set({ splits })
                }}
              />
              {!readOnly && (
                <Button variant="ghost" size="icon-xs" aria-label="Remover ramificação" onClick={() => set({ splits: (d.splits || []).filter((x) => x.id !== s.id) })}>
                  <Trash2 />
                </Button>
              )}
            </div>
          ))}
          {!readOnly && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => set({ splits: [...(d.splits || []), { id: crypto.randomUUID().slice(0, 6), label: "Nova variante", percent: 0 }] })}
            >
              <Plus /> Adicionar ramificação
            </Button>
          )}
        </div>
      )}
      {(node.type === "whatsapp" || node.type === "telegram" || node.type === "sales_page") && (
        <Field label="Texto do botão">
          <Input disabled={readOnly} value={d.cta || ""} onChange={(e) => set({ cta: e.target.value })} />
        </Field>
      )}
      {(node.type === "whatsapp" || node.type === "telegram" || node.type === "email" || node.type === "sales_page") && (
        <Field label="URL / link real">
          <Input disabled={readOnly} placeholder="https://…" value={d.url || ""} onChange={(e) => set({ url: e.target.value })} />
        </Field>
      )}
      {!readOnly && (
        <Button variant="destructive" size="sm" className="w-full" onClick={onDelete}>
          <Trash2 /> Remover bloco
        </Button>
      )}
    </aside>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px]">{label}</Label>
      {children}
    </div>
  )
}
