import { normalizeCountryCode, normalizeRegionCode } from "./geo.ts"
import type { TrackGeo } from "./track.ts"

export type LatLng = [number, number]

const BR_CAPITALS: Record<string, LatLng> = {
  AC: [-9.97, -67.81],
  AL: [-9.67, -35.74],
  AP: [0.03, -51.05],
  AM: [-3.12, -60.02],
  BA: [-12.97, -38.5],
  CE: [-3.72, -38.54],
  DF: [-15.78, -47.93],
  ES: [-20.32, -40.34],
  GO: [-16.68, -49.25],
  MA: [-2.53, -44.3],
  MT: [-15.6, -56.1],
  MS: [-20.46, -54.61],
  MG: [-19.92, -43.94],
  PA: [-1.46, -48.5],
  PB: [-7.12, -34.86],
  PR: [-25.43, -49.27],
  PE: [-8.05, -34.9],
  PI: [-5.09, -42.8],
  RJ: [-22.91, -43.17],
  RN: [-5.79, -35.21],
  RS: [-30.03, -51.23],
  RO: [-8.76, -63.9],
  RR: [2.82, -60.67],
  SC: [-27.59, -48.55],
  SP: [-23.55, -46.63],
  SE: [-10.91, -37.07],
  TO: [-10.18, -48.33],
}

const COUNTRY_CENTERS: Record<string, LatLng> = {
  BR: [-14.24, -51.93],
  PT: [39.4, -8.22],
  US: [37.09, -95.71],
  AR: [-38.42, -63.62],
  PY: [-23.44, -58.44],
  UY: [-32.52, -55.77],
  CL: [-35.68, -71.54],
  CO: [4.57, -74.3],
  PE: [-9.19, -75.02],
  MX: [23.63, -102.55],
  AO: [-11.2, 17.87],
  MZ: [-18.67, 35.53],
  CV: [16.0, -24.01],
  ES: [40.46, -3.75],
  IT: [41.87, 12.57],
  DE: [51.17, 10.45],
  FR: [46.23, 2.21],
  GB: [55.38, -3.44],
}

export function coordsFromGeo(geo: Pick<TrackGeo, "countryCode" | "country" | "regionCode" | "region">): LatLng | null {
  const country = normalizeCountryCode(geo.countryCode || geo.country)
  const region = normalizeRegionCode(geo.regionCode || geo.region, country)
  if ((country === "BR" || !country) && region && BR_CAPITALS[region]) return BR_CAPITALS[region]
  if (country && COUNTRY_CENTERS[country]) return COUNTRY_CENTERS[country]
  return null
}
