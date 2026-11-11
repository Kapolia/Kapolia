'use client'

import { C } from '@/lib/colors'

export type OngletItem = { key: string; label: string; count: number }

export function OngletNav({ onglets, actif, onChange }: {
  onglets: OngletItem[]
  actif:   string
  onChange: (key: string) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {onglets.map(o => {
        const active = o.key === actif
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '7px 14px',
              borderRadius: 8,
              border: 'none',
              backgroundColor: active ? C.vert : 'transparent',
              color: active ? '#fff' : C.grey,
              fontSize: 13, fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'background-color 0.12s, color 0.12s',
              whiteSpace: 'nowrap',
            }}
          >
            {o.label}
            <span style={{
              fontSize: 11, fontWeight: 700, lineHeight: '16px',
              padding: '0 6px', borderRadius: 20,
              backgroundColor: active ? 'rgba(255,255,255,0.20)' : C.sable,
              color: active ? '#fff' : C.grey,
            }}>
              {o.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
