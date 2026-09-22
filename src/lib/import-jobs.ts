/**
 * Pipeline puro para importações do CRM.
 *
 * Não lê ficheiros, não usa relógio, não gera UUIDs e não grava dados. O
 * chamador pode persistir `ImportJob` como JSON e usar cada
 * `idempotencyKey` no backend ao escrever uma linha.
 */

export const IMPORT_JOB_VERSION = 1 as const
export const DEFAULT_IMPORT_BATCH_SIZE = 50
export const MAX_IMPORT_BATCH_SIZE = 500
export const DEFAULT_IMPORT_PREVIEW_SIZE = 20

export type ImportMappedValue = string | string[]
export type ImportMappedRecord = Record<string, ImportMappedValue>
export type ImportSourceRecord = Readonly<Record<string, unknown>>
export type ImportMapping = Readonly<Record<string, string | null | undefined>>

export type ImportIssueCode =
  | "empty_input"
  | "missing_headers"
  | "empty_header"
  | "duplicate_header"
  | "column_count"
  | "unclosed_quote"
  | "missing_mapping"
  | "unknown_source_column"
  | "duplicate_target"
  | "missing_required"
  | "missing_identity"
  | "duplicate_source"
  | "duplicate_existing"
  | "invalid_job"
  | "write_failed"

export type ImportIssue = {
  code: ImportIssueCode
  message: string
  severity: "error" | "warning"
  rowNumber?: number
  field?: string
}

export type ParsedImportRow = {
  sourceIndex: number
  rowNumber: number
  values: Record<string, string>
}

export type ParsedImport = {
  delimiter: string
  headers: string[]
  rows: ParsedImportRow[]
  issues: ImportIssue[]
}

export type ParseDelimitedImportOptions = {
  delimiter?: "," | ";" | "\t"
  hasHeader?: boolean
  headers?: readonly string[]
}

export type ImportMappingValidation = {
  ok: boolean
  mapping: Record<string, string>
  issues: ImportIssue[]
}

export type ImportPreviewDisposition = "ready" | "duplicate" | "invalid"

export type ImportPreviewRow = {
  sourceIndex: number
  rowNumber: number
  data: ImportMappedRecord
  identities: string[]
  idempotencyKey: string
  disposition: ImportPreviewDisposition
  duplicateOf?: number | "existing"
  issues: ImportIssue[]
}

export type ImportPreview = {
  fingerprint: string
  mapping: Record<string, string>
  rows: ImportPreviewRow[]
  sample: ImportPreviewRow[]
  totalRows: number
  readyRows: number
  duplicateRows: number
  invalidRows: number
  issues: ImportIssue[]
}

export type CreateImportPreviewOptions = {
  headers?: readonly string[]
  requiredFields?: readonly string[]
  identityFields?: readonly string[]
  constants?: Readonly<Record<string, unknown>>
  existingIdentities?: readonly string[]
  existingRecords?: readonly ImportSourceRecord[]
  requireIdentity?: boolean
  sampleSize?: number
}

export type ImportJobStatus = "ready" | "running" | "paused" | "completed" | "failed"
export type ImportJobRowStatus = "pending" | "processing" | "imported" | "duplicate" | "invalid" | "failed"

export type ImportJobRow = ImportPreviewRow & {
  status: ImportJobRowStatus
  attempts: number
  batchId?: string
  error?: string
  retryable?: boolean
}

export type ImportJob = {
  version: typeof IMPORT_JOB_VERSION
  id: string
  sourceFingerprint: string
  status: ImportJobStatus
  mapping: Record<string, string>
  batchSize: number
  rows: ImportJobRow[]
  createdAt?: string
  updatedAt?: string
}

export type CreateImportJobOptions = {
  id?: string
  batchSize?: number
  createdAt?: string
}

export type ImportBatch = {
  batchId: string
  jobId: string
  rows: Array<{
    sourceIndex: number
    rowNumber: number
    data: ImportMappedRecord
    idempotencyKey: string
    attempt: number
  }>
}

export type ClaimImportBatchResult =
  | {
      ok: true
      job: ImportJob
      batch: ImportBatch
    }
  | {
      ok: false
      job: ImportJob
      error: string
    }

export type ImportRowOutcome = {
  idempotencyKey: string
  status: "imported" | "duplicate" | "failed"
  error?: string
  retryable?: boolean
}

export type CompleteImportBatchResult =
  | {
      ok: true
      job: ImportJob
    }
  | {
      ok: false
      job: ImportJob
      error: string
    }

export type ImportReportFailure = {
  rowNumber: number
  idempotencyKey: string
  attempts: number
  error: string
  retryable: boolean
}

export type ImportReport = {
  jobId: string
  status: ImportJobStatus
  total: number
  pending: number
  processing: number
  imported: number
  duplicates: number
  invalid: number
  failed: number
  attempted: number
  processed: number
  remaining: number
  failures: ImportReportFailure[]
}

export type RestoreImportJobResult =
  | { ok: true; job: ImportJob }
  | { ok: false; error: string }

const DEFAULT_REQUIRED_FIELDS = ["contact"] as const
const DEFAULT_IDENTITY_FIELDS = ["contact", "email", "phone"] as const
const TERMINAL_ROW_STATUSES = new Set<ImportJobRowStatus>(["imported", "duplicate", "invalid"])

const LEAD_FIELD_ALIASES: Readonly<Record<string, readonly string[]>> = {
  name: ["name", "nome", "nome completo", "full name"],
  contact: ["contact", "contacto", "contato", "telefone", "phone", "whatsapp", "telegram", "username"],
  email: ["email", "e-mail", "mail"],
  phone: ["phone", "telefone", "telemovel", "telemóvel", "celular", "mobile"],
  campaign: ["campaign", "campanha", "utm campaign", "utm_campaign"],
  notes: ["notes", "note", "notas", "observacoes", "observações"],
  temperature: ["temperature", "temperatura"],
  groupIds: ["groupids", "group ids", "grupos", "groups"],
}

function normalizedText(value: unknown) {
  if (typeof value === "string") return value.normalize("NFKC").trim()
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  if (typeof value === "boolean") return value ? "true" : "false"
  return ""
}

function normalizedKey(value: unknown) {
  return normalizedText(value).replace(/\s+/g, " ").toLocaleLowerCase("pt-BR")
}

function cleanMappedValue(value: unknown): ImportMappedValue {
  if (Array.isArray(value)) {
    const seen = new Set<string>()
    const values: string[] = []
    for (const item of value) {
      const text = normalizedText(item)
      const key = normalizedKey(text)
      if (!text || seen.has(key)) continue
      seen.add(key)
      values.push(text)
    }
    return values
  }
  return normalizedText(value)
}

function valueIsBlank(value: ImportMappedValue | undefined) {
  return value === undefined || (Array.isArray(value) ? value.length === 0 : !value.trim())
}

function stableValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableValue).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableValue(item)}`)
      .join(",")}}`
  }
  return JSON.stringify(value) ?? "null"
}

function stableHash(value: string) {
  let hash = 0xcbf29ce484222325n
  for (const character of value) {
    hash ^= BigInt(character.codePointAt(0) ?? 0)
    hash = BigInt.asUintN(64, hash * 0x100000001b3n)
  }
  return hash.toString(36)
}

function positiveInteger(value: unknown, fallback: number, maximum: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback
  return Math.min(maximum, Math.max(1, Math.trunc(value)))
}

function cleanTimestamp(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function issue(
  code: ImportIssueCode,
  message: string,
  severity: ImportIssue["severity"],
  context: Pick<ImportIssue, "rowNumber" | "field"> = {}
): ImportIssue {
  return { code, message, severity, ...context }
}

function detectDelimiter(input: string) {
  const counts = new Map<string, number>([
    [",", 0],
    [";", 0],
    ["\t", 0],
  ])
  let quoted = false
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]
    if (character === '"') {
      if (quoted && input[index + 1] === '"') {
        index += 1
      } else {
        quoted = !quoted
      }
      continue
    }
    if (!quoted && (character === "\n" || character === "\r")) break
    if (!quoted && character && counts.has(character)) {
      counts.set(character, (counts.get(character) ?? 0) + 1)
    }
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || ","
}

function parseDelimitedRecords(input: string, delimiter: string) {
  const records: Array<{ rowNumber: number; cells: string[] }> = []
  let cells: string[] = []
  let cell = ""
  let quoted = false
  let line = 1
  let recordLine = 1
  let unclosedQuote = false

  const pushRecord = () => {
    cells.push(cell)
    records.push({ rowNumber: recordLine, cells })
    cells = []
    cell = ""
    recordLine = line
  }

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index] ?? ""
    if (character === '"') {
      if (quoted && input[index + 1] === '"') {
        cell += '"'
        index += 1
      } else if (quoted || cell.length === 0) {
        quoted = !quoted
      } else {
        cell += character
      }
      continue
    }

    if (quoted && (character === "\r" || character === "\n")) {
      if (character === "\r" && input[index + 1] === "\n") index += 1
      cell += "\n"
      line += 1
      continue
    }
    if (!quoted && character === delimiter) {
      cells.push(cell)
      cell = ""
      continue
    }
    if (!quoted && (character === "\r" || character === "\n")) {
      if (character === "\r" && input[index + 1] === "\n") index += 1
      pushRecord()
      line += 1
      recordLine = line
      continue
    }
    cell += character
  }

  if (quoted) unclosedQuote = true
  if (cell.length > 0 || cells.length > 0) pushRecord()
  return { records, unclosedQuote }
}

/**
 * Parser CSV/TSV pequeno, incluindo aspas escapadas e quebras de linha dentro
 * de células. Linhas vazias são ignoradas e os números originais são mantidos.
 */
export function parseDelimitedImport(raw: string, options: ParseDelimitedImportOptions = {}): ParsedImport {
  const input = String(raw ?? "").replace(/^\uFEFF/, "")
  const delimiter = options.delimiter ?? detectDelimiter(input)
  const parsed = parseDelimitedRecords(input, delimiter)
  const issues: ImportIssue[] = []
  const nonEmpty = parsed.records.filter((record) => record.cells.some((cell) => cell.trim()))

  if (parsed.unclosedQuote) {
    issues.push(issue("unclosed_quote", "Há uma célula com aspas por fechar.", "error"))
  }
  if (!nonEmpty.length) {
    issues.push(issue("empty_input", "O ficheiro não contém linhas para importar.", "error"))
    return { delimiter, headers: [], rows: [], issues }
  }

  const hasHeader = options.hasHeader !== false
  const suppliedHeaders = (options.headers ?? []).map(normalizedText)
  const headerRecord = hasHeader ? nonEmpty[0] : undefined
  const headers = (hasHeader ? headerRecord?.cells ?? [] : suppliedHeaders).map(normalizedText)

  if (!headers.length) {
    issues.push(issue("missing_headers", "Informa os nomes das colunas para mapear a importação.", "error"))
    return { delimiter, headers: [], rows: [], issues }
  }

  const seenHeaders = new Set<string>()
  headers.forEach((header, index) => {
    const field = header || `#${index + 1}`
    if (!header) {
      issues.push(issue("empty_header", `A coluna ${index + 1} não tem nome.`, "error", { field }))
      return
    }
    const key = normalizedKey(header)
    if (seenHeaders.has(key)) {
      issues.push(issue("duplicate_header", `A coluna "${header}" aparece mais de uma vez.`, "error", { field: header }))
      return
    }
    seenHeaders.add(key)
  })

  const dataRecords = hasHeader ? nonEmpty.slice(1) : nonEmpty
  const rows = dataRecords.map((record, sourceIndex) => {
    if (record.cells.length !== headers.length) {
      issues.push(
        issue(
          "column_count",
          `A linha ${record.rowNumber} tem ${record.cells.length} colunas; eram esperadas ${headers.length}.`,
          "error",
          { rowNumber: record.rowNumber }
        )
      )
    }
    const values: Record<string, string> = {}
    headers.forEach((header, index) => {
      if (header && !Object.hasOwn(values, header)) values[header] = normalizedText(record.cells[index] ?? "")
    })
    return { sourceIndex, rowNumber: record.rowNumber, values }
  })

  return { delimiter, headers, rows, issues }
}

export function validateImportMapping(
  headersInput: readonly string[],
  input: ImportMapping,
  requiredTargets: readonly string[] = DEFAULT_REQUIRED_FIELDS
): ImportMappingValidation {
  const issues: ImportIssue[] = []
  const headers = headersInput.map(normalizedText).filter(Boolean)
  const headerByKey = new Map(headers.map((header) => [normalizedKey(header), header]))
  const mapping: Record<string, string> = {}
  const targets = new Set<string>()

  for (const [rawTarget, rawSource] of Object.entries(input)) {
    const target = normalizedText(rawTarget)
    const source = normalizedText(rawSource)
    if (!target || !source) continue

    const targetKey = normalizedKey(target)
    if (targets.has(targetKey)) {
      issues.push(issue("duplicate_target", `O campo "${target}" foi mapeado mais de uma vez.`, "error", { field: target }))
      continue
    }
    targets.add(targetKey)

    const canonicalSource = headerByKey.get(normalizedKey(source))
    if (!canonicalSource) {
      issues.push(
        issue("unknown_source_column", `A coluna "${source}" não existe no ficheiro.`, "error", { field: target })
      )
      continue
    }
    mapping[target] = canonicalSource
  }

  for (const required of requiredTargets) {
    const target = normalizedText(required)
    if (!target) continue
    const found = Object.keys(mapping).some((mapped) => normalizedKey(mapped) === normalizedKey(target))
    if (!found) {
      issues.push(issue("missing_mapping", `Mapeia o campo obrigatório "${target}".`, "error", { field: target }))
    }
  }

  return { ok: !issues.some((item) => item.severity === "error"), mapping, issues }
}

/**
 * Sugere um mapeamento sem substituir escolhas do utilizador. A comparação de
 * cabeçalhos e aliases ignora caixa e espaços.
 */
export function inferLeadImportMapping(headersInput: readonly string[]) {
  const headers = headersInput.map(normalizedText).filter(Boolean)
  const byKey = new Map(headers.map((header) => [normalizedKey(header), header]))
  const mapping: Record<string, string> = {}

  for (const [target, aliases] of Object.entries(LEAD_FIELD_ALIASES)) {
    const source = aliases.map((alias) => byKey.get(normalizedKey(alias))).find(Boolean)
    if (source) mapping[target] = source
  }
  return mapping
}

export const autoMapImportColumns = inferLeadImportMapping

function sourceValues(row: ParsedImportRow | ImportSourceRecord) {
  return "values" in row && row.values && typeof row.values === "object"
    ? row.values
    : (row as ImportSourceRecord)
}

export function applyImportMapping(
  row: ParsedImportRow | ImportSourceRecord,
  mapping: ImportMapping,
  constants: Readonly<Record<string, unknown>> = {}
): ImportMappedRecord {
  const values = sourceValues(row)
  const sourceByKey = new Map(Object.keys(values).map((key) => [normalizedKey(key), key]))
  const mapped: ImportMappedRecord = {}

  for (const [rawTarget, rawSource] of Object.entries(mapping)) {
    const target = normalizedText(rawTarget)
    const source = normalizedText(rawSource)
    if (!target || !source) continue
    const actualSource = sourceByKey.get(normalizedKey(source))
    mapped[target] = cleanMappedValue(actualSource ? values[actualSource] : "")
  }
  for (const [rawTarget, value] of Object.entries(constants)) {
    const target = normalizedText(rawTarget)
    if (target) mapped[target] = cleanMappedValue(value)
  }
  return mapped
}

export function mapImportRows(
  rows: readonly (ParsedImportRow | ImportSourceRecord)[],
  mapping: ImportMapping,
  constants: Readonly<Record<string, unknown>> = {}
) {
  return rows.map((row) => applyImportMapping(row, mapping, constants))
}

export function normalizeImportIdentity(value: unknown) {
  const text = normalizedText(value)
  if (!text) return ""
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text)) return text.toLocaleLowerCase("pt-BR")
  if (/^@/.test(text) || /^tg:/i.test(text)) return text.toLocaleLowerCase("pt-BR")
  const digits = text.replace(/\D/g, "")
  if (digits.length >= 7 && /^[+\d\s().-]+$/.test(text)) return digits
  return normalizedKey(text)
}

export function importRecordIdentities(
  record: ImportSourceRecord,
  identityFields: readonly string[] = DEFAULT_IDENTITY_FIELDS
) {
  const fieldByKey = new Map(Object.keys(record).map((field) => [normalizedKey(field), field]))
  const identities: string[] = []
  const seen = new Set<string>()

  for (const requestedField of identityFields) {
    const actualField = fieldByKey.get(normalizedKey(requestedField))
    if (!actualField) continue
    const rawValue = record[actualField]
    const values = Array.isArray(rawValue) ? rawValue : [rawValue]
    for (const value of values) {
      const normalized = normalizeImportIdentity(value)
      if (!normalized) continue
      const identity = `${normalizedKey(requestedField)}:${normalized}`
      if (seen.has(identity)) continue
      seen.add(identity)
      identities.push(identity)
    }
  }
  return identities
}

export function fingerprintImportSource(value: unknown) {
  return stableHash(stableValue(value))
}

function sourceCoordinates(row: ParsedImportRow | ImportSourceRecord, index: number) {
  if ("values" in row && typeof row.sourceIndex === "number" && typeof row.rowNumber === "number") {
    return { sourceIndex: row.sourceIndex, rowNumber: row.rowNumber }
  }
  return { sourceIndex: index, rowNumber: index + 1 }
}

function existingIdentitySet(options: CreateImportPreviewOptions) {
  const identities = new Set<string>()
  for (const identity of options.existingIdentities ?? []) {
    const clean = normalizedText(identity)
    if (clean) identities.add(clean.includes(":") ? normalizedKey(clean) : normalizeImportIdentity(clean))
  }
  for (const record of options.existingRecords ?? []) {
    for (const identity of importRecordIdentities(record, options.identityFields)) identities.add(identity)
  }
  return identities
}

/**
 * Mapeia, valida e classifica todas as linhas. `sample` limita apenas o que a
 * interface mostra; `rows` continua completo para criar um job sem reler o
 * ficheiro.
 */
export function createImportPreview(
  rows: readonly (ParsedImportRow | ImportSourceRecord)[],
  mappingInput: ImportMapping,
  options: CreateImportPreviewOptions = {}
): ImportPreview {
  const firstValues = rows[0] ? sourceValues(rows[0]) : {}
  const headers = options.headers ?? Object.keys(firstValues)
  const requiredFields = options.requiredFields ?? DEFAULT_REQUIRED_FIELDS
  const identityFields = options.identityFields ?? DEFAULT_IDENTITY_FIELDS
  const validation = validateImportMapping(headers, mappingInput, requiredFields)
  const existing = existingIdentitySet({ ...options, identityFields })
  const seen = new Map<string, number>()
  const mappedRows = rows.map((row) => applyImportMapping(row, validation.mapping, options.constants))
  const fingerprint = fingerprintImportSource(mappedRows)

  const previewRows = mappedRows.map((data, index): ImportPreviewRow => {
    const coordinates = sourceCoordinates(rows[index] ?? {}, index)
    const rowIssues: ImportIssue[] = []

    if (!validation.ok) {
      rowIssues.push(
        issue("missing_mapping", "O mapeamento precisa de ser corrigido antes da importação.", "error", {
          rowNumber: coordinates.rowNumber,
        })
      )
    }
    for (const field of requiredFields) {
      const actualField = Object.keys(data).find((key) => normalizedKey(key) === normalizedKey(field))
      if (!actualField || valueIsBlank(data[actualField])) {
        rowIssues.push(
          issue("missing_required", `A linha não tem o campo obrigatório "${field}".`, "error", {
            rowNumber: coordinates.rowNumber,
            field,
          })
        )
      }
    }

    const identities = importRecordIdentities(data, identityFields)
    if (options.requireIdentity !== false && !identities.length) {
      rowIssues.push(
        issue("missing_identity", "A linha não tem contacto utilizável para deduplicação.", "error", {
          rowNumber: coordinates.rowNumber,
        })
      )
    }

    const existingMatch = identities.find((identity) => existing.has(identity))
    const sourceMatch = identities.map((identity) => seen.get(identity)).find((value) => value !== undefined)
    let duplicateOf: ImportPreviewRow["duplicateOf"]
    if (!rowIssues.length && existingMatch) {
      duplicateOf = "existing"
      rowIssues.push(
        issue("duplicate_existing", "Este contacto já existe no CRM.", "warning", {
          rowNumber: coordinates.rowNumber,
        })
      )
    } else if (!rowIssues.length && sourceMatch !== undefined) {
      duplicateOf = sourceMatch
      rowIssues.push(
        issue("duplicate_source", `Este contacto repete a linha ${sourceMatch}.`, "warning", {
          rowNumber: coordinates.rowNumber,
        })
      )
    }

    if (!duplicateOf && !rowIssues.some((item) => item.severity === "error")) {
      for (const identity of identities) seen.set(identity, coordinates.rowNumber)
    }

    const hasError = rowIssues.some((item) => item.severity === "error")
    const disposition: ImportPreviewDisposition = hasError ? "invalid" : duplicateOf ? "duplicate" : "ready"
    const identitySeed = identities.slice().sort().join("|") || stableValue(data)
    return {
      ...coordinates,
      data,
      identities,
      idempotencyKey: `import-row:${stableHash(identitySeed)}`,
      disposition,
      ...(duplicateOf ? { duplicateOf } : {}),
      issues: rowIssues,
    }
  })

  const sampleSize = positiveInteger(options.sampleSize, DEFAULT_IMPORT_PREVIEW_SIZE, 100)
  return {
    fingerprint,
    mapping: validation.mapping,
    rows: previewRows,
    sample: previewRows.slice(0, sampleSize),
    totalRows: previewRows.length,
    readyRows: previewRows.filter((row) => row.disposition === "ready").length,
    duplicateRows: previewRows.filter((row) => row.disposition === "duplicate").length,
    invalidRows: previewRows.filter((row) => row.disposition === "invalid").length,
    issues: validation.issues,
  }
}

export const previewImport = createImportPreview

export function deduplicateImportRows<T extends ImportSourceRecord>(
  rows: readonly T[],
  options: Pick<CreateImportPreviewOptions, "identityFields" | "existingIdentities" | "existingRecords"> = {}
) {
  const existing = existingIdentitySet(options)
  const seen = new Map<string, number>()
  const unique: T[] = []
  const duplicates: Array<{ index: number; row: T; duplicateOf: number | "existing" }> = []

  rows.forEach((row, index) => {
    const identities = importRecordIdentities(row, options.identityFields)
    const exists = identities.some((identity) => existing.has(identity))
    const sourceIndex = identities.map((identity) => seen.get(identity)).find((value) => value !== undefined)
    if (exists || sourceIndex !== undefined) {
      duplicates.push({ index, row, duplicateOf: exists ? "existing" : (sourceIndex ?? 0) })
      return
    }
    identities.forEach((identity) => seen.set(identity, index))
    unique.push(row)
  })
  return { unique, duplicates }
}

export const dedupeImportRows = deduplicateImportRows

function statusFromRows(rows: readonly ImportJobRow[], preferred?: ImportJobStatus): ImportJobStatus {
  const pending = rows.some((row) => row.status === "pending")
  const processing = rows.some((row) => row.status === "processing")
  const failed = rows.some((row) => row.status === "failed")
  if (preferred === "paused" && (pending || processing || failed)) return "paused"
  if (processing) return "running"
  if (pending) return preferred === "running" ? "running" : "ready"
  if (failed) return "failed"
  return "completed"
}

function withUpdatedAt<T extends ImportJob>(job: T, updatedAt?: string): T {
  const clean = cleanTimestamp(updatedAt)
  return clean ? { ...job, updatedAt: clean } : job
}

export function createImportJob(preview: ImportPreview, options: CreateImportJobOptions = {}): ImportJob {
  const id = normalizedText(options.id) || `import:${preview.fingerprint}`
  const rows: ImportJobRow[] = preview.rows.map((row) => ({
    ...row,
    status: row.disposition === "ready" ? "pending" : row.disposition,
    attempts: 0,
  }))
  const createdAt = cleanTimestamp(options.createdAt)
  return {
    version: IMPORT_JOB_VERSION,
    id,
    sourceFingerprint: preview.fingerprint,
    status: statusFromRows(rows),
    mapping: { ...preview.mapping },
    batchSize: positiveInteger(options.batchSize, DEFAULT_IMPORT_BATCH_SIZE, MAX_IMPORT_BATCH_SIZE),
    rows,
    ...(createdAt ? { createdAt, updatedAt: createdAt } : {}),
  }
}

export function startImportJob(job: ImportJob, updatedAt?: string): ImportJob {
  if (job.status === "completed") return job
  return withUpdatedAt({ ...job, status: statusFromRows(job.rows, "running") }, updatedAt)
}

export function pauseImportJob(job: ImportJob, updatedAt?: string): ImportJob {
  if (job.status === "completed") return job
  return withUpdatedAt({ ...job, status: "paused" }, updatedAt)
}

export function resumeImportJob(
  job: ImportJob,
  options: { maxAttempts?: number; updatedAt?: string } = {}
): ImportJob {
  const maxAttempts = positiveInteger(options.maxAttempts, 3, 100)
  const rows = job.rows.map((row): ImportJobRow => {
    if (row.status === "processing") {
      return { ...row, status: "pending", batchId: undefined, retryable: undefined }
    }
    if (row.status === "failed" && row.retryable && row.attempts < maxAttempts) {
      return { ...row, status: "pending", batchId: undefined, error: undefined, retryable: undefined }
    }
    return row
  })
  return withUpdatedAt({ ...job, rows, status: statusFromRows(rows) }, options.updatedAt)
}

export function nextImportBatch(job: ImportJob, limit = job.batchSize) {
  const size = positiveInteger(limit, job.batchSize, MAX_IMPORT_BATCH_SIZE)
  return job.rows
    .filter((row) => row.status === "pending")
    .slice(0, size)
    .map((row) => ({
      sourceIndex: row.sourceIndex,
      rowNumber: row.rowNumber,
      data: row.data,
      idempotencyKey: row.idempotencyKey,
      attempt: row.attempts + 1,
    }))
}

/**
 * Reserva um lote de forma atómica. Repetir a chamada com o mesmo `batchId`
 * devolve a mesma reserva sem incrementar tentativas.
 */
export function claimImportBatch(
  job: ImportJob,
  input: { batchId: string; limit?: number; updatedAt?: string }
): ClaimImportBatchResult {
  const batchId = normalizedText(input.batchId)
  if (!batchId) return { ok: false, job, error: "O lote precisa de um identificador." }
  if (job.status === "paused") return { ok: false, job, error: "A importação está pausada." }
  if (job.status === "completed") return { ok: false, job, error: "A importação já terminou." }

  const claimed = job.rows.filter((row) => row.status === "processing" && row.batchId === batchId)
  if (claimed.length) {
    return {
      ok: true,
      job,
      batch: {
        batchId,
        jobId: job.id,
        rows: claimed.map((row) => ({
          sourceIndex: row.sourceIndex,
          rowNumber: row.rowNumber,
          data: row.data,
          idempotencyKey: row.idempotencyKey,
          attempt: row.attempts,
        })),
      },
    }
  }

  const pending = nextImportBatch(job, input.limit)
  const keys = new Set(pending.map((row) => row.idempotencyKey))
  const rows = job.rows.map((row): ImportJobRow => {
    if (row.status !== "pending" || !keys.has(row.idempotencyKey)) return row
    return {
      ...row,
      status: "processing",
      attempts: row.attempts + 1,
      batchId,
      error: undefined,
      retryable: undefined,
    }
  })
  const nextJob = withUpdatedAt({ ...job, rows, status: statusFromRows(rows, "running") }, input.updatedAt)
  return {
    ok: true,
    job: nextJob,
    batch: { batchId, jobId: job.id, rows: pending },
  }
}

function validOutcomeStatus(value: string): value is ImportRowOutcome["status"] {
  return value === "imported" || value === "duplicate" || value === "failed"
}

/**
 * Confirma resultados por chave idempotente. O lote é validado por completo
 * antes da alteração; chaves desconhecidas não produzem confirmação parcial.
 */
export function completeImportBatch(
  job: ImportJob,
  batchIdInput: string,
  outcomes: readonly ImportRowOutcome[],
  updatedAt?: string
): CompleteImportBatchResult {
  const batchId = normalizedText(batchIdInput)
  if (!batchId) return { ok: false, job, error: "O lote precisa de um identificador." }

  const outcomeByKey = new Map<string, ImportRowOutcome>()
  for (const outcome of outcomes) {
    const key = normalizedText(outcome.idempotencyKey)
    if (!key || outcomeByKey.has(key)) {
      return { ok: false, job, error: "O resultado contém chaves idempotentes vazias ou repetidas." }
    }
    if (!validOutcomeStatus(outcome.status)) {
      return { ok: false, job, error: "O resultado contém um estado desconhecido." }
    }
    const row = job.rows.find((item) => item.idempotencyKey === key)
    const replay = row && TERMINAL_ROW_STATUSES.has(row.status)
    if (!row || (!replay && (row.status !== "processing" || row.batchId !== batchId))) {
      return { ok: false, job, error: `A linha "${key}" não pertence a este lote.` }
    }
    outcomeByKey.set(key, { ...outcome, idempotencyKey: key })
  }

  const rows = job.rows.map((row): ImportJobRow => {
    const outcome = outcomeByKey.get(row.idempotencyKey)
    if (!outcome || TERMINAL_ROW_STATUSES.has(row.status)) return row
    if (outcome.status === "imported") {
      return { ...row, status: "imported", batchId: undefined, error: undefined, retryable: undefined }
    }
    if (outcome.status === "duplicate") {
      return {
        ...row,
        status: "duplicate",
        disposition: "duplicate",
        duplicateOf: row.duplicateOf ?? "existing",
        batchId: undefined,
        error: undefined,
        retryable: undefined,
      }
    }
    return {
      ...row,
      status: "failed",
      batchId: undefined,
      error: normalizedText(outcome.error) || "A linha não foi gravada.",
      retryable: Boolean(outcome.retryable),
      issues: [
        ...row.issues.filter((item) => item.code !== "write_failed"),
        issue("write_failed", normalizedText(outcome.error) || "A linha não foi gravada.", "error", {
          rowNumber: row.rowNumber,
        }),
      ],
    }
  })

  const preferred = job.status === "paused" ? "paused" : "running"
  const next = withUpdatedAt({ ...job, rows, status: statusFromRows(rows, preferred) }, updatedAt)
  return { ok: true, job: next }
}

export function releaseImportBatch(
  job: ImportJob,
  batchIdInput: string,
  options: { error?: string; retryable?: boolean; updatedAt?: string } = {}
): ImportJob {
  const batchId = normalizedText(batchIdInput)
  if (!batchId) return job
  const retryable = options.retryable !== false
  const error = normalizedText(options.error)
  const rows = job.rows.map((row): ImportJobRow => {
    if (row.status !== "processing" || row.batchId !== batchId) return row
    if (retryable) {
      return { ...row, status: "pending", batchId: undefined, error: error || undefined, retryable: undefined }
    }
    return {
      ...row,
      status: "failed",
      batchId: undefined,
      error: error || "O lote não foi concluído.",
      retryable: false,
    }
  })
  return withUpdatedAt({ ...job, rows, status: statusFromRows(rows, job.status) }, options.updatedAt)
}

export function retryFailedImportRows(
  job: ImportJob,
  options: { maxAttempts?: number; updatedAt?: string } = {}
) {
  const maxAttempts = positiveInteger(options.maxAttempts, 3, 100)
  const rows = job.rows.map((row): ImportJobRow => {
    if (row.status !== "failed" || !row.retryable || row.attempts >= maxAttempts) return row
    return { ...row, status: "pending", error: undefined, retryable: undefined }
  })
  return withUpdatedAt({ ...job, rows, status: statusFromRows(rows) }, options.updatedAt)
}

export function buildImportReport(job: ImportJob): ImportReport {
  const count = (status: ImportJobRowStatus) => job.rows.filter((row) => row.status === status).length
  const pending = count("pending")
  const processing = count("processing")
  const imported = count("imported")
  const duplicates = count("duplicate")
  const invalid = count("invalid")
  const failed = count("failed")
  const attempted = job.rows.filter((row) => row.attempts > 0).length
  const processed = imported + duplicates + invalid + failed
  return {
    jobId: job.id,
    status: statusFromRows(job.rows, job.status),
    total: job.rows.length,
    pending,
    processing,
    imported,
    duplicates,
    invalid,
    failed,
    attempted,
    processed,
    remaining: pending + processing,
    failures: job.rows
      .filter((row) => row.status === "failed")
      .map((row) => ({
        rowNumber: row.rowNumber,
        idempotencyKey: row.idempotencyKey,
        attempts: row.attempts,
        error: row.error || "A linha não foi gravada.",
        retryable: Boolean(row.retryable),
      })),
  }
}

export const importJobReport = buildImportReport

export function isImportJobComplete(job: ImportJob) {
  return buildImportReport(job).status === "completed"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function isJobRowStatus(value: unknown): value is ImportJobRowStatus {
  return (
    value === "pending" ||
    value === "processing" ||
    value === "imported" ||
    value === "duplicate" ||
    value === "invalid" ||
    value === "failed"
  )
}

/**
 * Restaura um snapshot JSON sem confiar no estado agregado persistido. O
 * estado do job é recalculado a partir das linhas.
 */
export function restoreImportJob(snapshot: unknown): RestoreImportJobResult {
  let value = snapshot
  if (typeof snapshot === "string") {
    try {
      value = JSON.parse(snapshot) as unknown
    } catch {
      return { ok: false, error: "O snapshot da importação não é JSON válido." }
    }
  }
  if (!isRecord(value) || value.version !== IMPORT_JOB_VERSION || !Array.isArray(value.rows)) {
    return { ok: false, error: "O snapshot da importação tem um formato incompatível." }
  }

  const id = normalizedText(value.id)
  const sourceFingerprint = normalizedText(value.sourceFingerprint)
  if (!id || !sourceFingerprint) {
    return { ok: false, error: "O snapshot da importação não tem identificadores válidos." }
  }

  const rows: ImportJobRow[] = []
  for (const rawRow of value.rows) {
    if (!isRecord(rawRow) || !isRecord(rawRow.data) || !isJobRowStatus(rawRow.status)) {
      return { ok: false, error: "O snapshot contém uma linha inválida." }
    }
    const idempotencyKey = normalizedText(rawRow.idempotencyKey)
    const sourceIndex = Number(rawRow.sourceIndex)
    const rowNumber = Number(rawRow.rowNumber)
    const attempts = Number(rawRow.attempts)
    if (
      !idempotencyKey ||
      !Number.isInteger(sourceIndex) ||
      sourceIndex < 0 ||
      !Number.isInteger(rowNumber) ||
      rowNumber < 1 ||
      !Number.isInteger(attempts) ||
      attempts < 0
    ) {
      return { ok: false, error: "O snapshot contém coordenadas de linha inválidas." }
    }

    const data: ImportMappedRecord = {}
    for (const [key, item] of Object.entries(rawRow.data)) {
      const field = normalizedText(key)
      if (!field) continue
      data[field] = cleanMappedValue(item)
    }
    const identities = Array.isArray(rawRow.identities)
      ? rawRow.identities.map(normalizedText).filter(Boolean)
      : []
    const rawIssues = Array.isArray(rawRow.issues) ? rawRow.issues : []
    const rowIssues = rawIssues
      .filter(isRecord)
      .map((rawIssue): ImportIssue | null => {
        const code = normalizedText(rawIssue.code) as ImportIssueCode
        const message = normalizedText(rawIssue.message)
        const severity = rawIssue.severity === "warning" ? "warning" : "error"
        if (!code || !message) return null
        return {
          code,
          message,
          severity,
          ...(typeof rawIssue.rowNumber === "number" ? { rowNumber: rawIssue.rowNumber } : {}),
          ...(typeof rawIssue.field === "string" ? { field: rawIssue.field } : {}),
        }
      })
      .filter((item): item is ImportIssue => Boolean(item))

    const disposition: ImportPreviewDisposition =
      rawRow.disposition === "duplicate" || rawRow.disposition === "invalid" ? rawRow.disposition : "ready"
    rows.push({
      sourceIndex,
      rowNumber,
      data,
      identities,
      idempotencyKey,
      disposition,
      issues: rowIssues,
      status: rawRow.status,
      attempts,
      ...(typeof rawRow.duplicateOf === "number" || rawRow.duplicateOf === "existing"
        ? { duplicateOf: rawRow.duplicateOf }
        : {}),
      ...(typeof rawRow.batchId === "string" && rawRow.batchId.trim() ? { batchId: rawRow.batchId.trim() } : {}),
      ...(typeof rawRow.error === "string" && rawRow.error.trim() ? { error: rawRow.error.trim() } : {}),
      ...(typeof rawRow.retryable === "boolean" ? { retryable: rawRow.retryable } : {}),
    })
  }

  const rawMapping = isRecord(value.mapping) ? value.mapping : {}
  const mapping: Record<string, string> = {}
  for (const [target, source] of Object.entries(rawMapping)) {
    const cleanTarget = normalizedText(target)
    const cleanSource = normalizedText(source)
    if (cleanTarget && cleanSource) mapping[cleanTarget] = cleanSource
  }

  const preferred = value.status === "paused" ? "paused" : undefined
  return {
    ok: true,
    job: {
      version: IMPORT_JOB_VERSION,
      id,
      sourceFingerprint,
      status: statusFromRows(rows, preferred),
      mapping,
      batchSize: positiveInteger(value.batchSize, DEFAULT_IMPORT_BATCH_SIZE, MAX_IMPORT_BATCH_SIZE),
      rows,
      ...(cleanTimestamp(value.createdAt) ? { createdAt: cleanTimestamp(value.createdAt) } : {}),
      ...(cleanTimestamp(value.updatedAt) ? { updatedAt: cleanTimestamp(value.updatedAt) } : {}),
    },
  }
}
