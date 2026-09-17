import { Link } from "react-router-dom"
import { LogoWord } from "@/components/brand/logo"

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="page-shell max-w-2xl">
        <LogoWord />
        <h1 className="page-title mt-8">Política de privacidade</h1>
        <p className="page-hint">
          O Abilion guarda sessão e funis localmente neste recorte. Em produção, os dados ficam no projeto Supabase do workspace.
        </p>
        <Link to="/login" className="mt-6 inline-flex text-sm text-primary">
          Voltar ao login
        </Link>
      </div>
    </div>
  )
}
