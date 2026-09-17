import { Link } from "react-router-dom"
import { ArrowUpRight, Workflow } from "lucide-react"
import { PageHeading } from "@/components/page-heading"
import { useStore } from "@/lib/store"
import { timeAgo } from "@/lib/format"

export function DashboardPage() {
  const { state } = useStore()
  const first = state.user?.name.split(" ")[0] ?? "olá"
  const published = state.funnels.filter((item) => item.status === "active").length
  const drafts = state.funnels.filter((item) => item.status !== "active").length
  const recent = [...state.funnels]
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
    .slice(0, 6)

  return (
    <div className="h-full overflow-y-auto">
      <div className="page-shell">
        <PageHeading title={`Olá, ${first}`} hint="Resumo dos funis da operação.">
          <Link
            to="/fluxo"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[13px] font-medium hover:bg-muted"
          >
            Abrir funis
            <ArrowUpRight className="size-3.5" />
          </Link>
        </PageHeading>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
          <StatCard label="Funis" value={state.funnels.length} hint="no quadro" href="/fluxo" />
          <StatCard label="Publicados" value={published} hint="em produção" href="/fluxo" />
          <StatCard label="Rascunhos" value={drafts} hint="ainda por publicar" href="/fluxo" />
        </div>

        <section className="surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <p className="text-[14px] font-semibold">Funis recentes</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">Últimos quadros editados</p>
            </div>
            <Link to="/fluxo" className="text-[12.5px] font-medium text-foreground/80 hover:text-foreground">
              Ver todos
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="grid place-items-center px-5 py-14 text-center">
              <Workflow className="mb-3 size-5 text-muted-foreground" />
              <p className="text-[14px] font-medium">Nenhum funil ainda</p>
              <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">
                Cria o primeiro funil para aparecer aqui.
              </p>
            </div>
          ) : (
            <ul>
              {recent.map((item) => (
                <li key={item.id} className="border-b border-border last:border-0">
                  <Link
                    to={`/fluxo/funil/${item.id}`}
                    className="grid grid-cols-[1fr_auto] items-center gap-3 px-5 py-3.5 hover:bg-muted/40 md:grid-cols-[1.4fr_100px_90px]"
                  >
                    <p className="truncate text-[13.5px] font-medium">{item.name}</p>
                    <p className="hidden text-[12.5px] md:block">{item.status === "active" ? "Publicado" : "Rascunho"}</p>
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
