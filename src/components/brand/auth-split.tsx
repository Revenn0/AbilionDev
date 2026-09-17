import { Link } from "react-router-dom"
import { LogoMark, LogoSwoosh } from "@/components/brand/logo"
import { ThemeToggle } from "@/components/theme/toggle"

export const AUTH_FIELD =
  "h-11 rounded-full border border-border bg-muted px-3.5 text-[14px] text-foreground placeholder:text-muted-foreground"
export const AUTH_LABEL = "text-[12.5px] font-medium text-foreground"
export const AUTH_HINT = "text-[13.5px] leading-relaxed text-muted-foreground"
export const AUTH_SUBMIT = "h-11 w-full rounded-full text-[14px] font-medium"
export const AUTH_LINK = "text-muted-foreground hover:text-foreground"

export function AuthSplit({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
        <ThemeToggle expanded className="border border-border bg-card text-foreground hover:bg-accent" />
      </div>
      <div className="mx-auto grid min-h-screen lg:grid-cols-[minmax(0,480px)_1fr]">
        <section className="flex flex-col justify-center px-6 py-14 sm:px-12 lg:px-16">
          <div className="mx-auto w-full max-w-[400px]">
            <LogoSwoosh className="size-8 text-foreground" />
            {children}
          </div>
        </section>
        <aside className="relative hidden overflow-hidden bg-card lg:flex lg:flex-col lg:justify-between lg:px-16 lg:py-16">
          <LogoMark className="size-9" />
          <div className="max-w-[420px]">
            <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Operações</p>
            <h2 className="mt-3 text-[34px] font-semibold leading-[1.15] tracking-[-0.03em]">
              Captura no CRM, Sté no 1:1, Ester na banca.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
              Anúncio, land, grupo e atendimento — WhatsApp e Telegram sem misturar.
            </p>
          </div>
          <p className="text-[12px] text-muted-foreground">Abilion · CRM</p>
        </aside>
      </div>
    </div>
  )
}

export function AuthLegal() {
  return (
    <p className="text-[11.5px] leading-relaxed text-muted-foreground">
      Ao entrar, aceita a{" "}
      <Link to="/privacidade" className="text-foreground underline-offset-2 hover:underline">
        política de privacidade
      </Link>
      .
    </p>
  )
}
