import { useRef, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { Eye, EyeOff } from "lucide-react"
import { AUTH_FIELD, AUTH_HINT, AUTH_LABEL, AUTH_LINK, AUTH_SUBMIT, AuthBrand, AuthSplit } from "@/components/brand/auth-split"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { resetPasswordRequest } from "@/lib/auth-api"
import { withSafeNext } from "@/lib/safe-path"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export function ResetPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get("token") || ""
  const [password, setPassword] = useState("")
  const [show, setShow] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const lock = useRef(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (lock.current) return
    if (password.length < 6) {
      setError("A senha precisa de 6+ caracteres.")
      return
    }
    setError("")
    lock.current = true
    setLoading(true)
    try {
      await resetPasswordRequest(token, password)
      toast.success("Senha actualizada. Entra com a nova senha.")
      navigate(withSafeNext("/login", params.get("next")), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível redefinir a senha.")
    } finally {
      lock.current = false
      setLoading(false)
    }
  }

  return (
    <AuthSplit>
      <Card className="rounded-[12px] shadow-sm">
        <CardHeader className="pb-0">
          <AuthBrand title="Nova senha" />
          <p className={`mt-2 text-center ${AUTH_HINT}`}>
            {token ? "Define a senha desta conta." : "Este link está incompleto. Pede um novo em Esqueceu a senha."}
          </p>
        </CardHeader>
        <CardContent>
          {!token ? (
            <p className="text-center text-[13px]">
              <Link to={withSafeNext("/forgot", params.get("next"))} className={AUTH_LINK}>
                Gerar outro link
              </Link>
            </p>
          ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password" className={AUTH_LABEL}>
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className={cn(AUTH_FIELD, "pr-10")}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "reset-error" : undefined}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? "Ocultar senha" : "Mostrar senha"}
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            {error && (
              <p id="reset-error" role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={loading || !token} className={AUTH_SUBMIT}>
              {loading ? "A gravar…" : "Guardar senha"}
            </Button>
            <p className="text-center text-[13px]">
              <Link to={withSafeNext("/login", params.get("next"))} className={AUTH_LINK}>
                Voltar ao login
              </Link>
            </p>
          </form>
          )}
        </CardContent>
      </Card>
    </AuthSplit>
  )
}
