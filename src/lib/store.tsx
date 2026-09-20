import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { loginRequest, logoutRequest, meRequest } from "@/lib/auth-api"
import { clearSessionExpired, noteSessionExpired, subscribeSessionExpired } from "@/lib/session"
import { toast } from "sonner"
import {
  activatePublishedFunnels,
  adoptOperatorLead,
  applyRemovedFunnels,
  applyRemovedLeads,
  canDeleteFunnel,
  canFlushCrm,
  clipRemovedIds,
  hydrateFunnels,
  mergeLeads,
  revertPublishedFunnels,
  pendingSeedFunnelIds,
  reconcileLeads,
} from "@/lib/crm"
import { migrateFunnel, migrateLead, migrateSettings } from "@/lib/migrate"
import { fetchCrm, fetchInbox, fetchLeads, fetchRuntime, persistLeads, removeRemoteLead, saveCrm } from "@/lib/runtime-api"
import { seededOperation } from "@/lib/templates"
import { defaultSettings, type AppState, type Lead, type SalesFunnel, type Settings, type User } from "@/lib/types"

const KEY = "abilion.dev.v2"
const LEGACY = "abilion.dev.v1"
const SESSION = "abilion.dev.session"
const REMOVED_LEADS = "abilion.dev.removed-leads"
const REMOVED_FUNNELS = "abilion.dev.removed-funnels"

const empty: AppState = {
  user: null,
  funnels: [],
  leads: [],
  settings: defaultSettings,
}

function readState(): AppState {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as Partial<AppState>
    return {
      user: parsed.user ?? null,
      funnels: Array.isArray(parsed.funnels) ? parsed.funnels.map(migrateFunnel) : [],
      leads: Array.isArray(parsed.leads) ? parsed.leads.map((lead) => migrateLead(lead as Lead)) : [],
      settings: migrateSettings({ ...parsed.settings, telegramBotToken: "" }),
    }
  } catch {
    return empty
  }
}

function readUser(): User | null {
  try {
    const raw = localStorage.getItem(SESSION)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

function withSeed(state: AppState, firstVisit: boolean): AppState {
  if (state.funnels.length > 0 || !firstVisit) return state
  return { ...state, funnels: [seededOperation()] }
}

function loadIdSet(key: string): Set<string> {
  try {
    return new Set(clipRemovedIds(JSON.parse(localStorage.getItem(key) || "[]"), 400))
  } catch {
    return new Set()
  }
}

function persistIdSet(key: string, ids: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...ids].slice(0, 400)))
  } catch {
    /* quota */
  }
}

function bootState(): AppState {
  const firstVisit = !localStorage.getItem(KEY) && !localStorage.getItem(LEGACY)
  const saved = withSeed(readState(), firstVisit)
  saved.user = readUser()
  return {
    ...saved,
    leads: applyRemovedLeads(saved.leads, loadIdSet(REMOVED_LEADS)),
    funnels: applyRemovedFunnels(saved.funnels, [...loadIdSet(REMOVED_FUNNELS)]),
  }
}

type SyncState = "idle" | "ok" | "error"

type Store = {
  ready: boolean
  remote: "off" | "local" | "cloud"
  crmSync: SyncState
  inboxSync: SyncState
  persistSync: SyncState
  state: AppState
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  createFunnel: (funnel: SalesFunnel) => void
  saveFunnel: (funnel: SalesFunnel) => void
  flushCrmNow: () => Promise<{ ok: boolean; error?: string; queued?: boolean }>
  flushLeadNow: () => Promise<boolean>
  deleteFunnel: (id: string) => Promise<boolean>
  createLead: (lead: Lead) => Promise<boolean>
  createLeads: (leads: Lead[]) => Promise<boolean>
  saveLead: (lead: Lead) => void
  deleteLead: (id: string) => Promise<boolean>
  saveSettings: (patch: Partial<Settings>) => void
}

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [remote, setRemote] = useState<Store["remote"]>("local")
  const [crmSync, setCrmSync] = useState<SyncState>("idle")
  const [inboxSync, setInboxSync] = useState<SyncState>("idle")
  const [persistSync, setPersistSync] = useState<SyncState>("idle")
  const [state, setState] = useState<AppState>(bootState)
  const persistTimer = useRef(0)
  const crmTimer = useRef(0)
  const leadWriteTimer = useRef(0)
  const pendingLeadWrites = useRef(new Map<string, Lead>())
  const pendingFunnelIds = useRef(new Set<string>())
  const removedFunnelIds = useRef(loadIdSet(REMOVED_FUNNELS))
  const removedLeadIds = useRef(loadIdSet(REMOVED_LEADS))
  const crmHydrated = useRef(false)
  const settingsDirty = useRef(false)
  const lastGoodFunnels = useRef<SalesFunnel[]>([])
  const stateRef = useRef(state)

  const flushLeadWrites = (): Promise<boolean> => {
    window.clearTimeout(leadWriteTimer.current)
    const batch = [...pendingLeadWrites.current.values()].filter((lead) => !removedLeadIds.current.has(lead.id))
    if (!batch.length) return Promise.resolve(true)
    return persistLeads(batch).then((ok) => {
      const raced = batch.filter((lead) => removedLeadIds.current.has(lead.id))
      if (raced.length) void Promise.all(raced.map((lead) => removeRemoteLead(lead.id)))
      if (ok) {
        for (const lead of batch) {
          if (removedLeadIds.current.has(lead.id)) continue
          const latest = pendingLeadWrites.current.get(lead.id)
          if (latest && latest.updatedAt === lead.updatedAt) pendingLeadWrites.current.delete(lead.id)
        }
      }
      setPersistSync(ok ? "ok" : "error")
      return ok
    })
  }

  const queueLeadWrite = (lead: Lead) => {
    pendingLeadWrites.current.set(lead.id, lead)
    window.clearTimeout(leadWriteTimer.current)
    leadWriteTimer.current = window.setTimeout(flushLeadWrites, 400)
  }

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const commitState = (next: AppState) => {
    stateRef.current = next
    setState(next)
  }

  const flushCrm = (): Promise<{ ok: boolean; error?: string; queued?: boolean }> => {
    window.clearTimeout(crmTimer.current)
    const current = stateRef.current
    if (!current.user) return Promise.resolve({ ok: false, error: "Sessão expirada." })
    if (!canFlushCrm(crmHydrated.current)) return Promise.resolve({ ok: true, queued: true })
    return saveCrm({
      funnels: current.funnels,
      settings: { ...current.settings, telegramBotToken: "" },
      removedFunnelIds: [...removedFunnelIds.current],
    }).then((result) => {
      if (result.ok) {
        removedFunnelIds.current.clear()
        pendingFunnelIds.current.clear()
        settingsDirty.current = false
        lastGoodFunnels.current = current.funnels
      } else {
        const reverted = revertPublishedFunnels(stateRef.current.funnels, lastGoodFunnels.current)
        if (reverted !== stateRef.current.funnels) {
          setState((prev) => {
            const next = { ...prev, funnels: reverted }
            stateRef.current = next
            return next
          })
        }
        toast.error(result.error || "Não gravei o CRM no Worker.")
      }
      setCrmSync(result.ok ? "ok" : "error")
      return result
    })
  }

  const pushWorker = () => {
    window.clearTimeout(crmTimer.current)
    crmTimer.current = window.setTimeout(flushCrm, 400)
  }

  useEffect(() => {
    let cancelled = false
    meRequest()
      .then((data) => {
        if (cancelled) return
        setState((prev) => ({ ...prev, user: data.user }))
      })
      .catch(() => {
        if (!cancelled) setState((prev) => ({ ...prev, user: null }))
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const expire = () => {
      crmHydrated.current = false
      lastGoodFunnels.current = []
      setCrmSync("idle")
      setInboxSync("idle")
      setPersistSync("idle")
      setState((prev) => {
        if (!prev.user) return prev
        toast.error("Sessão expirada. Entra outra vez.")
        return { ...prev, user: null }
      })
    }
    return subscribeSessionExpired(expire)
  }, [])

  useEffect(() => {
    if (!state.user) return
    const check = () => {
      void meRequest()
        .then((data) => {
          if (!data.user) noteSessionExpired()
        })
        .catch(() => undefined)
    }
    const timer = window.setInterval(check, 15_000)
    window.addEventListener("focus", check)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("focus", check)
    }
  }, [state.user])

  useEffect(() => {
    if (!state.user) return
    let cancelled = false
    void Promise.all([fetchCrm(), fetchRuntime(), fetchLeads()]).then(([crm, runtime, remoteLeads]) => {
      if (cancelled) return
      setCrmSync(crm.ok ? "ok" : "error")
      setPersistSync(remoteLeads.ok ? "ok" : "error")
      setRemote(runtime.persist === "supabase" ? "cloud" : runtime.ok ? "local" : "off")
      setState((prev) => {
        const remoteFunnels = crm.ok ? crm.funnels.map(migrateFunnel) : []
        const funnels = crm.ok
          ? hydrateFunnels(prev.funnels, remoteFunnels, pendingFunnelIds.current, removedFunnelIds.current)
          : prev.funnels
        if (crm.ok) {
          for (const id of pendingSeedFunnelIds(remoteFunnels, funnels)) pendingFunnelIds.current.add(id)
        }
        const remoteSettings = crm.ok && crm.settings && !settingsDirty.current ? migrateSettings({ ...crm.settings, telegramBotToken: "" }) : {}
        const next = {
          ...prev,
          funnels,
          leads: remoteLeads.ok
            ? remoteLeads.leads.length
              ? reconcileLeads(
                  prev.leads,
                  applyRemovedLeads(remoteLeads.leads.map(migrateLead), removedLeadIds.current),
                  pendingLeadWrites.current.keys()
                )
              : prev.leads.filter((lead) => pendingLeadWrites.current.has(lead.id))
            : prev.leads,
          settings: {
            ...prev.settings,
            ...remoteSettings,
            telegramBotToken: "",
            telegramBotUsername: runtime.telegramBotUsername || prev.settings.telegramBotUsername,
            telegramGroupUrl: runtime.telegramGroupUrl || prev.settings.telegramGroupUrl,
            plugins: {
              ...prev.settings.plugins,
              ...(crm.ok && crm.settings?.plugins && !settingsDirty.current ? crm.settings.plugins : {}),
              telegram: runtime.ok ? Boolean(runtime.telegram) : prev.settings.plugins.telegram,
            },
          },
        }
        stateRef.current = next
        if (crm.ok) lastGoodFunnels.current = funnels
        return next
      })
      if (crm.ok) {
        crmHydrated.current = true
        if (pendingFunnelIds.current.size || removedFunnelIds.current.size || settingsDirty.current) pushWorker()
      }
    })
    return () => {
      cancelled = true
    }
  }, [state.user])

  useEffect(() => {
    if (!state.user) return
    let cancelled = false
    const pull = async () => {
      const inbox = await fetchInbox()
      if (cancelled) return
      setInboxSync(inbox.ok ? "ok" : "error")
      const incoming = applyRemovedLeads(inbox.leads.map((lead) => migrateLead(lead)), removedLeadIds.current)
      if (!incoming.length) return
      setState((prev) => {
        const leads = mergeLeads(applyRemovedLeads(prev.leads, removedLeadIds.current), incoming)
        return leads === prev.leads ? prev : { ...prev, leads }
      })
    }
    void pull()
    const timer = window.setInterval(() => void pull(), 5000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [state.user])

  useEffect(() => {
    if (!state.user) return
    let cancelled = false
    const reconcile = async () => {
      const remoteLeads = await fetchLeads()
      if (cancelled) return
      if (!remoteLeads.ok) {
        setPersistSync("error")
        return
      }
      setPersistSync("ok")
      setState((prev) => {
        const incoming = applyRemovedLeads(remoteLeads.leads.map(migrateLead), removedLeadIds.current)
        const leads = remoteLeads.leads.length
          ? reconcileLeads(prev.leads, incoming, pendingLeadWrites.current.keys())
          : prev.leads.filter((lead) => pendingLeadWrites.current.has(lead.id))
        return leads === prev.leads ? prev : { ...prev, leads }
      })
    }
    const timer = window.setInterval(() => void reconcile(), 30_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [state.user])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === REMOVED_LEADS) {
        const ids = loadIdSet(REMOVED_LEADS)
        let changed = false
        for (const id of ids) {
          if (removedLeadIds.current.has(id)) continue
          removedLeadIds.current.add(id)
          changed = true
        }
        if (changed) persistIdSet(REMOVED_LEADS, removedLeadIds.current)
        setState((prev) => {
          const leads = applyRemovedLeads(prev.leads, removedLeadIds.current)
          return leads === prev.leads ? prev : { ...prev, leads }
        })
      }
      if (event.key === REMOVED_FUNNELS) {
        const ids = loadIdSet(REMOVED_FUNNELS)
        let changed = false
        for (const id of ids) {
          if (removedFunnelIds.current.has(id)) continue
          removedFunnelIds.current.add(id)
          changed = true
        }
        if (changed) persistIdSet(REMOVED_FUNNELS, removedFunnelIds.current)
        setState((prev) => {
          const funnels = applyRemovedFunnels(prev.funnels, [...removedFunnelIds.current])
          return funnels === prev.funnels ? prev : { ...prev, funnels }
        })
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  useEffect(() => {
    const onHide = () => {
      flushLeadWrites()
      flushCrm()
    }
    window.addEventListener("pagehide", onHide)
    return () => {
      window.removeEventListener("pagehide", onHide)
      flushLeadWrites()
      flushCrm()
    }
  }, [])

  useEffect(() => {
    window.clearTimeout(persistTimer.current)
    persistTimer.current = window.setTimeout(() => {
      const recent = [...state.leads].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 400)
      localStorage.setItem(KEY, JSON.stringify({ ...state, user: null, leads: recent, settings: { ...state.settings, telegramBotToken: "" } }))
      if (state.user) localStorage.setItem(SESSION, JSON.stringify(state.user))
      else localStorage.removeItem(SESSION)
    }, 120)
    return () => window.clearTimeout(persistTimer.current)
  }, [state])

  const api = useMemo<Store>(
    () => ({
      ready,
      remote,
      crmSync,
      inboxSync,
      persistSync,
      state,
      login: async (email, password) => {
        const data = await loginRequest(email, password)
        clearSessionExpired()
        commitState({ ...stateRef.current, user: data.user })
      },
      logout: async () => {
        flushLeadWrites()
        flushCrm()
        crmHydrated.current = false
        lastGoodFunnels.current = []
        await logoutRequest().catch(() => undefined)
        setCrmSync("idle")
        setInboxSync("idle")
        setPersistSync("idle")
        commitState({ ...stateRef.current, user: null })
      },
      createFunnel: (funnel) => {
        pendingFunnelIds.current.add(funnel.id)
        removedFunnelIds.current.delete(funnel.id)
        persistIdSet(REMOVED_FUNNELS, removedFunnelIds.current)
        const prev = stateRef.current
        commitState({
          ...prev,
          funnels:
            funnel.status === "active" && funnel.production
              ? activatePublishedFunnels([funnel, ...prev.funnels], funnel.id)
              : [funnel, ...prev.funnels],
        })
        pushWorker()
      },
      saveFunnel: (funnel) => {
        pendingFunnelIds.current.add(funnel.id)
        const prev = stateRef.current
        const exists = prev.funnels.some((item) => item.id === funnel.id)
        const nextFunnels = exists
          ? prev.funnels.map((item) => (item.id === funnel.id ? funnel : item))
          : [funnel, ...prev.funnels]
        commitState({
          ...prev,
          funnels: funnel.status === "active" && funnel.production ? activatePublishedFunnels(nextFunnels, funnel.id) : nextFunnels,
        })
        pushWorker()
      },
      flushCrmNow: () => flushCrm(),
      flushLeadNow: () => flushLeadWrites(),
      deleteFunnel: (id) => {
        const gate = canDeleteFunnel(stateRef.current.funnels, id)
        if (!gate.ok) {
          toast.error(gate.reason)
          return Promise.resolve(false)
        }
        pendingFunnelIds.current.delete(id)
        removedFunnelIds.current.add(id)
        persistIdSet(REMOVED_FUNNELS, removedFunnelIds.current)
        const prev = stateRef.current
        commitState({ ...prev, funnels: prev.funnels.filter((item) => item.id !== id) })
        return flushCrm().then((result) => result.ok)
      },
      createLead: (lead) => {
        removedLeadIds.current.delete(lead.id)
        persistIdSet(REMOVED_LEADS, removedLeadIds.current)
        pendingLeadWrites.current.set(lead.id, lead)
        const prev = stateRef.current
        commitState({ ...prev, leads: [lead, ...prev.leads] })
        return persistLeads([lead]).then((ok) => {
          if (ok) {
            const latest = pendingLeadWrites.current.get(lead.id)
            if (latest && latest.updatedAt === lead.updatedAt) pendingLeadWrites.current.delete(lead.id)
          }
          setPersistSync(ok ? "ok" : "error")
          return ok
        })
      },
      createLeads: (leads) => {
        for (const lead of leads) {
          removedLeadIds.current.delete(lead.id)
          pendingLeadWrites.current.set(lead.id, lead)
        }
        persistIdSet(REMOVED_LEADS, removedLeadIds.current)
        const prev = stateRef.current
        commitState({ ...prev, leads: [...leads, ...prev.leads] })
        return persistLeads(leads).then((ok) => {
          if (ok) {
            for (const lead of leads) {
              const latest = pendingLeadWrites.current.get(lead.id)
              if (latest && latest.updatedAt === lead.updatedAt) pendingLeadWrites.current.delete(lead.id)
            }
          }
          setPersistSync(ok ? "ok" : "error")
          return ok
        })
      },
      saveLead: (lead) => {
        const prev = stateRef.current
        const current = prev.leads.find((item) => item.id === lead.id)
        const nextLead = adoptOperatorLead(current ?? null, lead)
        queueLeadWrite(nextLead)
        commitState({
          ...prev,
          leads: prev.leads.map((item) => (item.id === lead.id ? nextLead : item)),
        })
      },
      deleteLead: (id) => {
        pendingLeadWrites.current.delete(id)
        removedLeadIds.current.add(id)
        persistIdSet(REMOVED_LEADS, removedLeadIds.current)
        const prev = stateRef.current
        commitState({ ...prev, leads: prev.leads.filter((item) => item.id !== id) })
        return removeRemoteLead(id).then((ok) => {
          setPersistSync(ok ? "ok" : "error")
          return ok
        })
      },
      saveSettings: (patch) => {
        settingsDirty.current = true
        const prev = stateRef.current
        commitState({
          ...prev,
          settings: { ...prev.settings, ...patch, telegramBotToken: "", plugins: patch.plugins ?? prev.settings.plugins },
        })
        pushWorker()
      },
    }),
    [ready, remote, crmSync, inboxSync, persistSync, state]
  )

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>
}

export function useStore() {
  const value = useContext(StoreContext)
  if (!value) throw new Error("useStore precisa do StoreProvider")
  return value
}
