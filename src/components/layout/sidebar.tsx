import type { ComponentType } from "react"
import { Link, useLocation } from "react-router-dom"
import { ChartNoAxesCombined, LayoutDashboard, LogOut, MessagesSquare, PanelLeft, PanelLeftClose, Send, Settings, Users, Workflow } from "lucide-react"
import { ThemeToggle } from "@/components/theme/toggle"
import { LogoMark } from "@/components/brand/logo"
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
  { href: "/analytics", label: "Analytics", icon: ChartNoAxesCombined },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/conversas", label: "Conversas", icon: MessagesSquare },
  { href: "/fluxo", label: "Funil", icon: Workflow },
  { href: "/telegram", label: "Telegram", icon: Send },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
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
      title={label}
      aria-label={label}
      className={cn(
        "flex h-9 w-full items-center rounded-full px-2.5 text-[13px] font-medium",
        active
          ? "bg-sidebar-accent text-sidebar-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
      )}
    >
      <Icon className="size-4 shrink-0" strokeWidth={1.75} />
      <span
        className={cn(
          "min-w-0 truncate pl-2.5 transition-[opacity,max-width] duration-200 ease-out motion-reduce:transition-none",
          expanded ? "max-w-[160px] opacity-100" : "max-w-0 overflow-hidden pl-0 opacity-0"
        )}
      >
        {label}
      </span>
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
    <div
      className={cn(
        "relative z-20 h-full shrink-0",
        "transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        expanded ? "w-[236px]" : "w-[76px]"
      )}
    >
      <aside className="flex h-full w-full flex-col overflow-hidden rounded-[28px] bg-sidebar">
        <div className="flex h-14 shrink-0 items-center gap-2.5 px-3">
          <LogoMark className="size-5 shrink-0" />
          <p
            className={cn(
              "truncate text-[13.5px] font-medium tracking-[-0.02em] text-foreground transition-[opacity,max-width] duration-200 ease-out motion-reduce:transition-none",
              expanded ? "max-w-[120px] opacity-100" : "max-w-0 overflow-hidden opacity-0"
            )}
          >
            Abilion
          </p>
          {onToggle && (
            <button
              type="button"
              onClick={onToggle}
              aria-label={expanded ? "Recolher menu" : "Expandir menu"}
              title={expanded ? "Recolher menu" : "Expandir menu"}
              className="ml-auto grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            >
              {expanded ? <PanelLeftClose className="size-3.5" strokeWidth={1.7} /> : <PanelLeft className="size-3.5" strokeWidth={1.7} />}
            </button>
          )}
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-2.5 pt-1">
          {NAV.map((item) => (
            <NavLink key={item.href} {...item} expanded={expanded} onNavigate={onNavigate} />
          ))}
        </nav>

        <div className="p-2.5">
          {state.user && (
            <div className="mb-1 flex min-w-0 items-center gap-2.5 overflow-hidden rounded-full px-1.5 py-1.5" title={state.user.email}>
              <div className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                {initials(state.user.name)}
              </div>
              <div
                className={cn(
                  "min-w-0 transition-[opacity,max-width] duration-200 ease-out motion-reduce:transition-none",
                  expanded ? "max-w-[140px] opacity-100" : "max-w-0 overflow-hidden opacity-0"
                )}
              >
                <p className="truncate text-[12.5px] font-medium">{state.user.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{state.user.email}</p>
              </div>
            </div>
          )}
          <div className={cn("flex items-center", expanded ? "justify-between px-1" : "flex-col gap-1")}>
            <ThemeToggle expanded={expanded} />
            <Button
              variant="ghost"
              size={expanded ? "sm" : "icon-xs"}
              aria-label="Sair"
              title="Sair"
              onClick={() => void logout()}
              className={cn("rounded-full text-muted-foreground", expanded && "gap-1.5 px-2")}
            >
              <LogOut className="size-3.5" />
              {expanded && <span className="text-[12px]">Sair</span>}
            </Button>
          </div>
        </div>
      </aside>
    </div>
  )
}
