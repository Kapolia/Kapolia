import { describe, it, expect } from 'vitest'
import {
  firstIncompleteStep,
  buildStepPayload,
  ONBOARDING_TOTAL,
  EMPTY_FORM,
} from '@/lib/onboarding-utils'
import type { OnboardingFormData } from '@/lib/onboarding-utils'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FULL: OnboardingFormData = {
  prenom: 'Alice', nom: 'Martin', domaine: 'Tech & Ingénierie',
  experience: '2–5 ans', parcours: 'Mon parcours',
  mots: ['Curieux', 'Rigoureux', 'Empathique'],
  environnement: 'startup', defi: 'analyse', projet: 'Mon projet phare',
  passions: ['Musique'], sideProject: 'Un side project',
  disponibilite: 'maintenant', dispo_date: '',
  typePoste: ['cdi'], lieu: 'hybride', ville: 'Paris',
  priorite: ['Impact réel'],
  experiences: [{ poste: 'Dev', entreprise: 'Acme', date_debut: '2020', date_fin: '', en_poste: true, missions: 'Coder' }],
  diplomes: [{ intitule: 'Master', ecole: 'EPFL', annee: '2020', mention: 'TB' }],
  competences_acquises: ['TypeScript'], langues: ['Français'],
}

// ─── firstIncompleteStep ──────────────────────────────────────────────────────

describe('firstIncompleteStep', () => {
  it('returns 1 when form is empty', () => {
    expect(firstIncompleteStep(EMPTY_FORM)).toBe(1)
  })

  it('returns 1 when only prenom is filled', () => {
    expect(firstIncompleteStep({ ...EMPTY_FORM, prenom: 'Alice' })).toBe(1)
  })

  it('returns 1 when only nom is filled', () => {
    expect(firstIncompleteStep({ ...EMPTY_FORM, nom: 'Martin' })).toBe(1)
  })

  it('returns 2 when step 1 is complete but domaine missing', () => {
    expect(firstIncompleteStep({ ...EMPTY_FORM, prenom: 'Alice', nom: 'Martin' })).toBe(2)
  })

  it('returns 3 when steps 1–2 complete but experience missing', () => {
    expect(firstIncompleteStep({ ...EMPTY_FORM, prenom: 'Alice', nom: 'Martin', domaine: 'Tech & Ingénierie' })).toBe(3)
  })

  it('returns 5 when steps 1–3 complete but mots incomplete', () => {
    const d = { ...EMPTY_FORM, prenom: 'Alice', nom: 'Martin', domaine: 'Tech', experience: '2–5 ans', mots: ['A', '', 'C'] as [string, string, string] }
    expect(firstIncompleteStep(d)).toBe(5)
  })

  it('returns 5 when all mots are whitespace-only', () => {
    const d = { ...EMPTY_FORM, prenom: 'Alice', nom: 'Martin', domaine: 'Tech', experience: '2–5 ans', mots: [' ', ' ', ' '] as [string, string, string] }
    expect(firstIncompleteStep(d)).toBe(5)
  })

  it('returns 6 when steps 1–5 complete but environnement missing', () => {
    const d = { ...EMPTY_FORM, prenom: 'Alice', nom: 'Martin', domaine: 'Tech', experience: '2–5 ans', mots: ['A', 'B', 'C'] as [string, string, string] }
    expect(firstIncompleteStep(d)).toBe(6)
  })

  it('returns 11 when steps 1–6 complete but typePoste empty', () => {
    const d = { ...EMPTY_FORM, prenom: 'Alice', nom: 'Martin', domaine: 'Tech', experience: '2–5 ans', mots: ['A', 'B', 'C'] as [string, string, string], environnement: 'startup' }
    expect(firstIncompleteStep(d)).toBe(11)
  })

  it('returns 12 when steps 1–11 complete but lieu missing', () => {
    const d = { ...EMPTY_FORM, prenom: 'Alice', nom: 'Martin', domaine: 'Tech', experience: '2–5 ans', mots: ['A', 'B', 'C'] as [string, string, string], environnement: 'startup', typePoste: ['cdi'] }
    expect(firstIncompleteStep(d)).toBe(12)
  })

  it('returns 14 when steps 1–12 complete but disponibilite missing', () => {
    const d = { ...EMPTY_FORM, prenom: 'Alice', nom: 'Martin', domaine: 'Tech', experience: '2–5 ans', mots: ['A', 'B', 'C'] as [string, string, string], environnement: 'startup', typePoste: ['cdi'], lieu: 'hybride' }
    expect(firstIncompleteStep(d)).toBe(14)
  })

  it('returns ONBOARDING_TOTAL (17) when all required fields filled', () => {
    expect(firstIncompleteStep(FULL)).toBe(ONBOARDING_TOTAL)
  })
})

// ─── buildStepPayload ─────────────────────────────────────────────────────────

describe('buildStepPayload', () => {
  const MAX = 5

  it('returns null for step 1 when both prenom and nom are empty', () => {
    expect(buildStepPayload(1, EMPTY_FORM, MAX)).toBeNull()
  })

  it('returns payload for step 1 when prenom only is filled', () => {
    const result = buildStepPayload(1, { ...EMPTY_FORM, prenom: 'Alice' }, MAX)
    expect(result).toMatchObject({ prenom: 'Alice', nom: '', onboarding_step: MAX })
  })

  it('returns payload for step 1 when both are filled', () => {
    const result = buildStepPayload(1, { ...EMPTY_FORM, prenom: 'Alice', nom: 'Martin' }, MAX)
    expect(result).toMatchObject({ prenom: 'Alice', nom: 'Martin', onboarding_step: MAX })
  })

  it('returns null for step 2 when domaine is empty', () => {
    expect(buildStepPayload(2, EMPTY_FORM, MAX)).toBeNull()
  })

  it('returns payload for step 2 when domaine is set', () => {
    const result = buildStepPayload(2, { ...EMPTY_FORM, domaine: 'Tech' }, MAX)
    expect(result).toMatchObject({ domaine: 'Tech', onboarding_step: MAX })
  })

  it('returns null for step 3 when experience is empty', () => {
    expect(buildStepPayload(3, EMPTY_FORM, MAX)).toBeNull()
  })

  it('returns null for step 4 when parcours is whitespace', () => {
    expect(buildStepPayload(4, { ...EMPTY_FORM, parcours: '  ' }, MAX)).toBeNull()
  })

  it('returns payload for step 4 with signature key', () => {
    const result = buildStepPayload(4, { ...EMPTY_FORM, parcours: 'Mon parcours' }, MAX)
    expect(result).toMatchObject({ signature: 'Mon parcours', onboarding_step: MAX })
  })

  it('returns null for step 5 when mots incomplete', () => {
    expect(buildStepPayload(5, { ...EMPTY_FORM, mots: ['A', '', 'C'] }, MAX)).toBeNull()
  })

  it('returns payload for step 5 with qualites key', () => {
    const result = buildStepPayload(5, { ...EMPTY_FORM, mots: ['A', 'B', 'C'] }, MAX)
    expect(result).toMatchObject({ qualites: ['A', 'B', 'C'], onboarding_step: MAX })
  })

  it('returns payload for step 6 with mode_travail as array', () => {
    const result = buildStepPayload(6, { ...EMPTY_FORM, environnement: 'startup' }, MAX)
    expect(result).toMatchObject({ mode_travail: ['startup'], onboarding_step: MAX })
  })

  it('returns payload for step 7 with valeur key', () => {
    const result = buildStepPayload(7, { ...EMPTY_FORM, defi: 'analyse' }, MAX)
    expect(result).toMatchObject({ valeur: 'analyse', onboarding_step: MAX })
  })

  it('returns null for step 9 when passions is empty array', () => {
    expect(buildStepPayload(9, EMPTY_FORM, MAX)).toBeNull()
  })

  it('returns payload for step 9', () => {
    const result = buildStepPayload(9, { ...EMPTY_FORM, passions: ['Musique'] }, MAX)
    expect(result).toMatchObject({ passions: ['Musique'], onboarding_step: MAX })
  })

  it('returns null for step 12 when lieu and ville are both empty', () => {
    expect(buildStepPayload(12, EMPTY_FORM, MAX)).toBeNull()
  })

  it('returns payload for step 12 with only lieu', () => {
    const result = buildStepPayload(12, { ...EMPTY_FORM, lieu: 'hybride' }, MAX)
    expect(result).toMatchObject({ structure: 'hybride', onboarding_step: MAX })
    expect(result).not.toHaveProperty('ville')
  })

  it('returns payload for step 12 with both lieu and ville', () => {
    const result = buildStepPayload(12, { ...EMPTY_FORM, lieu: 'hybride', ville: 'Paris' }, MAX)
    expect(result).toMatchObject({ structure: 'hybride', ville: 'Paris', onboarding_step: MAX })
  })

  it('step 14 returns null when disponibilite is empty', () => {
    expect(buildStepPayload(14, EMPTY_FORM, MAX)).toBeNull()
  })

  it('step 14 sets dispo_date to null when disponibilite is not a_partir_de', () => {
    const result = buildStepPayload(14, { ...EMPTY_FORM, disponibilite: 'maintenant', dispo_date: '2024-06-01' }, MAX)
    expect(result).toMatchObject({ disponibilite: 'maintenant', dispo_date: null, onboarding_step: MAX })
  })

  it('step 14 sets dispo_date when disponibilite is a_partir_de', () => {
    const result = buildStepPayload(14, { ...EMPTY_FORM, disponibilite: 'a_partir_de', dispo_date: '2024-06-01' }, MAX)
    expect(result).toMatchObject({ disponibilite: 'a_partir_de', dispo_date: '2024-06-01', onboarding_step: MAX })
  })

  it('step 14 sets dispo_date to null when a_partir_de but no date provided', () => {
    const result = buildStepPayload(14, { ...EMPTY_FORM, disponibilite: 'a_partir_de', dispo_date: '' }, MAX)
    expect(result).toMatchObject({ disponibilite: 'a_partir_de', dispo_date: null, onboarding_step: MAX })
  })

  it('returns null for step 15 when experiences is empty', () => {
    expect(buildStepPayload(15, EMPTY_FORM, MAX)).toBeNull()
  })

  it('returns null for step 16 when diplomes is empty', () => {
    expect(buildStepPayload(16, EMPTY_FORM, MAX)).toBeNull()
  })

  it('returns null for unknown steps (0, 17, 99)', () => {
    expect(buildStepPayload(0,  EMPTY_FORM, MAX)).toBeNull()
    expect(buildStepPayload(17, EMPTY_FORM, MAX)).toBeNull()
    expect(buildStepPayload(99, EMPTY_FORM, MAX)).toBeNull()
  })

  it('always includes onboarding_step in every non-null payload', () => {
    const steps = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
    for (const s of steps) {
      const result = buildStepPayload(s, FULL, MAX)
      if (result !== null) {
        expect(result).toHaveProperty('onboarding_step', MAX)
      }
    }
  })

  it('never includes onboarding_completed in any payload', () => {
    const steps = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
    for (const s of steps) {
      const result = buildStepPayload(s, FULL, MAX)
      expect(result).not.toHaveProperty('onboarding_completed')
    }
  })

  it('onboarding_step reflects the maxStep passed, not the current step', () => {
    const result = buildStepPayload(2, { ...EMPTY_FORM, domaine: 'Tech' }, 10)
    expect(result?.onboarding_step).toBe(10)
  })
})
