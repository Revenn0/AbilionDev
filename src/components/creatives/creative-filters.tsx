import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  CREATIVE_LANGUAGE_LABELS,
  CREATIVE_STATUS_LABELS,
} from "@/components/creatives/creative-labels"
import type { CreativeLanguage, CreativeStatus } from "@/lib/platform"

export type CreativeFilterState = {
  query: string
  language: "all" | CreativeLanguage
  theme: string
  status: "all" | CreativeStatus
}

const STATUS_OPTIONS = Object.entries(CREATIVE_STATUS_LABELS) as Array<[CreativeStatus, string]>

export function CreativeFilters({
  value,
  themes,
  onChange,
}: {
  value: CreativeFilterState
  themes: string[]
  onChange: (value: CreativeFilterState) => void
}) {
  return (
    <section className="surface grid gap-3 p-4 md:grid-cols-[minmax(220px,1fr)_180px_180px_180px]" aria-label="Filtros de criativos">
      <div className="space-y-1.5">
        <Label htmlFor="creative-search">Buscar</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="creative-search"
            className="pl-8"
            value={value.query}
            onChange={(event) => onChange({ ...value, query: event.target.value })}
            placeholder="Conceito, título ou tracking"
          />
        </div>
      </div>
      <FilterSelect
        id="creative-language-filter"
        label="Idioma"
        value={value.language}
        onChange={(language) => onChange({ ...value, language: language as CreativeFilterState["language"] })}
      >
        <option value="all">Todos os idiomas</option>
        <option value="pt-BR">{CREATIVE_LANGUAGE_LABELS["pt-BR"]}</option>
        <option value="es">{CREATIVE_LANGUAGE_LABELS.es}</option>
      </FilterSelect>
      <FilterSelect
        id="creative-theme-filter"
        label="Tema"
        value={value.theme}
        onChange={(theme) => onChange({ ...value, theme })}
      >
        <option value="all">Todos os temas</option>
        {themes.map((theme) => (
          <option key={theme} value={theme}>
            {theme}
          </option>
        ))}
      </FilterSelect>
      <FilterSelect
        id="creative-status-filter"
        label="Status"
        value={value.status}
        onChange={(status) => onChange({ ...value, status: status as CreativeFilterState["status"] })}
      >
        <option value="all">Todos os status</option>
        {STATUS_OPTIONS.map(([status, label]) => (
          <option key={status} value={status}>
            {label}
          </option>
        ))}
      </FilterSelect>
    </section>
  )
}

function FilterSelect({
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
