export type Coords = { lat: number; lng: number }

export function haversineKm(a: Coords, b: Coords): number {
  const R    = 6371
  const dLat = (b.lat - a.lat) * (Math.PI / 180)
  const dLng = (b.lng - a.lng) * (Math.PI / 180)
  const x    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * (Math.PI / 180)) *
    Math.cos(b.lat * (Math.PI / 180)) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(Math.min(1, x)))
}
