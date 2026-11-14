'use client'
import React, { useState, useRef, useEffect } from 'react'
import { C } from '@/lib/colors'
import { normalizeText } from '@/lib/storage-utils'
import { reduitMouvement } from '@/lib/motion'

type Props = {
  valeurs: string[]
  onChange: (v: string[]) => void
  suggestions: string[]
  max: number
  placeholder: string
  libre: boolean
  icone?: (v: string) => React.ReactNode
}

function highlight(s: string, input: string): React.ReactNode {
  const idx = s.toLowerCase().indexOf(input.toLowerCase())
  if (idx < 0 || !input) return <>{s}</>
  return (
    <>
      {s.slice(0, idx)}
      <strong>{s.slice(idx, idx + input.length)}</strong>
      {s.slice(idx + input.length)}
    </>
  )
}

export default function ChampSuggestions({ valeurs, onChange, suggestions, max, placeholder, libre, icone }: Props) {
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(-1)
  const [removing, setRemoving] = useState<Set<string>>(new Set())
  const inputRef   = useRef<HTMLInputElement>(null)
  const chipRefs   = useRef<Record<string, HTMLElement | null>>({})
  const lastAdded  = useRef<string | null>(null)
  const valeursRef = useRef(valeurs)
  useEffect(() => { valeursRef.current = valeurs }, [valeurs])

  const full = valeurs.length >= max
  const norm = normalizeText(input)
  const matched = input.length > 0
    ? suggestions.filter(s => normalizeText(s).includes(norm)).slice(0, 6)
    : []
  const hasLibre = libre && input.trim().length > 0
  const totalOpts = matched.length + (hasLibre ? 1 : 0)

  useEffect(() => { if (full) { setInput(''); setOpen(false) } }, [full])

  // Bounce animation after add
  useEffect(() => {
    const val = lastAdded.current
    if (!val || typeof window === 'undefined' || reduitMouvement()) { lastAdded.current = null; return }
    lastAdded.current = null
    const el = chipRefs.current[val]
    if (!el) return
    el.animate(
      [{ transform: 'scale(0.92)' }, { transform: 'scale(1)' }],
      { duration: 300, easing: 'cubic-bezier(.2,.8,.2,1.4)', fill: 'both' }
    )
  }, [valeurs])

  function select(val: string) {
    if (valeurs.includes(val) || full) return
    lastAdded.current = val
    onChange([...valeurs, val])
    setInput(''); setOpen(false); setIndex(-1)
    inputRef.current?.focus()
  }

  function remove(val: string) {
    if (typeof window !== 'undefined' && !reduitMouvement()) {
      setRemoving(prev => new Set([...prev, val]))
      setTimeout(() => {
        onChange(valeursRef.current.filter(v => v !== val))
        setRemoving(prev => { const s = new Set(prev); s.delete(val); return s })
      }, 220)
    } else {
      onChange(valeurs.filter(v => v !== val))
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (!open && e.key !== 'ArrowDown') return
    if (e.key === 'ArrowDown') {
      e.preventDefault(); setOpen(true); setIndex(i => Math.min(i + 1, totalOpts - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); setIndex(i => Math.max(i - 1, -1))
    } else if (e.key === 'Escape') {
      setOpen(false); setIndex(-1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (index >= 0 && index < matched.length) {
        const opt = matched[index]
        if (!valeurs.includes(opt)) select(opt)
      } else if (hasLibre && index === matched.length) {
        select(input.trim())
      } else if (index === -1 && libre && input.trim()) {
        select(input.trim())
      }
    }
  }

  return (
    <div>
      <style suppressHydrationWarning>{`
        @keyframes champ-shrink { to { transform: scale(0.9); opacity: 0; } }
        @keyframes champ-drop-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: no-preference) {
          .champ-chip-removing { animation: champ-shrink 220ms ease forwards; pointer-events: none; }
          .champ-dropdown { animation: champ-drop-in 180ms ease both; }
        }
      `}</style>

      {/* Étiquettes au-dessus */}
      {valeurs.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {valeurs.map(v => (
            <span key={v}
              ref={el => { chipRefs.current[v] = el }}
              className={removing.has(v) ? 'champ-chip-removing' : undefined}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', backgroundColor: C.chip, borderRadius: 8, fontSize: 13.5, fontWeight: 500, color: C.dark }}>
              {icone?.(v)}
              {v}
              <button type="button" onClick={() => remove(v)} aria-label={`Retirer ${v}`}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.grey, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, fontSize: 16, lineHeight: 1 }}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Champ + liste */}
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          value={input}
          disabled={full}
          placeholder={placeholder}
          onChange={e => { setInput(e.target.value); setOpen(true); setIndex(-1) }}
          onFocus={() => { if (input) setOpen(true) }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={handleKey}
          style={{
            fontSize: 14, padding: '8px 11px', width: '100%',
            border: `1px solid ${C.sable}`, borderRadius: 9, outline: 'none',
            fontFamily: 'inherit', color: C.dark,
            backgroundColor: full ? C.bg : C.white,
            boxSizing: 'border-box',
            transition: 'background-color 180ms',
          }}
        />

        {open && totalOpts > 0 && (
          <div className="champ-dropdown" style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
            backgroundColor: C.white, border: `1px solid ${C.sable}`,
            borderRadius: 9, boxShadow: '0 4px 16px rgba(0,0,0,.08)',
            marginTop: 4, overflow: 'hidden',
          }}>
            {matched.map((s, i) => {
              const already = valeurs.includes(s)
              const active = index === i
              return (
                <div key={s}
                  onMouseDown={already ? undefined : () => select(s)}
                  onMouseEnter={() => !already && setIndex(i)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', fontSize: 13.5,
                    cursor: already ? 'default' : 'pointer',
                    backgroundColor: active ? C.bg : C.white,
                    color: already ? C.grey : C.dark,
                    transition: 'background-color 180ms',
                  }}
                >
                  <span>{highlight(s, input)}</span>
                  {already && <span style={{ fontSize: 12, color: C.grey, marginLeft: 8, flexShrink: 0 }}>déjà choisie</span>}
                </div>
              )
            })}
            {hasLibre && (
              <>
                {matched.length > 0 && <div style={{ borderTop: `1px solid ${C.sable}` }} />}
                <div
                  onMouseDown={() => select(input.trim())}
                  onMouseEnter={() => setIndex(matched.length)}
                  style={{
                    padding: '8px 12px', fontSize: 13.5, cursor: 'pointer',
                    color: C.grey,
                    backgroundColor: index === matched.length ? C.bg : C.white,
                    transition: 'background-color 180ms',
                  }}
                >
                  Garder &laquo;&nbsp;{input.trim()}&nbsp;&raquo; tel quel
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Compteur */}
      <span style={{ fontSize: 12.5, color: C.grey, marginTop: 5, display: 'block' }}>
        {full
          ? 'Retirez un choix pour en ajouter un autre.'
          : `${valeurs.length} choix sur ${max}.`}
      </span>
    </div>
  )
}
