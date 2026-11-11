'use client'

import { getStatut } from '@/lib/statuts'

export function BadgeStatutCandidat({ statut }: { statut: string }) {
  const s = getStatut(statut)
  const c = s.candidat

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 12, fontWeight: 600,
      color: c.color, backgroundColor: c.bg,
      padding: '3px 9px', borderRadius: 20,
      flexShrink: 0, whiteSpace: 'nowrap',
    }}>
      {c.dotStyle === 'ring' ? (
        <span style={{
          display: 'inline-block', flexShrink: 0,
          width: 6, height: 6, borderRadius: '50%',
          border: `1.5px solid ${c.dot}`,
          backgroundColor: 'transparent',
        }} />
      ) : (
        <span style={{
          display: 'inline-block', flexShrink: 0,
          width: 6, height: 6, borderRadius: '50%',
          backgroundColor: c.dot,
        }} />
      )}
      {s.labelCandidat}
    </span>
  )
}
