import { describe, it, expect } from 'vitest'
import { scoreBreakdownCandidat, type ProfilMatch, type OffreMatch } from '@/lib/matching'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function p(mode_travail: string | null, ville?: string): ProfilMatch {
  return { domaine: 'Tech & Ingénierie', experience: '3-5 ans', mode_travail, ville: ville ?? null }
}

function o(mode_travail: string | null, ville?: string): OffreMatch {
  return { domaine: 'Tech & Ingénierie', experience: '3-5 ans', mode_travail, ville: ville ?? null }
}

function loc(profil: ProfilMatch, offre: OffreMatch) {
  return scoreBreakdownCandidat(profil, offre).localisation
}

// ─── Nouvelles combinaisons — profil 'occasionnel' × offres remote/hybride ───

describe('profil occasionnel × offre remote ou hybride', () => {

  it('offre remote × profil occasionnel → 4', () => {
    const r = loc(p('occasionnel'), o('100% remote'))
    expect(r).not.toBeNull()
    expect(r!.earned).toBe(4)
    expect(r!.weight).toBe(12)
  })

  it('offre hybride × profil occasionnel → 8', () => {
    const r = loc(p('occasionnel'), o('Hybride'))
    expect(r).not.toBeNull()
    expect(r!.earned).toBe(8)
    expect(r!.weight).toBe(12)
  })

})

// ─── Nouvelles combinaisons — offre 'Occasionnel' × tous les profils ─────────

describe('offre Occasionnel × profil (ville correcte)', () => {

  it('× profil remote → 5', () => {
    const r = loc(p('remote', 'paris'), o('Occasionnel', 'paris'))
    expect(r).not.toBeNull()
    expect(r!.earned).toBe(5)
    expect(r!.weight).toBe(12)
  })

  it('× profil hybride → 11', () => {
    const r = loc(p('hybride', 'paris'), o('Occasionnel', 'paris'))
    expect(r).not.toBeNull()
    expect(r!.earned).toBe(11)
  })

  it('× profil occasionnel → 12', () => {
    const r = loc(p('occasionnel', 'paris'), o('Occasionnel', 'paris'))
    expect(r).not.toBeNull()
    expect(r!.earned).toBe(12)
  })

  it('× profil presentiel → 10', () => {
    const r = loc(p('presentiel', 'paris'), o('Occasionnel', 'paris'))
    expect(r).not.toBeNull()
    expect(r!.earned).toBe(10)
  })

  it('× profil flexible → 10', () => {
    const r = loc(p('flexible', 'paris'), o('Occasionnel', 'paris'))
    expect(r).not.toBeNull()
    expect(r!.earned).toBe(10)
  })

})

describe('offre Occasionnel × profil (villes différentes → 0 pour tous)', () => {

  it('× profil remote, villes différentes → 0', () => {
    const r = loc(p('remote', 'paris'), o('Occasionnel', 'lyon'))
    expect(r).not.toBeNull()
    expect(r!.earned).toBe(0)
  })

  it('× profil occasionnel, villes différentes → 0', () => {
    const r = loc(p('occasionnel', 'paris'), o('Occasionnel', 'lyon'))
    expect(r).not.toBeNull()
    expect(r!.earned).toBe(0)
  })

  it('× profil hybride, villes différentes → 0', () => {
    const r = loc(p('hybride', 'paris'), o('Occasionnel', 'lyon'))
    expect(r).not.toBeNull()
    expect(r!.earned).toBe(0)
  })

})

// ─── Contrats : intérim, saisonnier, stage ────────────────────────────────────

function contrat(typePoste: string[], typeContrat: string) {
  const profil: ProfilMatch = { domaine: 'Tech & Ingénierie', experience: '3-5 ans', mode_travail: null, type_poste: typePoste }
  const offre:  OffreMatch  = { domaine: 'Tech & Ingénierie', experience: '3-5 ans', mode_travail: null, type_contrat: typeContrat }
  return scoreBreakdownCandidat(profil, offre).contrat
}

describe('contrats interim et saisonnier', () => {
  it('candidat interim × offre Intérim → score plein', () => {
    expect(contrat(['interim'], 'Intérim')?.earned).toBeGreaterThan(0)
  })
  it('candidat saisonnier × offre Saisonnier → score plein', () => {
    expect(contrat(['saisonnier'], 'Saisonnier')?.earned).toBeGreaterThan(0)
  })
  it('candidat cdi × offre Intérim → 0', () => {
    expect(contrat(['cdi'], 'Intérim')?.earned).toBe(0)
  })
  it('candidat cdi × offre Saisonnier → 0', () => {
    expect(contrat(['cdi'], 'Saisonnier')?.earned).toBe(0)
  })
})

describe('stage séparé de alternance', () => {
  it('candidat stage × offre Stage → score plein', () => {
    expect(contrat(['stage'], 'Stage')?.earned).toBeGreaterThan(0)
  })
  it('candidat alternance seul × offre Stage → 0', () => {
    expect(contrat(['alternance'], 'Stage')?.earned).toBe(0)
  })
  it('candidat alternance + stage × offre Stage → score plein', () => {
    expect(contrat(['alternance', 'stage'], 'Stage')?.earned).toBeGreaterThan(0)
  })
})

// ─── Offre présentiel × profil occasionnel ────────────────────────────────────

describe('offre présentiel × profil occasionnel', () => {

  it('ville correcte → 10', () => {
    const r = loc(p('occasionnel', 'paris'), o('100% présentiel', 'paris'))
    expect(r).not.toBeNull()
    expect(r!.earned).toBe(10)
  })

  it('villes différentes → 0', () => {
    const r = loc(p('occasionnel', 'paris'), o('100% présentiel', 'lyon'))
    expect(r).not.toBeNull()
    expect(r!.earned).toBe(0)
  })

})
