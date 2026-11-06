export const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)'

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

/**
 * Mesure les nouvelles positions des cartes, anime (cascade ou FLIP selon le contexte),
 * et renvoie la Map des nouvelles positions à stocker dans prevPositionsRef.
 * N'anime pas si prefers-reduced-motion est actif.
 */
export function animerCartes(
  cards: NodeListOf<HTMLElement> | HTMLElement[],
  prevPositions: Map<string, DOMRect>
): Map<string, DOMRect> {
  const cardArr = Array.from(cards)
  const newPositions = new Map<string, DOMRect>()
  cardArr.forEach(card => { newPositions.set(card.dataset.cardId!, card.getBoundingClientRect()) })

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
