'use client'

import { useState } from 'react'
import { FONT_SANS } from '@/lib/typography'
import { C } from '@/lib/colors'

const LOGO_COLORS = [
  { bg: '#F5EBE5', color: C.orange },
  { bg: '#E8EDE9', color: C.vert },
  { bg: '#E8EEF0', color: '#2F5566' as const },
  { bg: '#F5EDE0', color: '#9B7B48' as const },
]

export function EntrepriseLogo({ nom, logoUrl, size = 48 }: { nom: string; logoUrl?: string; size?: number }) {
  const [imgError, setImgError] = useState(false)
  const initial         = nom.trim().charAt(0).toUpperCase()
  const { bg, color }   = LOGO_COLORS[nom.charCodeAt(0) % LOGO_COLORS.length]
  const showFallback    = !logoUrl || imgError

  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size / 4),
      flexShrink: 0, overflow: 'hidden',
      border: `1px solid ${showFallback ? 'transparent' : '#E8E8E8'}`,
      backgroundColor: showFallback ? bg : '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {showFallback ? (
        <span style={{
          fontSize: Math.round(size * 0.44),
          fontFamily: FONT_SANS, letterSpacing: '-0.005em', fontWeight: 600, color,
          lineHeight: 1, userSelect: 'none',
        }}>
          {initial}
        </span>
      ) : (
        <img
          src={logoUrl}
          alt={nom}
          onError={() => setImgError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'contain', padding: Math.round(size * 0.1) }}
        />
      )}
    </div>
  )
}
