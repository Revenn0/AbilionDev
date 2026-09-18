import { useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { AUTH_FIELD, AUTH_HINT, AUTH_LABEL, AUTH_LINK, AUTH_SUBMIT, AuthBrand, AuthSplit } from "@/components/brand/auth-split"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { resetPasswordRequest } from "@/lib/auth-api"

export function ResetPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get("token") || ""
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) {
      setError("A senha precisa de 6+ caracteres.")
      return
    }
    setError("")
    setLoading(true)
    try {
      await resetPasswordRequest(token, password)
      navigate("/login", { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível redefinir a senha.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthSplit>
      <Card className="rounded-[12px] shadow-sm">
        <CardHeader className="pb-0">
          <AuthBrand title="Nova senha" />
          <p className={`mt-2 text-center ${AUTH_HINT}`}>Define a senha desta conta.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password" className={AUTH_LABEL}>
                Senha
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className={AUTH_FIELD}
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button type="submit" disabled={loading || !token} className={AUTH_SUBMIT}>
              {loading ? "A gravar…" : "Guardar senha"}
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
