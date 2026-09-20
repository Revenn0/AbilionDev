import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"

export function NotFoundPage({
  title = "Página não encontrada",
  hint = "Este endereço não existe no painel. Confere o link ou volta ao início.",
  to = "/",
  action = "Ir ao dashboard",
}: {
  title?: string
  hint?: string
  to?: string
  action?: string
}) {
  return (
    <div className="grid h-full min-h-[50vh] place-items-center px-6 py-16">
      <div className="max-w-md text-center">
        <p className="text-[12px] font-medium tracking-[0.16em] text-muted-foreground uppercase">404</p>
        <h1 className="mt-3 text-[22px] font-medium tracking-tight">{title}</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{hint}</p>
        <Button asChild className="mt-6 rounded-full">
          <Link to={to}>{action}</Link>
        </Button>
      </div>
    </div>
  )
}
