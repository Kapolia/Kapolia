'use client'

import { useRef, useLayoutEffect } from 'react'
import { C } from '@/lib/colors'
import { EASE, reduitMouvement } from '@/lib/motion'

export type OngletItem = { key: string; label: string; count: number }

type Props = { onglets: OngletItem[]; actif: string; onChange: (key: string) => void }

export function OngletNav({ onglets, actif, onChange }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const indicatorRef  = useRef<HTMLDivElement>(null)
  const isFirstRef    = useRef(true)
  const countRefsMap  = useRef(new Map<string, HTMLElement>())
  const prevCountsRef = useRef(new Map<string, number>())

  // ── Sliding indicator ─────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const container = containerRef.current
    const indicator = indicatorRef.current
    if (!container || !indicator) return

    const btn = container.querySelector<HTMLElement>(`[data-onglet="${actif}"]`)
    if (!btn) return

    const cr   = btn.getBoundingClientRect()
    const pr   = container.getBoundingClientRect()
    const left = cr.left - pr.left
    const w    = cr.width
    const h    = cr.height

    if (isFirstRef.current) {
      isFirstRef.current = false
      indicator.style.left   = left + 'px'
      indicator.style.width  = w + 'px'
      indicator.style.height = h + 'px'
      return
    }

    if (reduitMouvement()) {
      indicator.style.left   = left + 'px'
      indicator.style.width  = w + 'px'
      indicator.style.height = h + 'px'
      return
    }

    const prevLeft  = parseFloat(indicator.style.left  || '0')
    const prevWidth = parseFloat(indicator.style.width || '0')
    indicator.getAnimations().forEach(a => a.cancel())
    const anim = indicator.animate(
      [{ left: prevLeft + 'px', width: prevWidth + 'px' }, { left: left + 'px', width: w + 'px' }],
      { duration: 280, easing: EASE, fill: 'forwards' }
    )
    anim.onfinish = () => {
      indicator.style.left  = left + 'px'
      indicator.style.width = w + 'px'
    }
  }, [actif])

  // ── Counter bounce ────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    for (const o of onglets) {
      const prev = prevCountsRef.current.get(o.key)
      const el   = countRefsMap.current.get(o.key)
      if (prev !== undefined && prev !== o.count && el && !reduitMouvement()) {
        el.animate(
          [{ transform: 'scale(1)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }],
          { duration: 450, easing: 'cubic-bezier(0.3, 1.6, 0.5, 1)' }
        )
      }
      prevCountsRef.current.set(o.key, o.count)
    }
  }, [onglets])

  return (
    <div ref={containerRef} style={{ display: 'flex', gap: 2, position: 'relative' }}>
      <div
        ref={indicatorRef}
        aria-hidden
        style={{
          position: 'absolute', top: 0,
          borderRadius: 8, backgroundColor: C.vert,
          pointerEvents: 'none', zIndex: 0,
        }}
      />
      {onglets.map(o => {
        const active = o.key === actif
        return (
          <button
            key={o.key}
            data-onglet={o.key}
            onClick={() => onChange(o.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '7px 14px', borderRadius: 8, border: 'none',
              backgroundColor: 'transparent',
              color: active ? '#fff' : C.grey,
              fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              position: 'relative', zIndex: 1,
              transition: 'color 0.12s',
              whiteSpace: 'nowrap',
            }}
          >
            {o.label}
            <span
              ref={el => { if (el) countRefsMap.current.set(o.key, el); else countRefsMap.current.delete(o.key) }}
              style={{
                fontSize: 11, fontWeight: 700, lineHeight: '16px',
                padding: '0 6px', borderRadius: 20, display: 'inline-block',
                backgroundColor: active ? 'rgba(255,255,255,0.20)' : C.sable,
                color: active ? '#fff' : C.grey,
                transition: 'background-color 0.12s, color 0.12s',
              }}
            >
              {o.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
