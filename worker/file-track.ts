import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import type { TrackEvent } from "../src/lib/track.ts"
import type { TrackStore } from "./track-store.ts"

export function fileTrackStore(file: string): TrackStore {
  const read = (): TrackEvent[] => {
    try {
      const raw = JSON.parse(readFileSync(file, "utf8")) as unknown
      return Array.isArray(raw) ? (raw as TrackEvent[]) : []
    } catch {
      return []
    }
  }
  return {
    async load() {
      return read()
    },
    async save(events: TrackEvent[]) {
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, JSON.stringify(events.slice(-4000)))
    },
  }
}
