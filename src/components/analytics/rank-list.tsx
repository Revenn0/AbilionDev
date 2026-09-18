import type { TrackBucket } from "@/lib/track"
import { cn } from "@/lib/utils"

export function RankList({
  title,
  rows,
  empty,
  tone = "rose",
}: {
  title: string
  rows: TrackBucket[]
  empty: string
  tone?: "rose" | "sky"
}) {
  const max = Math.max(...rows.map((item) => item.count), 1)
  return (
    <section className="surface flex min-h-[320px] flex-col p-5">
      <p className="text-[12.5px] text-muted-foreground">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-8 text-[13px] text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {rows.map((item) => (
            <li key={item.label} className="grid grid-cols-[1fr_auto] items-center gap-3 text-[13px]">
              <div className="min-w-0">
                <p className="truncate">{item.label}</p>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-foreground/8">
                  <div
                    className={cn("h-full rounded-full", tone === "sky" ? "bg-sky-400/80" : "bg-rose-400/80")}
                    style={{ width: `${Math.max(6, (item.count / max) * 100)}%` }}
                  />
                </div>
              </div>
              <span className="tabular-nums text-muted-foreground">{item.count}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
