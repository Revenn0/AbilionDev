#!/usr/bin/env node
import { spawnSync } from "node:child_process"

const command = process.argv[2] ?? "build"
if (command !== "build" && command !== "deploy" && command !== "preview") {
  console.error(`opennext shim: unsupported command "${command}"`)
  process.exit(1)
}

const result = spawnSync("npx", ["vite", "build"], { stdio: "inherit", shell: false })
process.exit(result.status ?? 1)
