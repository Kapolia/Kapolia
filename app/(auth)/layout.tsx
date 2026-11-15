'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { flushSync } from 'react-dom'
import { reduitMouvement } from '@/lib/motion'
import AuthShell from '@/components/auth/AuthShell'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const [displayed,    setDisplayed]   = useState(children)
  const pendingRef    = useRef(children)
  const prevPathname  = useRef(pathname)
  const contentRef    = useRef<HTMLDivElement>(null)
  const cardRef       = useRef<HTMLDivElement>(null)
  const animGenRef    = useRef(0)

  // Always up-to-date with the latest children from Next.js (runs before pathname effect)
  useEffect(() => {
    pendingRef.current = children
  })

  useEffect(() => {
    if (pathname === prevPathname.current) return
    prevPathname.current = pathname

    const contentEl = contentRef.current
    const cardEl    = cardRef.current

    if (reduitMouvement() || !contentEl || !cardEl) {
      setDisplayed(pendingRef.current)
      return
    }

    const gen = ++animGenRef.current

    // Phase 1 : fondu de sortie (140 ms)
    contentEl.style.opacity    = '0'
    contentEl.style.transform  = 'translateX(-10px)'
    contentEl.style.transition = 'opacity 140ms ease, transform 140ms ease'

    const outerTimer = setTimeout(() => {
      const startH = cardEl.offsetHeight

      // Bascule synchrone vers le nouveau contenu
      flushSync(() => setDisplayed(pendingRef.current))

      // Rétablit la visibilité du wrapper avant le prochain paint
      contentEl.style.transition = 'none'
      contentEl.style.opacity    = '1'
      contentEl.style.transform  = ''

      // Phase 2 : animation de la hauteur de la carte (280 ms)
      const endH = cardEl.offsetHeight

      if (Math.abs(endH - startH) > 1) {
        cardEl.style.height   = `${startH}px`
        cardEl.style.overflow = 'hidden'
        void cardEl.offsetWidth                               // force reflow
        cardEl.style.transition = 'height 280ms cubic-bezier(.2,.7,.2,1)'
        cardEl.style.height     = `${endH}px`

        setTimeout(() => {
          if (animGenRef.current !== gen) return
          cardEl.style.height     = ''
          cardEl.style.overflow   = ''
          cardEl.style.transition = ''
        }, 285)
      }
    }, 140)

    return () => {
      clearTimeout(outerTimer)
      contentEl.style.transition = 'none'
      contentEl.style.opacity    = '1'
      contentEl.style.transform  = ''
    }
  }, [pathname])

  return (
    <AuthShell cardRef={cardRef}>
      <div ref={contentRef}>
        {displayed}
      </div>
    </AuthShell>
  )
}
