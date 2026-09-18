import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import type { KvLike } from "./kv.ts"

function fileFor(dir: string, key: string) {
  return path.join(dir, `${key.replace(/:/g, "_")}.json`)
}

export function fileKv(dir: string): KvLike {
  mkdirSync(dir, { recursive: true })
  return {
    async get(key: string) {
      try {
        return JSON.parse(readFileSync(fileFor(dir, key), "utf8")) as unknown
      } catch {
        return null
      }
    },
    async put(key: string, value: string) {
      mkdirSync(dir, { recursive: true })
      writeFileSync(fileFor(dir, key), value)
    },
  }
}
