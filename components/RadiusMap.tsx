'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Circle, useMap } from 'react-leaflet'

const VERT       = '#2C4A3E'
const TERRACOTTA = '#C4673A'

const STEPS = [0, 10, 25, 50, 100]

function FitBounds({ lat, lng, radiusKm }: { lat: number; lng: number; radiusKm: number }) {
  const map = useMap()
  const prevRef = useRef<{ lat: number; lng: number; radiusKm: number } | null>(null)
  useEffect(() => {
    const prev = prevRef.current
    const changed = !prev || prev.lat !== lat || prev.lng !== lng || prev.radiusKm !== radiusKm
    if (!changed) return
    prevRef.current = { lat, lng, radiusKm }
    const R = radiusKm === 0 ? 5 : radiusKm
    const deg = R / 111
    const bounds: [[number, number], [number, number]] = [
      [lat - deg, lng - deg * 1.3],
      [lat + deg, lng + deg * 1.3],
    ]
    map.fitBounds(bounds, { animate: true, duration: 0.35 })
  })
  return null
}

export default function RadiusMap({
  lat,
  lng,
  radiusKm,
}: {
  lat: number
  lng: number
  radiusKm: number
}) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={10}
      style={{ width: '100%', height: 300, borderRadius: 12, zIndex: 0 }}
      scrollWheelZoom={false}
      attributionControl={true}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <FitBounds lat={lat} lng={lng} radiusKm={radiusKm} />
      {radiusKm > 0 ? (
        <Circle
          center={[lat, lng]}
          radius={radiusKm * 1000}
          pathOptions={{
            color: TERRACOTTA,
            fillColor: VERT,
            fillOpacity: 0.12,
            weight: 2,
          }}
        />
      ) : (
        <Circle
          center={[lat, lng]}
          radius={1200}
          pathOptions={{
            color: TERRACOTTA,
            fillColor: TERRACOTTA,
            fillOpacity: 0.22,
            weight: 2,
          }}
        />
      )}
    </MapContainer>
  )
}

export { STEPS }
