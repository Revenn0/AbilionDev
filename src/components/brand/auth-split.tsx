import { LogoMark } from "@/components/brand/logo"
import { ThemeToggle } from "@/components/theme/toggle"

export const AUTH_FIELD =
  "h-10 rounded-lg border border-input bg-background px-3 text-[14px] text-foreground placeholder:text-muted-foreground"
export const AUTH_LABEL = "text-xs font-medium text-foreground"
export const AUTH_HINT = "text-[13px] leading-relaxed text-muted-foreground"
export const AUTH_SUBMIT = "h-10 w-full rounded-lg text-[14px] font-medium"
export const AUTH_LINK = "text-muted-foreground hover:text-foreground"

export function AuthSplit({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12 text-foreground">
      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
        <ThemeToggle expanded className="border border-border bg-card text-foreground hover:bg-accent" />
      </div>
      <div className="w-full max-w-sm">{children}</div>
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
