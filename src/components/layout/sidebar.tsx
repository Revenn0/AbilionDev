import type { ComponentType } from "react"
import { Link, useLocation } from "react-router-dom"
import { LayoutDashboard, LogOut, MessagesSquare, PanelLeft, PanelLeftClose, Send, Users, Workflow } from "lucide-react"
import { ThemeToggle } from "@/components/theme/toggle"
import { LogoMark, LogoWord } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useStore } from "@/lib/store"
import { initials } from "@/lib/format"

type NavItem = {
  href: string
  label: string
  icon: ComponentType<{ className?: string; strokeWidth?: number }>
}

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/conversas", label: "Conversas", icon: MessagesSquare },
  { href: "/fluxo", label: "Fluxo", icon: Workflow },
  { href: "/telegram", label: "Telegram", icon: Send },
]

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/"
  return pathname.startsWith(href)
}

function NavLink({
  href,
  label,
  icon: Icon,
  expanded,
  onNavigate,
}: NavItem & { expanded?: boolean; onNavigate?: () => void }) {
  const pathname = useLocation().pathname
  const active = isActive(pathname, href)
  return (
    <Link
      to={href}
      onClick={onNavigate}
      title={expanded ? undefined : label}
      aria-label={label}
      className={cn(
        "flex items-center rounded-lg text-[13px] font-medium",
        expanded ? "w-full gap-2.5 px-2.5 py-[7px]" : "size-9 justify-center",
        active
          ? "bg-sidebar-accent text-sidebar-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
      )}
    >
      <Icon className="size-4 shrink-0" strokeWidth={1.75} />
      {expanded && <span className="min-w-0 truncate">{label}</span>}
    </Link>
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

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-sidebar-border bg-sidebar",
        expanded ? "w-[232px]" : "w-[68px]"
      )}
    >
      <div className={cn("flex shrink-0", expanded ? "h-14 items-center gap-1 px-3" : "flex-col items-center gap-2 px-2 pt-3")}>
        {expanded ? <LogoWord /> : <LogoMark className="size-7 shrink-0" />}
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={expanded ? "Recolher menu" : "Expandir menu"}
            title={expanded ? "Recolher menu" : "Expandir menu"}
            className={cn(
              "grid shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
              expanded ? "ml-auto size-8" : "size-8"
            )}
          >
            {expanded ? <PanelLeftClose className="size-4" strokeWidth={1.7} /> : <PanelLeft className="size-4" strokeWidth={1.7} />}
          </button>
        )}
      </div>

      <nav className={cn("flex flex-1 flex-col gap-0.5 pt-2", expanded ? "px-2.5" : "items-center px-2")}>
        {NAV.map((item) => (
          <NavLink key={item.href} {...item} expanded={expanded} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className={cn("border-t border-sidebar-border", expanded ? "p-2.5" : "flex flex-col items-center gap-1.5 px-2 py-3")}>
        {state.user && (
          <div className={cn("flex min-w-0 items-center", expanded && "mb-2 gap-2.5 rounded-lg px-1.5 py-1")} title={state.user.email}>
            <div className="grid size-8 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {initials(state.user.name)}
            </div>
            {expanded && (
              <div className="min-w-0">
                <p className="truncate text-[12.5px] font-medium">{state.user.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{state.user.email}</p>
              </div>
            )}
          </div>
        )}
        <div className={cn("flex items-center", expanded ? "justify-between" : "flex-col gap-1")}>
          <ThemeToggle expanded={expanded} />
          <Button
            variant="ghost"
            size={expanded ? "sm" : "icon-xs"}
            aria-label="Sair"
            title="Sair"
            onClick={logout}
            className={cn("text-muted-foreground", expanded && "gap-1.5 px-2")}
          >
            <LogOut className="size-3.5" />
            {expanded && <span className="text-[12px]">Sair</span>}
          </Button>
        </div>
      </div>
    </aside>
  )
}
