import { fetchWithTimeout } from "@/lib/http"
import { noteUnauthorized } from "@/lib/session"
import type { FunnelImportSource } from "@/lib/funnel-import"
import type { SalesFunnel } from "@/lib/types"

export function importFunnelRequest(input: { payload: unknown; name?: string; publish?: boolean }) {
  return fetchWithTimeout("/api/funnels/import", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).then(async (response) => {
    noteUnauthorized(response)
    const data = (await response.json().catch(() => ({}))) as {
      error?: string
      ok?: boolean
      source?: FunnelImportSource
      funnel?: SalesFunnel
    }
    if (!response.ok || !data.funnel) throw new Error(data.error || "Não importei o funil.")
    return data as { ok: true; source: FunnelImportSource; funnel: SalesFunnel }
  })
}
