import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type ReactFlowInstance,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { AlignHorizontalSpaceAround, ArrowLeft, PanelsTopLeft, Pencil, SlidersHorizontal } from "lucide-react"
import { Link } from "react-router-dom"
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

export function SalesCanvas({ funnel, onSave }: { funnel: SalesFunnel; onSave: (next: SalesFunnel) => void }) {
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
  const keepDropSelection = useRef(false)
  const didFit = useRef(false)

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
    prod = production,
    status: SalesFunnel["status"] = funnel.status,
    nextName = name
  ) => {
    const next: SalesFunnel = {
      ...funnel,
      name: nextName,
      status,
      production: prod ?? null,
      updatedAt: new Date().toISOString(),
      nodes: nodes.map((n) => ({ id: n.id, type: (n.type as SalesKind) || "message", position: n.position, data: n.data })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? undefined })),
    }
    onSave(next)
    return next
  }

  const onConnect = useCallback(
    (c: Connection) => {
      if (readOnly) return
      setEdges((eds) => addEdge({ ...c, sourceHandle: c.sourceHandle || "next", type: "default" }, eds))
    },
    [readOnly, setEdges]
  )

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (readOnly) {
      toast.message("Troque para Rascunho para editar.")
      return
    }
    if (!rf) return
    const raw = e.dataTransfer.getData("application/abilion-sales")
    if (!raw) return
    const item = JSON.parse(raw) as SalesCatalogItem
    const preferred = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const position = positionFromPointer(preferred)
    const node: SalesCanvasNode = {
      id: crypto.randomUUID(),
      type: item.kind,
      position,
      selected: true,
      data: { ...defaultSalesData(item.kind), ...item.defaults },
    }
    keepDropSelection.current = true
    setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), node])
    setSelected(node)
    if (window.innerWidth < 768) setMobilePanel("props")
  }

  return (
    <div className="sales-studio flex h-full flex-col bg-[#f4f5f7] text-slate-900">
      <header className="grid min-h-12 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-slate-200 bg-white px-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <LogoMark className="size-6 shrink-0" />
          <Button asChild variant="ghost" size="sm" className="h-8 rounded-full text-[12px] text-slate-600 -ml-0.5 hover:bg-slate-100">
            <Link to="/fluxo">
              <ArrowLeft className="size-3.5" /> Voltar
            </Link>
          </Button>
          <div className="hidden rounded-full border border-slate-200 bg-[#f4f5f7] p-0.5 text-[11px] sm:flex">
            <span className="rounded-full bg-white px-2.5 py-1 text-slate-900 shadow-sm">Visual</span>
          </div>
          <div className="flex rounded-full border border-slate-200 bg-[#f4f5f7] p-0.5 text-[11px]">
            <button
              type="button"
              className={cn("rounded-full px-2.5 py-1", version === "draft" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}
              onClick={() => setVersion("draft")}
            >
              Rascunho
            </button>
            <button
              type="button"
              disabled={!production}
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
          className="flex max-w-[240px] items-center gap-1.5 truncate rounded-full border border-slate-200 bg-[#f4f5f7] px-3 py-1 text-[13px] font-medium text-slate-800"
          aria-label="Alterar nome do funil"
          title="Alterar nome"
        >
          <span className="truncate">{name}</span>
          <Pencil className="size-3 shrink-0 text-slate-400" />
        </button>
        <div className="ml-auto flex items-center gap-1.5">
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
            className="hidden h-8 rounded-full border-slate-200 bg-white text-[12px] text-slate-700 hover:bg-slate-50 sm:inline-flex"
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
            className="hidden h-8 rounded-full border-slate-200 bg-white text-[12px] text-slate-700 hover:bg-slate-50 sm:inline-flex"
            disabled={readOnly}
            onClick={() => {
              persist()
              toast.success("Rascunho salvo.")
            }}
          >
            Salvar rascunho
          </Button>
          <Button
            size="sm"
            className="h-8 rounded-full bg-[#2f6bff] text-[12px] text-white hover:bg-[#2458d6]"
            disabled={readOnly}
            onClick={() => {
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
                toast.error(issues[0].message)
                return
              }
              const snap: SalesSnapshot = {
                name,
                publishedAt: new Date().toISOString(),
                nodes: draftNodes,
                edges: draftEdges,
              }
              setProduction(snap)
              persist(snap, "active")
              toast.success("Fluxo publicado. Isto é o que corre.")
            }}
          >
            Publicar
          </Button>
        </div>
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
            onlyRenderVisibleElements
            elevateNodesOnSelect={false}
            selectNodesOnDrag={false}
            proOptions={{ hideAttribution: true }}
            deleteKeyCode={readOnly ? [] : ["Delete"]}
            minZoom={0.2}
            maxZoom={1.5}
            defaultEdgeOptions={{ style: { stroke: "#93c5fd", strokeWidth: 1.6 }, type: "default" }}
          >
            <Background id="sales-dots" variant={BackgroundVariant.Dots} gap={22} size={1.1} color="#d4d7de" />
            <Controls showInteractive={false} />
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
          toast.success("Nome actualizado.")
        }}
      />
    </div>
  )
}
