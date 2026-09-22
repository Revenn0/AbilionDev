import { useCallback, useMemo, useState, useEffect } from "react"
import {
  Download,
  FileJson,
  FlaskConical,
  LayoutGrid,
  Palette,
  Plus,
} from "lucide-react"
import { toast } from "sonner"
import { PageChrome, StatusPill } from "@/components/layout/chrome"
import { Button } from "@/components/ui/button"
import { CreativeComparison } from "@/components/creatives/creative-comparison"
import {
  ConceptEditorDialog,
  VariantEditorDialog,
} from "@/components/creatives/creative-editor-dialog"
import {
  CreativeFilters,
  type CreativeFilterState,
} from "@/components/creatives/creative-filters"
import {
  CreativeExperiments,
  ExperimentEditorDialog,
} from "@/components/creatives/creative-experiments"
import { CreativeLibrary } from "@/components/creatives/creative-library"
import {
  createCreativeConceptRequest,
  createCreativeExperimentRequest,
  createCreativeVariantRequest,
  downloadCreativesCsv,
  downloadCreativesJson,
  duplicateCreativeVariantRequest,
  listCreativeExperimentsRequest,
  listCreativesRequest,
  translateCreativeVariantRequest,
  updateCreativeConceptRequest,
  updateCreativeExperimentRequest,
  updateCreativeVariantRequest,
  type CreativeConceptInput,
  type CreativeExperimentInput,
  type CreativeVariantInput,
} from "@/lib/creative-api"
import type {
  CreativeConcept,
  CreativeExperiment,
  CreativeVariant,
} from "@/lib/platform"
import { cn } from "@/lib/utils"

type LoadState = "loading" | "ready" | "error"
type CreativeView = "library" | "experiments"

const INITIAL_FILTERS: CreativeFilterState = {
  query: "",
  language: "all",
  theme: "all",
  status: "all",
}

export function CreativesPage() {
  const [concepts, setConcepts] = useState<CreativeConcept[]>([])
  const [variants, setVariants] = useState<CreativeVariant[]>([])
  const [experiments, setExperiments] = useState<CreativeExperiment[]>([])
  const [catalogState, setCatalogState] = useState<LoadState>("loading")
  const [experimentState, setExperimentState] = useState<LoadState>("loading")
  const [catalogError, setCatalogError] = useState("")
  const [experimentError, setExperimentError] = useState("")
  const [view, setView] = useState<CreativeView>("library")
  const [filters, setFilters] = useState<CreativeFilterState>(INITIAL_FILTERS)
  const [conceptDialogOpen, setConceptDialogOpen] = useState(false)
  const [editingConcept, setEditingConcept] = useState<CreativeConcept | null>(null)
  const [variantDialogOpen, setVariantDialogOpen] = useState(false)
  const [editingVariant, setEditingVariant] = useState<CreativeVariant | null>(null)
  const [defaultConceptId, setDefaultConceptId] = useState<string>()
  const [experimentDialogOpen, setExperimentDialogOpen] = useState(false)
  const [editingExperiment, setEditingExperiment] = useState<CreativeExperiment | null>(null)
  const [comparedIds, setComparedIds] = useState<string[]>([])
  const [busyAction, setBusyAction] = useState<string | null>(null)

  const loadCatalog = useCallback(async () => {
    setCatalogState("loading")
    setCatalogError("")
    try {
      const catalog = await listCreativesRequest()
      setConcepts(catalog.concepts)
      setVariants(catalog.variants)
      setComparedIds((current) => current.filter((id) => catalog.variants.some((variant) => variant.id === id)))
      setCatalogState("ready")
    } catch (error) {
      setCatalogError(errorMessage(error))
      setCatalogState("error")
    }
  }, [])

  const loadExperiments = useCallback(async () => {
    setExperimentState("loading")
    setExperimentError("")
    try {
      const next = await listCreativeExperimentsRequest()
      setExperiments(next)
      setExperimentState("ready")
    } catch (error) {
      setExperimentError(errorMessage(error))
      setExperimentState("error")
    }
  }, [])

  useEffect(() => {
    let active = true
    void listCreativesRequest()
      .then((catalog) => {
        if (!active) return
        setConcepts(catalog.concepts)
        setVariants(catalog.variants)
        setComparedIds((current) => current.filter((id) => catalog.variants.some((variant) => variant.id === id)))
        setCatalogState("ready")
      })
      .catch((error) => {
        if (!active) return
        setCatalogError(errorMessage(error))
        setCatalogState("error")
      })
    void listCreativeExperimentsRequest()
      .then((next) => {
        if (!active) return
        setExperiments(next)
        setExperimentState("ready")
      })
      .catch((error) => {
        if (!active) return
        setExperimentError(errorMessage(error))
        setExperimentState("error")
      })
    return () => {
      active = false
    }
  }, [])

  const conceptById = useMemo(
    () => new Map(concepts.map((concept) => [concept.id, concept])),
    [concepts]
  )
  const themes = useMemo(
    () =>
      [...new Set([...concepts.map((concept) => concept.theme), ...variants.map((variant) => variant.theme)])]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "pt-BR")),
    [concepts, variants]
  )
  const needle = normalizeSearch(filters.query)
  const filteredVariants = useMemo(
    () =>
      variants.filter((variant) => {
        if (filters.language !== "all" && variant.language !== filters.language) return false
        if (filters.status !== "all" && variant.status !== filters.status) return false
        if (filters.theme !== "all" && variant.theme !== filters.theme) return false
        if (!needle) return true
        const concept = conceptById.get(variant.conceptId)
        return normalizeSearch(
          [
            variant.name,
            variant.title,
            variant.body,
            variant.cta,
            variant.description,
            variant.script,
            variant.theme,
            variant.market,
            variant.operation,
            variant.trackingId,
            concept?.name,
          ].join(" ")
        ).includes(needle)
      }),
    [variants, filters.language, filters.status, filters.theme, needle, conceptById]
  )
  const visibleConcepts = useMemo(() => {
    const visibleIds = new Set(filteredVariants.map((variant) => variant.conceptId))
    const variantScoped = filters.language !== "all" || filters.status !== "all"
    return concepts.filter((concept) => {
      if (visibleIds.has(concept.id)) return true
      if (variantScoped) return false
      if (filters.theme !== "all" && concept.theme !== filters.theme) return false
      if (!needle) return true
      return normalizeSearch(`${concept.name} ${concept.theme}`).includes(needle)
    })
  }, [concepts, filteredVariants, filters.language, filters.status, filters.theme, needle])
  const comparedVariants = comparedIds
    .map((id) => variants.find((variant) => variant.id === id))
    .filter((variant): variant is CreativeVariant => Boolean(variant))

  const saveConcept = async (input: CreativeConceptInput) => {
    try {
      const concept = editingConcept
        ? await updateCreativeConceptRequest({ ...editingConcept, ...input })
        : await createCreativeConceptRequest(input)
      setConcepts((current) => upsert(current, concept))
      toast.success(editingConcept ? "Conceito atualizado." : "Conceito criado.")
      return true
    } catch (error) {
      toast.error(errorMessage(error))
      return false
    }
  }

  const saveVariant = async (input: CreativeVariantInput) => {
    try {
      const variant = editingVariant
        ? await updateCreativeVariantRequest({ ...editingVariant, ...input })
        : await createCreativeVariantRequest(input)
      setVariants((current) => upsert(current, variant))
      toast.success(editingVariant ? "Variação atualizada." : "Variação criada.")
      return true
    } catch (error) {
      toast.error(errorMessage(error))
      return false
    }
  }

  const duplicateVariant = async (variant: CreativeVariant) => {
    const action = `duplicate:${variant.id}`
    if (busyAction) return
    setBusyAction(action)
    try {
      const copy = await duplicateCreativeVariantRequest(variant.id)
      setVariants((current) => upsert(current, copy))
      toast.success("Cópia criada como rascunho.")
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusyAction(null)
    }
  }

  const translateVariant = async (variant: CreativeVariant) => {
    const action = `translate:${variant.id}`
    if (busyAction) return
    setBusyAction(action)
    try {
      const translation = await translateCreativeVariantRequest(variant.id)
      setVariants((current) => upsert(current, translation))
      toast.success("Tradução ES criada em revisão.")
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusyAction(null)
    }
  }

  const saveExperiment = async (input: CreativeExperimentInput) => {
    try {
      const experiment = editingExperiment
        ? await updateCreativeExperimentRequest(editingExperiment.id, input)
        : await createCreativeExperimentRequest(input)
      setExperiments((current) => upsert(current, experiment))
      toast.success(editingExperiment ? "Experiência atualizada." : "Experiência criada.")
      return true
    } catch (error) {
      toast.error(errorMessage(error))
      return false
    }
  }

  const openNewVariant = (conceptId?: string) => {
    setEditingVariant(null)
    setDefaultConceptId(conceptId)
    setVariantDialogOpen(true)
  }

  const setVariantDialog = (open: boolean) => {
    setVariantDialogOpen(open)
    if (!open) {
      setEditingVariant(null)
      setDefaultConceptId(undefined)
    }
  }

  const setConceptDialog = (open: boolean) => {
    setConceptDialogOpen(open)
    if (!open) setEditingConcept(null)
  }

  const setExperimentDialog = (open: boolean) => {
    setExperimentDialogOpen(open)
    if (!open) setEditingExperiment(null)
  }

  const exportConcepts = concepts.filter(
    (concept) =>
      visibleConcepts.some((visible) => visible.id === concept.id) ||
      filteredVariants.some((variant) => variant.conceptId === concept.id)
  )
  const catalogReady = catalogState === "ready"
  const experimentsReady = experimentState === "ready"
  const canCreateExperiment = catalogReady && experimentsReady && variants.length >= 2

  return (
    <div className="h-full overflow-y-auto">
      <div className="page-shell">
        <PageChrome icon={Palette} title="Criativos">
          <StatusPill tone={catalogReady ? "success" : catalogState === "error" ? "danger" : "muted"}>
            Catálogo · {catalogReady ? `${variants.length} variações` : catalogState === "loading" ? "a carregar" : "sem leitura"}
          </StatusPill>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            disabled={!catalogReady || (!exportConcepts.length && !filteredVariants.length)}
            title={!catalogReady ? "A exportação espera uma leitura confirmada da API." : undefined}
            onClick={() => {
              if (!downloadCreativesJson(exportConcepts, filteredVariants)) return
              toast.success(`JSON local com ${filteredVariants.length} variações reais.`)
            }}
          >
            <FileJson /> JSON
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            disabled={!catalogReady || filteredVariants.length === 0}
            title={!catalogReady ? "A exportação espera uma leitura confirmada da API." : undefined}
            onClick={() => {
              if (!downloadCreativesCsv(exportConcepts, filteredVariants)) return
              toast.success(`CSV local com ${filteredVariants.length} variações reais.`)
            }}
          >
            <Download /> CSV
          </Button>
        </PageChrome>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
            Conceitos, versões de conteúdo e testes controlados. Métricas só são mostradas quando chegam da API; ausência de leitura nunca vira zero.
          </p>
          <div className="flex flex-wrap gap-2">
            {view === "library" ? (
              <>
                <Button
                  variant="outline"
                  className="rounded-full"
                  disabled={!catalogReady}
                  onClick={() => {
                    setEditingConcept(null)
                    setConceptDialogOpen(true)
                  }}
                >
                  <Plus /> Novo conceito
                </Button>
                <Button
                  className="rounded-full"
                  disabled={!catalogReady || concepts.length === 0}
                  title={catalogReady && !concepts.length ? "Cria um conceito primeiro." : undefined}
                  onClick={() => openNewVariant()}
                >
                  <Plus /> Nova variação
                </Button>
              </>
            ) : (
              <Button
                className="rounded-full"
                disabled={!canCreateExperiment}
                title={
                  !catalogReady || !experimentsReady
                    ? "A criação espera leituras confirmadas das duas APIs."
                    : variants.length < 2
                      ? "Cria pelo menos duas variações."
                      : undefined
                }
                onClick={() => {
                  setEditingExperiment(null)
                  setExperimentDialogOpen(true)
                }}
              >
                <Plus /> Nova experiência
              </Button>
            )}
          </div>
        </div>

        {(view === "library" ? catalogError : experimentError) ? (
          <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-[12.5px] text-destructive" role="alert">
            {view === "library" ? catalogError : experimentError}
          </p>
        ) : null}

        <div role="tablist" aria-label="Áreas de criativos" className="flex w-full gap-1 rounded-full bg-card p-1">
          <ViewTab
            active={view === "library"}
            icon={LayoutGrid}
            onClick={() => setView("library")}
          >
            Biblioteca
          </ViewTab>
          <ViewTab
            active={view === "experiments"}
            icon={FlaskConical}
            onClick={() => setView("experiments")}
          >
            Experiências
          </ViewTab>
        </div>

        {view === "library" ? (
          <>
            <CreativeFilters value={filters} themes={themes} onChange={setFilters} />
            {comparedIds.length ? (
              <CreativeComparison
                variants={comparedVariants}
                onRemove={(variantId) => setComparedIds((current) => current.filter((id) => id !== variantId))}
                onClear={() => setComparedIds([])}
              />
            ) : null}
            <CreativeLibrary
              concepts={visibleConcepts}
              variants={filteredVariants}
              loading={catalogState === "loading"}
              unread={catalogState === "error"}
              busyAction={busyAction}
              comparedIds={comparedIds}
              onRetry={() => void loadCatalog()}
              onCreateVariant={openNewVariant}
              onEditConcept={(concept) => {
                setEditingConcept(concept)
                setConceptDialogOpen(true)
              }}
              onEdit={(variant) => {
                setEditingVariant(variant)
                setDefaultConceptId(variant.conceptId)
                setVariantDialogOpen(true)
              }}
              onDuplicate={(variant) => void duplicateVariant(variant)}
              onTranslate={(variant) => void translateVariant(variant)}
              onToggleCompare={(variantId) =>
                setComparedIds((current) =>
                  current.includes(variantId)
                    ? current.filter((id) => id !== variantId)
                    : current.length < 4
                      ? [...current, variantId]
                      : current
                )
              }
            />
          </>
        ) : (
          <CreativeExperiments
            experiments={experiments}
            variants={variants}
            loading={experimentState === "loading"}
            unread={experimentState === "error"}
            onRetry={() => void loadExperiments()}
            onEdit={(experiment) => {
              setEditingExperiment(experiment)
              setExperimentDialogOpen(true)
            }}
          />
        )}
      </div>

      {conceptDialogOpen ? (
        <ConceptEditorDialog
          open
          onOpenChange={setConceptDialog}
          concept={editingConcept}
          onSave={saveConcept}
        />
      ) : null}
      {variantDialogOpen ? (
        <VariantEditorDialog
          open
          onOpenChange={setVariantDialog}
          concepts={concepts}
          variant={editingVariant}
          defaultConceptId={defaultConceptId}
          onSave={saveVariant}
        />
      ) : null}
      {experimentDialogOpen ? (
        <ExperimentEditorDialog
          open
          onOpenChange={setExperimentDialog}
          experiment={editingExperiment}
          variants={variants}
          onSave={saveExperiment}
        />
      ) : null}
    </div>
  )
}

function ViewTab({
  active,
  icon: Icon,
  onClick,
  children,
}: {
  active: boolean
  icon: typeof LayoutGrid
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-medium",
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="size-3.5" />
      {children}
    </button>
  )
}

function upsert<T extends { id: string }>(items: T[], item: T) {
  const index = items.findIndex((current) => current.id === item.id)
  if (index < 0) return [...items, item]
  return items.map((current) => (current.id === item.id ? item : current))
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim()
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : "Não foi possível concluir a ação."
}
