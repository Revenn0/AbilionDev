import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import type { IncomingMessage, ServerResponse } from "node:http"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type ViteDevServer } from "vite"
import { handleAuth, type AuthSnapshot, type AuthStore } from "./worker/auth.ts"

function fileAuthStore(file: string): AuthStore {
  const read = (): AuthSnapshot => {
    try {
      const raw = JSON.parse(readFileSync(file, "utf8")) as Partial<AuthSnapshot>
      return {
        users: Array.isArray(raw.users) ? raw.users : [],
        sessions: Array.isArray(raw.sessions) ? raw.sessions : [],
        resets: raw.resets && typeof raw.resets === "object" ? raw.resets : {},
      }
    } catch {
      return { users: [], sessions: [], resets: {} }
    }
  }
  return {
    async load() {
      return read()
    },
    async save(next: AuthSnapshot) {
      mkdirSync(path.dirname(file), { recursive: true })
      writeFileSync(file, JSON.stringify(next))
    },
  }
}

function readBody(req: IncomingMessage) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    req.on("end", () => resolve(Buffer.concat(chunks)))
    req.on("error", reject)
  })
}

function localApi(store: AuthStore) {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = req.url || "/"
    if (url === "/api/health") {
      res.setHeader("content-type", "application/json")
      res.end(JSON.stringify({ ok: true, telegram: false, supabase: Boolean(process.env.VITE_SUPABASE_ANON_KEY), local: true, auth: true }))
      return
    }
    if (!url.startsWith("/api/auth")) {
      next()
      return
    }
    const origin = `http://${req.headers.host || "127.0.0.1:43173"}`
    const body = req.method === "GET" || req.method === "HEAD" ? undefined : await readBody(req)
    const headers = new Headers()
    for (const [key, value] of Object.entries(req.headers)) {
      if (!value) continue
      headers.set(key, Array.isArray(value) ? value.join(", ") : value)
    }
    const request = new Request(new URL(url, origin), {
      method: req.method,
      headers,
      body: body && body.length ? new Uint8Array(body) : undefined,
    })
    const response = await handleAuth(request, store, {
      ABILION_OPERATOR_PASSWORD: process.env.ABILION_OPERATOR_PASSWORD,
      ABILION_ENV: "development",
    })
    res.statusCode = response.status
    response.headers.forEach((value: string, key: string) => {
      res.setHeader(key, value)
    })
    res.end(Buffer.from(await response.arrayBuffer()))
  }
}

function attachApi(server: ViteDevServer, store: AuthStore) {
  const api = localApi(store)
  server.middlewares.use((req, res, next) => {
    void api(req, res, next).catch(next)
  })
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "abilion-api",
      configureServer(server) {
        attachApi(server, fileAuthStore(path.resolve(import.meta.dirname, ".data/auth.json")))
      },
      configurePreviewServer(server) {
        attachApi(server as unknown as ViteDevServer, fileAuthStore(path.resolve(import.meta.dirname, ".data/auth.json")))
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
