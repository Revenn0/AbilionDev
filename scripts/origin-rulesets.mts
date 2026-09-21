/**
 * Aplica e verifica os rulesets Origin do plano de staging.
 *
 *   npx tsx scripts/origin-rulesets.mts            # cria os que faltam
 *   npx tsx scripts/origin-rulesets.mts verify     # sai 1 se faltar algum
 *   npx tsx scripts/origin-rulesets.mts list
 *
 * Specs em infra/origin-rulesets/*.json. Não pede bypass actor — só o
 * Victor aprova merges no main. Status checks ficam de fora até o Depot
 * devolver um check com id estável (ver docs/ambientes.md).
 */
import { execFileSync } from "node:child_process"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

type Spec = {
  name: string
  description?: string
  enforcement: string
  kind: string
  includedRefNames: string[]
  excludedRefNames?: string[]
  rules: Array<{ ruleType: string; type?: string; parameters?: Record<string, unknown> }>
  bypassActors?: unknown[]
}

type Listed = { id?: string; name?: string; kind?: string; enforcement?: string }

const ROOT = join(import.meta.dirname, "..")
const SPEC_DIR = join(ROOT, "infra/origin-rulesets")
const action = (process.argv[2] || "apply").trim()

function fail(message: string): never {
  console.error(`\n✘ ${message}\n`)
  process.exit(1)
}

function origin(args: string[], opts?: { ignoreFail?: boolean }) {
  try {
    return execFileSync("origin", args, { encoding: "utf8", cwd: ROOT }).trim()
  } catch (error) {
    if (opts?.ignoreFail) return ""
    const err = error as { stdout?: string; stderr?: string; status?: number }
    fail(err.stderr?.trim() || err.stdout?.trim() || (error instanceof Error ? error.message : String(error)))
  }
}

function loadSpecs(): Spec[] {
  return readdirSync(SPEC_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => JSON.parse(readFileSync(join(SPEC_DIR, name), "utf8")) as Spec)
}

function listRulesets(): Listed[] {
  const raw = origin(["ruleset", "list", "--json"], { ignoreFail: true })
  if (!raw) {
    const text = origin(["ruleset", "list"])
    if (/no rulesets/i.test(text)) return []
    fail(`Não percebi a lista de rulesets:\n${text}`)
  }
  const parsed = JSON.parse(raw) as Listed[] | { rulesets?: Listed[] }
  return Array.isArray(parsed) ? parsed : parsed.rulesets ?? []
}

function createFromSpec(spec: Spec) {
  const args = [
    "ruleset",
    "create",
    "--name",
    spec.name,
    "--description",
    spec.description || spec.name,
    "--enforcement",
    spec.enforcement,
    "--kind",
    spec.kind,
  ]
  for (const ref of spec.includedRefNames) args.push("--included-ref", ref)
  for (const ref of spec.excludedRefNames ?? []) args.push("--excluded-ref", ref)
  for (const rule of spec.rules) {
    const type = rule.ruleType || rule.type
    if (!type) fail(`${spec.name} tem uma regra sem ruleType`)
    const params = rule.parameters && Object.keys(rule.parameters).length ? JSON.stringify(rule.parameters) : ""
    args.push("--rule", params ? `${type}=${params}` : type)
  }
  args.push("--json")
  console.log(`$ origin ruleset create --name ${spec.name} --kind ${spec.kind}`)
  const out = origin(args)
  console.log(out)
}

const specs = loadSpecs()
if (!specs.length) fail("Não há specs em infra/origin-rulesets.")

if (action === "list") {
  const listed = listRulesets()
  if (!listed.length) {
    console.log("Nenhum ruleset no repositório.")
    process.exit(0)
  }
  for (const item of listed) {
    console.log(`${item.id ?? "—"}\t${item.name ?? "?"}\t${item.kind ?? "?"}\t${item.enforcement ?? "?"}`)
  }
  process.exit(0)
}

if (action !== "apply" && action !== "verify") {
  fail("uso: npx tsx scripts/origin-rulesets.mts [apply|verify|list]")
}

const listed = listRulesets()
const byName = new Map(listed.map((item) => [item.name, item]))
const missing = specs.filter((spec) => !byName.has(spec.name))

if (action === "verify") {
  if (missing.length) fail(`Faltam rulesets: ${missing.map((item) => item.name).join(", ")}`)
  for (const spec of specs) {
    const live = byName.get(spec.name)
    if (live?.kind && live.kind !== spec.kind) fail(`${spec.name} no Origin é ${live.kind}, a spec pede ${spec.kind}`)
    if (live?.enforcement && live.enforcement !== spec.enforcement) {
      fail(`${spec.name} no Origin está ${live.enforcement}, a spec pede ${spec.enforcement}`)
    }
  }
  console.log(`${specs.length} rulesets no sítio: ${specs.map((item) => item.name).join(", ")}`)
  process.exit(0)
}

if (!missing.length) {
  console.log(`Já estão os ${specs.length} rulesets: ${specs.map((item) => item.name).join(", ")}`)
  process.exit(0)
}

for (const spec of missing) createFromSpec(spec)
const after = listRulesets()
const still = specs.filter((spec) => !after.some((item) => item.name === spec.name))
if (still.length) fail(`Criei e ainda faltam: ${still.map((item) => item.name).join(", ")}`)
console.log(`✔ rulesets activos: ${specs.map((item) => item.name).join(", ")}`)
