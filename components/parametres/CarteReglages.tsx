'use client'

import { C, CARD_RADIUS, CARD_SHADOW } from '@/lib/colors'

export default function CarteReglages({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      backgroundColor: C.white,
      borderRadius: CARD_RADIUS,
      boxShadow: CARD_SHADOW,
      overflow: 'hidden',
    }}>
      {children}
    </div>
  )
}
