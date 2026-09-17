import { PageHeading } from "@/components/page-heading"

export function SoonPage({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="page-shell">
        <PageHeading title={title} hint={hint} />
        <div className="surface px-6 py-16">
          <p className="text-[14px] font-medium">Em preparação</p>
          <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-muted-foreground">
            Esta área vai alimentar o dashboard com leads e conversas. Ainda não está ligada a um canal.
          </p>
        </div>
      </div>
    </div>
  )
}
