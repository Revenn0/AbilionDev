import type { Lead, LeadFacts } from "./types.ts"

export type GeoFix = {
  country: string
  countryCode: string
  city: string
  region: string
  regionCode: string
}

export const BR_STATES: Record<string, string> = {
  AC: "Acre",
  AL: "Alagoas",
  AP: "Amapá",
  AM: "Amazonas",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MT: "Mato Grosso",
  MS: "Mato Grosso do Sul",
  MG: "Minas Gerais",
  PA: "Pará",
  PB: "Paraíba",
  PR: "Paraná",
  PE: "Pernambuco",
  PI: "Piauí",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul",
  RO: "Rondônia",
  RR: "Roraima",
  SC: "Santa Catarina",
  SP: "São Paulo",
  SE: "Sergipe",
  TO: "Tocantins",
}

const COUNTRY_NAMES: Record<string, string> = {
  BR: "Brasil",
  PT: "Portugal",
  US: "Estados Unidos",
  AR: "Argentina",
  PY: "Paraguai",
  UY: "Uruguai",
  CL: "Chile",
  CO: "Colômbia",
  PE: "Peru",
  MX: "México",
  AO: "Angola",
  MZ: "Moçambique",
  CV: "Cabo Verde",
  ES: "Espanha",
  IT: "Itália",
  DE: "Alemanha",
  FR: "França",
  GB: "Reino Unido",
}

const TZ_TO_BR: Record<string, string> = {
  "America/Bahia": "BA",
  "America/Fortaleza": "CE",
  "America/Recife": "PE",
  "America/Maceio": "AL",
  "America/Araguaina": "TO",
  "America/Belem": "PA",
  "America/Santarem": "PA",
  "America/Manaus": "AM",
  "America/Rio_Branco": "AC",
  "America/Porto_Velho": "RO",
  "America/Boa_Vista": "RR",
  "America/Cuiaba": "MT",
  "America/Campo_Grande": "MS",
  "America/Noronha": "PE",
}

export function flagEmoji(code?: string) {
  const cc = (code ?? "").trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(cc)) return ""
  return String.fromCodePoint(...[...cc].map((char) => 127397 + char.charCodeAt(0)))
}

export function countryName(code?: string, fallback = "") {
  const cc = (code ?? "").trim().toUpperCase()
  if (COUNTRY_NAMES[cc]) return COUNTRY_NAMES[cc]
  if (fallback && fallback.length > 2) return fallback
  return cc || fallback
}

const BLOCKED_CC = new Set(["XX", "T1", "A1", "A2"])

export function foldAscii(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
}

export function normalizeCountryCode(value?: string) {
  const raw = (value ?? "").trim()
  if (/^[A-Za-z]{2}$/.test(raw)) {
    const cc = raw.toUpperCase()
    return BLOCKED_CC.has(cc) ? "" : cc
  }
  const folded = foldAscii(raw)
  const hit = Object.entries(COUNTRY_NAMES).find(([, name]) => foldAscii(name) === folded)
  return hit?.[0] ?? ""
}

export function normalizeRegionCode(value?: string, countryCode?: string) {
  const raw = (value ?? "").trim().toUpperCase()
  if (countryCode === "BR" || !countryCode) {
    if (BR_STATES[raw]) return raw
    const folded = foldAscii(value ?? "")
    const hit = Object.entries(BR_STATES).find(([, name]) => foldAscii(name) === folded)
    if (hit) return hit[0]
  }
  if (/^[A-Z]{2,3}$/.test(raw) && !BLOCKED_CC.has(raw)) return raw
  return ""
}

export function stateLabel(region?: string, regionCode?: string, countryCode?: string) {
  const code = normalizeRegionCode(regionCode || region, countryCode)
  if ((countryCode === "BR" || !countryCode) && code && BR_STATES[code]) return `${BR_STATES[code]} (${code})`
  if (region && code) return `${region} (${code})`
  return region || code || ""
}

export function formatGeo(facts?: Pick<LeadFacts, "country" | "countryCode" | "region" | "regionCode" | "city"> | null) {
  if (!facts) return ""
  const code = facts.countryCode || normalizeCountryCode(facts.country)
  const flag = flagEmoji(code)
  const estado = stateLabel(facts.region, facts.regionCode, code)
  if (flag && estado) return `${flag} ${estado}`
  if (estado) return estado
  if (flag) return `${flag} ${countryName(code, facts.country)}`
  return countryName(code, facts.country)
}

export function inferStateFromTimezone(timezone?: string): Partial<GeoFix> {
  const tz = (timezone ?? "").trim()
  const code = TZ_TO_BR[tz]
  if (code) return { country: "Brasil", countryCode: "BR", region: BR_STATES[code], regionCode: code, city: "" }
  if (tz.startsWith("America/") || tz === "America/Sao_Paulo") {
    return { country: "Brasil", countryCode: "BR", region: "", regionCode: "", city: "" }
  }
  return {}
}

export function mergeGeo(base: Partial<GeoFix>, extra: Partial<GeoFix>): GeoFix {
  const countryCode = extra.countryCode || base.countryCode || normalizeCountryCode(extra.country || base.country)
  const regionCode = extra.regionCode || base.regionCode || normalizeRegionCode(extra.region || base.region, countryCode)
  return {
    country: countryName(countryCode, extra.country || base.country),
    countryCode,
    city: extra.city || base.city || "",
    region: extra.region || base.region || (regionCode && BR_STATES[regionCode]) || "",
    regionCode,
  }
}

export function compactGeo(geo: Partial<GeoFix>): Partial<GeoFix> {
  return {
    country: geo.country || undefined,
    countryCode: geo.countryCode || undefined,
    city: geo.city || undefined,
    region: geo.region || undefined,
    regionCode: geo.regionCode || undefined,
  }
}

export function factsFromGeo(geo: Partial<GeoFix>): LeadFacts {
  const countryCode = geo.countryCode || normalizeCountryCode(geo.country)
  const regionCode = geo.regionCode || normalizeRegionCode(geo.region, countryCode)
  return {
    country: countryName(countryCode, geo.country),
    countryCode,
    city: geo.city || "",
    region: geo.region || (regionCode ? BR_STATES[regionCode] : ""),
    regionCode,
  }
}

export function factsWithTrack(
  lead: Lead,
  geos?: Record<string, Partial<GeoFix>> | null
) {
  return leadGeo(lead, lead.visitorId ? geos?.[lead.visitorId] : undefined)
}

export function leadGeo(lead: Lead, fallback?: Partial<GeoFix> | null): LeadFacts {
  const fromLead = lead.facts ?? {}
  const extra = fallback ?? {}
  return {
    ...fromLead,
    ...factsFromGeo(
      mergeGeo(
        {
          country: fromLead.country,
          countryCode: fromLead.countryCode,
          city: fromLead.city,
          region: fromLead.region,
          regionCode: fromLead.regionCode,
        },
        extra
      )
    ),
  }
}

export function isPrivateIp(ip: string) {
  return /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|::1|fc|fd|localhost)/i.test(ip.trim())
}

export function clientIp(request: Request) {
  const forwarded = request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return forwarded || ""
}
