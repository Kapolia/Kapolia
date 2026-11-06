'use client'

import { useEffect } from 'react'
import type { RefObject, MutableRefObject } from 'react'
import { reduitMouvement } from '@/lib/motion'

export function useNavigationClavier(
  displayedRef: MutableRefObject<{ id: string }[]>,
  selectedIdRef: MutableRefObject<string | null>,
  onSelect: (id: string) => void,
  cardRefsMap: MutableRefObject<Map<string, HTMLElement>>,
  colRef: RefObject<HTMLDivElement | null>,
  isSplit: boolean
): void {
  useEffect(() => {
    if (!isSplit) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      const tag = (document.activeElement as HTMLElement | null)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return
      if (document.querySelector('[data-kapolia-filter-portal]')) return
      const list = displayedRef.current
      if (list.length === 0) return
      const curIdx = list.findIndex(o => o.id === selectedIdRef.current)
      let nextIdx  = curIdx
      if (e.key === 'ArrowDown') nextIdx = Math.min(list.length - 1, curIdx + 1)
      if (e.key === 'ArrowUp')   nextIdx = Math.max(0, curIdx - 1)
      if (nextIdx === curIdx) return
      e.preventDefault()
      const nextId = list[nextIdx].id
      onSelect(nextId)
      requestAnimationFrame(() => {
        const el  = cardRefsMap.current.get(nextId)
        const col = colRef.current
        if (!el || !col) return
        el.focus({ preventScroll: true })
        const r    = el.getBoundingClientRect()
        const colR = col.getBoundingClientRect()
        if (r.top < colR.top || r.bottom > colR.bottom) {
          el.scrollIntoView({ block: 'nearest', behavior: reduitMouvement() ? 'instant' : 'smooth' })
        }
      })
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSplit])
}
