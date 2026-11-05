import { describe, it, expect } from 'vitest'
import {
  offreAvecTeletravail,
  labelDe,
  TYPES_CONTRAT,
  TELETRAVAIL,
  TELETRAVAIL_OPTIONS,
  DUREES_CONTRAT,
  TEMPS_TRAVAIL,
  HORAIRES,
  PERMIS,
} from '@/lib/referentiels'

// ─── offreAvecTeletravail ─────────────────────────────────────────────────────

describe('offreAvecTeletravail', () => {
  it('renvoie true pour 100% remote', () => {
    expect(offreAvecTeletravail('100% remote')).toBe(true)
  })
  it('renvoie true pour Hybride', () => {
    expect(offreAvecTeletravail('Hybride')).toBe(true)
  })
  it('renvoie true pour Occasionnel', () => {
    expect(offreAvecTeletravail('Occasionnel')).toBe(true)
  })
  it('renvoie false pour 100% présentiel', () => {
    expect(offreAvecTeletravail('100% présentiel')).toBe(false)
  })
  it('renvoie false pour null', () => {
    expect(offreAvecTeletravail(null)).toBe(false)
  })
  it('renvoie false pour undefined', () => {
    expect(offreAvecTeletravail(undefined)).toBe(false)
  })
  it('renvoie false pour une valeur inconnue', () => {
    expect(offreAvecTeletravail('Flexible')).toBe(false)
  })
})

// ─── labelDe — tableau de chaînes (TYPES_CONTRAT) ─────────────────────────────

describe('labelDe avec string[]', () => {
  it('renvoie la valeur si elle est dans le tableau', () => {
    expect(labelDe(TYPES_CONTRAT, 'CDI')).toBe('CDI')
  })
  it('renvoie la valeur pour Saisonnier', () => {
    expect(labelDe(TYPES_CONTRAT, 'Saisonnier')).toBe('Saisonnier')
  })
  it('renvoie null pour une valeur absente', () => {
    expect(labelDe(TYPES_CONTRAT, 'Inconnu')).toBeNull()
  })
  it('renvoie null pour un tableau vide', () => {
    expect(labelDe([], 'CDI')).toBeNull()
  })
})

// ─── labelDe — Record<string, string> (TELETRAVAIL) ───────────────────────────

describe('labelDe avec Record', () => {
  it('renvoie le label pour 100% remote', () => {
    expect(labelDe(TELETRAVAIL, '100% remote')).toBe('Télétravail complet')
  })
  it('renvoie le label pour Hybride', () => {
    expect(labelDe(TELETRAVAIL, 'Hybride')).toBe('Télétravail partiel')
  })
  it('renvoie le label pour Occasionnel', () => {
    expect(labelDe(TELETRAVAIL, 'Occasionnel')).toBe('Télétravail occasionnel')
  })
  it('renvoie le label pour 100% présentiel', () => {
    expect(labelDe(TELETRAVAIL, '100% présentiel')).toBe('Pas de télétravail')
  })
  it('renvoie null pour une clé inconnue', () => {
    expect(labelDe(TELETRAVAIL, 'Flexible')).toBeNull()
  })
})

// ─── labelDe — tableau { value, label } ──────────────────────────────────────

describe('labelDe avec { value, label }[]', () => {
  it('renvoie le label pour DUREES_CONTRAT moins_3', () => {
    expect(labelDe(DUREES_CONTRAT, 'moins_3')).toBe('Moins de 3 mois')
  })
  it('renvoie le label pour DUREES_CONTRAT plus_12', () => {
    expect(labelDe(DUREES_CONTRAT, 'plus_12')).toBe('Plus de 12 mois')
  })
  it('renvoie null pour une valeur absente dans DUREES_CONTRAT', () => {
    expect(labelDe(DUREES_CONTRAT, '12_18')).toBeNull()
  })
  it('renvoie le label pour TEMPS_TRAVAIL', () => {
    expect(labelDe(TEMPS_TRAVAIL, 'temps_plein')).toBe('Temps plein')
    expect(labelDe(TEMPS_TRAVAIL, 'temps_partiel')).toBe('Temps partiel')
  })
  it('renvoie le label pour HORAIRES', () => {
    expect(labelDe(HORAIRES, 'journee')).toBe('Travail en journée')
    expect(labelDe(HORAIRES, 'nuit')).toBe('Travail de nuit')
    expect(labelDe(HORAIRES, 'week_end')).toBe('Le week-end')
    expect(labelDe(HORAIRES, 'equipes')).toBe('En équipes alternées')
  })
  it('renvoie le label pour PERMIS', () => {
    expect(labelDe(PERMIS, 'B')).toBe('Permis B')
    expect(labelDe(PERMIS, 'C_CE')).toBe('Permis C ou CE')
    expect(labelDe(PERMIS, 'CACES')).toBe('CACES')
  })
  it('renvoie null pour PERMIS valeur inconnue', () => {
    expect(labelDe(PERMIS, 'A')).toBeNull()
  })
  it('fonctionne avec TELETRAVAIL_OPTIONS (label court)', () => {
    expect(labelDe(TELETRAVAIL_OPTIONS, '100% remote')).toBe('Complet')
    expect(labelDe(TELETRAVAIL_OPTIONS, 'Occasionnel')).toBe('Occasionnel')
    expect(labelDe(TELETRAVAIL_OPTIONS, 'inconnu')).toBeNull()
  })
})
