import type { ComponentType, ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export function PageChrome({
  icon: Icon,
  title,
  children,
}: {
  icon?: ComponentType<{ className?: string; strokeWidth?: number }>
  title: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon && <Icon className="size-4 text-muted-foreground" strokeWidth={1.75} />}
        <h1 className="truncate text-[17px] font-medium tracking-[-0.02em]">{title}</h1>
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  )
}

export function FilterChip({
  children,
  active,
  onClick,
}: {
  children: ReactNode
  active?: boolean
  onClick?: () => void
}) {
  const className = cn(
    "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px]",
    active ? "border-border bg-card text-foreground shadow-sm" : "border-transparent bg-muted text-muted-foreground",
    onClick && "cursor-pointer hover:text-foreground"
  )
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {children}
      </button>
    )
  }
  return (
    <span className={className}>
      {children}
      <ChevronDown className="size-3 opacity-50" />
    </span>
  )
}

export function StatusPill({
  tone = "muted",
  children,
}: {
  tone?: "success" | "warn" | "danger" | "muted"
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full border border-transparent px-2.5 text-[11.5px] font-medium",
        tone === "success" && "bg-success/15 text-success",
        tone === "warn" && "bg-chart-4/15 text-chart-4",
        tone === "danger" && "bg-destructive/15 text-destructive",
        tone === "muted" && "border border-border bg-card text-muted-foreground"
      )}
    >
      {children}
    </span>
  )
}
