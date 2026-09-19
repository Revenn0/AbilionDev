import { Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { isMapKind, type SalesNodeData, type SteLine } from "@/lib/types"
import type { SalesCanvasNode } from "./nodes"

const CHANNELS: { id: NonNullable<SalesNodeData["channel"]>; label: string }[] = [
  { id: "youtube", label: "YouTube" },
  { id: "google", label: "Google" },
  { id: "meta", label: "Meta" },
  { id: "organic", label: "Orgânico" },
]

const STE_LINES: { id: SteLine; label: string }[] = [
  { id: "welcome", label: "Boas-vindas" },
  { id: "course", label: "Minicurso" },
  { id: "superbet", label: "Superbet" },
  { id: "rescue", label: "Resgate cadastro" },
  { id: "offer", label: "App / Premium" },
  { id: "lives", label: "Horário das lives" },
  { id: "remarketing", label: "Remarketing 7h" },
  { id: "close", label: "Encerrar" },
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
  const layer = isMapKind(node.type) ? "Mapa" : "Fluxo"

  return (
    <aside className="absolute top-2 right-2 bottom-2 z-20 w-[300px] space-y-3.5 overflow-y-auto rounded-2xl border border-border bg-card/95 p-4 shadow-[0_16px_40px_-24px_rgb(0_0_0/0.7)] backdrop-blur-md">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {layer}
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
      {node.type === "entry" && (
        <Field label="Quando">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["popup", "Popup"],
                ["group_join", "Join"],
                ["start", "/start"],
                ["any", "Qualquer"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                disabled={readOnly}
                onClick={() => set({ entryTrigger: id })}
                className={`rounded-full border px-2.5 py-1 text-[11px] ${
                  (d.entryTrigger || "any") === id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>
      )}
      {(node.type === "message" || node.type === "handoff" || node.type === "offer" || node.type === "wait") && (
        <Field label="Fala da Sté">
          <div className="flex flex-wrap gap-1.5">
            {STE_LINES.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={readOnly}
                onClick={() => set({ steLine: d.steLine === item.id ? undefined : item.id })}
                className={`rounded-full border px-2.5 py-1 text-[11px] ${
                  d.steLine === item.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </Field>
      )}
      {node.type === "handoff" && (
        <>
          <label className="flex items-center justify-between gap-3 text-[12.5px]">
            <span>Sté fala neste funil</span>
            <Switch disabled={readOnly} checked={d.steTalk !== false} onCheckedChange={(checked) => set({ steTalk: checked })} />
          </label>
          <label className="flex items-center justify-between gap-3 text-[12.5px]">
            <span>Silenciar depois do remarketing</span>
            <Switch disabled={readOnly} checked={d.dieAfter !== false} onCheckedChange={(checked) => set({ dieAfter: checked })} />
          </label>
        </>
      )}
      {(node.type === "wait" || node.type === "offer") && d.steLine === "remarketing" && (
        <label className="flex items-center justify-between gap-3 text-[12.5px]">
          <span>Silenciar depois desta fala</span>
          <Switch disabled={readOnly} checked={d.dieAfter !== false} onCheckedChange={(checked) => set({ dieAfter: checked })} />
        </label>
      )}
      {(node.type === "message" || node.type === "handoff" || node.type === "offer") && (
        <Field label={d.steLine ? "O que a Sté diz (uma linha por bloco)" : "Texto"}>
          <Textarea disabled={readOnly} rows={d.steLine ? 7 : 5} value={d.body || ""} onChange={(e) => set({ body: e.target.value })} />
          {d.steLine ? (
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              Este passo é o padrão. A Sté pode mudar o tom e mostrar que ouviu o lead, mas não troca de fase nem inventa link.
            </p>
          ) : null}
        </Field>
      )}
      {node.type === "notify" && (
        <>
          <Field label="Aviso">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["ester", "Ester"],
                  ["banca", "Banca (texto fixo)"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  disabled={readOnly}
                  onClick={() => set({ notifyKind: id })}
                  className={`rounded-full border px-2.5 py-1 text-[11px] ${
                    (d.notifyKind || "ester") === id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Payload (nunca gerado)">
            <Textarea disabled={readOnly} rows={5} value={d.notifyBody || ""} onChange={(e) => set({ notifyBody: e.target.value })} />
          </Field>
        </>
      )}
      {node.type === "wait" && (
        <>
          <Field label="Horas de espera">
            <Input disabled={readOnly} type="number" min={0} value={d.delayHours ?? 84} onChange={(e) => set({ delayHours: Number(e.target.value) })} />
          </Field>
          <Field label="Janela">
            <Input disabled={readOnly} value={d.delayWindow || ""} onChange={(e) => set({ delayWindow: e.target.value })} />
          </Field>
        </>
      )}
      {node.type === "condition" && (
        <>
          <Field label="Pergunta">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["print", "Print?"],
                  ["banca", "Banca?"],
                  ["temperature", "Temperatura"],
                  ["campaign", "Campanha"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  disabled={readOnly}
                  onClick={() => set({ conditionKind: id })}
                  className={`rounded-full border px-2.5 py-1 text-[11px] ${
                    (d.conditionKind || "print") === id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>
          {(d.conditionKind === "temperature" || d.conditionKind === "campaign") && (
            <Field label="Valor">
              <Input disabled={readOnly} value={d.conditionValue || ""} onChange={(e) => set({ conditionValue: e.target.value })} placeholder="quente ou telegram" />
            </Field>
          )}
        </>
      )}
      {node.type === "tag" && (
        <>
          <Field label="Marcar">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["temperature", "Temperatura"],
                  ["campaign", "Campanha"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  disabled={readOnly}
                  onClick={() => set({ tagKind: id })}
                  className={`rounded-full border px-2.5 py-1 text-[11px] ${
                    (d.tagKind || "temperature") === id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>
          {d.tagKind !== "campaign" && (
            <Field label="Temperatura">
              <div className="flex flex-wrap gap-1.5">
                {(["novo", "morno", "quente"] as const).map((temp) => (
                  <button
                    key={temp}
                    type="button"
                    disabled={readOnly}
                    onClick={() => set({ temperature: temp })}
                    className={`rounded-full border px-2.5 py-1 text-[11px] ${
                      d.temperature === temp ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    {temp}
                  </button>
                ))}
              </div>
            </Field>
          )}
          {d.tagKind === "campaign" && (
            <Field label="Travar canal">
              <div className="flex flex-wrap gap-1.5">
                {(["whatsapp", "telegram"] as const).map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    disabled={readOnly}
                    onClick={() => set({ campaignLock: ch })}
                    className={`rounded-full border px-2.5 py-1 text-[11px] ${
                      d.campaignLock === ch ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </Field>
          )}
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
      {(node.type === "message" || node.type === "landing" || node.type === "offer") && (
        <Field label="Texto do botão">
          <Input disabled={readOnly} value={d.cta || ""} onChange={(e) => set({ cta: e.target.value })} />
        </Field>
      )}
      {(node.type === "message" || node.type === "landing" || node.type === "offer") && (
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
