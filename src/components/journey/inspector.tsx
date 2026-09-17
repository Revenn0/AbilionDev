import { Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { JourneyCanvasNode } from "./nodes"

export function JourneyInspector({
  node,
  onChange,
  onDelete,
  onClose,
}: {
  node?: JourneyCanvasNode
  onChange: (id: string, data: JourneyCanvasNode["data"]) => void
  onDelete: () => void
  onClose: () => void
}) {
  if (!node) return null
  const d = node.data
  const set = (patch: Partial<typeof d>) => onChange(node.id, { ...d, ...patch })

  return (
    <aside className="absolute top-2 right-2 bottom-2 z-20 w-[300px] space-y-3.5 overflow-y-auto rounded-2xl border border-border bg-card/95 p-4 shadow-[0_16px_40px_-24px_rgb(0_0_0/0.7)] backdrop-blur-md">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Fluxo do bot</p>
        <Button variant="ghost" size="icon-xs" aria-label="Fechar" onClick={onClose}>
          <X />
        </Button>
      </div>
      <div className="space-y-1">
        <Label className="text-[11px]">Título</Label>
        <Input value={d.label} onChange={(e) => set({ label: e.target.value })} />
      </div>
      {(node.type === "message" || node.type === "ask" || node.type === "whatsapp" || node.type === "telegram") && (
        <div className="space-y-1">
          <Label className="text-[11px]">Texto</Label>
          <Textarea rows={5} value={d.template || ""} onChange={(e) => set({ template: e.target.value })} />
        </div>
      )}
      {node.type === "ask" && (
        <div className="space-y-1">
          <Label className="text-[11px]">Botões (um por linha)</Label>
          <Textarea rows={3} value={d.buttons || ""} onChange={(e) => set({ buttons: e.target.value })} />
        </div>
      )}
      {node.type === "wait" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[11px]">Valor</Label>
            <Input type="number" min={0} value={d.delayValue ?? 3} onChange={(e) => set({ delayValue: Number(e.target.value) })} />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">Unidade</Label>
            <select
              className="h-8 w-full rounded-md border bg-background px-2 text-sm"
              value={d.delayUnit || "seconds"}
              onChange={(e) => set({ delayUnit: e.target.value as "seconds" | "minutes" | "hours" })}
            >
              <option value="seconds">segundos</option>
              <option value="minutes">minutos</option>
              <option value="hours">horas</option>
            </select>
          </div>
        </div>
      )}
      <Button variant="destructive" size="sm" className="w-full" onClick={onDelete}>
        <Trash2 /> Remover bloco
      </Button>
    </aside>
  )
}
