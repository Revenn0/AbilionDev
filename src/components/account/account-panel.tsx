import { useRef, useState } from "react"
import { Link } from "react-router-dom"
import { Eye, EyeOff, KeyRound, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { changeEmailRequest, changePasswordRequest } from "@/lib/auth-api"
import { useStore } from "@/lib/store"
import { toast } from "sonner"

function emailLooksValid(value: string) {
  const email = value.trim().toLowerCase()
  return email.length >= 6 && email.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function AccountPanel() {
  const { state, noteUser } = useStore()
  const [email, setEmail] = useState("")
  const [emailPassword, setEmailPassword] = useState("")
  const [showEmailPassword, setShowEmailPassword] = useState(false)
  const [emailBusy, setEmailBusy] = useState(false)
  const [emailError, setEmailError] = useState("")
  const emailLock = useRef(false)

  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordError, setPasswordError] = useState("")
  const passwordLock = useRef(false)

  return (
    <div className="max-w-3xl space-y-4">
      <section className="surface p-6">
        <p className="text-[14px] font-medium">Conta do operador</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
          O e-mail é o que usas para entrar. A senha actual confirma a troca do e-mail e da senha. Em produção o “Esqueceu a
          senha?” não envia mensagem — a troca fica aqui. Contas novas e o token do agente ficam em{" "}
          <Link to="/utilizadores" className="underline underline-offset-3">
            Utilizadores
          </Link>
          . O URL do MCP está em{" "}
          <Link to="/configuracoes?tab=mcp" className="underline underline-offset-3">
            MCP
          </Link>
          .
        </p>
        <dl className="mt-4 space-y-2 text-[12.5px]">
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted-foreground">Operador</dt>
            <dd className="font-medium">{state.user?.name}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted-foreground">E-mail</dt>
            <dd className="font-medium">{state.user?.email}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted-foreground">Papel</dt>
            <dd className="font-medium">{state.user?.role === "operator" ? "Operador" : "Dono"}</dd>
          </div>
        </dl>
      </section>

      <section className="surface p-6">
        <p className="text-[14px] font-medium">E-mail</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
          O próximo login usa o e-mail novo. A sessão actual continua aberta.
        </p>
        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (emailLock.current || emailBusy) return
            const nextEmail = email.trim().toLowerCase()
            if (!emailLooksValid(nextEmail)) {
              setEmailError("Informa um e-mail válido.")
              return
            }
            if (nextEmail === state.user?.email) {
              setEmailError("Este já é o teu e-mail.")
              return
            }
            if (!emailPassword.trim()) {
              setEmailError("Informa a senha actual.")
              return
            }
            setEmailError("")
            emailLock.current = true
            setEmailBusy(true)
            void changeEmailRequest(emailPassword, nextEmail)
              .then((data) => {
                if (data.user) noteUser(data.user)
                setEmail("")
                setEmailPassword("")
                toast.success("E-mail actualizado.")
              })
              .catch((err: Error) => {
                setEmailError(err.message)
                toast.error(err.message)
              })
              .finally(() => {
                emailLock.current = false
                setEmailBusy(false)
              })
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="account-email">Novo e-mail</Label>
            <Input
              id="account-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              aria-invalid={Boolean(emailError) && (emailError.includes("e-mail") || emailError.includes("válido"))}
              aria-describedby={emailError ? "account-email-error" : undefined}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="account-email-password">Senha actual</Label>
            <div className="relative">
              <Input
                id="account-email-password"
                type={showEmailPassword ? "text" : "password"}
                autoComplete="current-password"
                value={emailPassword}
                className="pr-10"
                aria-invalid={Boolean(emailError) && (emailError.includes("senha") || emailError.includes("Senha"))}
                aria-describedby={emailError ? "account-email-error" : undefined}
                onChange={(event) => setEmailPassword(event.target.value)}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowEmailPassword((value) => !value)}
                aria-label={showEmailPassword ? "Ocultar senha da troca de e-mail" : "Mostrar senha da troca de e-mail"}
              >
                {showEmailPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          {emailError ? (
            <p id="account-email-error" role="alert" className="text-[12px] text-destructive">
              {emailError}
            </p>
          ) : null}
          <Button id="account-email-submit" type="submit" className="rounded-full" disabled={emailBusy}>
            <Mail className="size-3.5" />
            {emailBusy ? "A gravar…" : "Guardar e-mail"}
          </Button>
        </form>
      </section>

      <section className="surface p-6">
        <p className="text-[14px] font-medium">Senha</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
          A senha nova precisa de 6 caracteres ou mais. As outras sessões desta conta fecham.
        </p>
        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (passwordLock.current || passwordBusy) return
            if (!current.trim()) {
              setPasswordError("Informa a senha actual.")
              return
            }
            if (next.length < 6) {
              setPasswordError("A nova senha precisa de 6+ caracteres.")
              return
            }
            setPasswordError("")
            passwordLock.current = true
            setPasswordBusy(true)
            void changePasswordRequest(current, next)
              .then(() => {
                setCurrent("")
                setNext("")
                toast.success("Senha actualizada.")
              })
              .catch((err: Error) => {
                setPasswordError(err.message)
                toast.error(err.message)
              })
              .finally(() => {
                passwordLock.current = false
                setPasswordBusy(false)
              })
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="current-password">Senha actual</Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrent ? "text" : "password"}
                autoComplete="current-password"
                value={current}
                className="pr-10"
                aria-invalid={Boolean(passwordError) && (passwordError.includes("actual") || passwordError.includes("inválida"))}
                aria-describedby={passwordError ? "password-error" : undefined}
                onChange={(event) => setCurrent(event.target.value)}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowCurrent((value) => !value)}
                aria-label={showCurrent ? "Ocultar senha actual" : "Mostrar senha actual"}
              >
                {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">Nova senha</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNext ? "text" : "password"}
                autoComplete="new-password"
                value={next}
                className="pr-10"
                aria-invalid={passwordError.includes("6+")}
                aria-describedby={passwordError ? "password-error" : undefined}
                onChange={(event) => setNext(event.target.value)}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowNext((value) => !value)}
                aria-label={showNext ? "Ocultar nova senha" : "Mostrar nova senha"}
              >
                {showNext ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          {passwordError ? (
            <p id="password-error" role="alert" className="text-[12px] text-destructive">
              {passwordError}
            </p>
          ) : null}
          <Button id="account-password-submit" type="submit" className="rounded-full" disabled={passwordBusy}>
            <KeyRound className="size-3.5" />
            {passwordBusy ? "A gravar…" : "Guardar senha"}
          </Button>
        </form>
      </section>
    </div>
  )
}
