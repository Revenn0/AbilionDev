import { cn } from "@/lib/utils"

const SWOOSH =
  "M6.2 44.8c8.2 1.2 13.6-3.4 19.4-15.2C31.2 17.6 40.2 9.2 56.8 8c-8.4 2.4-14.6 8.6-20.2 19.6C30.8 39.2 21.6 48.2 6.2 44.8Z"

export function LogoSwoosh({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-8", className)} aria-hidden>
      <path fill="currentColor" d={SWOOSH} />
    </svg>
  )
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <circle cx="16" cy="16" r="16" fill="#d6f36a" />
      <g transform="translate(5.2 5.6) scale(0.34)" className="text-[#141414]">
        <path fill="currentColor" d={SWOOSH} />
      </g>
    </svg>
  )
}

export function LogoWord({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <LogoMark className="size-6 shrink-0" />
      {!compact && <p className="truncate text-[14px] font-semibold tracking-[-0.02em] text-foreground">Abilion</p>}
    </div>
  )
}
