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
      <rect width="32" height="32" rx="9" fill="url(#abilion-tile)" />
      <rect width="32" height="32" rx="9" fill="none" stroke="rgb(255 255 255 / 0.1)" />
      <g transform="translate(5.2 5.6) scale(0.34)" className="text-[#f4f4f4]">
        <path fill="currentColor" d={SWOOSH} />
      </g>
    </svg>
  )
}

export function LogoStack({ className }: { className?: string }) {
  return (
    <div className={cn("relative mx-auto h-[280px] w-[280px]", className)} aria-hidden>
      <div className="absolute left-[22px] top-[92px] size-[200px] rotate-[-16deg] rounded-[38px] bg-[linear-gradient(145deg,#1a1a1a,#0e0e0e)] shadow-[0_30px_70px_-22px_rgb(0_0_0/0.95)] ring-1 ring-white/8" />
      <div className="absolute left-[58px] top-[32px] grid size-[200px] place-items-center rounded-[38px] bg-[linear-gradient(160deg,#262626,#141414)] shadow-[0_26px_54px_-18px_rgb(0_0_0/0.88)] ring-1 ring-white/14">
        <LogoSwoosh className="size-20 text-[#f2f2f2]" />
      </div>
    </div>
  )
}

export function LogoWord({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <LogoMark className="size-6 shrink-0" />
      {!compact && (
        <div className="min-w-0 leading-tight">
          <p className="text-[13.5px] font-semibold tracking-[-0.01em] text-foreground">Abilion</p>
          <p className="truncate text-[11px] text-muted-foreground">Fluxo · WhatsApp · CRM</p>
        </div>
      )}
    </div>
  )
}
