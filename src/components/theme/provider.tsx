import { ThemeProvider as NextThemes } from "next-themes"

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="light" storageKey="abilion-theme" enableSystem={false} disableTransitionOnChange>
      {children}
    </NextThemes>
  )
}
