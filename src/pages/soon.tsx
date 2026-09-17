import { PageHeading } from "@/components/page-heading"

export function SoonPage({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="page-shell">
        <PageHeading title={title} hint={hint} />
        <div className="surface px-6 py-16 text-center">
          <p className="text-[15px] font-semibold">Fora deste recorte</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Este menu existe para manter a área interna. A construção começa em login, dashboard e Fluxo.
          </p>
        </div>
      </div>
    </div>
  )
}
