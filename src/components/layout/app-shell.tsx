import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Menu, X } from "lucide-react"
import { Sidebar } from "./sidebar"
import { Button } from "@/components/ui/button"
import { useStore } from "@/lib/store"
import { LogoWord } from "@/components/brand/logo"
import { ThemeToggle } from "@/components/theme/toggle"

function isCanvasEditor(pathname: string) {
  return /^\/fluxo\/funil\/[^/]+$/.test(pathname)
}

function pageTitle(pathname: string) {
  if (pathname.startsWith("/fluxo")) return "Funil"
  if (pathname.startsWith("/leads")) return "Leads"
  if (pathname.startsWith("/conversas")) return "Conversas"
  if (pathname.startsWith("/telegram")) return "Telegram"
  return "Dashboard"
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { ready, state } = useStore()
  const navigate = useNavigate()
  const pathname = useLocation().pathname
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const canvasEditor = isCanvasEditor(pathname)

  useEffect(() => {
    const stored = window.localStorage.getItem("abilion.sidebar")
    if (stored === "0") setExpanded(false)
    if (stored === "1") setExpanded(true)
  }, [])

  const toggleSidebar = () => {
    setExpanded((value) => {
      const next = !value
      window.localStorage.setItem("abilion.sidebar", next ? "1" : "0")
      return next
    })
  }

  useEffect(() => {
    if (!ready) return
    if (!state.user) navigate("/login", { replace: true })
  }, [ready, state.user, navigate])

  if (!ready || !state.user) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <LogoWord />
          <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {!canvasEditor && (
        <div className="hidden h-full md:block">
          <Sidebar expanded={expanded} onToggle={toggleSidebar} />
        </div>
      )}
      {open && !canvasEditor && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-foreground/25 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative h-full w-[240px] shadow-xl">
            <Sidebar expanded onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        {!canvasEditor && (
          <header className="flex items-center gap-2 border-b border-border bg-background px-3 py-2 md:hidden">
            <Button variant="ghost" size="icon-sm" aria-label="Menu" onClick={() => setOpen((v) => !v)}>
              {open ? <X /> : <Menu />}
            </Button>
            <LogoWord compact />
            <p className="min-w-0 flex-1 truncate text-[14px] font-medium">{pageTitle(pathname)}</p>
            <ThemeToggle />
          </header>
        )}
        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  )
}
