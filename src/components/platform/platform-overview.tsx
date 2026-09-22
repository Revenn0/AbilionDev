import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { listAudioJobsRequest, getPlatformOverviewRequest, type PlatformOverview } from "@/lib/platform-api"
import { listCreativesRequest } from "@/lib/creative-api"
import { botIsRecent } from "@/lib/platform"
import { cn } from "@/lib/utils"

type OverviewState = {
  platform?: PlatformOverview
  failedAudio: number
  testingCreatives: number
  error?: string
}

function toneClass(kind: "ok" | "warn" | "danger") {
  if (kind === "danger") return "text-destructive"
  if (kind === "warn") return "text-amber-600 dark:text-amber-400"
  return "text-muted-foreground"
}

export function PlatformOverview() {
  const [data, setData] = useState<OverviewState>({ failedAudio: 0, testingCreatives: 0 })

  useEffect(() => {
    let cancelled = false
    void Promise.allSettled([getPlatformOverviewRequest(), listAudioJobsRequest(), listCreativesRequest()]).then(
      ([platform, audio, creatives]) => {
        if (cancelled) return
        const next: OverviewState = { failedAudio: 0, testingCreatives: 0 }
        if (platform.status === "fulfilled") next.platform = platform.value
        else next.error = platform.reason instanceof Error ? platform.reason.message : "Não li a operação."
        if (audio.status === "fulfilled") {
          next.failedAudio = audio.value.jobs.filter((job) => job.status === "error").length
        }
        if (creatives.status === "fulfilled") {
          next.testingCreatives = creatives.value.variants.filter((item) => item.status === "testing").length
        }
        setData(next)
      }
    )
    return () => {
      cancelled = true
    }
  }, [])

  const bots = data.platform?.bots.filter((bot) => bot.status !== "archived") ?? []
  const active = bots.filter((bot) => bot.status === "active").length
  const errors = (data.platform?.diagnostics ?? []).filter((item) => item.level === "error").length
  const integrations = data.platform?.integrations ?? []
  const tokenAlerts = integrations.filter(
    (item) => item.status === "error" || item.cleanupPending || Boolean(item.lastError)
  ).length
  const recentBots = bots.filter((bot) => botIsRecent(bot)).length
  const updatedBrains = (data.platform?.brains ?? []).filter((item) => item.status === "published").length

  return (
    <section aria-label="Estado da operação">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[12px] text-muted-foreground">Operação agora</p>
          <p className="mt-0.5 text-[15px] font-medium tracking-[-0.02em]">Bots, avisos e envios</p>
        </div>
        <Link to="/registos" className="text-[12.5px] font-medium text-muted-foreground hover:text-foreground">
          Abrir registos
        </Link>
      </div>
      {data.error ? (
        <p role="alert" className="mb-3 text-[12.5px] text-muted-foreground">
          {data.error}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <OverviewCard href="/bots" label="Bots activos" value={data.platform ? active : "…"} hint={recentBots ? `${recentBots} novos` : "em operação"} />
        <OverviewCard
          href="/registos"
          label="Avisos"
          value={data.platform ? errors : "…"}
          hint={errors ? "precisam de atenção" : "nada pendente"}
          tone={errors ? "danger" : "ok"}
        />
        <OverviewCard
          href="/audio"
          label="Áudios falhados"
          value={data.failedAudio}
          hint={data.failedAudio ? "repetir o envio" : "fila limpa"}
          tone={data.failedAudio ? "danger" : "ok"}
        />
        <OverviewCard
          href="/telegram"
          label="Ligações"
          value={data.platform ? tokenAlerts : "…"}
          hint={tokenAlerts ? "token ou webhook a falhar" : "integrações ok"}
          tone={tokenAlerts ? "warn" : "ok"}
        />
        <OverviewCard href="/bots" label="Cérebros publicados" value={data.platform ? updatedBrains : "…"} hint="versões ao vivo" />
        <OverviewCard
          href="/criativos"
          label="Criativos em teste"
          value={data.testingCreatives}
          hint={data.testingCreatives ? "experiências a correr" : "nenhum em teste"}
        />
      </div>
    </section>
  )
}

function OverviewCard({
  href,
  label,
  value,
  hint,
  tone = "ok",
}: {
  href: string
  label: string
  value: string | number
  hint: string
  tone?: "ok" | "warn" | "danger"
}) {
  return (
    <Link to={href} className="surface p-5 transition-colors hover:bg-card/80">
      <p className="text-[12.5px] text-muted-foreground">{label}</p>
      <p className={cn("mt-3 text-[28px] font-medium tracking-[-0.04em]", toneClass(tone))}>{value}</p>
      <p className="mt-1 text-[12px] text-muted-foreground">{hint}</p>
    </Link>
  )
}
