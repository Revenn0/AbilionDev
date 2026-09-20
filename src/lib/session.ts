type Listener = () => void

const listeners = new Set<Listener>()
let expired = false

export function subscribeSessionExpired(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function noteSessionExpired() {
  if (expired) return false
  expired = true
  for (const listener of listeners) listener()
  return true
}

export function clearSessionExpired() {
  expired = false
}

export function noteUnauthorized(res: Pick<Response, "status">) {
  if (res.status === 401) return noteSessionExpired()
  return false
}
