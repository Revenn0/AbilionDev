import { useEffect, useRef, useState } from "react"
import { useLocation } from "react-router-dom"
import { Menu, X } from "lucide-react"
import { Sidebar } from "./sidebar"
import { Button } from "@/components/ui/button"
import { SyncBanner } from "./sync-banner"
import { useStore } from "@/lib/store"
import { withSafeNext } from "@/lib/safe-path"
import { LogoWord } from "@/components/brand/logo"
import { ThemeToggle } from "@/components/theme/toggle"
import { cn } from "@/lib/utils"

function isCanvasEditor(pathname: string) {
  return /^\/fluxo\/funil\/[^/]+$/.test(pathname)
}

function pageTitle(pathname: string) {
  if (pathname.startsWith("/analytics")) return "Analytics"
  if (pathname.startsWith("/fluxo")) return "Funil"
  if (pathname.startsWith("/leads")) return "Leads"
  if (pathname.startsWith("/conversas")) return "Conversas"
  if (pathname.startsWith("/telegram")) return "Telegram"
  if (pathname.startsWith("/utilizadores")) return "Utilizadores"
  if (pathname.startsWith("/configuracoes")) return "Configurações"
  if (pathname.startsWith("/conta")) return "Conta"
  return "Dashboard"
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { ready, sessionSync, state } = useStore()
  const location = useLocation()
  const pathname = location.pathname
  const loginNext = withSafeNext("/login", `${pathname}${location.search}`)
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const canvasEditor = isCanvasEditor(pathname)
  const menu = useRef<HTMLDivElement>(null)
  const menuTrigger = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const stored = window.localStorage.getItem("abilion.sidebar")
    if (stored === "0") setExpanded(false)
    if (stored === "1") setExpanded(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const root = menu.current
    const focusables = () =>
      [...(root?.querySelectorAll<HTMLElement>("a, button, [href], [tabindex]:not([tabindex='-1'])") ?? [])].filter(
        (el) => !el.hasAttribute("disabled")
      )
    focusables()[0]?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
        menuTrigger.current?.focus()
        return
      }
      if (event.key !== "Tab" || !root) return
      const items = focusables()
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  const toggleSidebar = () => {
    setExpanded((value) => {
      const next = !value
      window.localStorage.setItem("abilion.sidebar", next ? "1" : "0")
      return next
    })
  }

  useEffect(() => {
    if (!ready || state.user) return
    window.location.replace(loginNext)
  }, [ready, state.user, loginNext])

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-background" role="status" aria-live="polite">
        <p className="text-[13px] text-muted-foreground">A carregar…</p>
      </div>
    )
  }
  if (!state.user) {
    return (
      <div className="grid min-h-screen place-items-center bg-background" role="status" aria-live="polite">
        <p className="text-[13px] text-muted-foreground">A ir para o login…</p>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {!canvasEditor && (
        <div className="relative z-20 hidden h-full md:block">
          <Sidebar expanded={expanded} onToggle={toggleSidebar} />
        </div>
      )}
      {!canvasEditor && (
        <div className={cn("fixed inset-0 z-50 md:hidden", open ? "pointer-events-auto" : "pointer-events-none")}>
          <button
            type="button"
            tabIndex={open ? 0 : -1}
            aria-label="Fechar menu"
            className={cn(
              "absolute inset-0 bg-slate-900/25 transition-opacity duration-300 motion-reduce:transition-none",
              open ? "opacity-100" : "opacity-0"
            )}
            onClick={() => setOpen(false)}
          />
          <div
            ref={menu}
            role={open ? "dialog" : undefined}
            aria-modal={open ? true : undefined}
            aria-hidden={open ? undefined : true}
            inert={!open}
            aria-label="Menu"
            className={cn(
              "relative h-full w-[240px] border-r border-border bg-sidebar transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
              open ? "translate-x-0" : "-translate-x-[110%]"
            )}
          >
            <Sidebar expanded onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        {!canvasEditor && (
          <header className="flex items-center gap-2 border-b border-border bg-card px-3 py-2 md:hidden">
            <Button ref={menuTrigger} variant="ghost" size="icon-sm" className="rounded-full" aria-label={open ? "Fechar menu" : "Abrir menu"} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
              {open ? <X /> : <Menu />}
            </Button>
            <LogoWord compact />
            <p className="min-w-0 flex-1 truncate text-[14px] font-medium">{pageTitle(pathname)}</p>
            <ThemeToggle />
          </header>
        )}
        <main id="conteudo" tabIndex={-1} className="min-h-0 flex-1 overflow-hidden" aria-label={pageTitle(pathname)}>
          {sessionSync === "error" ? (
            <div className="px-3 pt-3 md:px-6" data-session-error>
              <SyncBanner
                items={[
                  {
                    ok: false,
                    message: "Não confirmei a sessão no Worker. O painel local pode estar desactualizado.",
                  },
                ]}
              />
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  )
}
