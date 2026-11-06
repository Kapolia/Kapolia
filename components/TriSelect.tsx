'use client'
import { C } from '@/lib/colors'

export type TriOption = { value: string; label: string }

type Props = { value: string; onChange: (v: string) => void; options: TriOption[] }

export function TriSelect({ value, onChange, options }: Props) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 13, color: C.grey }}>
      Trier par
      <select
        className="kapolia-tri"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          border: 'none', background: 'none', fontFamily: 'inherit',
          fontSize: 13, color: C.dark, fontWeight: 600,
          cursor: 'pointer', outline: 'none', padding: '0 2px',
        }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  )
}
