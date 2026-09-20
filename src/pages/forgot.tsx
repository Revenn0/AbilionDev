import { useRef, useState } from "react"
import { Link } from "react-router-dom"
import { AUTH_FIELD, AUTH_HINT, AUTH_LABEL, AUTH_LINK, AUTH_SUBMIT, AuthBrand, AuthSplit } from "@/components/brand/auth-split"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { forgotPasswordRequest } from "@/lib/auth-api"

export function ForgotPage() {
  const [email, setEmail] = useState("")
  const [done, setDone] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const lock = useRef(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (lock.current) return
    if (!email.trim()) {
      setError("Informe o e-mail.")
      return
    }
    setError("")
    lock.current = true
    setLoading(true)
    try {
      const data = await forgotPasswordRequest(email.trim().toLowerCase())
      setDone(
        data.resetPath
          ? `Link gerado: ${data.resetPath}`
          : "Em produção não enviamos e-mail. Entra e troca a senha em Configurações → Conta."
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível gerar o link.")
    } finally {
      lock.current = false
      setLoading(false)
    }
  }

  return (
    <AuthSplit>
      <Card className="rounded-[12px] shadow-sm">
        <CardHeader className="pb-0">
          <AuthBrand title="Redefinir senha" />
          <p className={`mt-2 text-center ${AUTH_HINT}`}>
            Localmente gera um link. Em produção não há e-mail — troca a senha em Configurações → Conta.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className={AUTH_LABEL}>
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="nome@empresa.com"
                className={AUTH_FIELD}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "forgot-error" : done ? "forgot-done" : undefined}
              />
            </div>
            {error && (
              <p id="forgot-error" role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
            {done && (
              <p id="forgot-done" role="status" className="text-xs text-emerald-600 dark:text-emerald-400">
                {done}
              </p>
            )}
            <Button type="submit" disabled={loading} className={AUTH_SUBMIT}>
              {loading ? "A enviar…" : "Continuar"}
            </Button>
            <p className="text-center text-[13px]">
              <Link to="/login" className={AUTH_LINK}>
                Voltar ao login
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </AuthSplit>
  )
}
