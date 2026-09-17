import { Link, useParams } from "react-router-dom"
import { SalesCanvas } from "@/components/sales/canvas"
import { Button } from "@/components/ui/button"
import { useStore } from "@/lib/store"

export function FunnelEditorPage() {
  const { id } = useParams()
  const { state, saveFunnel } = useStore()
  const funnel = state.funnels.find((item) => item.id === id)

  if (!funnel) {
    return (
      <div className="h-full grid place-items-center">
        <div className="text-center space-y-3">
          <p className="font-semibold">Funil não encontrado</p>
          <Button asChild>
            <Link to="/fluxo">Voltar</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full">
      <SalesCanvas key={funnel.id} funnel={funnel} onSave={saveFunnel} />
    </div>
  )
}
