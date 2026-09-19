import path from "node:path"
import type { IncomingMessage, ServerResponse } from "node:http"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type ViteDevServer } from "vite"
import { fileKv } from "./worker/file-kv.ts"
import { backgroundCtx, handleRequest, type Env } from "./worker/index.ts"

function readBody(req: IncomingMessage) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    req.on("end", () => resolve(Buffer.concat(chunks)))
    req.on("error", reject)
  })
}

function viteEnv(): Env {
  return {
    ASSETS: { fetch: () => Promise.resolve(new Response("not found", { status: 404 })) },
    SUPABASE_URL: process.env.VITE_SUPABASE_URL || "https://eyjgmkmaixmpmeeahxon.supabase.co",
    AUTH: fileKv(path.resolve(import.meta.dirname, ".data/kv")) as Env["AUTH"],
    OPENAI_BASE_URL: "https://openrouter.ai/api/v1",
    STE_MODEL: "google/gemma-4-31b-it:free",
    STE_FALLBACK_MODEL: "deepseek/deepseek-v4-flash-0731:free",
    STE_USE_LLM: "1",
    ABILION_ENV: "development",
    ABILION_OPERATOR_PASSWORD: process.env.ABILION_OPERATOR_PASSWORD,
  }
}

async function toRequest(req: IncomingMessage) {
  const origin = `http://${req.headers.host || "127.0.0.1:43173"}`
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (!value) continue
    headers.set(key, Array.isArray(value) ? value.join(", ") : value)
  }
  const method = req.method || "GET"
  const body = method === "GET" || method === "HEAD" ? undefined : await readBody(req)
  return new Request(new URL(req.url || "/", origin), {
    method,
    headers,
    body: body && body.length ? new Uint8Array(body) : undefined,
  })
}

function localApi(env: Env) {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = (req.url || "/").split("?")[0] || "/"
    if (url !== "/t.js" && !url.startsWith("/api/")) {
      next()
      return
    }
    const request = await toRequest(req)
    const response = await handleRequest(request, env, backgroundCtx())
    res.statusCode = response.status
    response.headers.forEach((value: string, key: string) => {
      res.setHeader(key, value)
    })
    res.end(Buffer.from(await response.arrayBuffer()))
  }
}

function attachApi(server: ViteDevServer, env: Env) {
  const api = localApi(env)
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
        attachApi(server, viteEnv())
      },
      configurePreviewServer(server) {
        attachApi(server as unknown as ViteDevServer, viteEnv())
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
    include: ["react", "react-dom", "react-router-dom", "@xyflow/react", "cobe"],
  },
})
