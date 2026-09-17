import { useState, type ComponentType, type ReactNode } from "react"
import { Link, useLocation } from "react-router-dom"
import { Calendar, ChevronDown, LayoutDashboard, LogOut, MessagesSquare, PanelLeft, PanelLeftClose, Puzzle, Store, Users, Workflow } from "lucide-react"
import { ThemeToggle } from "@/components/theme/toggle"
import { InstagramGlyph } from "@/components/canvas/icons"
import { LogoMark, LogoWord } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useStore } from "@/lib/store"
import { initials } from "@/lib/format"

type NavItem = {
  href: string
  label: string
  icon: ComponentType<{ className?: string; strokeWidth?: number }>
  soon?: boolean
}

const OPS_NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/conversas", label: "Conversas", icon: MessagesSquare },
  { href: "/fluxo", label: "Fluxo", icon: Workflow },
]

const MORE_NAV: NavItem[] = [
  { href: "/agendamentos", label: "Agendamentos", icon: Calendar },
  { href: "/loja", label: "Loja", icon: Store },
  { href: "/telegram", label: "Telegram", icon: SendGlyph },
  { href: "/instagram", label: "Instagram", icon: InstagramGlyph, soon: true },
]

const FOOT_NAV: NavItem[] = [{ href: "/plugins", label: "Plugins", icon: Puzzle }]

function SendGlyph({ className, strokeWidth }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth ?? 1.75} aria-hidden>
      <path d="M22 2 11 13" />
      <path d="m22 2-7 20-4-9-9-4 20-7z" />
    </svg>
  )
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/"
  if (href === "/conversas") return pathname.startsWith("/conversas") || pathname.startsWith("/groups")
  return pathname.startsWith(href)
}

function NavLink({
  href,
  label,
  icon: Icon,
  expanded,
  soon,
  onNavigate,
}: NavItem & { expanded?: boolean; onNavigate?: () => void }) {
  const pathname = useLocation().pathname
  const active = isActive(pathname, href)
  return (
    <Link
      to={href}
      onClick={onNavigate}
      title={expanded ? undefined : soon ? `${label} (em breve)` : label}
      aria-label={soon ? `${label} em breve` : label}
      className={cn(
        "flex items-center rounded-full transition-colors",
        expanded ? "w-full gap-2.5 px-3 py-2 text-[13px]" : "size-10 justify-center",
        active
          ? "bg-sidebar-accent text-sidebar-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]"
          : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
      )}
    >
      <Icon className="size-4 shrink-0" strokeWidth={1.75} />
      {expanded && <span className="min-w-0 flex-1 truncate">{label}</span>}
      {expanded && soon && <span className="shrink-0 text-[9px] uppercase tracking-[0.08em] text-muted-foreground">em breve</span>}
    </Link>
  )
}

function Section({
  label,
  expanded,
  children,
}: {
  label: string
  expanded?: boolean
  children: ReactNode
}) {
  return (
    <div className={cn("flex flex-col gap-1", expanded ? "items-stretch" : "items-center")}>
      {expanded ? (
        <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">{label}</p>
      ) : (
        <div className="my-1 h-px w-6 bg-sidebar-border" />
      )}
      {children}
    </div>
  )
}

export function Sidebar({
  onNavigate,
  expanded = false,
  onToggle,
}: {
  onNavigate?: () => void
  expanded?: boolean
  onToggle?: () => void
}) {
  const { state, logout } = useStore()
  const pathname = useLocation().pathname
  const [moreOpen, setMoreOpen] = useState(false)
  const showMore = moreOpen || MORE_NAV.some((item) => isActive(pathname, item.href))

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200",
        expanded ? "w-[228px]" : "w-16"
      )}
    >
      <div className={cn("flex shrink-0", expanded ? "h-14 items-center gap-1 px-3" : "flex-col items-center gap-1 px-2 pt-3 pb-1")}>
        {expanded ? <LogoWord /> : <LogoMark className="size-7 shrink-0" />}
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={expanded ? "Recolher menu" : "Expandir menu"}
            title={expanded ? "Recolher menu" : "Expandir menu"}
            className={cn(
              "grid shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
              expanded ? "ml-auto size-8" : "size-7"
            )}
          >
            {expanded ? <PanelLeftClose className="size-4" strokeWidth={1.7} /> : <PanelLeft className="size-3.5" strokeWidth={1.7} />}
          </button>
        )}
      </div>

      <nav className={cn("flex flex-1 flex-col gap-1", expanded ? "items-stretch px-2.5" : "items-center px-2")}>
        <Section label="Principal" expanded={expanded}>
          {OPS_NAV.map((item) => (
            <NavLink key={item.href} {...item} expanded={expanded} onNavigate={onNavigate} />
          ))}
        </Section>
        <button
          type="button"
          onClick={() => setMoreOpen((value) => !value)}
          aria-expanded={showMore}
          aria-label={showMore ? "Fechar menu Mais" : "Abrir menu Mais"}
          className={cn(
            "flex items-center rounded-full text-muted-foreground transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
            expanded ? "w-full gap-2.5 px-3 py-2 text-[13px]" : "size-10 justify-center"
          )}
        >
          <ChevronDown className={cn("size-4 transition-transform", showMore && "rotate-180")} />
          {expanded && <span>Mais</span>}
        </button>
        {showMore && (
          <div className={cn("flex flex-col gap-1", expanded ? "pl-2" : "items-center")}>
            {MORE_NAV.map((item) => (
              <NavLink key={item.href} {...item} expanded={expanded} onNavigate={onNavigate} />
            ))}
          </div>
        )}
        <div className="flex-1" />
        {FOOT_NAV.map((item) => (
          <NavLink key={item.href} {...item} expanded={expanded} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className={cn("flex items-center gap-1.5 pb-3 pt-2", expanded ? "w-full px-2" : "flex-col px-2")}>
        {state.user && (
          <div className={cn("flex min-w-0 items-center", expanded && "flex-1 gap-2 rounded-xl px-1.5 py-1")} title={state.user.name}>
            <div className="relative">
              <div className="grid size-7 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                {initials(state.user.name)}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-success ring-2 ring-sidebar" />
            </div>
            {expanded && <p className="min-w-0 flex-1 truncate text-[12px] font-medium">{state.user.name.split(" ")[0]}</p>}
          </div>
        )}
        <ThemeToggle expanded={expanded} />
        <Button
          variant="ghost"
          size={expanded ? "sm" : "icon-xs"}
          aria-label="Sair"
          title="Sair"
          onClick={logout}
          className={cn("text-muted-foreground", expanded && "shrink-0 gap-1.5 px-2")}
        >
          <LogOut className="size-3.5" />
          {expanded && <span className="text-[12px]">Sair</span>}
        </Button>
      </div>
    </aside>
  )
}
