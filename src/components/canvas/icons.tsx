import { useId } from "react"

export function MetaGlyph({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#1877F2" />
      <path fill="#fff" d="M13.35 19.1v-6.35h2.16l.32-2.48h-2.48V8.7c0-.72.2-1.2 1.23-1.2h1.32V5.28c-.23-.03-1.02-.1-1.94-.1-1.92 0-3.24 1.17-3.24 3.33v1.86H8.4v2.48h2.32V19.1h2.63z" />
    </svg>
  )
}

export function GoogleGlyph({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#fff" />
      <path fill="#4285F4" d="M20.1 12.23c0-.74-.07-1.45-.2-2.13H12v4.03h4.55a3.89 3.89 0 0 1-1.69 2.55v2.12h2.73c1.6-1.47 2.51-3.64 2.51-6.57z" />
      <path fill="#34A853" d="M12 20.5c2.28 0 4.2-.76 5.6-2.05l-2.73-2.12c-.76.51-1.73.81-2.87.81-2.21 0-4.08-1.49-4.75-3.5H4.43v2.19A8.5 8.5 0 0 0 12 20.5z" />
      <path fill="#FBBC05" d="M7.25 13.64A5.11 5.11 0 0 1 7 12c0-.57.1-1.12.25-1.64V8.17H4.43A8.5 8.5 0 0 0 3.5 12c0 1.37.33 2.67.93 3.83l2.82-2.19z" />
      <path fill="#EA4335" d="M12 6.86c1.24 0 2.36.43 3.24 1.26l2.43-2.43C16.19 4.3 14.28 3.5 12 3.5A8.5 8.5 0 0 0 4.43 8.17l2.82 2.19C7.92 8.35 9.79 6.86 12 6.86z" />
    </svg>
  )
}

export function InstagramGlyph({ className = "size-5" }: { className?: string; strokeWidth?: number }) {
  const gid = useId().replace(/:/g, "")
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#F58529" />
          <stop offset="0.5" stopColor="#DD2A7B" />
          <stop offset="1" stopColor="#8134AF" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="12" fill={`url(#${gid})`} />
      <rect x="7" y="7" width="10" height="10" rx="3" fill="none" stroke="#fff" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="2.4" fill="none" stroke="#fff" strokeWidth="1.5" />
      <circle cx="15.35" cy="8.7" r="0.7" fill="#fff" />
    </svg>
  )
}

export function YouTubeGlyph({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#FF0000" />
      <path fill="#fff" d="M10 8.7v6.6l5.6-3.3L10 8.7z" />
    </svg>
  )
}

export function OrganicGlyph({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#0F172A" />
      <path d="M8 16c2.2-1.2 3.4-3.8 4-7.4.6 3.6 1.8 6.2 4 7.4" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <circle cx="12" cy="16.2" r="1.15" fill="#fff" />
    </svg>
  )
}

