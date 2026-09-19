import type { TrackBucket } from "@/lib/track"
import { StudioPanel } from "@/components/layout/studio"

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
    <StudioPanel title={title} bodyClassName="min-h-[240px]">
      {rows.length === 0 ? (
        <p className="text-[13px] leading-relaxed text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((item) => (
            <li key={item.label}>
              <div className="flex items-center justify-between gap-3 text-[13px]">
                <span className="truncate">{item.label}</span>
                <span className="tabular-nums text-muted-foreground">{item.count}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(6, (item.count / max) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </StudioPanel>
  )
}
