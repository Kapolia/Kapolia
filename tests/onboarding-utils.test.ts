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
  environnement: ['startup'], projet: 'Mon projet phare', projet_titre: 'Mon titre de projet',
  passions: ['Musique'],
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

  it('returns 5 when steps 1–3 complete but step5Done is false (default)', () => {
    const d = { ...EMPTY_FORM, prenom: 'Alice', nom: 'Martin', domaine: 'Tech', experience: '2–5 ans' }
    expect(firstIncompleteStep(d)).toBe(5)
  })

  it('returns 5 when steps 1–3 complete and step5Done is explicitly false', () => {
    const d = { ...EMPTY_FORM, prenom: 'Alice', nom: 'Martin', domaine: 'Tech', experience: '2–5 ans' }
    expect(firstIncompleteStep(d, false)).toBe(5)
  })

  it('returns 6 when steps 1–5 complete (step5Done=true) but environnement missing', () => {
    const d = { ...EMPTY_FORM, prenom: 'Alice', nom: 'Martin', domaine: 'Tech', experience: '2–5 ans' }
    expect(firstIncompleteStep(d, true)).toBe(6)
  })

  it('returns 10 when steps 1–6 complete but typePoste empty', () => {
    const d = { ...EMPTY_FORM, prenom: 'Alice', nom: 'Martin', domaine: 'Tech', experience: '2–5 ans', environnement: ['startup'] }
    expect(firstIncompleteStep(d, true)).toBe(10)
  })

  it('returns 11 when steps 1–10 complete but lieu missing', () => {
    const d = { ...EMPTY_FORM, prenom: 'Alice', nom: 'Martin', domaine: 'Tech', experience: '2–5 ans', environnement: ['startup'], typePoste: ['cdi'] }
    expect(firstIncompleteStep(d, true)).toBe(11)
  })

  it('returns 13 when steps 1–11 complete but disponibilite missing', () => {
    const d = { ...EMPTY_FORM, prenom: 'Alice', nom: 'Martin', domaine: 'Tech', experience: '2–5 ans', environnement: ['startup'], typePoste: ['cdi'], lieu: 'hybride' }
    expect(firstIncompleteStep(d, true)).toBe(13)
  })

  it('returns ONBOARDING_TOTAL (15) when all required fields filled and step5Done=true', () => {
    expect(firstIncompleteStep(FULL, true)).toBe(ONBOARDING_TOTAL)
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

  it('returns null for step 5 (persistence handled by QualitesCarousel)', () => {
    expect(buildStepPayload(5, EMPTY_FORM, MAX)).toBeNull()
    expect(buildStepPayload(5, FULL, MAX)).toBeNull()
  })

  it('returns payload for step 6 with mode_travail as array', () => {
    const result = buildStepPayload(6, { ...EMPTY_FORM, environnement: ['startup'] }, MAX)
    expect(result).toMatchObject({ mode_travail: ['startup'], onboarding_step: MAX })
  })

  it('returns payload for step 6 with multiple values', () => {
    const result = buildStepPayload(6, { ...EMPTY_FORM, environnement: ['startup', 'scaleup'] }, MAX)
    expect(result).toMatchObject({ mode_travail: ['startup', 'scaleup'], onboarding_step: MAX })
  })

  it('returns payload for step 6 with sans_pref', () => {
    const result = buildStepPayload(6, { ...EMPTY_FORM, environnement: ['sans_pref'] }, MAX)
    expect(result).toMatchObject({ mode_travail: ['sans_pref'], onboarding_step: MAX })
  })

  it('returns null for step 6 when environnement is empty', () => {
    expect(buildStepPayload(6, EMPTY_FORM, MAX)).toBeNull()
  })

  it('returns null for step 7 when projet is empty', () => {
    expect(buildStepPayload(7, EMPTY_FORM, MAX)).toBeNull()
  })

  it('returns payload for step 7 with projet_phare key', () => {
    const result = buildStepPayload(7, { ...EMPTY_FORM, projet: 'Mon projet' }, MAX)
    expect(result).toMatchObject({ projet_phare: 'Mon projet', onboarding_step: MAX })
  })

  it('returns payload for step 7 with both projet_phare and projet_titre', () => {
    const result = buildStepPayload(7, { ...EMPTY_FORM, projet: 'Mon projet', projet_titre: 'Mon titre' }, MAX)
    expect(result).toMatchObject({ projet_phare: 'Mon projet', projet_titre: 'Mon titre', onboarding_step: MAX })
  })

  it('returns null for projet_titre when projet_titre is empty string', () => {
    const result = buildStepPayload(7, { ...EMPTY_FORM, projet: 'Mon projet', projet_titre: '' }, MAX)
    expect(result).toMatchObject({ projet_phare: 'Mon projet', projet_titre: null, onboarding_step: MAX })
  })

  it('returns null for step 8 when passions is empty array', () => {
    expect(buildStepPayload(8, EMPTY_FORM, MAX)).toBeNull()
  })

  it('returns payload for step 8', () => {
    const result = buildStepPayload(8, { ...EMPTY_FORM, passions: ['Musique'] }, MAX)
    expect(result).toMatchObject({ passions: ['Musique'], onboarding_step: MAX })
  })

  it('returns null for step 10 when lieu and ville are both empty', () => {
    expect(buildStepPayload(10, EMPTY_FORM, MAX)).toBeNull()
  })

  it('returns payload for step 10 with only lieu', () => {
    const result = buildStepPayload(10, { ...EMPTY_FORM, lieu: 'hybride' }, MAX)
    expect(result).toMatchObject({ structure: 'hybride', onboarding_step: MAX })
    expect(result).not.toHaveProperty('ville')
  })

  it('returns payload for step 10 with both lieu and ville', () => {
    const result = buildStepPayload(10, { ...EMPTY_FORM, lieu: 'hybride', ville: 'Paris' }, MAX)
    expect(result).toMatchObject({ structure: 'hybride', ville: 'Paris', onboarding_step: MAX })
  })

  it('step 12 returns null when disponibilite is empty', () => {
    expect(buildStepPayload(12, EMPTY_FORM, MAX)).toBeNull()
  })

  it('step 12 sets dispo_date to null when disponibilite is not a_partir_de', () => {
    const result = buildStepPayload(12, { ...EMPTY_FORM, disponibilite: 'maintenant', dispo_date: '2024-06-01' }, MAX)
    expect(result).toMatchObject({ disponibilite: 'maintenant', dispo_date: null, onboarding_step: MAX })
  })

  it('step 12 sets dispo_date when disponibilite is a_partir_de', () => {
    const result = buildStepPayload(12, { ...EMPTY_FORM, disponibilite: 'a_partir_de', dispo_date: '2024-06-01' }, MAX)
    expect(result).toMatchObject({ disponibilite: 'a_partir_de', dispo_date: '2024-06-01', onboarding_step: MAX })
  })

  it('step 12 sets dispo_date to null when a_partir_de but no date provided', () => {
    const result = buildStepPayload(12, { ...EMPTY_FORM, disponibilite: 'a_partir_de', dispo_date: '' }, MAX)
    expect(result).toMatchObject({ disponibilite: 'a_partir_de', dispo_date: null, onboarding_step: MAX })
  })

  it('returns null for step 13 when experiences is empty', () => {
    expect(buildStepPayload(13, EMPTY_FORM, MAX)).toBeNull()
  })

  it('returns null for step 14 when diplomes is empty', () => {
    expect(buildStepPayload(14, EMPTY_FORM, MAX)).toBeNull()
  })

  it('returns null for unknown steps (0, 15, 99)', () => {
    expect(buildStepPayload(0,  EMPTY_FORM, MAX)).toBeNull()
    expect(buildStepPayload(15, EMPTY_FORM, MAX)).toBeNull()
    expect(buildStepPayload(99, EMPTY_FORM, MAX)).toBeNull()
  })

  it('always includes onboarding_step in every non-null payload', () => {
    const steps = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
    for (const s of steps) {
      const result = buildStepPayload(s, FULL, MAX)
      if (result !== null) {
        expect(result).toHaveProperty('onboarding_step', MAX)
      }
    }
  })

  it('never includes onboarding_completed in any payload', () => {
    const steps = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
    for (const s of steps) {
      const result = buildStepPayload(s, FULL, MAX)
      if (result !== null) {
        expect(result).not.toHaveProperty('onboarding_completed')
      }
    }
  })

  it('onboarding_step reflects the maxStep passed, not the current step', () => {
    const result = buildStepPayload(2, { ...EMPTY_FORM, domaine: 'Tech' }, 10)
    expect(result?.onboarding_step).toBe(10)
  })
})
