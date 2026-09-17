import { Link, useParams } from "react-router-dom"
import { JourneyCanvas } from "@/components/journey/canvas"
import { Button } from "@/components/ui/button"
import { useStore } from "@/lib/store"

export function JourneyEditorPage() {
  const { id } = useParams()
  const { state, saveJourney } = useStore()
  const journey = state.journeys.find((item) => item.id === id)

  if (!journey) {
    return (
      <div className="h-full grid place-items-center">
        <div className="text-center space-y-3">
          <p className="font-semibold">Fluxo não encontrado</p>
          <Button asChild>
            <Link to="/fluxo">Voltar</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full">
      <JourneyCanvas key={journey.id} journey={journey} onSave={saveJourney} />
    </div>
  )
}
