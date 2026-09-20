import { cn } from "@/lib/utils"

export function HydratePanel({
  children,
  className,
}: {
  children: string
  className?: string
}) {
  return (
    <div className={cn("grid place-items-center px-6 py-16 text-center", className)} role="status" aria-live="polite">
      <p className="text-[14px] text-muted-foreground">{children}</p>
    </div>
  )
}
