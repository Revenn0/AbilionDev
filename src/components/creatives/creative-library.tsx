import {
  Copy,
  GitCompareArrows,
  Languages,
  Pencil,
  Plus,
} from "lucide-react"
import { StatusPill } from "@/components/layout/chrome"
import { Button } from "@/components/ui/button"
import {
  CREATIVE_LANGUAGE_LABELS,
  CREATIVE_STATUS_LABELS,
} from "@/components/creatives/creative-labels"
import type { CreativeConcept, CreativeStatus, CreativeVariant } from "@/lib/platform"

export function CreativeLibrary({
  concepts,
  variants,
  loading,
  unread,
  busyAction,
  comparedIds,
  onRetry,
  onCreateVariant,
  onEditConcept,
  onEdit,
  onDuplicate,
  onTranslate,
  onToggleCompare,
}: {
  concepts: CreativeConcept[]
  variants: CreativeVariant[]
  loading: boolean
  unread: boolean
  busyAction: string | null
  comparedIds: string[]
  onRetry: () => void
  onCreateVariant: (conceptId: string) => void
  onEditConcept: (concept: CreativeConcept) => void
  onEdit: (variant: CreativeVariant) => void
  onDuplicate: (variant: CreativeVariant) => void
  onTranslate: (variant: CreativeVariant) => void
  onToggleCompare: (variantId: string) => void
}) {
  if (loading) {
    return (
      <section className="surface grid min-h-48 place-items-center p-8" role="status">
        <p className="text-[13px] text-muted-foreground">A carregar conceitos e variações…</p>
      </section>
    )
  }

  if (unread) {
    return (
      <section className="surface grid min-h-48 place-items-center p-8 text-center" role="alert">
        <div>
          <p className="text-[14px] font-medium">Não li o catálogo de criativos</p>
          <p className="mt-1 max-w-lg text-[12.5px] leading-relaxed text-muted-foreground">
            A API não respondeu. Isto não é um catálogo vazio e nenhum dado foi assumido.
          </p>
          <Button variant="outline" className="mt-4 rounded-full" onClick={onRetry}>
            Tentar outra vez
          </Button>
        </div>
      </section>
    )
  }

  if (!concepts.length) {
    return (
      <section className="surface grid min-h-48 place-items-center p-8 text-center">
        <div>
          <p className="text-[14px] font-medium">Nenhum conceito neste recorte</p>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Limpa os filtros ou cria um conceito para começar.
          </p>
        </div>
      </section>
    )
  }

  return (
    <div className="grid gap-3">
      {concepts.map((concept) => {
        const conceptVariants = variants.filter((variant) => variant.conceptId === concept.id)
        return (
          <section key={concept.id} className="surface overflow-hidden" aria-labelledby={`creative-concept-${concept.id}`}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id={`creative-concept-${concept.id}`} className="text-[14px] font-medium">
                    {concept.name}
                  </h2>
                  <StatusPill>{concept.theme}</StatusPill>
                </div>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {conceptVariants.length} {conceptVariants.length === 1 ? "variação visível" : "variações visíveis"}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="ghost" className="rounded-full" onClick={() => onEditConcept(concept)}>
                  <Pencil /> Editar conceito
                </Button>
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => onCreateVariant(concept.id)}>
                  <Plus /> Nova variação
                </Button>
              </div>
            </div>

            {conceptVariants.length ? (
              <ul className="divide-y divide-border">
                {conceptVariants.map((variant) => {
                  const compared = comparedIds.includes(variant.id)
                  const compareFull = !compared && comparedIds.length >= 4
                  return (
                    <li key={variant.id} className="px-5 py-4">
                      <article className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[13.5px] font-medium">{variant.name}</p>
                            <StatusPill tone={statusTone(variant.status)}>{CREATIVE_STATUS_LABELS[variant.status]}</StatusPill>
                            <StatusPill>{CREATIVE_LANGUAGE_LABELS[variant.language]}</StatusPill>
                            <span className="text-[11.5px] text-muted-foreground">v{variant.version}</span>
                          </div>
                          <p className="mt-2 text-[14px] font-medium tracking-[-0.01em]">
                            {variant.title || "Sem título"}
                          </p>
                          {variant.body ? (
                            <p className="mt-1 line-clamp-2 max-w-3xl text-[12.5px] leading-relaxed text-muted-foreground">
                              {variant.body}
                            </p>
                          ) : null}
                          <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11.5px] text-muted-foreground">
                            <Meta label="Mercado" value={variant.market} />
                            <Meta label="Operação" value={variant.operation} />
                            <Meta label="Tema" value={variant.theme} />
                            <Meta label="Tracking" value={variant.trackingId} />
                          </dl>
                        </div>

                        <div className="flex flex-wrap gap-1.5 xl:max-w-80 xl:justify-end">
                          <Button
                            size="sm"
                            variant={compared ? "secondary" : "outline"}
                            className="rounded-full"
                            aria-pressed={compared}
                            disabled={compareFull}
                            title={compareFull ? "A comparação aceita até quatro variações." : undefined}
                            onClick={() => onToggleCompare(variant.id)}
                          >
                            <GitCompareArrows /> {compared ? "Comparando" : "Comparar"}
                          </Button>
                          <Button size="sm" variant="ghost" className="rounded-full" onClick={() => onEdit(variant)}>
                            <Pencil /> Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-full"
                            disabled={busyAction === `duplicate:${variant.id}`}
                            onClick={() => onDuplicate(variant)}
                          >
                            <Copy /> {busyAction === `duplicate:${variant.id}` ? "A duplicar…" : "Duplicar"}
                          </Button>
                          {variant.language === "pt-BR" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="rounded-full"
                              disabled={busyAction === `translate:${variant.id}`}
                              onClick={() => onTranslate(variant)}
                              title="Cria uma nova variação ES vinculada à origem, com status Em revisão."
                            >
                              <Languages /> {busyAction === `translate:${variant.id}` ? "A traduzir…" : "Traduzir PT→ES"}
                            </Button>
                          ) : null}
                        </div>
                      </article>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="px-5 py-8 text-center text-[12.5px] text-muted-foreground">
                Nenhuma variação deste conceito corresponde aos filtros.
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 gap-1">
      <dt>{label}:</dt>
      <dd className="max-w-64 truncate text-foreground">{value || "—"}</dd>
    </div>
  )
}

function statusTone(status: CreativeStatus): "success" | "warn" | "danger" | "muted" {
  if (status === "approved" || status === "winner") return "success"
  if (status === "review" || status === "testing") return "warn"
  if (status === "paused") return "danger"
  return "muted"
}
