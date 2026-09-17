import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/components/theme/provider"
import { StoreProvider } from "@/lib/store"
import App from "./App.tsx"
import "./index.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <StoreProvider>
        <App />
        <Toaster />
      </StoreProvider>
    </ThemeProvider>
  </StrictMode>
)
