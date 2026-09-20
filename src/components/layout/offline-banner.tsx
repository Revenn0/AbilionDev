import { useEffect, useState } from "react"

export function OfflineBanner() {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine))

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener("online", on)
    window.addEventListener("offline", off)
    return () => {
      window.removeEventListener("online", on)
      window.removeEventListener("offline", off)
    }
  }, [])

  if (online) return null
  return (
    <p
      role="alert"
      className="border-b border-destructive/20 bg-destructive/10 px-4 py-2 text-center text-[12.5px] text-destructive"
    >
      Sem rede. O painel continua neste browser; CRM, Telegram e analytics só sincronizam quando voltares.
    </p>
  )
}
