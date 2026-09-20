export function SyncBanner({
  items,
}: {
  items: Array<{ ok: boolean; message: string }>
}) {
  const failed = items.filter((item) => !item.ok)
  if (!failed.length) return null
  return (
    <div role="alert" className="space-y-2">
      {failed.map((item) => (
        <p
          key={item.message}
          className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-[12.5px] text-destructive"
        >
          {item.message}
        </p>
      ))}
    </div>
  )
}
