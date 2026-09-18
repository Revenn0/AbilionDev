import {
  clientIp,
  inferStateFromTimezone,
  isPrivateIp,
  mergeGeo,
  normalizeCountryCode,
  normalizeRegionCode,
  type GeoFix,
} from "../src/lib/geo.ts"

type CfRequest = Request & {
  cf?: {
    country?: string
    city?: string
    region?: string
    regionCode?: string
    timezone?: string
  }
}

export function geoFromCloudflare(request: Request): Partial<GeoFix> {
  const cf = (request as CfRequest).cf
  const countryCode = normalizeCountryCode(cf?.country || request.headers.get("cf-ipcountry") || "")
  const regionCode = normalizeRegionCode(cf?.regionCode || cf?.region, countryCode)
  return {
    country: countryCode,
    countryCode,
    city: cf?.city || "",
    region: cf?.region || "",
    regionCode,
  }
}

async function fetchJson(url: string, ms = 1200): Promise<Record<string, unknown> | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) return null
    return (await res.json()) as Record<string, unknown>
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function lookupIpWhois(ip: string): Promise<Partial<GeoFix>> {
  if (!ip || isPrivateIp(ip)) return {}
  const data = await fetchJson(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,country,country_code,region,region_code,city`)
  if (!data || data.success === false) return {}
  const countryCode = normalizeCountryCode(String(data.country_code || data.country || ""))
  return {
    country: String(data.country || countryCode),
    countryCode,
    city: String(data.city || ""),
    region: String(data.region || ""),
    regionCode: normalizeRegionCode(String(data.region_code || data.region || ""), countryCode),
  }
}

export async function lookupGeoJs(ip: string): Promise<Partial<GeoFix>> {
  if (!ip || isPrivateIp(ip)) return {}
  const data = await fetchJson(`https://get.geojs.io/v1/ip/geo/${encodeURIComponent(ip)}.json`)
  if (!data) return {}
  const countryCode = normalizeCountryCode(String(data.country_code || data.country || ""))
  return {
    country: String(data.country || countryCode),
    countryCode,
    city: String(data.city || ""),
    region: String(data.region || ""),
    regionCode: normalizeRegionCode(String(data.region_code || data.region || ""), countryCode),
  }
}

export async function lookupPublicGeo(ip: string): Promise<Partial<GeoFix>> {
  const first = await lookupIpWhois(ip)
  if (first.regionCode || first.region) return first
  const second = await lookupGeoJs(ip)
  return mergeGeo(first, second)
}

export async function resolveClientGeo(request: Request, timezone?: string, hint?: Partial<GeoFix>): Promise<GeoFix> {
  const fromCf = geoFromCloudflare(request)
  const fromTz = inferStateFromTimezone(timezone || (request as CfRequest).cf?.timezone)
  let resolved = mergeGeo(mergeGeo(hint ?? {}, fromTz), fromCf)
  if (!resolved.regionCode && !resolved.region) {
    resolved = mergeGeo(resolved, await lookupPublicGeo(clientIp(request)))
  }
  return resolved
}
