import { Button } from "@/components/ui/button"
import { adsDeepLink } from "@/lib/telegram-start"
import { ADS_ORIGIN, pixelPageHtml } from "@/lib/tracker-script"
import { toast } from "sonner"

export function PixelSnippet({ origin, botUsername }: { origin: string; botUsername?: string }) {
  const href = botUsername ? adsDeepLink(botUsername) : ""
  const snippet = pixelPageHtml(ADS_ORIGIN, href)
  const landing = `${ADS_ORIGIN}/l`
  const local = origin.replace(/\/$/, "")
  const localIsAds = local === ADS_ORIGIN || local === "https://abilion.lol"
  return (
    <section id="pixel" className="surface scroll-mt-6 p-6">
      <p className="text-[14px] font-medium">Pixel para a página do Facebook Ads</p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
        Cola isto na landing para onde o anúncio aponta. O botão do Telegram precisa de{" "}
        <code className="text-foreground">data-abilion-cta</code>. O script grava visita, clique, bandeira e UF. O{" "}
        <code className="text-foreground">fb_vid</code> fecha o /start no mesmo visitante.
      </p>
      <p className="mt-3 text-[12.5px] text-muted-foreground">
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
      <pre className="mt-4 overflow-x-auto rounded-xl bg-muted px-4 py-3 text-[12px] leading-relaxed">
        {snippet.replaceAll("<", "\u003c")}
      </pre>
      <Button
        type="button"
        variant="outline"
        className="mt-3 rounded-full"
        onClick={() => {
          void navigator.clipboard
            .writeText(snippet)
            .then(() => toast.success("Snippet copiado."))
            .catch(() => toast.error("Não consegui copiar. Selecciona o snippet."))
        }}
      >
        Copiar snippet
      </Button>
    </section>
  )
}
