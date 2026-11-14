'use client'
import React from 'react'
import { C } from '@/lib/colors'

type Lien = { intitule: string; url: string }

const TYPES_LIEN = ['LinkedIn', 'Portfolio', 'Site', 'Autre']

const inputS: React.CSSProperties = {
  fontSize: 14, padding: '7px 10px',
  border: `1px solid ${C.sable}`, borderRadius: 9, outline: 'none',
  fontFamily: 'inherit', color: C.dark, backgroundColor: C.white,
  boxSizing: 'border-box',
}

type Props = {
  editLiens: Lien[]
  setEditLiens: (v: Lien[]) => void
  editLiensErrs: Record<number, string>
  onMark: () => void
}

export default function CarteLiens({ editLiens, setEditLiens, editLiensErrs, onMark }: Props) {
  function update(i: number, patch: Partial<Lien>) {
    const arr = [...editLiens]; arr[i] = { ...arr[i], ...patch }
    setEditLiens(arr); onMark()
  }
  function remove(i: number) {
    setEditLiens(editLiens.filter((_, j) => j !== i)); onMark()
  }
  function add() {
    setEditLiens([...editLiens, { intitule: 'LinkedIn', url: '' }]); onMark()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {editLiens.map((lien, i) => (
        <div key={i}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              value={lien.intitule}
              onChange={e => update(i, { intitule: e.target.value })}
              style={{ ...inputS, width: 120, flexShrink: 0 }}
            >
              {TYPES_LIEN.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input
              value={lien.url}
              onChange={e => update(i, { url: e.target.value })}
              placeholder="https://…"
              type="url"
              style={{ ...inputS, flex: 1 }}
            />
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="Retirer ce lien"
              style={{ width: 32, height: 32, borderRadius: '50%', border: `1px solid ${C.sable}`, backgroundColor: C.bg, color: C.grey, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}
            >
              ×
            </button>
          </div>
          {editLiensErrs[i] && (
            <p style={{ fontSize: 12.5, color: C.erreur, margin: '4px 0 0' }}>{editLiensErrs[i]}</p>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        style={{ alignSelf: 'flex-start', fontSize: 13, fontWeight: 600, color: C.vert, padding: '5px 12px', borderRadius: 8, border: `1px solid ${C.sable}`, backgroundColor: C.salaire, cursor: 'pointer', fontFamily: 'inherit' }}
      >
        Ajouter un lien
      </button>
    </div>
  )
}
