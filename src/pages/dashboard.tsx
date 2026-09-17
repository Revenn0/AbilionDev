import { Link } from "react-router-dom"
import { ArrowUpRight, Workflow } from "lucide-react"
import { PageHeading } from "@/components/page-heading"
import { useStore } from "@/lib/store"
import { timeAgo } from "@/lib/format"

export function DashboardPage() {
  const { state } = useStore()
  const first = state.user?.name.split(" ")[0] ?? "olá"
  const activeFunnels = state.funnels.filter((item) => item.status === "active").length
  const activeFlows = state.journeys.filter((item) => item.status === "active" || item.production).length
  const recent = [
    ...state.funnels.map((item) => ({
      id: item.id,
      name: item.name,
      href: `/fluxo/funil/${item.id}`,
      kind: "Funil",
      status: item.status === "active" ? "Publicado" : "Rascunho",
      updatedAt: item.updatedAt,
    })),
    ...state.journeys.map((item) => ({
      id: item.id,
      name: item.name,
      href: `/fluxo/${item.id}`,
      kind: "Fluxo",
      status: item.production || item.status === "active" ? "Publicado" : "Rascunho",
      updatedAt: item.updatedAt,
    })),
  ]
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
    .slice(0, 6)

  return (
    <div className="h-full overflow-y-auto">
      <div className="page-shell">
        <PageHeading title={`Olá, ${first}`} hint="Resumo da operação e dos fluxos activos.">
          <Link
            to="/fluxo"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[13px] font-medium hover:bg-muted"
          >
            Abrir Fluxo
            <ArrowUpRight className="size-3.5" />
          </Link>
        </PageHeading>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard label="Funis" value={state.funnels.length} hint={`${activeFunnels} publicados`} href="/fluxo" />
          <StatCard label="Fluxos do bot" value={state.journeys.length} hint={`${activeFlows} activos`} href="/fluxo" />
          <StatCard label="Campanhas" value={state.campaigns.length} hint="ligadas a um fluxo" href="/fluxo" />
          <StatCard label="Canais" value={1} hint="Telegram disponível" href="/telegram" />
        </div>

        <section className="surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <p className="text-[14px] font-semibold">Actividade recente</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">Últimos funis e fluxos editados</p>
            </div>
            <Link to="/fluxo" className="text-[12.5px] font-medium text-foreground/80 hover:text-foreground">
              Ver todos
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="grid place-items-center px-5 py-14 text-center">
              <Workflow className="mb-3 size-5 text-muted-foreground" />
              <p className="text-[14px] font-medium">Nada publicado ainda</p>
              <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">
                Cria o primeiro funil ou fluxo do bot para aparecer aqui.
              </p>
            </div>
          ) : (
            <ul>
              {recent.map((item) => (
                <li key={`${item.kind}-${item.id}`} className="border-b border-border last:border-0">
                  <Link to={item.href} className="grid grid-cols-[1fr_auto] items-center gap-3 px-5 py-3.5 hover:bg-muted/40 md:grid-cols-[1.4fr_90px_100px_90px]">
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-medium">{item.name}</p>
                      <p className="text-[12px] text-muted-foreground md:hidden">
                        {item.kind} · {item.status}
                      </p>
                    </div>
                    <p className="hidden text-[12.5px] text-muted-foreground md:block">{item.kind}</p>
                    <p className="hidden text-[12.5px] md:block">{item.status}</p>
                    <p className="text-right text-[12px] text-muted-foreground">{timeAgo(item.updatedAt)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function StatCard({ label, value, hint, href }: { label: string; value: number; hint: string; href: string }) {
  return (
    <Link to={href} className="surface p-4 hover:bg-muted/30">
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <p className="mt-2 text-[26px] font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-[11.5px] text-muted-foreground">{hint}</p>
    </Link>
  )
}
