import { useEffect, useRef } from "react"
import { fetchLeadQuery } from "@/lib/runtime-api"
import { useStore } from "@/lib/store"

/** Se a lista hidratada já não tem o @user, o alias do Worker ainda encontra. */
export function useRemoteLeadSearch(query: string) {
  const { ingestRemoteLeads } = useStore()
  const ingestRef = useRef(ingestRemoteLeads)

  useEffect(() => {
    ingestRef.current = ingestRemoteLeads
  }, [ingestRemoteLeads])

  useEffect(() => {
    const needle = query.trim()
    if (needle.length < 3) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      void fetchLeadQuery(needle).then((result) => {
        if (cancelled || !result.ok || !result.leads.length) return
        ingestRef.current(result.leads)
      })
    }, 400)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query])
}
