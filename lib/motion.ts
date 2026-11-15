export const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)'

// ── Ressort ───────────────────────────────────────────────────────────────────

export const RESSORT_SUIVI = { raideur: 900, amortissement: 50 }
export const RESSORT_POSE  = { raideur: 280, amortissement: 22 }
export const RESSORT_POP   = { raideur: 520, amortissement: 16 }

import { useRef, useState, useEffect } from 'react'

export function useRessort(
  cible: number,
  { raideur, amortissement }: { raideur: number; amortissement: number }
): number {
  const [valeur, setValeur] = useState(cible)
  const etat = useRef({ x: cible, v: 0 })
  const rafRef = useRef<number | null>(null)
  const prevT = useRef<number | null>(null)
  const cibleRef = useRef(cible)

  useEffect(() => { cibleRef.current = cible }, [cible])

  useEffect(() => {
    const amorti = reduitMouvement()
      ? 2 * Math.sqrt(raideur)
      : amortissement

    function tick(t: number) {
      const dt = prevT.current !== null ? Math.min((t - prevT.current) / 1000, 1 / 30) : 0
      prevT.current = t
      const pas = dt / 4
      let { x, v } = etat.current
      const c = cibleRef.current
      for (let i = 0; i < 4; i++) {
        const a = -raideur * (x - c) - amorti * v
        v += a * pas
        x += v * pas
      }
      etat.current = { x, v }
      setValeur(x)
      if (Math.abs(x - c) > 0.001 || Math.abs(v) > 0.001) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        etat.current = { x: c, v: 0 }
        setValeur(c)
        rafRef.current = null
        prevT.current = null
      }
    }

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    prevT.current = null
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current) }
  }, [cible, raideur, amortissement])

  return valeur
}

export function reduitMouvement(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// ── Panneau droit ─────────────────────────────────────────────────────────────

export function fondurPanneau(el: HTMLElement, onFinish: () => void): void {
  el.getAnimations().forEach(a => a.cancel())
  const anim = el.animate(
    [{ opacity: '1' }, { opacity: '0' }],
    { duration: 100, easing: 'ease-out' }
  )
  anim.onfinish = () => {
    el.style.opacity = '0'
    onFinish()
  }
}

export function entrerPanneau(el: HTMLElement): void {
  el.style.opacity = ''
  el.animate(
    [{ opacity: '0', transform: 'translateY(6px)' }, { opacity: '1', transform: 'translateY(0)' }],
    { duration: 240, easing: EASE }
  )
}

// ── Cartes ────────────────────────────────────────────────────────────────────

export function sortirCartes(elements: HTMLElement[]): void {
  elements.forEach(el => {
    if (el.isConnected) el.animate(
      [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.97)' }],
      { duration: 160, easing: 'ease-in', fill: 'forwards' }
    )
  })
}

export type CardPos = { top: number; left: number }

/**
 * Mesure les nouvelles positions des cartes, anime (cascade ou FLIP selon le contexte),
 * et renvoie la Map des nouvelles positions à stocker dans prevPositionsRef.
 * N'anime pas si prefers-reduced-motion est actif.
 */
export function animerCartes(
  cards: NodeListOf<HTMLElement> | HTMLElement[],
  prevPositions: Map<string, CardPos>
): Map<string, CardPos> {
  const cardArr = Array.from(cards)
  const newPositions = new Map<string, CardPos>()
  cardArr.forEach(card => { newPositions.set(card.dataset.cardId!, { top: card.offsetTop, left: card.offsetLeft }) })

  if (!reduitMouvement()) {
    const isEntrance = prevPositions.size === 0
    if (isEntrance) {
      cardArr.forEach((card, i) => card.animate(
        [{ opacity: '0', transform: 'translateY(8px)' }, { opacity: '1', transform: 'translateY(0)' }],
        { duration: 420, easing: EASE, delay: i * 45, fill: 'both' }
      ))
    } else {
      let enterIdx = 0
      cardArr.forEach(card => {
        const id   = card.dataset.cardId!
        const prev = prevPositions.get(id)
        const next = newPositions.get(id)!
        if (prev) {
          const dy = prev.top - next.top
          if (Math.abs(dy) > 1) card.animate(
            [{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }],
            { duration: 320, easing: EASE }
          )
        } else {
          card.animate(
            [{ opacity: '0', transform: 'translateY(8px)' }, { opacity: '1', transform: 'translateY(0)' }],
            { duration: 360, easing: EASE, delay: 120 + enterIdx * 30, fill: 'both' }
          )
          enterIdx++
        }
      })
    }
  }

  return newPositions
}
