import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { loginRequest, logoutRequest, meRequest } from "@/lib/auth-api"
import { clearSessionExpired, noteSessionExpired, subscribeSessionExpired } from "@/lib/session"
import { toast } from "sonner"
import {
  activatePublishedFunnels,
  adoptHydrateSettings,
  adoptOperatorLead,
  applyRemovedFunnels,
  applyRemovedLeads,
  leadsStillOnRemote,
  canDeleteFunnel,
  canFlushCrm,
  clipRemovedIds,
  hydrateFunnels,
  mergeLeads,
  overlayPendingLeads,
  revertPublishedFunnels,
  pendingSeedFunnelIds,
  recoverPendingFunnelIds,
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
const PENDING_LEADS = "abilion.dev.pending-leads"
const PENDING_FUNNELS = "abilion.dev.pending-funnels"
const PENDING_SETTINGS = "abilion.dev.pending-settings"

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

function loadFlag(key: string) {
  try {
    return localStorage.getItem(key) === "1"
  } catch {
    return false
  }
}

function persistFlag(key: string, on: boolean) {
  try {
    if (on) localStorage.setItem(key, "1")
    else localStorage.removeItem(key)
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

function bootSession() {
  const state = bootState()
  const pendingLeadIds = loadIdSet(PENDING_LEADS)
  const pendingLeads = new Map<string, Lead>()
  for (const lead of state.leads) {
    if (pendingLeadIds.has(lead.id)) pendingLeads.set(lead.id, lead)
  }
  return { state, pendingLeads, pendingFunnels: loadIdSet(PENDING_FUNNELS) }
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
  retryHydrate: () => Promise<void>
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
  const session = useState(bootSession)[0]
  const [state, setState] = useState(session.state)
  const persistTimer = useRef(0)
  const crmTimer = useRef(0)
  const leadWriteTimer = useRef(0)
  const pendingLeadWrites = useRef(session.pendingLeads)
  const pendingFunnelIds = useRef(session.pendingFunnels)
  const removedFunnelIds = useRef(loadIdSet(REMOVED_FUNNELS))
  const removedLeadIds = useRef(loadIdSet(REMOVED_LEADS))
  const crmHydrated = useRef(false)
  const settingsDirty = useRef(loadFlag(PENDING_SETTINGS))
  const lastGoodFunnels = useRef<SalesFunnel[]>([])
  const stateRef = useRef(state)
  const leadFlushRef = useRef(Promise.resolve(true))
  const hydrateLock = useRef<Promise<void> | null>(null)

  const flushLeadWrites = (): Promise<boolean> => {
    window.clearTimeout(leadWriteTimer.current)
    for (const id of [...pendingLeadWrites.current.keys()]) {
      if (removedLeadIds.current.has(id)) pendingLeadWrites.current.delete(id)
    }
    persistIdSet(PENDING_LEADS, new Set(pendingLeadWrites.current.keys()))
    const batch = [...pendingLeadWrites.current.values()]
    if (!batch.length) return leadFlushRef.current
    const pending = persistLeads(batch).then((ok) => {
      const raced = batch.filter((lead) => removedLeadIds.current.has(lead.id))
      if (raced.length) void Promise.all(raced.map((lead) => removeRemoteLead(lead.id)))
      if (ok) {
        for (const lead of batch) {
          if (removedLeadIds.current.has(lead.id)) continue
          const latest = pendingLeadWrites.current.get(lead.id)
          if (latest && latest.updatedAt === lead.updatedAt) pendingLeadWrites.current.delete(lead.id)
        }
      }
      persistIdSet(PENDING_LEADS, new Set(pendingLeadWrites.current.keys()))
      setPersistSync(ok ? "ok" : "error")
      return ok
    })
    leadFlushRef.current = pending
    return pending
  }

  const flushRemovedLeads = (ids: string[]) => {
    const batch = ids.filter((id) => id && removedLeadIds.current.has(id)).slice(0, 40)
    if (!batch.length) return Promise.resolve(true)
    return Promise.all(batch.map((id) => removeRemoteLead(id))).then((results) => {
      const ok = results.every(Boolean)
      setPersistSync(ok ? "ok" : "error")
      return ok
    })
  }

  const queueLeadWrite = (lead: Lead) => {
    if (removedLeadIds.current.has(lead.id)) return
    pendingLeadWrites.current.set(lead.id, lead)
    persistIdSet(PENDING_LEADS, new Set(pendingLeadWrites.current.keys()))
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

  const flushCrm = (opts?: { silent?: boolean }): Promise<{ ok: boolean; error?: string; queued?: boolean }> => {
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
        persistIdSet(PENDING_FUNNELS, pendingFunnelIds.current)
        settingsDirty.current = false
        persistFlag(PENDING_SETTINGS, false)
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
        if (!opts?.silent) toast.error(result.error || "Não gravei o CRM no Worker.")
      }
      setCrmSync(result.ok ? "ok" : "error")
      return result
    })
  }

  const pushWorker = () => {
    window.clearTimeout(crmTimer.current)
    crmTimer.current = window.setTimeout(flushCrm, 400)
  }

  const runHydrate = (force = false) => {
    if (!force && crmHydrated.current) return Promise.resolve()
    if (hydrateLock.current) return hydrateLock.current
    const pending = Promise.all([fetchCrm(), fetchRuntime(), fetchLeads()]).then(([crm, runtime, remoteLeads]) => {
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
          for (const id of recoverPendingFunnelIds(funnels, remoteFunnels)) pendingFunnelIds.current.add(id)
        }
        const remoteSettings =
          crm.ok && crm.settings && !settingsDirty.current ? migrateSettings({ ...crm.settings, telegramBotToken: "" }) : undefined
        const next = {
          ...prev,
          funnels,
          leads: overlayPendingLeads(
            remoteLeads.ok
              ? remoteLeads.leads.length
                ? reconcileLeads(
                    prev.leads,
                    applyRemovedLeads(remoteLeads.leads.map(migrateLead), removedLeadIds.current),
                    pendingLeadWrites.current.keys()
                  )
                : prev.leads.filter((lead) => pendingLeadWrites.current.has(lead.id))
              : prev.leads,
            pendingLeadWrites.current,
            removedLeadIds.current
          ),
          settings: adoptHydrateSettings(prev.settings, remoteSettings, settingsDirty.current, runtime),
        }
        stateRef.current = next
        if (crm.ok) lastGoodFunnels.current = funnels
        return next
      })
      if (crm.ok) {
        persistIdSet(PENDING_FUNNELS, pendingFunnelIds.current)
        crmHydrated.current = true
        if (pendingFunnelIds.current.size || removedFunnelIds.current.size || settingsDirty.current) pushWorker()
        if (pendingLeadWrites.current.size) void flushLeadWrites()
      }
      if (remoteLeads.ok) {
        const retry = leadsStillOnRemote(removedLeadIds.current, remoteLeads.leads)
        if (retry.length) void flushRemovedLeads(retry)
      }
    }).finally(() => {
      if (hydrateLock.current === pending) hydrateLock.current = null
    })
    hydrateLock.current = pending
    return pending
  }

  useEffect(() => {
    let cancelled = false
    meRequest()
      .then((data) => {
        if (cancelled) return
        commitState({ ...stateRef.current, user: data.user })
      })
      .catch(() => undefined)
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
    void runHydrate()
    const retry = () => {
      if (!crmHydrated.current) void runHydrate()
    }
    const timer = window.setInterval(retry, 8_000)
    window.addEventListener("focus", retry)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("focus", retry)
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
        const leads = overlayPendingLeads(
          mergeLeads(applyRemovedLeads(prev.leads, removedLeadIds.current), incoming),
          pendingLeadWrites.current,
          removedLeadIds.current
        )
        if (leads === prev.leads) return prev
        const next = { ...prev, leads }
        stateRef.current = next
        return next
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
        const leads = overlayPendingLeads(
          remoteLeads.leads.length
            ? reconcileLeads(prev.leads, incoming, pendingLeadWrites.current.keys())
            : prev.leads.filter((lead) => pendingLeadWrites.current.has(lead.id)),
          pendingLeadWrites.current,
          removedLeadIds.current
        )
        if (leads === prev.leads) return prev
        const next = { ...prev, leads }
        stateRef.current = next
        return next
      })
      const retry = leadsStillOnRemote(removedLeadIds.current, remoteLeads.leads)
      if (retry.length) void flushRemovedLeads(retry)
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
        await flushLeadWrites()
        await flushCrm()
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
        persistIdSet(PENDING_FUNNELS, pendingFunnelIds.current)
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
        persistIdSet(PENDING_FUNNELS, pendingFunnelIds.current)
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
      flushCrmNow: () => flushCrm({ silent: true }),
      flushLeadNow: () => flushLeadWrites(),
      retryHydrate: () => runHydrate(true),
      deleteFunnel: (id) => {
        const gate = canDeleteFunnel(stateRef.current.funnels, id)
        if (!gate.ok) {
          toast.error(gate.reason)
          return Promise.resolve(false)
        }
        pendingFunnelIds.current.delete(id)
        persistIdSet(PENDING_FUNNELS, pendingFunnelIds.current)
        removedFunnelIds.current.add(id)
        persistIdSet(REMOVED_FUNNELS, removedFunnelIds.current)
        const prev = stateRef.current
        commitState({ ...prev, funnels: prev.funnels.filter((item) => item.id !== id) })
        return flushCrm({ silent: true }).then((result) => result.ok)
      },
      createLead: (lead) => {
        removedLeadIds.current.delete(lead.id)
        persistIdSet(REMOVED_LEADS, removedLeadIds.current)
        pendingLeadWrites.current.set(lead.id, lead)
        persistIdSet(PENDING_LEADS, new Set(pendingLeadWrites.current.keys()))
        const prev = stateRef.current
        commitState({ ...prev, leads: [lead, ...prev.leads] })
        return flushLeadWrites()
      },
      createLeads: (leads) => {
        for (const lead of leads) {
          removedLeadIds.current.delete(lead.id)
          pendingLeadWrites.current.set(lead.id, lead)
        }
        persistIdSet(REMOVED_LEADS, removedLeadIds.current)
        persistIdSet(PENDING_LEADS, new Set(pendingLeadWrites.current.keys()))
        const prev = stateRef.current
        commitState({ ...prev, leads: [...leads, ...prev.leads] })
        return flushLeadWrites()
      },
      saveLead: (lead) => {
        if (removedLeadIds.current.has(lead.id)) return
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
        persistIdSet(PENDING_LEADS, new Set(pendingLeadWrites.current.keys()))
        removedLeadIds.current.add(id)
        persistIdSet(REMOVED_LEADS, removedLeadIds.current)
        const prev = stateRef.current
        commitState({ ...prev, leads: prev.leads.filter((item) => item.id !== id) })
        return leadFlushRef.current.then(() => removeRemoteLead(id)).then((ok) => {
          setPersistSync(ok ? "ok" : "error")
          return ok
        })
      },
      saveSettings: (patch) => {
        settingsDirty.current = true
        persistFlag(PENDING_SETTINGS, true)
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
