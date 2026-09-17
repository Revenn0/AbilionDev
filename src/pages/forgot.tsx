import { useState } from "react"
import { Link } from "react-router-dom"
import { AUTH_FIELD, AUTH_HINT, AUTH_LABEL, AUTH_LINK, AUTH_SUBMIT, AuthLegal, AuthSplit } from "@/components/brand/auth-split"
import { Button } from "@/components/ui/button"
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
    setDone("Se o e-mail existir, enviámos o link de redefinição.")
  }

  return (
    <AuthSplit>
      <div className="mt-10">
        <h1 className="text-[28px] font-semibold tracking-[-0.03em]">Redefinir senha</h1>
        <p className={`mt-2 ${AUTH_HINT}`}>Enviamos o link se o e-mail estiver cadastrado.</p>
      </div>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" className={AUTH_LABEL}>
            E-mail
          </Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={AUTH_FIELD} />
        </div>
        {error && <p className="text-[13px] text-red-400">{error}</p>}
        {done && <p className="text-[13px] text-emerald-400">{done}</p>}
        <Button type="submit" className={AUTH_SUBMIT}>
          Continuar
        </Button>
        <p className="text-[13px]">
          <Link to="/login" className={AUTH_LINK}>
            Voltar ao login
          </Link>
        </p>
        <AuthLegal />
      </form>
    </AuthSplit>
  )
}
