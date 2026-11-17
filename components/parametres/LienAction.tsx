'use client'

import { C } from '@/lib/colors'
import { FONT_SANS } from '@/lib/typography'

interface LienActionProps {
  onClick?: () => void
  href?: string
  children: React.ReactNode
  disabled?: boolean
}

export default function LienAction({ onClick, href, children, disabled }: LienActionProps) {
  const style: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 600,
    color: disabled ? C.grey : C.lien,
    textDecoration: 'none',
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: disabled ? 'default' : 'pointer',
    fontFamily: FONT_SANS,
    opacity: disabled ? 0.5 : 1,
  }

  if (href) {
    return (
      <a href={href} style={style}>
        {children}
      </a>
    )
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} style={style}>
      {children}
    </button>
  )
}
