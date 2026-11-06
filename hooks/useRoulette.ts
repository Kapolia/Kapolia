'use client'

import { useRef, useEffect } from 'react'
import type { RefObject, MutableRefObject } from 'react'
import { reduitMouvement } from '@/lib/motion'

export function useRoulette(
  colRef: RefObject<HTMLDivElement | null>,
  cardRefsMap: MutableRefObject<Map<string, HTMLElement>>,
  isSplit: boolean
): () => void {
  const rafRef = useRef<number | null>(null)

  function applyRoulette() {
    const col = colRef.current
    if (!col) return
    if (reduitMouvement()) {
      cardRefsMap.current.forEach(el => { el.style.transform = ''; el.style.opacity = ''; el.style.transformOrigin = '' })
      return
    }
    if (col.scrollHeight <= col.clientHeight + 1) {
      cardRefsMap.current.forEach(el => { el.style.transform = ''; el.style.opacity = ''; el.style.transformOrigin = '' })
      return
    }
    cardRefsMap.current.forEach(el => {
      if (!el.isConnected) return
      if (el.offsetParent !== col) return
      el.getAnimations().forEach(a => { if (a.playState === 'finished') a.cancel() })
      const h   = el.offsetHeight
      const top = el.offsetTop - col.scrollTop
      const bot = (col.scrollTop + col.clientHeight) - (el.offsetTop + el.offsetHeight)
      let t = 0, sens = 0, origin = '50% 50%'
      if      (top < 0) { t = Math.min(1, -top / h); sens =  1; origin = '50% 100%' }
      else if (bot < 0) { t = Math.min(1, -bot / h); sens = -1; origin = '50% 0%'   }
      if (t === 0) {
        el.style.transform = ''; el.style.opacity = ''; el.style.transformOrigin = ''
      } else {
        el.style.transformOrigin = origin
        el.style.transform       = `perspective(900px) rotateX(${sens * t * 38}deg) scale(${1 - 0.08 * t})`
        el.style.opacity         = String(1 - 0.55 * t)
      }
    })
  }

  function scheduleRoulette() {
    if (rafRef.current !== null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      applyRoulette()
    })
  }

  // Init quand le mode split s'active
  useEffect(() => {
    if (isSplit) requestAnimationFrame(scheduleRoulette)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSplit])

  // Recalcul quand la colonne change de hauteur
  useEffect(() => {
    if (!isSplit) return
    const col = colRef.current
    if (!col) return
    const ro = new ResizeObserver(scheduleRoulette)
    ro.observe(col)
    return () => ro.disconnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSplit])

  return scheduleRoulette
}
