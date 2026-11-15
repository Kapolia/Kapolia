'use client'

import type { RefObject } from 'react'
import Link from 'next/link'
import { FONT_SANS } from '@/lib/typography'
import { C, CARD_SHADOW, CARD_RADIUS } from '@/lib/colors'
import LogoKapolia from '@/components/LogoKapolia'
import { AUTH_STYLES } from './auth-styles'

interface AuthShellProps {
  children: React.ReactNode
  cardRef?: RefObject<HTMLDivElement | null>
}

export default function AuthShell({ children, cardRef }: AuthShellProps) {
  return (
    <main
      className="auth-page"
      style={{
        minHeight: '100vh',
        backgroundColor: C.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        fontFamily: FONT_SANS,
      }}
    >
      <style suppressHydrationWarning>{AUTH_STYLES}</style>

      <Link
        href="/"
        style={{ marginBottom: '32px', textDecoration: 'none', display: 'block', lineHeight: 0 }}
      >
        <LogoKapolia variante="sombre" taille={38} needleClassName="auth-needle" />
      </Link>

      <div
        ref={cardRef}
        className="auth-card"
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: C.white,
          borderRadius: `${CARD_RADIUS}px`,
          boxShadow: CARD_SHADOW,
        }}
      >
        {children}
      </div>

      <p style={{
        marginTop: '28px',
        fontSize: '15px',
        fontWeight: 400,
        color: C.grey,
        fontStyle: 'italic',
        textAlign: 'center',
        lineHeight: 1.5,
      }}>
        « Trouvez votre cap. »
      </p>
    </main>
  )
}
