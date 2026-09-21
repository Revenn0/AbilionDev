/**
 * Confere a forma do pipeline no repo: specs Origin, workflows Depot,
 * wrangler de staging sem Postgres de produção, e as guardas do deploy.
 */
import { execFileSync } from "node:child_process"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import assert from "node:assert/strict"

const ROOT = join(import.meta.dirname, "..")
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8")

type Spec = {
  name: string
  enforcement: string
  kind: string
  includedRefNames: string[]
  rules: Array<{ ruleType: string; parameters?: Record<string, unknown> }>
  bypassActors?: unknown[]
}

const specs = readdirSync(join(ROOT, "infra/origin-rulesets"))
  .filter((name) => name.endsWith(".json"))
  .sort()
  .map((name) => JSON.parse(read(join("infra/origin-rulesets", name))) as Spec)

assert.deepEqual(
  specs.map((item) => item.name).sort(),
  ["block-main-push", "keep-staging", "protect-main", "protect-staging"]
)

const mainMerge = specs.find((item) => item.name === "protect-main")!
assert.equal(mainMerge.kind, "merge_branch")
assert.deepEqual(mainMerge.includedRefNames, ["refs/heads/main"])
assert.equal(mainMerge.enforcement, "active")
assert.ok(mainMerge.rules.some((rule) => rule.ruleType === "pull_request" && rule.parameters?.requiredApprovingReviewCount === 1))
assert.ok(mainMerge.rules.some((rule) => rule.ruleType === "require_branch_up_to_date"))
assert.equal((mainMerge.bypassActors ?? []).length, 0)

const mainPush = specs.find((item) => item.name === "block-main-push")!
assert.equal(mainPush.kind, "push_branch")
assert.ok(mainPush.rules.some((rule) => rule.ruleType === "block_direct_updates"))
assert.ok(mainPush.rules.some((rule) => rule.ruleType === "deletion"))

const stagingMerge = specs.find((item) => item.name === "protect-staging")!
assert.equal(stagingMerge.kind, "merge_branch")
assert.deepEqual(stagingMerge.includedRefNames, ["refs/heads/staging"])
assert.ok(!stagingMerge.rules.some((rule) => rule.ruleType === "block_direct_updates"))

const stagingPush = specs.find((item) => item.name === "keep-staging")!
assert.ok(stagingPush.rules.some((rule) => rule.ruleType === "deletion"))
assert.ok(!stagingPush.rules.some((rule) => rule.ruleType === "block_direct_updates"))

const stagingWrangler = read("wrangler.staging.jsonc")
assert.match(stagingWrangler, /"name": "abilion-staging"/)
assert.doesNotMatch(stagingWrangler, /"SUPABASE_URL"\s*:/)
assert.match(stagingWrangler, /"ABILION_ENV": "staging"/)
assert.match(stagingWrangler, /99b7a6f2ce764741a37a5a1330f90cf6/)
assert.doesNotMatch(stagingWrangler, /65f62e24942345e8b46904f6743575d0/)

const prodWrangler = read("wrangler.jsonc")
assert.match(prodWrangler, /"name": "abilion"/)
assert.match(prodWrangler, /65f62e24942345e8b46904f6743575d0/)

for (const file of ["ci.yml", "deploy-staging.yml", "deploy-production.yml"]) {
  const yaml = read(join(".depot/workflows", file))
  assert.match(yaml, /depot-ubuntu-latest/)
  assert.doesNotMatch(yaml, /runs-on:\s*ubuntu-latest/)
}
assert.match(read(".depot/workflows/deploy-production.yml"), /--approved "\$\{\{ github\.sha \}\}"/)
assert.match(read(".github/workflows/deploy-production.yml"), /--approved "\$\{\{ github\.sha \}\}"/)

const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> }
assert.equal(pkg.scripts.deploy, "npm run deploy:staging")
assert.ok(pkg.scripts["deploy:prod"].includes("scripts/deploy.mts production"))
assert.ok(pkg.scripts["origin:rulesets"].includes("origin-rulesets.mts"))
assert.ok(pkg.scripts["promote:check"].includes("promote-check.mts"))

const deploy = read("scripts/deploy.mts")
assert.match(deploy, /target === "production"/)
assert.match(deploy, /--approved/)
assert.match(deploy, /stagingTree !== headTree/)

function spawn(args: string[]) {
  try {
    execFileSync("npx", ["tsx", ...args], { encoding: "utf8", cwd: ROOT })
    return { status: 0, out: "" }
  } catch (error) {
    const err = error as { status?: number; stdout?: string; stderr?: string }
    return { status: err.status ?? 1, out: `${err.stdout ?? ""}${err.stderr ?? ""}` }
  }
}

const usage = spawn(["scripts/deploy.mts"])
assert.equal(usage.status, 2, "deploy sem alvo sai 2")

const prodFromFeature = spawn(["scripts/deploy.mts", "production", "--approved", "deadbeef"])
assert.notEqual(prodFromFeature.status, 0, "produção fora do main recusa")
assert.match(prodFromFeature.out, /Produção só sobe a partir|árvore tem alterações|commit aprovado/)

const reset = read("scripts/staging-reset.mts")
assert.match(reset, /99b7a6f2ce764741a37a5a1330f90cf6/)
assert.match(reset, /65f62e24942345e8b46904f6743575d0/)

const stagingSql = read("supabase/staging.sql")
assert.match(stagingSql, /create table if not exists public.leads/)
assert.match(stagingSql, /create table if not exists public.page_events/)
assert.match(stagingSql, /Nunca corras isto no Postgres de produção/)

console.log("pipeline-flow ok")
