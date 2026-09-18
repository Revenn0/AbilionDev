import { LogoMark } from "@/components/brand/logo"
import { ThemeToggle } from "@/components/theme/toggle"
import { cn } from "@/lib/utils"

export const AUTH_FIELD =
  "h-10 rounded-[8px] border border-input bg-muted px-3 text-[14px] text-foreground shadow-none placeholder:text-muted-foreground"
export const AUTH_LABEL = "text-xs font-medium text-foreground"
export const AUTH_HINT = "text-[13px] leading-relaxed text-muted-foreground"
export const AUTH_SUBMIT = "h-10 w-full rounded-[8px] text-[14px] font-medium"
export const AUTH_LINK = "text-muted-foreground hover:text-foreground"

export function AuthSplit({
  children,
  visual,
}: {
  children: React.ReactNode
  visual?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "relative min-h-screen text-foreground",
        visual && "lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]"
      )}
    >
      {visual ? <div className="relative hidden min-h-screen lg:block">{visual}</div> : null}
      <div className="relative flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
        <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
          <ThemeToggle expanded className="border border-border bg-card text-foreground hover:bg-accent" />
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  )
}

export function AuthBrand({ title }: { title: string }) {
  return (
    <div className="text-center">
      <LogoMark className="mx-auto size-10" />
      <h1 className="mt-4 text-xl font-semibold tracking-tight">{title}</h1>
    </div>
  )
}
