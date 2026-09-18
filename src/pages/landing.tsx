import { useEffect } from "react"
import { adsDeepLink } from "@/lib/telegram-start"
import { useStore } from "@/lib/store"

const FALLBACK_BOT = "steaviator"

export function LandingPage() {
  const { state } = useStore()
  const username = state.settings.telegramBotUsername
  const href = adsDeepLink(username || FALLBACK_BOT, "fb") || `https://t.me/${FALLBACK_BOT}?start=fb`

  useEffect(() => {
    if (document.querySelector("script[data-abilion-pixel]")) return
    const script = document.createElement("script")
    script.src = "/t.js"
    script.async = true
    script.dataset.abilionPixel = "1"
    script.dataset.cta = "[data-abilion-cta]"
    document.head.appendChild(script)
  }, [])

  return (
    <div className="min-h-screen bg-[#0b0d12] text-zinc-100">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col px-5 py-8 sm:max-w-xl">
        <p className="text-[12px] font-medium tracking-[0.18em] text-sky-400 uppercase">Minicurso gratuito</p>
        <h1 className="mt-3 text-[34px] font-semibold leading-[1.05] tracking-[-0.04em] sm:text-[42px]">
          Sté, a Mãe do Aviator, te chama no Telegram.
        </h1>
        <p className="mt-4 text-[16px] leading-relaxed text-zinc-400">
          Entra, recebe as 3 mensagens de boas-vindas e o minicurso. O pixel desta página grava a visita, o clique e o
          estado — depois o /start fecha o mesmo visitante no CRM.
        </p>
        <ul className="mt-6 space-y-2 text-[14px] text-zinc-300">
          <li>Como parar de operar no escuro</li>
          <li>Cadastro Superbet com o bônus certo</li>
          <li>Grupo Premium só se fizer sentido</li>
        </ul>
        <a
          data-abilion-cta
          href={href}
          className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-sky-400 px-6 text-[15px] font-semibold text-sky-950"
        >
          Falar com a Sté no Telegram
        </a>
        <p className="mt-4 text-[12px] text-zinc-500">
          O botão vira <code className="text-zinc-300">t.me/...?start=fb_vid</code>. Sem cadastro nesta página.
        </p>
        <p className="mt-auto pt-16 text-[11px] text-zinc-600">Abilion · landing de teste do pixel</p>
      </div>
    </div>
  )
}
