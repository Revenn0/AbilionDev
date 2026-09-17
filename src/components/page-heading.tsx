import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function PageHeading({
  title,
  hint,
  children,
  className,
}: {
  title: string
  hint?: string
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        {hint ? <p className="page-hint">{hint}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  )
}
