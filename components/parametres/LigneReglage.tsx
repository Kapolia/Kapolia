'use client'

import { C } from '@/lib/colors'
import { FONT_SANS } from '@/lib/typography'

interface LigneReglageProps {
  label: string
  description?: string
  extra?: React.ReactNode
  control?: React.ReactNode
  divider?: boolean
}

export default function LigneReglage({ label, description, extra, control, divider = true }: LigneReglageProps) {
  return (
    <>
      {divider && (
        <div style={{ height: 1, backgroundColor: C.sable, margin: '0 22px' }} />
      )}
      <div style={{
        padding: '18px 22px',
        display: 'flex',
        alignItems: description || extra ? 'flex-start' : 'center',
        gap: 20,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.dark, fontFamily: FONT_SANS }}>
            {label}
          </div>
          {description && (
            <div style={{ fontSize: 13.5, color: C.grey, lineHeight: 1.5, marginTop: 2 }}>
              {description}
            </div>
          )}
          {extra && (
            <div style={{ marginTop: 8 }}>
              {extra}
            </div>
          )}
        </div>
        {control && (
          <div style={{ flexShrink: 0 }}>
            {control}
          </div>
        )}
      </div>
    </>
  )
}
