import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { loginRequest, logoutRequest, meRequest } from "@/lib/auth-api"
import { clearSessionExpired, noteSessionExpired, subscribeSessionExpired } from "@/lib/session"
import { toast } from "sonner"
import { canDeleteFunnel, mergeFunnels, mergeLeads } from "@/lib/crm"
import { migrateFunnel, migrateLead, migrateSettings } from "@/lib/migrate"
import { fetchCrm, fetchInbox, fetchLeads, fetchRuntime, persistLeads, removeRemoteLead, saveCrm } from "@/lib/runtime-api"
import { seededOperation } from "@/lib/templates"
import { defaultSettings, type AppState, type Lead, type SalesFunnel, type Settings, type User } from "@/lib/types"

const KEY = "abilion.dev.v2"
const LEGACY = "abilion.dev.v1"
const SESSION = "abilion.dev.session"

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

function bootState(): AppState {
  const firstVisit = !localStorage.getItem(KEY) && !localStorage.getItem(LEGACY)
  const saved = withSeed(readState(), firstVisit)
  saved.user = readUser()
  return saved
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
  deleteFunnel: (id: string) => boolean
  createLead: (lead: Lead) => void
  createLeads: (leads: Lead[]) => void
  saveLead: (lead: Lead) => void
  deleteLead: (id: string) => void
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
  const stateRef = useRef(state)

  const flushLeadWrites = () => {
    window.clearTimeout(leadWriteTimer.current)
    const batch = [...pendingLeadWrites.current.values()]
    pendingLeadWrites.current.clear()
    if (!batch.length) return
    void persistLeads(batch).then((ok) => setPersistSync(ok ? "ok" : "error"))
  }

  const queueLeadWrite = (lead: Lead) => {
    pendingLeadWrites.current.set(lead.id, lead)
    window.clearTimeout(leadWriteTimer.current)
    leadWriteTimer.current = window.setTimeout(flushLeadWrites, 400)
  }

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const pushWorker = () => {
    window.clearTimeout(crmTimer.current)
    crmTimer.current = window.setTimeout(() => {
      const current = stateRef.current
      if (!current.user) return
      void saveCrm({
        funnels: current.funnels,
        settings: { ...current.settings, telegramBotToken: "" },
      }).then((ok) => setCrmSync(ok ? "ok" : "error"))
    }, 400)
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
      setState((prev) => ({
        ...prev,
        funnels: crm.ok && crm.funnels.length ? mergeFunnels(prev.funnels, crm.funnels.map(migrateFunnel)) : prev.funnels,
        leads: remoteLeads.ok && remoteLeads.leads.length ? mergeLeads(prev.leads, remoteLeads.leads.map(migrateLead)) : prev.leads,
        settings: {
          ...prev.settings,
          ...(crm.ok && crm.settings ? migrateSettings({ ...crm.settings, telegramBotToken: "" }) : {}),
          telegramBotToken: "",
          telegramBotUsername: runtime.telegramBotUsername || prev.settings.telegramBotUsername,
          telegramGroupUrl: runtime.telegramGroupUrl || prev.settings.telegramGroupUrl,
          plugins: {
            ...prev.settings.plugins,
            ...(crm.ok && crm.settings?.plugins ? crm.settings.plugins : {}),
            telegram: runtime.ok ? Boolean(runtime.telegram) : prev.settings.plugins.telegram,
          },
        },
      }))
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
      const incoming = inbox.leads.map((lead) => migrateLead(lead))
      if (!incoming.length) return
      setState((prev) => {
        const leads = mergeLeads(prev.leads, incoming)
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
    const onHide = () => flushLeadWrites()
    window.addEventListener("pagehide", onHide)
    return () => {
      window.removeEventListener("pagehide", onHide)
      flushLeadWrites()
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
        setState((prev) => ({ ...prev, user: data.user }))
      },
      logout: async () => {
        flushLeadWrites()
        await logoutRequest().catch(() => undefined)
        setCrmSync("idle")
        setInboxSync("idle")
        setPersistSync("idle")
        setState((prev) => ({ ...prev, user: null }))
      },
      createFunnel: (funnel) => {
        setState((prev) => ({ ...prev, funnels: [funnel, ...prev.funnels] }))
        pushWorker()
      },
      saveFunnel: (funnel) => {
        setState((prev) => {
          const exists = prev.funnels.some((item) => item.id === funnel.id)
          return {
            ...prev,
            funnels: exists
              ? prev.funnels.map((item) => (item.id === funnel.id ? funnel : item))
              : [funnel, ...prev.funnels],
          }
        })
        pushWorker()
      },
      deleteFunnel: (id) => {
        const gate = canDeleteFunnel(stateRef.current.funnels, id)
        if (!gate.ok) {
          toast.error(gate.reason)
          return false
        }
        setState((prev) => ({ ...prev, funnels: prev.funnels.filter((item) => item.id !== id) }))
        pushWorker()
        return true
      },
      createLead: (lead) => {
        setState((prev) => ({ ...prev, leads: [lead, ...prev.leads] }))
        void persistLeads([lead]).then((ok) => setPersistSync(ok ? "ok" : "error"))
      },
      createLeads: (leads) => {
        setState((prev) => ({ ...prev, leads: [...leads, ...prev.leads] }))
        void persistLeads(leads).then((ok) => setPersistSync(ok ? "ok" : "error"))
      },
      saveLead: (lead) => {
        setState((prev) => ({
          ...prev,
          leads: prev.leads.map((item) => (item.id === lead.id ? lead : item)),
        }))
        queueLeadWrite(lead)
      },
      deleteLead: (id) => {
        pendingLeadWrites.current.delete(id)
        setState((prev) => ({ ...prev, leads: prev.leads.filter((item) => item.id !== id) }))
        void removeRemoteLead(id).then((ok) => setPersistSync(ok ? "ok" : "error"))
      },
      saveSettings: (patch) => {
        setState((prev) => ({
          ...prev,
          settings: { ...prev.settings, ...patch, telegramBotToken: "", plugins: patch.plugins ?? prev.settings.plugins },
        }))
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
