import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import type { IncomingMessage, ServerResponse } from "node:http"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type ViteDevServer } from "vite"
import { handleAuth, sessionUser, type AuthSnapshot, type AuthStore } from "./worker/auth.ts"
import { fileTrackStore } from "./worker/file-track.ts"
import { geoFromRequest, ingestTrack, readTrackBody, summaryFromStore, type TrackStore } from "./worker/track-store.ts"
import { TRACKER_JS } from "./src/lib/tracker-script.ts"

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

function localApi(store: AuthStore, tracks: TrackStore) {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = (req.url || "/").split("?")[0] || "/"
    if (url === "/t.js") {
      res.setHeader("content-type", "text/javascript; charset=utf-8")
      res.setHeader("access-control-allow-origin", "*")
      res.end(TRACKER_JS)
      return
    }
    if (url === "/api/health") {
      res.setHeader("content-type", "application/json")
      res.end(
        JSON.stringify({
          ok: true,
          telegram: false,
          supabase: Boolean(process.env.VITE_SUPABASE_ANON_KEY),
          local: true,
          auth: true,
          ste: true,
          llm: false,
        })
      )
      return
    }
    if (url === "/api/track" && req.method === "OPTIONS") {
      res.statusCode = 204
      res.setHeader("access-control-allow-origin", "*")
      res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS")
      res.end()
      return
    }
    if (url === "/api/track" && req.method === "POST") {
      const origin = `http://${req.headers.host || "127.0.0.1:43173"}`
      const headers = new Headers()
      for (const [key, value] of Object.entries(req.headers)) {
        if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value)
      }
      const request = new Request(new URL(url, origin), { method: "POST", headers, body: new Uint8Array(await readBody(req)) })
      const body = await readTrackBody(request)
      const geo = geoFromRequest(request)
      const events = ingestTrack(await tracks.load(), { ...body, ...geo, visitorId: String(body.visitorId ?? "") })
      await tracks.save(events)
      res.statusCode = 204
      res.setHeader("access-control-allow-origin", "*")
      res.end()
      return
    }
    if (url === "/api/track/summary" && req.method === "GET") {
      const origin = `http://${req.headers.host || "127.0.0.1:43173"}`
      const headers = new Headers()
      for (const [key, value] of Object.entries(req.headers)) {
        if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value)
      }
      const request = new Request(new URL(url, origin), { method: "GET", headers })
      const user = await sessionUser(request, store)
      res.setHeader("content-type", "application/json")
      if (!user) {
        res.statusCode = 401
        res.end(JSON.stringify({ error: "Sessão expirada." }))
        return
      }
      res.end(JSON.stringify({ ok: true, summary: await summaryFromStore(tracks) }))
      return
    }
    if (url === "/api/inbox" && req.method === "GET") {
      res.setHeader("content-type", "application/json")
      res.end(JSON.stringify({ ok: true, leads: [] }))
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

function attachApi(server: ViteDevServer, store: AuthStore, tracks: TrackStore) {
  const api = localApi(store, tracks)
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
        attachApi(
          server,
          fileAuthStore(path.resolve(import.meta.dirname, ".data/auth.json")),
          fileTrackStore(path.resolve(import.meta.dirname, ".data/track.json"))
        )
      },
      configurePreviewServer(server) {
        attachApi(
          server as unknown as ViteDevServer,
          fileAuthStore(path.resolve(import.meta.dirname, ".data/auth.json")),
          fileTrackStore(path.resolve(import.meta.dirname, ".data/track.json"))
        )
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
