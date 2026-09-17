import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "abilion-api",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === "/api/health") {
            res.setHeader("content-type", "application/json")
            res.end(JSON.stringify({ ok: true, telegram: false, supabase: Boolean(process.env.VITE_SUPABASE_ANON_KEY), local: true }))
            return
          }
          next()
        })
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 43173,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 43173,
    strictPort: true,
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-router-dom", "@xyflow/react"],
  },
})
