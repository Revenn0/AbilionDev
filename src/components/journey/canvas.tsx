import { useCallback, useEffect, useMemo, useState } from "react"
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
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { AlignHorizontalSpaceAround, ArrowLeft } from "lucide-react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ThemeToggle } from "@/components/theme/toggle"
import { autoLayout, positionFromPointer } from "@/components/canvas/layout"
import type { Journey, JourneyKind } from "@/lib/types"
import { defaultJourneyData, type JourneyCatalogItem } from "./catalog"
import { JourneyInspector } from "./inspector"
import { journeyNodeTypes, type JourneyCanvasNode } from "./nodes"
import { JourneyPalette } from "./palette"

function toRf(journey: Pick<Journey, "nodes" | "edges">) {
  return {
    nodes: journey.nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: { ...n.data } })),
    edges: journey.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, type: "smoothstep" })),
  }
}

export function JourneyCanvas({ journey, onSave }: { journey: Journey; onSave: (next: Journey) => void }) {
  const initial = useMemo(() => toRf(journey), [journey])
  const [nodes, setNodes, onNodesChange] = useNodesState<JourneyCanvasNode>(initial.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges)
  const [name, setName] = useState(journey.name)
  const [selected, setSelected] = useState<JourneyCanvasNode | undefined>()
  const [rf, setRf] = useState<{
    fitView: (opts?: { padding?: number }) => void
    screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number }
  } | null>(null)
  const [didFit, setDidFit] = useState(false)

  useEffect(() => {
    if (!rf || didFit) return
    setDidFit(true)
    rf.fitView({ padding: 0.2 })
  }, [rf, didFit])

  const persist = (status: Journey["status"] = journey.status) => {
    onSave({
      ...journey,
      name,
      status,
      production: status === "active",
      updatedAt: new Date().toISOString(),
      nodes: nodes.map((n) => ({ id: n.id, type: (n.type as JourneyKind) || "message", position: n.position, data: n.data })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
    })
  }

  const addItem = (item: JourneyCatalogItem, position?: { x: number; y: number }) => {
    const node: JourneyCanvasNode = {
      id: crypto.randomUUID(),
      type: item.kind,
      position: position ?? { x: 80 + nodes.length * 40, y: 80 + nodes.length * 20 },
      selected: true,
      data: defaultJourneyData(item.kind),
    }
    setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), node])
    setSelected(node)
  }

  const onConnect = useCallback((c: Connection) => {
    setEdges((eds) => addEdge({ ...c, type: "smoothstep" }, eds))
  }, [setEdges])

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex min-h-12 flex-wrap items-center gap-2 border-b border-border bg-background px-3">
        <Button asChild variant="ghost" size="sm" className="h-8 rounded-full text-[12px] -ml-1">
          <Link to="/fluxo">
            <ArrowLeft className="size-3.5" /> Voltar
          </Link>
        </Button>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-8 w-[280px] border-0 bg-transparent text-[15px] font-semibold shadow-none focus-visible:ring-0"
        />
        <span className="rounded-full bg-white/6 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">Fluxo do bot</span>
        <div className="ml-auto flex gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-8 rounded-full text-[12px]"
            onClick={() => {
              setNodes((nds) => autoLayout(nds, edges, { w: 280, h: 160 }))
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
            onClick={() => {
              persist("active")
              toast.success("Fluxo publicado.")
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
        onDrop={(e) => {
          e.preventDefault()
          if (!rf) return
          const raw = e.dataTransfer.getData("application/abilion-node")
          if (!raw) return
          const item = JSON.parse(raw) as JourneyCatalogItem
          addItem(item, positionFromPointer(rf.screenToFlowPosition({ x: e.clientX, y: e.clientY })))
        }}
      >
        <JourneyPalette onAdd={(item) => addItem(item)} />
        <div className="relative min-w-0 flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={journeyNodeTypes}
            onInit={(instance) => setRf(instance)}
            onNodeClick={(_, node) => setSelected(node as JourneyCanvasNode)}
            onSelectionChange={({ nodes: n }) => setSelected(n[0])}
            proOptions={{ hideAttribution: true }}
            deleteKeyCode={["Delete"]}
            minZoom={0.2}
            maxZoom={1.5}
            defaultEdgeOptions={{ style: { stroke: "#2F6BFF", strokeWidth: 1.8 }, type: "smoothstep" }}
          >
            <Background id="bot-dots" variant={BackgroundVariant.Dots} gap={20} size={1.6} color="#3a404c" />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable className="!bg-card" />
          </ReactFlow>
          <JourneyInspector
            node={selected}
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
    </div>
  )
}
