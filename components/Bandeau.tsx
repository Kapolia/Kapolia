'use client'

import React, { useRef, useLayoutEffect } from 'react'
import Link from 'next/link'
import { C } from '@/lib/colors'

const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)'

type BandeauProps = {
  message: string
  action?: { libelle: string; onClick?: () => void; href?: string }
  fixe?: boolean
  bas?: number
}

export type BandeauHandle = {
  animateOut: (onDone: () => void) => void
}

export const Bandeau = React.forwardRef<BandeauHandle, BandeauProps>(
  function Bandeau({ message, action, fixe, bas }, ref) {
    const divRef = useRef<HTMLDivElement>(null)

    React.useImperativeHandle(ref, () => ({
      animateOut(onDone: () => void) {
        const el = divRef.current
        if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          onDone()
          return
        }
        el.getAnimations().forEach(a => a.cancel())
        const anim = el.animate(
          [
            { opacity: '1', transform: 'translateX(-50%) translateY(0)' },
            { opacity: '0', transform: 'translateX(-50%) translateY(16px)' },
          ],
          { duration: 180, easing: 'ease-in' }
        )
        anim.onfinish = onDone
      },
    }))

    useLayoutEffect(() => {
      const el = divRef.current
      if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      el.animate(
        [
          { opacity: '0', transform: 'translateX(-50%) translateY(16px)' },
          { opacity: '1', transform: 'translateX(-50%) translateY(0)' },
        ],
        { duration: 240, easing: EASE }
      )
    }, [])

    const actionStyle: React.CSSProperties = {
      fontSize: 14,
      fontWeight: 600,
      color: '#F0A36B',
      cursor: 'pointer',
      fontFamily: 'inherit',
    }

    return (
      <div
        ref={divRef}
        role="status"
        aria-live="polite"
        style={{
          position: fixe ? 'fixed' : 'absolute',
          bottom: bas ?? 24,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
          pointerEvents: 'none',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          backgroundColor: C.dark,
          color: C.white,
          fontSize: 14,
          borderRadius: 10,
          padding: '11px 16px',
          boxShadow: '0 8px 24px rgba(0,0,0,.2)',
          pointerEvents: 'auto',
          whiteSpace: 'nowrap',
        }}>
          <span>{message}</span>
          {action && (
            action.href ? (
              <Link href={action.href} style={{ ...actionStyle, textDecoration: 'none' }}>
                {action.libelle}
              </Link>
            ) : (
              <button
                onClick={action.onClick}
                style={{ ...actionStyle, background: 'none', border: 'none', padding: 0 }}
              >
                {action.libelle}
              </button>
            )
          )}
        </div>
      </div>
    )
  }
)
