import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "@/components/theme/provider"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ThemeToggle({
  expanded = false,
  className,
}: {
  expanded?: boolean
  className?: string
}) {
  const { resolvedTheme, setTheme } = useTheme()
  const [ready, setReady] = useState(false)
  useEffect(() => {
    setReady(true)
  }, [])

  const dark = ready && resolvedTheme === "dark"
  const label = dark ? "Tema claro" : "Tema escuro"

  return (
    <Button
      type="button"
      variant="ghost"
      size={expanded ? "sm" : "icon-xs"}
      aria-label={label}
      aria-pressed={dark}
      title={label}
      disabled={!ready}
      onClick={() => setTheme(dark ? "light" : "dark")}
      className={cn("text-muted-foreground", expanded && "gap-1.5 px-2", className)}
    >
      {dark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
      {expanded && <span className="text-[12px]">{dark ? "Claro" : "Escuro"}</span>}
    </Button>
  )
}
