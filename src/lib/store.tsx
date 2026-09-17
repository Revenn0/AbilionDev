import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { nameFromEmail, uid } from "@/lib/format"
import { defaultSettings, emptyOps, type AppState, type PluginId, type SalesFunnel, type Settings, type User } from "@/lib/types"

const KEY = "abilion.dev.v1"
const SESSION = "abilion.dev.session"

const empty: AppState = {
  user: null,
  funnels: [],
  ops: emptyOps,
  settings: defaultSettings,
}

function readState(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as Partial<AppState>
    return {
      user: parsed.user ?? null,
      funnels: Array.isArray(parsed.funnels) ? parsed.funnels : [],
      ops: { ...emptyOps, ...(parsed.ops ?? {}) },
      settings: {
        ...defaultSettings,
        ...(parsed.settings ?? {}),
        plugins: { ...defaultSettings.plugins, ...(parsed.settings?.plugins ?? {}) },
      },
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

type Store = {
  ready: boolean
  state: AppState
  login: (email: string, password: string) => void
  logout: () => void
  createFunnel: (funnel: SalesFunnel) => void
  saveFunnel: (funnel: SalesFunnel) => void
  deleteFunnel: (id: string) => void
  saveSettings: (patch: Partial<Settings>) => void
  togglePlugin: (id: PluginId) => void
}

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [state, setState] = useState<AppState>(empty)

  useEffect(() => {
    const saved = readState()
    saved.user = readUser()
    setState(saved)
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    localStorage.setItem(KEY, JSON.stringify({ ...state, user: null }))
    if (state.user) localStorage.setItem(SESSION, JSON.stringify(state.user))
    else localStorage.removeItem(SESSION)
  }, [ready, state])

  const api = useMemo<Store>(
    () => ({
      ready,
      state,
      login: (email, password) => {
        if (password.length < 6) throw new Error("Informe um e-mail e uma senha com 6+ caracteres.")
        const user: User = { id: uid(), name: nameFromEmail(email), email }
        setState((prev) => ({ ...prev, user }))
      },
      logout: () => setState((prev) => ({ ...prev, user: null })),
      createFunnel: (funnel) => setState((prev) => ({ ...prev, funnels: [funnel, ...prev.funnels] })),
      saveFunnel: (funnel) =>
        setState((prev) => ({
          ...prev,
          funnels: prev.funnels.map((item) => (item.id === funnel.id ? funnel : item)),
        })),
      deleteFunnel: (id) => setState((prev) => ({ ...prev, funnels: prev.funnels.filter((item) => item.id !== id) })),
      saveSettings: (patch) =>
        setState((prev) => ({
          ...prev,
          settings: { ...prev.settings, ...patch, plugins: patch.plugins ?? prev.settings.plugins },
        })),
      togglePlugin: (id) =>
        setState((prev) => ({
          ...prev,
          settings: {
            ...prev.settings,
            plugins: { ...prev.settings.plugins, [id]: !prev.settings.plugins[id] },
          },
        })),
    }),
    [ready, state]
  )

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>
}

export function useStore() {
  const value = useContext(StoreContext)
  if (!value) throw new Error("useStore precisa do StoreProvider")
  return value
}
