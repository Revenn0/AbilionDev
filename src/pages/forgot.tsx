import { useState } from "react"
import { Link } from "react-router-dom"
import { AUTH_FIELD, AUTH_HINT, AUTH_LABEL, AUTH_LINK, AUTH_SUBMIT, AuthBrand, AuthSplit } from "@/components/brand/auth-split"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ForgotPage() {
  const [email, setEmail] = useState("")
  const [done, setDone] = useState("")
  const [error, setError] = useState("")

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      setError("Informe o e-mail.")
      return
    }
    setError("")
    setDone("Se o e-mail existir, enviamos o link de redefinição.")
  }

  return (
    <AuthSplit>
      <Card className="rounded-[12px] shadow-sm">
        <CardHeader className="pb-0">
          <AuthBrand title="Redefinir senha" />
          <p className={`mt-2 text-center ${AUTH_HINT}`}>Informe o e-mail da conta.</p>
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
            {error && <p className="text-xs text-destructive">{error}</p>}
            {done && <p className="text-xs text-emerald-600 dark:text-emerald-400">{done}</p>}
            <Button type="submit" className={AUTH_SUBMIT}>
              Continuar
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
