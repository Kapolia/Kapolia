import { describe, it, expect } from 'vitest'
import { normaliserNomEntreprise } from '@/lib/entreprises-kapolia'

describe('normaliserNomEntreprise', () => {
  it('AKIOLIS → akiolis', () => {
    expect(normaliserNomEntreprise('AKIOLIS')).toBe('akiolis')
  })
  it('Akiolis → akiolis', () => {
    expect(normaliserNomEntreprise('Akiolis')).toBe('akiolis')
  })
  it('akiolis  (espaces en fin) → akiolis', () => {
    expect(normaliserNomEntreprise('akiolis  ')).toBe('akiolis')
  })
  it('AKIOLIS, Akiolis et akiolis  donnent le même résultat', () => {
    const a = normaliserNomEntreprise('AKIOLIS')
    const b = normaliserNomEntreprise('Akiolis')
    const c = normaliserNomEntreprise('akiolis  ')
    expect(a).toBe(b)
    expect(b).toBe(c)
  })
  it('Akiolis Conseil est différent de Akiolis', () => {
    expect(normaliserNomEntreprise('Akiolis Conseil')).not.toBe(normaliserNomEntreprise('Akiolis'))
  })
  it('accents retirés — Société Générale → societe generale', () => {
    expect(normaliserNomEntreprise('Société Générale')).toBe('societe generale')
  })
  it('espaces multiples internes collapsés', () => {
    expect(normaliserNomEntreprise('Cap  Gemini')).toBe('cap gemini')
  })
})
