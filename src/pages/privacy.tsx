import { Link } from "react-router-dom"
import { LogoWord } from "@/components/brand/logo"

export function PrivacyPage() {
  return (
    <main id="conteudo" tabIndex={-1} className="min-h-screen bg-background">
      <div className="page-shell max-w-2xl">
        <LogoWord />
        <h1 className="page-title mt-8">Política de privacidade</h1>
        <p className="page-hint">
          O Abilion é um CRM interno. Não há cadastro público. Só os operadores{" "}
          <span className="text-foreground">victor@abilion.com</span> e{" "}
          <span className="text-foreground">gabriel@abilion.com</span> entram.
        </p>

        <section className="mt-8 space-y-3 text-[14px] leading-relaxed text-muted-foreground">
          <h2 className="text-[15px] font-medium text-foreground">O que guardamos</h2>
          <p>
            Funis, leads, mensagens da Sté, eventos do pixel e o estado do bot. A sessão fica num cookie HttpOnly{" "}
            <code className="text-foreground">abilion_session</code> (SameSite=Lax; Secure em HTTPS). O browser não
            guarda o token do Telegram nem chaves de IA.
          </p>
          <h2 className="text-[15px] font-medium text-foreground">Onde corre</h2>
          <p>
            Cloudflare Worker + KV <code className="text-foreground">abilion-auth</code>. Se existir service role, o
            Worker também escreve no Supabase do projecto Abilion. Sem isso a operação continua só no KV. O frontend
            nunca fala com o Supabase.
          </p>
          <h2 className="text-[15px] font-medium text-foreground">Pixel e geo</h2>
          <p>
            A landing <code className="text-foreground">/l</code> e o script{" "}
            <code className="text-foreground">/t.js</code> gravam visita, clique e visitor id. A UF junta Cloudflare{" "}
            <code className="text-foreground">request.cf</code> com fallback público (ipwho.is e geojs.io). Não
            vendemos estes dados e não usamos cookies de anúncio de terceiros nesta página.
          </p>
          <h2 className="text-[15px] font-medium text-foreground">Integrações</h2>
          <p>
            Telegram (bot e webhook), OpenCode e OpenRouter (papo livre depois da oferta) e ElevenLabs (clips de voz)
            só entram quando um operador cola a chave em Configurações. Sem chave, a Sté fica no script do quadro, em
            texto.
          </p>
          <h2 className="text-[15px] font-medium text-foreground">Retenção e acesso</h2>
          <p>
            Os dois operadores vêem o mesmo workspace. Não há contas de cliente. “Esqueceu a senha?” em produção não
            envia e-mail — a troca é em Configurações → Conta. Pedidos sobre estes dados: os mesmos e-mails de
            operador.
          </p>
        </section>

        <Link to="/login" className="mt-8 inline-flex text-sm text-primary underline-offset-2 hover:underline">
          Voltar ao login
        </Link>
      </div>
    </main>
  )
}
