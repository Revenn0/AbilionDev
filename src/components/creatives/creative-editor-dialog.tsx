import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  CREATIVE_LANGUAGE_LABELS,
  CREATIVE_STATUS_LABELS,
} from "@/components/creatives/creative-labels"
import type { CreativeConceptInput, CreativeVariantInput } from "@/lib/creative-api"
import type {
  CreativeConcept,
  CreativeLanguage,
  CreativeStatus,
  CreativeVariant,
} from "@/lib/platform"

export function ConceptEditorDialog({
  open,
  onOpenChange,
  concept,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  concept: CreativeConcept | null
  onSave: (concept: CreativeConceptInput) => Promise<boolean>
}) {
  const [name, setName] = useState(concept?.name ?? "")
  const [theme, setTheme] = useState(concept?.theme ?? "")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (busy) return
    const concept = { name: name.trim(), theme: theme.trim() }
    if (!concept.name || !concept.theme) {
      setError("Informa o nome e o tema do conceito.")
      return
    }
    setBusy(true)
    setError("")
    void onSave(concept)
      .then((saved) => {
        if (saved) onOpenChange(false)
      })
      .finally(() => setBusy(false))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{concept ? `Editar ${concept.name}` : "Novo conceito"}</DialogTitle>
          <DialogDescription>O conceito agrupa variações do mesmo ângulo criativo.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <fieldset disabled={busy} className="min-w-0 space-y-4 border-0 p-0">
            <Field id="creative-concept-name" label="Nome" value={name} onChange={setName} placeholder="Ex.: Resultado sem complicação" />
            <Field id="creative-concept-theme" label="Tema" value={theme} onChange={setTheme} placeholder="Ex.: Prova social" />
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
            <Button type="submit" disabled={busy}>
              {busy ? "A guardar…" : concept ? "Guardar conceito" : "Criar conceito"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const EMPTY_VARIANT: CreativeVariantInput = {
  conceptId: "",
  name: "",
  language: "pt-BR",
  market: "",
  operation: "",
  theme: "",
  title: "",
  body: "",
  cta: "",
  description: "",
  script: "",
  status: "draft",
  trackingId: "",
}

function draftFrom(variant: CreativeVariant | null, concepts: CreativeConcept[], defaultConceptId?: string): CreativeVariantInput {
  if (variant) {
    const {
      id: _id,
      version: _version,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      reviewedAt: _reviewedAt,
      reviewedBy: _reviewedBy,
      ...draft
    } = variant
    return draft
  }
  const concept = concepts.find((item) => item.id === defaultConceptId) ?? concepts[0]
  return {
    ...EMPTY_VARIANT,
    conceptId: concept?.id ?? "",
    theme: concept?.theme ?? "",
  }
}

export function VariantEditorDialog({
  open,
  onOpenChange,
  concepts,
  variant,
  defaultConceptId,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  concepts: CreativeConcept[]
  variant: CreativeVariant | null
  defaultConceptId?: string
  onSave: (draft: CreativeVariantInput) => Promise<boolean>
}) {
  const [draft, setDraft] = useState<CreativeVariantInput>(() => draftFrom(variant, concepts, defaultConceptId))
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const change = <K extends keyof CreativeVariantInput>(key: K, value: CreativeVariantInput[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setError("")
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (busy) return
    const next: CreativeVariantInput = {
      ...draft,
      conceptId: draft.conceptId.trim(),
      name: draft.name.trim(),
      market: draft.market.trim(),
      operation: draft.operation.trim(),
      theme: draft.theme.trim(),
      title: draft.title.trim(),
      body: draft.body.trim(),
      cta: draft.cta.trim(),
      description: draft.description.trim(),
      script: draft.script.trim(),
      trackingId: draft.trackingId.trim(),
      sourceVariantId: draft.sourceVariantId?.trim() || undefined,
      botId: draft.botId?.trim() || undefined,
      funnelId: draft.funnelId?.trim() || undefined,
      flowVersionId: draft.flowVersionId?.trim() || undefined,
      pageScriptId: draft.pageScriptId?.trim() || undefined,
      responsibleId: draft.responsibleId?.trim() || undefined,
    }
    if (!next.conceptId || !next.name || !next.market || !next.operation || !next.theme || !next.trackingId) {
      setError("Preenche conceito, nome, mercado, operação, tema e tracking.")
      return
    }
    if (!next.title && !next.body && !next.script) {
      setError("Inclui pelo menos um título, texto ou roteiro.")
      return
    }
    setBusy(true)
    setError("")
    void onSave(next)
      .then((saved) => {
        if (saved) onOpenChange(false)
      })
      .finally(() => setBusy(false))
  }

  const title = variant ? `Editar ${variant.name}` : "Nova variação"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Conteúdo e vínculos ficam explícitos. Guardar não publica nem cria métricas.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <fieldset disabled={busy} className="min-w-0 space-y-4 border-0 p-0">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                id="creative-variant-concept"
                label="Conceito"
                value={draft.conceptId}
                onChange={(value) => {
                  const concept = concepts.find((item) => item.id === value)
                  setDraft((current) => ({
                    ...current,
                    conceptId: value,
                    theme: current.theme || concept?.theme || "",
                  }))
                  setError("")
                }}
              >
                <option value="">Escolhe um conceito</option>
                {concepts.map((concept) => (
                  <option key={concept.id} value={concept.id}>
                    {concept.name}
                  </option>
                ))}
              </SelectField>
              <Field id="creative-variant-name" label="Nome da variação" value={draft.name} onChange={(value) => change("name", value)} />
              <SelectField
                id="creative-variant-language"
                label="Idioma"
                value={draft.language}
                onChange={(value) => change("language", value as CreativeLanguage)}
              >
                {(Object.entries(CREATIVE_LANGUAGE_LABELS) as Array<[CreativeLanguage, string]>).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
              <SelectField
                id="creative-variant-status"
                label="Status"
                value={draft.status}
                onChange={(value) => change("status", value as CreativeStatus)}
              >
                {(Object.entries(CREATIVE_STATUS_LABELS) as Array<[CreativeStatus, string]>).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
              <Field id="creative-variant-market" label="Mercado" value={draft.market} onChange={(value) => change("market", value)} placeholder="Ex.: Brasil" />
              <Field id="creative-variant-operation" label="Operação" value={draft.operation} onChange={(value) => change("operation", value)} placeholder="Ex.: Aquisição" />
              <Field id="creative-variant-theme" label="Tema" value={draft.theme} onChange={(value) => change("theme", value)} />
              <Field id="creative-variant-tracking" label="Tracking ID" value={draft.trackingId} onChange={(value) => change("trackingId", value)} />
            </div>

            <Field id="creative-variant-title" label="Título" value={draft.title} onChange={(value) => change("title", value)} />
            <AreaField id="creative-variant-body" label="Texto principal" value={draft.body} onChange={(value) => change("body", value)} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="creative-variant-cta" label="CTA" value={draft.cta} onChange={(value) => change("cta", value)} />
              <Field id="creative-variant-description" label="Descrição" value={draft.description} onChange={(value) => change("description", value)} />
            </div>
            <AreaField id="creative-variant-script" label="Roteiro" value={draft.script} onChange={(value) => change("script", value)} className="min-h-28" />

            <details className="rounded-xl border border-border p-4">
              <summary className="cursor-pointer text-[13px] font-medium">Vínculos opcionais</summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field id="creative-variant-bot" label="Bot ID" value={draft.botId ?? ""} onChange={(value) => change("botId", value)} />
                <Field id="creative-variant-funnel" label="Funil ID" value={draft.funnelId ?? ""} onChange={(value) => change("funnelId", value)} />
                <Field id="creative-variant-flow" label="Versão do fluxo" value={draft.flowVersionId ?? ""} onChange={(value) => change("flowVersionId", value)} />
                <Field id="creative-variant-page" label="Script de página" value={draft.pageScriptId ?? ""} onChange={(value) => change("pageScriptId", value)} />
                <Field id="creative-variant-owner" label="Responsável ID" value={draft.responsibleId ?? ""} onChange={(value) => change("responsibleId", value)} />
                {draft.sourceVariantId ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="creative-variant-source">Variação de origem</Label>
                    <Input id="creative-variant-source" value={draft.sourceVariantId} readOnly />
                  </div>
                ) : null}
              </div>
            </details>
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
            <Button type="submit" disabled={busy || concepts.length === 0}>
              {busy ? "A guardar…" : variant ? "Guardar alterações" : "Criar variação"}
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
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </div>
  )
}

function AreaField({
  id,
  label,
  value,
  onChange,
  className,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} className={className} value={value} onChange={(event) => onChange(event.target.value)} />
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
