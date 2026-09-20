import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import {
  Background,
  BackgroundVariant,
  ControlButton,
  Controls,
  ReactFlow,
  useReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type ReactFlowInstance,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { AlignHorizontalSpaceAround, ArrowLeft, Maximize2, Minus, PanelsTopLeft, Pencil, Plus, SlidersHorizontal } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { LogoMark } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { RenameFunnelDialog } from "./rename-dialog"
import { autoLayout, positionFromPointer } from "@/components/canvas/layout"
import { cn } from "@/lib/utils"
import type { SalesFunnel, SalesKind, SalesSnapshot } from "@/lib/types"
import { validatePublish } from "@/lib/validate"
import { defaultSalesData, type SalesCatalogItem } from "./catalog"
import { SalesInspector } from "./inspector"
import { salesNodeTypes, type SalesCanvasNode } from "./nodes"
import { SalesPalette } from "./palette"
import { FlowSimulator } from "./simulator"

const SALES_BOX = { w: 300, h: 220 }

function BoardControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  return (
    <Controls position="top-right" showZoom={false} showFitView={false} showInteractive={false} aria-label="Controlos do quadro">
      <ControlButton type="button" onClick={() => zoomIn()} title="Aproximar" aria-label="Aproximar">
        <Plus />
      </ControlButton>
      <ControlButton type="button" onClick={() => zoomOut()} title="Afastar" aria-label="Afastar">
        <Minus />
      </ControlButton>
      <ControlButton type="button" onClick={() => fitView({ padding: 0.2 })} title="Ajustar ao quadro" aria-label="Ajustar ao quadro">
        <Maximize2 />
      </ControlButton>
    </Controls>
  )
}

function toRf(funnel: Pick<SalesFunnel, "nodes" | "edges">, cursor?: string): { nodes: SalesCanvasNode[]; edges: Edge[] } {
  return {
    nodes: funnel.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      selected: n.id === cursor,
      data: { ...n.data },
    })),
    edges: funnel.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      type: "default",
    })),
  }
}

export function SalesCanvas({
  funnel,
  onSave,
  onFlush,
}: {
  funnel: SalesFunnel
  onSave: (next: SalesFunnel) => void
  onFlush?: () => Promise<{ ok: boolean; error?: string; queued?: boolean }>
}) {
  const initial = useMemo(() => toRf(funnel), [funnel])
  const [nodes, setNodes, onNodesChange] = useNodesState<SalesCanvasNode>(initial.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges)
  const [name, setName] = useState(funnel.name)
  const [version, setVersion] = useState<"draft" | "production">("draft")
  const [production, setProduction] = useState<SalesSnapshot | null | undefined>(funnel.production)
  const [selected, setSelected] = useState<SalesCanvasNode | undefined>()
  const [rf, setRf] = useState<ReactFlowInstance<SalesCanvasNode, Edge> | null>(null)
  const [renameOpen, setRenameOpen] = useState(false)
  const [cursor, setCursor] = useState<string | undefined>()
  const [mobilePanel, setMobilePanel] = useState<"none" | "blocks" | "props">("none")
  const [publishError, setPublishError] = useState("")
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()
  const keepDropSelection = useRef(false)
  const persistLock = useRef(false)
  const didFit = useRef(false)
  const skipAutoSave = useRef(true)
  const dirty = useRef(false)
  const persistRef = useRef<() => void>(() => undefined)
  const readOnlyRef = useRef(false)
  const draftRef = useRef({ nodes, edges, name, production, funnel })
  const appliedAt = useRef(funnel.updatedAt)

  useEffect(() => {
    if (!rf || didFit.current) return
    didFit.current = true
    const anchor =
      nodes.find((n) => n.type === "landing") ||
      nodes.find((n) => n.type === "traffic") ||
      nodes.find((n) => n.type === "entry") ||
      nodes[0]
    if (!anchor) {
      rf.fitView({ padding: 0.2, minZoom: 0.7, maxZoom: 0.9 })
      return
    }
    const mobile = window.innerWidth < 768
    rf.setCenter(anchor.position.x + 140, anchor.position.y + 30, { zoom: mobile ? 0.72 : 0.88, duration: 0 })
  }, [rf])

  const handleSelectionChange = useCallback(({ nodes: n }: { nodes: SalesCanvasNode[] }) => {
    if (keepDropSelection.current && n.length === 0) {
      keepDropSelection.current = false
      return
    }
    keepDropSelection.current = false
    setSelected((prev) => {
      const next = n[0]
      return prev?.id === next?.id ? prev : next
    })
  }, [])
  const readOnly = version === "production"

  const displayed = version === "production" && production ? toRf(production, cursor) : { nodes, edges }

  const persist = (
    prod?: SalesSnapshot | null,
    status?: SalesFunnel["status"],
    nextName?: string
  ) => {
    const draft = draftRef.current
    const next: SalesFunnel = {
      ...draft.funnel,
      name: nextName ?? draft.name,
      status: status ?? draft.funnel.status,
      production: (prod !== undefined ? prod : draft.production) ?? null,
      updatedAt: new Date().toISOString(),
      nodes: draft.nodes.map((n) => ({ id: n.id, type: (n.type as SalesKind) || "message", position: n.position, data: n.data })),
      edges: draft.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? undefined })),
    }
    dirty.current = false
    appliedAt.current = next.updatedAt
    onSave(next)
    return next
  }

  useLayoutEffect(() => {
    if (dirty.current) return
    if (funnel.updatedAt <= appliedAt.current) return
    const next = toRf(funnel)
    setNodes(next.nodes)
    setEdges(next.edges)
    setName(funnel.name)
    setProduction(funnel.production)
    appliedAt.current = funnel.updatedAt
    skipAutoSave.current = true
  }, [funnel, setEdges, setNodes])

  useLayoutEffect(() => {
    draftRef.current = { nodes, edges, name, production, funnel }
    persistRef.current = () => persist()
    readOnlyRef.current = readOnly
  })

  const onConnect = useCallback(
    (c: Connection) => {
      if (readOnly) return
      setEdges((eds) => addEdge({ ...c, sourceHandle: c.sourceHandle || "next", type: "default" }, eds))
    },
    [readOnly, setEdges]
  )

  const addCatalogItem = (item: SalesCatalogItem, client?: { x: number; y: number }) => {
    if (readOnly) {
      toast.message("Troque para Rascunho para editar.")
      return
    }
    const preferred = rf
      ? rf.screenToFlowPosition(client ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 })
      : { x: 480, y: 220 }
    const node: SalesCanvasNode = {
      id: crypto.randomUUID(),
      type: item.kind,
      position: positionFromPointer(preferred),
      selected: true,
      data: { ...defaultSalesData(item.kind), ...item.defaults },
    }
    keepDropSelection.current = true
    dirty.current = true
    const nextNodes = [...nodes.map((n) => ({ ...n, selected: false })), node]
    draftRef.current = { ...draftRef.current, nodes: nextNodes }
    setNodes(nextNodes)
    setSelected(node)
    persist()
    if (window.innerWidth < 768) setMobilePanel("props")
  }

  useEffect(() => {
    if (readOnly) return
    if (skipAutoSave.current) {
      skipAutoSave.current = false
      return
    }
    dirty.current = true
    const timer = window.setTimeout(() => persistRef.current(), 500)
    return () => window.clearTimeout(timer)
  }, [nodes, edges, readOnly])

  useEffect(() => {
    const flush = () => {
      if (!dirty.current || readOnlyRef.current) return
      persistRef.current()
    }
    window.addEventListener("pagehide", flush, true)
    return () => {
      window.removeEventListener("pagehide", flush, true)
      flush()
    }
  }, [])

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const raw = e.dataTransfer.getData("application/abilion-sales")
    if (!raw) return
    try {
      addCatalogItem(JSON.parse(raw) as SalesCatalogItem, { x: e.clientX, y: e.clientY })
    } catch {
      toast.error("Não consegui largar este bloco.")
    }
  }

  return (
    <div className="sales-studio flex h-full min-w-0 flex-col overflow-hidden bg-[#f4f5f7] text-slate-900">
      <header className="flex min-h-12 flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <LogoMark className="size-6 shrink-0" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 rounded-full text-[12px] text-slate-600 -ml-0.5 hover:bg-slate-100"
            onClick={() => {
              if (dirty.current && !readOnlyRef.current) persistRef.current()
              void (onFlush?.() ?? Promise.resolve()).finally(() => navigate("/fluxo"))
            }}
          >
            <ArrowLeft className="size-3.5" /> Voltar
          </Button>
          <div className="hidden rounded-full border border-slate-200 bg-[#f4f5f7] p-0.5 text-[11px] sm:flex">
            <span className="rounded-full bg-white px-2.5 py-1 text-slate-900 shadow-sm">Visual</span>
          </div>
          <div className="flex rounded-full border border-slate-200 bg-[#f4f5f7] p-0.5 text-[11px]">
            <button
              type="button"
              aria-pressed={version === "draft"}
              className={cn("rounded-full px-2.5 py-1", version === "draft" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}
              onClick={() => setVersion("draft")}
            >
              Rascunho
            </button>
            <button
              type="button"
              disabled={!production}
              aria-pressed={version === "production"}
              className={cn("rounded-full px-2.5 py-1 disabled:opacity-40", version === "production" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}
              onClick={() => setVersion("production")}
            >
              Produção
            </button>
          </div>
        </div>
        <button
          type="button"
          disabled={readOnly}
          onClick={() => setRenameOpen(true)}
          className="flex max-w-[min(100%,240px)] min-w-0 items-center gap-1.5 truncate rounded-full border border-slate-200 bg-[#f4f5f7] px-3 py-1 text-[13px] font-medium text-slate-800"
          aria-label="Alterar nome do funil"
          title="Alterar nome"
        >
          <span className="truncate">{name}</span>
          <Pencil className="size-3 shrink-0 text-slate-400" />
        </button>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
          <Button
            size="icon-sm"
            variant="ghost"
            className="rounded-full text-slate-500 md:hidden"
            aria-label="Componentes"
            onClick={() => setMobilePanel((current) => (current === "blocks" ? "none" : "blocks"))}
          >
            <PanelsTopLeft className="size-4" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            className="rounded-full text-slate-500 md:hidden"
            aria-label="Propriedades"
            onClick={() => setMobilePanel((current) => (current === "props" ? "none" : "props"))}
          >
            <SlidersHorizontal className="size-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 rounded-full border-slate-200 bg-white text-[12px] text-slate-700 hover:bg-slate-50"
            disabled={readOnly}
            onClick={() => {
              setNodes((nds) => autoLayout(nds, edges, SALES_BOX))
              rf?.fitView({ padding: 0.18, minZoom: 0.45, maxZoom: 1 })
              toast.success("Organizado.")
            }}
          >
            <AlignHorizontalSpaceAround className="size-3.5" /> Organizar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 rounded-full border-slate-200 bg-white text-[12px] text-slate-700 hover:bg-slate-50"
            disabled={readOnly || saving}
            onClick={() => {
              if (persistLock.current) return
              persistLock.current = true
              setSaving(true)
              persist()
              void (onFlush?.() ?? Promise.resolve({ ok: true as const, queued: false as boolean | undefined, error: undefined as string | undefined }))
                .then((result) => {
                  if (result.ok && result.queued) toast.message("Rascunho no painel. A gravar no Worker…")
                  else if (result.ok) toast.success("Rascunho salvo.")
                  else toast.error(result.error || "Não gravei o rascunho no Worker.")
                })
                .finally(() => {
                  persistLock.current = false
                  setSaving(false)
                })
            }}
          >
            {saving ? "A gravar…" : "Salvar rascunho"}
          </Button>
          <Button
            size="sm"
            className="h-8 rounded-full bg-[#2f6bff] text-[12px] text-white hover:bg-[#2458d6]"
            disabled={readOnly || saving}
            onClick={() => {
              if (persistLock.current) return
              const draftNodes = nodes.map((n) => ({
                id: n.id,
                type: (n.type as SalesKind) || "message",
                position: n.position,
                data: n.data,
              }))
              const draftEdges = edges.map((e) => ({
                id: e.id,
                source: e.source,
                target: e.target,
                sourceHandle: e.sourceHandle ?? undefined,
              }))
              const issues = validatePublish(draftNodes, draftEdges)
              if (issues.length) {
                setPublishError(issues[0].message)
                toast.error(issues[0].message)
                return
              }
              persistLock.current = true
              setSaving(true)
              setPublishError("")
              const snap: SalesSnapshot = {
                name,
                publishedAt: new Date().toISOString(),
                nodes: draftNodes,
                edges: draftEdges,
              }
              const previous = production
              const previousStatus = funnel.status
              setProduction(snap)
              persist(snap, "active")
              const pending = onFlush?.() ?? Promise.resolve({ ok: true, queued: false as boolean | undefined, error: undefined as string | undefined })
              void pending
                .then((result) => {
                  if (result.ok && result.queued) {
                    toast.message("Publicado no painel. A gravar no Worker…")
                    return
                  }
                  if (result.ok) {
                    toast.success("Fluxo publicado. Isto é o que corre.")
                    return
                  }
                  setProduction(previous ?? null)
                  persist(previous ?? null, previousStatus)
                  setPublishError(result.error || "Não publiquei no Worker.")
                  toast.error(result.error || "Não publiquei no Worker.")
                })
                .finally(() => {
                  persistLock.current = false
                  setSaving(false)
                })
            }}
          >
            {saving ? "A gravar…" : "Publicar"}
          </Button>
        </div>
        {publishError ? (
          <p role="alert" className="basis-full text-[12px] text-red-600">
            {publishError}
          </p>
        ) : null}
      </header>
      <div
        className="relative flex min-h-0 flex-1"
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = "copy"
        }}
        onDrop={onDrop}
      >
        {mobilePanel !== "none" && (
          <button
            type="button"
            className="absolute inset-0 z-20 bg-slate-900/20 md:hidden"
            aria-label="Fechar painel"
            onClick={() => setMobilePanel("none")}
          />
        )}
        <SalesPalette
          className={cn(
            "max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:z-30 max-md:shadow-xl",
            mobilePanel !== "blocks" && "max-md:hidden"
          )}
          onAdd={addCatalogItem}
        />
        <div className="relative min-w-0 flex-1">
          <ReactFlow
            nodes={
              cursor
                ? displayed.nodes.map((n) => ({ ...n, selected: n.id === cursor || n.selected }))
                : displayed.nodes
            }
            edges={displayed.edges}
            onNodesChange={readOnly ? undefined : onNodesChange}
            onEdgesChange={readOnly ? undefined : onEdgesChange}
            onConnect={onConnect}
            nodeTypes={salesNodeTypes}
            onInit={setRf}
            onSelectionChange={handleSelectionChange}
            onNodeClick={(_, node) => {
              setSelected(node as SalesCanvasNode)
              if (window.innerWidth < 768) setMobilePanel("props")
            }}
            onPaneClick={() => {
              setSelected(undefined)
              if (window.innerWidth < 768) setMobilePanel("none")
            }}
            connectionLineStyle={{ stroke: "#93c5fd", strokeWidth: 1.6 }}
            nodesDraggable={!readOnly}
            nodesConnectable={!readOnly}
            onlyRenderVisibleElements={false}
            elevateNodesOnSelect={false}
            selectNodesOnDrag={false}
            proOptions={{ hideAttribution: true }}
            deleteKeyCode={readOnly ? [] : ["Delete"]}
            minZoom={0.2}
            maxZoom={1.5}
            defaultEdgeOptions={{ style: { stroke: "#93c5fd", strokeWidth: 1.6 }, type: "default" }}
          >
            <Background id="sales-dots" variant={BackgroundVariant.Dots} gap={22} size={1.1} color="#d4d7de" />
            <BoardControls />
          </ReactFlow>
          <FlowSimulator
            funnel={{
              ...funnel,
              name,
              production,
              nodes: nodes.map((n) => ({
                id: n.id,
                type: (n.type as SalesKind) || "message",
                position: n.position,
                data: n.data,
              })),
              edges: edges.map((e) => ({
                id: e.id,
                source: e.source,
                target: e.target,
                sourceHandle: e.sourceHandle ?? undefined,
              })),
            }}
            preferDraft={version === "draft"}
            onCursor={setCursor}
          />
          {!selected && version === "draft" && (
            <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-slate-200 bg-white/90 px-3.5 py-1.5 text-[12px] text-slate-500 shadow-sm max-md:hidden">
              Arraste um bloco · o publicado é o que a Sté diz no Telegram
            </p>
          )}
        </div>
        <SalesInspector
          node={selected}
          readOnly={readOnly}
          className={cn(
            "max-md:absolute max-md:inset-y-0 max-md:right-0 max-md:z-30 max-md:shadow-xl",
            mobilePanel !== "props" && "max-md:hidden"
          )}
          onClose={() => {
            setSelected(undefined)
            setMobilePanel("none")
          }}
          onChange={(id, data) => setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data } : n)))}
          onDelete={() => {
            if (!selected) return
            setNodes((nds) => nds.filter((n) => n.id !== selected.id))
            setEdges((eds) => eds.filter((e) => e.source !== selected.id && e.target !== selected.id))
            setSelected(undefined)
            setMobilePanel("none")
          }}
        />
      </div>
      <RenameFunnelDialog
        open={renameOpen}
        name={name}
        onOpenChange={setRenameOpen}
        onSave={(next) => {
          setName(next)
          persist(production, funnel.status, next)
          void (onFlush?.() ?? Promise.resolve({ ok: true as const, queued: false as boolean | undefined, error: undefined as string | undefined })).then(
            (result) => {
              if (result.ok && result.queued) toast.message("Nome no painel. A gravar no Worker…")
              else if (result.ok) toast.success("Nome actualizado.")
              else toast.error(result.error || "Não gravei o nome no Worker.")
            }
          )
        }}
      />
    </div>
  )
}
