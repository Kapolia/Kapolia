export function largeurUtile(): number {
  if (typeof window === 'undefined') return 1200
  const zoom = parseFloat(getComputedStyle(document.documentElement).zoom) || 1
  return window.innerWidth / zoom
}
