import { Children, cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react"
import { Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { defaultSalesData, STE_LINE_LABELS } from "./catalog"
import { cleanHttpUrl } from "@/lib/migrate"
import { isMapKind, type SalesNodeData, type SteLine } from "@/lib/types"
import { cn } from "@/lib/utils"
import type { SalesCanvasNode } from "./nodes"

const CHANNELS: { id: NonNullable<SalesNodeData["channel"]>; label: string }[] = [
  { id: "youtube", label: "YouTube" },
  { id: "google", label: "Google" },
  { id: "meta", label: "Meta" },
  { id: "organic", label: "Orgânico" },
]

const BOX =
  "h-8 rounded-lg border-slate-200 bg-[#fbfcfd] text-[12.5px] text-slate-800 placeholder:text-slate-400"

export function SalesInspector({
  node,
  readOnly,
  className,
  onChange,
  onDelete,
  onClose,
}: {
  node?: SalesCanvasNode
  readOnly?: boolean
  className?: string
  onChange: (id: string, patch: SalesCanvasNode["data"]) => void
  onDelete: () => void
  onClose: () => void
}) {
  if (!node) {
    return (
      <aside className={cn("flex w-[300px] shrink-0 flex-col border-l border-slate-200 bg-white px-4 py-5", className)}>
        <p className="text-[13px] font-medium text-slate-800">Propriedades</p>
        <p className="mt-2 text-[12.5px] leading-relaxed text-slate-400">
          Selecione um bloco no quadro. O que a Sté diz edita-se aqui e publica com o funil.
        </p>
      </aside>
    )
  }
  const d = node.data
  const set = (patch: Partial<typeof d>) => onChange(node.id, { ...d, ...patch })
  const layer = isMapKind(node.type) ? "Mapa" : "Fluxo"

  return (
    <aside className={cn("flex w-[300px] shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white", className)}>
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div>
          <p className="text-[13px] font-medium text-slate-800">Propriedades</p>
          <p className="text-[11px] text-slate-400">
            {layer}
            {readOnly ? " · produção" : ""}
          </p>
        </div>
        <Button variant="ghost" size="icon-xs" className="text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Fechar" onClick={onClose}>
          <X />
        </Button>
      </div>
      <div className="space-y-3.5 px-4 py-4">
        <Field label="Título">
          <Input disabled={readOnly} className={BOX} value={d.title} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        {node.type === "traffic" && (
          <>
            <Field label="Etiqueta">
              <Input disabled={readOnly} className={BOX} value={d.tag || ""} onChange={(e) => set({ tag: e.target.value })} />
            </Field>
            <Field label="Canal">
              <Chips>
                {CHANNELS.map((c) => (
                  <Chip key={c.id} active={d.channel === c.id} disabled={readOnly} onClick={() => set({ channel: c.id })}>
                    {c.label}
                  </Chip>
                ))}
              </Chips>
            </Field>
            <UrlField readOnly={readOnly} value={d.url || ""} onChange={(url) => set({ url })} />
          </>
        )}
        {node.type === "entry" && (
          <Field label="Quando">
            <Chips>
              {(
                [
                  ["popup", "Popup"],
                  ["group_join", "Join"],
                  ["start", "/start"],
                  ["any", "Qualquer"],
                ] as const
              ).map(([id, label]) => (
                <Chip key={id} active={(d.entryTrigger || "any") === id} disabled={readOnly} onClick={() => set({ entryTrigger: id })}>
                  {label}
                </Chip>
              ))}
            </Chips>
          </Field>
        )}
        {(node.type === "message" || node.type === "handoff" || node.type === "offer" || node.type === "wait") && (
          <Field label="Fala da Sté">
            <Chips>
              {STE_LINE_LABELS.map((item) => (
                <Chip
                  key={item.id}
                  active={d.steLine === item.id}
                  disabled={readOnly}
                  onClick={() => set({ steLine: (d.steLine === item.id ? undefined : item.id) as SteLine | undefined })}
                >
                  {item.label}
                </Chip>
              ))}
            </Chips>
          </Field>
        )}
        {node.type === "handoff" && (
          <>
            <ToggleRow label="Sté fala neste funil" disabled={readOnly} checked={d.steTalk !== false} onChange={(checked) => set({ steTalk: checked })} />
            <ToggleRow label="Silenciar depois do remarketing" disabled={readOnly} checked={d.dieAfter !== false} onChange={(checked) => set({ dieAfter: checked })} />
          </>
        )}
        {node.type === "bot" && (() => {
          const policy = d.botPolicy || defaultSalesData("bot").botPolicy!
          const patchPolicy = (patch: Partial<typeof policy>) => set({ botPolicy: { ...policy, ...patch } })
          return (
            <>
              <Field label="Bot">
                <Input
                  disabled={readOnly}
                  className={BOX}
                  value={policy.botId}
                  onChange={(event) => patchPolicy({ botId: event.target.value.trim().slice(0, 80) })}
                  placeholder="bot-…"
                />
              </Field>
              <Field label="Versão do Cérebro">
                <Input
                  disabled={readOnly}
                  className={BOX}
                  value={policy.brainVersionId}
                  onChange={(event) => patchPolicy({ brainVersionId: event.target.value.trim().slice(0, 80) })}
                  placeholder="brain-…"
                />
              </Field>
              <Field label="Modo">
                <select
                  disabled={readOnly}
                  value={policy.mode}
                  onChange={(event) =>
                    patchPolicy({
                      mode: event.target.value as "respond" | "classify" | "extract" | "decide" | "remember",
                    })
                  }
                  className={BOX}
                >
                  <option value="respond">Responder</option>
                  <option value="classify">Classificar</option>
                  <option value="extract">Extrair dados</option>
                  <option value="decide">Decidir caminho</option>
                  <option value="remember">Actualizar memória</option>
                </select>
              </Field>
              <Field label="Quando executar">
                <select
                  disabled={readOnly}
                  value={policy.runWhen}
                  onChange={(event) =>
                    patchPolicy({ runWhen: event.target.value === "enter" ? "enter" : "message" })
                  }
                  className={BOX}
                >
                  <option value="message">Quando o lead responder</option>
                  <option value="enter">Assim que chegar ao bloco</option>
                </select>
              </Field>
              <Field label="Instrução deste passo">
                <Textarea
                  disabled={readOnly}
                  rows={8}
                  className="rounded-lg border-slate-200 bg-[#fbfcfd] text-[12.5px] text-slate-800"
                  value={policy.instruction}
                  onChange={(event) => patchPolicy({ instruction: event.target.value.slice(0, 8_000) })}
                  placeholder="Diz exactamente o que este bot deve fazer quando o fluxo chegar aqui."
                />
              </Field>
              <Field label="Idioma">
                <Input
                  disabled={readOnly}
                  className={BOX}
                  value={policy.language}
                  onChange={(event) => patchPolicy({ language: event.target.value.slice(0, 16) })}
                />
              </Field>
              <Field label="Acções permitidas (separadas por vírgula)">
                <Input
                  disabled={readOnly}
                  className={BOX}
                  value={policy.allowedActions.join(", ")}
                  onChange={(event) =>
                    patchPolicy({
                      allowedActions: event.target.value.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 20),
                    })
                  }
                />
              </Field>
              <Field label="Saídas (separadas por vírgula)">
                <Input
                  disabled={readOnly}
                  className={BOX}
                  value={policy.outputBranches.join(", ")}
                  onChange={(event) =>
                    patchPolicy({
                      outputBranches: event.target.value.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 20),
                    })
                  }
                />
              </Field>
              <ToggleRow
                label="Ler memória deste lead"
                disabled={readOnly}
                checked={policy.readLeadMemory}
                onChange={(readLeadMemory) => patchPolicy({ readLeadMemory })}
              />
              <ToggleRow
                label="Gravar memória deste lead"
                disabled={readOnly}
                checked={policy.writeLeadMemory}
                onChange={(writeLeadMemory) => patchPolicy({ writeLeadMemory })}
              />
            </>
          )
        })()}
        {node.type === "human" && (
          <Field label="Orientação para o operador">
            <Textarea
              disabled={readOnly}
              rows={5}
              className="rounded-lg border-slate-200 bg-[#fbfcfd] text-[12.5px] text-slate-800"
              value={d.humanInstructions || ""}
              onChange={(event) => set({ humanInstructions: event.target.value.slice(0, 4_000) })}
            />
          </Field>
        )}
        {node.type === "audio" && (
          <>
            <Field label="Roteiro exacto">
              <Textarea
                disabled={readOnly}
                rows={7}
                className="rounded-lg border-slate-200 bg-[#fbfcfd] text-[12.5px] text-slate-800"
                value={d.body || ""}
                onChange={(event) => set({ body: event.target.value.slice(0, 8_000) })}
              />
            </Field>
            <Field label="Se o áudio falhar">
              <select
                disabled={readOnly}
                value={d.audioFallback || "error"}
                onChange={(event) => set({ audioFallback: event.target.value === "text" ? "text" : "error" })}
                className={BOX}
              >
                <option value="error">Seguir caminho de erro</option>
                <option value="text">Enviar o roteiro como texto</option>
              </select>
            </Field>
          </>
        )}
        {node.type === "webhook" && (
          <Field label="Método">
            <select
              disabled={readOnly}
              value={d.webhookMethod || "POST"}
              onChange={(event) => set({ webhookMethod: event.target.value === "PUT" ? "PUT" : "POST" })}
              className={BOX}
            >
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
            </select>
          </Field>
        )}
        {(node.type === "wait" || node.type === "offer") && d.steLine === "remarketing" && (
          <ToggleRow label="Silenciar depois desta fala" disabled={readOnly} checked={d.dieAfter !== false} onChange={(checked) => set({ dieAfter: checked })} />
        )}
        {(node.type === "message" || node.type === "handoff" || node.type === "offer") && (
          <Field label={d.steLine ? "O que a Sté diz (uma linha por bloco)" : "Texto"}>
            <Textarea
              disabled={readOnly}
              rows={d.steLine ? 7 : 5}
              className="rounded-lg border-slate-200 bg-[#fbfcfd] text-[12.5px] text-slate-800"
              value={d.body || ""}
              onChange={(e) => set({ body: e.target.value })}
            />
            {d.steLine ? (
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                Este passo é o padrão. A Sté pode mudar o tom e mostrar que ouviu o lead, mas não troca de fase nem inventa link.
              </p>
            ) : null}
          </Field>
        )}
        {node.type === "notify" && (
          <>
            <Field label="Aviso">
              <Chips>
                {(
                  [
                    ["ester", "Ester"],
                    ["banca", "Banca (texto fixo)"],
                  ] as const
                ).map(([id, label]) => (
                  <Chip key={id} active={(d.notifyKind || "ester") === id} disabled={readOnly} onClick={() => set({ notifyKind: id })}>
                    {label}
                  </Chip>
                ))}
              </Chips>
            </Field>
            <Field label="Payload (nunca gerado)">
              <Textarea
                disabled={readOnly}
                rows={5}
                className="rounded-lg border-slate-200 bg-[#fbfcfd] text-[12.5px] text-slate-800"
                value={d.notifyBody || ""}
                onChange={(e) => set({ notifyBody: e.target.value })}
              />
            </Field>
          </>
        )}
        {node.type === "wait" && (
          <>
            <Field label="Horas de espera">
              <Input
                disabled={readOnly}
                className={BOX}
                type="number"
                min={0}
                max={8760}
                value={d.delayHours ?? 84}
                onChange={(e) => {
                  const hours = Number(e.target.value)
                  set({ delayHours: Number.isFinite(hours) && hours >= 0 ? Math.min(8760, hours) : 84 })
                }}
              />
            </Field>
            <Field label="Janela">
              <Input disabled={readOnly} className={BOX} value={d.delayWindow || ""} onChange={(e) => set({ delayWindow: e.target.value })} />
            </Field>
          </>
        )}
        {node.type === "condition" && (
          <>
            <Field label="Pergunta">
              <Chips>
                {(
                  [
                    ["print", "Print?"],
                    ["banca", "Banca?"],
                    ["temperature", "Temperatura"],
                    ["campaign", "Campanha"],
                  ] as const
                ).map(([id, label]) => (
                  <Chip key={id} active={(d.conditionKind || "print") === id} disabled={readOnly} onClick={() => set({ conditionKind: id })}>
                    {label}
                  </Chip>
                ))}
              </Chips>
            </Field>
            {(d.conditionKind === "temperature" || d.conditionKind === "campaign") && (
              <Field label="Valor">
                <Input disabled={readOnly} className={BOX} value={d.conditionValue || ""} onChange={(e) => set({ conditionValue: e.target.value })} placeholder="quente ou telegram" />
              </Field>
            )}
          </>
        )}
        {node.type === "tag" && (
          <>
            <Field label="Marcar">
              <Chips>
                {(
                  [
                    ["temperature", "Temperatura"],
                    ["campaign", "Campanha"],
                  ] as const
                ).map(([id, label]) => (
                  <Chip key={id} active={(d.tagKind || "temperature") === id} disabled={readOnly} onClick={() => set({ tagKind: id, campaignLock: id === "campaign" ? "telegram" : d.campaignLock })}>
                    {label}
                  </Chip>
                ))}
              </Chips>
            </Field>
            {d.tagKind !== "campaign" && (
              <Field label="Temperatura">
                <Chips>
                  {(["novo", "morno", "quente"] as const).map((temp) => (
                    <Chip key={temp} active={d.temperature === temp} disabled={readOnly} onClick={() => set({ temperature: temp })}>
                      {temp}
                    </Chip>
                  ))}
                </Chips>
              </Field>
            )}
            {d.tagKind === "campaign" && (
              <Field label="Canal">
                <p className="text-[12.5px] text-slate-600">Telegram</p>
              </Field>
            )}
          </>
        )}
        {node.type === "split" && (
          <Field label="Ramificações">
            <div className="space-y-2">
              {(d.splits || []).map((s, i) => (
                <div key={s.id} className="flex gap-1.5">
                  <Input
                    disabled={readOnly}
                    className={cn(BOX, "w-16")}
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
                    className={BOX}
                    value={s.label}
                    onChange={(e) => {
                      const splits = [...(d.splits || [])]
                      splits[i] = { ...s, label: e.target.value }
                      set({ splits })
                    }}
                  />
                  {!readOnly && (
                    <Button variant="ghost" size="icon-xs" className="text-slate-400 hover:bg-slate-100" aria-label="Remover ramificação" onClick={() => set({ splits: (d.splits || []).filter((x) => x.id !== s.id) })}>
                      <Trash2 />
                    </Button>
                  )}
                </div>
              ))}
              {!readOnly && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-lg border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  onClick={() => set({ splits: [...(d.splits || []), { id: crypto.randomUUID().slice(0, 6), label: "Nova variante", percent: 0 }] })}
                >
                  <Plus /> Adicionar ramificação
                </Button>
              )}
            </div>
          </Field>
        )}
        {(node.type === "message" || node.type === "landing" || node.type === "offer") && (
          <Field label="Texto do botão">
            <Input disabled={readOnly} className={BOX} value={d.cta || ""} onChange={(e) => set({ cta: e.target.value })} />
          </Field>
        )}
        {(node.type === "message" || node.type === "landing" || node.type === "offer" || node.type === "webhook") && (
          <UrlField label="URL / link real" readOnly={readOnly} value={d.url || ""} onChange={(url) => set({ url })} />
        )}
        {!readOnly && (
          <Button variant="destructive" size="sm" className="w-full rounded-lg" onClick={onDelete}>
            <Trash2 /> Remover bloco
          </Button>
        )}
      </div>
    </aside>
  )
}

function UrlField({
  label = "URL / destino",
  value,
  readOnly,
  onChange,
}: {
  label?: string
  value: string
  readOnly?: boolean
  onChange: (value: string) => void
}) {
  const errorId = useId()
  const dirty = Boolean(value.trim()) && !cleanHttpUrl(value)
  return (
    <Field label={label}>
      <Input
        disabled={readOnly}
        className={BOX}
        placeholder="https://…"
        value={value}
        aria-invalid={dirty}
        aria-describedby={dirty ? errorId : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {dirty ? (
        <p id={errorId} role="alert" className="text-[11px] leading-relaxed text-rose-600">
          Usa um link http ou https, sem utilizador na URL.
        </p>
      ) : null}
    </Field>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  const id = useId()
  const labelId = `${id}-label`
  const kids = Children.toArray(children)
  const controlIndex = kids.findIndex((child) => isValidElement(child) && (child.type === Input || child.type === Textarea))
  const control = controlIndex >= 0 && isValidElement(kids[controlIndex]) ? kids[controlIndex] : null
  return (
    <div className="space-y-1.5">
      <label
        id={labelId}
        htmlFor={control ? id : undefined}
        className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400"
      >
        <span className="size-1.5 rounded-full bg-slate-300" aria-hidden />
        {label}
      </label>
      {control
        ? kids.map((child, index) =>
            index === controlIndex && isValidElement(child)
              ? cloneElement(child as ReactElement<{ id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }>, { id })
              : child
          )
        : (
            <div role="group" aria-labelledby={labelId}>
              {children}
            </div>
          )}
    </div>
  )
}

function Chips({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-1.5">{children}</div>
}

function Chip({
  active,
  disabled,
  onClick,
  children,
}: {
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={Boolean(active)}
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] transition-colors disabled:opacity-50",
        active ? "border-sky-300 bg-sky-50 text-sky-800" : "border-slate-200 bg-[#fbfcfd] text-slate-500 hover:border-slate-300"
      )}
    >
      {children}
    </button>
  )
}

function ToggleRow({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-[#fbfcfd] px-2.5 py-2 text-[12.5px] text-slate-700">
      <span>{label}</span>
      <Switch disabled={disabled} checked={checked} onCheckedChange={onChange} />
    </label>
  )
}
