import { Component, type ReactNode } from "react"
import { Button } from "@/components/ui/button"

type State = { failed: boolean }

export class RouteError extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="grid h-full min-h-[50vh] place-items-center px-6 py-16" role="alert">
        <div className="max-w-md text-center">
          <h1 className="text-[22px] font-medium tracking-tight">Não consegui abrir esta página</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
            O painel falhou a carregar este ecrã. Recarrega — se persistir, volta ao dashboard.
          </p>
          <Button className="mt-6 rounded-full" onClick={() => window.location.reload()}>
            Recarregar
          </Button>
        </div>
      </div>
    )
  }
}
