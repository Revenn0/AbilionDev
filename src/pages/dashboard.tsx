import { Link } from "react-router-dom"
import { PageHeading } from "@/components/page-heading"
import { useStore } from "@/lib/store"

export function DashboardPage() {
  const { state } = useStore()
  const first = state.user?.name.split(" ")[0] ?? "aí"
  const activeFunnels = state.funnels.filter((item) => item.status === "active").length
  const activeFlows = state.journeys.filter((item) => item.status === "active" || item.production).length

  return (
    <div className="h-full overflow-y-auto">
      <div className="page-shell">
        <PageHeading title={`Olá, ${first}`}>
          <Link to="/fluxo" className="rounded-full border px-4 py-2 text-[13px] text-muted-foreground hover:bg-muted">
            Abrir Fluxo
          </Link>
        </PageHeading>

        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard label="Funis" value={state.funnels.length} hint="desenhos visuais" href="/fluxo" />
          <StatCard label="Publicados" value={activeFunnels} hint="em produção" href="/fluxo" />
          <StatCard label="Fluxos do bot" value={state.journeys.length} hint="mapas n8n" href="/fluxo" />
          <StatCard label="Campanhas" value={state.campaigns.length} hint={`${activeFlows} fluxos activos`} href="/fluxo" />
        </div>

        <section className="surface overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <p className="text-[15px] font-semibold">Recorte deste repositório</p>
          </div>
          <div className="px-5 pb-6 text-sm leading-relaxed text-muted-foreground">
            Login, área interna e o criador de funis/fluxo. Leads, conversas e canais ficam de fora até a próxima fatia.
          </div>
        </section>
      </div>
    </div>
  )
}

function StatCard({ label, value, hint, href }: { label: string; value: number; hint: string; href: string }) {
  return (
    <Link to={href} className="surface p-4 transition-colors hover:bg-muted/40">
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <p className="mt-2 text-[28px] font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
    </Link>
  )
}
