import type { ComponentType } from "react"
import { Calendar, MessagesSquare, Search, Send, Users } from "lucide-react"
import { FilterChip, PageChrome, StatusPill } from "@/components/layout/chrome"

const ICONS: Record<string, ComponentType<{ className?: string; strokeWidth?: number }>> = {
  Leads: Users,
  Conversas: MessagesSquare,
  Telegram: Send,
}

const COLUMNS: Record<string, string[]> = {
  Leads: ["Nome", "Canal", "Temperatura", "Estado"],
  Conversas: ["Contacto", "Canal", "Estado", "Última"],
  Telegram: ["Bot", "Estado", "Canal", "Última"],
}

export function SoonPage({ title, hint }: { title: string; hint: string }) {
  const Icon = ICONS[title] ?? Users
  const columns = COLUMNS[title] ?? COLUMNS.Leads

  return (
    <div className="h-full overflow-y-auto">
      <div className="page-shell">
        <PageChrome icon={Icon} title={title}>
          <FilterChip active>Últimos 30 dias</FilterChip>
          <FilterChip>Todos os canais</FilterChip>
        </PageChrome>

        <section className="surface overflow-hidden">
          <div className="flex flex-wrap items-center gap-4 border-b border-border px-5 py-3 text-[13px]">
            <button type="button" className="border-b-2 border-foreground pb-2 font-medium">
              Todos <span className="ml-1 text-muted-foreground">0</span>
            </button>
            <span className="pb-2 text-muted-foreground">WhatsApp 0</span>
            <span className="pb-2 text-muted-foreground">Telegram 0</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 px-5 py-3 text-[13px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="size-3.5" />
              Todas as vistas
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Search className="size-3.5" />
              Procurar
            </span>
          </div>
          <div className="hidden grid-cols-4 gap-3 border-y border-border px-5 py-2.5 text-[12px] text-muted-foreground md:grid">
            {columns.map((column) => (
              <p key={column}>{column}</p>
            ))}
          </div>
          <div className="grid place-items-center px-6 py-16 text-center">
            <StatusPill>Em preparação</StatusPill>
            <p className="mt-3 text-[14px] font-medium">Nenhum registo ainda</p>
            <p className="mt-1 max-w-md text-[13px] leading-relaxed text-muted-foreground">{hint}</p>
          </div>
        </section>
      </div>
    </div>
  )
}
