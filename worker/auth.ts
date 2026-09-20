import { readJsonObject } from "./json-body.ts"

export const OPERATORS = [
  { email: "victor@abilion.com", name: "Victor Junger" },
  { email: "gabriel@abilion.com", name: "Gabriel" },
] as const

const COOKIE = "abilion_session"
const DAY = 60 * 60 * 24
const SESSION_TTL_MS = 7 * DAY * 1000
const RESET_TTL_MS = 60 * 60 * 1000
const SESSION_CAP = 5
const PBKDF2_ITERATIONS = 100_000

export const AUTH_REVOKED_CAP = 2000
export const AUTH_SPENT_RESET_CAP = 200

export type StoredUser = {
  id: string
  email: string
  name: string
  passwordHash: string
  createdAt: string
  passwordUpdatedAt?: number
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

export type AuthThrottle = {
  count: number
  resetAt: number
}

export type AuthSnapshot = {
  users: StoredUser[]
  sessions: Session[]
  resets: Record<string, ResetRecord>
  throttles?: Record<string, AuthThrottle>
  revoked?: string[]
  spentResets?: string[]
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

export function randomToken(bytes = 24) {
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
  return { users: [], sessions: [], resets: {}, throttles: {}, revoked: [], spentResets: [] }
}

export function clipAuthTokens(ids: unknown, cap = AUTH_REVOKED_CAP): string[] {
  if (!Array.isArray(ids)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const id of ids) {
    if (typeof id !== "string") continue
    const next = id.trim()
    if (!next || next.length > 128 || seen.has(next)) continue
    seen.add(next)
    out.push(next)
    if (out.length >= cap) break
  }
  return out
}

export function mergeThrottles(
  left: Record<string, AuthThrottle>,
  right: Record<string, AuthThrottle>
): Record<string, AuthThrottle> {
  const out: Record<string, AuthThrottle> = { ...left }
  for (const [key, item] of Object.entries(right)) {
    const prev = out[key]
    if (!prev) {
      out[key] = item
      continue
    }
    if (item.resetAt === prev.resetAt) {
      out[key] = { count: Math.max(prev.count, item.count), resetAt: prev.resetAt }
      continue
    }
    out[key] = item.resetAt > prev.resetAt ? item : prev
  }
  return out
}

function capSessions(sessions: Session[], cap = SESSION_CAP): Session[] {
  const byUser = new Map<string, Session[]>()
  for (const session of sessions) {
    const list = byUser.get(session.userId) ?? []
    list.push(session)
    byUser.set(session.userId, list)
  }
  const out: Session[] = []
  for (const list of byUser.values()) {
    out.push(...list.sort((a, b) => b.issuedAt - a.issuedAt).slice(0, cap))
  }
  return out
}

function passwordAt(user: StoredUser | undefined) {
  return user?.passwordUpdatedAt ?? 0
}

function preferUser(prev: StoredUser, next: StoredUser): StoredUser {
  const prevAt = passwordAt(prev)
  const nextAt = passwordAt(next)
  if (nextAt > prevAt) {
    return { ...prev, ...next, passwordHash: next.passwordHash, passwordUpdatedAt: nextAt }
  }
  if (prevAt > nextAt) {
    return { ...next, ...prev, id: prev.id, passwordHash: prev.passwordHash, passwordUpdatedAt: prevAt }
  }
  return { ...prev, ...next, id: prev.id, passwordHash: next.passwordHash || prev.passwordHash }
}

export function mergeAuthSnapshots(left: AuthSnapshot, right: AuthSnapshot): AuthSnapshot {
  const remap = new Map<string, string>()
  const byEmail = new Map<string, StoredUser>()
  for (const user of left.users) {
    if (user?.id && user.email) byEmail.set(user.email, user)
  }
  for (const user of right.users) {
    if (!user?.id || !user.email) continue
    const prev = byEmail.get(user.email)
    if (!prev) {
      byEmail.set(user.email, user)
      continue
    }
    if (prev.id !== user.id) remap.set(user.id, prev.id)
    byEmail.set(user.email, preferUser(prev, { ...user, id: prev.id }))
  }

  const users = [...byEmail.values()]
  const winAt = new Map(users.map((user) => [user.id, passwordAt(user)]))
  const freshByUser = new Map<string, Set<string> | null>()
  const tokensFor = (userId: string) => {
    if (freshByUser.has(userId)) return freshByUser.get(userId) ?? null
    const winner = winAt.get(userId) ?? 0
    if (!winner) {
      freshByUser.set(userId, null)
      return null
    }
    const tokens = new Set<string>()
    for (const snap of [left, right]) {
      if (!snap.users.some((item) => (remap.get(item.id) ?? item.id) === userId && passwordAt(item) === winner)) continue
      for (const session of snap.sessions) {
        if ((remap.get(session.userId) ?? session.userId) === userId) tokens.add(session.token)
      }
    }
    freshByUser.set(userId, tokens)
    return tokens
  }

  const sessions = new Map<string, Session>()
  for (const session of [...left.sessions, ...right.sessions]) {
    if (!session?.token) continue
    const userId = remap.get(session.userId) ?? session.userId
    const allowed = tokensFor(userId)
    if (allowed && !allowed.has(session.token)) continue
    sessions.set(session.token, { ...session, userId })
  }
  const revoked = clipAuthTokens([...(left.revoked ?? []), ...(right.revoked ?? [])], AUTH_REVOKED_CAP)
  const spentResets = clipAuthTokens([...(left.spentResets ?? []), ...(right.spentResets ?? [])], AUTH_SPENT_RESET_CAP)
  const drop = new Set(revoked)
  const now = Date.now()
  const resetByUser = new Map<string, { token: string; rec: ResetRecord }>()
  for (const [token, rec] of [...Object.entries(left.resets ?? {}), ...Object.entries(right.resets ?? {})]) {
    if (!rec || typeof rec.userId !== "string" || spentResets.includes(token)) continue
    const userId = remap.get(rec.userId) ?? rec.userId
    const prev = resetByUser.get(userId)
    if (!prev || rec.expiresAt >= prev.rec.expiresAt) resetByUser.set(userId, { token, rec: { ...rec, userId } })
  }

  return {
    users: [...byEmail.values()],
    sessions: capSessions(
      [...sessions.values()].filter((item) => !drop.has(item.token) && item.expiresAt > now)
    ),
    resets: Object.fromEntries([...resetByUser.values()].map((item) => [item.token, item.rec])),
    throttles: mergeThrottles(left.throttles ?? {}, right.throttles ?? {}),
    revoked,
    spentResets,
  }
}

const memoryThrottles = new Map<string, AuthThrottle>()

export function consumeMemoryThrottle(key: string, limit: number, windowMs: number, now = Date.now()) {
  const current = memoryThrottles.get(key)
  if (!current || current.resetAt <= now) {
    memoryThrottles.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (current.count >= limit) return false
  memoryThrottles.set(key, { ...current, count: current.count + 1 })
  return true
}

export function consumeThrottle(
  snapshot: AuthSnapshot,
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now()
) {
  const throttles = { ...(snapshot.throttles ?? {}) }
  const current = throttles[key]
  if (!current || current.resetAt <= now) {
    throttles[key] = { count: 1, resetAt: now + windowMs }
    return { ok: true as const, snapshot: { ...snapshot, throttles } }
  }
  if (current.count >= limit) return { ok: false as const, snapshot }
  throttles[key] = { ...current, count: current.count + 1 }
  return { ok: true as const, snapshot: { ...snapshot, throttles } }
}

export function clearThrottle(snapshot: AuthSnapshot, key: string): AuthSnapshot {
  const throttles = { ...(snapshot.throttles ?? {}) }
  delete throttles[key]
  return { ...snapshot, throttles }
}

export async function consumeKvThrottle(
  kv: { get(key: string, type: "json"): Promise<unknown>; put(key: string, value: string): Promise<void> },
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
  bucket = "track:throttles"
) {
  const read = async () => {
    const raw = await kv.get(bucket, "json")
    return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, AuthThrottle>) : {}
  }
  const live = (map: Record<string, AuthThrottle>) =>
    Object.fromEntries(Object.entries(map).filter(([, item]) => item.resetAt > now))
  const throttles = await read()
  const gated = consumeThrottle({ users: [], sessions: [], resets: {}, throttles }, key, limit, windowMs, now)
  const next = live(gated.snapshot.throttles ?? {})
  const latest = await read()
  const merged = live(mergeThrottles(latest, next))
  await kv.put(bucket, JSON.stringify(merged))
  const verify = await read()
  const settled = live(mergeThrottles(verify, merged))
  if (JSON.stringify(settled) !== JSON.stringify(verify)) {
    await kv.put(bucket, JSON.stringify(settled))
  }
  return gated.ok
}

export function clientIp(request: Request) {
  const forwarded = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || ""
  return forwarded.split(",")[0]?.trim() || "local"
}

function prune(snapshot: AuthSnapshot, now = Date.now()): AuthSnapshot {
  const revoked = clipAuthTokens(snapshot.revoked, AUTH_REVOKED_CAP)
  const spentResets = clipAuthTokens(snapshot.spentResets, AUTH_SPENT_RESET_CAP)
  const drop = new Set(revoked)
  return {
    users: snapshot.users,
    sessions: snapshot.sessions.filter((item) => item.expiresAt > now && !drop.has(item.token)),
    resets: Object.fromEntries(
      Object.entries(snapshot.resets).filter(([token, item]) => item.expiresAt > now && !spentResets.includes(token))
    ),
    throttles: Object.fromEntries(Object.entries(snapshot.throttles ?? {}).filter(([, item]) => item.resetAt > now)),
    revoked,
    spentResets,
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
        passwordUpdatedAt: Date.now(),
      })
      changed = true
      continue
    }
    if (current.name !== operator.name) {
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

type AuthBody = {
  email?: string
  password?: string
  currentPassword?: string
  token?: string
}

async function readBody(request: Request): Promise<{ ok: true; body: AuthBody } | { ok: false; response: Response }> {
  const parsed = await readJsonObject<AuthBody>(request, 8_192)
  if (!parsed.ok) {
    return {
      ok: false,
      response: json({ error: parsed.status === 413 ? "Pedido demasiado grande." : "JSON inválido." }, parsed.status),
    }
  }
  return { ok: true, body: parsed.value }
}

export function retainUserSessions(sessions: Session[], userId: string, next: Session, cap = SESSION_CAP) {
  const others = sessions.filter((item) => item.userId !== userId)
  const mine = sessions
    .filter((item) => item.userId === userId)
    .sort((a, b) => b.issuedAt - a.issuedAt)
    .slice(0, Math.max(cap - 1, 0))
  return [...others, ...mine, next]
}

export async function sessionUser(request: Request, store: AuthStore) {
  const token = readCookie(request)
  if (!token) return null
  const snapshot = prune(await store.load())
  const session = snapshot.sessions.find((item) => item.token === token)
  const user = session ? snapshot.users.find((item) => item.id === session.userId) : null
  return user ? publicUser(user) : null
}

export async function handleAuth(request: Request, store: AuthStore, env?: { ABILION_OPERATOR_PASSWORD?: string; ABILION_ENV?: string }) {
  const url = new URL(request.url)
  const path = url.pathname
  const secure = url.protocol === "https:"
  if (env?.ABILION_OPERATOR_PASSWORD) {
    await ensureOperatorUsers(store, env.ABILION_OPERATOR_PASSWORD.trim())
  }

  if (path === "/api/auth/login" && request.method === "POST") {
    const parsed = await readBody(request)
    if (!parsed.ok) return parsed.response
    const body = parsed.body
    const email = (body.email || "").trim().toLowerCase()
    const password = body.password || ""
    if (!email || password.length < 6) {
      return json({ error: "Informe um e-mail e uma senha com 6+ caracteres." }, 400)
    }
    if (!isOperatorEmail(email)) {
      return json({ error: "E-mail ou senha inválidos." }, 401)
    }
    let snapshot = prune(await store.load())
    const guard = consumeThrottle(snapshot, `login:${clientIp(request)}:${email}`, 8, 15 * 60 * 1000)
    snapshot = guard.snapshot
    if (!guard.ok) {
      await store.save(snapshot)
      return json({ error: "Muitas tentativas. Espera uns minutos e tenta de novo." }, 429)
    }
    let user = snapshot.users.find((item) => item.email === email)
    if (!user) {
      user = {
        id: randomToken(8),
        email,
        name: operatorName(email),
        passwordHash: await hashPassword(password),
        createdAt: new Date().toISOString(),
        passwordUpdatedAt: Date.now(),
      }
      snapshot.users.push(user)
    } else if (!(await verifyPassword(password, user.passwordHash))) {
      await store.save(snapshot)
      return json({ error: "E-mail ou senha inválidos." }, 401)
    }
    const now = Date.now()
    const token = randomToken()
    snapshot = clearThrottle(snapshot, `login:${clientIp(request)}:${email}`)
    snapshot.sessions = retainUserSessions(snapshot.sessions, user.id, {
      token,
      userId: user.id,
      expiresAt: now + SESSION_TTL_MS,
      issuedAt: now,
    })
    await store.save(snapshot)
    return json({ user: publicUser(user) }, 200, { "set-cookie": cookieHeader(token, secure) })
  }

  if (path === "/api/auth/logout" && request.method === "POST") {
    const token = readCookie(request)
    const snapshot = prune(await store.load())
    if (token) snapshot.revoked = clipAuthTokens([token, ...(snapshot.revoked ?? [])], AUTH_REVOKED_CAP)
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
    const parsed = await readBody(request)
    if (!parsed.ok) return parsed.response
    const email = (parsed.body.email || "").trim().toLowerCase()
    if (!email) return json({ error: "Informe o e-mail." }, 400)
    let snapshot = prune(await store.load())
    const guard = consumeThrottle(snapshot, `forgot:${clientIp(request)}`, 5, 15 * 60 * 1000)
    snapshot = guard.snapshot
    if (!guard.ok) {
      await store.save(snapshot)
      return json({ error: "Muitas tentativas. Espera uns minutos e tenta de novo." }, 429)
    }
    const user = snapshot.users.find((item) => item.email === email)
    let resetToken = ""
    if (user) {
      for (const [key, rec] of Object.entries(snapshot.resets)) {
        if (rec.userId === user.id) delete snapshot.resets[key]
      }
      resetToken = randomToken()
      snapshot.resets[resetToken] = { userId: user.id, expiresAt: Date.now() + RESET_TTL_MS }
    }
    await store.save(snapshot)
    if (user && resetToken && env?.ABILION_ENV !== "production") {
      return json({ ok: true, resetPath: `/reset?token=${resetToken}` })
    }
    return json({ ok: true })
  }

  if (path === "/api/auth/password" && request.method === "POST") {
    const token = readCookie(request)
    let snapshot = prune(await store.load())
    const session = snapshot.sessions.find((item) => item.token === token)
    const user = session ? snapshot.users.find((item) => item.id === session.userId) : null
    if (!user) return json({ error: "Sessão expirada." }, 401)
    const guard = consumeThrottle(snapshot, `password:${clientIp(request)}:${user.id}`, 5, 15 * 60 * 1000)
    snapshot = guard.snapshot
    if (!guard.ok) {
      await store.save(snapshot)
      return json({ error: "Muitas tentativas. Espera uns minutos e tenta de novo." }, 429)
    }
    const parsed = await readBody(request)
    if (!parsed.ok) return parsed.response
    const body = parsed.body
    const currentPassword = body.currentPassword || ""
    const password = body.password || ""
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      await store.save(snapshot)
      return json({ error: "Senha atual inválida." }, 400)
    }
    if (password.length < 6) {
      await store.save(snapshot)
      return json({ error: "A nova senha precisa de 6+ caracteres." }, 400)
    }
    user.passwordHash = await hashPassword(password)
    user.passwordUpdatedAt = Date.now()
    snapshot = clearThrottle(snapshot, `password:${clientIp(request)}:${user.id}`)
    const dropped = snapshot.sessions.filter((item) => item.userId === user.id && item.token !== token)
    snapshot.revoked = clipAuthTokens([...dropped.map((item) => item.token), ...(snapshot.revoked ?? [])], AUTH_REVOKED_CAP)
    snapshot.sessions = snapshot.sessions.filter((item) => item.userId !== user.id || item.token === token)
    await store.save(snapshot)
    return json({ ok: true })
  }

  if (path === "/api/auth/reset" && request.method === "POST") {
    const parsed = await readBody(request)
    if (!parsed.ok) return parsed.response
    const body = parsed.body
    const token = body.token || ""
    const password = body.password || ""
    if (!token || password.length < 6) return json({ error: "Token ou senha inválidos." }, 400)
    let snapshot = prune(await store.load())
    const guard = consumeThrottle(snapshot, `reset:${clientIp(request)}`, 5, 15 * 60 * 1000)
    snapshot = guard.snapshot
    if (!guard.ok) {
      await store.save(snapshot)
      return json({ error: "Muitas tentativas. Espera uns minutos e tenta de novo." }, 429)
    }
    const rec = snapshot.resets[token]
    if (!rec) {
      await store.save(snapshot)
      return json({ error: "Link expirado ou inválido." }, 400)
    }
    const user = snapshot.users.find((item) => item.id === rec.userId)
    if (!user) {
      await store.save(snapshot)
      return json({ error: "Link expirado ou inválido." }, 400)
    }
    user.passwordHash = await hashPassword(password)
    user.passwordUpdatedAt = Date.now()
    const dropped = snapshot.sessions.filter((item) => item.userId === user.id)
    snapshot.revoked = clipAuthTokens([...dropped.map((item) => item.token), ...(snapshot.revoked ?? [])], AUTH_REVOKED_CAP)
    snapshot.spentResets = clipAuthTokens([token, ...(snapshot.spentResets ?? [])], AUTH_SPENT_RESET_CAP)
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
        throttles: value.throttles && typeof value.throttles === "object" ? value.throttles : {},
        revoked: clipAuthTokens(value.revoked, AUTH_REVOKED_CAP),
        spentResets: clipAuthTokens(value.spentResets, AUTH_SPENT_RESET_CAP),
      }
    },
    async save(next) {
      const current = await this.load()
      await kv.put("snapshot", JSON.stringify(mergeAuthSnapshots(current, next)))
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
