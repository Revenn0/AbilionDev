export function workerUrl() {
  if (typeof window !== "undefined") return window.location.origin
  return ((import.meta.env.VITE_APP_URL as string | undefined) ?? "").replace(/\/$/, "")
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
