import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { adsDeepLink } from "@/lib/telegram-start"
import { ADS_ORIGIN, pixelPageHtml } from "@/lib/tracker-script"
import { clipNewestIds } from "@/lib/crm"
import { addPageScript, adsStartToken, funnelHasInstallableBoard, PAGE_INSTALL_STEPS, PAGE_SCRIPT_REMOVED_CAP, pageInstallManual, removePageScript } from "@/lib/page-script"
import { useStore } from "@/lib/store"
import { toast } from "sonner"

export function PixelSnippet({ origin, botUsername }: { origin: string; botUsername?: string }) {
  const { state, saveSettings, flushCrmNow, crmSync, settingsSync } = useStore()
  const scripts = state.settings.pageScripts ?? []
  const boards = state.funnels.filter(funnelHasInstallableBoard)
  const boardsUnread = boards.length === 0 && (crmSync === "idle" || crmSync === "error")
  const scriptsUnread = scripts.length === 0 && (settingsSync === "idle" || settingsSync === "error")
  const [name, setName] = useState("")
  const [funnelId, setFunnelId] = useState(boards[0]?.id ?? "")
  const [pageUrl, setPageUrl] = useState("")
  const [busy, setBusy] = useState(false)
  const landing = `${ADS_ORIGIN}/l`
  const local = origin.replace(/\/$/, "")
  const localIsAds = local === ADS_ORIGIN || local === "https://abilion.lol"
  const defaultHref = botUsername ? adsDeepLink(botUsername) : ""
  const defaultSnippet = pixelPageHtml(ADS_ORIGIN, defaultHref)
  const manual = pageInstallManual({ botUsername })

  const persist = (next: typeof scripts, removed: string[] | undefined, ok: string, fail: string) => {
    if (busy) return
    setBusy(true)
    saveSettings({ pageScripts: next, ...(removed ? { removedPageScripts: removed } : {}) })
    void flushCrmNow()
      .then((result) => {
        if (result.ok && result.queued) toast.message("No painel. A gravar no Worker…")
        else if (result.ok) toast.success(ok)
        else toast.error(result.error || fail)
      })
      .finally(() => setBusy(false))
  }

  return (
    <section id="pixel" className="surface scroll-mt-6 p-6">
      <p className="text-[14px] font-medium">Pixel e scripts de página</p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
        Cada landing pode ter o seu script e o seu funil. O manual é o mesmo no painel, em{" "}
        <a className="font-medium text-foreground underline-offset-2 hover:underline" href="/api/install">
          /api/install
        </a>{" "}
        e no MCP <code className="text-foreground">abilion_page_install_manual</code>.
      </p>

      <ol className="mt-4 space-y-3">
        {PAGE_INSTALL_STEPS.map((step, index) => (
          <li key={step.title} className="text-[13px] leading-relaxed">
            <p className="font-medium">
              {index + 1}. {step.title}
            </p>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">{step.body}</p>
          </li>
        ))}
      </ol>

      <p className="mt-4 text-[12.5px] text-muted-foreground">
        Sem página própria, aponta o anúncio para{" "}
        <a className="font-medium text-foreground underline-offset-2 hover:underline" href={landing}>
          {landing}
        </a>
        {localIsAds ? null : (
          <>
            {" "}
            · teste local:{" "}
            <a className="font-medium text-foreground underline-offset-2 hover:underline" href={`${local}/l`}>
              {local}/l
            </a>
          </>
        )}
      </p>

      <p className="mt-5 text-[13.5px] font-medium">Script geral (funil publicado)</p>
      <pre className="mt-2 overflow-x-auto rounded-xl bg-muted px-4 py-3 text-[12px] leading-relaxed">
        {defaultSnippet.replaceAll("<", "\u003c")}
      </pre>
      <Button
        type="button"
        variant="outline"
        className="mt-3 rounded-full"
        onClick={() => {
          void navigator.clipboard
            .writeText(defaultSnippet)
            .then(() => toast.success("Snippet geral copiado."))
            .catch(() => toast.error("Não consegui copiar. Selecciona o snippet."))
        }}
      >
        Copiar snippet geral
      </Button>

      <p className="mt-6 text-[13.5px] font-medium">Outras páginas · outros funis</p>
      <p className="mt-1 text-[12.5px] text-muted-foreground">
        Cria um script por landing. O <code className="text-foreground">?s=ID</code> manda o /start para aquele quadro.
      </p>
      <form
        className="mt-3 grid gap-3 sm:grid-cols-2"
        data-pixel-create={scriptsUnread ? (settingsSync === "idle" ? "loading" : "error") : "ok"}
        onSubmit={(event) => {
          event.preventDefault()
          if (scriptsUnread || boardsUnread) return
          const made = addPageScript(scripts, { name, funnelId: funnelId || boards[0]?.id || "", pageUrl })
          if (!made.ok) {
            toast.error(made.error)
            return
          }
          setName("")
          setPageUrl("")
          persist(made.scripts, undefined, "Script da página criado.", "Não gravei o script no Worker.")
        }}
      >
        <fieldset disabled={scriptsUnread} className="col-span-full grid gap-3 border-0 p-0 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="page-script-name">Nome da página</Label>
          <Input id="page-script-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Landing Superbet" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="page-script-funnel">Funil</Label>
          <select
            id="page-script-funnel"
            data-pixel-funnels={crmSync === "idle" && boards.length === 0 ? "loading" : crmSync === "error" && boards.length === 0 ? "error" : boards.length ? "ok" : "empty"}
            value={funnelId || boards[0]?.id || ""}
            onChange={(event) => setFunnelId(event.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            disabled={boardsUnread}
          >
            {crmSync === "idle" && boards.length === 0 ? (
              <option value="">A carregar os funis…</option>
            ) : crmSync === "error" && boards.length === 0 ? (
              <option value="">Não li os funis</option>
            ) : boards.length === 0 ? (
              <option value="">Publica um funil primeiro</option>
            ) : null}
            {boards.map((funnel) => (
              <option key={funnel.id} value={funnel.id}>
                {funnel.name}
                {funnel.status === "active" && funnel.production ? " · publicado" : " · com quadro"}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="page-script-url">URL da landing (opcional)</Label>
          <Input
            id="page-script-url"
            value={pageUrl}
            onChange={(event) => setPageUrl(event.target.value)}
            placeholder="https://…"
          />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" className="rounded-full" disabled={busy || !boards.length || boardsUnread || scriptsUnread}>
            Criar script desta página
          </Button>
        </div>
        </fieldset>
      </form>

      {scriptsUnread && settingsSync === "idle" ? (
        <p className="mt-4 text-[12.5px] text-muted-foreground" data-pixel-scripts="loading">
          A carregar os scripts de página…
        </p>
      ) : scriptsUnread ? (
        <p className="mt-4 text-[12.5px] text-muted-foreground" data-pixel-scripts="error" role="alert">
          Não confirmei os scripts de página no Worker.
        </p>
      ) : scripts.length === 0 ? (
        <p className="mt-4 text-[12.5px] text-muted-foreground" data-pixel-scripts="empty">
          Ainda não há scripts extra. O geral cobre o funil publicado.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {scripts.map((script) => {
            const funnel = state.funnels.find((item) => item.id === script.funnelId)
            const href = botUsername ? adsDeepLink(botUsername, adsStartToken(script.id)) : ""
            const snippet = pixelPageHtml(ADS_ORIGIN, href, script.id)
            const preview = `${ADS_ORIGIN}/l?s=${script.id}`
            return (
              <li key={script.id} className="rounded-xl border border-border px-4 py-3">
                <p className="text-[13.5px] font-medium">{script.name}</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  Funil · {funnel?.name ?? "já não está no CRM"} · <code>s={script.id}</code>
                  {script.pageUrl ? (
                    <>
                      {" "}
                      ·{" "}
                      <a className="underline-offset-2 hover:underline" href={script.pageUrl} rel="noreferrer">
                        {script.pageUrl}
                      </a>
                    </>
                  ) : null}
                </p>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-muted px-3 py-2 text-[11.5px] leading-relaxed">
                  {snippet.replaceAll("<", "\u003c")}
                </pre>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(snippet)
                        .then(() => toast.success("Snippet desta página copiado."))
                        .catch(() => toast.error("Não consegui copiar. Selecciona o snippet."))
                    }}
                  >
                    Copiar snippet
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="rounded-full" asChild>
                    <a href={preview}>Abrir /l?s={script.id}</a>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-full text-destructive"
                    disabled={busy}
                    onClick={() => {
                      if (!confirm("Remover este script? As páginas que ainda o colam passam a usar o funil publicado.")) return
                      persist(
                        removePageScript(scripts, script.id),
                        clipNewestIds([...(state.settings.removedPageScripts ?? []), script.id], PAGE_SCRIPT_REMOVED_CAP),
                        "Script removido.",
                        "Não removi o script no Worker."
                      )
                    }}
                  >
                    Remover
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <p className="mt-4 text-[12px] text-muted-foreground">{manual.notes.join(" ")}</p>
    </section>
  )
}
