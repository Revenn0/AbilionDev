import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { adsDeepLink } from "@/lib/telegram-start"
import { fetchHealth } from "@/lib/channel"
import {
  ADS_LANDING_UNLINKED_HINT,
  ADS_LANDING_UNLINKED_STATUS,
  ADS_LANDING_UNREAD_HINT,
  ADS_LANDING_UNREAD_STATUS,
  adsStartToken,
  PAGE_SCRIPT_ID,
} from "@/lib/page-script"
import { PIXEL_VERSION, readVisitorId } from "@/lib/tracker-script"

export function LandingPage() {
  const [params] = useSearchParams()
  const scriptId = PAGE_SCRIPT_ID.test(params.get("s") || "") ? (params.get("s") || "").toLowerCase() : ""
  const [username, setUsername] = useState("")
  const [visitorId, setVisitorId] = useState(() => (typeof window === "undefined" ? "" : readVisitorId()))
  const [ready, setReady] = useState(false)
  const [unreachable, setUnreachable] = useState(false)
  const [botUnread, setBotUnread] = useState(false)
  const href = adsDeepLink(username, adsStartToken(scriptId || undefined, visitorId || undefined))

  const applyHealth = (health: Awaited<ReturnType<typeof fetchHealth>>) => {
    setUnreachable(Boolean(health.unreachable))
    setUsername(health.telegramBotUsername || "")
    setBotUnread(health.telegramBotUnread === true && !health.telegramBotUsername)
    setReady(true)
  }

  useEffect(() => {
    setVisitorId(readVisitorId())
    if (document.querySelector("script[data-abilion-pixel]")) return
    const script = document.createElement("script")
    script.src = scriptId ? `/t.js?v=${PIXEL_VERSION}&s=${scriptId}` : `/t.js?v=${PIXEL_VERSION}`
    script.async = true
    script.dataset.abilionPixel = "1"
    script.dataset.cta = "[data-abilion-cta]"
    if (scriptId) script.dataset.abilionScript = scriptId
    document.head.appendChild(script)
  }, [scriptId])

  useEffect(() => {
    let cancelled = false
    const pull = () => {
      void fetchHealth().then((health) => {
        if (cancelled) return
        applyHealth(health)
      })
    }
    pull()
    const timer = window.setInterval(pull, 15_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  return (
    <main id="conteudo" tabIndex={-1} className="min-h-screen bg-[#0b0d12] text-zinc-100">
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
        {!ready ? (
          <p role="status" className="mt-8 text-[14px] text-zinc-400">
            A carregar o botão do Telegram…
          </p>
        ) : unreachable ? (
          <p role="alert" className="mt-8 text-[14px] text-zinc-400">
            Não consegui falar com o Worker.{" "}
            <button
              type="button"
              className="underline underline-offset-2 hover:text-zinc-200"
              onClick={() => {
                setReady(false)
                void fetchHealth().then(applyHealth)
              }}
            >
              Tentar outra vez
            </button>
          </p>
        ) : href ? (
          <a
            data-abilion-cta
            href={href}
            className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-sky-400 px-6 text-[15px] font-semibold text-sky-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d12]"
          >
            Falar com a Sté no Telegram
          </a>
        ) : (
          <p role="status" className="mt-8 text-[14px] text-zinc-400">
            {botUnread ? ADS_LANDING_UNREAD_STATUS : ADS_LANDING_UNLINKED_STATUS}
          </p>
        )}
        <p className="mt-4 text-[12px] text-zinc-400">
          {href ? (
            <>
              O botão vira <code className="text-zinc-300">t.me/...?start={scriptId ? `fb_s${scriptId}_vid` : "fb_vid"}</code>. Sem cadastro nesta página.
            </>
          ) : botUnread ? (
            ADS_LANDING_UNREAD_HINT
          ) : (
            ADS_LANDING_UNLINKED_HINT
          )}
        </p>
        <p className="mt-auto pt-16 text-[11px] text-zinc-400">
          Abilion · landing do pixel ·{" "}
          <Link
            to="/privacidade"
            className="underline underline-offset-2 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
          >
            Privacidade
          </Link>
        </p>
      </div>
    </main>
  )
}
