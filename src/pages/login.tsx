import { useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { AUTH_FIELD, AUTH_LABEL, AUTH_LINK, AUTH_SUBMIT, AuthBrand, AuthSplit } from "@/components/brand/auth-split"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useStore } from "@/lib/store"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export function LoginPage() {
  const { login } = useStore()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail || password.length < 6) {
      setError("Informe um e-mail e uma senha com 6+ caracteres.")
      return
    }
    setLoading(true)
    try {
      login(cleanEmail, password)
      toast.success("Sessão iniciada.")
      const next = params.get("next") || "/"
      navigate(next.startsWith("/") ? next : "/", { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthSplit>
      <Card>
        <CardHeader className="pb-0">
          <AuthBrand title="Entrar" />
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
              />
            </div>
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
                  className={cn(AUTH_FIELD, "pr-10")}
                  autoComplete="current-password"
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
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button type="submit" disabled={loading} className={AUTH_SUBMIT}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : null}
              {loading ? "Entrando…" : "Entrar"}
            </Button>
            <p className="text-center text-[13px]">
              <Link to="/forgot" className={AUTH_LINK}>
                Esqueceu a senha?
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </AuthSplit>
  )
}
