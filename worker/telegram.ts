export type TelegramCallResult = {
  ok: boolean
  status: number
  retryable: boolean
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export async function telegramCall(
  token: string,
  method: string,
  body: Record<string, unknown>,
  fetchImpl: FetchLike = fetch as FetchLike,
  wait: (ms: number) => Promise<void> = sleep
): Promise<TelegramCallResult> {
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.status === 429 || res.status >= 500) {
        if (attempt === 2) {
          console.error("telegram falhou", method, res.status)
          return { ok: false, status: res.status, retryable: true }
        }
        const retryAfter = Number(res.headers.get("retry-after") ?? "1")
        await wait(Math.min(Math.max(Number.isFinite(retryAfter) ? retryAfter : 1, 1), 8) * 1000)
        continue
      }
      const data = (await res.json().catch(() => null)) as { ok?: boolean } | null
      if (!res.ok || data?.ok === false) {
        console.error("telegram recusou", method, res.status)
        return { ok: false, status: res.status || 400, retryable: false }
      }
      return { ok: true, status: res.status, retryable: false }
    }
    return { ok: false, status: 429, retryable: true }
  } catch {
    console.error("telegram sem rede", method)
    return { ok: false, status: 0, retryable: true }
  }
}
