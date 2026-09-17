export function workerUrl() {
  if (typeof window !== "undefined") return window.location.origin
  const fromEnv = import.meta.env.VITE_APP_URL as string | undefined
  if (fromEnv) return fromEnv.replace(/\/$/, "")
  return "https://abilion.vsanches1060.workers.dev"
}

export async function fetchHealth() {
  try {
    const res = await fetch(`${workerUrl()}/api/health`)
    if (!res.ok) return { ok: false as const }
    return (await res.json()) as { ok: boolean; telegram?: boolean; supabase?: boolean }
  } catch {
    return { ok: false as const }
  }
}
