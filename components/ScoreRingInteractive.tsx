'use client'

import { useState, useRef, useEffect } from 'react'
import { ScoreRing } from '@/components/ScoreRing'
import { type ScoreBreakdown, type CriterionResult } from '@/lib/matching'
import { C as _C, CARD_SHADOW, CARD_RADIUS } from '@/lib/colors'

const C = { ..._C, lightGrey: '#D0D0D0' as const }


const CRITERIA: { key: keyof Omit<ScoreBreakdown, 'total'>; label: string }[] = [
  { key: 'domaine',      label: 'Domaine'      },
  { key: 'experience',   label: 'Expérience'   },
  { key: 'contrat',      label: 'Contrat'      },
  { key: 'localisation', label: 'Localisation' },
  { key: 'competences',  label: 'Compétences'  },
]

function criterionDisplay(c: CriterionResult): { dotColor: string; statusLabel: string; statusColor: string } {
  if (c === null)            return { dotColor: C.lightGrey, statusLabel: 'Données manquantes', statusColor: C.grey }
  if (c.earned === c.weight) return { dotColor: C.vert,      statusLabel: 'Correspond',         statusColor: C.vert }
  if (c.earned > 0)          return { dotColor: C.terracotta,statusLabel: 'Partiellement',       statusColor: C.terracotta }
  return                            { dotColor: C.lightGrey, statusLabel: 'Ne correspond pas',   statusColor: C.grey }
}

function BreakdownPanel({ breakdown }: { breakdown: ScoreBreakdown }) {
  return (
    <div style={{
      backgroundColor: C.white,
      borderRadius: CARD_RADIUS, padding: '12px 16px', minWidth: 220,
      boxShadow: CARD_SHADOW,
    }}>
      {CRITERIA.map(({ key, label }) => {
        const c = breakdown[key]
        const { dotColor, statusLabel, statusColor } = criterionDisplay(c)
        return (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', opacity: c === null ? 0.45 : 1 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: dotColor, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 13, color: C.dark }}>{label}</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: statusColor }}>{statusLabel}</span>
          </div>
        )
      })}
    </div>
  )
}

export function ScoreRingInteractive({
  score, breakdown, size = 54, delay = 0, mode = 'popover',
}: {
  score: number
  breakdown: ScoreBreakdown
  size?: number
  delay?: number
  mode?: 'popover' | 'inline'
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || mode === 'inline') return
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open, mode])

  const ring = (
    <div onClick={() => setOpen(o => !o)} style={{ cursor: 'pointer' }}>
      <ScoreRing score={score} size={size} delay={delay} />
    </div>
  )

  if (mode === 'inline') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
        {ring}
        {open && <BreakdownPanel breakdown={breakdown} />}
      </div>
    )
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      {ring}
      {open && (
        <div style={{ position: 'absolute', top: size + 6, left: 0, zIndex: 200 }}>
          <BreakdownPanel breakdown={breakdown} />
        </div>
      )}
    </div>
  )
}
