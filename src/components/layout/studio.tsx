import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export const STUDIO_TONES = {
  sky: { pill: "border-sky-200 bg-sky-100 text-sky-900", card: "border-sky-200" },
  blue: { pill: "border-blue-200 bg-blue-100 text-blue-900", card: "border-blue-200" },
  pink: { pill: "border-pink-200 bg-pink-100 text-pink-900", card: "border-pink-200" },
  emerald: { pill: "border-emerald-200 bg-emerald-100 text-emerald-900", card: "border-emerald-200" },
  orange: { pill: "border-orange-200 bg-orange-100 text-orange-900", card: "border-orange-200" },
  violet: { pill: "border-violet-200 bg-violet-100 text-violet-900", card: "border-violet-200" },
  slate: { pill: "border-slate-200 bg-slate-100 text-slate-800", card: "border-slate-200" },
} as const

export type StudioTone = keyof typeof STUDIO_TONES

export function StudioPanel({
  eyebrow,
  title,
  hint,
  children,
  className,
  bodyClassName,
}: {
  eyebrow?: string
  title?: string
  hint?: string
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cn("overflow-hidden rounded-[22px] border border-border bg-card shadow-[0_10px_28px_-22px_rgba(15,23,42,0.22)]", className)}>
      {(eyebrow || title || hint) && (
        <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-5">
          <div>
            {eyebrow ? <p className="text-[12px] text-muted-foreground">{eyebrow}</p> : null}
            {title ? <p className="mt-1 text-[16px] font-medium tracking-[-0.02em]">{title}</p> : null}
          </div>
          {hint ? <p className="max-w-sm text-right text-[12px] leading-relaxed text-muted-foreground">{hint}</p> : null}
        </div>
      )}
      <div className={cn(eyebrow || title ? "p-5 pt-4" : "p-5", bodyClassName)}>{children}</div>
    </section>
  )
}

export function StudioMetric({
  title,
  tone = "sky",
  value,
  hint,
  footer,
  className,
}: {
  title: string
  tone?: StudioTone
  value: ReactNode
  hint?: string
  footer?: ReactNode
  className?: string
}) {
  const skin = STUDIO_TONES[tone]
  return (
    <article className={cn("relative min-w-0", className)}>
      <div className={cn("relative z-10 mx-5 rounded-full border px-3 py-1 text-center text-[12px] font-medium leading-5 shadow-sm", skin.pill)}>
        <span className="block truncate">{title}</span>
      </div>
      <div className={cn("-mt-2.5 rounded-[22px] border bg-card px-4 pb-4 pt-5", skin.card)}>
        <p className="text-[28px] font-medium tracking-[-0.04em] tabular-nums">{value}</p>
        {hint ? <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{hint}</p> : null}
        {footer}
      </div>
    </article>
  )
}
