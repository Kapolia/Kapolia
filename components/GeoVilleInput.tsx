'use client'

import { useState, useRef, useEffect } from 'react'

const C = {
  sable:      '#E8D5B7',
  creme:      '#F7F2EB',
  dark:       '#1A1A1A',
  grey:       '#6B6B6B',
  lightGrey:  '#D0D0D0',
  terracotta: '#C4673A',
  white:      '#FFFFFF',
}

type Suggestion = { nom: string; lat: number; lng: number }

export type GeoCoords = { lat: number; lng: number }

type GeoCommune = { nom: string; population?: number; centre: { coordinates: [number, number] } }

export function GeoVilleInput({
  value,
  onChange,
  onCoordsChange,
  dark = false,
  placeholder = 'Ville, région…',
  style: sx,
}: {
  value: string
  onChange: (v: string) => void
  onCoordsChange: (c: GeoCoords | null) => void
  dark?: boolean
  placeholder?: string
  style?: React.CSSProperties
}) {
  const [suggs, setSuggs] = useState<Suggestion[]>([])
  const [open, setOpen]   = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef     = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  function handleInput(v: string) {
    onChange(v)
    onCoordsChange(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (v.length < 2) { setSuggs([]); setOpen(false); return }
    debounceRef.current = setTimeout(async () => {
      try {
        const res  = await fetch(
          `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(v)}&fields=centre,population&boost=population&limit=6`
        )
        const data = await res.json() as GeoCommune[]
        const results = data
          .filter(c => c.centre)
          .map(c => ({ nom: c.nom, lat: c.centre.coordinates[1], lng: c.centre.coordinates[0] }))
        setSuggs(results)
        setOpen(results.length > 0)
      } catch { /* ignore network errors */ }
    }, 280)
  }

  function handleSelect(s: Suggestion) {
    onChange(s.nom)
    onCoordsChange({ lat: s.lat, lng: s.lng })
    setSuggs([])
    setOpen(false)
  }

  function handleClear() {
    onChange('')
    onCoordsChange(null)
    setSuggs([])
    setOpen(false)
  }

  const border = dark
    ? `1.5px solid ${value ? C.terracotta : 'rgba(255,255,255,0.18)'}`
    : `1.5px solid ${value ? C.sable : C.lightGrey}`

  return (
    <div ref={wrapRef} style={{ position: 'relative', ...sx }}>
      {/* pin icon */}
      <div style={{
        position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
        pointerEvents: 'none', color: C.lightGrey, fontSize: 14, lineHeight: 1,
      }}>◎</div>

      <input
        value={value}
        onChange={e => handleInput(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        style={{
          width: '100%', padding: '11px 32px 11px 28px', fontSize: 14, borderRadius: 10,
          border,
          backgroundColor: 'rgba(255,255,255,0.97)',
          color: C.dark,
          outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s',
          boxSizing: 'border-box' as const,
        }}
      />

      {value && (
        <button
          onClick={handleClear}
          style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer',
            color: C.grey, fontSize: 18, lineHeight: 1, padding: 0,
          }}
        >×</button>
      )}

      {open && suggs.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
          backgroundColor: C.white, border: `1px solid ${C.sable}`,
          borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          zIndex: 500, overflow: 'hidden',
        }}>
          {suggs.map((s, i) => (
            <button
              key={i}
              onMouseDown={e => { e.preventDefault(); handleSelect(s) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '10px 14px', textAlign: 'left',
                border: 'none',
                borderBottom: i < suggs.length - 1 ? `1px solid ${C.sable}` : 'none',
                backgroundColor: 'transparent', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 13, color: C.dark,
                transition: 'background-color 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = C.creme)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <span style={{ color: C.grey, fontSize: 11, flexShrink: 0 }}>◎</span>
              {s.nom}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
