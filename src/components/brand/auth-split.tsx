import { Link } from "react-router-dom"
import { LogoStack, LogoSwoosh } from "@/components/brand/logo"
import { ThemeToggle } from "@/components/theme/toggle"

export const AUTH_FIELD =
  "h-12 rounded-full border-border bg-muted/70 px-4 text-[15px] text-foreground placeholder:text-muted-foreground"
export const AUTH_LABEL = "text-muted-foreground"
export const AUTH_HINT = "text-[14px] leading-relaxed text-muted-foreground"
export const AUTH_SUBMIT = "h-12 w-full rounded-full text-[15px] font-semibold"
export const AUTH_LINK = "text-muted-foreground hover:text-foreground"

export function AuthSplit({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
        <ThemeToggle expanded className="border border-border bg-card text-foreground shadow-sm hover:bg-accent" />
      </div>
      <div className="mx-auto grid min-h-screen max-w-[1240px] lg:grid-cols-2">
        <section className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
          <div className="mx-auto w-full max-w-[380px]">
            <LogoSwoosh className="mx-auto size-10 text-foreground" />
            {children}
          </div>
        </section>
        <aside className="relative hidden overflow-hidden lg:flex lg:flex-col lg:items-center lg:justify-center">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,var(--muted)_0%,var(--background)_62%)]" />
          <div className="relative flex w-full max-w-[420px] flex-col items-center px-10 text-center">
            <LogoStack />
            <h2 className="mt-2 text-[28px] font-semibold tracking-tight">Abilion CRM</h2>
          </div>
        </aside>
      </div>
    </div>
  )
}

export function AuthLegal() {
  return (
    <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
      Ao entrar, aceita a{" "}
      <Link to="/privacidade" className="text-foreground underline-offset-2 hover:underline">
        política de privacidade
      </Link>
      .
    </p>
  )
}
