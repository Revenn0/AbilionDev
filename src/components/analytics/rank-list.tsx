import type { TrackBucket } from "@/lib/track"

export function RankList({
  title,
  rows,
  empty,
}: {
  title: string
  rows: TrackBucket[]
  empty: string
  tone?: "rose" | "sky"
}) {
  const max = Math.max(...rows.map((item) => item.count), 1)
  return (
    <section className="surface flex min-h-[280px] flex-col p-6">
      <p className="text-[12.5px] text-muted-foreground">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-8 text-[13px] text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-5 space-y-5">
          {rows.map((item) => (
            <li key={item.label}>
              <div className="flex items-center justify-between gap-3 text-[13px]">
                <span className="truncate">{item.label}</span>
                <span className="tabular-nums text-muted-foreground">{item.count}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/8">
                <div className="h-full rounded-full bg-line" style={{ width: `${Math.max(6, (item.count / max) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
