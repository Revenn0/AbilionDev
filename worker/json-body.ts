export type JsonOk<T> = { ok: true; value: T }
export type JsonFail = { ok: false; status: 400 | 413 }
export type JsonRead<T> = JsonOk<T> | JsonFail

export async function readJsonObject<T extends Record<string, unknown>>(
  request: Request,
  limit: number
): Promise<JsonOk<T> | { ok: false; status: 413 }> {
  const text = await request.text()
  if (text.length > limit) return { ok: false, status: 413 }
  if (!text.trim()) return { ok: true, value: {} as T }
  try {
    const value = JSON.parse(text) as unknown
    if (!value || typeof value !== "object") return { ok: true, value: {} as T }
    return { ok: true, value: value as T }
  } catch {
    return { ok: true, value: {} as T }
  }
}

export async function readJsonStrict(request: Request, limit: number): Promise<JsonRead<Record<string, unknown>>> {
  const text = await request.text()
  if (text.length > limit) return { ok: false, status: 413 }
  try {
    const value = JSON.parse(text) as unknown
    if (!value || typeof value !== "object") return { ok: false, status: 400 }
    return { ok: true, value: value as Record<string, unknown> }
  } catch {
    return { ok: false, status: 400 }
  }
}
