import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

type Theme = "light" | "dark"

type ThemeApi = {
  theme: Theme
  resolvedTheme: Theme
  setTheme: (next: string) => void
}

const KEY = "abilion-theme"
const ThemeContext = createContext<ThemeApi | null>(null)

function readTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === "dark" ? "dark" : "light"
  } catch {
    return "light"
  }
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark")
  document.documentElement.style.colorScheme = theme
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light")

  useEffect(() => {
    const next = readTheme()
    setThemeState(next)
    applyTheme(next)
  }, [])

  const api = useMemo<ThemeApi>(
    () => ({
      theme,
      resolvedTheme: theme,
      setTheme: (next) => {
        const value: Theme = next === "dark" ? "dark" : "light"
        try {
          localStorage.setItem(KEY, value)
        } catch {
          /* ignore quota */
        }
        applyTheme(value)
        setThemeState(value)
      },
    }),
    [theme]
  )

  return <ThemeContext.Provider value={api}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error("useTheme precisa do ThemeProvider")
  return value
}
