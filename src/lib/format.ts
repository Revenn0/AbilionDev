export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

export function timeAgo(iso: string) {
  const delta = Date.now() - new Date(iso).getTime()
  const minutes = Math.max(1, Math.round(delta / 60_000))
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `há ${hours} h`
  const days = Math.round(hours / 24)
  return `há ${days} d`
}

export function nameFromEmail(email: string) {
  const local = email.split("@")[0] ?? "Operador"
  return local
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function uid() {
  return crypto.randomUUID()
}
