import { Button } from "@/components/ui/button"
import { pixelSnippet } from "@/lib/tracker-script"
import { toast } from "sonner"

export function PixelSnippet({ origin }: { origin: string }) {
  const snippet = pixelSnippet(origin)
  return (
    <section className="surface p-6">
      <p className="text-[14px] font-medium">Pixel da landing</p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
        Cola isto na página para onde o Facebook manda o lead. No botão de Telegram usa{" "}
        <code className="text-foreground">data-abilion-cta</code>. O script grava visita, clique, bandeira e UF. O{" "}
        <code className="text-foreground">fb_vid</code> fecha o /start no mesmo visitante.
      </p>
      <p className="mt-3 text-[12.5px] text-muted-foreground">
        Landing de teste desta origem:{" "}
        <a className="font-medium text-foreground underline-offset-2 hover:underline" href={`${origin}/l`}>
          {origin}/l
        </a>
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
