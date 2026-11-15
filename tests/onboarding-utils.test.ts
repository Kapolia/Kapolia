import { describe, it, expect } from 'vitest'
import {
  firstIncompleteStep,
  buildStepPayload,
  convertSavedStep,
  screenToStep,
  stepToScreen,
  ONBOARDING_TOTAL,
  LAST_STEP,
  STEP_OFFSET,
  EMPTY_FORM,
} from '@/lib/onboarding-utils'
import type { OnboardingFormData } from '@/lib/onboarding-utils'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FULL: OnboardingFormData = {
  prenom: 'Alice', nom: 'Martin', domaine: 'Tech & Ingénierie',
  experience: '3-5 ans', parcours: 'Mon parcours',
  projet: 'Mon projet phare', projet_titre: 'Mon titre',
  passions: ['Musique'],
  disponibilite: 'maintenant', dispo_date: '',
  typePoste: ['cdi'], lieu: 'hybride', ville: 'Paris',
  permis: ['B'], priorite: ['Impact réel'],
  experiences: [{ poste: 'Dev', entreprise: 'Acme', date_debut: '2020', date_fin: '', en_poste: true, missions: 'Coder' }],
  diplomes: [{ intitule: 'Master', ecole: 'EPFL', annee: '2020', mention: 'TB' }],
  competences_acquises: ['TypeScript'], langues: ['Français — Courant'],
}

// ─── Constantes ───────────────────────────────────────────────────────────────

describe('constantes', () => {
  it('ONBOARDING_TOTAL vaut 9', () => {
    expect(ONBOARDING_TOTAL).toBe(9)
  })
  it('STEP_OFFSET vaut 100', () => {
    expect(STEP_OFFSET).toBe(100)
  })
  it('LAST_STEP vaut 109', () => {
    expect(LAST_STEP).toBe(109)
  })
  it('screenToStep(9) === LAST_STEP', () => {
    expect(screenToStep(9)).toBe(LAST_STEP)
  })
  it('stepToScreen(LAST_STEP) === ONBOARDING_TOTAL', () => {
    expect(stepToScreen(LAST_STEP)).toBe(ONBOARDING_TOTAL)
  })
})

// ─── convertSavedStep ─────────────────────────────────────────────────────────

describe('convertSavedStep', () => {
  // Nouvelles valeurs 101-109 → passe directement
  it('101 → écran 1', () => expect(convertSavedStep(101)).toBe(1))
  it('105 → écran 5', () => expect(convertSavedStep(105)).toBe(5))
  it('109 → écran 9', () => expect(convertSavedStep(109)).toBe(9))

  // Anciennes valeurs 1-15
  it('1 → 1',  () => expect(convertSavedStep(1)).toBe(1))
  it('2 → 2',  () => expect(convertSavedStep(2)).toBe(2))
  it('3 → 2',  () => expect(convertSavedStep(3)).toBe(2))
  it('4 → 3',  () => expect(convertSavedStep(4)).toBe(3))
  it('5 → 3',  () => expect(convertSavedStep(5)).toBe(3))
  it('6 → 3',  () => expect(convertSavedStep(6)).toBe(3))
  it('7 → 4',  () => expect(convertSavedStep(7)).toBe(4))
  it('8 → 4',  () => expect(convertSavedStep(8)).toBe(4))
  it('9 → 5',  () => expect(convertSavedStep(9)).toBe(5))
  it('10 → 5', () => expect(convertSavedStep(10)).toBe(5))
  it('11 → 6', () => expect(convertSavedStep(11)).toBe(6))
  it('12 → 5', () => expect(convertSavedStep(12)).toBe(5))
  it('13 → 7', () => expect(convertSavedStep(13)).toBe(7))
  it('14 → 8', () => expect(convertSavedStep(14)).toBe(8))
  it('15 → 9', () => expect(convertSavedStep(15)).toBe(9))
  it('0 → 1',  () => expect(convertSavedStep(0)).toBe(1))
})

// ─── firstIncompleteStep ──────────────────────────────────────────────────────

describe('firstIncompleteStep', () => {
  it('retourne 1 si le formulaire est vide', () => {
    expect(firstIncompleteStep(EMPTY_FORM)).toBe(1)
  })

  it('retourne 1 si seul le prénom est rempli', () => {
    expect(firstIncompleteStep({ ...EMPTY_FORM, prenom: 'Alice' })).toBe(1)
  })

  it('retourne 1 si seul le nom est rempli', () => {
    expect(firstIncompleteStep({ ...EMPTY_FORM, nom: 'Martin' })).toBe(1)
  })

  it('retourne 2 si écran 1 complet mais domaine manquant', () => {
    expect(firstIncompleteStep({ ...EMPTY_FORM, prenom: 'Alice', nom: 'Martin' })).toBe(2)
  })

  it('retourne 2 si domaine rempli mais expérience manquante', () => {
    expect(firstIncompleteStep({ ...EMPTY_FORM, prenom: 'Alice', nom: 'Martin', domaine: 'Tech' })).toBe(2)
  })

  it('retourne 3 si écrans 1-2 complets mais step3Done=false (défaut)', () => {
    const d = { ...EMPTY_FORM, prenom: 'Alice', nom: 'Martin', domaine: 'Tech', experience: '3-5 ans' }
    expect(firstIncompleteStep(d)).toBe(3)
  })

  it('retourne 3 si écrans 1-2 complets et step3Done=false explicite', () => {
    const d = { ...EMPTY_FORM, prenom: 'Alice', nom: 'Martin', domaine: 'Tech', experience: '3-5 ans' }
    expect(firstIncompleteStep(d, false)).toBe(3)
  })

  it('retourne 5 si step3Done=true mais typePoste vide', () => {
    const d = { ...EMPTY_FORM, prenom: 'Alice', nom: 'Martin', domaine: 'Tech', experience: '3-5 ans' }
    expect(firstIncompleteStep(d, true)).toBe(5)
  })

  it('retourne 5 si typePoste rempli mais lieu manquant', () => {
    const d = { ...EMPTY_FORM, prenom: 'Alice', nom: 'Martin', domaine: 'Tech', experience: '3-5 ans', typePoste: ['cdi'] }
    expect(firstIncompleteStep(d, true)).toBe(5)
  })

  it('retourne 5 si disponibilite manquante', () => {
    const d = { ...EMPTY_FORM, prenom: 'Alice', nom: 'Martin', domaine: 'Tech', experience: '3-5 ans', typePoste: ['cdi'], lieu: 'hybride' }
    expect(firstIncompleteStep(d, true)).toBe(5)
  })

  it('retourne 5 si disponibilite=a_partir_de mais dispo_date vide', () => {
    const d = { ...EMPTY_FORM, prenom: 'Alice', nom: 'Martin', domaine: 'Tech', experience: '3-5 ans',
      typePoste: ['cdi'], lieu: 'hybride', disponibilite: 'a_partir_de', dispo_date: '' }
    expect(firstIncompleteStep(d, true)).toBe(5)
  })

  it('retourne 9 si tout est complet (step3Done=true)', () => {
    expect(firstIncompleteStep(FULL, true)).toBe(9)
  })

  it('retourne 9 si disponibilite=maintenant (sans date)', () => {
    const d = { ...EMPTY_FORM, prenom: 'Alice', nom: 'Martin', domaine: 'Tech', experience: '3-5 ans',
      typePoste: ['cdi'], lieu: 'hybride', disponibilite: 'maintenant' }
    expect(firstIncompleteStep(d, true)).toBe(9)
  })

  it('retourne 9 si disponibilite=a_partir_de avec date fournie', () => {
    const d = { ...EMPTY_FORM, prenom: 'Alice', nom: 'Martin', domaine: 'Tech', experience: '3-5 ans',
      typePoste: ['cdi'], lieu: 'hybride', disponibilite: 'a_partir_de', dispo_date: '2026-01-01' }
    expect(firstIncompleteStep(d, true)).toBe(9)
  })
})

// ─── buildStepPayload ─────────────────────────────────────────────────────────

describe('buildStepPayload', () => {
  const MAX = screenToStep(5)  // 105

  // Écran 1
  it('écran 1 retourne null si prenom et nom vides', () => {
    expect(buildStepPayload(1, EMPTY_FORM, MAX)).toBeNull()
  })
  it('écran 1 retourne le payload si prenom seul rempli', () => {
    const r = buildStepPayload(1, { ...EMPTY_FORM, prenom: 'Alice' }, MAX)
    expect(r).toMatchObject({ prenom: 'Alice', nom: '', onboarding_step: MAX })
  })
  it('écran 1 inclut prenom et nom', () => {
    const r = buildStepPayload(1, { ...EMPTY_FORM, prenom: 'Alice', nom: 'Martin' }, MAX)
    expect(r).toMatchObject({ prenom: 'Alice', nom: 'Martin', onboarding_step: MAX })
  })

  // Écran 2
  it('écran 2 retourne null si domaine et experience vides', () => {
    expect(buildStepPayload(2, EMPTY_FORM, MAX)).toBeNull()
  })
  it('écran 2 retourne le payload si domaine seul rempli', () => {
    const r = buildStepPayload(2, { ...EMPTY_FORM, domaine: 'Tech' }, MAX)
    expect(r).toMatchObject({ domaine: 'Tech', onboarding_step: MAX })
  })

  // Écran 3
  it('écran 3 retourne toujours null (persisté par QualitesCarousel)', () => {
    expect(buildStepPayload(3, EMPTY_FORM, MAX)).toBeNull()
    expect(buildStepPayload(3, FULL, MAX)).toBeNull()
  })

  // Écran 4
  it('écran 4 retourne null si projet et passions vides', () => {
    expect(buildStepPayload(4, EMPTY_FORM, MAX)).toBeNull()
  })
  it('écran 4 inclut projet_phare si rempli', () => {
    const r = buildStepPayload(4, { ...EMPTY_FORM, projet: 'Mon projet', projet_titre: 'Titre' }, MAX)
    expect(r).toMatchObject({ projet_phare: 'Mon projet', projet_titre: 'Titre', onboarding_step: MAX })
  })
  it('écran 4 met projet_titre à null si vide', () => {
    const r = buildStepPayload(4, { ...EMPTY_FORM, projet: 'Mon projet', projet_titre: '' }, MAX)
    expect(r).toMatchObject({ projet_phare: 'Mon projet', projet_titre: null })
  })
  it('écran 4 inclut passions', () => {
    const r = buildStepPayload(4, { ...EMPTY_FORM, passions: ['Musique'] }, MAX)
    expect(r).toMatchObject({ passions: ['Musique'], onboarding_step: MAX })
  })

  // Écran 5
  it('écran 5 retourne null si tout est vide', () => {
    expect(buildStepPayload(5, EMPTY_FORM, MAX)).toBeNull()
  })
  it('écran 5 inclut type_poste', () => {
    const r = buildStepPayload(5, { ...EMPTY_FORM, typePoste: ['cdi'] }, MAX)
    expect(r).toMatchObject({ type_poste: ['cdi'], onboarding_step: MAX })
  })
  it('écran 5 inclut mode_travail et ville', () => {
    const r = buildStepPayload(5, { ...EMPTY_FORM, lieu: 'hybride', ville: 'Paris' }, MAX)
    expect(r).toMatchObject({ mode_travail: 'hybride', ville: 'Paris', onboarding_step: MAX })
  })
  it('écran 5 inclut permis', () => {
    const r = buildStepPayload(5, { ...EMPTY_FORM, typePoste: ['cdi'], lieu: 'hybride', permis: ['B'], disponibilite: 'maintenant' }, MAX)
    expect(r).toMatchObject({ permis: ['B'] })
  })
  it('écran 5 inclut disponibilite avec dispo_date null si pas a_partir_de', () => {
    const r = buildStepPayload(5, { ...EMPTY_FORM, disponibilite: 'maintenant', dispo_date: '2026-01-01' }, MAX)
    expect(r).toMatchObject({ disponibilite: 'maintenant', dispo_date: null })
  })
  it('écran 5 inclut dispo_date si a_partir_de', () => {
    const r = buildStepPayload(5, { ...EMPTY_FORM, disponibilite: 'a_partir_de', dispo_date: '2026-01-01' }, MAX)
    expect(r).toMatchObject({ disponibilite: 'a_partir_de', dispo_date: '2026-01-01' })
  })
  it('écran 5 met dispo_date à null si a_partir_de sans date', () => {
    const r = buildStepPayload(5, { ...EMPTY_FORM, disponibilite: 'a_partir_de', dispo_date: '' }, MAX)
    expect(r).toMatchObject({ disponibilite: 'a_partir_de', dispo_date: null })
  })

  // Écran 6
  it('écran 6 retourne null si priorite vide', () => {
    expect(buildStepPayload(6, EMPTY_FORM, MAX)).toBeNull()
  })
  it('écran 6 inclut priorites', () => {
    const r = buildStepPayload(6, { ...EMPTY_FORM, priorite: ['Impact réel'] }, MAX)
    expect(r).toMatchObject({ priorites: ['Impact réel'], onboarding_step: MAX })
  })

  // Écran 7
  it('écran 7 retourne null si experiences vide', () => {
    expect(buildStepPayload(7, EMPTY_FORM, MAX)).toBeNull()
  })
  it('écran 7 inclut experiences', () => {
    const exp = [{ poste: 'Dev', entreprise: 'Acme', date_debut: '2020', date_fin: '', en_poste: true, missions: 'Coder' }]
    const r = buildStepPayload(7, { ...EMPTY_FORM, experiences: exp }, MAX)
    expect(r).toMatchObject({ experiences: exp, onboarding_step: MAX })
  })

  // Écran 8
  it('écran 8 retourne null si diplomes vide', () => {
    expect(buildStepPayload(8, EMPTY_FORM, MAX)).toBeNull()
  })
  it('écran 8 inclut diplomes', () => {
    const dip = [{ intitule: 'Master', ecole: 'EPFL', annee: '2020', mention: 'TB' }]
    const r = buildStepPayload(8, { ...EMPTY_FORM, diplomes: dip }, MAX)
    expect(r).toMatchObject({ diplomes: dip, onboarding_step: MAX })
  })

  // Écran 9
  it('écran 9 retourne null si competences et langues vides', () => {
    expect(buildStepPayload(9, EMPTY_FORM, MAX)).toBeNull()
  })
  it('écran 9 inclut competences_acquises', () => {
    const r = buildStepPayload(9, { ...EMPTY_FORM, competences_acquises: ['TypeScript'] }, MAX)
    expect(r).toMatchObject({ competences_acquises: ['TypeScript'], onboarding_step: MAX })
  })
  it('écran 9 inclut langues', () => {
    const r = buildStepPayload(9, { ...EMPTY_FORM, langues: ['Français — Courant'] }, MAX)
    expect(r).toMatchObject({ langues: ['Français — Courant'], onboarding_step: MAX })
  })

  // Écran inconnu
  it('retourne null pour un écran inconnu (0, 10, 99)', () => {
    expect(buildStepPayload(0,  EMPTY_FORM, MAX)).toBeNull()
    expect(buildStepPayload(10, EMPTY_FORM, MAX)).toBeNull()
    expect(buildStepPayload(99, EMPTY_FORM, MAX)).toBeNull()
  })

  // Invariants
  it('inclut toujours onboarding_step dans chaque payload non-null', () => {
    for (const s of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      const r = buildStepPayload(s, FULL, MAX)
      if (r !== null) expect(r).toHaveProperty('onboarding_step', MAX)
    }
  })
  it("n'inclut jamais onboarding_completed", () => {
    for (const s of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      const r = buildStepPayload(s, FULL, MAX)
      if (r !== null) expect(r).not.toHaveProperty('onboarding_completed')
    }
  })
  it('onboarding_step reflète le maxStep passé, pas l\'écran courant', () => {
    const r = buildStepPayload(2, { ...EMPTY_FORM, domaine: 'Tech' }, 107)
    expect(r?.onboarding_step).toBe(107)
  })
  it("n'écrit jamais la colonne signature", () => {
    for (const s of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      const r = buildStepPayload(s, FULL, MAX)
      if (r !== null) expect(r).not.toHaveProperty('signature')
    }
  })
})
