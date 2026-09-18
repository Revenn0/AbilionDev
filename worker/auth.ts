export const OPERATORS = [
  { email: "victor@abilion.com", name: "Victor Junger" },
  { email: "gabriel@abilion.com", name: "Gabriel" },
] as const

const COOKIE = "abilion_session"
const DAY = 60 * 60 * 24
const SESSION_TTL_MS = 7 * DAY * 1000
const RESET_TTL_MS = 60 * 60 * 1000
const PBKDF2_ITERATIONS = 100_000

export type StoredUser = {
  id: string
  email: string
  name: string
  passwordHash: string
  createdAt: string
}

export type Session = {
  token: string
  userId: string
  expiresAt: number
  issuedAt: number
}

export type ResetRecord = {
  userId: string
  expiresAt: number
}

export type AuthSnapshot = {
  users: StoredUser[]
  sessions: Session[]
  resets: Record<string, ResetRecord>
}

export type AuthStore = {
  load(): Promise<AuthSnapshot>
  save(next: AuthSnapshot): Promise<void>
}

const encoder = new TextEncoder()

function hex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

function fromHex(value: string) {
  const bytes = new Uint8Array(value.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16)
  return bytes
}

function randomToken(bytes = 24) {
  return hex(crypto.getRandomValues(new Uint8Array(bytes)))
}

function timingEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false
  let diff = 0
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i]
  return diff === 0
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"])
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    key,
    256
  )
  return `pbkdf2:${PBKDF2_ITERATIONS}:${hex(salt)}:${hex(new Uint8Array(bits))}`
}

export async function verifyPassword(password: string, stored: string) {
  if (!stored.startsWith("pbkdf2:")) return false
  const [, iter, saltHex, hashHex] = stored.split(":")
  if (!iter || !saltHex || !hashHex) return false
  const salt = fromHex(saltHex)
  const expected = fromHex(hashHex)
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"])
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: Number(iter) || PBKDF2_ITERATIONS },
    key,
    expected.length * 8
  )
  return timingEqual(new Uint8Array(bits), expected)
}

export function isOperatorEmail(email: string) {
  return OPERATORS.some((item) => item.email === email)
}

export function operatorName(email: string) {
  return OPERATORS.find((item) => item.email === email)?.name ?? email
}

export function publicUser(user: StoredUser) {
  return { id: user.id, email: user.email, name: user.name }
}

function emptySnapshot(): AuthSnapshot {
  return { users: [], sessions: [], resets: {} }
}

function prune(snapshot: AuthSnapshot, now = Date.now()): AuthSnapshot {
  return {
    users: snapshot.users,
    sessions: snapshot.sessions.filter((item) => item.expiresAt > now),
    resets: Object.fromEntries(Object.entries(snapshot.resets).filter(([, item]) => item.expiresAt > now)),
  }
}

export async function ensureOperatorUsers(store: AuthStore, password: string) {
  if (password.length < 6) return
  const snapshot = prune(await store.load())
  let changed = false
  for (const operator of OPERATORS) {
    const current = snapshot.users.find((user) => user.email === operator.email)
    if (!current) {
      snapshot.users.push({
        id: randomToken(8),
        email: operator.email,
        name: operator.name,
        passwordHash: await hashPassword(password),
        createdAt: new Date().toISOString(),
      })
      changed = true
      continue
    }
    if (!(await verifyPassword(password, current.passwordHash)) || current.name !== operator.name) {
      current.passwordHash = await hashPassword(password)
      current.name = operator.name
      changed = true
    }
  }
  if (changed) await store.save(snapshot)
}

function readCookie(request: Request) {
  const header = request.headers.get("cookie") || ""
  const match = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`))
  return match ? decodeURIComponent(match.slice(COOKIE.length + 1)) : ""
}

function cookieHeader(token: string | null, secure: boolean) {
  if (!token) {
    return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`
  }
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * DAY}${secure ? "; Secure" : ""}`
}

function json(data: unknown, status = 200, headers?: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      ...headers,
    },
  })
}

async function readBody(request: Request) {
  return (await request.json().catch(() => ({}))) as {
    email?: string
    password?: string
    token?: string
  }
}

export async function handleAuth(request: Request, store: AuthStore, env?: { ABILION_OPERATOR_PASSWORD?: string; ABILION_ENV?: string }) {
  const url = new URL(request.url)
  const path = url.pathname
  const secure = url.protocol === "https:"
  if (env?.ABILION_OPERATOR_PASSWORD) {
    await ensureOperatorUsers(store, env.ABILION_OPERATOR_PASSWORD.trim())
  }

  if (path === "/api/auth/login" && request.method === "POST") {
    const body = await readBody(request)
    const email = (body.email || "").trim().toLowerCase()
    const password = body.password || ""
    if (!email || password.length < 6) {
      return json({ error: "Informe um e-mail e uma senha com 6+ caracteres." }, 400)
    }
    if (!isOperatorEmail(email)) {
      return json({ error: "E-mail ou senha inválidos." }, 401)
    }
    const snapshot = prune(await store.load())
    let user = snapshot.users.find((item) => item.email === email)
    if (!user) {
      user = {
        id: randomToken(8),
        email,
        name: operatorName(email),
        passwordHash: await hashPassword(password),
        createdAt: new Date().toISOString(),
      }
      snapshot.users.push(user)
    } else if (!(await verifyPassword(password, user.passwordHash))) {
      return json({ error: "E-mail ou senha inválidos." }, 401)
    }
    const now = Date.now()
    const token = randomToken()
    snapshot.sessions.push({ token, userId: user.id, expiresAt: now + SESSION_TTL_MS, issuedAt: now })
    await store.save(snapshot)
    return json({ user: publicUser(user) }, 200, { "set-cookie": cookieHeader(token, secure) })
  }

  if (path === "/api/auth/logout" && request.method === "POST") {
    const token = readCookie(request)
    const snapshot = prune(await store.load())
    snapshot.sessions = snapshot.sessions.filter((item) => item.token !== token)
    await store.save(snapshot)
    return json({ ok: true }, 200, { "set-cookie": cookieHeader(null, secure) })
  }

  if (path === "/api/auth/me" && request.method === "GET") {
    const token = readCookie(request)
    const snapshot = prune(await store.load())
    const session = snapshot.sessions.find((item) => item.token === token)
    const user = session ? snapshot.users.find((item) => item.id === session.userId) : null
    return json({ user: user ? publicUser(user) : null })
  }

  if (path === "/api/auth/forgot" && request.method === "POST") {
    const email = ((await readBody(request)).email || "").trim().toLowerCase()
    if (!email) return json({ error: "Informe o e-mail." }, 400)
    const snapshot = prune(await store.load())
    const user = snapshot.users.find((item) => item.email === email)
    if (user) {
      const token = randomToken()
      snapshot.resets[token] = { userId: user.id, expiresAt: Date.now() + RESET_TTL_MS }
      await store.save(snapshot)
      if (env?.ABILION_ENV !== "production") {
        return json({ ok: true, resetPath: `/reset?token=${token}` })
      }
    }
    return json({ ok: true })
  }

  if (path === "/api/auth/reset" && request.method === "POST") {
    const body = await readBody(request)
    const token = body.token || ""
    const password = body.password || ""
    if (!token || password.length < 6) return json({ error: "Token ou senha inválidos." }, 400)
    const snapshot = prune(await store.load())
    const rec = snapshot.resets[token]
    if (!rec) return json({ error: "Link expirado ou inválido." }, 400)
    const user = snapshot.users.find((item) => item.id === rec.userId)
    if (!user) return json({ error: "Link expirado ou inválido." }, 400)
    user.passwordHash = await hashPassword(password)
    snapshot.sessions = snapshot.sessions.filter((item) => item.userId !== user.id)
    delete snapshot.resets[token]
    await store.save(snapshot)
    return json({ ok: true })
  }

  return json({ error: "not_found" }, 404)
}

export function kvAuthStore(kv: { get(key: string, type: "json"): Promise<unknown>; put(key: string, value: string): Promise<void> }): AuthStore {
  return {
    async load() {
      const raw = await kv.get("snapshot", "json")
      if (!raw || typeof raw !== "object") return emptySnapshot()
      const value = raw as Partial<AuthSnapshot>
      return {
        users: Array.isArray(value.users) ? value.users : [],
        sessions: Array.isArray(value.sessions) ? value.sessions : [],
        resets: value.resets && typeof value.resets === "object" ? value.resets : {},
      }
    },
    async save(next) {
      await kv.put("snapshot", JSON.stringify(next))
    },
  }
}

export function memoryAuthStore(initial?: AuthSnapshot): AuthStore {
  let snapshot = initial ?? emptySnapshot()
  return {
    async load() {
      return structuredClone(snapshot)
    },
    async save(next) {
      snapshot = structuredClone(next)
    },
  }
}
