import { Link } from "react-router-dom"
import { LogoWord } from "@/components/brand/logo"

export function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="page-shell max-w-2xl">
        <LogoWord />
        <h1 className="page-title mt-8">Política de privacidade</h1>
        <p className="page-hint">
          O Abilion é um CRM interno. A sessão fica num cookie HttpOnly. Funis, leads e o token do Telegram ficam no
          Worker (KV). O browser não guarda o token. Pixel e geo usam a origem da visita para UF e país. Sem service
          role do Supabase a operação continua só no Worker.
        </p>
        <Link to="/login" className="mt-6 inline-flex text-sm text-primary">
          Voltar ao login
        </Link>
      </div>
    </main>
  )
}
