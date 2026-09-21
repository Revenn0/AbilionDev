export function PageAnchors({
  label = "Nesta página",
  items,
}: {
  label?: string
  items: Array<{ href: string; label: string }>
}) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          className="inline-flex h-8 items-center rounded-full bg-card px-3 text-[12.5px] font-medium text-muted-foreground ring-1 ring-border hover:text-foreground"
        >
          {item.label}
        </a>
      ))}
    </nav>
  )
}

export function ManualSteps({ steps }: { steps: ReadonlyArray<{ title: string; body: string }> }) {
  return (
    <ol className="mt-4 grid gap-2">
      {steps.map((step, index) => (
        <li key={step.title} className="rounded-2xl border border-border bg-muted/40 px-3.5 py-3">
          <p className="text-[11.5px] font-medium text-muted-foreground">Passo {index + 1}</p>
          <p className="mt-1 text-[13px] font-medium">{step.title}</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{step.body}</p>
        </li>
      ))}
    </ol>
  )
}
