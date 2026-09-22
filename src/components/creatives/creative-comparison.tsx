import { X } from "lucide-react"
import { StatusPill } from "@/components/layout/chrome"
import { Button } from "@/components/ui/button"
import {
  CREATIVE_LANGUAGE_LABELS,
  CREATIVE_STATUS_LABELS,
} from "@/components/creatives/creative-labels"
import type { CreativeVariant } from "@/lib/platform"

export function CreativeComparison({
  variants,
  onRemove,
  onClear,
}: {
  variants: CreativeVariant[]
  onRemove: (variantId: string) => void
  onClear: () => void
}) {
  return (
    <section className="surface overflow-hidden" aria-labelledby="creative-comparison-title">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 id="creative-comparison-title" className="text-[14px] font-medium">
            Comparação editorial
          </h2>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Compara apenas conteúdo e metadados reais. Resultados aparecem nas experiências quando a API os devolver.
          </p>
        </div>
        <Button size="sm" variant="ghost" className="rounded-full" onClick={onClear}>
          Limpar comparação
        </Button>
      </div>

      {variants.length < 2 ? (
        <div className="px-5 py-8 text-center text-[12.5px] text-muted-foreground">
          Seleciona mais uma variação para comparar lado a lado.
        </div>
      ) : (
        <div className="grid divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-4">
          {variants.map((variant) => (
            <article key={variant.id} className="min-w-0 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-medium">{variant.name}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <StatusPill>{CREATIVE_LANGUAGE_LABELS[variant.language]}</StatusPill>
                    <StatusPill>{CREATIVE_STATUS_LABELS[variant.status]}</StatusPill>
                  </div>
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Remover ${variant.name} da comparação`}
                  onClick={() => onRemove(variant.id)}
                >
                  <X />
                </Button>
              </div>

              <dl className="mt-5 space-y-4 text-[12.5px]">
                <ComparisonField label="Título" value={variant.title} />
                <ComparisonField label="Texto principal" value={variant.body} preserve />
                <ComparisonField label="CTA" value={variant.cta} />
                <ComparisonField label="Descrição" value={variant.description} preserve />
                <ComparisonField label="Roteiro" value={variant.script} preserve />
                <ComparisonField label="Tema" value={variant.theme} />
                <ComparisonField label="Mercado" value={variant.market} />
                <ComparisonField label="Operação" value={variant.operation} />
                <ComparisonField label="Tracking" value={variant.trackingId} />
              </dl>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function ComparisonField({
  label,
  value,
  preserve = false,
}: {
  label: string
  value: string
  preserve?: boolean
}) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={`mt-1 leading-relaxed ${preserve ? "whitespace-pre-wrap" : ""}`}>{value || "—"}</dd>
    </div>
  )
}
