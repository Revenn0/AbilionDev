import type { Lead } from "./types"

const COLS = ["id", "name", "contact", "channel", "campaign", "origin", "temperature", "stage", "createdAt", "updatedAt"] as const

export function csvCell(value: string) {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function leadsToCsv(leads: Lead[]) {
  const lines = [COLS.join(",")]
  for (const lead of leads) {
    lines.push(COLS.map((key) => csvCell(String(lead[key] ?? ""))).join(","))
  }
  return `${lines.join("\n")}\n`
}

export function downloadLeadsCsv(leads: Lead[]) {
  const blob = new Blob([leadsToCsv(leads)], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `abilion-leads-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
