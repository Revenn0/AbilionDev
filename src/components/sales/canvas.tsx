import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type ReactFlowInstance,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { AlignHorizontalSpaceAround, ArrowLeft, Pencil } from "lucide-react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme/toggle"
import { RenameFunnelDialog } from "./rename-dialog"
import { autoLayout, positionFromPointer } from "@/components/canvas/layout"
import { cn } from "@/lib/utils"
import type { SalesFunnel, SalesKind, SalesSnapshot } from "@/lib/types"
import { defaultSalesData, type SalesCatalogItem } from "./catalog"
import { SalesInspector } from "./inspector"
import { salesNodeTypes, type SalesCanvasNode } from "./nodes"
import { SalesPalette } from "./palette"

const SALES_BOX = { w: 420, h: 320 }

function toRf(funnel: Pick<SalesFunnel, "nodes" | "edges">): { nodes: SalesCanvasNode[]; edges: Edge[] } {
  return {
    nodes: funnel.nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: { ...n.data } })),
    edges: funnel.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      type: "smoothstep",
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
  const keepDropSelection = useRef(false)
  const didFit = useRef(false)

  useEffect(() => {
    if (!rf || didFit.current) return
    didFit.current = true
    rf.fitView({ padding: 0.18 })
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

  const displayed = version === "production" && production ? toRf(production) : { nodes, edges }

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
      nodes: nodes.map((n) => ({ id: n.id, type: (n.type as SalesKind) || "whatsapp", position: n.position, data: n.data })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? undefined })),
    }
    onSave(next)
    return next
  }

  const onConnect = useCallback(
    (c: Connection) => {
      if (readOnly) return
      setEdges((eds) => addEdge({ ...c, sourceHandle: c.sourceHandle || "next", type: "smoothstep" }, eds))
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
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex min-h-12 flex-wrap items-center gap-2 border-b border-border bg-background px-3">
        <Button asChild variant="ghost" size="sm" className="h-8 rounded-full text-[12px] -ml-1">
          <Link to="/fluxo">
            <ArrowLeft className="size-3.5" /> Voltar
          </Link>
        </Button>
        <p className="max-w-[240px] truncate text-[15px] font-semibold">{name}</p>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Alterar nome do funil"
          title="Alterar nome"
          disabled={readOnly}
          onClick={() => setRenameOpen(true)}
        >
          <Pencil className="size-3.5" />
        </Button>
        <span className="rounded-full bg-white/6 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">Funil de vendas</span>
        <div className="flex rounded-full border p-0.5 text-[11px]">
          <button
            type="button"
            className={cn("rounded-full px-2.5 py-1", version === "draft" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
            onClick={() => setVersion("draft")}
          >
            Rascunho
          </button>
          <button
            type="button"
            disabled={!production}
            className={cn("rounded-full px-2.5 py-1", version === "production" ? "bg-emerald-600 text-white" : "text-muted-foreground")}
            onClick={() => setVersion("production")}
          >
            Produção
          </button>
        </div>
        <div className="ml-auto flex gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-8 rounded-full text-[12px]"
            disabled={readOnly}
            onClick={() => {
              setNodes((nds) => autoLayout(nds, edges, SALES_BOX))
              rf?.fitView({ padding: 0.2 })
              toast.success("Organizado.")
            }}
          >
            <AlignHorizontalSpaceAround className="size-3.5" /> Organizar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 rounded-full text-[12px]"
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
            className="h-8 rounded-full text-[12px]"
            disabled={readOnly}
            onClick={() => {
              const snap: SalesSnapshot = {
                name,
                publishedAt: new Date().toISOString(),
                nodes: nodes.map((n) => ({ id: n.id, type: (n.type as SalesKind) || "whatsapp", position: n.position, data: n.data })),
                edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? undefined })),
              }
              setProduction(snap)
              persist(snap, "active")
              toast.success("Funil publicado.")
            }}
          >
            Publicar
          </Button>
          <ThemeToggle />
        </div>
      </header>
      <div
        className="flex min-h-0 flex-1"
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = "copy"
        }}
        onDrop={onDrop}
      >
        <SalesPalette />
        <div className="relative min-w-0 flex-1">
          <ReactFlow
            nodes={displayed.nodes}
            edges={displayed.edges}
            onNodesChange={readOnly ? undefined : onNodesChange}
            onEdgesChange={readOnly ? undefined : onEdgesChange}
            onConnect={onConnect}
            nodeTypes={salesNodeTypes}
            onInit={setRf}
            onSelectionChange={handleSelectionChange}
            onNodeClick={(_, node) => setSelected(node as SalesCanvasNode)}
            nodesDraggable={!readOnly}
            nodesConnectable={!readOnly}
            onlyRenderVisibleElements
            selectNodesOnDrag={false}
            proOptions={{ hideAttribution: true }}
            deleteKeyCode={readOnly ? [] : ["Delete"]}
            minZoom={0.2}
            maxZoom={1.5}
            defaultEdgeOptions={{ style: { stroke: "#94A3B8", strokeWidth: 1.8 }, type: "smoothstep" }}
          >
            <Background id="sales-dots" variant={BackgroundVariant.Dots} gap={20} size={1.6} color="#3a404c" />
            <Controls showInteractive={false} />
            <MiniMap
              pannable
              zoomable
              className="!bg-card"
              nodeColor={(n) =>
                n.type === "whatsapp" ? "#25D366" : n.type === "split" ? "#7C3AED" : n.type === "sales_page" ? "#2F6BFF" : "#64748B"
              }
            />
          </ReactFlow>
          {!selected && version === "draft" && (
            <p className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-border bg-card/90 px-3.5 py-1.5 text-[12px] text-muted-foreground shadow-sm">
              Arraste fontes, divisor ou mensagens · clique para editar o texto e a URL
            </p>
          )}
          <SalesInspector
            node={version === "draft" ? selected : undefined}
            readOnly={readOnly}
            onClose={() => setSelected(undefined)}
            onChange={(id, data) => setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data } : n)))}
            onDelete={() => {
              if (!selected) return
              setNodes((nds) => nds.filter((n) => n.id !== selected.id))
              setEdges((eds) => eds.filter((e) => e.source !== selected.id && e.target !== selected.id))
              setSelected(undefined)
            }}
          />
        </div>
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
