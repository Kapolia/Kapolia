'use client'

import { useEffect, useRef } from 'react'
import { C } from '@/lib/colors'
import { reduitMouvement } from '@/lib/motion'

type Niveau = -1 | 0 | 1 | 2 | 3 | 4

const COULEURS: Record<Exclude<Niveau, -1>, string> = {
  0: C.erreur,
  1: C.attente,
  2: C.succes,
  3: C.succesFonce,
  4: C.vert,
}

const ETIQUETTES: Record<Exclude<Niveau, -1>, string> = {
  0: 'Trop simple',
  1: 'Moyen',
  2: 'Bon',
  3: 'Solide',
  4: 'Très solide',
}

function segmentsAllumes(niveau: Niveau): number {
  if (niveau === -1) return 0
  if (niveau === 0) return 1
  return niveau
}

interface BarreRobustesseProps {
  niveau: Niveau
  conseil: string
}

export default function BarreRobustesse({ niveau, conseil }: BarreRobustesseProps) {
  const prevNiveauRef = useRef<Niveau>(niveau)
  const labelRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (prevNiveauRef.current === niveau) return
    prevNiveauRef.current = niveau
    if (reduitMouvement()) return
    const el = labelRef.current
    if (!el) return
    el.classList.remove('barre-label--pulse')
    void el.offsetWidth
    el.classList.add('barre-label--pulse')
  }, [niveau])

  const allumes = segmentsAllumes(niveau)
  const couleur = niveau !== -1 ? COULEURS[niveau] : C.sable

  return (
    <div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '5px',
        height: '5px',
      }}>
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            style={{ borderRadius: '3px', backgroundColor: C.sable, overflow: 'hidden' }}
          >
            <div
              className={`barre-fill${i < allumes ? ' barre-fill--allume' : ''}`}
              style={{
                backgroundColor: couleur,
                transitionDelay: `${i * 40}ms, 0ms`,
              }}
            />
          </div>
        ))}
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginTop: '6px',
        gap: '8px',
      }}>
        <span style={{ fontSize: '13px', color: C.grey, lineHeight: 1.4 }}>
          {conseil}
        </span>
        {niveau !== -1 && (
          <span
            ref={labelRef}
            aria-live="polite"
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: couleur,
              flexShrink: 0,
              display: 'inline-block',
            }}
          >
            {ETIQUETTES[niveau]}
          </span>
        )}
      </div>
    </div>
  )
}
