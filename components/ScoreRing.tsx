'use client'

import { useState, useEffect } from 'react'
import { FONT_SERIF } from '@/lib/typography'
import { C } from '@/lib/colors'

const LIGHT_GREY = '#D0D0D0'

export function ScoreRing({ score, size = 54, delay = 0 }: { score: number; size?: number; delay?: number }) {
  const sw    = 5
  const r     = (size - sw * 2) / 2
  const circ  = 2 * Math.PI * r
  const [go, setGo] = useState(false)
  useEffect(() => { const t = setTimeout(() => setGo(true), delay); return () => clearTimeout(t) }, [delay])
  const offset = go ? circ * (1 - score / 100) : circ
  const color  = score >= 75 ? C.vert : score >= 50 ? C.orange : LIGHT_GREY

  const numSize   = Math.min(17, size * 0.38)
  const labelSize = Math.min(9.5, size * 0.21)

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.sable} strokeWidth={sw} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.22,1,0.36,1)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        <span style={{ fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: numSize, fontWeight: 600, color, lineHeight: 1 }}>{score}%</span>
        <span style={{ fontSize: labelSize, color: C.grey, lineHeight: 1 }}>match</span>
      </div>
    </div>
  )
}
