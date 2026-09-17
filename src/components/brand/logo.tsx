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
      <defs>
        <linearGradient id="abilion-tile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2c2c2c" />
          <stop offset="100%" stopColor="#141414" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#abilion-tile)" />
      <rect width="32" height="32" rx="8" fill="none" stroke="rgb(255 255 255 / 0.1)" />
      <g transform="translate(5.2 5.6) scale(0.34)" className="text-[#f4f4f4]">
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
