'use client'

import { C } from '@/lib/colors'
import { FONT_SANS } from '@/lib/typography'

export default function TitreGroupe({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 13,
      fontWeight: 600,
      color: C.grey,
      padding: '16px 22px 0',
      fontFamily: FONT_SANS,
    }}>
      {children}
    </div>
  )
}
