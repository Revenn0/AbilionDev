import { useMemo, useState } from "react"
import { FlaskConical, Pencil } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { StatusPill } from "@/components/layout/chrome"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  CREATIVE_LANGUAGE_LABELS,
  CREATIVE_STATUS_LABELS,
} from "@/components/creatives/creative-labels"
import {
  experimentMetricFor,
  experimentSampleState,
  type CreativeExperimentInput,
} from "@/lib/creative-api"
import type { CreativeExperiment, CreativeVariant } from "@/lib/platform"

const EXPERIMENT_STATUS_LABELS: Record<CreativeExperiment["status"], string> = {
  draft: "Rascunho",
  running: "Em andamento",
  paused: "Pausada",
  completed: "Concluída",
}

const PRIMARY_METRIC_LABELS: Record<CreativeExperiment["primaryMetric"], string> = {
  ctr: "CTR",
  leads: "Leads",
  conversion: "Conversão",
  revenue: "Receita",
}

export function CreativeExperiments({
  experiments,
  variants,
  loading,
  unread,
  onRetry,
  onEdit,
}: {
  experiments: CreativeExperiment[]
  variants: CreativeVariant[]
  loading: boolean
  unread: boolean
  onRetry: () => void
  onEdit: (experiment: CreativeExperiment) => void
}) {
  if (loading) {
    return (
      <section className="surface grid min-h-48 place-items-center p-8" role="status">
        <p className="text-[13px] text-muted-foreground">A carregar experiências…</p>
      </section>
    )
  }

  if (unread) {
    return (
      <section className="surface grid min-h-48 place-items-center p-8 text-center" role="alert">
        <div>
          <p className="text-[14px] font-medium">Não li as experiências</p>
          <p className="mt-1 max-w-lg text-[12.5px] leading-relaxed text-muted-foreground">
            A API não respondeu. Nenhuma impressão, clique, lead, conversão ou receita foi preenchida localmente.
          </p>
          <Button variant="outline" className="mt-4 rounded-full" onClick={onRetry}>
            Tentar outra vez
          </Button>
        </div>
      </section>
    )
  }

  if (!experiments.length) {
    return (
      <section className="surface grid min-h-48 place-items-center p-8 text-center">
        <div>
          <FlaskConical className="mx-auto size-5 text-muted-foreground" />
          <p className="mt-3 text-[14px] font-medium">Nenhuma experiência criada</p>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Seleciona duas variações para A/B ou três ou mais para multivariada.
          </p>
        </div>
      </section>
    )
  }

  return (
    <div className="grid gap-3">
      {experiments.map((experiment) => (
        <ExperimentCard
          key={experiment.id}
          experiment={experiment}
          variants={variants}
          onEdit={() => onEdit(experiment)}
        />
      ))}
    </div>
  )
}

function ExperimentCard({
  experiment,
  variants,
  onEdit,
}: {
  experiment: CreativeExperiment
  variants: CreativeVariant[]
  onEdit: () => void
}) {
  const sample = experimentSampleState(experiment)
  const names = new Map(variants.map((variant) => [variant.id, variant.name]))
  const suggested = experiment.suggestedWinnerId
    ? names.get(experiment.suggestedWinnerId) ?? experiment.suggestedWinnerId
    : undefined
  const approved = experiment.approvedWinnerId
    ? names.get(experiment.approvedWinnerId) ?? experiment.approvedWinnerId
    : undefined
  const experimentType = experiment.variantIds.length === 2 ? "A/B" : "Multivariada"

  return (
    <article className="surface overflow-hidden">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[14px] font-medium">{experiment.name}</h2>
            <StatusPill>{experimentType}</StatusPill>
            <StatusPill tone={experimentStatusTone(experiment.status)}>
              {EXPERIMENT_STATUS_LABELS[experiment.status]}
            </StatusPill>
          </div>
          <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-muted-foreground">
            {experiment.hypothesis}
          </p>
        </div>
        <Button size="sm" variant="outline" className="rounded-full" onClick={onEdit}>
          <Pencil /> Editar
        </Button>
      </header>

      <div className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[12px]">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border">
                <th className="pb-2 pr-4 font-medium">Variação</th>
                <th className="px-3 pb-2 text-right font-medium">Tráfego</th>
                <th className="px-3 pb-2 text-right font-medium">Impressões</th>
                <th className="px-3 pb-2 text-right font-medium">Cliques</th>
                <th className="px-3 pb-2 text-right font-medium">CTR</th>
                <th className="px-3 pb-2 text-right font-medium">Leads</th>
                <th className="px-3 pb-2 text-right font-medium">Conversões</th>
                <th className="pl-3 pb-2 text-right font-medium">Receita informada</th>
              </tr>
            </thead>
            <tbody>
              {experiment.variantIds.map((variantId) => {
                const metric = experimentMetricFor(experiment, variantId)
                const traffic = experiment.traffic[variantId]
                return (
                  <tr key={variantId} className="border-b border-border/70 last:border-0">
                    <td className="py-3 pr-4">
                      <p className="max-w-52 truncate font-medium">{names.get(variantId) ?? variantId}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {metric
                          ? metric.impressions >= experiment.minimumSample
                            ? "Amostra mínima atingida"
                            : `${formatInteger(metric.impressions)} de ${formatInteger(experiment.minimumSample)} impressões`
                          : "Sem métricas recebidas"}
                      </p>
                    </td>
                    <MetricCell value={traffic === undefined ? "—" : `${formatNumber(traffic)}%`} />
                    <MetricCell value={metric ? formatInteger(metric.impressions) : "—"} />
                    <MetricCell value={metric ? formatInteger(metric.clicks) : "—"} />
                    <MetricCell value={metric && metric.impressions > 0 ? formatPercent(metric.clicks / metric.impressions) : "—"} />
                    <MetricCell value={metric ? formatInteger(metric.leads) : "—"} />
                    <MetricCell value={metric ? formatInteger(metric.conversions) : "—"} />
                    <MetricCell value={metric?.revenue === undefined ? "—" : formatNumber(metric.revenue)} last />
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <aside className="rounded-xl border border-border bg-muted/30 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Leitura</p>
          <p className="mt-2 text-[14px] font-medium">
            {sample.enough ? "Amostra mínima atingida" : "Dados insuficientes"}
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            Mínimo de {formatInteger(experiment.minimumSample)} impressões por variação. Métrica principal:{" "}
            {PRIMARY_METRIC_LABELS[experiment.primaryMetric]}.
          </p>

          <dl className="mt-4 space-y-2 border-t border-border pt-3 text-[12px]">
            <MetaRow label="Público" value={experiment.audience} />
            <MetaRow label="Operação" value={experiment.operation} />
            <MetaRow label="Variações" value={String(experiment.variantIds.length)} />
          </dl>

          {approved ? (
            <p className="mt-4 rounded-lg bg-success/10 px-3 py-2 text-[12px] text-success">
              Vencedor aprovado: <strong>{approved}</strong>
            </p>
          ) : sample.enough && suggested ? (
            <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-[12px]">
              Sugestão da API: <strong>{suggested}</strong>
            </p>
          ) : sample.enough ? (
            <p className="mt-4 text-[12px] text-muted-foreground">A API ainda não sugeriu um vencedor.</p>
          ) : (
            <p className="mt-4 text-[12px] text-muted-foreground">
              Nenhum vencedor é inferido antes de todas as variações atingirem a amostra mínima.
            </p>
          )}
        </aside>
      </div>
    </article>
  )
}

export function ExperimentEditorDialog({
  open,
  onOpenChange,
  experiment,
  variants,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  experiment: CreativeExperiment | null
  variants: CreativeVariant[]
  onSave: (draft: CreativeExperimentInput) => Promise<boolean>
}) {
  const [name, setName] = useState(experiment?.name ?? "")
  const [hypothesis, setHypothesis] = useState(experiment?.hypothesis ?? "")
  const [status, setStatus] = useState<CreativeExperiment["status"]>(experiment?.status ?? "draft")
  const [audience, setAudience] = useState(experiment?.audience ?? "")
  const [operation, setOperation] = useState(experiment?.operation ?? "")
  const [primaryMetric, setPrimaryMetric] = useState<CreativeExperiment["primaryMetric"]>(experiment?.primaryMetric ?? "ctr")
  const [minimumSample, setMinimumSample] = useState(experiment ? String(experiment.minimumSample) : "")
  const [selectedIds, setSelectedIds] = useState<string[]>(() => [...(experiment?.variantIds ?? [])])
  const [traffic, setTraffic] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (experiment?.variantIds ?? []).map((variantId) => [
        variantId,
        experiment?.traffic[variantId] === undefined ? "" : String(experiment.traffic[variantId]),
      ])
    )
  )
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const selectedVariants = useMemo(
    () => selectedIds.map((id) => variants.find((variant) => variant.id === id)).filter((variant): variant is CreativeVariant => Boolean(variant)),
    [selectedIds, variants]
  )

  const toggleVariant = (variantId: string) => {
    setSelectedIds((current) =>
      current.includes(variantId) ? current.filter((id) => id !== variantId) : [...current, variantId]
    )
    setTraffic((current) => {
      if (!(variantId in current)) return { ...current, [variantId]: "" }
      const next = { ...current }
      delete next[variantId]
      return next
    })
    setError("")
  }

  const distributeEqually = () => {
    if (selectedIds.length < 2) return
    const basisPoints = Math.floor(10_000 / selectedIds.length)
    let left = 10_000
    const next: Record<string, string> = {}
    selectedIds.forEach((variantId, index) => {
      const part = index === selectedIds.length - 1 ? left : basisPoints
      next[variantId] = String(part / 100)
      left -= part
    })
    setTraffic(next)
    setError("")
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (busy) return
    const parsedMinimum = Number(minimumSample)
    const parsedTraffic = Object.fromEntries(selectedIds.map((variantId) => [variantId, Number(traffic[variantId])]))
    const totalTraffic = Object.values(parsedTraffic).reduce((total, value) => total + value, 0)

    if (!name.trim() || !hypothesis.trim() || !audience.trim() || !operation.trim()) {
      setError("Preenche nome, hipótese, público e operação.")
      return
    }
    if (selectedIds.length < 2) {
      setError("Seleciona pelo menos duas variações.")
      return
    }
    if (!Number.isInteger(parsedMinimum) || parsedMinimum <= 0) {
      setError("A amostra mínima deve ser um número inteiro maior que zero.")
      return
    }
    if (Object.values(parsedTraffic).some((value) => !Number.isFinite(value) || value <= 0)) {
      setError("Informa uma percentagem de tráfego maior que zero para cada variação.")
      return
    }
    if (Math.abs(totalTraffic - 100) > 0.001) {
      setError("A distribuição de tráfego deve somar 100%.")
      return
    }

    const draft: CreativeExperimentInput = {
      name: name.trim(),
      hypothesis: hypothesis.trim(),
      status,
      variantIds: selectedIds,
      traffic: parsedTraffic,
      audience: audience.trim(),
      operation: operation.trim(),
      primaryMetric,
      minimumSample: parsedMinimum,
      startAt: experiment?.startAt,
      endAt: experiment?.endAt,
    }
    setBusy(true)
    setError("")
    void onSave(draft)
      .then((saved) => {
        if (saved) onOpenChange(false)
      })
      .finally(() => setBusy(false))
  }

  const kind = selectedIds.length === 2 ? "A/B" : selectedIds.length > 2 ? "Multivariada" : "Seleciona as variações"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{experiment ? `Editar ${experiment.name}` : "Nova experiência"}</DialogTitle>
          <DialogDescription>
            {kind}. A configuração não cria resultados; métricas só aparecem quando a API as devolver.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <fieldset disabled={busy} className="min-w-0 space-y-4 border-0 p-0">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="creative-experiment-name" label="Nome" value={name} onChange={setName} />
              <SelectField
                id="creative-experiment-status"
                label="Status"
                value={status}
                onChange={(value) => setStatus(value as CreativeExperiment["status"])}
              >
                {(Object.entries(EXPERIMENT_STATUS_LABELS) as Array<[CreativeExperiment["status"], string]>).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="creative-experiment-hypothesis">Hipótese</Label>
              <Textarea
                id="creative-experiment-hypothesis"
                value={hypothesis}
                onChange={(event) => {
                  setHypothesis(event.target.value)
                  setError("")
                }}
                placeholder="O que esta experiência pretende validar?"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="creative-experiment-audience" label="Público" value={audience} onChange={setAudience} />
              <Field id="creative-experiment-operation" label="Operação" value={operation} onChange={setOperation} />
              <SelectField
                id="creative-experiment-metric"
                label="Métrica principal"
                value={primaryMetric}
                onChange={(value) => setPrimaryMetric(value as CreativeExperiment["primaryMetric"])}
              >
                {(Object.entries(PRIMARY_METRIC_LABELS) as Array<[CreativeExperiment["primaryMetric"], string]>).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
              <div className="space-y-1.5">
                <Label htmlFor="creative-experiment-sample">Amostra mínima por variação</Label>
                <Input
                  id="creative-experiment-sample"
                  type="number"
                  min={1}
                  step={1}
                  value={minimumSample}
                  onChange={(event) => {
                    setMinimumSample(event.target.value)
                    setError("")
                  }}
                  placeholder="Ex.: 1000"
                />
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <Label asChild>
                    <span>Variações</span>
                  </Label>
                  <p className="mt-1 text-[12px] text-muted-foreground">Duas formam A/B; três ou mais formam multivariada.</p>
                </div>
                <StatusPill>{kind}</StatusPill>
              </div>
              <div className="mt-3 max-h-52 overflow-y-auto rounded-xl border border-border">
                {variants.length ? (
                  variants.map((variant) => (
                    <label key={variant.id} className="flex cursor-pointer items-start gap-3 border-b border-border px-4 py-3 last:border-0">
                      <input
                        type="checkbox"
                        className="mt-0.5 size-4 accent-foreground"
                        checked={selectedIds.includes(variant.id)}
                        onChange={() => toggleVariant(variant.id)}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium">{variant.name}</span>
                        <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
                          {CREATIVE_LANGUAGE_LABELS[variant.language]} · {CREATIVE_STATUS_LABELS[variant.status]} · {variant.trackingId}
                        </span>
                      </span>
                    </label>
                  ))
                ) : (
                  <p className="px-4 py-6 text-center text-[12.5px] text-muted-foreground">Cria variações antes da experiência.</p>
                )}
              </div>
            </div>

            {selectedVariants.length ? (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label asChild>
                    <span>Distribuição de tráfego</span>
                  </Label>
                  <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={distributeEqually}>
                    Distribuir igualmente
                  </Button>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {selectedVariants.map((variant) => (
                    <div key={variant.id} className="space-y-1.5">
                      <Label htmlFor={`creative-traffic-${variant.id}`} className="truncate">
                        {variant.name} (%)
                      </Label>
                      <Input
                        id={`creative-traffic-${variant.id}`}
                        type="number"
                        min={0.01}
                        max={100}
                        step={0.01}
                        value={traffic[variant.id] ?? ""}
                        onChange={(event) => {
                          setTraffic((current) => ({ ...current, [variant.id]: event.target.value }))
                          setError("")
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </fieldset>

          {error ? (
            <p role="alert" className="text-[12px] text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy || variants.length < 2}>
              {busy ? "A guardar…" : experiment ? "Guardar experiência" : "Criar experiência"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function MetricCell({ value, last = false }: { value: string; last?: boolean }) {
  return <td className={`${last ? "pl-3" : "px-3"} py-3 text-right tabular-nums`}>{value}</td>
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate text-right">{value || "—"}</dd>
    </div>
  )
}

function Field({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
        }}
      />
    </div>
  )
}

function SelectField({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-full rounded-lg border border-input bg-muted px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {children}
      </select>
    </div>
  )
}

function experimentStatusTone(status: CreativeExperiment["status"]): "success" | "warn" | "danger" | "muted" {
  if (status === "running") return "success"
  if (status === "paused") return "warn"
  return "muted"
}

const integerFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 })
const numberFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 })
const percentFormatter = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 2 })

function formatInteger(value: number) {
  return integerFormatter.format(value)
}

function formatNumber(value: number) {
  return numberFormatter.format(value)
}

function formatPercent(value: number) {
  return percentFormatter.format(value)
}
